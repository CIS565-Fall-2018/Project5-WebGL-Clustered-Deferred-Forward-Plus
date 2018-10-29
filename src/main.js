import { makeRenderLoop, camera, cameraControls, gui, gl } from './init';
import ForwardRenderer from './renderers/forward';
import ForwardPlusRenderer from './renderers/forwardPlus';
import ClusteredRenderer from './renderers/clustered';
import Scene from './scene';
import GpuBinningRenderer from './renderers/gpuBinning';//me
import GpuBinningDebugRenderer from './renderers/gpuBinningDebug';//me

const FORWARD = 'Forward';
const FORWARD_PLUS = 'Forward+';
const CLUSTERED = 'Clustered';
const GPU_BINNING = 'GpuBinning';//me
const GPU_BINNING_DEBUG = 'GpuBinningDebug';//me

const params = {
  renderer: FORWARD_PLUS,
  _renderer: null,
};

setRenderer(params.renderer);

function setRenderer(renderer) {
  switch(renderer) {
    case FORWARD:
      params._renderer = new ForwardRenderer();
      break;
    case FORWARD_PLUS:
      params._renderer = new ForwardPlusRenderer(15, 15, 15, camera);
      break;
    case CLUSTERED:
      params._renderer = new ClusteredRenderer(15, 15, 15, camera);
      break;
    case GPU_BINNING:
      params._renderer = new GpuBinningRenderer(15, 15, 15, camera);
      break;
    case GPU_BINNING_DEBUG:
      params._renderer = new GpuBinningDebugRenderer(15, 15, 15, camera);
      break;
  }
}

gui.add(params, 'renderer', [FORWARD, FORWARD_PLUS, CLUSTERED, GPU_BINNING, GPU_BINNING_DEBUG]).onChange(setRenderer);

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