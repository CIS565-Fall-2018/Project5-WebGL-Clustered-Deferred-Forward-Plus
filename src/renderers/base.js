import TextureBuffer from './textureBuffer';
import { mat4, vec4, vec3} from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';

export const MAX_LIGHTS_PER_CLUSTER = 100;

export default class BaseRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices,
      // the + 1 stands for the number of lights
      MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
  }

  updateClusters(camera, viewMatrix, scene) {
    // TODO: Update the cluster texture with the count and indices of the lights in each cluster
    // This will take some time. The math is nontrivial...
    // scene.lights

    // this._lightTexture.buffer[this._lightTexture.bufferIndex(i, 0) + 0] = scene.lights[i].position[0];
    // this._lightTexture.buffer[this._lightTexture.bufferIndex(i, 0) + 1] = scene.lights[i].position[1];
    // this._lightTexture.buffer[this._lightTexture.bufferIndex(i, 0) + 2] = scene.lights[i].position[2];

    // this._lightTexture.buffer[this._lightTexture.bufferIndex(i, 0) + 3] = scene.lights[i].radius;

    // this._lightTexture.buffer[this._lightTexture.bufferIndex(i, 1) + 0] = scene.lights[i].color[0];
    // this._lightTexture.buffer[this._lightTexture.bufferIndex(i, 1) + 1] = scene.lights[i].color[1];
    // this._lightTexture.buffer[this._lightTexture.bufferIndex(i, 1) + 2] = scene.lights[i].color[2];
    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          // Reset the light count to 0 for every cluster
          // console.log(this._clusterTexture.buffer);
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0.0;
        }
      }
    }

    // get bottom left
    // NDC is x-y, depth is z
    let fov = Math.abs(Math.tan(camera.fov * Math.PI / 180.0 / 2.0));

    for (let lightIdx = 0; lightIdx < NUM_LIGHTS; ++lightIdx) {
      // find bounding box
      let modelPos = vec4.fromValues(
        scene.lights[lightIdx].position[0], 
        scene.lights[lightIdx].position[1], scene.lights[lightIdx].position[2],
        1.0);

      let radius = scene.lights[lightIdx].radius;
      var viewPos = vec4.fromValues(0, 0, 0, 0);
      vec4.transformMat4(viewPos, modelPos, this._viewMatrix);
      
      let yLen = Math.abs(fov * viewPos[2]);
      let xLen = Math.abs(camera.aspect * yLen);

      let xInter = (viewPos[0] - radius + xLen) / (xLen + xLen);
      let yInter = (viewPos[1] - radius + yLen) / (yLen + yLen);
      let zInter = (-viewPos[2] - radius - camera.near) / (camera.far - camera.near);

      let xMin = Math.floor(xInter * this._xSlices);
      let yMin = Math.floor(yInter * this._ySlices);
      let zMin = Math.floor(zInter * this._zSlices);

      let xInterMax = (viewPos[0] + radius + xLen) / (xLen + xLen);
      let yInterMax = (viewPos[1] + radius + yLen) / (yLen + yLen);
      let zInterMax = (-viewPos[2] + radius - camera.near) / (camera.far - camera.near);

      // check out of bounds

      if (xInterMax <= 0 && xInter <= 0 || 
          yInterMax <= 0 && yInter <= 0 || 
          zInterMax <= 0 && zInter <= 0 ||
          xInterMax >= 1 && xInter >= 1 || 
          yInterMax >= 1 && yInter >= 1 || 
          zInterMax >= 1 && zInter >= 1) {
            continue;
      }

      let xMax = Math.floor(xInterMax * this._xSlices);
      let yMax = Math.floor(yInterMax * this._ySlices);
      let zMax = Math.floor(zInterMax * this._zSlices);

      xMin = Math.min(this._xSlices-1, Math.max(0, xMin));
      yMin = Math.min(this._ySlices-1, Math.max(0, yMin));
      zMin = Math.min(this._zSlices-1, Math.max(0, zMin));

      xMax = Math.min(this._xSlices-1, Math.max(0, xMax));
      yMax = Math.min(this._ySlices-1, Math.max(0, yMax));
      zMax = Math.min(this._zSlices-1, Math.max(0, zMax));

      for (let z = zMin; z <= zMax; ++z) {
        for (let y = yMin; y <= yMax; ++y) {
          for (let x = xMin; x <= xMax; ++x) {
            // calc # light
            let clusterIdx = x + y * this._xSlices + z * this._xSlices * this._ySlices;
            let clusterIdxInBuffer = this._clusterTexture.bufferIndex(clusterIdx, 0);
            // HERE(zichuanyu)
            let numLights = this._clusterTexture._buffer[clusterIdxInBuffer];

            if (numLights < MAX_LIGHTS_PER_CLUSTER) {
              ++numLights;
              this._clusterTexture._buffer[clusterIdxInBuffer] = numLights;
              let texV = Math.floor(numLights / 4);
              let offet = numLights - texV * 4;
              this._clusterTexture._buffer[this._clusterTexture.bufferIndex(clusterIdx, texV) + offet] = lightIdx;
            }    
          }
        }
      }
    }

    this._clusterTexture.update();
  }
}