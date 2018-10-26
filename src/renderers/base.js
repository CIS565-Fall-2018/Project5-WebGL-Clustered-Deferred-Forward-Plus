import TextureBuffer from './textureBuffer';
import { Vector2, Vector4 } from 'three';
import { NUM_LIGHTS } from '../scene';
import { mat4, vec4, vec2 } from 'gl-matrix';

export const MAX_LIGHTS_PER_CLUSTER = 100;

// used to calculate distande from light position to slice plane
function getDistance(scale, lightPos)
{
  let v0 = 1.0 / Math.sqrt(1.0 + scale * scale);
  let v1 = - scale * v0;
  let normal = vec2.create();
  vec2.set(normal, v0, v1);
  return vec2.dot(normal, lightPos);
}

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

    
    let yscale = Math.tan(camera.fov * 0.5 * Math.PI / 180.0) * 2.0;
    let xscale = camera.aspect * yscale;
    let ystep = yscale / this._ySlices;
    let xstep = xscale / this._xSlices;
    let zstep = (camera.far - camera.near) / this._zSlices;
    let lightPos = vec4.create();
    
    for(let i = 0; i < NUM_LIGHTS; ++i) {
      let radius = scene.lights[i].radius;
      vec4.set(lightPos, scene.lights[i].position[0], scene.lights[i].position[1], scene.lights[i].position[2], 1.0);
      vec4.transformMat4(lightPos, lightPos, viewMatrix);

      lightPos[2] *= -1.0;

      let xmin, xmax, ymin, ymax, zmin, zmax;
      let distance;

      // calculate x min and x max
      let posxz = vec2.create();
      vec2.set(posxz, lightPos[0], lightPos[2]);
      for(xmin = 0; xmin < this._xSlices; xmin++) {
        if(getDistance(xstep * (xmin + 1.0) - xscale / 2.0, posxz) < radius) {
          break;
        }
      }

      for(xmax = xmin + 1; xmax < this._xSlices; ++xmax) {
        if(getDistance(xstep * xmax - xscale / 2.0, posxz) < -radius) {
          break;
        }
      }

      // calculate y min and y max
      let posyz = vec2.create();
      vec2.set(posyz, lightPos[1], lightPos[2]);
      for(ymin = 0; ymin < this._ySlices; ++ymin) {
        if(getDistance(ystep * (ymin + 1.0) - yscale / 2.0, posyz) < radius) {
          break;
        }
      }

      for(ymax = ymin + 1; ymax < this._ySlices; ++ymax) {
        if(getDistance(ystep * ymax - yscale / 2.0, posyz) < -radius) {
          break;
        }
      }

      //calculate z min and z max, uniform
      for(zmin = 0; zmin < this._zSlices; ++zmin) {
        distance = lightPos[2] - (camera.near + zmin * zstep);
        if(distance < radius) {
          zmin = Math.max(0, zmin - 1);
          break;
        }
      }

      for(zmax = zmin + 1; zmax < this._zSlices; ++zmax) {
        distance = lightPos[2] - (camera.near + zmax * zstep);
        if(distance < -radius) {
          break;
        }
      }

      // add light list
      for(let z = zmin; z < zmax; ++z) {
        for(let y = ymin; y < ymax; ++y) {
          for(let x = xmin; x < xmax; ++x) {
            let index = x + this._xSlices * y + this._xSlices * this._ySlices * z;
            let count = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(index, 0)];
            count++;
            if(count < MAX_LIGHTS_PER_CLUSTER) {
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(index, 0)] = count;
              let comp = Math.floor(count / 4);
              let id = count - comp * 4;
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(index, comp) + id] = i;
            }
          }
        }
      }

    }
    



    this._clusterTexture.update();
  }
}