import { mat4, vec4, vec3 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';
import { LIGHT_RADIUS } from '../scene';
import TextureBuffer from './textureBuffer';

export const MAX_LIGHTS_PER_CLUSTER = 100;

const PI_DIV_360 = 0.00872664625;

export default class BaseRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
  }

  updateClusters(camera, viewMatrix, scene) {
    // Update the cluster texture with the count and indices of the lights in each cluster
    // This will take some time. The math is nontrivial...

    // zero everything
    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
        }
      }
    }

    // calculate frustum dimensions (proportional based on depth adjustment added later)
    let frustum_height = Math.abs(2.0 * Math.tan(camera.fov * PI_DIV_360));
    let frustum_width = Math.abs(camera.aspect * frustum_height);
    // total depth and z stride are unaffected by depth of light
    let frustum_total_depth = camera.far - camera.near;
    let stride_z = this._zSlices / frustum_total_depth;

    let light_position = vec4.create();
    // Loop through lights counting number of lights at each buffer index 
    // and placing light in appropr loc in buffer for calcs
    for (let on_light = 0; on_light < NUM_LIGHTS; ++on_light) {
      // create variables of light's information
      let light = scene.lights[on_light];
      let light_radius = light.radius;
      let light_position = vec4.fromValues(light.position[0], light.position[1], light.position[2], 1);
      vec4.transformMat4(light_position, light_position, viewMatrix);

      // for calculations need (-) of curr depth value bc of coordinate system
      light_position[2] *= -1;

      // frustum dimensions and values affected by light's depth
      let frustum_height_at_depth = frustum_height * light_position[2];
      let frustum_width_at_depth = frustum_width * light_position[2];
      let stride_y = this._ySlices / frustum_height_at_depth; 
      let stride_x = this._xSlices / frustum_width_at_depth;

      // check which cluster slices would actually be influenced by this light
      let cluster_z_min = Math.floor((light_position[2] - light_radius - camera.near) * stride_z);
      let cluster_z_max = Math.floor((light_position[2] + light_radius - camera.near) * stride_z);
      let cluster_y_min = Math.floor((light_position[1] - light_radius + frustum_height_at_depth * 0.5) * stride_y);
      let cluster_y_max = Math.floor((light_position[1] + light_radius + frustum_height_at_depth * 0.5) * stride_y);
      let cluster_x_min = Math.floor((light_position[0] - light_radius + frustum_width_at_depth * 0.5) * stride_x);
      let cluster_x_max = Math.floor((light_position[0] + light_radius + frustum_width_at_depth * 0.5) * stride_x);

      // check if valid index locations for cluster structure dimensions - if not, then not visible so ignore
      if ( (cluster_x_min >= this._xSlices || cluster_x_max < 0)
        || (cluster_y_min >= this._ySlices || cluster_y_max < 0) 
        || (cluster_z_min >= this._zSlices || cluster_z_max < 0) ) {
        continue;
      }

      // cluster ranges can go outside bounds as long as overlapping with in-bounds locations
      // clamp cluster range to 0 -> slice bounds for each dimension
      // using sliceCount - 1, because indexing domain is [0, length - 1]
      cluster_x_min = Math.max(cluster_x_min, 0); cluster_x_max = Math.min(cluster_x_max, this._xSlices - 1);
      cluster_y_min = Math.max(cluster_y_min, 0); cluster_y_max = Math.min(cluster_y_max, this._ySlices - 1);
      cluster_z_min = Math.max(cluster_z_min, 0); cluster_z_max = Math.min(cluster_z_max, this._zSlices - 1);

      // fill in buffer locations where this light's influence should be included
      for (let z = cluster_z_min; z <= cluster_z_max; ++z) {
        for (let y = cluster_y_min; y <= cluster_y_max; ++y) {
          for (let x = cluster_x_min; x <= cluster_x_max; ++x) {
            let index_1D = x + y*this._xSlices + z*this._xSlices*this._ySlices;
            let index_light_count = this._clusterTexture.bufferIndex(index_1D, 0);

            // new light count with this light added to this cluster
            let num_lights_in_cluster = 1 + this._clusterTexture.buffer[index_light_count];

            // check if updating count based on this light
            if (num_lights_in_cluster <= MAX_LIGHTS_PER_CLUSTER) {
              this._clusterTexture.buffer[index_light_count] = num_lights_in_cluster;

              let row = Math.floor(num_lights_in_cluster * 0.25);
              let distance_to_pixel_baseline = num_lights_in_cluster - 4 * row;
              let index_to_fill = this._clusterTexture.bufferIndex(index_1D, row) + distance_to_pixel_baseline;
              this._clusterTexture.buffer[index_to_fill] = on_light;
              this._clusterTexture.buffer[index_light_count] = num_lights_in_cluster;
            }

          }//end: x iter
        }//end: y iter
      }//end: z iter

    }//end: for each light

    this._clusterTexture.update();
  }
}