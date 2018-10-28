import TextureBuffer from './textureBuffer';
import {NUM_LIGHTS} from "../scene";
import { mat4, vec4, vec3 } from 'gl-matrix';

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

      // create a "screen" at depth of 1 (normalized in z)
      // divide this space into cluster size steps
      const z_near = camera.near;
      const z_far = camera.far;

      const z_size = (z_far - z_near) / this._zSlices;
      const h = Math.abs( Math.tan(camera.fov * 0.5 * Math.PI/180.0) );
      const w = h * camera.aspect;
      const x_size = 2.0 * w / this._xSlices;
      const y_size = 2.0 * h / this._ySlices;

    for (let z = 0; z < this._zSlices; ++z) {
        for (let y = 0; y < this._ySlices; ++y) {
            for (let x = 0; x < this._xSlices; ++x) {
                let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
                //console.log(this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)]);

                // Reset the light count to 0 for every cluster
                this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;

            }
        }
    }

      for (let lidx = 0; lidx < NUM_LIGHTS; lidx++) {

          let light = scene.lights[lidx];
          let light_pos = vec4.fromValues(light.position[0], light.position[1], light.position[2], 1.0); // transform into viewspace
          vec4.transformMat4(light_pos, light_pos, viewMatrix);

          let r = light.radius;
          light_pos[2] *= -1.0;
          // if outside z clip planes skip light
          if ((light_pos[2] + r < z_near) || (light_pos[2] - r > z_far)) continue;

          let z_norm = (light_pos[2] - z_near) / (z_far - z_near);

          let plane_w = (z_near + (z_far - z_near) * z_norm) * w;
          let plane_h = (z_near + (z_far - z_near) * z_norm) * h;

          let plane_x = 2.0 * plane_w / this._xSlices;
          let plane_y = 2.0 * plane_h / this._ySlices;

          // bbox
          let left = Math.floor((light_pos[0] - r - plane_w) / plane_x);
          let right = Math.floor((light_pos[0] + r - plane_w) / plane_x);
          let top = Math.floor((light_pos[1] + r - plane_h) / plane_y);
          let bottom = Math.floor((light_pos[1] - r - plane_h) / plane_y);
          let front = Math.floor((light_pos[2] - r - z_near) / z_size);
          let back = Math.floor((light_pos[2] + r - z_near) / z_size);

          left = Math.max(0, Math.min(this._xSlices - 1, left));
          right = Math.max(0, Math.min(this._xSlices - 1, right));

          top = Math.max(0, Math.min(this._xSlices - 1, top));
          bottom = Math.max(0, Math.min(this._xSlices - 1, bottom));

          back = Math.max(0, Math.min(this._xSlices - 1, back));
          front = Math.max(0, Math.min(this._xSlices - 1, front));

          for (let z = front; z <= back; ++z) {
              for (let y = bottom; y <= top; ++y) {
                  for (let x = left; x <= right; ++x) {
                      let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;

                      z_norm = ((z_size * z)- z_near) / (z_far - z_near);

                      let z_n2 = ((z_size * (z + 1))- z_near) / (z_far - z_near);

                      plane_w = (z_near + (z_far - z_near) * z_norm) * w;
                      plane_h = (z_near + (z_far - z_near) * z_norm) * h;

                      plane_x = 2.0 * plane_w / this._xSlices;
                      plane_y = 2.0 * plane_h / this._ySlices;

                      let p_x2 = 2.0 * ((z_near + (z_far - z_near) * z_n2) * w) / this._xSlices;
                      let p_y2 = 2.0 * ((z_near + (z_far - z_near) * z_n2) * h) / this._xSlices;

                      let x0 = x * plane_x;
                      let y0 = y * plane_y;

                      let diag_x = (p_x2 + plane_x) / 2.0;
                      let diag_y = (p_y2 + plane_y) / 2.0;

                      let error = Math.sqrt((z_size * z_size) + (diag_x * diag_x) + (diag_y * diag_y));

                      let dist = Math.sqrt((x0 - light_pos[0]) * (x0 - light_pos[0]) + (y0 - light_pos[1]) * (y0 - light_pos[1]) + (z * z_size) * (z * z_size));

                      if (dist - error > r) continue;

                      let n = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)];
                      if ( n >= MAX_LIGHTS_PER_CLUSTER) break;

                      n += 1;
                      this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = n;

                      let index = Math.floor(n / 4);
                      let offset = n - (4 * index);

                      this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, index) + offset] = lidx;

                  }
              }
          }

      }

    this._clusterTexture.update();
  }
}