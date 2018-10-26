import { makeRenderLoop, camera, cameraControls, gui, gl } from './init';
import ForwardRenderer from './renderers/forward';
import ForwardPlusRenderer from './renderers/forwardPlus';
import ClusteredRenderer from './renderers/clustered';
import Scene from './scene';

const FORWARD = 'Forward';
const FORWARD_PLUS = 'Forward+';
const CLUSTERED = 'Clustered';

const params = {
  renderer: FORWARD_PLUS,
  _renderer: null,
  bloom: false,
  toonShading: false,
};

setRenderer(params.renderer);

function setRenderer(renderer) {
  switch(renderer) {
    case FORWARD:
      params._renderer = new ForwardRenderer(params.bloom);
      break;
    case FORWARD_PLUS:
      params._renderer = new ForwardPlusRenderer(15, 15, 15, params.bloom);
      break;
    case CLUSTERED:
      params._renderer = new ClusteredRenderer(15, 15, 15, params.bloom);
      break;
  }
}

function setBloomEffect(){
  switch(params.renderer) {
    case FORWARD:
      params._renderer = new ForwardRenderer(params.bloom);
      break;
    case FORWARD_PLUS:
      params._renderer = new ForwardPlusRenderer(15, 15, 15, params.bloom);
      break;
    case CLUSTERED:
      params._renderer = new ClusteredRenderer(15, 15, 15, params.bloom);
      break;
  }
}

function setToonShading(){
  if(params.toonShading){
    console.log("Toon Shading on");
  }
  else{
    console.log("Toon Shading off");
  }
}


gui.add(params, 'renderer', [FORWARD, FORWARD_PLUS, CLUSTERED]).onChange(setRenderer);

gui.add(params, 'bloom').onChange(setBloomEffect);
gui.add(params,'toonShading').onChange(setToonShading);

const scene = new Scene();
scene.loadGLTF('models/sponza/sponza.gltf');

camera.position.set(-10, 8, 0);
cameraControls.target.set(0, 2, 0);
gl.enable(gl.DEPTH_TEST);

function render() {
  scene.update();
  params._renderer.render(camera, scene);
}

makeRenderLoop(render)();