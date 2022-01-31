import React, {useEffect, useState, useCallback, Fragment} from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import lifeform from '../../data/models/bot-1.gltf';
import BrButton from './lib/BrButton';
import { EffectComposer } from '../3d/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '../3d/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from '../3d/jsm/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { setAlphaToEmissive, loadImageToMaterial, hueToColor, hexColorToInt, intToHexColor, HitTester } from '../helpers/3d';
import { cloneObj, StateCheck } from '../helpers/helpers';
import gameConfig from '../../data/world/config';
import sceneConfig from '../../data/world/scenes';
import getText from '../../data/world/text';
import { CompactPicker } from 'react-color';
import { ToastConsumer } from 'react-toast-notifications';
import Canvg, {presets} from 'canvg';
import Battle from '../helpers/battle';

const DEBUG_FORCE_BATTLE = true;

const baseNFTData = {
  "version": 0,
  "level": 0,
  "left": 0,
  "right": 0,
  "top": 0,
  "front": 0,
  "skin": 0,
  "transport": 0,
  "color1": 0,
  "color2": 0,
  "ex1": 0,
  "ex2": 0,
  "decal1": "",
  "decal2": "",
  "decal3": "",
  "extra1": "",
  "extra2": "",
  "extra3": ""
};

const loader = new GLTFLoader();
const baseImageURL = 'https://storage.googleapis.com/birdfeed-01000101.appspot.com/strange-juice-1/';

const w = 500;
const h = 400;
const wPhoto = 400;
const hPhoto = 400;
const storyDelay = 4000;

const keysPressed = {};
const speed = 1.5;

document.addEventListener('keydown', e => {
  keysPressed[e.key.toLowerCase()] = true;
})
document.addEventListener('keyup', e => {
  keysPressed[e.key.toLowerCase()] = false;
});

const stateCheck = new StateCheck();

const SCREENS = {
  garage: 1,
  battleSetup: 2,
  battle: 3
};

