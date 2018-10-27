WebGL Clustered and Forward+ Shading
======================

**University of Pennsylvania, CIS 565: GPU Programming and Architecture, Project 5**

* Xiao Zhang
  * [LinkedIn](https://www.linkedin.com/in/xiao-zhang-674bb8148/)
* Tested on: Windows 10, i7-7700K @ 4.20GHz 16.0GB, GTX 1080 15.96GB (my own PC)

Overview 
======================

![](img/0.gif)

Analysis 
======================
* MAX_LIGHTS_PER_CLUSTER is NUM_LIGHTS.

* Rendering time is measured in millisecond, so lower is better.

* Cluster size is (15, 15, 15).

---

## 1. Naive binning method

### overview

![](img/2.JPG)

### analysis

The naive binning method iterates through all the lights. For each light, the method iterate through all sub-frustums in the view frustum and check whether the light is within the boundaries of each sub-frustum. This is an expensive algorithm so the result is not good enough.

---

## 2. Early rejection binning method

### overview

![](img/3.JPG)

### analysis

The early rejection binning method also iterates through all the lights. For each light, the method iterate through all sub-frustums in the view frustum and check whether the light is within the boundaries of each sub-frustum. But only this time, when it iterates through all the sub-frustums, it will first check whether the light is within the boundary of the sub-frustums along the current axis. If it is not, then there is no point in going through all the sub-frustums within that boundary.

---

## 3. Ad-hoc binning method

### overview

![](img/3a.JPG)

### analysis

The ad-hoc binning method also iterates through all the lights. However, for each light, the method will calculate a boundary based on the AABB of the light and bin the light into all the sub-frustums within that boundary. This method will save all the plane-sphere intersection calculation but it will also intruduce false positive results. Besides, the method will not work if fov of the camera is too large. The reason can be explained by the following picture. 

![](img/3b.png)

When the fov is too large, the maximum and minimum positions along x and y axes do not represent the maximum and minimum sub-frustums. One possible fix is to move the center to the front face of the AABB and calculate the covered sub-frustums using the z value there. But this will produce even more false positive results.

---

## 4. Clustered forward rendering

### overview

![](img/4.JPG)

### analysis

According to the chart, clustered forward rendering benefits from ad-hoc binning method. 

---

## 5. Clustered deferred rendering

### overview

![](img/5.JPG)

### analysis

According to the chart, clustered deferred rendering benefits more from ad-hoc binning method than clustered forward rendering or we can say clustered forward rendering suffers more from ad-hoc binning method than clustered deferred rendering. This might be because ad-hoc binning introduced false-positive results, which means there are more lights in a cluster than it should be. And deferred rendering perfroms better when the light calculation is massive. In conclusion, On CPU side, both rendering method benefits the same from ad-hoc binning but on GPU side, clustered forward suffers more than clustered deferred. 

---

## 6. GPU binning clustered forward renderer.

### overview

* very near distance

![](img/a.jpg)

* near distance

![](img/b.jpg)

* mid distance

![](img/c.jpg)

* far distance

![](img/d.jpg)

* very far distance

![](img/e.jpg)

### analysis

Using GPU to bin the lights is the ultimate solution to increase fps. However, webgl currently does not support compute shader. To bin the lights, we have to draw a full screen quad and convert fragment coordinates to cluster index and loop through 4 lights in each fragment shader. 

Ideally, we want to store only the lights that's in the cluster and a total number of them so that we can loop through only these lights in the subsequent pass. But because we don't have compute shader, we also don't have atomic operations. This makes the above storage scheme impossible. We have to store a bool value for each and every light in the scene for each cluster to indicate whether the particular light is in the particular cluster or not. This means in the subsequent pass, we can not get the total light count and can not only iterate through a small amount of lights. We have to check for each light in the scene whether they are in the cluster or not. And this is an expensive operation. In fact, compared with the un-clustered forward renderer, this makes no improvement at all. The rendering time of the GPU binning clustered forward renderer is not faster than the un-clustered forward renderer.

---

## 7. Other stuff

![](img/1.JPG)

* Deferred Blinn-Phong shading.

* 2 G-buffers.

* 2-component normals.

---

### Credits

* [Three.js](https://github.com/mrdoob/three.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [stats.js](https://github.com/mrdoob/stats.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [webgl-debug](https://github.com/KhronosGroup/WebGLDeveloperTools) by Khronos Group Inc.
* [glMatrix](https://github.com/toji/gl-matrix) by [@toji](https://github.com/toji) and contributors
* [minimal-gltf-loader](https://github.com/shrekshao/minimal-gltf-loader) by [@shrekshao](https://github.com/shrekshao)
