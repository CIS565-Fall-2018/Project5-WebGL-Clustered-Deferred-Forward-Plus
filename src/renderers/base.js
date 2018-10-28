import TextureBuffer from './textureBuffer';
import { mat4, vec4, vec3, vec2 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';

export const MAX_LIGHTS_PER_CLUSTER = 100;

function clamp(num, min, max) 
{
  return Math.min(Math.max(num, min), max);
}

export default class BaseRenderer 
{
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
  }

  updateClusters(camera, viewMatrix, scene) 
  {

    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
        }
      }
    }



    // NEW: Update the cluster texture with the count and indices of the lights in each cluster
    // This will take some time. The math is nontrivial...

    var halfHeight = Math.tan(camera.fov / 2.0 * (Math.PI/180.0));
    var halfWidth = halfHeight * camera.aspect;

    for (let lightIndex = 0; lightIndex < NUM_LIGHTS; ++lightIndex) 
    {
      // get light information
      let light = scene.lights[lightIndex];
      let lightRadius = light.radius;
      var lightPos = vec4.fromValues(light.position[0], light.position[1], light.position[2], 1.0);
      vec4.transformMat4(lightPos, lightPos, viewMatrix);
      lightPos[2] *= -1.0;

      // slice in x direction
      let xDim = halfWidth * lightPos[2] * 2.0;
      let xStep = xDim / this._xSlices;
      let xStart = Math.floor((lightPos[0] - lightRadius + (xDim / 2.0)) / xStep) - 1;
      let xEnd = Math.floor((lightPos[0] + lightRadius + (xDim / 2.0)) / xStep) + 1;

      // slice in y direction
      let yDim = halfHeight * lightPos[2] * 2.0;
      let yStep = yDim / this._ySlices;
      let yStart = Math.floor((lightPos[1] - lightRadius + (yDim / 2.0)) / yStep);
      let yEnd = Math.floor((lightPos[1] + lightRadius + (yDim / 2.0)) / yStep);

      // slice in z direction
      let zDim = (camera.far - camera.near);
      let zStep = zDim / this._zSlices;
      let zStart = Math.floor((lightPos[2] - lightRadius) / zStep);
      let zEnd = Math.floor((lightPos[2] + lightRadius) / zStep);

      // make sure start and end x,y,z is within x,y,z slices
      if((zStart < 0 && zEnd < 0) || (zStart >= this._zSlices && zEnd >= this._zSlices)) continue;
      if((yStart < 0 && yEnd < 0) || (yStart >= this._ySlices && yEnd >= this._ySlices)) continue;
      if((xStart < 0 && xEnd < 0) || (xStart >= this._xSlices && xEnd >= this._xSlices)) continue;
      
      // clamp the start and end x,y,z
      xStart = clamp(xStart, 0, this._xSlices-1);
      xEnd = clamp(xEnd, 0, this._xSlices-1);
      yStart = clamp(yStart, 0, this._ySlices-1);
      yEnd = clamp(yEnd, 0, this._ySlices-1);
      zStart = clamp(zStart, 0, this._zSlices-1);
      zEnd = clamp(zEnd, 0, this._zSlices-1);
      
      // iterate through start and end x,y,z
      for (let z = zStart; z <= zEnd; z++) {
        for (let y = yStart; y <= yEnd; y++) {
          for (let x = xStart; x <= xEnd; x++) 
          {
            let clusterIndex = x + (y * this._xSlices) + (z * this._ySlices * this._xSlices);
            let numLightIndex = this._clusterTexture.bufferIndex(clusterIndex, 0);
            let numLights = 1 + this._clusterTexture.buffer[numLightIndex];

            if (numLights <= MAX_LIGHTS_PER_CLUSTER) {           
              let col = Math.floor(numLights * 0.25);
              let row = Math.floor(numLights % 4);    
              this._clusterTexture.buffer[numLightIndex] = numLights;
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(clusterIndex, col) + row] = lightIndex;
            }
          }
        }
      }
    }



    this._clusterTexture.update();
  }
}