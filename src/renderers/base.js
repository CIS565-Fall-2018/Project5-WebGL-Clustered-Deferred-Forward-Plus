import TextureBuffer from './textureBuffer';
import { mat4, vec4, vec3 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';

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
    let w = canvas.width;
    let h = canvas.height;

    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
        }
      }
    }

    // half angle subtended by camera FOV
    let fov_y = Math.tan(camera.fov * 0.5 * (Math.PI / 180.0));
    let fov_x = camera.aspect * fov_y;

    for (let l = 0; l < NUM_LIGHTS; ++l){
      // light sphere radius of extent
      let radius = scene.lights[l].radius;
      // get light position in camera space
      let light_pos_4 = vec4.fromValues(scene.lights[l].position[0],
                                        scene.lights[l].position[1], 
                                        scene.lights[l].position[2],
                                        1.0);
      vec4.transformMat4(light_pos_4, light_pos_4, viewMatrix);
      light_pos_4[2] *= -1.0;

      // find the mini-frustum bounds in which this light sits
      // in z
      let slice_z = light_pos_4[2];
      let slice_delta_z = (camera.far - camera.near) / this._zSlices;
      let z_a = (slice_z - radius) / slice_delta_z;
      let z_b = (slice_z + radius) / slice_delta_z;
      z_a = Math.floor(z_a);
      z_b = Math.floor(z_b);
      if(z_a < 0) z_a = 0;
      if(z_b > this._zSlices - 1) z_b = this._zSlices - 1;
      // in x
      let slice_width = 2.0 * fov_x * slice_z;
      let slice_delta_x = slice_width / this._xSlices;
      let x_a = (light_pos_4[0] + (slice_width / 2.0) - radius) / slice_delta_x;
      let x_b = (light_pos_4[0] + (slice_width / 2.0) + radius) / slice_delta_x;
      x_a = Math.floor(x_a);
      x_b = Math.floor(x_b);
      if(x_a < 0) x_a = 0;
      if(x_b > this._xSlices - 1) x_b = this._xSlices - 1;
      // in y
      let slice_height = 2.0 * fov_y * slice_z;
      let slice_delta_y = slice_height / this._ySlices;
      let y_a = (light_pos_4[1] + (slice_height / 2.0) - radius) / slice_delta_y;
      let y_b = (light_pos_4[1] + (slice_height / 2.0) + radius) / slice_delta_y;
      y_a = Math.floor(y_a);
      y_b = Math.floor(y_b);
      if(y_a < 0) y_a = 0;
      if(y_b > this._ySlices - 1) y_b = this._ySlices - 1;

      for (let z = z_a; z <= z_b; ++z){
        for (let y = y_a; y <= y_b; ++y){
          for (let x = x_a; x <= x_b; ++x){
            let i = x + y*this._xSlices + z *this._ySlices*this._xSlices;
            let light_index = this._clusterTexture.bufferIndex(i, 0);
            let num_lights = 1 + this._clusterTexture.buffer[light_index];

            if(num_lights <= MAX_LIGHTS_PER_CLUSTER){
              let col = Math.floor(num_lights / 4);
              let row = Math.floor(num_lights % 4);  
              this._clusterTexture.buffer[light_index] = num_lights;
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, col) + row] = l;
            }
          }
        }
      }
    }

    this._clusterTexture.update();
  }
}