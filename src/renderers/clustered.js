import { gl, WEBGL_draw_buffers, canvas } from '../init';
import { mat4, vec4 } from 'gl-matrix';
import { loadShaderProgram, renderFullscreenQuad } from '../utils';
import { NUM_LIGHTS } from '../scene';
import toTextureVert from '../shaders/deferredToTexture.vert.glsl';
import toTextureFrag from '../shaders/deferredToTexture.frag.glsl';
import QuadVertSource from '../shaders/quad.vert.glsl';
import fsSource from '../shaders/deferred.frag.glsl.js';

//added: read brightness filter from filter shader
import fsSourceToTexture from '../shaders/deferredToTextureAux.frag.glsl.js';
import fsSourceBrightnessTexture from '../shaders/brightnessFilterToTexture.frag.glsl';

//added: blur fragment & vertex shaders
import fsSourceBlur from '../shaders/blur.frag.glsl';
import vsSourceBlurHorizontal from '../shaders/blurHorizontal.vert.glsl';
import vsSourceBlurVertical from '../shaders/blurVertical.vert.glsl';

//added: combine fragment shaders
import fsSourceCombine from '../shaders/combineFragmentbuffer.frag.glsl';


import TextureBuffer from './textureBuffer';
import BaseRenderer from './base';

import {MAX_LIGHTS_PER_CLUSTER} from './base';

//changed to use 2 g-buffers
//export const NUM_GBUFFERS = 4;
//2 g-buffers is buggy, switch back to 4
export const NUM_GBUFFERS = 2;

export default class ClusteredRenderer extends BaseRenderer {
//define member functions for bloom effect calling
/////////////////////////////
//bloom effect///
//////////////////////////
  //step1: shader load and config
  bloomInitialize(){
//shader program: render to a auxillary framebuffer
    this._progShadeToTexture = loadShaderProgram(QuadVertSource, fsSourceToTexture({
      numLights: NUM_LIGHTS,
      numGBuffers: NUM_GBUFFERS,
      maxNumberLightsPerCluster: MAX_LIGHTS_PER_CLUSTER,
      numXSlices: xSlices,
      numYSlices: ySlices,
      numZSlices: zSlices,
    }),{
      uniforms: ['u_gbuffers[0]', 'u_gbuffers[1]', 
      'u_lightbuffer', 'u_nearClip',
      'u_clusterTileSize','u_clusterZStride',
      'u_viewMatrix', 'u_clusterbuffer',
      'u_inverseViewProjMat', 'u_inverseViewMat'],
      attribs: ['a_uv'],
    });
//brightness shader
    this._progBrightnessShade = loadShaderProgram(QuadVertSource, fsSourceBrightnessTexture, {
      uniforms: ['u_oriScreenBuffer'],
      attribs: ['a_uv'],
    });
//horizontal blur shader
    this._progHorizontalBlur = loadShaderProgram(vsSourceBlurHorizontal, fsSourceBlur, {
      uniforms: ['u_dst_widht', 'u_texture'],
      attribs: ['a_uv'];
    });
//vertical blur shader
    this._progVerticalBlur = loadShaderProgram(vsSourceBlurVertical, fsSourceBlur, {
      uniforms: ['u_dst_height', 'u_texture'],
      attribs: ['a_uv'],
    });
//combine framebuffer shader
    this._progCombine = loadShaderProgram(QuadVertSource, fsSourceCombine, {
      uniforms:['u_colorTex', 'u_brightnessTex'],
      attribs: ['a_uv'],
    });
  }

