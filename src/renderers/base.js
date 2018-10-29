import TextureBuffer from './textureBuffer';
import { mat4, vec4, vec3 } from 'gl-matrix';
import Frustum from "../frustum";
import { NUM_LIGHTS } from "../scene.js"

export const MAX_LIGHTS_PER_CLUSTER = NUM_LIGHTS;

export default class BaseRenderer {

  constructor(xSlices, ySlices, zSlices, camera) {
      //console.log(NUM_LIGHTS);
      // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
      this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
      this._xSlices = xSlices;
      this._ySlices = ySlices;
      this._zSlices = zSlices;
      let frustumNum = xSlices * ySlices * zSlices;
      this._frustums = [frustumNum];

      ////////////////////////////////////////////////
      // copy & paste from three.module.js line #11280
      //console.log("zoom:" + camera.zoom);
      let near = camera.near;
      let far = camera.far;
      let top = near * Math.tan(Math.PI / 180 * 0.5 * camera.fov ) / camera.zoom;
      let height = 2 * top;
      let width = camera.aspect * height;
      let left = - 0.5 * width;
      let view = camera.view;
      if ( view !== null ) {
          //console.log("view:" + view.fullWidth + "," + view.fullHeight);
          let fullWidth = view.fullWidth, fullHeight = view.fullHeight;
          left += view.offsetX * width / fullWidth;
          top -= view.offsetY * height / fullHeight;
          width *= view.width / fullWidth;
          height *= view.height / fullHeight;
      }
      let skew = camera.filmOffset;
      if ( skew !== 0 ) left += near * skew / camera.getFilmWidth();
      // copy & paste over
      ////////////////////

      let xstart = left, xend = left + width, xstep = (xend - xstart)/xSlices;
      let ystart = top - height, yend = top, ystep = (yend - ystart)/ySlices;
      let zstart = -near, zend = -far, zstep = (zend - zstart)/zSlices;


      for (let x = 0; x < this._xSlices; ++x) {
          for (let y = 0; y < this._ySlices; ++y) {
              for (let z = 0; z < this._zSlices; ++z) {
                  let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
                  this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;

                  //my code below
                  let p0 = vec3.scale(vec3.create(), vec3.fromValues(xstart + x * xstep, ystart + y * ystep, zstart), (zstart + z * zstep) / zstart);
                  let p1 = vec3.scale(vec3.create(), vec3.fromValues(xstart + (x + 1) * xstep, ystart + y * ystep, zstart), (zstart + z * zstep) / zstart);
                  let p2 = vec3.scale(vec3.create(), vec3.fromValues(xstart + x * xstep, ystart + (y + 1) * ystep, zstart), (zstart + z * zstep) / zstart);
                  let p3 = vec3.scale(vec3.create(), vec3.fromValues(xstart + (x + 1) * xstep, ystart + (y + 1) * ystep, zstart), (zstart + z * zstep) / zstart);

                  let p4 = vec3.scale(vec3.create(), vec3.fromValues(xstart + x * xstep, ystart + y * ystep, zstart), (zstart + (z + 1) * zstep) / zstart);
                  let p5 = vec3.scale(vec3.create(), vec3.fromValues(xstart + (x + 1) * xstep, ystart + y * ystep, zstart), (zstart + (z + 1) * zstep) / zstart);
                  let p6 = vec3.scale(vec3.create(), vec3.fromValues(xstart + x * xstep, ystart + (y + 1) * ystep, zstart), (zstart + (z + 1) * zstep) / zstart);
                  let p7 = vec3.scale(vec3.create(), vec3.fromValues(xstart + (x + 1) * xstep, ystart + (y + 1) * ystep, zstart), (zstart + (z + 1) * zstep) / zstart);

                  this._frustums[i] = new Frustum(p0, p1, p2, p3, p4, p5, p6, p7);
              }
          }
      }
  }

  updateClustersGPU(camera, viewMatrix, scene) {

  }

