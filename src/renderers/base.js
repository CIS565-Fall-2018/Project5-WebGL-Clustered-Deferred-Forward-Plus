import TextureBuffer from './textureBuffer';
import {vec4, vec3} from 'gl-matrix';
import {NUM_LIGHTS} from "../scene";

export const MAX_LIGHTS_PER_CLUSTER = 100;

/**
 * Converts an angle in degrees to radians
 */
function toRadian(deg) {
    return deg * Math.PI / 180;
}

/**
 * Returns an array containing the cosine and sine of a right triangle with sides 1 and opposite
 */
function getNormalForTriangle(opposite) {
    let hypothenuse = Math.sqrt(1 + opposite * opposite);
    return [1 / hypothenuse, opposite / hypothenuse];
}

/**
 * Explained in detail in the README. Does frustum/sphere intersection test by approximating the frustum section
 * as a right triangle with sides 1 and currentAxisDistance
 */
function getDotForFrustumCheck(currentAxisDistance, camSpaceLightPos, axis) {
    // get the info for the frustum vector
    let normalCoords = getNormalForTriangle(currentAxisDistance);

    // flip the vector by around the cosine axis
    let normal;
    if (axis === "x") {
        // X plane
        normal = vec3.fromValues(normalCoords[0], 0, -normalCoords[1]);
    } else {
        // Y plane
        normal = vec3.fromValues(0, normalCoords[0], -normalCoords[1]);
    }


    // return the dot product of the frustum vector with the light position vector
    return vec3.dot(camSpaceLightPos, normal);
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
        /** Init light counter to 0 **/
        for (let z = 0; z < this._zSlices; ++z) {
            for (let y = 0; y < this._ySlices; ++y) {
                for (let x = 0; x < this._xSlices; ++x) {
                    let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
                    this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
                }
            }
        }

        /** Get Frustum Info ***/
        // tangent of half of vertical fov gives us the half the vertical camera frustum
        let verticalStretch = 2.0 * Math.tan(toRadian(camera.fov / 2));
        let xSliceLength = verticalStretch * camera.aspect / this._xSlices;
        let ySliceLength = verticalStretch / this._ySlices;
        let depthStretch = camera.far - camera.near;
        let zSliceLength = depthStretch / this._zSlices;

        /** For every light, compute the clusters**/
        for (let lightIdx = 0; lightIdx < NUM_LIGHTS; lightIdx++) {
            // get light info: radius and world position
            let lightRad = scene.lights[lightIdx].radius;
            let lightPos = vec4.create();
            lightPos[0] = scene.lights[lightIdx].position[0];
            lightPos[1] = scene.lights[lightIdx].position[1];
            lightPos[2] = scene.lights[lightIdx].position[2];
            lightPos[3] = 1;

            // transform world position to camera space. Cam is positioned at 0 origin in this space
            lightPos = vec4.transformMat4(lightPos, lightPos, viewMatrix);
            lightPos[2] = -lightPos[2];

            // vec3 version of light pos, adjusted for -z
            let lightPos3 = vec3.fromValues(lightPos[0], lightPos[1], lightPos[2]);

            /*************** X DIMENSION ********************/
            // For the X & Y dimensions, we use a trigonometric method of computing
            // sphere + frustum section intersection. See README for details
            let minX = this._xSlices;
            let maxX = this._xSlices;
            for (let i = 0; i < this._xSlices; i++) {
                // start at -half of X axis
                let dot = getDotForFrustumCheck(i * xSliceLength - ((verticalStretch / 2.0) * camera.aspect),
                    lightPos3, "x");
                if (dot < lightRad) {
                    // if a section of the frustum is inside the sphere, then take previous section
                    minX = i - 1; // clamp this later just in case == -1
                    break;
                }
            }
            if (minX >= this._xSlices) {
                continue;
            }

            for (let i = minX + 1; i < this._xSlices; i++) {
                let dot = getDotForFrustumCheck(i * xSliceLength - ((verticalStretch / 2.0) * camera.aspect),
                    lightPos3, "x");
                if (dot > lightRad) {
                    // if a section of the frustum becomes outside the sphere, then we have it
                    maxX = i;
                    break;
                }
            }

            /*************** Y DIMENSION ********************/
            let minY = this._ySlices;
            let maxY = this._ySlices;
            for (let i = 0; i < this._ySlices; i++) {
                // start at -half of Y axis
                let dot = getDotForFrustumCheck(i * ySliceLength - (verticalStretch / 2.0), lightPos3, "y");
                if (dot < lightRad) {
                    minY = i - 1;
                    break;
                }
            }
            if (minY >= this._ySlices) {
                continue;
            }

            for (let i = minY + 1; i < this._ySlices; i++) {
                // start at -half of Y axis
                let dot = getDotForFrustumCheck(i * ySliceLength - (verticalStretch / 2.0), lightPos3, "y");
                if (dot > lightRad) {
                    maxY = i;
                    break;
                }
            }

            /*************** Z DIMENSION ********************/
            // Z dimension is purely linear (from near clip to far clip)
            let minZ = this._zSlices;
            let maxZ = -1;
            for (let i = 0; i < this._zSlices; i++) {
                let currZ = i * zSliceLength + camera.near;
                if (currZ > lightPos[2] - lightRad) {
                    minZ = i - 1; // take the previous one because we still need to be < pos - rad
                    break;
                }
            }
            if (minZ >= this._zSlices) {
                continue;
            }

            for (let i = minZ + 1; i < this._zSlices; i++) {
                let currZ = i * zSliceLength + camera.near;
                if (currZ > lightPos[2] + lightRad) {
                    maxZ = i; // take the current one because it has the most recent change
                    break;
                }
            }
            if (maxZ <= -1) {
                continue;
            }

            /********* CLAMPING THE BOUNDS ************/
            // clamp cluster bounds
            maxZ = Math.min(maxZ, this._zSlices - 1);
            maxY = Math.min(maxY, this._ySlices - 1);
            maxX = Math.min(maxX, this._xSlices - 1);

            minZ = Math.max(minZ, 0);
            minY = Math.max(minY, 0);
            minX = Math.max(minX, 0);

            /************ UPDATING AFFECTED CLUSTERS ************/
            // iterate over the cluster bounds and fill the buffers
            // optimized loop goes z y then x
            for (let z = minZ; z <= maxZ; z++) {
                for (let y = minY; y <= maxY; y++) {
                    for (let x = minX; x <= maxX; x++) {
                        // get current num lights, check if == num lights, and update if not
                        let clusterIdx = x + y * this._xSlices + z * this._ySlices * this._xSlices;
                        let nbLights = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(clusterIdx, 0)];
                        if (nbLights >= MAX_LIGHTS_PER_CLUSTER) {
                            break;
                        }
                        this._clusterTexture.buffer[this._clusterTexture.bufferIndex(clusterIdx, 0)] = nbLights + 1;

                        // update to store light index
                        let row = Math.floor((nbLights + 1) / 4);
                        let component = nbLights + 1 - row * 4;
                        this._clusterTexture.buffer[this._clusterTexture.bufferIndex(clusterIdx, row) + component] = lightIdx;
                    }
                }
            }
        }
        this._clusterTexture.update();
    }
}