  //bloom effect step2: setup fbos
  setupDrawBuffersBloom(width, height){
    let attachments0 = newArray(1);
    attachments0[0] = WEBGL_draw_buffers[`COLOR_ATTACHMENT_WEBGL`];
//frame buffer1: original screen image    
    //original screen image, write to a frame buffer
    this._fbo_screen = gl.createFramebuffer();

    //similarly, create and bind depth texture to FBO
    this._depthTex_Bloom0 = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this._depthTex_Bloom0);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, width, height, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this._fbo_screen);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT,
      gl.TEXTURE_2D, this._depthTex_Bloom0, 0);

    //screen image as texture

    //create another texture
    this._screenbuffer = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this._screenbuffer);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.FLOAT, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    gl.framebufferTexture2D(gl.FRAMEBUFFER, attachments0[0], gl.TEXTURE_2D, this._screenbuffer, 0);

    //check for errors
    if(gl.checkFramebufferStatus(gl.FRAMEBUFFER) != gl.FRAMEBUFFER_COMPLETE){
      throw "framebuffer error";
    }
    WEBGL_draw_buffers.drawBuffersWEBGL(attachments0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

//framebuffer2: brightness buffer
    this._fbo_brightness = gl.createFramebuffer();

    this._depthTex_Bloom1_DownScale = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this._depthTex_Bloom1_DownScale);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, width / this._brightnessFilterDownScale, height / this._brightnessFilterDownScale, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this._fbo_brightness);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this._depthTex_Bloom1_DownScale, 0);
     
    this._birghtnessFilterBuffer = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this._birghtnessFilterBuffer);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width / this._brightnessFilterDownScale, height / this._brightnessFilterDownScale, 0, gl.RGBA, gl.FLOAT, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
     gl.framebufferTexture2D(gl.FRAMEBUFFER, attachments0[0], gl.TEXTURE_2D, this._birghtnessFilterBuffer, 0);
     if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) != gl.FRAMEBUFFER_COMPLETE) {
      throw "framebuffer error";
    }
     WEBGL_draw_buffers.drawBuffersWEBGL(attachments0);
     gl.bindFramebuffer(gl.FRAMEBUFFER, null);

//framebuffer3: down scale framebuffer 1
    this._fbo_DownScale1 = gl.createFramebuffer();

    this._depthTex_Bloom2_DownScale = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this._depthTex_Bloom2_DownScale);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, width / this._blurDownScale, height / this._blurDownScale, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    gl.bindTexture(gl.TEXTURE_2D, null);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this._fbo_DownScale1);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this._depthTex_Bloom2_DownScale, 0);

    this._downScale1Buffer = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this._downScale1Buffer);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width / this._blurDownScale, height / this._blurDownScale, 0, gl.RGBA, gl.FLOAT, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    gl.framebufferTexture2D(gl.FRAMEBUFFER, attachments0[0], gl.TEXTURE_2D, this._downScale1Buffer, 0);

    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) != gl.FRAMEBUFFER_COMPLETE) {
      throw "framebuffer error";
    }
     WEBGL_draw_buffers.drawBuffersWEBGL(attachments0);
     gl.bindFramebuffer(gl.FRAMEBUFFER, null);

