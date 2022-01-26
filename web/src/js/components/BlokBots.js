import React, {useEffect, useState, useCallback, Fragment} from 'react';
import * as THREE from 'three';
import * as Tone from 'tone';
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
import gameConfig from '../../data/world/config';
import sceneConfig from '../../data/world/scenes';
import getText from '../../data/world/text';
import story from '../../data/story/story.js';
import { SketchPicker } from 'react-color';
import { CompactPicker } from 'react-color';
import { hasUncaughtExceptionCaptureCallback } from 'process';

const baseNFTData = {
    "level": 0,
    "left": 0,
    "right": 0,
    "top": 0,
    "front": 0,
    "skin": 0,
    "transport": 0,
    "color1": 0,
    "color2": 0,
    "decal1": "",
    "decal2": "",
    "decal3": "",
    "extra1": "",
    "extra2": "",
    "extra3": ""
};

const loader = new GLTFLoader();

const VERTEX_SHADER = `varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`;

const FRAGMENT_SHADER = `uniform sampler2D baseTexture;
uniform sampler2D bloomTexture;
varying vec2 vUv;
void main() {
  gl_FragColor = ( texture2D( baseTexture, vUv ) + vec4( 1.0 ) * texture2D( bloomTexture, vUv ) );
}`;

const baseImageURL = 'https://storage.googleapis.com/birdfeed-01000101.appspot.com/strange-juice-1/';

const w = 500;
const h = 400;
const storyDelay = 4000;

const keysPressed = {};
const speed = 1.5;
let velocity = new THREE.Vector3();
let obstaclePos = new THREE.Vector3();
let collisionVec = new THREE.Vector3();
let resolutionVec = new THREE.Vector3();
let resolutionPos = new THREE.Vector3();

let sceneName = '';
let obstacles = [];
let triggers = [];
let hitTesters = [];
let bounds = { z: [], x: []};
let startPos = { x: 0, y: 0, z: 0 };
let elems = {};

document.addEventListener('keydown', e => {
  keysPressed[e.key.toLowerCase()] = true;
})
document.addEventListener('keyup', e => {
  keysPressed[e.key.toLowerCase()] = false;
});

function updateVelocity(velocity, keysPressed) {
  let speedF = 0;
  let speedL = 0;
  velocity.set(0, 0, 0);

  if(keysPressed['s']) {
    speedF = speed;
  }
  else if(keysPressed['w']) {
    speedF = -speed;
  }

  if(keysPressed['a']) {
    speedL = -speed;
  }
  else if(keysPressed['d']) {
    speedL = speed;
  }

  let moving = speedF || speedL;
  if(moving) {
    velocity.set(speedL, 0, speedF);
    velocity.normalize().multiplyScalar(speed);
  }

  return velocity;
}

