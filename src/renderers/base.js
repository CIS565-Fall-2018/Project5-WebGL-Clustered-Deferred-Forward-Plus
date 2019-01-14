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
    //console.log(viewMatrix);
    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          
          // number of lights in the cluster starts out as 0
          let numLightsInCluster = 0;

          // get the position of the cluster's bottom left corner in camera space
          let fovRadians = camera.fov * (PI / 180.0); 
          let camZ = (z / this._zSlices) * (camera.far - camera.near);
          
          let screenHeight = (camZ * Math.tan(fovRadians / 2));
          let screenWidth = screenHeight * camera.aspect;
          let clusterHeight = screenHeight / this._ySlices;
          let clusterWidth = screenWidth / this._xSlices;

          let camY = y * clusterHeight;
          let camX = x * clusterWidth;

          // now we loop through each light and see if it's within the cluster (using the view matrix)
          for (let j = 0; j < scene.lights.length; ++j) {

            // get the light's position in camera space by *manually* multiplying the view matrix *sigh*
            let posCamX = viewMatrix[0] * scene.lights[j].position[0] +
                          viewMatrix[4] * scene.lights[j].position[1] +
                          viewMatrix[8] * scene.lights[j].position[2] +
                          viewMatrix[12] * 1;
            let posCamY = viewMatrix[1] * scene.lights[j].position[0] +
                          viewMatrix[5] * scene.lights[j].position[1] +
                          viewMatrix[9] * scene.lights[j].position[2] +
                          viewMatrix[13] * 1;
            let posCamZ = viewMatrix[2] * scene.lights[j].position[0] +
                          viewMatrix[6] * scene.lights[j].position[1] +
                          viewMatrix[10] * scene.lights[j].position[2] +
                          viewMatrix[14] * 1;


            // TODO: Improve this intersection testing (atm doing simple distance from bottom left corner)
            let distance = Math.sqrt(Math.pow(camX - posCamX, 2) + Math.pow(camY - posCamY, 2) + Math.pow(camZ - posCamZ, 2));

            // If the sphere intersects the cluster 
            if (distance < (scene.lights[j].radius * 10) && numLightsInCluster < MAX_LIGHTS_PER_CLUSTER)
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
    //console.log(this._clusterTexture.buffer);
    this._clusterTexture.update();
  }
}