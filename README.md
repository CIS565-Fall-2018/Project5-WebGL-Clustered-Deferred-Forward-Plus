WebGL Clustered and Forward+ Shading
======================

**University of Pennsylvania, CIS 565: GPU Programming and Architecture, Project 5**

* Ziad Ben Hadj-Alouane
  * [LinkedIn](https://www.linkedin.com/in/ziadbha/), [personal website](https://www.seas.upenn.edu/~ziadb/)
* Tested on: Google Chrome Version 70.0.3538.77 (WebGL), Windows 10, i7-8750H @ 2.20GHz, 16GB, GTX 1060

# Video Demo
  [<img src="https://github.com/ziedbha/Project5-WebGL-Clustered-Deferred-Forward-Plus/blob/master/imgs/thumb.jpg">](https://www.youtube.com/watch?v=J1Pvi4GN62o)

# Deferred Shading Intro
This project showcases an implementation of Forward shading, with extensions: Forward+ and Clustered/Deferred shading.
  * For **Forward** shading, we supply the graphics card the geometry data, which is then projected, broken into vertices, and split into fragments. Each fragment then gets the final lighting treatment before they are passed onto the screen.
  * For **Forward+** shading, we do the same thing except that we break our viewing frustum into pieces, and compute the lights that overlap these pieces. As such, we can determine which section (i.e cluster) a fragment is in, and iterate over a select few number of lights.
  * For **Clustered** shading (deferred shading), we do the same thing except that the rendering is deferred a little bit until all of the geometries have passed down many stages. The final image is then obtained by doing lighting calculations at the end. This essentially requires more passes on the scene.
  
This project is fully implemented with Javascript and WebGL. See a live demo above.

## Scene
### Sponza
<p align="center"><img width="1000" height="500" src="https://github.com/ziedbha/Project5-WebGL-Clustered-Deferred-Forward-Plus/blob/master/imgs/top.gif"/></p>

#### Views
| Depth View | Normals View | Non-Debug View |
| ------------- | ----------- | ----------- |
| <p align="center"><img width="200" height="150" src="https://github.com/ziedbha/Project5-WebGL-Clustered-Deferred-Forward-Plus/blob/master/imgs/debug_z.png"/> </p>| <p align="center"><img width="200" height="150" src="https://github.com/ziedbha/Project5-WebGL-Clustered-Deferred-Forward-Plus/blob/master/imgs/debug_norm.jpg/"></p> | <p align="center"><img width="200" height="150" src="https://github.com/ziedbha/Project5-WebGL-Clustered-Deferred-Forward-Plus/blob/master/imgs/debug_none.jpg/"></p> |

#### Blinn-Phong Effect
<p align="center"><img width="700" height="400" src="https://github.com/ziedbha/Project5-WebGL-Clustered-Deferred-Forward-Plus/blob/master/imgs/blinn.jpg"/></p>

Blinn-Phong is a shading effect achieved by adding a specular component to the albedo color:
 
~~~~
vec3 halfDirection = lightDirection + viewDirection
float angle = dot(halfDirection, normal);
float spec = pow(angle, exponent);
albedo += spec;
~~~~

Adding Blinn-Phong virtually has no performance impact. It is an extra 3 instructions per lighting computation.

# Performance
## Forward vs. Forward+ vs. Clustered/Deferred
The graph below shows performance differences for the different shading techniques. Overall, the more lights we have, the better Clustering is. However, if we have a low number of lights (say 100), then clustering does more work than needed, hurting performance.
<p align="center"><img width="700" height="400" src="https://github.com/ziedbha/Project5-WebGL-Clustered-Deferred-Forward-Plus/blob/master/imgs/performance_diff.png"/></p>

This is easily explained by the lost benefit of creating the clustering data-structure in the forward+ cases: the less lights you have, the less iterations you would have done anyways.

## Packing Normals in the Position and Color G-Buffers
To reduce the amount of G-Buffers we use, I pack the normals' x and y values in the w coordinate of the position and color vectors. I then retrieve the z coordinate since the normal vector is normalized. The sign value is not lost, since I also multiply the Red color channel by -1 if the z coordinate is negative. There are still some artifacts as showcased below:

| With Packing | Without Packing |
| ------------- | ----------- |
| <p align="center"><img width="400" height="300" src="https://github.com/ziedbha/Project5-WebGL-Clustered-Deferred-Forward-Plus/blob/master/imgs/packed.png"/> </p>| <p align="center"><img width="400" height="300" src="https://github.com/ziedbha/Project5-WebGL-Clustered-Deferred-Forward-Plus/blob/master/imgs/unpacked.png/"></p> |

As for performance, packing clearly wins because we do less global memory reads (at the expense of slightly more computation)
<p align="center"><img width="700" height="400" src="https://github.com/ziedbha/Project5-WebGL-Clustered-Deferred-Forward-Plus/blob/master/imgs/performance_packing.png"/></p>


### Credits
* [Three.js](https://github.com/mrdoob/three.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [stats.js](https://github.com/mrdoob/stats.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [webgl-debug](https://github.com/KhronosGroup/WebGLDeveloperTools) by Khronos Group Inc.
* [glMatrix](https://github.com/toji/gl-matrix) by [@toji](https://github.com/toji) and contributors
* [minimal-gltf-loader](https://github.com/shrekshao/minimal-gltf-loader) by [@shrekshao](https://github.com/shrekshao)
