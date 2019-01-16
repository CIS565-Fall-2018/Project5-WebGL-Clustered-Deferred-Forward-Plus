import TextureBuffer from './textureBuffer';

export const MAX_LIGHTS_PER_CLUSTER = 100;
export const PI = 3.14159265359;

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

    // view matrix takes things in view space and transforms them into world space 
    // now the question is: are the lights in view space?

    // okay so we know that the lights are in world space. Now the question is: 
    // how large are these slices (especially the z one). We can assume the 
    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          
          // number of lights in the cluster starts out as 0
          let numLightsInCluster = 0;

          // get the position of the cluster's center in camera space
          // as well as the height width and depth
          let fovRadians = camera.fov * (Math.PI / 180.0); 
          let frustumCenterZ = ((z + 0.5)  / this._zSlices) * (camera.far - camera.near);
          
          let frustumDepth = (camera.far - camera.near) / this._zSlices; 
          let screenHeight = 2.0 * (frustumCenterZ * Math.tan(fovRadians / 2));
          let screenWidth = screenHeight * camera.aspect;
          let frustumHeight = screenHeight / this._ySlices;
          let frustumWidth = screenWidth / this._xSlices;

          let frustumCenterY = (y + 0.5) * frustumHeight;
          let frustumCenterX = (x + 0.5) * frustumWidth;

          let frustumDiagonalLength = Math.sqrt(Math.pow((frustumWidth / 2.0), 2) + 
                                     Math.pow((frustumHeight / 2.0), 2) + 
                                     Math.pow((frustumDepth / 2.0), 2));
          
          // now we loop through each light and see if it's within the cluster (using the view matrix)
          for (let j = 0; j < scene.lights.length; ++j) {

            // TODO: Get the w for perspective divide***
            // get the light's position in camera space by *manually* multiplying the view matrix *sigh*
            let lightCenterX = viewMatrix[0] * scene.lights[j].position[0] +
                              viewMatrix[4] * scene.lights[j].position[1] +
                              viewMatrix[8] * scene.lights[j].position[2] +
                              viewMatrix[12] * 1;
            let lightCenterY = viewMatrix[1] * scene.lights[j].position[0] +
                              viewMatrix[5] * scene.lights[j].position[1] +
                              viewMatrix[9] * scene.lights[j].position[2] +
                              viewMatrix[13] * 1;
            let lightCenterZ = viewMatrix[2] * scene.lights[j].position[0] +
                              viewMatrix[6] * scene.lights[j].position[1] +
                              viewMatrix[10] * scene.lights[j].position[2] +
                              viewMatrix[14] * 1;

            let distance = Math.sqrt(Math.pow(frustumCenterX - lightCenterX, 2) + 
                                    Math.pow(frustumCenterY - lightCenterY, 2));

            // If the sphere intersects the cluster 
            if (distance < (scene.lights[j].radius*10 + frustumDiagonalLength) && numLightsInCluster < MAX_LIGHTS_PER_CLUSTER)
            {
              numLightsInCluster += 1;
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, Math.floor(numLightsInCluster/4)) + (numLightsInCluster % 4)] = j;
            } 
          }
          
          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = numLightsInCluster;        
        }
      }
    }
    this._clusterTexture.update();
  }
}