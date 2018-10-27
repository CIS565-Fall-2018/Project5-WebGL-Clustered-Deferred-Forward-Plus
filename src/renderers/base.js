import TextureBuffer from './textureBuffer';
import NUM_LIGHTS from '../scene'
import vec4 from 'gl-matrix';
import vec3 from 'gl-matrix';

export const MAX_LIGHTS_PER_CLUSTER = 100;

function angle2Rad(angle)
{
	return Math.PI * angle / 180.0;
}

function getDistance2Light(offset, lightCoord)
{
  	let denom = Math.sqrt(1 + offset * offset);
  	let a1 = 1 / temp;
  	let a2 = -ratio * a1;
  	let normal = vec2.create();

  	vec2.set(normal, a1, a2);
  	return vec2.dot(lightCoord, normal);
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
    let zSeg = (camera.far - camera.near) / this._zSlices;
    let halfFOVinRad = angle2Rad(0.5 * camera.fov);
    let halfHeight = Math.tan(halfFOVinRad);
    let totalHeight = 2.0 * halfHeight;
    let halfWidth = halfHeight * camera.aspect;
    let totalWidth = 2.0 * halfWidth;
    let ySeg = totalHeight / this._ySlices;
    let xSeg = totalWidth / this._xSlices;

    for (let lightI = 0; lightI < NUM_LIGHTS; ++lightI)
    {
    	let lightR = scene.lights[lightI].radius;
    	let lightCoord = vec4(scene.lights[lightI].position, 1.0);
    	vec4.transformMat4(lightCoord, lightCoord, viewMatrix);

    	let zAffectedLowerBound = Math.floor(lightCoord[2] - camera.near - lightR);
    	let zAffectedUpperBound = Math.floor(lightCoord[2] - camera.near + lightR);
    	let zLowerIndex = Math.floor(zAffectedLowerBound / zSeg);
    	let zUpperIndex = Math.floor(zAffectedUpperBound / zSeg);

    	if (zAffectedUpperBound >= this._zSlices)
    	{
    		continue;
    	}
    	if (zAffectedLowerBound < 0)
    	{
    		continue;
    	}

		let xLowerIndex; let xUpperIndex;
    	let yLowerIndex; let yUpperIndex;
    	
    	let distance2Light;
    	
    	for (xLowerIndex = 0; xLowerIndex < this._xSlices; ++xLowerIndex)
    	{
    	    let lightCoordProjected = vec2.create();
        	lightCoordProjected = vec2.set(lightCoordProjected, lightCoord[0], lightCoord[2]);
        	distance2Light = Math.abs(getDistance2Light(-halfWidth + xLowerIndex * xSeg, lightCoordProjected));
        	if (distance2Light < lightR)
        	{
          		xLowerIndex = xLowerIndex - 1;
          		if (xLowerIndex < 0)
          		{
          			xLowerIndex = 0;
          		}
          		break;
        	}
    	}

    	for (xUpperIndex = xLowerIndex + 1; xUpperIndex < this._xSlices; ++xUpperIndex)
    	{
        	let lightCoordProjected = vec2.create();
        	lightCoordProjected = vec2.set(lightPosProjected, lightCoord[0], lightCoord[2]);
        	distance2Light = Math.abs(getDistance2Light(-halfWidth + xUpperIndex * xSeg, lightCoordProjected));
        	if (distance2Light < lightR)
        	{
          		break;
        	}
    	}

    	for (yLowerIndex = 0; yLowerIndex < this._ySlices; ++yLowerIndex)
    	{
        	let lightCoordProjected = vec2.create();
        	lightCoordProjected = vec2.set(lightPosProjected, lightCoord[1], lightCoord[2]);
        	distance2Light = Math.abs(getDistance2Light(-halfHeight + yLowerIndex * ySeg, lightCoordProjected));
        	if (distance2Light < lightR)
        	{
          		yLowerIndex = yLowerIndex - 1;
          		if (yLowerIndex < 0)
          		{
          			yLowerIndex = 0;
          		}
	        	break;
        	}
    	}

    	for (yUpperIndex = yLowerIndex + 1; yUpperIndex < this._ySlices; ++yUpperIndex)
    	{
        	let lightCoordProjected = vec2.create();
        	lightCoordProjected = vec2.set(lightPosProjected, lightCoord[1], lightCoord[2]);
       	 	distance2Light = Math.abs(getDistance2Light(-halfHeight + yUpperIndex * ySeg, lightCoordProjected));
        	if (distance2Light < lightR)
        	{
          		break;
        	}
    	}

    	for (let z = zLowerIndex; z < zUpperIndex; ++z)
    	{
    		for (let y = yLowerIndex; y < yUpperIndex; ++y)
    		{
    			for (let x = xLowerIndex; x < xUpperIndex; ++x)
    			{
    				let clusterIndex = x + this._xSlices * y + this._xSlices * this._ySlices * z;
    				let lightCounterIndex = this._clusterTexture.bufferIndex(clusterIndex, 0);
    				let previousLightCount = this._clusterTexture.buffer[lightCounterIndex];
    				let lightCount = 1 + previousLightCount;

    				if (lightCount < MAX_LIGHTS_PER_CLUSTER)
    				{
    					continue;
    				}

    				this._clusterTexture.buffer[lightCounterIndex] = lightCount;
    				let texelFetched = Math.floor(lightCount * 0.25);
                    let texelIndex = this._clusterTexture.bufferIndex(clusterIndex, texelFetched);
                    let componentIndex = lightCount - texel * 4;
                    this._clusterTexture.buffer[texelIdx + componentIdx] = i;
    			}
    		}
    	}    	
    }
    this._clusterTexture.update();
  }
}