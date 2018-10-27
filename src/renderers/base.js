import TextureBuffer from './textureBuffer';
import { NUM_LIGHTS } from '../scene';
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
  
    computeProjectedRadius(fovy, d, r) {
  var fov;

  fov = fovy / 2 * Math.PI / 180.0;

//return 1.0 / Math.tan(fov) * r / d; // Wrong
  return 1.0 / Math.tan(fov) * r / Math.sqrt(d * d - r * r); // Right
}


  updateClusters(camera, viewMatrix, projectionMatrix, viewProjectionMatrix, scene) {
    // TODO: Update the cluster texture with the count and indices of the lights in each cluster
    // This will take some time. The math is nontrivial...
    //let projectionMatrix = mat4.create();
    //let viewMatrix = mat4.create();
    //let viewProjectionMatrix = mat4.create();
    //camera.updateMatrixWorld();
    //mat4.copy(viewMatrix, camera.matrixWorld.elements);
    //mat4.invert(projectionMatrix, camera.projectionMatrix.elements);
    //mat4.multiply(viewProjectionMatrix, projectionMatrix, viewMatrix);
    
    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
        }
      }
    }

            for (let l = 0; l < NUM_LIGHTS; ++l) {
              
              let light = scene.lights[l];
              
              
              //let w_Light = vec4.fromValues(light.position[0], light.position[1], light.position[2], 1.0);
              //let c_Light = vec4.create();
              //vec4.transformMat4(c_Light, w_Light, viewMatrix);
              
              //let w_Radius = vec4.fromValues(light.position[0] + light.radius, light.position[1], light.position[2], 1.0);
              
              
              
              //let w_lightPos = vec4.fromValues(light.position[0], light.position[1], light.position[2], 1.0);
              //let s_lightPos = vec4.create();
              //vec4.transformMat4(s_lightPos, w_lightPos, viewProjectionMatrix);
              
              //let w_Min = vec4.fromValues(light.position[0] - light.radius, light.position[1] - light.radius, light.position[2] - light.radius, 1.0);
              //let w_Max = vec4.fromValues(light.position[0] + light.radius, light.position[1] + light.radius, light.position[2] + light.radius, 1.0);
              
              let w_Light = vec4.fromValues(light.position[0], light.position[1], light.position[2], 1.0);
              let v_Light = vec4.create();
              vec4.transformMat4(v_Light, w_Light, viewMatrix);
              
              let v_Min = vec4.fromValues(v_Light[0] - light.radius, v_Light[1] - light.radius, v_Light[2] - light.radius, 1.0);
              let v_Max = vec4.fromValues(v_Light[0] + light.radius, v_Light[1] + light.radius, v_Light[2] + light.radius, 1.0);
              
              let v_MinX = vec3.fromValues(v_Light[0] - light.radius, v_Light[1], v_Light[2]);
              vec3.normalize(v_MinX, v_MinX);
              let v_MaxX = vec3.fromValues(v_Light[0] + light.radius, v_Light[1], v_Light[2]);
              vec3.normalize(v_MaxX, v_MaxX);
              
              let camera_right = vec3.fromValues(1.0, 0.0, 0.0);
              
              let min_cos = vec3.dot(v_MinX, camera_right);
              
              let tileXMin = Math.floor(this._xSlices * (min_cos + 1.0) / 2.0);
              
              let max_cos = vec3.dot(v_MaxX, camera_right);
              
              let tileXMax = Math.floor(this._xSlices * (max_cos + 1.0) / 2.0);
              
              //let x_slice_Min = Math.max(0, Math.min(tileXMin, this._xSlices));
              //let x_slice_Max = Math.max(0, Math.min(tileXMax, this._xSlices));
              
              let ctest = vec4.fromValues(camera.position.x, camera.position.y, camera.position.z, 1.0);
              let blah = vec4.create();
              vec4.transformMat4(blah, ctest, viewMatrix);
              
              let pr = this.computeProjectedRadius(camera.fov, vec3.length(v_Light), light.radius);
              
              
              let s_Light = vec4.create();
              vec4.transformMat4(s_Light, w_Light, projectionMatrix);
              s_Light[0] = s_Light[0] / s_Light[3];
              s_Light[1] = s_Light[1] / s_Light[3];
              s_Light[2] = s_Light[2] / s_Light[3];
              s_Light[3] = s_Light[3] / s_Light[3];
              /*
              let s_Min = vec4.create();
              vec4.transformMat4(s_Min, v_Min, projectionMatrix);
              let s_Max = vec4.create();
              vec4.transformMat4(s_Max, v_Max, projectionMatrix);
              s_Min[0] = s_Min[0] / s_Min[3];
              s_Min[1] = s_Min[1] / s_Min[3];
              s_Min[2] = s_Min[2] / s_Min[3];
              s_Min[3] = s_Min[3] / s_Min[3];
              //s_Max = s_Max / s_Min[3];
              s_Max[0] = s_Max[0] / s_Max[3];
              s_Max[1] = s_Max[1] / s_Max[3];
              s_Max[2] = s_Max[2] / s_Max[3];
              s_Max[3] = s_Max[3] / s_Max[3];
              
              
              let p_Min = vec2.fromValues((s_Min[0] + 1.0)/2.0, (s_Min[1] + 1.0)/2.0);
              let p_Max = vec2.fromValues((s_Max[0] + 1.0)/2.0, (s_Max[1] + 1.0)/2.0);
              */
              
              let p_Min = vec2.fromValues((s_Light[0] + 1.0 - pr) / 2.0, 5.0);
              let p_Max = vec2.fromValues((s_Light[0] + 1.0 + pr) / 2.0, 5.0);
              
              let dX = 1.0 / this._xSlices;
              let dY = 1.0 / this._ySlices;
              
              let x_slice_Min = Math.max(0, Math.min(Math.floor(p_Min[0] / dX), this._xSlices));
              let x_slice_Max = Math.max(0, Math.min(Math.floor(p_Max[0] / dX), this._xSlices));
              
              
              let y_slice_Min = Math.max(0, Math.min(Math.floor(p_Min[1] / dY), this._ySlices));
              let y_slice_Max = Math.max(0, Math.min(Math.floor(p_Max[1] / dY), this._ySlices));
              
              
              
              for (let x = x_slice_Min; x <= x_slice_Max; x++) {
                //for (let y = y_slice_Min; y <= y_slice_Max; y++) {
              
                    let i = x;// + y * this._xSlices;// + z * this._xSlices * this._ySlices;
              
                    let currNum = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)];
                    this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, currNum + 1)] = l;
                    this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = currNum + 1;
                //}
              }
              
              
            
          }


    this._clusterTexture.update();
  }
}