function BlokBots(props) {
  const nftList = props.nftList;
  const nftData = props.nftData;
  const execute = props.execute;
  const processingActions = props.processingActions;
  const activeTokenId = props.activeTokenId;

  window.nftData = nftData;

  const threeRef = React.createRef();
  const [scene, setScene] = useState();
  const [camera, setCamera] = useState();
  const [clock, setClock] = useState();
  const [audioInitialized, setAudioInitialized] = useState();
  const [sjScene, setSJScene] = useState();
  const [sceneIndex, setSceneIndex] = useState(0);
  const [storyLines, setStoryLines] = useState([]);
  const [storyIndex, setStoryIndex] = useState(0);
  const [storyInfo, setStoryInfo] = useState({});
  const [prevNFTData, setPrevNFTData] = useState({});
  const [controlEntry, setControlEntry] = useState({
    front: '',
    left: '',
    right: '',
    top: '',
    transport: 'TransportWheels',
    skin: 'SkinPlastic',
    color: '#ffee00'
  });

  const controls = sceneConfig[sceneIndex].controls;
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
      console.log('KC', kartConfig, nftData);
      setControlEntry(kartConfig);
      setPrevNFTData({...nftData});
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

  useEffect(() => {
    if(sjScene) {
      sjScene.traverse(o => {
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
    }
  }, [sjScene, controlEntry]);

  let triggerCallback = useCallback((id, isColliding) => {
    console.log('Trigger: ', id, isColliding);
    if(isColliding) {
      setTimeout(() => {
        execute('leave_room_zero');
      }, 10);
    }
  }, [execute]);

  useEffect(() => {
    for(let hitTester of hitTesters) {
      hitTester.callback = triggerCallback;
    }
  }, [execute, triggerCallback]);

  useEffect(() => {
    if(sjScene) {
      console.log('Scene index: ', sceneIndex);
      
      ({ sceneName, obstacles, triggers, bounds, startPos, elems } = sceneConfig[sceneIndex]);

      let lifeformModel = sjScene.getObjectByName('BotEmpty');
      lifeformModel.position.copy(startPos);

      hitTesters = [];
      for(let triggerConfig of triggers) {
        let positionModel = sjScene.getObjectByName(triggerConfig.objId);
        let hitTester = new HitTester(triggerConfig, positionModel, triggerCallback)
        hitTesters.push(hitTester);
        hitTester.test(lifeformModel, true);
      }

      console.log('RESCENING');
      sjScene.traverse(o => {
        if(o.name.startsWith('Scene') && o.name !== 'Scene') {
          console.log('NAME', o.name, sceneName);
          if(o.name.startsWith(sceneName)) {
            o.visible = true;
            console.log('visible', o.visible);
          }
          else {
            o.visible = false;
            console.log('visible', o.visible);
          }
        }

        if(elems && o.name in elems) {
          let condition = elems[o.name].condition;

          if(condition) {
            if(condition(nftData, storyInfo)) {
              o.visible = true;
            }
            else {
              o.visible = false;
            }
          }
        }
      });

      setStoryIndex(0);
      setStoryInfo({});
    }
  }, [sjScene, sceneIndex]);

  useEffect(() => {
    if(scene) {
      loader.load( lifeform, function ( gltf ) {
        console.log('RELOADING');
          scene.add( gltf.scene );
          const mixer = new THREE.AnimationMixer(gltf.scene);
          const clips = gltf.animations;
          setSJScene(gltf.scene);

          let { sceneName, bounds, triggers } = sceneConfig[sceneIndex];

          const raycaster = new THREE.Raycaster();
          const mouse = new THREE.Vector2();

          function onPointerDown( event ) {
            var rect = event.target.getBoundingClientRect();            
            let x = event.clientX - rect.left;
            let y = event.clientY - rect.top;
            mouse.x = ( x / w) * 2 - 1;
            mouse.y = -( y / h) * 2 + 1;
            console.log('cxy', event.clientX, event.clientY, x, y, mouse.x, mouse.y);

            raycaster.setFromCamera( mouse, camera );
            const intersects = raycaster.intersectObjects( gltf.scene.children, true );
            if ( intersects.length > 0 ) {
              const object = intersects[ 0 ].object;
              console.log(object);
            }
            else {
              console.log('no intersect');
            }
          }

          window.addEventListener('pointerdown', onPointerDown); 

        }, undefined, function ( error ) {
          console.error( error );
      } );  
    }
  }, [scene]);

  useEffect(() => {

    const threeElem = threeRef.current;
    const controlsElem = threeRef.current;

    const ENTIRE_SCENE = 0, BLOOM_SCENE = 1;
    const bloomLayer = new THREE.Layers();
    bloomLayer.set( BLOOM_SCENE );

    const params = {
      exposure: 1,
      bloomStrength: 4,
      bloomThreshold: 0,
      bloomRadius: 0.1,
      scene: "Scene with Glow"
    };

    var clock = new THREE.Clock();
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(50, w/h, 0.01, 20 );
    camera.position.x = 0;
    camera.position.y = 0.5;
    camera.position.z = 3;

    let controls = new OrbitControls( camera, threeElem );
    controls.target.set(0, 0.4, 0);
    controls.minDistance = 2;
    controls.maxDistance = 5;
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.autoRotate = true;

    var renderer = new THREE.WebGLRenderer( { antialias: true, alpha: true });
    
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( w, h);
    renderer.setClearColor(0x000000);
    renderer.toneMapping = THREE.ReinhardToneMapping;
    renderer.toneMappingExposure = params.exposure;
    threeElem.appendChild( renderer.domElement );

    const INTENSITY = 14;
    const light = new THREE.PointLight( 0xffffff, INTENSITY, 10 );
    light.position.set( 5, 5, 5 );
    scene.add( light );

    const light2 = new THREE.PointLight( 0xffffff, INTENSITY, 10 );
    light2.position.set(-5,5,5);
    scene.add( light2 );

    const light3 = new THREE.PointLight( 0xffffff, INTENSITY, 10 );
    light3.position.set(0,5,-2);
    scene.add( light3 );

    const renderScene = new RenderPass( scene, camera );

    /* * Bloom settings: *   10, 4, 1, 2 - Desert */
    //const bloomPass = new BloomPass(20, 8, 0.1, 2); 
    const bloomPass = new UnrealBloomPass( new THREE.Vector2( w, h), 1.5, 0.4, 0.85 );
    bloomPass.threshold = params.bloomThreshold;
    bloomPass.strength = params.bloomStrength * 0.3;
    bloomPass.radius = params.bloomRadius;
    bloomPass.bloomTintColors[1] = new THREE.Vector3(1, 1, 1);

    const bloomComposer = new EffectComposer( renderer );
    bloomComposer.renderToScreen = false;
    bloomComposer.addPass( renderScene );
    bloomComposer.addPass( bloomPass );

    const finalPass = new ShaderPass(
      new THREE.ShaderMaterial( {
        uniforms: {
          baseTexture: { value: null },
          bloomTexture: { value: bloomComposer.renderTarget2.texture }
        },
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        defines: {}
      } ), "baseTexture"
    );
    finalPass.needsSwap = true;

    const finalComposer = new EffectComposer( renderer );
    finalComposer.addPass( renderScene );
    finalComposer.addPass( finalPass );
    const smaaPass = new SMAAPass(10, 10)
    finalComposer.addPass(smaaPass);

    /*
    const filmPass = new FilmPass(
      0.05,   // noise intensity
      0.225,  // scanline intensity
      500,    // scanline count
      true,  // grayscale
    );
    finalComposer.addPass(filmPass);
    */

    renderer.setSize( w, h);
    bloomComposer.setSize( w, h);
    finalComposer.setSize( w, h);

    let i = 0;

    var animate = function () {
      requestAnimationFrame( animate );
      controls.update();
      if(i++ % 4 === 0) {
        camera.layers.set( ENTIRE_SCENE );

        /*
        if(window.strangeJuice.evolution > 0) {
          bloomPass.strength = params.bloomStrength * 0.3;
        }
        else {
          bloomPass.strength = 0;
        }
        bloomComposer.render();
        */
        finalComposer.render();
      }
    };

    animate();
    setScene(scene);
    setCamera(camera);
    setClock(clock);
  }, []);

  async function startAudio() {
    await Tone.start();
    setAudioInitialized(true);
  }

  useEffect(() => {
    if(audioInitialized) {
      const synth = new Tone.PolySynth(Tone.Synth).toDestination();
      const now = Tone.now()
      synth.triggerAttack("D4", now);
      synth.triggerAttack("F4", now + 0.5);
      synth.triggerAttack("A4", now + 1);
      synth.triggerAttack("C5", now + 1.5);
      synth.triggerAttack("E5", now + 2);
      synth.triggerRelease(["D4", "F4", "A4", "C5", "E5"], now + 4);
      const feedbackDelay = new Tone.FeedbackDelay(0.33, 0.8).toDestination();
      synth.connect(feedbackDelay);
    }
  }, [audioInitialized]);

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
      name: 'Destruction'
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
        <BrButton label="Mint" id="mint" className="br-button br-icon-button" onClick={mint} />
      }
      <BrButton label="Save" id="save" className="br-button br-icon-button" onClick={saveKart} />
    </div>;
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

  function displayNFTs(nftList, activeTokenId) {
    let nftUI = [];
    let active = false;

    for(let nft of nftList) {
      if(activeTokenId === nft.token_id) {
        active = true;
      }

      nftUI.push(<div className={"br-nft-list-item " + (active ? 'br-nft-list-item-selected' : '')} 
                      key={nft.token_id} onClick={e => execute('selectNFT', nft.token_id)}>
        {nft.metadata.title}
      </div>);
    }

    return <div className="br-nft-list">
      { nftUI }
    </div>
  }

  return <div className="br-strange-juice">
    <div className="br-nft-gallery">
      { displayNFTs(nftList, activeTokenId) }
    </div>
    <div className="br-garage">
      <div className="br-strange-juice-3d" ref={threeRef}>
      </div>
      <div className="br-strange-juice-overlay">
        { getControlUI(gameConfig, nftData) } 
        { getContractControls() }
      </div>
    </div>
    <div className="br-strage-juice-controls">
      <BrButton label="Start Audio" id="startAudio" className="br-button br-icon-button" onClick={startAudio} />
      <BrButton label="Reset" id="reset" className="br-button br-icon-button" onClick={e => execute('do_naughty_reset')} />
    </div>
  </div>
  
}

export default BlokBots;