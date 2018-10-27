import TextureBuffer from './textureBuffer';
import {mat4, vec4, vec3} from 'gl-matrix';
import {NUM_LIGHTS} from '../scene';

import {canvas} from '../init'

export const MAX_LIGHTS_PER_CLUSTER = 100;

const clusterZOffset = 0;
const clusterXYOffset = 2;

//logarithmic function to determine z-direction slices
function clusterZIndex(viewSpaceZ, nearClipz){
  if(viewSpaceZ < nearClipz){
    return -1.0;
  }
  else{
    return Math.floor(Math.log(viewSpaceZ - nearClipz + 1.0) * 2.15);
  }
}

//clamp function
function clamp(toclamp, min, max){
  return Math.max(min, Math.min(toclamp,max));
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
    for(let i = 0; i <NUM_LIGHTS ; i++){
      //get the view space position of the light
      let lightViewPos = vec4.create();
      lightViewPos[0] = scene.lights[i].position[0];
      lightViewPos[1] = scene.lights[i].position[1];
      lightViewPos[2] = scene.lights[i].position[2];
      //w component set to 1
      lightViewPos[3] = 1.0;
      //Note that now lightViewPos is world pos, so need to transform to view space
      vec4.transformMat4(lightViewPos,lightViewPos,viewMatrix);
      //get the radius for point light
      var lightRadius = scene.lights[i].radius;

      //slice in z direction(view space)
      //threshold
      var clusterStartZValue = -lightViewPos[2] - lightRadius;
      var clusterEndZValue = -lightViewPos[2] + lightRadius;

      var clusterZStartIdx = clusterZIndex(clusterStartZValue, camera.near);
      var clusterZEndIdx =  clusterZIndex(clusterEndZValue, camera.near);

      if(clusterZStartIdx > this._zSlices + clusterZOffset || clusterZEndIdx < -clusterZOffset){
        continue;
      }
      clusterZStartIdx = clamp(clusterZStartIdx - clusterZOffset, 0, this._zSlices - 1);
      clusterZEndIdx = clamp(clusterZEndIdx + clusterZOffset, 0, this._zSlices - 1);
    
      let lightPos3D = vec3.create();
      lightPos3D[0] = lightViewPos[0];
      lightPos3D[1] = lightViewPos[1];
      //note: need to flip sign
      lightPos3D[2] = -lightViewPos[2];
      let pointLightCenterDistance = vec3.length(lightPos3D);

      var clusterXStartIdx;
      var clusterXEndIdx;
      var clusterYStartIdx;
      var clusterYEndIdx;

      //check the eye against point light volume sphere
      if(pointLightCenterDistance <= lightRadius){
      clusterXStartIdx = 0;
      clusterXEndIdx = this._xSlices - 1;
      clusterYStartIdx = 0;
      clusterYEndIdx = this._ySlices - 1;  
      }
      //major case: if eye is outside the light volume sphere
      else{
        let RAD2DEG = 180.0 / Math.PI;
        let halfAngle = RAD2DEG * Math.asin(lightRadius / pointLightCenterDistance);
        let rangeStartAngle = -camera.fov / 2.0;

        //compute x-direction indices
        let centerXAngle = RAD2DEG * Math.atan2(lightPos3D[0],lightPos3D[2]);
        let minAngleX = centerXAngle - halfAngle;
        let maxAngleX = centerXAngle + halfAngle;
        //set the loop stride
        let xAngleStride = camera.fov / this._xSlices;
        clusterXStartIdx = Math.floor((minAngleX - rangeStartAngle) /xAngleStride );
        clusterXEndIdx = Math.floor((maxAngleX - rangeStartAngle) / xAngleStride);
        if(clusterXStartIdx > this._xSlices + clusterXYOffset || clusterXEndIdx < -clusterXYOffset){
          continue;
        }
        clusterXStartIdx = clamp(clusterXStartIdx - clusterXYOffset, 0, this._xSlices - 1);
        clusterXEndIdx = clamp(clusterXEndIdx + clusterXYOffset, 0, this._xSlices - 1);

        //compute y-direction indices, same logic as x
        let centerYAngle = RAD2DEG * Math.atan2(lightPos3D[1],lightPos3D[2]);
        let minAngleY = centerYAngle - halfAngle;
        let maxAngleY = centerYAngle + halfAngle;
        //set the loop stride
        let yAngleStride = camera.fov / this._ySlices;
        clusterYStartIdx = Math.floor((minAngleY - rangeStartAngle) /yAngleStride );
        clusterYEndIdx = Math.floor((maxAngleY - rangeStartAngle) / yAngleStride);
        if(clusterYStartIdx > this._ySlices + clusterXYOffset || clusterYEndIdx < -clusterXYOffset){
          continue;
        }
        clusterYStartIdx = clamp(clusterYStartIdx - clusterXYOffset, 0, this._xSlices - 1);
        clusterYEndIdx = clamp(clusterYEndIdx + clusterXYOffset, 0, this._xSlices - 1);
      
        //now we have sliced in x and y directions
        //loop all the clusters, store cluster information in buffer
        for(let z = clusterZStartIdx; z<= clusterZEndIdx; z++){
          for(let y = clusterYStartIdx; y <= clusterYEndIdx; y++){
            for(let x = clusterXStartIdx; x <= clusterXEndIdx; x++){
              let clusterIdx = x+y*this._xSlices + z * this._xSlices * this._ySlices;
              let influenceCount = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(clusterIdx,0)];
              //light influences this cluster, add count
              influenceCount++;
              let screenSpaceIdx = Math.floor(influenceCount / 4.0);
              let screenSpaceOffset = influenceCount % 4;
              // set influencing light number
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(clusterIdx, screenSpaceIdx) + screenSpaceOffset] = i;
              //update influence count (if influenceCount is reference, this is not needed, but this is JS so...)
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(clusterIdx,0)] = influenceCount;
            }
          }
        }
      }

    }
    this._clusterTexture.update();
  }
}