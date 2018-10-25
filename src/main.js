import { makeRenderLoop, camera, cameraControls, gui, gl } from './init';
import ForwardRenderer from './renderers/forward';
import ForwardPlusRenderer from './renderers/forwardPlus';
import ClusteredRenderer from './renderers/clustered';
import Scene from './scene';

const FORWARD = 'Forward';
const FORWARD_PLUS = 'Forward+';
const CLUSTERED = 'Clustered';
const lambert = 'lambert';
const blinnphong = 'blinnphong';
const toon = 'toon';

var shadingtype = 0;

const params = {
  renderer: FORWARD,
    shadingmode:lambert,
  _renderer: null,
};

setRenderer(params.renderer);

function setRenderer(renderer) {
  if(params.shadingmode == 'lambert')
  {
    shadingtype = 0;
  }
  else if(params.shadingmode == 'blinnphong')
  {
    shadingtype = 1;
  }
  else if(params.shadingmode == 'toon')
  {
    shadingtype = 2;
  }
  switch(renderer) {
    case FORWARD:
      params._renderer = new ForwardRenderer();
      break;
    case FORWARD_PLUS:
      params._renderer = new ForwardPlusRenderer(15, 15, 15);
      break;
    case CLUSTERED:
      params._renderer = new ClusteredRenderer(15, 15, 15,shadingtype);
      break;
  }
}

gui.add(params, 'renderer', [FORWARD, FORWARD_PLUS, CLUSTERED]).onChange(setRenderer);

gui.add(params, 'shadingmode', [blinnphong, lambert,toon]).onChange(function (x) {setRenderer(params.renderer);});

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