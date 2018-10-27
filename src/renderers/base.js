import TextureBuffer from './textureBuffer';
import { mat4, vec4, vec3, vec2 } from 'gl-matrix';

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

    //console.log(scene.lights);

    var calculate_min_max = function (point, radius)
    {
      var radius_vec = vec3.create();
      radius_vec[0] = radius;
      radius_vec[1] = radius;
      radius_vec[2] = radius;

      var min = vec3.create();
      var max = vec3.create();

      vec3.sub(min, point, radius_vec);
      vec3.add(max, point, radius_vec);

      var min_max = 
      [
        min,
        max
      ];
      
      return min_max;
    };

    //check if number is between two numbers
    var check_out_of_bounds = function(number, min, max) 
    {
      if(number < min || number > max) {
        return true;
      }
      return false;
    }

    //clamp numbers
    var clamp_between = function(number, min, max) {
      if(number < min) {
        number = min;
      }
      else if(number > max) {
        number = max;
      }
      return number;
    };

    var check_out_of_bounds_and_clamp = function(number, min, max) {
      if(check_out_of_bounds(number, min, max)) {
        return -1;
      }
      return clamp_between(number, min, max);
    }

    var self = this;
    var degrees_in_radians = (Math.PI/180.0);
    var camera_vertical = Math.tan(camera.fov * degrees_in_radians * 0.5);

    //var light_num_index = 0;

    //scene.lights.forEach(function(light) {
    for(var i = 0; i < scene.lights.length; i++) {
      var light = scene.lights[i];

      //copy light position
      var light_pos = vec4.create();

      light_pos[0] = light.position[0];
      light_pos[1] = light.position[1];
      light_pos[2] = light.position[2];
      light_pos[3] = 1.0;

      //transform position by view matrix
      var light_pos_view = vec4.create();

      vec4.transformMat4(light_pos_view, light_pos, viewMatrix);

      //store result back into light position
      light_pos = light_pos_view;
      light_pos_view = vec3.create();
      light_pos_view[0] = light_pos[0];
      light_pos_view[1] = light_pos[1];
      light_pos_view[2] = light_pos[2];
      
      //make z positive
      light_pos_view[2] = -light_pos_view[2];
      var pos_z = light_pos_view[2];

      //get minimum point and maximum point of the sphere created by the point light
      var min_max = calculate_min_max(light_pos_view, light.radius);

      //calculate the frustrum
      var vertical_limit = Math.abs(camera_vertical * pos_z * 2);
      var horizontal_limit = Math.abs(camera.aspect * vertical_limit);

      var begin_x = Math.floor((horizontal_limit * 0.5 + min_max[0][0]) / (horizontal_limit / self._xSlices));
      var finish_x = Math.floor((horizontal_limit * 0.5 + min_max[1][0]) / (horizontal_limit / self._xSlices));

      var begin_y = Math.floor((vertical_limit * 0.5 * min_max[0][1]) / (vertical_limit / self._ySlices));
      var finish_y = Math.floor((vertical_limit * 0.5 * min_max[1][1]) / (vertical_limit / self._ySlices));

      var begin_z = Math.floor(min_max[0][2] / ((camera.far - camera.near) / self._zSlices));
      var finish_z = Math.floor(min_max[1][2] / ((camera.far - camera.near) / self._zSlices));
      //console.log(min_max[0], min_max[1], z_stride);
      //console.log(begin_x, finish_x, begin_y, finish_y, begin_z, finish_z);

      if((begin_x >= self._xSlices && finish_x >= self._xSlices) || (begin_y >= self._ySlices && finish_y >= self._ySlices) || (begin_z >= self._zSlices && finish_z >= self._zSlices))  {
        continue;
      }

      if((begin_x < 0 && finish_x < 0) || (begin_y < 0 && finish_y < 0) || (begin_z < 0 && finish_z < 0)) {
        continue;
      }

      begin_x = clamp_between(begin_x, 0, self._xSlices - 1);
      finish_x = clamp_between(finish_x, 0, self._xSlices - 1);
      begin_y = clamp_between(begin_y, 0, self._ySlices - 1);
      finish_y = clamp_between(finish_y, 0, self._ySlices - 1);
      begin_z = clamp_between(begin_z, 0, self._zSlices - 1);
      finish_z = clamp_between(finish_z, 0, self._zSlices - 1);
      
      /*
      if((check_out_of_bounds(begin_x, 0, self._xSlices - 1) &&
      check_out_of_bounds(finish_x, 0, self._xSlices - 1)) || 
      (check_out_of_bounds(begin_y, 0, self._ySlices - 1) &&
      check_out_of_bounds(finish_y, 0, self._ySlices - 1)) || 
      (check_out_of_bounds(begin_z, 0, self._zSlices - 1) && 
      check_out_of_bounds(finish_z, 0, self._zSlices - 1))
      ) {
        continue;
      }

      begin_x = clamp_between(begin_x, 0, self._xSlices - 1);
      finish_x = clamp_between(finish_x, 0, self._xSlices - 1);
      begin_y = clamp_between(begin_y, 0, self._ySlices - 1);
      finish_y = clamp_between(finish_y, 0, self._ySlices - 1);
      begin_z = clamp_between(begin_z, 0, self._zSlices - 1);
      finish_z = clamp_between(finish_z, 0, self._zSlices - 1);
      */
      //console.log(begin_x, finish_x, begin_y, finish_y, begin_z, finish_z);

      for (let z = begin_z; z <= finish_z; ++z) {
        for (let y = begin_y; y <= finish_y; ++y) {
          for (let x = begin_x; x <= finish_x; ++x) {
            //id for cluster
            let cluster_index = x + y * self._xSlices + z * self._xSlices * self._ySlices;
            var light_index = self._clusterTexture.bufferIndex(cluster_index, 0);
            var cluster_count = self._clusterTexture.buffer[light_index] + 1;
            
            //console.log(x, y, z, begin_x, finish_x, begin_y, finish_y, begin_z, finish_z);

            if(cluster_count <= MAX_LIGHTS_PER_CLUSTER) {
              self._clusterTexture.buffer[light_index] = cluster_count;

              //console.log(light_num_index);

              var texture_index = Math.floor(cluster_count * 0.25);
              var texture_buffer_remaining_index = self._clusterTexture.bufferIndex(cluster_index, texture_index);
              var texel_remaining = cluster_count - texture_index * 4;
              //console.log(cluster_count, texture_index, texture_buffer_remaining_index, texel_remaining, self._clusterTexture.buffer);
              //return;

              self._clusterTexture.buffer[texture_buffer_remaining_index + texel_remaining] = i;
            }
          }
        }
      }
      //console.log(min_max);
    }
    this._clusterTexture.update();
  }
}