import { makeRenderLoop, camera, cameraControls, gui, gl } from './init';
import ForwardRenderer from './renderers/forward';
import ForwardPlusRenderer from './renderers/forwardPlus';
import ClusteredRenderer from './renderers/clustered';
import Scene from './scene';

const FORWARD = 'Forward';
const FORWARD_PLUS = 'Forward+';
const CLUSTERED = 'Clustered';

const params = {
  renderer: CLUSTERED,
  _renderer: null,
};

setRenderer(params.renderer);

function setRenderer(renderer) {
  switch(renderer) {
    case FORWARD:
      params._renderer = new ForwardRenderer();
      break;
    case FORWARD_PLUS:
      params._renderer = new ForwardPlusRenderer(15, 15, 15);
      break;
    case CLUSTERED:
      params._renderer = new ClusteredRenderer(15, 15, 15);
      break;
  }
}

gui.add(params, 'renderer', [FORWARD, FORWARD_PLUS, CLUSTERED]).onChange(setRenderer);

const scene = new Scene();
scene.loadGLTF('models/sponza/sponza.gltf');

camera.position.set(-10, 8, 0);
cameraControls.target.set(0, 2, 0);
gl.enable(gl.DEPTH_TEST);

var count = 0;
var time = 0;
var prev_time = 0;
function render() {
  count++;
  if (count >= 10) count = 0;
  scene.update();
  params._renderer.render(camera, scene);
  let t1 = performance.now();
  time += (t1 - prev_time);
  prev_time = t1;
  if (count === 0 ){
      console.log("Rendering took " + time/10 + " milliseconds.");
      time = 0;
  }

}

makeRenderLoop(render)();