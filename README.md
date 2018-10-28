WebGL Clustered and Forward+ Shading
======================

**University of Pennsylvania, CIS 565: GPU Programming and Architecture, Project 5**

* Ishan Ranade
* Tested on personal computer: Gigabyte Aero 14, Windows 10, i7-7700HQ, GTX 1060

## Images

![](forwardplus.JPG)

* Forward Plus

![](deferred.JPG)

* Deferred

## Live Online

[Demo Link](https://ishanranade.github.io/Project5-WebGL-Clustered-Deferred-Forward-Plus/)

## Demo Video/GIF

![](demo.gif)

## Forward Plus

Forward plus shading is a technique in which you perform forward rendering, but you use clustering to greatly improve performance.  Clustering is a technique where you divide up the view frustrum portion from the near clip plane to the far clip plane into "fruxels", or frustrum voxels.  You then figure out which lights affect which fruxel, and save this data into a texture.  You can then unpack this texture during the lighting stage of the shader and perform lighting only using the lights that affect the fruxel that a fragment is in.

![](frustrumimage.png)

- Example of how the fruxels look

## Deferred

Deferred shading is a technique where you have an extra pass in between the typical vertex and fragment shaders in which you render fragment data to a series of textures and use those textures in the final fragment shader.  These textures are usually known as g-buffers, and eac g-buffer holds unique data.  Deferred rendering can also make use of clustering to improve performance.  Below are examples of the various textures that we can output to the final stage and the type of data each represents.

![](normals.JPG)

- Normals

![](position.JPG)

- World positions

![](albedo.JPG)

- Albedo colors

## Optimizations

Some optimizations I used include packing data in the G buffers to save memory.  I needed the view space position for my final shading calculations, so I stored each element as the 4th components of each of the 3 g-buffers that I used.  This helped me reduce to only using 3 g-buffers.  Reducing the number of g-buffers is important because it reduces the amount of memory that must be created to fill a texture and pass it on to the final fragment stage.  The less g-buffers needed the less memory that must be stored on the GPU.

## Performance Analysis

During my experimentation, I found that my computer was limited in the size of memory that I could store on the GPU, and I was only able to have a resolution of 25x25x25 for the cluster texture.  I perfomed experiments on various cluster resolution sizes and light counts to see how fast each type of rendering could perform.


![](15.JPG)

![](20.JPG)

![](25.JPG)

I found that Deferred rendering tended to be the fastest, which became more visible the more lights I added to the scene.  This may be because 


### Credits

* [Three.js](https://github.com/mrdoob/three.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [stats.js](https://github.com/mrdoob/stats.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [webgl-debug](https://github.com/KhronosGroup/WebGLDeveloperTools) by Khronos Group Inc.
* [glMatrix](https://github.com/toji/gl-matrix) by [@toji](https://github.com/toji) and contributors
* [minimal-gltf-loader](https://github.com/shrekshao/minimal-gltf-loader) by [@shrekshao](https://github.com/shrekshao)
