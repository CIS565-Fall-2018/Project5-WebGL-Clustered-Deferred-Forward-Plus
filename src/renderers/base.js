import TextureBuffer from './textureBuffer';
import { vec4, vec3 } from 'gl-matrix';

export const MAX_LIGHTS_PER_CLUSTER = 100;

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

    let xMin, xMax, yMin, yMax, zMin, zMax;
    let frustumH = -Math.tan(camera.fov * Math.PI / 90.0);
    let frustumW = frustumH * camera.aspect;
    let ySize = frustumH * 2.0 / this._ySlices;
    let xSize = frustumW * 2.0 / this._xSlices;
    let zSize = (camera.far - camera.near) / this._zSlices;
    let lightRadius, lightPos3, lightPos4;

    for(let lightId = 0; lightId < scene.lights.length; ++lightId) {
      // Transform scene light attributes
      lightRadius = scene.lights[lightId].radius;
      lightPos4 = [scene.lights[lightId].position[0], scene.lights[lightId].position[1], scene.lights[lightId].position[2], 1];
      vec4.transformMat4(lightPos4, lightPos4, viewMatrix);
      lightPos3 = [lightPos4[0], lightPos4[1], lightPos4[2]];

      yMin = 0;
      zMin = 0;
      yMax = this._ySlices;
      zMax = this._zSlices;

      // Min and max slice range of current light in each dimension
      xMin = Math.floor((lightPos3[0] - lightRadius - frustumW) / xSize);
      xMax = Math.floor((lightPos3[0] + lightRadius + frustumW) / xSize);
      yMin = Math.floor((lightPos3[1] - lightRadius - frustumH) / ySize);
      yMax = Math.floor((lightPos3[1] + lightRadius + frustumH) / ySize);
      //zMin = Math.floor((-lightPos3[2] - lightRadius - camera.near) / zSize);
      //zMax = Math.floor((-lightPos3[2] + lightRadius - camera.near) / zSize);

      // Cull
      if(xMax < 0 || xMin > this._xSlices ||
        yMax < 0 || yMin > this._ySlices ||
        zMax < 0 || zMin > this._zSlices) {
          console.log(zMin, zMax);
          continue;
      }

      // Clamp
      xMin = Math.min(Math.max(xMin, 0), this._xSlices - 1);
      xMax = Math.min(Math.max(xMax, 0), this._xSlices - 1);
      yMin = Math.min(Math.max(yMin, 0), this._ySlices - 1);
      yMax = Math.min(Math.max(yMax, 0), this._ySlices - 1);
      zMin = Math.min(Math.max(zMin, 0), this._zSlices - 1);
      zMax = Math.min(Math.max(zMax, 0), this._zSlices - 1);

      // Add light to clusters
      let clusterId, lightCount, texel, offset;
      for (let z = zMin; z < zMax; ++z) {
        for (let y = yMin; y < yMax; ++y) {
          for (let x = xMin; x < xMax; ++x) {
            // Check that cluster is not at max lights
            clusterId = x + y * this._xSlices + z * this._xSlices * this._ySlices;
            lightCount = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(clusterId, 0)] + 1;
            if(lightCount > MAX_LIGHTS_PER_CLUSTER) continue;

            // Add light index to cluster texture
            this._clusterTexture.buffer[this._clusterTexture.bufferIndex(clusterId, 0)] = lightCount;
            texel = this._clusterTexture.bufferIndex(clusterId, Math.floor(lightCount / 4.0));
            offset = lightCount - Math.floor(lightCount / 4.0) * 4;
            this._clusterTexture.buffer[texel + offset] = lightId;
            //console.log("Adding light to cluster "+clusterId);
          }
        }
      }
    }

    this._clusterTexture.update();
  }
}