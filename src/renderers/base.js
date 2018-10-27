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
                // Reset the light count to 0 for every cluster
                this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;

                // define frustrum as four vectors pointing to xy corners
                // march by cluster depth and check both near and far intersections
                // we can calculate all vectors from the bottom-left corner
                //let v0 = [(x * x_size - w), (y * y_size - h)];
                let x0 = (x * x_size - w);
                let y0 = (y * y_size - h);
                let z0 = z * z_size + z_near;

                // loop over lights
                for (let lidx = 0; lidx < NUM_LIGHTS; lidx++) {
                    let n = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)];
                    if ( n >= MAX_LIGHTS_PER_CLUSTER) break;
                    let light = scene.lights[lidx];
                    let light_pos = vec4.fromValues(light.position[0], light.position[1], light.position[2], 1.0); // transform into viewspace
                    vec4.transformMat4(light_pos, light_pos, viewMatrix);

                    let r = light.radius;
                    light_pos[2] *= -1.0;
                    // if outside z cluster planes skip light
                    if ((light_pos[2] + r < z0) || (light_pos[2] - r > z0 + z_size)) continue;

                    // xy bounding rays
                    let ray = vec4.fromValues(x0, y0, 1, 1);
                    let pos = vec4.fromValues(light_pos[0] / light_pos[2], light_pos[0] / light_pos[2], 1, 1);
                    let tca = vec4.dot(pos, ray);
                    if (tca < 0) {
                        ray[0] = x0 + x_size;
                        tca = vec4.dot(pos, ray);
                    }
                    if (tca < 0) {
                        ray[1] = y0 + y_size;
                        tca = vec4.dot(pos, ray);
                    }
                    if (tca < 0) {
                        ray[0] = x0;
                        tca = vec4.dot(pos, ray);
                    }
                    if (tca < 0) continue;

                    // now need intersection depths to check if in z cluster
                    let vdot = vec4.dot(pos, pos);
                    let d = Math.sqrt(vdot - (tca*tca));
                    if (d > r|| d < 0) continue;

                    let thc = Math.sqrt((r*r) - (d*d));
                    let t0 = tca - thc;
                    let t1 = tca + thc;

                    if (t1 < 0 && t0 < 0) continue;

                    if (t1 * light_pos[2] < z0 || t0 * light_pos[2] > z0 + z_size) continue;



                    n += 1;
                    this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = n;

                    let index = Math.floor(n / 4);
                    let offset = n - (4 * index);

                    this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, index) + offset] = lidx;
                }

            }
        }
    }
        /*
      for (let lidx = 0; lidx < NUM_LIGHTS; lidx++) {
          let light = scene.lights[lidx];
          let light_pos = vec4.fromValues(light.position[0], light.position[1], light.position[2], 1.0); // transform into viewspace
          vec4.transformMat4(light_pos, light_pos, viewMatrix);

          let r = light.radius;
          light_pos[2] *= -1.0;

          // z cluster bounds
          let zmin = Math.floor((light_pos[2] - r - z_near) / z_size);
          let zmax = Math.floor((light_pos[2] + r - z_near) / z_size);
          if (zmin > this._zSlices - 1 || zmax < 0) continue;

          // x cluster bounds
          let xmin = Math.floor((light_pos[0] - r - w) / x_size);
          let xmax = Math.floor((light_pos[0] + r + w) / x_size);
          if (xmin > this._xSlices - 1 || xmax < 0) continue;

          // y cluster bounds
          let ymin = Math.floor((light_pos[1] - r - h) / y_size);
          let ymax = Math.floor((light_pos[1] + r + h) / y_size);
          if (ymin > this._ySlices - 1 || ymax < 0) continue;

          // clamp bounds
          zmin = Math.max(0, zmin);
          zmin = Math.min(zmin, this._zSlices - 1);

          zmax = Math.min(this._zSlices - 1, zmax);

          xmin = Math.max(0, xmin);
          xmin = Math.min(xmin, this._xSlices - 1);

          xmax = Math.min(this._xSlices - 1, xmax);
          xmax = Math.max(0, xmax);

          ymin = Math.max(0, ymin);
          ymin = Math.min(ymin, this._ySlices - 1);

          ymax = Math.min(this._ySlices - 1, ymax);
          ymax = Math.max(0, ymax);

          let plane_x = light_pos[0] / light_pos[2] - w;
          let plane_y = light_pos[1] / light_pos[2] - h;
          let plane_radius = r / light_pos[2];

          for (let z = zmin; z <= zmax; ++z) {
              for (let y = 0; y < this._ySlices; ++y) {
                  for (let x = xmin; x <= xmax; ++x) {
                      let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;

                      let n = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] + 1;
                      if ( n > MAX_LIGHTS_PER_CLUSTER) break;


                      // check distance for culling corners
                      let z0 = (z * z_size + z_near) - light_pos[2];
                      let x0 = (x * x_size) - plane_x;
                      let y0 = (y * y_size) - plane_y;

                      let dist = Math.sqrt((z0 * z0) + (x0 * x0) + (y0 * y0));
                      let error = Math.sqrt((x_size * x_size) + (y_size * y_size) + (z_size * z_size));
                      if (dist - error > plane_radius) continue;


                      this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = n;

                      let index = Math.floor(n / 4);
                      let offset = n - (4 * index);

                      this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, index) + offset] = lidx;

                  }
              }
          }
      }*/




    this._clusterTexture.update();
  }
}