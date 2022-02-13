import React, {useEffect, useState, useCallback, Fragment} from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import lifeform from '../../data/models/bot-3.gltf';
import imageFrame from '../../images/frame-dark-1.png';
import BrButton from './lib/BrButton';
import { EffectComposer } from '../3d/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '../3d/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from '../3d/jsm/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { setAlphaToEmissive, loadImageToMaterial, hueToColor, hexColorToInt, intToHexColor, HitTester } from '../helpers/3d';
import { cloneObj, StateCheck, isLocal } from '../helpers/helpers';
import gameConfig, { partIdToName } from '../../data/world/config';
import getText, { exclamation } from '../../data/world/text';
import { CompactPicker } from 'react-color';
import domtoimage from 'dom-to-image';
import Battle from '../helpers/battle';
let b = new Battle();

function getNearKartsServerURL(forceRemote=false) {
  let url = 'https://localhost:8926';

  if(!isLocal() || forceRemote) {
    url =  'https://benrazor.net:8926';
  }

  return url;
}

const nearKartsURL = getNearKartsServerURL();

const DEBUG_FORCE_BATTLE = false;
const DEBUG_IMAGES = false;
const DEBUG_NO_MINT = false;
const DEBUG_KART = false;
const DEBUG_FAST_BATTLE = true;

const baseNFTData = {
  "version": 0,
  "level": 0,
  "left": 0,
  "right": 0,
  "top": 0,
  "front": 0,
  "skin": 3,
  "transport": 0,
  "color1": 4473924,
  "color2": 0,
  "ex1": 0,
  "ex2": 0,
  "decal1": "7",
  "decal2": "",
  "decal3": "",
  "extra1": "",
  "extra2": "",
  "extra3": ""
};

const loader = new GLTFLoader();
const baseImageURL = 'https://storage.googleapis.com/birdfeed-01000101.appspot.com/strange-juice-1/';

const w = 1000;
const h = 800;
const wPhoto = 400;
const hPhoto = 400;
let textDelay = 2000;
if(DEBUG_FAST_BATTLE) {
  textDelay = 200;
}

const keysPressed = {};
const speed = 2;

const kartDetailsOnImage = false;

document.addEventListener('keydown', e => {
  keysPressed[e.key.toLowerCase()] = true;
})
document.addEventListener('keyup', e => {
  keysPressed[e.key.toLowerCase()] = false;
});

const stateCheck = new StateCheck();