//frame buffer 4: second down scale buffer
    this._fbo_DownScale2 = gl.createFramebuffer();

    this._depthTex_Bloom3_DownScale = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this._depthTex_Bloom3_DownScale);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, width / this._blurDownScale, height / this._blurDownScale, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this._fbo_DownScale2);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D,
      this._depthTex_Bloom3_DownScale, 0);

    this._downScale2Buffer - gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this._downScale2Buffer);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width / this._blurDownScale, height / this._blurDownScale, 0, gl.RGBA, gl.FLOAT, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    gl.framebufferTexture2D(gl.FRAMEBUFFER, attachments0[0], gl.TEXTURE_2D, this._downScale2Buffer,0);

    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) != gl.FRAMEBUFFER_COMPLETE) {
      throw "fragmentbuffer eror";
    }
     WEBGL_draw_buffers.drawBuffersWEBGL(attachments0);
     gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    }//setupDrawBuffersBloom function end

    //bloom effect step3: resize bloom frame buffers
    resizeBloomBuffer(width, height){
      gl.bindTexture(gl.TEXTURE_2D, this._depthTex_Bloom0);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, width, height, 0, gl.DEPTH_COMPONENT,
        gl.UNSIGNED_SHORT, null);

      gl.bindTexture(gl.TEXTURE_2D, this._screenbuffer);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.FLOAT,null);
      

      gl.bindTexture(gl.TEXTURE_2D, this._depthTex_Bloom1_DownScale);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, 
        width / this._brightnessFilterDownScale, height / this._brightnessFilterDownScale, 
        0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);
     
      gl.bindTexture(gl.TEXTURE_2D, this._birghtnessFilterBuffer);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 
        width / this._brightnessFilterDownScale, height / this._brightnessFilterDownScale, 
        0, gl.RGBA, gl.FLOAT, null);
      
      gl.bindTexture(gl.TEXTURE_2D, this._depthTex_Bloom2_DownScale);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, 
        width / this._blurDownScale, height / this._blurDownScale, 
        0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);
      
      gl.bindTexture(gl.TEXTURE_2D, this._downScale1Buffer);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 
        width / this._blurDownScale, height / this._blurDownScale, 
        0, gl.RGBA, gl.FLOAT, null);
      
      gl.bindTexture(gl.TEXTURE_2D, this._depthTex_Bloom3_DownScale);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, 
        width / this._blurDownScale, height / this._blurDownScale, 
        0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);
      
      gl.bindTexture(gl.TEXTURE_2D, this._downScale2Buffer);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 
        width / this._blurDownScale, height / this._blurDownScale, 
        0, gl.RGBA, gl.FLOAT, null);
    }//end of resize bloom

    //bloom effect step 4: render all the buffers
    renderBloom(camera){
    //substep1: render original screen frame from g-buffer
    //bind to the fbo
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._fbo_screen);

    //clear frame
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    //use shader program
    gl.useProgram(this._progShadeToTexture.glShaderProgram);

    //light texture as uniform
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._lightTexture.glTexture);
    gl.uniform1i(this._progShadeToTexture, u_lightbuffer, 0);

    //cluster texture
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this._clusterTexture.glTexture);
    gl.uniform1i(this._progShadeToTexture.u_clusterbuffer,1);

        //cluster tile size
    gl.uniform2f(this._progShadeToTexture.u_clusterTileSize, canvas.width / this._xSlices, canvas.height/this._ySlices);
    //nearclip z
    gl.uniform1f(this._progShadeToTexture.u_nearClip,camera.near);
    //depth stride
    gl.uniform1f(this._progShadeToTexture.u_clusterZStride, (camera.far - camera.near) / this._zSlices);
    //view matrix
    gl.uniformMatrix4fv(this._progShadeToTexture.u_viewMatrix, false, this._viewMatrix);

    //inverse view Matrix
    gl.uniformMatrix4fv(this._progShadeToTexture.u_inverseViewMat, false, this._inverseViewMat);
    //inverse viewProj matrix
    gl.uniformMatrix4fv(this._progShadeToTexture.u_inverseViewProjMat, false, this._inverseViewProjMat);

  
    // Bind g-buffers
    //changed: change to 2 since we used texture slot 0~1
    const firstGBufferBinding = 2; // You may have to change this if you use other texture slots
    for (let i = 0; i < NUM_GBUFFERS; i++) {
      gl.activeTexture(gl[`TEXTURE${i + firstGBufferBinding}`]);
      gl.bindTexture(gl.TEXTURE_2D, this._gbuffers[i]);
      gl.uniform1i(this._progShade[`u_gbuffers[${i}]`], i + firstGBufferBinding);
    }

    renderFullscreenQuad(this._progShadeToTexture);

    //substep 2: apply brightness filter
    //note: brightness fb is downscaled by 2
    gl.viewport(0, 0, canvas.width / this._brightnessFilterDownScale, canvas.height / this._brightnessFilterDownScale);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(this._progBrightnessShade.glShaderProgram);

    //bind screen's frame buffer
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, this._screenbuffer);

    gl.uniform1i(this._progBrightnessShade.u_oriScreenBuffer, 4);

    //render to framebeffer
    renderFullscreenQuad(this._progBrightnessShade);

    //substep3: apply horizontal blur
    gl.viewport(0, 0, canvas.width / this._blurDownScale, canvas.height / this._blurDownScale);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._fbo_DownScale1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(this._progHorizontalBlur.glShaderProgram);

     // bind original screen frame buffer
    gl.activeTexture(gl.TEXTURE5); //gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, this._birghtnessFilterBuffer);
    gl.uniform1i(this._progHorizontalBlur.u_texture, 5);
    gl.uniform1f(this._progHorizontalBlur.u_dst_width, this._width / this._brightnessFilterDownScale);
    renderFullscreenQuad(this._progHorizontalBlur);

     //substep4: apply Vertical BLur
    gl.viewport(0, 0, canvas.width / this._blurDownScale, canvas.height / this._blurDownScale);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._fbo_DownScale2);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(this._progVerticalBlur.glShaderProgram);

     // bind original screen frame buffer
    gl.activeTexture(gl.TEXTURE6); //gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, this._downScale1Buffer);
    gl.uniform1i(this._progVerticalBlur.u_texture, 6);
    gl.uniform1f(this._progVerticalBlur.u_dst_height, this._height / this._blurDownScale);
    renderFullscreenQuad(this._progVerticalBlur);

     //substep5. Combine results
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(this._progCombine.glShaderProgram);

     // final step: bind original screen frame buffer
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, this._screenbuffer);
    gl.uniform1i(this._progCombine.u_colorTex, 4);
    gl.activeTexture(gl.TEXTURE7);
    gl.bindTexture(gl.TEXTURE_2D, this._downScale2Buffer);
    gl.uniform1i(this._progCombine.u_brightnessTex, 7);
     renderFullscreenQuad(this._progCombine);
    }//end of renderBloom
