import TextureBuffer from './textureBuffer';
import { AABB } from "../utils"
import { gpu } from '../init';
import { Vector3 } from "three"
import { vec3, vec4, mat4 } from "gl-matrix"


export const MAX_LIGHTS_PER_CLUSTER = 100;


export default class BaseRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;

    this.nearWidth = 0;
    this.nearHeight = 0;
    this.farWidth = 0;
    this.farHeight = 0;
  }
  
  updateClusters(camera, viewMatrix, scene) {
    // TODO: Update the cluster texture with the count and indices of the lights in each cluster
    // This will take some time. The math is nontrivial...

    let ta = Math.tan(camera.fov * 0.5 * (Math.PI / 180.0));
    let tb = camera.aspect * ta;

    this.nearHeight = 2.0 * ta * camera.near;
    this.nearWidth = 2.0 * tb * camera.near;

    this.farHeight = 2.0 * ta * camera.far;
    this.farWidth = 2.0 * tb * camera.far;

    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          // Reset the light count to 0 for every cluster
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
        }
      }
    }

    for(let lightIndex = 0; lightIndex < scene.lights.length; lightIndex++) {
      let bounds = this.getBounds(scene, lightIndex, camera.near, this.nearWidth, this.nearHeight, camera.far, this.farWidth, this.farHeight, viewMatrix);

      for(let x = bounds.left; x <= bounds.right; x++) {
        for(let y = bounds.bottom; y <= bounds.top; y++) {
          for(let z = bounds.close; z <= bounds.far; z++) {
            let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
            let countIndex = this._clusterTexture.bufferIndex(i, 0);
            let c = this._clusterTexture.buffer[countIndex] + 1;
            if (c < MAX_LIGHTS_PER_CLUSTER)
            {
              this._clusterTexture.buffer[countIndex] = c;
              let nextLightIndex = this._clusterTexture.bufferIndex(i, Math.floor(c / 4)) + (c % 4);
              this._clusterTexture.buffer[nextLightIndex] = lightIndex;
            }
          }
        }
      }
    }

    this._clusterTexture.update();
  }

  getBounds(scene, lightIndex, nearClip, nearWidth, nearHeight, farClip, farWidth, farHeight, viewMatrix) {
    let bounds = { 'left': 0, 'right': 0, 'top': 0, 'bottom': 0, 'close': 0, 'far': 0 };

    let lightPositionArray = scene.lights[lightIndex].position;
    let lightPosVec4 = vec4.fromValues(lightPositionArray[0], lightPositionArray[1], lightPositionArray[2], 1);
    vec4.transformMat4(lightPosVec4, lightPosVec4, viewMatrix);

    let lightPos = vec3.fromValues(lightPosVec4[0], lightPosVec4[1], lightPosVec4[2]);
    let lightRadius = scene.lights[lightIndex].radius;

    let proportion = ( (Math.abs(lightPos[2]) - 1.0 * nearClip)/(1.0 * farClip - 1.0 * nearClip) );

    // Get the bounds of the slice of the frustrum that this light lies in
    let sliceWidth = nearWidth * (1-proportion) + farWidth * proportion;
    let sliceHeight = nearHeight * (1-proportion) + farHeight * proportion;

    bounds.left  = Math.floor((lightPos[0] - lightRadius + 0.5 * sliceWidth) / (sliceWidth / this._xSlices));
    bounds.right = Math.floor((lightPos[0] + lightRadius + 0.5 * sliceWidth) / (sliceWidth / this._xSlices));

    bounds.bottom = Math.floor((lightPos[1] - lightRadius + 0.5 * sliceHeight) / (sliceHeight / this._ySlices));
    bounds.top    = Math.floor((lightPos[1] + lightRadius + 0.5 * sliceHeight) / (sliceHeight / this._ySlices));

    bounds.close = Math.floor((Math.abs(lightPos[2]) - lightRadius - nearClip) / ((farClip - nearClip) / this._zSlices));
    bounds.far = Math.floor((Math.abs(lightPos[2]) + lightRadius - nearClip) / ((farClip - nearClip) / this._zSlices));

    bounds.left = Math.max(0, Math.min(this._xSlices - 1, bounds.left));
    bounds.right = Math.max(0, Math.min(this._xSlices - 1, bounds.right));

    bounds.bottom = Math.max(0, Math.min(this._ySlices - 1, bounds.bottom));
    bounds.top = Math.max(0, Math.min(this._ySlices - 1, bounds.top));

    bounds.close = Math.max(0, Math.min(this._zSlices - 1, bounds.close));
    bounds.far = Math.max(0, Math.min(this._zSlices - 1, bounds.far));

    return bounds;
  }
}