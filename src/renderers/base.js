import TextureBuffer from './textureBuffer';
import { vec3, vec4, mat4} from "gl-matrix";


export const MAX_LIGHTS_PER_CLUSTER = 100;

export default class BaseRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;

    this.nearWidth = 0;
    this.nearHeight = 0;
    this.farWidth = 0;
    this.farHeight = 0;
  }

  updateClusters(camera, viewMatrix, scene)
  {
    // TODO: Update the cluster texture with the count and indices of the lights in each cluster
    // This will take some time. The math is nontrivial...

    let tanfov = Math.tan(camera.fov / 2);

    this.nearHeight = 2 * camera.near * tanfov;
    this.nearWidth = this.nearHeight * camera.aspect_ratio;

    this.farHeight = 2 * camera.far * tanfov;
    this.farWidth = this.farHeight * camera.aspect_ratio;

    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
        }
      }
    }


    for(let lightId = 0; lightId < scene.lights.length; lightId++)
    {
      let sliceBounds = this.calculateSliceBounds(scene, lightId, this.nearWidth, this.nearHeight, this.farWidth, this.farHeight, scene.near, scene.far, viewMatrix);

      for(let x = sliceBounds.xMin; x <= sliceBounds.xMax; x++)
      {
        for(let y = sliceBounds.yMin; y <= sliceBounds.yMax; y++)
        {
          for(let z = sliceBounds.zMin; z <= sliceBounds.zMax; z++)
          {
              let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;

              this._lightTexture.buffer[this._lightTexture.bufferIndex(i, 0) + 0];

              let numLightsIndex = this._clusterTexture.bufferIndex(i, 0);
              let numLight = this._clusterTexture.buffer[numLightsIndex];

              if(numLight < (MAX_LIGHTS_PER_CLUSTER - 1))
              {
                this._clusterTexture.buffer[numLightsIndex] = numLight + 1;

                let pixelIndex = (numLight + 1) / 4;
                let floatOffset = (numLight + 1) % 4;

                this._lightTexture.buffer[this._lightTexture.bufferIndex(i, pixelIndex) + floatOffset] = lightId;
              }
          }
        }
      }
    }

    this._clusterTexture.update();
  }


  calculateSliceBounds(scene, lightId, nearWidth, nearHeight, farWidth, farHeight, nearClip, farClip, viewMatrix)
  {
    let sliceBoundary = { 'xMin' : 0, 'xMax' : 0, 'yMin' : 0, 'yMax' : 0, 'zMin' : 0, 'zMax' : 0};

    let lightRadius = scene.lights[lightId].radius;
    let lightPosWorld = scene.lights[lightId].position;
    let lightPosVec = vec4.fromValues(lightPosWorld[0], lightPosWorld[1], lightPosWorld[2], 1);
    vec4.transformMat4(lightPosVec, lightPosVec, viewMatrix);

    let lerp =((Math.abs( lightPosVec[2]) - nearClip) / (1.0 * farClip - nearClip));

    let sliceWidth = nearWidth + (farWidth - nearWidth) * lerp;
    let sliceHeight = nearHeight + (farHeight - nearHeight) * lerp;

    let bucketWidth = sliceWidth / this._xSlices;
    let bucketHeight = sliceHeight / this._ySlices;

    let bucketLeft = Math.floor((lightPosVec[0] - lightRadius + 0.5 * sliceWidth) / bucketWidth);
    let bucketTop = Math.floor((lightPosVec[1] + lightRadius + 0.5 * sliceHeight) / bucketHeight);

    let bucketRight = Math.floor((lightPosVec[0] + lightRadius + 0.5 * sliceWidth) / bucketWidth);
    let bucketBottom = Math.floor((lightPosVec[1] - lightRadius + 0.5 * sliceHeight) / bucketHeight);

    let bucketNear = Math.floor(((Math.abs(lightPosVec[2]) - nearClip - lightRadius) / (farClip - nearClip)) * this._zSlices);
    let bucketFar = Math.floor(((Math.abs(lightPosVec[2]) - nearClip + lightRadius) / (farClip - nearClip)) * this._zSlices);


    sliceBoundary.xMin = Math.max(0, Math.min(this._xSlices - 1, bucketLeft));
    sliceBoundary.xMax = Math.max(0, Math.min(this._xSlices - 1, bucketRight));

    sliceBoundary.yMin = Math.max(0, Math.min(this._xSlices - 1, bucketBottom));
    sliceBoundary.yMax = Math.max(0, Math.min(this._xSlices - 1, bucketTop));

    sliceBoundary.zMin = Math.max(0, Math.min(this._xSlices - 1, bucketNear));
    sliceBoundary.zMax = Math.max(0, Math.min(this._xSlices - 1, bucketFar));

    return sliceBoundary;
  }


}