//////////////////////////
//End of bloom effect-specified functions
/////////////////////////


  }
  constructor(xSlices, ySlices, zSlices, isBloomOn) {
    super(xSlices, ySlices, zSlices);
    
    this.isBloomEffectOn = isBloomOn;

    if(this.isBloomEffectOn){
      //set downscale ratio be 2.0
      this._brightnessFilterDownScale = 2.0;
      this._blurDownScale = 6.0;
    }

    this.setupDrawBuffers(canvas.width, canvas.height);
    
    // Create a texture to store light data
    this._lightTexture = new TextureBuffer(NUM_LIGHTS, 8);
  //changed: add a uniform variable: u_viewMatrix
    this._progCopy = loadShaderProgram(toTextureVert, toTextureFrag, {
      uniforms: ['u_viewProjectionMatrix', 'u_colmap', 'u_normap', 'u_viewMatrix'],
      attribs: ['a_position', 'a_normal', 'a_uv'],
    });

  //changed: add the numbers of slices just computed in base class
    this._progShade = loadShaderProgram(QuadVertSource, fsSource({
      numLights: NUM_LIGHTS,
      numGBuffers: NUM_GBUFFERS,
      maxNumberLightsPerCluster: MAX_LIGHTS_PER_CLUSTER,
      numXSlices :xSlices,
      numYSlices :ySlices,
      numZSlices :zSlices,
    }), {
    //changed: add new uniforms
    //changed: delete last two gbuffers
      uniforms: ['u_gbuffers[0]', 'u_gbuffers[1]', 
      'u_lightbuffer', 'u_nearClip',
      'u_clusterTileSize','u_clusterZStride',
      'u_viewMatrix', 'u_clusterbuffer',
      'u_inverseViewProjMat', 'u_inverseViewMat'],
      attribs: ['a_uv'],
    });

    this._projectionMatrix = mat4.create();
    this._viewMatrix = mat4.create();
    this._viewProjectionMatrix = mat4.create();
    //changed: add new elements
    this._inverseViewMat = mat4.create();
    this._inverseViewProjMat = mat4.create();

//Bloom effect functions
  if(this.isBloomEffect){
  }
//since the function body is moved to be a new function, just need to call it:
    this.bloomInitialize();
  }

  setupDrawBuffers(width, height) {
    this._width = width;
    this._height = height;

//changed to g-bugger
    this._fbo_gbuffer = gl.createFramebuffer();

    //this._fbo = gl.createFramebuffer();
    
    //Create, bind, and store a depth target texture for the FBO
    this._depthTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this._depthTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, width, height, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

//change to fbo_gbuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._fbo_gbuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this._depthTex, 0);

    let attachments = new Array(NUM_GBUFFERS);

    // Create, bind, and store "color" target textures for the FBO
    this._gbuffers = new Array(NUM_GBUFFERS);
    let attachments = new Array(NUM_GBUFFERS);
    for (let i = 0; i < NUM_GBUFFERS; i++) {
      attachments[i] = WEBGL_draw_buffers[`COLOR_ATTACHMENT${i}_WEBGL`];
      this._gbuffers[i] = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this._gbuffers[i]);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.FLOAT, null);
      gl.bindTexture(gl.TEXTURE_2D, null);

      gl.framebufferTexture2D(gl.FRAMEBUFFER, attachments[i], gl.TEXTURE_2D, this._gbuffers[i], 0);      
    }

    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) != gl.FRAMEBUFFER_COMPLETE) {
      throw "Framebuffer incomplete";
    }

    // Tell the WEBGL_draw_buffers extension which FBO attachments are
    // being used. (This extension allows for multiple render targets.)
    WEBGL_draw_buffers.drawBuffersWEBGL(attachments);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
