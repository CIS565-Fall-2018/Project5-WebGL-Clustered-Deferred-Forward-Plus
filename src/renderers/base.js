import TextureBuffer from './textureBuffer';
import { NUM_LIGHTS } from '../scene';
import { mat4, vec4, vec3 } from 'gl-matrix';

export const MAX_LIGHTS_PER_CLUSTER = 2000;

export default class BaseRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
  }

  updateClusters(camera, viewMatrix, scene) {
    // TODO: Update the cluster texture with the count and indices of the lights in each cluster
    // This will take some time. The math is nontrivial...

    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
        }
      }
    }

    var halfHeight = Math.tan(camera.fov / 2.0 * (Math.PI/180.0));
    var halfWidth = halfHeight * camera.aspect;

    for (let i = 0; i < NUM_LIGHTS; ++i) {
      // get light radius and position
      var r = scene.lights[i].radius;
      var lightPos = vec4.fromValues(scene.lights[i].position[0],
                                     scene.lights[i].position[1],
                                     scene.lights[i].position[2], 1.0);
      vec4.transformMat4(lightPos, lightPos, viewMatrix);
      lightPos[2] *= -1.0;

      var xHalf = halfWidth * lightPos[2];
      var xStride = (xHalf * 2.0) / this._xSlices;

      var yHalf = halfHeight * lightPos[2];
      var yStride = (yHalf * 2.0) / this._ySlices;

      var zHeight = (camera.far - camera.near);
      var zStride = (zHeight) / this._zSlices;

      // get start and end for each cluster dimension
      var xStart = Math.floor((lightPos[0] - r + xHalf) / xStride) - 1;
      var xEnd   = Math.floor((lightPos[0] + r + xHalf) / xStride) + 1;
      var yStart = Math.floor((lightPos[1] - r + yHalf) / yStride);
      var yEnd   = Math.floor((lightPos[1] + r + yHalf) / yStride);
      var zStart = Math.floor((lightPos[2] - r) / zStride);
      var zEnd   = Math.floor((lightPos[2] + r) / zStride);

      // clamp in case
      var clamp = function(val, min, max) {
        return val < min ? min : val > max ? max : val;
      };
      xStart = clamp(xStart, 0, this._xSlices - 1);
      xEnd = clamp(xEnd, 0, this._xSlices - 1);
      yStart = clamp(yStart, 0, this._ySlices - 1);
      yEnd = clamp(yEnd, 0, this._ySlices - 1);
      zStart = clamp(zStart, 0, this._zSlices - 1);
      zEnd = clamp(zEnd, 0, this._zSlices - 1);

      for (let z = zStart; z <= zEnd; ++z) {
        for (let y = yStart; y <= yEnd; ++y) {
          for (let x = xStart; x <= xEnd; ++x) {
            let idx = x + y * this._xSlices + z * this._xSlices * this._ySlices;
            var lightIdx = this._clusterTexture.bufferIndex(idx, 0);
            if (this._clusterTexture.buffer[lightIdx] < MAX_LIGHTS_PER_CLUSTER) {
              var numLights = this._clusterTexture.buffer[lightIdx] + 1;
              var col = Math.floor(numLights / 4);
              var row = Math.floor(numLights % 4);
              this._clusterTexture.buffer[lightIdx] = numLights;
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(idx, col) + row] = i;
            }
          }
        }
      }
    }

    this._clusterTexture.update();
  }
}
Number.prototype.clamp = function(min, max) {
  return Math.min(Math.max(this, min), max);
};