import TextureBuffer from './textureBuffer';
import { NUM_LIGHTS } from '../scene';
import { mat4, vec4, vec3, vec2 } from 'gl-matrix';

export const MAX_LIGHTS_PER_CLUSTER = 100;

export default class BaseRenderer {
  constructor(xSlices, ySlices, zSlices, tanCalculation, camAspect) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
    
    this.tanCalculation = tanCalculation;
    this.camAspect = camAspect;
  }
  

clamp(value, lower, upper)
  {
    return Math.max(lower, Math.min(value, upper));
  }

  updateClusters(viewMatrix, scene) {
    // TODO: Update the cluster texture with the count and indices of the lights in each cluster
    // This will take some time. The math is nontrivial...

    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
        }
      }
    }
    
    let radius;
    let c_light;
    let minValues, maxValues;
    let frustumHeight, frustumWidth;
    let dX, dY;
    let xMin, xMax;
    let yMin, yMax;
    let id;
    let count, row, offset;
    for (let i = 0; i < NUM_LIGHTS; i++) {
        
        radius = scene.lights[i].radius;
        
        // Transform light position from world to camera space
        c_light = vec4.fromValues(scene.lights[i].position[0], scene.lights[i].position[1], scene.lights[i].position[2], 1.0);
        vec4.transformMat4(c_light, c_light, viewMatrix);
        c_light[2] = -c_light[2];
        
        minValues = vec3.fromValues(c_light[0] - radius, c_light[1] - radius, c_light[2] - radius);
        maxValues = vec3.fromValues(c_light[0] + radius, c_light[1] + radius, c_light[2] + radius);
        
        frustumHeight = Math.abs(this.tanCalculation * c_light[2] * 2);
        frustumWidth = Math.abs(this.camAspect * frustumHeight);
        
        dX = frustumWidth / this._xSlices;
        dY = frustumHeight / this._ySlices;
        
        xMin = Math.floor((minValues[0] + frustumWidth*0.5) / dX) - 1;
        xMax = Math.floor((maxValues[0] + frustumWidth*0.5) / dX) + 1;
        xMin = this.clamp(xMin, 0, this._xSlices - 1);
        xMax = this.clamp(xMax, 0, this._xSlices - 1);
        
        yMin = Math.floor((minValues[1] + frustumHeight*0.5) / dY);
        yMax = Math.floor((maxValues[1] + frustumHeight*0.5) / dY);
        yMin = this.clamp(yMin, 0, this._ySlices - 1);
        yMax = this.clamp(yMax, 0, this._ySlices - 1);
        
        for (let x = xMin; x <= xMax; x++) {
            for (let y = yMin; y <= yMax; y++) {
                id = x + y * this._xSlices;
            
                count = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(id, 0)];
            
                count = count + 1;
            
                row = Math.floor(count / 4.0);
                offset = count % 4;
            
                this._clusterTexture.buffer[this._clusterTexture.bufferIndex(id, row) + offset] = i;
                this._clusterTexture.buffer[this._clusterTexture.bufferIndex(id, 0)] = count;
            }
        } 
    }
    
/*
    
            for (let l = 0; l < NUM_LIGHTS; ++l) {
              
              //let light = scene.lights[l];

              let w_Light = vec4.fromValues(scene.lights[l].position[0], scene.lights[l].position[1], scene.lights[l].position[2], 1.0);
              let v_Light = vec4.create();
              vec4.transformMat4(v_Light, w_Light, viewMatrix);
              v_Light[2] *= -1;
              
              let v_Min = vec3.fromValues(v_Light[0] - scene.lights[l].radius, v_Light[1] - scene.lights[l].radius, v_Light[2] - scene.lights[l].radius);
              let v_Max = vec3.fromValues(v_Light[0] + scene.lights[l].radius, v_Light[1] + scene.lights[l].radius, v_Light[2] + scene.lights[l].radius);
              
              
              // Calculate the width and height of frustum at the light's depth
              let y_height = Math.abs(v_Light[2] * Math.tan(camera.fov * (Math.PI/180.0) * 0.5) * 2);
              let x_width = Math.abs(camera.aspect * y_height);

              // How large each frustum slice is
              let dX = x_width / this._xSlices;
              let dY = y_height / this._ySlices;
              
              // Need to convert coordinates which are [-x_width / 2, x_width / 2] to be [0, x_width]
              // Then divide by dX to get the slice
              let x_slice_Min = Math.floor((v_Min[0] + (x_width * 0.5)) / dX) - 1;
              let x_slice_Max = Math.floor((v_Max[0] + (x_width * 0.5)) / dX) + 1;
              
              x_slice_Min = Math.max(0, Math.min(x_slice_Min, this._xSlices - 1));
              x_slice_Max = Math.max(0, Math.min(x_slice_Max, this._xSlices - 1));
              
              
              for (let x = x_slice_Min; x <= x_slice_Max; x++) {
                //for (let y = y_slice_Min; y <= y_slice_Max; y++) {
              
                    let index = x;// + y * this._xSlices;// + z * this._xSlices * this._ySlices;
                    
                    //let numIndex = index * this._clusterTexture._pixelsPerElement * 4;
                    
                    let numIndex = this._clusterTexture.bufferIndex(index, 0);
              
                    let currNum = this._clusterTexture.buffer[numIndex];//this._clusterTexture.buffer[numIndex];
                    let nextNum = currNum + 1;
                    
                    if (currNum < MAX_LIGHTS_PER_CLUSTER ) {
                    
                        let texel = Math.floor(nextNum / 4.0);
                        let texelIndex = this._clusterTexture.bufferIndex(index, texel);
                        let texelSubIndex = (nextNum) - (texel*4); //texel%4;
                        //this._clusterTexture.buffer[texelIndex + texelSubIndex] = l;
                        //this._clusterTexture.buffer[numIndex + (texel * 4) + texelSubIndex] = l;
                        this._clusterTexture.buffer[texelIndex + texelSubIndex] = l;
                    
                    
                        //this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, clusterTextureIndex) + clusterTextureIndex_Mod] = l;
                        this._clusterTexture.buffer[numIndex] = nextNum;
                    }
                //}
              }
              
              
            
          }
          
          */


    this._clusterTexture.update();
  }
}