//bloom effect FBOs
    if(this.isBloomEffect){
//similarly, call the function
      this.setupDrawBuffersBloom(width, height);
  }

  resize(width, height) {
    this._width = width;
    this._height = height;

    gl.bindTexture(gl.TEXTURE_2D, this._depthTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, width, height, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);
    for (let i = 0; i < NUM_GBUFFERS; i++) {
      gl.bindTexture(gl.TEXTURE_2D, this._gbuffers[i]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.FLOAT, null);
    }

// need to resize bloom effect FBOs
    if(this.isBloomEffect){
  //call resizebloom function
      this.resizeBloomBuffer(width, height);
  }
    gl.bindTexture(gl.TEXTURE_2D, null);
    }


  render(camera, scene) {
    if (canvas.width != this._width || canvas.height != this._height) {
      this.resize(canvas.width, canvas.height);
    }

    // Update the camera matrices
    camera.updateMatrixWorld();
    mat4.invert(this._viewMatrix, camera.matrixWorld.elements);
    mat4.copy(this._projectionMatrix, camera.projectionMatrix.elements);
    mat4.multiply(this._viewProjectionMatrix, this._projectionMatrix, this._viewMatrix);

    //changed: add new uniforms
    mat4.invert(this._inverseViewMat, this._viewMatrix);
    mat4.invert(this._inverseViewProjMat, this._viewProjectionMatrix);

    // Render to the whole screen
    gl.viewport(0, 0, canvas.width, canvas.height);

    // Bind the framebuffer
//changed: bind to g-buffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._fbo_gbuffer);

    // Clear the frame
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Use the shader program to copy to the draw buffers
    gl.useProgram(this._progCopy.glShaderProgram);

    // Upload the camera matrix
    gl.uniformMatrix4fv(this._progCopy.u_viewProjectionMatrix, false, this._viewProjectionMatrix);

    //changed: add the viewMatrix uniform
    gl.uniformMatrix4fv(this._progCopy.u_viewMatrix, false, this._viewMatrix);


    // Draw the scene. This function takes the shader program so that the model's textures can be bound to the right inputs
    scene.draw(this._progCopy);
    
    // Update the buffer used to populate the texture packed with light data
    for (let i = 0; i < NUM_LIGHTS; ++i) {
      this._lightTexture.buffer[this._lightTexture.bufferIndex(i, 0) + 0] = scene.lights[i].position[0];
      this._lightTexture.buffer[this._lightTexture.bufferIndex(i, 0) + 1] = scene.lights[i].position[1];
      this._lightTexture.buffer[this._lightTexture.bufferIndex(i, 0) + 2] = scene.lights[i].position[2];
      this._lightTexture.buffer[this._lightTexture.bufferIndex(i, 0) + 3] = scene.lights[i].radius;

      this._lightTexture.buffer[this._lightTexture.bufferIndex(i, 1) + 0] = scene.lights[i].color[0];
      this._lightTexture.buffer[this._lightTexture.bufferIndex(i, 1) + 1] = scene.lights[i].color[1];
      this._lightTexture.buffer[this._lightTexture.bufferIndex(i, 1) + 2] = scene.lights[i].color[2];
    }
    // Update the light texture
    this._lightTexture.update();

    // Update the clusters for the frame
    this.updateClusters(camera, this._viewMatrix, scene);

//use g-buffer to render
    if(!this.isBloomEffect){
          // Bind the default null framebuffer which is the screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        // Clear the frame
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Use this shader program
    gl.useProgram(this._progShade.glShaderProgram);
    

    // TODO: Bind any other shader inputs
    //light texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._lightTexture.glTexture);
    gl.uniform1i(this._progShade.u_lightbuffer,0);

    //cluster texture
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this._clusterTexture.glTexture);
    gl.uniform1i(this._progShade.u_clusterbuffer,1);

    //cluster tile size
    gl.uniform2f(this._progShade.u_clusterTileSize, canvas.width / this._xSlices, canvas.height/this._ySlices);
    //nearclip z
    gl.uniform1f(this._progShade.u_nearClip,camera.near);
    //depth stride
    gl.uniform1f(this._progShade.u_clusterZStride, (camera.far - camera.near) / this._zSlices);
    //view matrix
    gl.uniformMatrix4fv(this._progShade.u_viewMatrix, false, this._viewMatrix);

    //inverse view Matrix
    gl.uniformMatrix4fv(this._progShade.u_inverseViewMat, false, this._inverseViewMat);
    //inverse viewProj matrix
    gl.uniformMatrix4fv(this._progShade.u_inverseViewProjMat, false, this._inverseViewProjMat);

    // Bind g-buffers
    //changed: change to 2 since we used texture slot 0~1
    const firstGBufferBinding = 2; // You may have to change this if you use other texture slots
    for (let i = 0; i < NUM_GBUFFERS; i++) {
      gl.activeTexture(gl[`TEXTURE${i + firstGBufferBinding}`]);
      gl.bindTexture(gl.TEXTURE_2D, this._gbuffers[i]);
      gl.uniform1i(this._progShade[`u_gbuffers[${i}]`], i + firstGBufferBinding);
    }

    renderFullscreenQuad(this._progShade);
  }//end if

//If bloom effect is toggled on, Render bloom effect
  else{
    //call bloom render function here
    this.renderBloom(camera);
  }//end else: bloom effect on

  
}

};
