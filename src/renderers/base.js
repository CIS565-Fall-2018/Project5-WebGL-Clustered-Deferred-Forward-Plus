import TextureBuffer from './textureBuffer';
import {NUM_LIGHTS} from "../scene";
import { mat4, vec3, vec4 } from 'gl-matrix';

export const MAX_LIGHTS_PER_CLUSTER = 100;

function getDistanceX(lightPos, x){
    let xNormal = vec3.fromValues(1.0 / Math.sqrt(x * x + 1), 0 , -x / Math.sqrt(x * x + 1));
    return vec3.dot(vec3.fromValues(lightPos[0], lightPos[1], lightPos[2]), xNormal);
}

function getDistanceY(lightPos, y){
    let yNormal =  vec3.fromValues(0, 1.0 / Math.sqrt(y * y + 1), -y / Math.sqrt(y * y + 1));
    return vec3.dot(vec3.fromValues(lightPos[0], lightPos[1], lightPos[2]), yNormal);
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

        // with 'z-normalized'
        const y_half = Math.tan(camera.fov * 0.5 * Math.PI /180.0);
        const x_half = camera.aspect * y_half;
        const y_step = y_half * 2.0 / this._ySlices;
        const x_step = x_half * 2.0 / this._xSlices;
        const z_step = (camera.far - camera.near) / this._zSlices;


        for (let i = 0; i < NUM_LIGHTS; i++){

            let xMin, xMax, yMin, yMax, zMin, zMax;
            let lightPos = vec4.fromValues(scene.lights[i].position[0], scene.lights[i].position[1],
                scene.lights[i].position[2], 1.0);
            vec4.transformMat4(lightPos, lightPos, viewMatrix);
            lightPos[2] *= -1.0;

            let lightRadius = scene.lights[i].radius;
            let z = lightPos[2] - camera.near;

            zMin = Math.floor((z - lightRadius) / parseFloat(z_step));
            zMax = Math.floor((z + lightRadius) / parseFloat(z_step));

            if (zMin >= this._zSlices || zMax < 0) continue;
            zMin = Math.max(0, zMin);
            zMax = Math.min(zMax, this._zSlices - 1);


            for (xMin = 0; xMin <= this._xSlices; xMin++) {
                let xSeg = -x_half + xMin * x_step;
                let dist = getDistanceX(lightPos, xSeg);
                if (Math.abs(dist) < lightRadius) break;
            }

            for (xMax = this._xSlices; xMax >= xMin; xMax--){
                let xSeg = -x_half + xMax * x_step;
                let dist = getDistanceX(lightPos, xSeg);
                if (Math.abs(dist) < lightRadius) break;
            }

            for (yMin = 0; yMin <= this._ySlices; yMin++){
                let ySeg = -y_half + yMin * y_step;
                let dist = getDistanceY(lightPos, ySeg);
                if (Math.abs(dist) < lightRadius) break;
            }

            for (yMax = this._ySlices; yMax >= yMin; yMax--){
                let ySeg = -y_half + yMax * y_step;
                let dist = getDistanceY(lightPos, ySeg);
                if (Math.abs(dist) < lightRadius) break;
            }

            for (let x = xMin; x < xMax; x++){
                for(let y = yMin; y < yMax; y++){
                    for(let z = zMin; z <= zMax; z++){
                        let pixel = x + y * this._xSlices + z * this._xSlices * this._ySlices;
                        let num_light = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(pixel, 0)] + 1;
                        if (num_light > MAX_LIGHTS_PER_CLUSTER) break;
                        this._clusterTexture.buffer[this._clusterTexture.bufferIndex(pixel, 0)] += 1;
                        let texel = this._clusterTexture.bufferIndex(pixel, Math.floor(num_light / 4.0));
                        let offset = num_light - Math.floor(num_light / 4.0) * 4;
                        this._clusterTexture.buffer[texel + offset] = i;
                    }
                }
            }


        }

        this._clusterTexture.update();
    }
}