import TextureBuffer from './textureBuffer';
import { NUM_LIGHTS } from '../scene';
import { mat4, vec2, vec4, vec3 } from 'gl-matrix';

export const MAX_LIGHTS_PER_CLUSTER = 1000;

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
    let zStep = (camera.far - camera.near) / this._zSlices;
    let tanFov2 = Math.tan(camera.fov * Math.PI / 360.0)
    let xStep = tanFov2 * 2.0 / this._xSlices * camera.aspect;
    let yStep = tanFov2 * 2.0 / this._xSlices;
    for (let i = 0; i < NUM_LIGHTS; i++) {
      let radius = scene.lights[i].radius;
      let lightPos = vec4.create();
      lightPos[0] = scene.lights[i].position[0];
      lightPos[1] = scene.lights[i].position[1];
      lightPos[2] = scene.lights[i].position[2];
      lightPos[3] = 1.0;
      let lightPosCamera = vec4.create();
      vec4.transformMat4(lightPosCamera, lightPos, viewMatrix);
      lightPosCamera[2] *= -1.0;
      function getXDist(lightPosCamera, xStep, xInd, xBound, xSlices) {
        var xDist = xStep * (xInd + xBound - xSlices / 2.0);        
        return Math.abs((lightPosCamera[0] - xDist * lightPosCamera[2]) / Math.sqrt(1.0 + xDist * xDist));
      }
      var xMin;
      for (let x = 0; x <= this._xSlices; x++) {
        if (getXDist(lightPosCamera, xStep, x, 1, this._xSlices) < radius) {
          xMin = x;
          break;
        }
      }
      var xMax;
      for (let x = this._xSlices; x >= xMin; x--) {
        if (getXDist(lightPosCamera, xStep, x, -1, this._xSlices) < radius) {
          xMax = x;
          break;
        }
      }
      function getYDist(lightPosCamera, yStep, yInd, yBound, ySlices) {
        var yDist = yStep * (yInd + yBound - ySlices / 2.0);        
        return Math.abs((lightPosCamera[1] - yDist * lightPosCamera[2]) / Math.sqrt(1.0 + yDist * yDist));
      }
      var yMin = this._ySlices;
      for (let y = 0; y <= this._ySlices; y++) {
        if (getYDist(lightPosCamera, yStep, y, 1, this._ySlices) < radius) {
          yMin = y;
          break;
        }
      }
      var yMax = this._ySlices;
      for (let y = this._ySlices; y >= yMin; y--) {
        if (getYDist(lightPosCamera, yStep, y, -1, this._ySlices) < radius) {
          yMax = y;
          break;
        }
      }
      let zMin;  
      let zMax;
      let minDisZ = lightPos[2] - radius;
      let maxDisZ = lightPos[2] + radius;
      var zMin = Math.floor((-lightPosCamera[2] - camera.near - radius) / zStep);
      var zMax = Math.floor((-lightPosCamera[2] - camera.near + radius) / zStep) + 1;
      zMin = Math.max(zMin, 0);
      zMax = Math.min(zMax, this._zSlices);
      for (let x = xMin; x <= xMax; x++) {
        for (let y = yMin; y <= yMax; y++) {
          for (let z = zMin; z <= zMax; z++) {
            var ind = x + y * this._xSlices + z * this._xSlices * this._ySlices;
            let lightCount = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(ind, 0)];
            if (lightCount < MAX_LIGHTS_PER_CLUSTER) {
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(ind, 0)] = ++lightCount;
              let row = Math.floor(lightCount / 4.0);
              let rowInd = this._clusterTexture.bufferIndex(ind, row);
              let remainder = lightCount - row * 4;
              this._clusterTexture.buffer[rowInd + remainder] = i;
            }
          }
        }
      }
    }

    this._clusterTexture.update();
  }
}