  //correct and efficient way
  //nice
  updateClusters(camera, viewMatrix, scene) {
        // TODO: Update the cluster texture with the count and indices of the lights in each cluster
        // This will take some time. The math is nontrivial...

      //important!!!
      for (let x = 0; x < this._xSlices; ++x) {
          for (let y = 0; y < this._ySlices; ++y) {
              for (let z = 0; z < this._zSlices; ++z) {
                  let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
                  this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
              }
          }
      }
      //important!!!

        for(let l = 0; l<scene.lights.length;l++) {
            let lightCenter = vec3.fromValues(scene.lights[l].position[0], scene.lights[l].position[1], scene.lights[l].position[2]);
            let lightCenterVec4 = vec4.fromValues(lightCenter[0], lightCenter[1], lightCenter[2], 1);
            let lightRadius = scene.lights[l].radius;
            vec4.transformMat4(lightCenterVec4, lightCenterVec4, viewMatrix);
            lightCenter = vec3.fromValues(lightCenterVec4[0], lightCenterVec4[1], lightCenterVec4[2]);

            // console.log("l" + l + ":" + lightCenter[0] + "," + lightCenter[1] + "," + lightCenter[2] + " x:" + lightStartX + "," + lightEndX + " y:" + lightStartY + "," + lightEndY + " z:" + lightStartZ + "," + lightEndZ);

            for (let z = 0; z < this._zSlices; ++z) {
                let earlyZ = z * this._xSlices * this._ySlices;
                if(this._frustums[earlyZ].overlapSphereZ(lightCenter, lightRadius)) {
                    for (let y = 0; y < this._ySlices; ++y) {
                        let earlyY = y * this._xSlices + z * this._xSlices * this._ySlices;
                        if (this._frustums[earlyY].overlapSphereY(lightCenter, lightRadius)) {
                            for (let x = 0; x < this._xSlices; ++x) {
                                let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
                                // if the light overlap with the frustum, add to the texture
                                if (this._frustums[i].overlapSphereX(lightCenter, lightRadius)) {
                                    let currentLightCount = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)];
                                    if (currentLightCount < MAX_LIGHTS_PER_CLUSTER) {
                                        //console.log(x + "," + y + "," + z + ":" + currentLightCount);
                                        this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, currentLightCount + 1)] = l;
                                        this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)]++;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        this._clusterTexture.update();
    }

  // ad-hoc way
  // this method is not correct. it assumes the furthest point in x or y direction can be calculated by
  // the AABB. but since the frustum's x and y axis is not parallel to the view space AABB axis, in extreme cases,
  // where the fov is very large, the assumption is completely wrong
  // updateClusters(camera, viewMatrix, scene) {
  //   // TODO: Update the cluster texture with the count and indices of the lights in each cluster
  //   // This will take some time. The math is nontrivial...
  //
  //         //important!!!
  //         for (let x = 0; x < this._xSlices; ++x) {
  //             for (let y = 0; y < this._ySlices; ++y) {
  //                 for (let z = 0; z < this._zSlices; ++z) {
  //                     let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
  //                     this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
  //                 }
  //             }
  //         }
  //         //important!!!
  //
  //     ////////////////////////////////////////////////
  //     // copy & paste from three.module.js line #11280
  //     //console.log("zoom:" + camera.zoom);
  //     let near = camera.near;
  //     let far = camera.far;
  //     let top = near * Math.tan(Math.PI / 180 * 0.5 * camera.fov ) / camera.zoom;
  //     let height = 2 * top;
  //     let width = camera.aspect * height;
  //     let left = - 0.5 * width;
  //     let view = camera.view;
  //     if ( view !== null ) {
  //         //console.log("view:" + view.fullWidth + "," + view.fullHeight);
  //         let fullWidth = view.fullWidth, fullHeight = view.fullHeight;
  //         left += view.offsetX * width / fullWidth;
  //         top -= view.offsetY * height / fullHeight;
  //         width *= view.width / fullWidth;
  //         height *= view.height / fullHeight;
  //     }
  //     let skew = camera.filmOffset;
  //     if ( skew !== 0 ) left += near * skew / camera.getFilmWidth();
  //     // copy & paste over
  //     ////////////////////
  //
  //     let bottom = top - height;
  //     let right = left + width;//not used
  //     let depth = far - near;
  //
  //     for(let l = 0; l<scene.lights.length;l++) {
  //         let lightCenter = vec3.fromValues(scene.lights[l].position[0], scene.lights[l].position[1], scene.lights[l].position[2]);
  //         let lightCenterVec4 = vec4.fromValues(lightCenter[0], lightCenter[1], lightCenter[2], 1);
  //         let lightRadius = scene.lights[l].radius;
  //         vec4.transformMat4(lightCenterVec4, lightCenterVec4, viewMatrix);
  //         lightCenter = vec3.fromValues(lightCenterVec4[0], lightCenterVec4[1], lightCenterVec4[2]);
  //
  //         //ceil or floor does not matter, as long as it converts the value to integer. but using floor for start and ceil for end feels safer
  //         //z component is flipped because OpenGL use right hand coordinates so the light's z is negative
  //         let lightStartZ = Math.max(0, Math.floor(( - lightCenter[2] - lightRadius - near) / depth * this._zSlices));
  //         let lightEndZ = Math.min(this._zSlices - 1, Math.ceil(( - lightCenter[2] + lightRadius - near) / depth * this._zSlices));
  //
  //         let heightY = - lightCenter[2] / near * height;
  //         let bottomY = - lightCenter[2] / near * bottom;
  //         let lightStartY = Math.max(0, Math.floor((lightCenter[1] - lightRadius - bottomY) / heightY * this._ySlices) - 1);//special treatment
  //         let lightEndY = Math.min(this._ySlices - 1, Math.ceil((lightCenter[1] + lightRadius - bottomY) / heightY * this._ySlices) + 1);//special treatment
  //
  //         let widthX = - lightCenter[2] / near * width;
  //         let leftX = - lightCenter[2] / near * left;
  //         let lightStartX = Math.max(0, Math.floor((lightCenter[0] - lightRadius - leftX) / widthX * this._xSlices) - 1);//special treatment
  //         let lightEndX = Math.min(this._xSlices - 1, Math.ceil((lightCenter[0] + lightRadius - leftX) / widthX * this._xSlices) + 1);//special treatment
  //
  //         //console.log("l" + l + ":" + lightCenter[0] + "," + lightCenter[1] + "," + lightCenter[2] + " x:" + lightStartX + "," + lightEndX + " y:" + lightStartY + "," + lightEndY + " z:" + lightStartZ + "," + lightEndZ);
  //
  //         for (let z = lightStartZ; z <= lightEndZ; ++z) {
  //             for (let y = lightStartY; y <= lightEndY; ++y) {
  //                 for (let x = lightStartX; x <= lightEndX; ++x) {
  //
  //                     let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
  //
  //                     // if AABB of the light overlap with the frustum, add to the texture
  //                     if(1)
  //                     {
  //                       let currentLightCount = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)];
  //                       if(currentLightCount < MAX_LIGHTS_PER_CLUSTER)
  //                       {
  //                         //console.log(x + "," + y + "," + z + ":" + currentLightCount);
  //                         this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, currentLightCount + 1)] = l;
  //                         this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)]++;
  //                       }
  //                     }
  //                 }
  //             }
  //         }
  //     }
  //
  //     this._clusterTexture.update();
  // }

    //naive way
    //not efficient but correct
    // updateClusters(camera, viewMatrix, scene) {
    //     // TODO: Update the cluster texture with the count and indices of the lights in each cluster
    //     // This will take some time. The math is nontrivial...
    //     for(let l = 0; l<scene.lights.length;l++) {
    //         let lightCenter = vec3.fromValues(scene.lights[l].position[0], scene.lights[l].position[1], scene.lights[l].position[2]);
    //         let lightCenterVec4 = vec4.fromValues(lightCenter[0], lightCenter[1], lightCenter[2], 1);
    //         let lightRadius = scene.lights[l].radius;
    //         vec4.transformMat4(lightCenterVec4, lightCenterVec4, viewMatrix);
    //         lightCenter = vec3.fromValues(lightCenterVec4[0], lightCenterVec4[1], lightCenterVec4[2]);
    //
    //         //old way, not efficient
    //         for (let z = 0; z < this._zSlices; ++z) {
    //             for (let y = 0; y < this._ySlices; ++y) {
    //                 for (let x = 0; x < this._xSlices; ++x) {
    //                     let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
    //                     // initialize the light count of this frustum to 0
    //                     if(l==0)
    //                     {
    //                         this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
    //                     }
    //                     // if the light overlap with the frustum, add to the texture
    //                     if(this._frustums[i].overlapSphere(lightCenter, lightRadius))
    //                     {
    //                       let currentLightCount = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)];
    //                       if(currentLightCount < MAX_LIGHTS_PER_CLUSTER)
    //                       {
    //                         //console.log(x + "," + y + "," + z + ":" + currentLightCount);
    //                         this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, currentLightCount + 1)] = l;
    //                         this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)]++;
    //                       }
    //                     }
    //                 }
    //             }
    //         }
    //     }
    //
    //     this._clusterTexture.update();
    // }
}