import TextureBuffer from './textureBuffer';
import { NUM_LIGHTS } from '../scene';
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
    
    let projectionMatrix = mat4.create();
    mat4.invert(projectionMatrix, camera.projectionMatrix.elements);

    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
          
          // TODO calculate frustum
          // Calculate pixels for tile

          let minX = x * canvas.width / this._xSlices;
          let maxX = (x + 1) * canvas.width / this._xSlices;
          let minY = y * canvas.height / this._ySlices;
          let maxY = (y + 1) * canvas.height / this._ySlices;
          
          minX = ((minX / canvas.width) * 2.0) - 1.0;
          maxX = ((maxX / canvas.width) * 2.0) - 1.0;
          minY = 1.0 - (2.0 * minY / canvas.height);
          maxY = 1.0 - (2.0 * maxY / canvas.height);
          
          
          let p0 = vec4.fromValues(minX * camera.far, minY * camera.far, camera.far, camera.far);
          let v0 = vec4.create();
          vec4.transformMat4(v0, p0, projectionMatrix);
          //v0[2] = -v0[2];
          v0 = vec3.fromValues(v0[0], v0[1], v0[2]);
          
          let p1 = vec4.fromValues(minX * camera.far, maxY * camera.far, camera.far, camera.far);
          let v1 = vec4.create();
          vec4.transformMat4(v1, p1, projectionMatrix);
          //v1[2] = -v1[2];
          v1 = vec3.fromValues(v1[0], v1[1], v1[2]);
          
          let p2 = vec4.fromValues(maxX * camera.far, maxY * camera.far, camera.far, camera.far);
          let v2 = vec4.create();
          vec4.transformMat4(v2, p2, projectionMatrix);
          //v2[2] = -v2[2];
          v2 = vec3.fromValues(v2[0], v2[1], v2[2]);
          
          let p3 = vec4.fromValues(maxX * camera.far, minY * camera.far, camera.far, camera.far);
          let v3 = vec4.create();
          vec4.transformMat4(v3, p3, projectionMatrix);
          //v3[2] = -v3[2];
          v3 = vec3.fromValues(v3[0], v3[1], v3[2]);
          
          let planeList = [];
          // plane 0
          let nor0 = vec3.create();
          vec3.cross(nor0, v0, v1);
          // plane 1
          let nor1 = vec3.create();
          vec3.cross(nor1, v1, v2);
          // plane 2
          let nor2 = vec3.create();
          vec3.cross(nor2, v2, v3);
          // plane 3
          let nor3 = vec3.create();
          vec3.cross(nor3, v3, v0);
          
          
          // TODO loop through lights 
          let numLights = 0;
          for (let l = 0; l < NUM_LIGHTS; ++l) {
              
            // if inside frustum
              //this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, numLights + 1)] = l;
              //numLights++;
              let light = scene.lights[l];
              let viewMatrix = mat4.create();
              mat4.invert(viewMatrix, camera.matrixWorld.elements);
              
              let pos = vec4.create();
              vec4.transformMat4(pos, light.position, viewMatrix);
              pos = vec3.fromValues(pos[0], pos[1], pos[2]);
              
              
              let result = true;
              
              if ( pos[2] - light.radius > camera.near || pos[2] + light.radius < camera.far )
              {
                result = false;
              }
              
              if (vec3.dot(nor0, pos) < -light.radius) {
                  result = false;
              }
              if (vec3.dot(nor1, pos) < -light.radius) {
                  result = false;
              }
              if (vec3.dot(nor2, pos) < -light.radius) {
                  result = false;
              }
              if (vec3.dot(nor3, pos) < -light.radius) {
                  result = false;
              }
              //return dot( plane.N, sphere.c ) - plane.d < -sphere.r;
              
              if (result) {
                this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, numLights + 1)] = l;
                numLights++;
              }
            
          }
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = numLights;
          
        }
      }
    }

    this._clusterTexture.update();
  }
}