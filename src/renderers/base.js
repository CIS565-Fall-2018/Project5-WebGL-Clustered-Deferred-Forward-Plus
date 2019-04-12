import TextureBuffer from './textureBuffer';
import {mat4, vec4, vec3, mat3, vec2, mat2} from 'gl-matrix';
import {NUM_LIGHTS} from '../scene'; 
import { get } from 'https';
import { length } from 'gl-matrix/src/gl-matrix/vec3';


export const MAX_LIGHTS_PER_CLUSTER = 100;

function getDistance(ray, light_pos)
{
  let temp = Math.sqrt(1 + ray[0] * ray[0]);
  let a1 = 1 / temp;
  let a2 = -ray[0] * a1;
  let normal = vec2.fromValues(a1, a2);
  return vec2.dot(normal, light_pos);

  // let rotate_ray = vec2.fromValues(ray[1], -ray[0]);
  // vec2.normalize(rotate_ray, rotate_ray);
  // let dis = vec2.dot(light_pos, rotate_ray);
  // return dis;
}

function findMinAndMax(_interval, _left, num_slices, y, light_pos, radius)
{
  let left = Math.atan(_left);
  let interval = -2 * left / num_slices;

  light_pos[1] *= -1;
  let xmin = 0, xmax = num_slices;

  while (xmin < xmax)
  {
    // console.log(xmin, xmax);
    let temp_x = left + (xmin + 1) * interval;
    if (getDistance(vec2.fromValues(Math.cos(Math.PI - temp_x), Math.sin(Math.PI - temp_x)), light_pos) > radius * 2)
      ++xmin;
    else
      break;
  }

  while (xmin < xmax)
  { 
    let temp_x = left + (xmax - 1) * interval;
    if (getDistance(vec2.fromValues(Math.cos(Math.PI - temp_x), Math.sin(Math.PI - temp_x)), light_pos) < -radius * 2)
      --xmax;
    else
      break;
  }
  return vec2.fromValues(xmin, xmax);
}

function find_z_min_max(interval, left, num_slices, light_pos_z, radius)
{
  light_pos_z *= -1;
  // zmin
  let zmin, zmax;

  for (zmin = 0; zmin < num_slices; ++zmin)
  {
    let temp_z = left + zmin * interval;
    if (light_pos_z - temp_z < radius)
    {
      zmin = Math.max(0, zmin - 1);
      break;
    }

    if (zmin == num_slices - 1)
    {
      let temp_z = left + num_slices * interval;
      if (light_pos_z - temp_z < radius)
      {
        break;
      }
    }
  }
  

  for (zmax = zmin + 1; zmax < num_slices; ++zmax)
  {
    let z = left + zmax * interval;
    if (light_pos_z - z < -radius)
    {
      break;
    }
  }
  if (zmin == num_slices) zmax = num_slices;
  // console.log(zmin, zmax, num_slices);
  return vec2.fromValues(zmin, zmax);
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

    let zInterval = (camera.far - camera.near) / this._zSlices;
    let yzRatio = Math.tan(camera.fov / 2 / 180.0 * 3.14159) * 2;
    let xzRatio = yzRatio * camera.aspect;
    let xInterval = xzRatio / this._xSlices;
    let yInterval = yzRatio / this._ySlices;
    let x_left = -xzRatio / 2.0;
    let y_left = -yzRatio / 2.0;
    let z_left = camera.near;

    // determine which clusters this light overlaps.
    for (let i_light = 0; i_light < scene.lights.length; ++i_light)
    {
      let temp_light = scene.lights[i_light];
      let temp_pos = vec4.fromValues(temp_light.position[0], temp_light.position[1], temp_light.position[2], 1.0);
      var temp_r = temp_light.radius;
      // get the position of light in camera space.

      vec4.transformMat4(temp_pos, temp_pos, viewMatrix);
      let xRange = findMinAndMax(xInterval, x_left, this._xSlices, 1, vec2.fromValues(temp_pos[0], temp_pos[2]), temp_r);
      let yRange = findMinAndMax(yInterval, y_left, this._ySlices, 1, vec2.fromValues(temp_pos[1], temp_pos[2]), temp_r);
      let zRange = find_z_min_max(zInterval, z_left, this._zSlices, temp_pos[2], temp_r);
// function find_z_min_max(interval, left, num_slices, light_pos_z, radius)
        // console.log("ilights:", i_light, " ", xRange[0], " ", xRange[1], " ", yRange[0], " ", yRange[1], " ", zRange[0], " ", zRange[1]);

      for (let z = zRange[0]; z < zRange[1]; ++z){
        for(let y = yRange[0]; y < yRange[1]; ++y){
          for(let x = xRange[0]; x < xRange[1]; ++x){
            let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
            let lightCount = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)];
            lightCount++;
            if( lightCount < MAX_LIGHTS_PER_CLUSTER)
            {
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = lightCount;
              let row = Math.floor(lightCount / 4);
              let pixel = lightCount - row * 4;
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, row) + pixel] = i_light;
              
            }
          }
        }
      }
    }
    this._clusterTexture.update();
  }
}