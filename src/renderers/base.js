import TextureBuffer from './textureBuffer';
import {NUM_LIGHTS} from "../scene";
import { mat4, vec4, vec3 } from 'gl-matrix';

export const MAX_LIGHTS_PER_CLUSTER = 100;

function count_x_distance(light_pos, w){
    let distance = vec3.fromValues(1.0 / Math.sqrt(w * w + 1), 0 , - w / Math.sqrt(w * w + 1));
    distance = vec3.dot(vec3.fromValues(light_pos[0], light_pos[1], light_pos[2]), distance);
    return distance;
}

function count_y_distance(light_pos, w){
    let distance = vec3.fromValues(0, 1.0 / Math.sqrt(w * w + 1), - w / Math.sqrt(w * w + 1));
    distance = vec3.dot(vec3.fromValues(light_pos[0], light_pos[1], light_pos[2]), distance);
    return distance;
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

    var yz = Math.tan(0.5 * camera.fov * Math.PI / 180.0);
    var xz = camera.aspect * yz;
    var z_step = (camera.far - camera.near) / this._zSlices;
    var x_step = 2.0 * xz / this._xSlices;
    var y_step = 2.0 * yz / this._ySlices;


    for(let light_index = 0; light_index < NUM_LIGHTS; light_index++){
      // get light position
      let light_pos = vec4.create();
      light_pos[0] = scene.lights[light_index].position[0];
      light_pos[1] = scene.lights[light_index].position[1];
      light_pos[2] = scene.lights[light_index].position[2];
      light_pos[3] = 1.0;

      vec4.transformMat4(light_pos, light_pos, viewMatrix);
      light_pos[2] *= -1.0;
      let radius = scene.lights[light_index].radius;

      // find cluster range
      let z_min, z_max;

      // for(z_min = 0; z_min < this._zSlices; z_min++){
      //   let distance = light_pos[2] - (camera.near + z_min * z_step);
      //   if(distance <= radius){
      //     z_min = Math.max(0, z_min - 1);
      //     break;
      //   }
      // }
      // for(z_max = this._zSlices - 1; z_max > z_min; z_max--){
      //   let distance = (camera.near + z_max * z_step) - light_pos[2];
      //   if(distance <= radius){
      //     z_max = Math.min(this._zSlices, z_max + 1);
      //     break;
      //   }
      // }
      z_min = Math.floor((light_pos[2] - camera.near - radius) / z_step);
      z_max = Math.floor((light_pos[2] - camera.near + radius) / z_step);
      if(z_min >= this._zSlices || z_max < 0) continue;
      z_min = Math.max(0, z_min);
      z_max = Math.min(z_max, this._zSlices - 1);

      let x_min, x_max;

      for(x_min = 0; x_min < this._xSlices; x_min++){
        let distance;
        let w = -xz + x_min * x_step;
        distance = count_x_distance(light_pos, w);
        if(Math.abs(distance) <= radius){
          break;
        }
      }
      for(x_max = this._xSlices - 1; x_max > x_min; x_max--){
        let distance;
        let w = -xz + x_max * x_step;
        distance = count_x_distance(light_pos, w);
        if(Math.abs(distance) < radius){
          break;
        }
      }

      let y_min, y_max;
      for(y_min = 0; y_min < this._ySlices; y_min++){
        let distance;
        let w = -yz + y_min * y_step;
        distance = count_y_distance(light_pos, w);
        if(Math.abs(distance) <= radius){
          break;
        }
      }
      for(y_max = this._ySlices - 1; y_max > x_min; y_max--){
        let distance;
        let w = -yz + y_max * y_step;
        distance = count_y_distance(light_pos, w);
        if(Math.abs(distance) <= radius){
          break;
        }
      }
        // update buffer
      for(let z = z_min; z <= z_max; z++){
        for(let y = y_min; y <= y_max; y++){
          for(let x = x_min; x <= x_max; x++){
            let i = x + y * this._xSlices + z * this._xSlices*this._ySlices;
            let count = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)];
            count++;
            if(count <= MAX_LIGHTS_PER_CLUSTER){
                this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = count;
                let floor = Math.floor(count / 4.0);
                let i_new = this._clusterTexture.bufferIndex(i, floor);
                this._clusterTexture.buffer[i_new + (count - floor * 4)] = light_index;
            }else break;
          }
        }
      }

    }

    this._clusterTexture.update();
  }
}