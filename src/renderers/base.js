import TextureBuffer from './textureBuffer';
import { NUM_LIGHTS } from '../scene';
import { mat4, vec4, vec3, vec2 } from 'gl-matrix';

export const MAX_LIGHTS_PER_CLUSTER = 700;

function getNormalComponents(angle) {

    let bigHypot = Math.sqrt(1 + angle*angle);
    let normSide1 = 1 / bigHypot;
    let normSide2 = -angle*normSide1;
    return vec2.fromValues(normSide1, normSide2);
}

function findPlanePointDis(planePos, Pt, XY) {
  let interval = Math.sqrt(planePos*planePos+1);
  let lightp = vec3.fromValues(Pt[0],Pt[1],Pt[2]);
  let res = vec3.fromValues(0,0,0);
  if(XY == 1) {
      let planenor = vec3.fromValues(1.0/interval,0.0,-planePos/interval);
      res = vec3.dot(lightp,planenor);
  }
  if(XY==2)
  {
    let planenor = vec3.fromValues(0.0,1.0/interval,-planePos/interval);
    res = vec3.dot(lightp,planenor);
  }
  return res;
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

      const halfY = Math.tan((camera.fov*0.5) * (Math.PI/180.0));
      const ylengthPerCluster = (halfY * 2.0 / this._ySlices);
      const xlengthPerCluster = (halfY * 2.0 / this._xSlices) * camera.aspect;
      const zlengthPerCluster = (camera.far - camera.near) / this._zSlices;
      const ystart = -halfY;
      const xstart = -halfY * camera.aspect;

      for(let i = 0; i < NUM_LIGHTS; ++i) {
          let lightRadius = scene.lights[i].radius;
          let lightPos = vec4.fromValues(scene.lights[i].position[0], scene.lights[i].position[1], scene.lights[i].position[2], 1.0);
          vec4.transformMat4(lightPos, lightPos, viewMatrix);
          lightPos[2] *= -1.0;


          let xminidx = this._xSlices; 
          let xmaxidx = this._xSlices;        
          let yminidx = this._ySlices;    
          let ymaxidx = this._ySlices;       
          let minposz = lightPos[2] - camera.near - lightRadius;
          let maxposz = lightPos[2] - camera.near + lightRadius;
          let zminidx  = Math.floor(minposz / zlengthPerCluster);
          let zmaxidx   = Math.floor(maxposz  / zlengthPerCluster)+1;
          if(zminidx > this._zSlices-1 || zmaxidx < 0) { continue; }
          zminidx = Math.max(0, zminidx);
          zmaxidx = Math.min(this._zSlices, zmaxidx);
          
          for(let j = 0; j <= this._xSlices; ++j) {
              let norm2 = vec2.clone(getNormalComponents(xstart+xlengthPerCluster*j));
              let norm3 = vec3.fromValues(norm2[0], 0, norm2[1]);
              if(vec3.dot(lightPos, norm3) < lightRadius) {
                  xminidx = Math.max(0, j-1);
                  break;
              }
          }


          for(let j = xminidx+1; j<=this.xSlices; ++j) {
              let norm2 = vec2.clone(getNormalComponents(xstart+xlengthPerCluster*j));
              let norm3 = vec3.fromValues(norm2[0], 0, norm2[1]);
              if(vec3.dot(lightPos, norm3) < -lightRadius) {
                  xmaxidx = Math.max(0, j-1);
                  break;
              }
          }


          for(let j = 0; j <= this._ySlices; ++j) {
              let norm2 = vec2.clone(getNormalComponents(ystart+ylengthPerCluster*j));
              let norm3 = vec3.fromValues(0, norm2[0], norm2[1]);
              if(vec3.dot(lightPos, norm3) < lightRadius) {
                  yminidx = Math.max(0, j-1);
                  break;
              }
          }


          for(let j = yminidx+1; j<=this.ySlices; ++j) {
              let norm2 = vec2.clone(getNormalComponents(ystart+ylengthPerCluster*j));
              let norm3 = vec3.fromValues(0, norm2[0], norm2[1]);
              if(vec3.dot(lightPos, norm3) < -lightRadius) {
                  ymaxidx = Math.max(0, j-1);
                  break;
              }
          }



          for(let z = zminidx; z < zmaxidx; ++z) {
              for(let y = yminidx; y < ymaxidx; ++y) {
                  for(let x = xminidx; x < xmaxidx; ++x) {
                      let clusterIdx = x + y*this._xSlices + z*this._xSlices*this._ySlices;
                      let lightCountIdx = this._clusterTexture.bufferIndex(clusterIdx, 0);
                      let lightCount = 1 + this._clusterTexture.buffer[lightCountIdx];

                      if(lightCount <= MAX_LIGHTS_PER_CLUSTER) {
                          this._clusterTexture.buffer[lightCountIdx] = lightCount;
                          let texel = Math.floor(lightCount*0.25);
                          let texelIdx = this._clusterTexture.bufferIndex(clusterIdx, texel);
                          let componentIdx = lightCount - texel*4;
                          this._clusterTexture.buffer[texelIdx+componentIdx] = i;
                      }
                  }
              }
          }



      }//end light loop

      this._clusterTexture.update();
  }
}