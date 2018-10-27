import TextureBuffer from './textureBuffer';
import { mat4, vec4, vec3, vec2 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';
import { min } from 'gl-matrix/src/gl-matrix/vec2';

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

    let yzRatio = Math.tan(camera.fov / 2.0 * Math.PI / 180.0) * 2.0;
    let xzRatio = yzRatio * camera.aspect;

    let deltaX = xzRatio / this._xSlices;
    let deltaY = yzRatio / this._ySlices;
    let deltaZ = (camera.far - camera.near) / this._zSlices;

    let x_start = - xzRatio / 2.0;
    let y_start = - yzRatio / 2.0;

    for(let lightIdx = 0; lightIdx < NUM_LIGHTS; ++lightIdx) {
      let lightPos = vec4.create();
      vec4.set(lightPos, scene.lights[lightIdx].position[0], scene.lights[lightIdx].position[1], scene.lights[lightIdx].position[2], 1.0);
      vec4.transformMat4(lightPos,lightPos,viewMatrix);
      lightPos[2] *= -1.0;

      let lightRadius = scene.lights[lightIdx].radius;

      let x_min = 0, x_max = this._xSlices, y_min = 0, y_max = this._ySlices, z_min = 0, z_max = this._zSlices;
      let dist;
      
      for (let z = 0; z < this._zSlices; ++z) {
        dist = lightPos[2]-(camera.near + z * deltaZ);
        if (dist < lightRadius) {
          z_min = Math.max(0, z-1);
          break;
        }
      }

      for (let z = z_min + 1; z < this._zSlices; ++z) {
        dist = lightPos[2]-(camera.near + z * deltaZ);
        if (dist < -lightRadius) {
          z_max = z;
          break;
        }
      }

      for (let x = 0; x < this._xSlices; ++x) {
        let lightPosxz = vec2.create();
        lightPosxz = vec2.set(lightPosxz, lightPos[0], lightPos[2]);
        dist = this.calDist(x_start + x * deltaX, lightPosxz);
        if (dist < lightRadius) {
          x_min = Math.max(0, x-1);
          break;
        }
      }


      for (let x = x_min + 1; x < this._xSlices; ++x) {
        let lightPosxz = vec2.create();
        lightPosxz = vec2.set(lightPosxz, lightPos[0], lightPos[2]);
        dist = this.calDist(x_start + x * deltaX, lightPosxz);
        if (dist < -lightRadius) {
          x_max = x;
          break;
        }
      }

      for (let y = 0; y < this._ySlices; ++y) {
        let lightPosyz = vec2.create();
        lightPosyz = vec2.set(lightPosyz, lightPos[1], lightPos[2]);
        dist = this.calDist(y_start + y * deltaY, lightPosyz);
        if (dist < lightRadius) {
          y_min = Math.max(0, y-1);
          break;
        }
      }

      for (let y = y_min + 1; y < this._ySlices; ++y) {
        let lightPosyz = vec2.create();
        lightPosyz = vec2.set(lightPosyz, lightPos[1], lightPos[2]);
        dist = this.calDist(y_start + y * deltaY, lightPosyz);
        if(dist < -lightRadius)
        {
          y_max = y;
          break;
        }
      }

      for (let z = z_min ; z < z_max; ++z) {
        for (let y = y_min; y < y_max; ++y) {
          for (let x = x_min; x < x_max; ++x) {
            let clusterId = x + y * this._xSlices + z * this._xSlices * this._ySlices;
            let lightCount = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(clusterId, 0)];
            if (lightCount < MAX_LIGHTS_PER_CLUSTER) {
              lightCount++;              
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(clusterId, 0)] = lightCount;
              let row = Math.floor(lightCount / 4);
              let col = lightCount - row * 4;
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(clusterId, row) + col] = lightIdx;
            }
          }
        }
      }
    }

    this._clusterTexture.update();
  }

  calDist(ratio, position){
    let temp = Math.sqrt(1 + ratio * ratio);
    let a1 = 1 / temp;
    let a2 = -ratio * a1;
    let normal = vec2.create();
    vec2.set(normal, a1, a2);
    return vec2.dot(position, normal);
  }

}

