import TextureBuffer from './textureBuffer';
import { NUM_LIGHTS } from '../scene';
import { mat4, vec4, vec3, vec2 } from 'gl-matrix';

export const MAX_LIGHTS_PER_CLUSTER = 100;

export default class BaseRenderer {
  constructor(xSlices, ySlices, zSlices, tanCalculation, camAspect, zStride) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
    
    this.tanCalculation = tanCalculation;
    this.camAspect = camAspect;
    this.dZ = zStride;
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
    let zMin, zMax;
    let id;
    let count, row, offset;
    for (let i = 0; i < NUM_LIGHTS; i++) {
        
        radius = scene.lights[i].radius;
        
        // Transform light position from world to camera space
        c_light = vec4.fromValues(scene.lights[i].position[0], scene.lights[i].position[1], scene.lights[i].position[2], 1.0);
        vec4.transformMat4(c_light, c_light, viewMatrix);
        c_light[2] = -c_light[2];
        
        // Get the min and max values of the sphere
        minValues = vec3.fromValues(c_light[0] - radius, c_light[1] - radius, c_light[2] - radius);
        maxValues = vec3.fromValues(c_light[0] + radius, c_light[1] + radius, c_light[2] + radius);
        
        // Calculate the dimensions of the image plane at the light's depth
        frustumHeight = Math.abs(this.tanCalculation * c_light[2] * 2);
        frustumWidth = Math.abs(this.camAspect * frustumHeight);
        
        // How big a slice is for this image plane
        dX = frustumWidth / this._xSlices;
        dY = frustumHeight / this._ySlices;
        
        // Calcualte the screen space bounding boxes 
        xMin = Math.floor((minValues[0] + frustumWidth*0.5) / dX) - 1;
        xMax = Math.floor((maxValues[0] + frustumWidth*0.5) / dX) + 1;
        xMin = this.clamp(xMin, 0, this._xSlices - 1);
        xMax = this.clamp(xMax, 0, this._xSlices - 1);
        
        yMin = Math.floor((minValues[1] + frustumHeight*0.5) / dY) - 1;
        yMax = Math.floor((maxValues[1] + frustumHeight*0.5) / dY) + 1;
        yMin = this.clamp(yMin, 0, this._ySlices - 1);
        yMax = this.clamp(yMax, 0, this._ySlices - 1);
        
        zMin = Math.floor(minValues[2] / this.dZ);
        zMax = Math.floor(maxValues[2] / this.dZ);
        
        // Loop through intersecting tiles and update them
        for (let z = zMin; z <= zMax; z++) {
            for (let y = yMin; y <= yMax; y++) {
                for (let x = xMin; x <= xMax; x++) {
                    id = x + y * this._xSlices + z * this._xSlices * this._ySlices;
            
                    count = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(id, 0)];
            
                    count = count + 1;
            
                    row = Math.floor(count / 4.0);
                    offset = count % 4;
            
                    this._clusterTexture.buffer[this._clusterTexture.bufferIndex(id, row) + offset] = i;
                    this._clusterTexture.buffer[this._clusterTexture.bufferIndex(id, 0)] = count;
                }
            } 
        }
    }

    this._clusterTexture.update();
  }
}