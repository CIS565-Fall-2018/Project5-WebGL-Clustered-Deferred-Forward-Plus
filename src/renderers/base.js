import TextureBuffer from './textureBuffer';
import { AABB } from "../utils"
import { gpu } from '../init';
import { Vector3 } from "three"
import { vec3, vec4, mat4 } from "gl-matrix"


export const MAX_LIGHTS_PER_CLUSTER = 100;



export default class BaseRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;

    this.myFunc = gpu.createKernel(function(a) {
      return this.thread.x;
    }).setOutput([1000]);
  }
  

  updateClusters(camera, viewMatrix, scene) {
    // TODO: Update the cluster texture with the count and indices of the lights in each cluster
    // This will take some time. The math is nontrivial...
    //console.log(this.myFunc(new Float32Array(1)));
    let leftX, leftY, leftZ, rightX, rightY, rightZ;

    let tanA = Math.tan(camera.fov * 0.5 * (Math.PI / 180.0));

    let threeForwardVector = new Vector3(0,0, -1);
    threeForwardVector.applyQuaternion(camera.quaternion);
    let threeUpVector = new Vector3(0,1,0);
    threeUpVector.applyQuaternion(camera.quaternion);

    let up = vec3.fromValues(threeUpVector.x, threeUpVector.y, threeUpVector.z);
    let forward = vec3.fromValues(threeForwardVector.x, threeForwardVector.y, threeForwardVector.z);
    let right = vec3.create();
    vec3.cross(right, forward, up);

    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;

          for(let lightIndex = 0; lightIndex < scene.lights.length; lightIndex++) {
            //let aabb = AABB.getAABBForLight(scene, camera, viewMatrix, lightIndex);
          }
        }
      }
    }

    this._clusterTexture.update();
  }

  getCellsOverlappedByLight(aabb) {

  }
}