function BlokBots(props) {
  const nftList = props.nftList;
  const nftData = props.nftData;
  const nftMetadata = props.nftMetadata;
  const activeTokenId = props.activeTokenId;
  const activeKart = props.activeKart;
  const execute = props.execute;
  const processingActions = props.processingActions;
  const toast = props.toast;
  const battleResult = props.battleResult;

  window.nftData = nftData;

  const threeRef = React.createRef();
  const threePhotoRef = React.createRef();
  const svgRef = React.createRef();
  const canvasRef = React.createRef();

  const [scene, setScene] = useState();
  const [camera, setCamera] = useState();
  const [sjScene, setSJScene] = useState();
  const [photoScene, setPhotoScene] = useState();
  const [photoSubScene, setPhotoSubScene] = useState();
  const [sceneIndex, setSceneIndex] = useState(0);
  const [storyLines, setStoryLines] = useState([]);
  const [storyIndex, setStoryIndex] = useState(0);
  const [storyInfo, setStoryInfo] = useState({});
  const [prevNFTData, setPrevNFTData] = useState({});
  const [kartNameEntry, setKartNameEntry] = useState('');
  const [controlEntry, setControlEntry] = useState({
    front: '',
    left: '',
    right: '',
    top: '',
    transport: 'TransportWheels',
    skin: 'SkinPlastic',
    color: '#ffee00'
  });

  const [imageDataURL, setImageDataURL] = useState('');
  const [svgOverlay, setSVGOverlay] = useState('');
  const [kartImageRendered, setKartImageRendered] = useState();
  const [renderRequested, setRenderRequested] = useState();
  const [screen, setScreen] = useState(SCREENS.garage);
  const [prevScreen, setPrevScreen] = useState(SCREENS.garage);
  const [battle, setBattle] = useState();
  const [battleText, setBattleText] = useState([]);

  const storySection = sceneConfig[sceneIndex].storySection;

  function kartChanged(nftData, prevNFTData) {
    let keys = Object.keys(baseNFTData);

    let changedKeys = [];

    for(let key of keys) {
      if(nftData[key] !== prevNFTData[key]) {
        changedKeys.push(key);
      }
    }

    return changedKeys;
  }

  function nftDataToKartConfig(nftData) {
    let kartConfig = {};
    for(let side of ['left', 'right']) {
      if(nftData[side] >= gameConfig.shield_index_start) {
        kartConfig[side] = gameConfig.shields_side[nftData[side] - gameConfig.shield_index_start]?.id || 'empty';
      }
      else {
        kartConfig[side] = gameConfig.weapons_range[nftData[side]]?.id || 'empty';
      }
    }

    kartConfig.front = gameConfig.weapons_melee[nftData.front]?.id || 'empty';
    kartConfig.skin = gameConfig.skin[nftData.skin]?.id || 'SkinPlastic';
    kartConfig.transport = gameConfig.transport[nftData.transport]?.id || 'TransportWheels';

    kartConfig.color = intToHexColor(nftData.color1);

    return kartConfig;
  }


  function kartConfigToNFTData(kartConfig) {
    let nftData = {...baseNFTData};
    let index;

    for(let side of ['left', 'right']) {
      let elem = kartConfig[side];
      if(elem.startsWith('Weapon')) {
        index = gameConfig.weapons_range.findIndex(x => x.id === elem); 
        nftData[side] = index > 0 ? index : 0;
      }
      else if(elem.startsWith('Shield')) {
        index = gameConfig.shields_side.findIndex(x => x.id === elem);
        nftData[side] = index > -1 ? index + gameConfig.shield_index_start: 0;
      }
    }

    index = gameConfig.weapons_melee.findIndex(x => x.id === kartConfig.front);
    nftData.front = index > 0 ? index : 0;
    index = gameConfig.skin.findIndex(x => x.id === kartConfig.skin);
    nftData.skin = index > 0 ? index : 0;
    index = gameConfig.transport.findIndex(x => x.id === kartConfig.transport);
    nftData.transport = index > 0 ? index : 0;

    nftData.color1 = hexColorToInt(kartConfig.color);

    return nftData;
  }

  useEffect(() => {
    let changedKeys = kartChanged(nftData, prevNFTData);

    if(changedKeys.length) {
      let kartConfig = nftDataToKartConfig(nftData);
      setControlEntry(kartConfig);
      setPrevNFTData({...nftData});
      if(DEBUG_FORCE_BATTLE) {
        startBattle();
      }
    }

  }, [nftData, prevNFTData]);

  function getTextureURL(element, style) {
    let url = baseImageURL + `lifeform-1-${element}-${style}.png`;
    return url;
  }

  function getIconURL(element, style='1') {
    let url = baseImageURL + `icons-1-${element}-${style}.png`;
    return url;
  }

  function startHidden(name) {
    let hidden = false;
    for(let start of gameConfig.start_hidden) {
      if(name.startsWith(start)) {
        hidden = true;
      }
    }
    return hidden;
  }

  const styleScene = useCallback((scene, controlEntry) => {
    scene.traverse(o => {
      if(startHidden(o.name)) {
        o.visible = false;
      }

      if(controlEntry.left) {
        let name = controlEntry.left;

        if(o.name === 'BotTurretL' && name.startsWith('Weapon') && !name.endsWith('Empty')) {
          o.visible = true;
        }

        if(o.name.startsWith(name + 'L')) {
          o.visible = true;
        }
      }

      if(controlEntry.right) {
        let name = controlEntry.right;

        if(o.name === 'BotTurretR' && name.startsWith('Weapon') && !name.endsWith('Empty')) {
          o.visible = true;
        }

        if(o.name.startsWith(name + 'R')) {
          o.visible = true;
        }
      }

      if(controlEntry.front) {
        let name = controlEntry.front;

        if(o.name === 'BotTurretFront' && name.startsWith('Weapon') && !name.endsWith('Empty')) {
          o.visible = true;
        }

        if(o.name.startsWith(name)) {
          o.visible = true;
        }
      }

      if(controlEntry.transport) {
        if(o.name.startsWith(controlEntry.transport)) {
          o.visible = true;
        }
      }

      if(o.name === 'BotBody1') {
        for(let child of o.children) {
          if(child.material.name === 'MatBody') {
            child.material.color = new THREE.Color(controlEntry.color);

            if(controlEntry.skin === 'SkinPlastic') {
              child.material.flatShading = false;
              child.material.roughness = 0;
              child.material.metalness = 0;
            }
            if(controlEntry.skin === 'SkinCarbonFibre') {
              child.material.flatShading = true;
              child.material.roughness = 0.8;
              child.material.metalness = 0;
            }
            if(controlEntry.skin === 'SkinAluminium') {
              child.material.flatShading = true;
              child.material.roughness = 0.4;
              child.material.metalness = 0.5;
            }
            if(controlEntry.skin === 'SkinSteel') {
              child.material.flatShading = true;
              child.material.roughness = 0.2;
              child.material.metalness = 1;
            }

            child.material.needsUpdate = true;
            break;
          }
        }
      }
    });
  }, []);

  useEffect(() => {
    if(sjScene) {
      styleScene(sjScene, controlEntry);
    }
  }, [sjScene, controlEntry, styleScene]);

  useEffect(() => {
    if(photoSubScene) {
      styleScene(photoSubScene, controlEntry);
    }
  }, [photoSubScene, controlEntry, styleScene]);

  useEffect(() => {
    if(scene) {
      loader.load(lifeform, function ( gltf ) {
          scene.add(gltf.scene);
          setSJScene(gltf.scene);
        }, undefined, function ( error ) { console.error( error ); } );  
    }
  }, [scene]);

  useEffect(() => {
    if(photoScene) {
      loader.load(lifeform, function ( gltf ) {
          photoScene.add(gltf.scene);
          setPhotoSubScene(gltf.scene);
        }, undefined, function ( error ) { console.error( error ); } );  
    }
  }, [photoScene]);

  const createScene = useCallback((threeElem, w, h, camPos, orbitControls=false, refreshEvery=1) => {
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(50, w/h, 0.01, 20 );
    camera.position.copy(camPos);
    camera.lookAt(0, 0.4, 0);

    let controls;

    if(orbitControls) {
      controls = new OrbitControls( camera, threeElem );
      controls.target.set(0, 0.4, 0);
      controls.minDistance = 2;
      controls.maxDistance = 4;
      controls.minPolarAngle = 0;
      controls.maxPolarAngle = Math.PI / 2.1;
      controls.autoRotate = true;
    }

    var renderer = new THREE.WebGLRenderer( { antialias: true, alpha: true, preserveDrawingBuffer: true });
    
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize(w, h);
    renderer.setClearColor(0x000000);
    renderer.toneMapping = THREE.ReinhardToneMapping;
    renderer.toneMappingExposure = 1;
    threeElem.appendChild( renderer.domElement );

    addPointLights(scene, 0xffffff, 14, 10, [
      new THREE.Vector3(5, 5, 5), new THREE.Vector3(-5, 5, 5), new THREE.Vector3(0, 5, -2)
    ])

    let i = 0;
    var animate = function () {
      requestAnimationFrame( animate );
      if(controls) controls.update();
      if(i++ % refreshEvery === 0) {
        renderer.render(scene, camera);
      }
    };

    animate();

    return { scene, camera };
  }, []);

  useEffect(() => {
    let { scene, camera } = createScene(threeRef.current, w, h, new THREE.Vector3(0, 0.5, 3), true, 4);
    setScene(scene);
    setCamera(camera);

    let { scene: photoScene, camera: photoCamera} = createScene(threePhotoRef.current, wPhoto, hPhoto, 
      new THREE.Vector3(0, 0.8, 2.8), false, 20);
    setPhotoScene(photoScene);
  }, []);
  
  function addPointLights(scene, color, intensity, dist, positions=[]) {
    for(let pos of positions) {
      const light = new THREE.PointLight( color, intensity, dist);
      light.position.copy(pos);
      scene.add( light );
    }
  }

  function getControl(action, src) {
    console.log('PA', processingActions);
    let processing = processingActions?.[action];

    return <div className={"br-strange-juice-control " + (processing ? 'br-border-hide' : '')} onClick={e => execute(action)} key={action}>
      <div className="br-strange-juice-overlay-image-container">
        <img className={"br-strange-juice-overlay-image " + (processing ? 'br-anim-shake' : '')} alt="Plug socket" src={src} />
      </div>
      <div className={"br-strange-juice-overlay-text " + (processing ? 'br-anim-text-pulse' : '')}>
        { getText('icon_' + action )}
      </div>
    </div>
  }

  function getControlSet(setId, gameConfig) {
    let controlSetUI = [];
    let elems = [];

    if(setId === 'left' || setId === 'right') {
      let optionsWeapon = [];
      let optionsShield = []

      elems = gameConfig.weapons_range;

      for(let elem of elems) {
        optionsWeapon.push(
          <option key={setId + elem.id} value={elem.id}>{elem.name}</option>
        )
      }

      elems = gameConfig.shields_side;

      for(let elem of elems) {
        optionsShield.push(
          <option key={setId + elem.id} value={elem.id}>{elem.name}</option>
        )
      }

      controlSetUI.push(<optgroup key={setId + "Weapons"} label="Weapons">{optionsWeapon}</optgroup>)
      controlSetUI.push(<optgroup key={setId + "Shields"} label="Shields">{optionsShield}</optgroup>)
    }
    else {
      if(setId === 'front') {
        elems = gameConfig.weapons_melee;
      }
      else if(setId === 'skin') {
        elems = gameConfig.skin;
      }
      else if(setId === 'transport') {
        elems = gameConfig.transport;
      }

      if(setId !== 'transport' && setId !== 'skin') {
        controlSetUI.push(<option key={setId + "none"} value="empty">Empty</option>)
      }

      for(let elem of elems) {
        controlSetUI.push(
          <option key={setId + elem.id} value={elem.id}>{elem.name}</option>
        )
      }
    }

    return <select key={setId + 'select'} className="br-feature-select" value={controlEntry[setId]} onChange={e => changeControl(setId, e.target.value)}>
      {controlSetUI}
    </select>;
  }

  function changeControl(setId, value) {
    let _controlEntry = {...controlEntry};
    _controlEntry[setId] = value;
    setControlEntry(_controlEntry);
  }

  function getControlRow(title, control) {
    return <div className="br-feature-row" key={title}>
      <div className="br-feature-title">
        {title}
      </div>
      <div className="br-feature-control">
        {control}
      </div>
    </div>
  }

  function colorChanged(color, event) {
    changeControl('color', color.hex);
  }

  function getColorChooser() {
    const pickerStyle = {
      padding: '0.5em'
    };
    
    return <div style={pickerStyle}><CompactPicker onChange={ colorChanged }/></div>;
  }

  function getControlUI(gameConfig, strangeJuice) {
    let controlUI = [];

    controlUI.push(getControlRow('Left', getControlSet('left', gameConfig)))
    controlUI.push(getControlRow('Right', getControlSet('right', gameConfig)))
    controlUI.push(getControlRow('Front', getControlSet('front', gameConfig)))
    controlUI.push(getControlRow('Wheels', getControlSet('transport', gameConfig)))
    controlUI.push(getControlRow('Skin', getControlSet('skin', gameConfig)))
    controlUI.push(<div key="ColorChooser">{getColorChooser()}</div>);

    return controlUI;
  }

  useEffect(() => {
    /*
    let timer = setTimeout(() => {
      setStoryIndex(storyIndex + 1);
    }, storyDelay);

    return () => { clearInterval(timer) }
    */

  }, [storyIndex]);

  useEffect(() => {
    /*
    if(storySection) {
      setStoryIndex(0);
      setStoryLines([]);
    }
    */
  }, [storySection]);

  useEffect(() => {
    /*
    let lines = story[storySection]['text'];
    console.log('STORY', storySection, storyIndex, lines[storyIndex], story);
    if(storyIndex < lines.length) {
      let _storyLines = [...storyLines];
      _storyLines.push(lines[storyIndex]);
      setStoryLines(_storyLines);
      setStoryInfo({storySection, storyIndex});
    }
    */
  }, [storySection, storyIndex]);

  function mint() {
    let data = {
      name: kartNameEntry
    };

    execute('mint', data);
  }

  function saveKart() {
    let nftData = kartConfigToNFTData(controlEntry);
    console.log(controlEntry, nftData)
    execute('saveKart', nftData);
  }

  function getContractControls() {
    return <div className="br-contract-controls">
      { nftData && 
        <div className="br-text-entry-row">
          <div className="br-text-entry-row-label">
            <input type="text" placeholder={getText('text_kart_name_label')} 
                  value={kartNameEntry} onChange={e => setKartNameEntry(e.target.value)} />
          </div>
          <div className="br-text-entry-row-control">
            <BrButton label="Mint" id="mint" className="br-button br-icon-button" onClick={mint} />
          </div>
        </div>
      }
      <div className="br-text-entry-row">
        <BrButton label="Save" id="save" className="br-button br-icon-button" onClick={saveKart} />
      </div>
      <div className="br-text-entry-row">
        <BrButton label="Render" id="render" className="br-button br-icon-button" onClick={render} />
        { imageDataURL &&
          <a href={imageDataURL} download={["near_kart", kartName(activeKart?.metadata?.title)].join('_') + '.png'}>Download</a>
        }
      </div>
    </div>
  }

  function getTextUI(storyLines) {
    let linesUI = [];

    let i = 0;
    for(let line of storyLines) {
      linesUI.push(<div className="br-strange-juice-story-line" key={i++}>
        {line}
      </div>);
    }

    return <div className="br-strange-juice-story-lines">
      {linesUI}
    </div>
  }

  function kartName(kartTitle) {
    kartTitle = kartTitle || '';
    return kartTitle.replace('A NEAR Kart Called ', '');
  }

  function displayNFTs(nftList, activeTokenId) {
    let nftUI = [];
    let active = false;

    for(let nft of nftList) {
      if(activeTokenId === nft.token_id) {
        active = true;
      }
      else {
        active = false;
      }

      nftUI.push(<div className={"br-nft-list-item " + (active ? 'br-nft-list-item-selected' : '')} 
                      key={nft.token_id} onClick={e => execute('selectNFT', nft.token_id)}>
        {kartName(nft.metadata.title)}
      </div>);
    }

    return <Fragment>
      <div className="br-nft-list">
        { nftUI }
      </div>
    </Fragment>
  }


  function getImageURL(cid) {
    let imageURL = `https://storage.googleapis.com/near-karts/${cid}.jpg`; 
    return imageURL;
  }

  function render() {
    let dataURL = threePhotoRef.current.getElementsByTagName('canvas')[0].toDataURL();
    console.log(dataURL);
    setImageDataURL(dataURL);
    setRenderRequested(true);
  }

  useEffect(() => {
    if(renderRequested) {
      setKartImageRendered(true);
    }
  }, [imageDataURL, renderRequested]); 

  function dataURLToFile(src, fileName, mimeType){
    return (fetch(src)
        .then(function(res){return res.arrayBuffer();})
        .then(function(buf){return new File([buf], fileName, {type:mimeType});})
    );
  }

  const saveImageData = useCallback(async (dataURL) => {
    let f = await dataURLToFile(dataURL, 'bla.png', 'image/png');

    let fd = new FormData();
    console.log('file', f);
    fd.append('file', f);
    let r = await fetch('https://localhost:8926/upload', {method: 'POST', headers: {
    }, body: fd})

    let j = await r.json();
    if(j.success) {
      console.log('save im data');
      if(true) {
        toast('Image uploaded');
        console.log(getImageURL(j.data.cid));

        execute('addImageToNFT', j.data);
      }
    }
    else {
      console.log('Image upload failed', j);
      toast('Image upload failed', 'error');
    }
 }, [toast]);

  const applySVGOverlay = useCallback((photoImageData) => {
    (async () => {
      const canvas = new OffscreenCanvas(wPhoto, hPhoto);
      const ctx = canvas.getContext('2d');
      const v = await Canvg.fromString(ctx, svgRef.current.outerHTML, presets.offscreen());
      await v.render();
  
      const blob = await canvas.convertToBlob();
      var a = new FileReader();
      a.onload = function(e) {
        console.log('url', e.target.result);
        saveImageData(e.target.result);
      }
      a.readAsDataURL(blob);
    })();
  }, [saveImageData, svgRef]);

  useEffect(() => {
    if(stateCheck.changed('kartImageRendered', kartImageRendered, '') && renderRequested) { 
      applySVGOverlay(imageDataURL);
      setRenderRequested(false);
      setKartImageRendered(false);
    }
  }, [kartImageRendered, svgRef, saveImageData, applySVGOverlay, renderRequested, imageDataURL]);

  useEffect(() => {
    if(battleResult.battle) {
      battleResult.kartConfigs = [
        nftDataToKartConfig(battleResult.karts[0]),
        nftDataToKartConfig(battleResult.karts[1])
      ];

      let b = new Battle(battleResult);
      b.generate();
      console.log('battle', b, b.rounds.length);

      let _battleText = [];
      while(!b.finished) {
        let round = b.next();
        _battleText.push(round.text);
      }
      setBattleText(_battleText);
    }
  }, [battleResult]);

  function displayBattleText(battleText) {
    let key = 0;
    let lines = [];

    for(let line of battleText) {
      lines.push(<div className="br-battle-text-line" key={key++}>
        {line}
      </div>);
    }

    console.log('lines', lines);
    return <div className="br-battle-text">
      {lines}
    </div>
  }

  function changeScreen(screenID) {
    setPrevScreen(screen);
    setScreen(screenID);
  }

  function startBattle() {
    execute('gameSimpleBattle', {
      opponentTokenId: "Fatkart Slim1643556930075"
    });

    setScreen(SCREENS.battle);
  }

  function getScreenClass(screenId) {
    let screenClass = 'br-screen-hidden';

    if(screenId === screen) {
      screenClass = 'br-screen-current loading-fade-in-fast';
    }
    else if(screenId === prevScreen) {
      screenClass = 'br-screen-prev loading-fade-out-fast';
    }

    return screenClass;
  }

  function getScreenGarage() {
    let nftListUI;

    if(nftList.length) {
      nftListUI = <div className="br-nft-gallery">
        <h4 className="br-nft-gallery-heading">Your NEAR Karts</h4>
        { displayNFTs(nftList, activeTokenId) }
        <BrButton label="Battle" id="battle" className="br-button br-icon-button" 
                  onClick={e => changeScreen(SCREENS.battleSetup)} />
      </div>
    }

    return <Fragment>
      <div className={ "br-screen br-screen-garage " + getScreenClass(SCREENS.garage)}>
        {nftListUI}
        <div className="br-garage loading-fade-in">
          <div className="br-strange-juice-3d" ref={threeRef}>
          </div>
          <div className="br-strange-juice-overlay">
            { getControlUI(gameConfig, nftData) } 
            { getContractControls() }
          </div>
        </div>
      </div>
    </Fragment> 
  }

  function getScreenBattleSetup() {
    return <div className={"br-screen br-screen-battle-setup " + getScreenClass(SCREENS.battleSetup)}>
      <div className="br-back-button-holder">
        <BrButton label={<i className="fa fa-arrow-left"></i>} id="go-battle-setup-to-garage" 
                  className="br-button br-icon-button" 
                  onClick={e => changeScreen(SCREENS.garage)} />
      </div>
      <h1>{getText('text_battle_arena')}</h1>
      <div className="br-battle-setup">
        <div className="br-battle-setup-home">
          <h3>{getText('text_your_kart')}</h3>
        </div>
        <div className="br-battle-setup-vs">
          <h1>{getText('text_vs')}</h1>
          <BrButton label="Battle" id="battle" className="br-button br-icon-button" onClick={startBattle} />
        </div>
        <div className="br-battle-setup-away">
          <h3>{getText('text_opponent_kart')}</h3>
        </div>
      </div>
    </div>
  }

  function getScreenBattle() {
    let ui;
    if(battleResult.battle) {
      let homeMetadata = battleResult.metadata[0];
      let awayMetadata = battleResult.metadata[1];

      ui = <div className="br-battle-viewer">
        <div className="br-battle-viewer-home-panel">
          <div className="br-battle-viewer-image-panel">
            <img className="br-battle-viewer-image" alt="Home Kart" src={getImageURL(homeMetadata.media)} />
          </div>
        </div>
        <div className="br-battle-viewer-main-panel">
          {displayBattleText(battleText)}
        </div>
        <div className="br-battle-viewer-away-panel">
          <img className="br-battle-viewer-image" alt="Away Kart" src={getImageURL(awayMetadata.media)} />
        </div>
      </div>
    }
    else {
      ui = <div className="br-screen-battle-no-battle">
        <h3>{ getText('text_no_battle') }</h3>
      </div>
    }

    return <div className={"br-screen br-screen-battle " + getScreenClass(SCREENS.battle)}>
      <div className="br-back-button-holder">
        <BrButton label={<i className="fa fa-arrow-left"></i>} id="go-battle-to-garage" 
                  className="br-button br-icon-button" 
                  onClick={e => changeScreen(SCREENS.garage)} />
      </div>
      <h1>NEAR Kart Battle</h1>
      { ui }
    </div>
  }

  return <div className="br-screen-container">
    { getScreenGarage() }
    { getScreenBattleSetup() }
    { getScreenBattle() }

    <div className="br-photo-booth" ref={threePhotoRef}>

    </div>

    <svg ref={svgRef} className="br-photo-overlay" width={wPhoto} height={hPhoto}>
      <defs>
        <rect id="rect" x={0} y={0} width={wPhoto} height={hPhoto} rx="15"/>
        <clipPath id="clip">
          <use href="#rect"/>
        </clipPath>
      </defs>

      <image href={imageDataURL} width={wPhoto} height={hPhoto} clipPath="url(#clip)"/>
      <text x="50%" y="10%" textAnchor="middle" style={ {fill: 'white', fontSize: '20px'} }>{kartName(activeKart?.metadata?.title)}</text>
    </svg>

  </div>
}

export default BlokBots;