function NearKarts(props) {
  const nftList = props.nftList;
  const nftData = props.nftData;
  const setNFTData = props.setNFTData;
  const nftMetadata = props.nftMetadata;
  const activeTokenId = props.activeTokenId;
  const setActiveTokenId = props.setActiveTokenId;
  const activeKart = props.activeKart;
  const execute = props.execute;
  const processingActions = props.processingActions;
  const toast = props.toast;
  const battleKarts = props.battleKarts;
  const battleResult = props.battleResult;
  const setBattleResult = props.setBattleResult;
  const battleConfig = props.battleConfig;
  const setBattleConfig = props.setBattleConfig;
  const lastBattle = props.lastBattle;
  const SCREENS = props.SCREENS;
  const screen = props.screen;
  const setScreen = props.setScreen;

  window.nftData = nftData;

  const threeRef = React.createRef();
  const threePhotoRef = React.createRef();
  const photoComposerRef = React.createRef();
  const battleTextRef = React.createRef();

  const [scene, setScene] = useState();
  const [camera, setCamera] = useState();
  const [sjScene, setSJScene] = useState();
  const [photoScene, setPhotoScene] = useState();
  const [photoSubScene, setPhotoSubScene] = useState();
  const [sceneIndex, setSceneIndex] = useState(0);
  const [groupIndex, setGroupIndex] = useState(0);
  const [lineIndex, setLineIndex] = useState(0);
  const [prevNFTData, setPrevNFTData] = useState({});
  const [kartNameEntry, setKartNameEntry] = useState('');
  const [replayReq, setReplayReq] = useState(0);
  const [controlEntry, setControlEntry] = useState({ ...gameConfig.defaultKartEntry });

  const [imageDataURL, setImageDataURL] = useState('');
  const [kartImageRendered, setKartImageRendered] = useState(false);
  const [renderRequested, setRenderRequested] = useState();
  const [prevScreen, setPrevScreen] = useState(SCREENS.garage);
  const [battle, setBattle] = useState({});
  const [battleText, setBattleText] = useState([]);
  const [battlePower, setBattlePower] = useState([100, 100])
  const [battleHit, setBattleHit] = useState([0, 0])
  const [battleAttacking, setBattleAttacking] = useState([0, 0])
  const [battleStarted, setBattleStarted] = useState();
  const [battleEnded, setBattleEnded] = useState();
  const [orbitControls, setOrbitControls] = useState();
  const [garagePanel, setGaragePanel] = useState('equip');


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

    kartConfig.decal1 = nftData.decal1;
    kartConfig.decal2 = nftData.decal2;
    kartConfig.decal3 = nftData.decal3;
    
    kartConfig.unlockedDecals = nftData.extra1 ? [...nftData.extra1.split(','), '0', '7'] : ['', '0', '7'];

    return kartConfig;
  }

  function validDecal(decal) {
    let isValid = !decal || decal === '0' || controlEntry.unlockedDecals.includes(decal);
    return isValid;
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

    nftData.decal1 = kartConfig.decal1;
    nftData.decal2 = kartConfig.decal2;
    nftData.decal3 = kartConfig.decal3;

    return nftData;
  }

  useEffect(() => {
    let changedKeys = kartChanged(nftData, prevNFTData);

    if(changedKeys.length && nftData !== {}) {
      let kartConfig = nftDataToKartConfig(nftData);
      setControlEntry(kartConfig);
      setPrevNFTData({...nftData});
      if(DEBUG_FORCE_BATTLE) {
        startBattle();
      }
    }

  }, [nftData, prevNFTData]);

  function getTextureURL(element, style) {
    if(!style) style = 0;
    let url = baseImageURL + `set-1-${element}-${style}.png`;
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
          console.log('child material name', child.material.name);

          if(child.material.name === 'MatBodyDecal1') {
            loadImageToMaterial(child.material, getTextureURL('badge', controlEntry.decal1));
          }
          if(child.material.name === 'MatBody' || child.material.name === 'MatBodyDecal1') {
            child.material.color = new THREE.Color(controlEntry.color);
            child.material.emissiveIntensity = 5;

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
          }
        }
      }

      if(o.name.startsWith('Decal')) {
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

  const createScene = useCallback((threeElem, w, h, camPos, orbitControls=false, refreshEvery=1, camLookAt=[0,0,0]) => {
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera( 50, w/h, 1, 10 );
    camera.position.copy(camPos);
    camera.lookAt(camLookAt[0], camLookAt[1], camLookAt[2]);

    let controls;

    if(orbitControls) {
      controls = new OrbitControls( camera, threeElem );
      controls.target.set(0, 0.4, 0);
      controls.minDistance = 3;
      controls.maxDistance = 4.5;
      controls.minPolarAngle = 0;
      controls.maxPolarAngle = Math.PI / 2.1;
      controls.autoRotate = false;
      setOrbitControls(controls);
    }

    var renderer = new THREE.WebGLRenderer( { antialias: true, alpha: true, preserveDrawingBuffer: true });
    
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize(w, h);
    renderer.setClearColor(0x000000);
    renderer.toneMapping = THREE.ReinhardToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = 'initial';
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
    let { scene, camera } = createScene(threeRef.current, w, h, 
      new THREE.Vector3(0, 0.5, 4), true, 4, [0, -1.5, 0]);
    setScene(scene);
    setCamera(camera);

    let { scene: photoScene, camera: photoCamera} = createScene(threePhotoRef.current, wPhoto, hPhoto, 
      new THREE.Vector3(0, 1.8, 3.6), false, 20, [0, -0.5, 0]);
    setPhotoScene(photoScene);
  }, []);
  
  function addPointLights(scene, color, intensity, dist, positions=[]) {
    for(let pos of positions) {
      const light = new THREE.PointLight( color, intensity, dist);
      light.position.copy(pos);
      scene.add( light );
    }
  }

  function toggleAutoRotate() {
    if(orbitControls) {
      orbitControls.autoRotate = !orbitControls.autoRotate;
    }
  }

  function getControl(action, src) {
    console.log('PA', processingActions);
    let processing = processingActions?.[action];

    return <div className={"br-strange-juice-control " + (processing ? 'br-border-hide' : '')} onClick={e => execute(action)} key={action}>
      <div className="br-strange-juice-overlay-image-container">
        <img className={"br-strange-juice-overlay-image " + (processing ? 'br-anim-shake-short br-hurt' : '')} alt="Plug socket" src={src} />
      </div>
      <div className={"br-strange-juice-overlay-text " + (processing ? 'br-anim-text-pulse' : '')}>
        { getText('icon_' + action )}
      </div>
    </div>
  }

  function getControlSet(setId, gameConfig) {
    let controlSetUI = [];
    let elems = [];
    let index = 0;
    let disabled;
    let validIndex = getMaxWeaponIndexForLevel(nftData.level);

    if(setId === 'left' || setId === 'right') {
      let optionsWeapon = [];
      let optionsShield = []

      elems = gameConfig.weapons_range;

      index = 0;
      for(let elem of elems) {
        disabled = index > validIndex;
        optionsWeapon.push(
          <option key={setId + elem.id} disabled={disabled} value={elem.id}>{elem.name}</option>
        )
        index++;
      }

      elems = gameConfig.shields_side;

      index = 0;
      for(let elem of elems) {
        disabled = index > validIndex;
        optionsShield.push(
          <option key={setId + elem.id} disabled={disabled} value={elem.id}>{elem.name}</option>
        )
        index++;
      }

      controlSetUI.push(<optgroup key={setId + "Weapons"} label="Weapons">{optionsWeapon}</optgroup>)
      controlSetUI.push(<optgroup key={setId + "Shields"} label="Shields">{optionsShield}</optgroup>)
    }
    else if(setId.startsWith('decal')) {
      elems = gameConfig.decals;
      
      for(let elem of elems) {
        disabled = !validDecal(elem.id);

        controlSetUI.push(
          <option key={setId + elem.id} disabled={disabled} value={elem.id}>{elem.name}</option>
        )
      }
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

      index = 0;
      for(let elem of elems) {
        disabled = index > validIndex;
        controlSetUI.push(
          <option key={setId + elem.id} disabled={disabled} value={elem.id}>{elem.name}</option>
        )
        index++;
      }
    }

    return <select key={setId + 'select'} className="br-feature-select" value={controlEntry[setId]} onChange={e => changeControl(setId, e.target.value)}>
      {controlSetUI}
    </select>;
  }

  function changeControl(setId, value) {
    let _controlEntry = {...controlEntry};
    console.log('cc', setId, value, _controlEntry);
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

  function showBeginnerHelp() {
    return nftList.length === 0;
  }

  function getControlUI(gameConfig, strangeJuice) {
    let controlUI = [];

    if(garagePanel === 'equip') {

      if(showBeginnerHelp()) {
        controlUI.push(<div className="br-info-message">
          <i className="fa fa-info br-info-icon"></i>
          { getText('text_unlock_items') }
        </div>);
      }

      controlUI.push(getControlRow('Left', getControlSet('left', gameConfig)));
      controlUI.push(getControlRow('Right', getControlSet('right', gameConfig)))
      controlUI.push(getControlRow('Front', getControlSet('front', gameConfig)))
      controlUI.push(getControlRow('Wheels', getControlSet('transport', gameConfig)))
      controlUI.push(getControlRow('Skin', getControlSet('skin', gameConfig)))
    }
    else {
      controlUI.push(getControlRow('Color', <div key="ColorChooser">{getColorChooser()}</div>));

      if(showBeginnerHelp()) {
        controlUI.push(<div className="br-info-message">
          <i className="fa fa-info br-info-icon"></i>
          { getText('text_get_new_decals') }
        </div>);
      }

      controlUI.push(getControlRow('Decal', getControlSet('decal1', gameConfig)));
    }

    return controlUI;
  }

  useEffect(() => {
    let lineIndexChanged = stateCheck.changed('lineIndex1', lineIndex, -1);
    let replayReqChanged = stateCheck.changed('replayReq1', replayReq, 0);

    if(lineIndexChanged || replayReqChanged) {
      if(groupIndex > -1 && groupIndex < battleText.length) {
        let timer = setTimeout(() => {

          if(battleText.length) {
            let isLastLineInGroup = lineIndex === battleText[groupIndex].length - 1;

            if(isLastLineInGroup) {
              let isLastGroup = groupIndex === battleText.length - 1;

              if(!isLastGroup) {
                setGroupIndex(groupIndex + 1);
                setLineIndex(0);
              }
              else {
                setBattleEnded(true);
              }
            }
            else {
              setLineIndex(lineIndex + 1);
            }
          }
        }, textDelay);

        return () => { clearInterval(timer) }
      }
    }
  }, [groupIndex, lineIndex, battleText, replayReq]);

  useEffect(() => {
    let battleEndedChanged = stateCheck.changed('battleEnded1', battleEnded);
    if(battleEndedChanged && battleEnded) {
      toast('Battle Ended');
      if(battleConfig.winner === 0) {
        toast(exclamation(getText('text_you_won')));

        if(battleConfig.prize > 0) {
          let decalName  = partIdToName('decals', battleConfig.prize.toString());
          toast(getText('text_won_prize', {'prize_name': decalName}));
        }
      }
      else {
        toast(exclamation(getText('text_you_lost')));
      }
    }
  }, [battleEnded, toast, battleConfig]);

  useEffect(() => {
    setGroupIndex(0);
    setBattleStarted(false);
    setBattleEnded(false);
    setLineIndex(-1);
    setReplayReq(replayReq + 1);
  }, [battleText]);

  useEffect(() => {
    let lineIndexChanged = stateCheck.changed('lineIndexBP', lineIndex, -1);
    
    if(lineIndexChanged && battleText.length) {
      if(b?.rounds?.length) {
        let roundData = b.rounds[groupIndex].data;
        let aggressor = roundData.aggressor;
        let victim = 1 - aggressor;
        let score = roundData.score; 
        let lines = battleText[groupIndex];

        let isFirstLine = lineIndex === 0;
        let isLastLine = lineIndex === lines.length - 1;

        if(isFirstLine) {
          setBattleStarted(true);
          setBattleHit([0, 0]);
          let attacking = [1, 0];
          if(aggressor === 1) attacking = [0, 1];
          setBattleAttacking(attacking)
        }
        else if(isLastLine) {
          let powerHome = Math.max(100 - roundData.totals[1], 0);
          let powerAway = Math.max(100 - roundData.totals[0], 0);
          setBattlePower([powerHome, powerAway])

          if(roundData.score > 0) {
            let battleHit = [0, 1];
            if(aggressor === 1) battleHit = [1, 0];
            setBattleHit(battleHit);
          }
        }
      }
    }
  }, [groupIndex, lineIndex, battleText]);

  function mint() {
    let nftData = kartConfigToNFTData(controlEntry);
    let data = {
      name: kartNameEntry,
      nftData
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
            <BrButton label="Mint" id="render" className="br-button" onClick={render}
                      isSubmitting={renderRequested || processingActions['mintWithImage']} />
            { DEBUG_IMAGES && imageDataURL &&
              <a href={imageDataURL} download={["near_kart", kartName(activeKart?.metadata?.title)].join('_') + '.png'}>Download</a>
            }
          </div>
        </div>
      }
      <div className="br-text-entry-row">
        <BrButton label="Save" id="save" className="br-button" onClick={saveKart} />
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

  function newKart() {
    setActiveTokenId('new_kart');
    setNFTData({ ...baseNFTData });
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

    let newKartActive = false;
    if(!activeTokenId || activeTokenId === 'new_kart') {
      newKartActive = true;
    }

    nftUI.push(<div className={"br-nft-list-item " + (newKartActive ? 'br-nft-list-item-selected' : '')} 
                    key="new_kart" onClick={e => newKart() }>
      { getText('text_new_nft_name')}
    </div>);

    return <Fragment>
      <div className="br-nft-list flexcroll">
        { nftUI }
      </div>
    </Fragment>
  }

  function getImageURL(cid) {
    let imageURL = cid;
    if(!cid.startsWith('http')) {
      imageURL = `https://storage.googleapis.com/near-karts/${cid}.png`; 
    }
    return imageURL;
  }

  function dataURLToFile(src, fileName, mimeType){
    return (fetch(src)
        .then(function(res){return res.arrayBuffer();})
        .then(function(buf){return new File([buf], fileName, {type:mimeType});})
    );
  }

  function render() {
    toast(getText('text_creating_image'));
    setRenderRequested(true);
    /* 
     * Convers a hidden threejs canvas to a dataURL
     * setImageDataURL sets the imageDataURL of an offscreen composer element which applys rounded corners etc.
     * This needs a time to update so set kartImageRendered to let that happen
     * In the useEffect for kartImageRendered, dom-to-image does its job and calls saveImageData to upload
     */
    let dataURL = threePhotoRef.current.getElementsByTagName('canvas')[0].toDataURL();
    setImageDataURL(dataURL);
    setKartImageRendered(true);
  }

  const mintWithImage = useCallback((verifiedImageData) => {
    let nftData = kartConfigToNFTData(controlEntry);

    verifiedImageData.name = kartNameEntry;
    verifiedImageData.nftData = nftData;

    toast(getText('text_mint_request'));
    execute('mintWithImage', verifiedImageData);
  }, [controlEntry, execute, kartNameEntry]);

  const saveImageData = useCallback(async (dataURL) => {
    let f = await dataURLToFile(dataURL, 'bla.png', 'image/png');

    try {
      let fd = new FormData();
      fd.append('file', f);
      let r = await fetch(`${nearKartsURL}/upload`, {method: 'POST', headers: {
      }, body: fd})

      let j = await r.json();
      if(j.success) {
        if(true) {
          toast(getText('success_image_upload'));
          console.log('image data ', getImageURL(j.data.cid));
          if(!DEBUG_NO_MINT) {
            mintWithImage(j.data);
          }
        }
      }
      else {
        console.log('error_image_upload_failed', j);
        toast(getText('error_image_upload_failed'), 'error');
      }
    }
    catch(e) {
      console.log('error_image_upload_failed', e);
      toast(getText('error_image_upload_failed'), 'error');
    }

    setKartImageRendered(false);
    setRenderRequested(false);
  }, [toast, mintWithImage]);

  useEffect(() => {
    if(stateCheck.changed('kartImageRendered', kartImageRendered, false) && kartImageRendered) { 
      domtoimage.toPng(photoComposerRef.current, { style: { display: 'block'}})
      .then(function (dataUrl) {
         saveImageData(dataUrl);
      })
      .catch(function (error) {
          console.error('Unable to render composed Kart image', error);
      });
    }
  }, [kartImageRendered, saveImageData, photoComposerRef]);

  useEffect(() => {
    if(battle.battle) {
      battle.kartConfigs = [
        nftDataToKartConfig(battle.karts[0]),
        nftDataToKartConfig(battle.karts[1])
      ];

      b.load(battle);
      b.generate();

      console.log('battle', b, b.rounds.length);

      let _battleText = [];
      while(!b.finished) {
        let round = b.next(); 
        _battleText.push(round.text);
      }
      setBattleText(_battleText);
    }
  }, [battle]);

  function displayBattleText(battleText) {
    let lines = [];
    let groupLines = [];

    let textGroupIndex = 0;
    for(let group of battleText) {
      if(!battleStarted || textGroupIndex > groupIndex) {
        break;
      }
      let textLineIndex = 0;
      groupLines = [];

      for(let line of group) {
        let isCurrentGroup = textGroupIndex === groupIndex; // Only limit displayed lines for currentGroup

        let activeLineClass = '';

        if(isCurrentGroup && textLineIndex === lineIndex) {
          activeLineClass = 'br-battle-text-line-active';
        }

        let id = `br-battle-text-line-${textGroupIndex}-${textLineIndex}`;
        groupLines.push(<div className={"br-battle-text-line " + activeLineClass} id={id} key={id}>
          {line}
        </div>);

        textLineIndex++;

        if(isCurrentGroup && textLineIndex > lineIndex ) {
          break;
        }
      }
      textGroupIndex++;

      let id = `br-battle-text-group-${textGroupIndex}`;
      lines.push(
        <div className="br-battle-text-group" id={id} key={id}>
          {groupLines.reverse()}
        </div>
      )
    }

    if(lines.length) {
      lines.reverse();
    }

    return <div className="br-battle-text" ref={battleTextRef}>
      {lines}
    </div>
  }

  useEffect(() => {
    setBattleText([]);

    if(screen === SCREENS.battle) {
      setBattlePower([100, 100]);
      setBattleHit([0, 0]);
      setBattleAttacking([0, 0]);
      b.reset();
      setBattle(battleConfig);
    }
    else if(screen === SCREENS.garage) {
      setBattle({});
    }
  }, [screen]);

  function changeScreen(screenID) {
    setPrevScreen(screen);
    setScreen(screenID);
  }

  function startBattle() {
    toast(getText('text_finding_opponent'));
    execute('gameSimpleBattle');
  }

  function watchBattle() {
    toast(getText('text_battle_started'));
    changeScreen(SCREENS.battle)
  }

  function getScreenClass(screenId) {
    let screenClass = 'br-screen-hidden';

    if(screenId === screen) {
      screenClass = 'br-screen-current loading-fade-in-fast';
    }
    else if(screenId === prevScreen) {
      screenClass = 'br-screen-prev loading-fade-out-instant';
    }

    return screenClass;
  }

  useEffect(() => {
    if(battleKarts.length) {
      changeScreen(SCREENS.battleSetup)
    }
  }, [battleKarts]);

  useEffect(() => {
    if(battleResult && battleResult.metadata) {
      setBattleConfig(battleResult);
      setScreen(SCREENS.battleSetup);
    }
  }, [battleResult]);

  function getGaragePanelTabs() {
    let equipActiveClass = garagePanel === 'equip' ? ' br-pill-active ' : '';
    let pimpActiveClass = garagePanel === 'pimp' ? ' br-pill-active ' : '';

    return <div className="br-pills">
      <div className={ "br-pill br-pill-left" + equipActiveClass } onClick={ e => setGaragePanel('equip') }>
        Equipment
      </div>
      <div className={ "br-pill br-pill-right" + pimpActiveClass } onClick={ e => setGaragePanel('pimp') }>
        Pimping
      </div>
    </div> 
  }

  function getMaxWeaponIndexForLevel(level) {
      let weapon_index = Math.max(level + 2, 3);
      return weapon_index;
  }

  function getScreenGarage() {
    let nftListUI;

    nftListUI = <div className="br-nft-gallery">
      { displayNFTs(nftList, activeTokenId) }
      { nftList.length && nftData.level > 0 ?
        <BrButton label="Battle" id="gameSimpleBattle" className="br-button" 
                  onClick={ e => startBattle() }
                  isSubmitting={processingActions['gameSimpleBattle']} />
        :
        ''
      } 
    </div>

    return <Fragment>
      <div className={ "br-screen br-screen-garage " + getScreenClass(SCREENS.garage)}>
        {nftListUI}
        <div className="br-garage loading-fade-in">
          <div className="br-strange-juice-3d" ref={threeRef}>
            <button className="br-autorotate-button br-button br-icon-button"
                    onMouseDown={toggleAutoRotate}><i className="fa fa-sync-alt"></i></button>
          </div>
          <div className="br-strange-juice-overlay">
            { getGaragePanelTabs() }
            { getControlUI(gameConfig, nftData) } 
            { getContractControls() }
          </div>
        </div>

        <div className="br-offscreen">
          <div className="br-photo-composer" ref={photoComposerRef} style={{ width: wPhoto, height: hPhoto, borderRadius: '20px'}}>
            <img className="br-photo-frame" src={imageFrame} alt="Frame" />
            <img alt="Kart NFT" src={imageDataURL} style={ { width: '400px', height: '400px', borderRadius: '80px' } } />
          </div>
        </div>

      </div>
    </Fragment> 
  }

  function getScreenBattleSetup() {
    return <div className={"br-screen br-screen-battle-setup " + getScreenClass(SCREENS.battleSetup)}>
      <div className="br-back-button-holder">
        <BrButton label={<i className="fa fa-arrow-left"></i>} id="go-battle-setup-to-garage" 
                  className="br-button" 
                  onClick={e => changeScreen(SCREENS.garage)} />
      </div>
      <h1>{getText('text_battle_arena')}</h1>
      { battleKarts.length ?
        <div className="br-battle-setup">
          <div className="br-battle-setup-home">
            <h3>{getText('text_your_kart')}</h3>
            <div className="br-battle-setup-home-kart">
              <img className={"br-battle-viewer-image"} alt="Home Kart" src={getImageURL(battleKarts[0].media)} />
              <div className="br-battle-setup-home-kart-name">
                {kartName(battleKarts[0].title)}
              </div>
            </div>
          </div>
          <div className="br-battle-setup-vs">
            <h1>{getText('text_vs')}</h1>
            <BrButton label="Battle" id="battle" className="br-button" onClick={e => watchBattle()} />
          </div>
          <div className="br-battle-setup-away">
            <h3>{getText('text_opponent_kart')}</h3>
            <div className="br-battle-setup-home-kart">
              <img className={"br-battle-viewer-image"} alt="Home Kart" src={getImageURL(battleKarts[1].media)} />
              <div className="br-battle-setup-away-kart-name">
                {kartName(battleKarts[1].title)}
              </div>
            </div>
          </div>
        </div> :
        <div className="br-battle-setup-loading-panel">
          <h3>{getText("text_battle_waiting_1")}</h3>
        </div>
      }
     
    </div>
  }

  function replay() {
    setLineIndex(0);
    setGroupIndex(0);
    setBattlePower([100, 100]);
    setReplayReq(replayReq + 1);
    setBattleEnded(false);
  }

  function getScreenBattle() {
    let ui;
    if(battle.battle && battleText.length) {
      let homeMetadata = battle.metadata[0];
      let awayMetadata = battle.metadata[1];

      ui = <div className="br-battle-viewer">
        <div className={"br-battle-viewer-panel" + 
                        (battleAttacking[0] ? ' br-battle-viewer-attacking ' : '') +
                        (battleHit[0] ? ' box-hit ' : '' )}>
        <div className="br-battle-viewer-kart-details">
          {kartName(homeMetadata.title)}
        </div>
        <div className="br-power-bar-panel">
            <div className={"br-power-bar-outer" + (battleHit[0] ? " br-anim-shake-short br-hurt" : '')}>
              <div className="br-power-bar-inner" style={ { width: `${battlePower[0]}%`}}></div>
            </div>
            <div className="br-power">
              {battlePower[0]}
            </div>
          </div>
          <div className="br-battle-viewer-image-panel">
            <img className={"br-battle-viewer-image " + (battleHit[0] ? "box-hit" : '')} 
                 alt="Home Kart" src={getImageURL(homeMetadata.media)} />
          </div>
        </div>
        <div className="br-battle-viewer-main-panel">
          { (battleAttacking[0] || battleAttacking[1]) && !(battleHit[0] || battleHit[1]) ?
            <div className="br-battle-visuals">
                <div className={"br-battle-arrows br-battle-arrows-anim" +
                                (battleAttacking[1] ? ' br-reverse ' : '')}>
                </div>
            </div>
            :
            ''
          }
          { displayBattleText(battleText) }
        </div>
        <div className={"br-battle-viewer-panel" + 
                        (battleAttacking[1] ? ' br-battle-viewer-attacking ' : '') +
                        (battleHit[1] ? ' box-hit ' : '')}>
          <div className="br-battle-viewer-kart-details">
            {kartName(awayMetadata.title)}
          </div>
          <div className="br-power-bar-panel">
            <div className={"br-power-bar-outer" + (battleHit[1] ? " br-anim-shake-short br-hurt" : '')}>
              <div className="br-power-bar-inner" style={ { width: `${battlePower[1]}%`} }></div>
            </div>
            <div className="br-power">
              {battlePower[1]}
            </div>
          </div>          
          <div className="br-battle-viewer-image-panel">
            <img className={"br-battle-viewer-image " + (battleHit[1] ? "box-hit" : '')} 
                 alt="Away Kart" src={getImageURL(awayMetadata.media)} />
          </div>
        </div>
      </div>
    }
    else {
      ui = <div className="br-screen-battle-no-battle">
        <h3>{ getText('text_battle_loading') }</h3>
      </div>
    }

    return <div className={"br-screen br-screen-battle " + getScreenClass(SCREENS.battle)}>
      <div className="br-back-button-holder">
        <BrButton label={<i className="fa fa-arrow-left"></i>} id="go-battle-to-garage" 
                  className="br-button" 
                  onClick={e => changeScreen(SCREENS.garage)} />
      </div>
      <h2>{ getText('text_battle') }</h2>
      <div className="br-battle-controls-holder">
        <BrButton label="Replay" id="go-battle-to-garage" 
                  className="br-button" 
                  onClick={e => replay() } />
      </div>
      { ui }
    </div>
  }

  return <div className="br-screen-container">
    { getScreenGarage() }
    { getScreenBattleSetup() }
    { getScreenBattle() }

    <div className="br-photo-booth" ref={threePhotoRef}>
    </div>
  </div>
}

export default NearKarts;