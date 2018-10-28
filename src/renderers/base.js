import TextureBuffer from './textureBuffer';
import { NUM_LIGHTS } from '../scene';
import { mat4, vec4, vec3 } from 'gl-matrix';

export const MAX_LIGHTS_PER_CLUSTER = 1600;

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

    var half_h = Math.tan(camera.fov / 2.0 * (Math.PI / 180.0));
    var half_w = half_h * camera.aspect;
    
    //scene.lights.forEach(function (light) {
    for (var l = 0; l < scene.lights.length; l++) {
      var light = scene.lights[l];
      var radius = light.radius;
      var lightPos = vec4.fromValues(light.position[0], light.position[1], light.position[2], 1.0);
      vec4.transformMat4(lightPos, lightPos, viewMatrix);
      lightPos[2] *= -1.0;

      var x = lightPos[0];
      var y = lightPos[1];
      var z = lightPos[2];

      var slices = vec3.fromValues(this._xSlices, this._ySlices, this._zSlices);

      // var compute heights
      var half_heights = vec3.fromValues(0.0, 0.0, 0.0);
      var heights = vec3.fromValues(0.0, 0.0, 0.0);

      half_heights[0] = half_w * z;
      half_heights[1] = half_h * z;

      heights[0] = half_heights[0] * 2;
      heights[1] = half_heights[1] * 2;
      heights[2] = camera.far - camera.near;

      // compute strides
      var strides = vec3.fromValues(0.0, 0.0, 0.0);
      for (var i = 0; i < 3; i++) {
        strides[i]  = heights[i] / slices[i];
      }

      // compute starts
      var start = vec3.fromValues(0.0, 0.0, 0.0);
      start[0] = Math.floor((x - radius + half_heights[0]) / strides[0]) - 1;
      start[1] = Math.floor((y - radius + half_heights[1]) / strides[1]);
      start[2] = Math.floor((z - radius) / strides[2]);

      // compute ends
      var end = vec3.fromValues(0.0, 0.0, 0.0);
      end[0] = Math.floor((x + radius + half_heights[0]) / strides[0]) + 1;
      end[1] = Math.floor((y + radius + half_heights[1]) / strides[1]);
      end[2] = Math.floor((z + radius) / strides[2]);


      var clamp = function (x, a, b) {
        return Math.max(a, Math.min(x, b));
      };

      for (var i = 0; i < 3; i++) {
        start[i] = clamp(start[i], 0, slices[i] - 1);
        end[i] = clamp(end[i], 0, slices[i] - 1);
      }

      for (var k = start[2]; k <= end[2]; k++) {
        for (var j = start[1]; j <= end[1]; j++) {
          for (var i = start[0]; i <= end[0]; i++) {
            var idx = i + j * this._xSlices + k * this._ySlices * this._xSlices;
            var lightIndex = this._clusterTexture.bufferIndex(idx, 0);
            var numLights = 1 + this._clusterTexture.buffer[lightIndex];

            if (numLights <= MAX_LIGHTS_PER_CLUSTER) {
              var col = Math.floor(numLights / 4);
              var row = Math.floor(numLights % 4);
              this._clusterTexture.buffer[lightIndex] = numLights;
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(idx, col) + row] = l;
            }
          }
        }
      }
    };
    

    this._clusterTexture.update();
  }
}