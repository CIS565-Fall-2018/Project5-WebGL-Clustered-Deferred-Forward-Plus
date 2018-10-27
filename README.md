WebGL Clustered and Forward+ Shading
======================

**University of Pennsylvania, CIS 565: GPU Programming and Architecture, Project 5**

* Ziad Ben Hadj-Alouane
  * [LinkedIn](https://www.linkedin.com/in/ziadbha/), [personal website](https://www.seas.upenn.edu/~ziadb/)
* Tested on: Google Chrome Version 70.0.3538.77 (WebGL), Windows 10, i7-8750H @ 2.20GHz, 16GB, GTX 1060

# Video Demo
  [<img src="https://github.com/ziedbha/Project5-WebGL-Clustered-Deferred-Forward-Plus/blob/master/imgs/thumb.jpg">](https://www.youtube.com/watch?v=J1Pvi4GN62o)

### Live Online

[![](img/thumb.png)](http://TODO.github.io/Project5B-WebGL-Deferred-Shading)

# Deferred Shading Intro
This project showcases an implementation of Forward shading, with extensions: Forward+ and Clustered/Deferred shading.
  * For **Forward** shading, we supply the graphics card the geometry data, which is then projected, broken into vertices, and split into fragments. Each fragment then gets the final lighting treatment before they are passed onto the screen.
  * For **Forward+** shading, we do the same thing except that we break our viewing frustum into pieces, and compute the lights that overlap these pieces. As such, we can determine which section (i.e cluster) a fragment is in, and iterate over a select few number of lights.
  * For **Clustered** shading (deferred shading), we do the same thing except that the rendering is deferred a little bit until all of the geometries have passed down many stages. The final image is then obtained by doing lighting calculations at the end. This essentially requires more passes on the scene.
  
This project is fully implemented with Javascript and WebGL. See a live demo above.

## Scene
### Sponza
| Depth View | Normals View | Blinn-Phong View |
| ------------- | ----------- | ----------- |
| <p align="center"><img width="300" height="200" src="https://github.com/ziedbha/Project5-WebGL-Clustered-Deferred-Forward-Plus/blob/master/imgs/debug_z.png"/></p>| <p align="center"><img width="300" height="200" src="https://github.com/ziedbha/Project5-WebGL-Clustered-Deferred-Forward-Plus/blob/master/imgs/debug_norm.png/"></p> | <p align="center"><img width="300" height="200" src="https://github.com/ziedbha/Project5-WebGL-Clustered-Deferred-Forward-Plus/blob/master/imgs/debug_none.png/"></p> |

# Performance Comparison


### Credits
* [Three.js](https://github.com/mrdoob/three.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [stats.js](https://github.com/mrdoob/stats.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [webgl-debug](https://github.com/KhronosGroup/WebGLDeveloperTools) by Khronos Group Inc.
* [glMatrix](https://github.com/toji/gl-matrix) by [@toji](https://github.com/toji) and contributors
* [minimal-gltf-loader](https://github.com/shrekshao/minimal-gltf-loader) by [@shrekshao](https://github.com/shrekshao)
