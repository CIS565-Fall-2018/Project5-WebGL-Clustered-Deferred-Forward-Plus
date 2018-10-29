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
};

let frame = 0;

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

  startTime = Date.now();
  frame = 0;
}

gui.add(params, 'renderer', [FORWARD, FORWARD_PLUS, CLUSTERED]).onChange(setRenderer);

const scene = new Scene();
scene.loadGLTF('models/sponza/sponza.gltf');

camera.position.set(-10, 8, 0);
cameraControls.target.set(0, 2, 0);
gl.enable(gl.DEPTH_TEST);

function render() {
  frame++;
  scene.update();
  params._renderer.render(camera, scene);
  endTime = Date.now();
}

let startTime = Date.now();
let endTime = 0;


makeRenderLoop(render)();

document.addEventListener('keydown', function(event)
{
  if(event.keyCode == 84)
  {
    let ms = endTime - startTime;
    let mspf = ms / frame;
    let fps = frame / ms * 1000.0;
    console.log("total time = " + ms);
    console.log("frames = " + frame);
    console.log("ms per frame = " + mspf);
    console.log("average fps = " + fps);
  }
});