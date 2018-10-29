import {canvas, gl, WEBGL_draw_buffers} from '../init';
import { mat4, vec4, vec3 } from 'gl-matrix';
import {loadShaderProgram, renderFullscreenQuad} from '../utils';
import { NUM_LIGHTS } from '../scene';
import toTextureVert from '../shaders/quad.vert.glsl';
import toTextureFrag from '../shaders/gpuBinningToTexture.frag.glsl.js';
import vsSource from '../shaders/gpuBinning.vert.glsl';
import fsSource from '../shaders/gpuBinning.frag.glsl.js';
import TextureBuffer from './textureBuffer';

export const MAX_LIGHTS_PER_CLUSTER = NUM_LIGHTS;
export const NUM_GBUFFERS = 1;

export default class GpuBinningRenderer {
    constructor(xSlices, ySlices, zSlices, camera) {

        this._xSlices = xSlices;
        this._ySlices = ySlices;
        this._zSlices = zSlices;

        this._clusterTextureWidth = xSlices * ySlices * zSlices;
        this._clusterTextureHeight = Math.ceil(MAX_LIGHTS_PER_CLUSTER/4);

        this.setupDrawBuffers(this._clusterTextureWidth, this._clusterTextureHeight);

        // Create a texture to store light data
        this._lightTexture = new TextureBuffer(NUM_LIGHTS, 8);

        this._progCopy = loadShaderProgram(toTextureVert, toTextureFrag({
            numLights: NUM_LIGHTS,
            clusterX: xSlices,
            clusterY: ySlices,
            clusterZ: zSlices
        }), {
            uniforms: ['u_viewMatrix', 'u_lightbuffer', 'xstart', 'xend', 'xstep', 'ystart', 'yend', 'ystep', 'zstart', 'zend', 'zstep'],
            attribs: ['a_position'],
        });

        this._progShade = loadShaderProgram(vsSource, fsSource({
            numLights: NUM_LIGHTS,
            numGBuffers: NUM_GBUFFERS,
            clusterX: xSlices,
            clusterY: ySlices,
            clusterZ: zSlices
        }), {
            uniforms: ['u_gbuffers[0]', 'u_viewProjectionMatrix', 'u_viewMatrix', 'u_colmap', 'u_normap', 'u_lightbuffer', 'nearClipPlane', 'farClipPlane', 'camX', 'camY', 'camZ'],
            attribs: ['a_position', 'a_normal', 'a_uv'],
        });

        this._projectionMatrix = mat4.create();
        this._viewMatrix = mat4.create();
        this._viewProjectionMatrix = mat4.create();
    }

    setupDrawBuffers(width, height) {

        this._fbo = gl.createFramebuffer();

        //Create, bind, and store a depth target texture for the FBO
        // NOT NEEDED
        this._depthTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this._depthTex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, width, height, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);
        gl.bindTexture(gl.TEXTURE_2D, null);

        gl.bindFramebuffer(gl.FRAMEBUFFER, this._fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this._depthTex, 0);

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
    }

    render(camera, scene) {
        // Update the camera matrices
        camera.updateMatrixWorld();
        mat4.invert(this._viewMatrix, camera.matrixWorld.elements);
        mat4.copy(this._projectionMatrix, camera.projectionMatrix.elements);
        mat4.multiply(this._viewProjectionMatrix, this._projectionMatrix, this._viewMatrix);

        // Update the buffer used to populate the texture packed with light data
        for (let i = 0; i < NUM_LIGHTS; ++i) {
            this._lightTexture.buffer[this._lightTexture.bufferIndex(i, 0)] = scene.lights[i].position[0];
            this._lightTexture.buffer[this._lightTexture.bufferIndex(i, 1)] = scene.lights[i].position[1];
            this._lightTexture.buffer[this._lightTexture.bufferIndex(i, 2)] = scene.lights[i].position[2];
            this._lightTexture.buffer[this._lightTexture.bufferIndex(i, 3)] = scene.lights[i].radius;

            this._lightTexture.buffer[this._lightTexture.bufferIndex(i, 4)] = scene.lights[i].color[0];
            this._lightTexture.buffer[this._lightTexture.bufferIndex(i, 5)] = scene.lights[i].color[1];
            this._lightTexture.buffer[this._lightTexture.bufferIndex(i, 6)] = scene.lights[i].color[2];
        }
        // Update the light texture
        this._lightTexture.update();


        ////////////////////////////////////////////////
        // copy & paste from three.module.js line #11280
        //console.log("zoom:" + camera.zoom);
        let near = camera.near;
        let far = camera.far;
        let top = near * Math.tan(Math.PI / 180 * 0.5 * camera.fov ) / camera.zoom;
        let height = 2 * top;
        let width = camera.aspect * height;
        let left = - 0.5 * width;
        let view = camera.view;
        if ( view !== null ) {
            //console.log("view:" + view.fullWidth + "," + view.fullHeight);
            let fullWidth = view.fullWidth, fullHeight = view.fullHeight;
            left += view.offsetX * width / fullWidth;
            top -= view.offsetY * height / fullHeight;
            width *= view.width / fullWidth;
            height *= view.height / fullHeight;
        }
        let skew = camera.filmOffset;
        if ( skew !== 0 ) left += near * skew / camera.getFilmWidth();
        // copy & paste over
        ////////////////////

        let xstart = left, xend = left + width, xstep = (xend - xstart)/this._xSlices;
        let ystart = top - height, yend = top, ystep = (yend - ystart)/this._ySlices;
        let zstart = -near, zend = -far, zstep = (zend - zstart)/this._zSlices;

        // Bind the framebuffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, this._fbo);
        // IMPORTANT!!!
        gl.viewport(0, 0, this._clusterTextureWidth, this._clusterTextureHeight);
        // Clear the frame
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        // Use the shader program to copy to the draw buffers
        gl.useProgram(this._progCopy.glShaderProgram);
        // Upload the camera matrix
        gl.uniformMatrix4fv(this._progCopy.u_viewMatrix, false, this._viewMatrix);//me
        // Set the light texture as a uniform input to the shader
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, this._lightTexture.glTexture);
        gl.uniform1i(this._progCopy.u_lightbuffer, 2);
        //other stuff
        gl.uniform1f(this._progCopy.xstart, xstart);
        gl.uniform1f(this._progCopy.xend, xend);
        gl.uniform1f(this._progCopy.xstep, xstep);
        gl.uniform1f(this._progCopy.ystart, ystart);
        gl.uniform1f(this._progCopy.yend, yend);
        gl.uniform1f(this._progCopy.ystep, ystep);
        gl.uniform1f(this._progCopy.zstart, zstart);
        gl.uniform1f(this._progCopy.zend, zend);
        gl.uniform1f(this._progCopy.zstep, zstep);

        renderFullscreenQuad(this._progCopy);

        ///////////////////////////////////////////////////////////////////////////
        // First Pass Ends, Second Pass Starts
        ///////////////////////////////////////////////////////////////////////////

        // Bind the default null framebuffer which is the screen
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        // Render to the whole screen
        gl.viewport(0, 0, canvas.width, canvas.height);

        // Clear the frame
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Use this shader program
        gl.useProgram(this._progShade.glShaderProgram);

        // Upload the camera matrix
        gl.uniformMatrix4fv(this._progShade.u_viewProjectionMatrix, false, this._viewProjectionMatrix);

        //me
        gl.uniform1f(this._progShade.nearClipPlane, camera.near);
        gl.uniform1f(this._progShade.farClipPlane, camera.far);
        gl.uniform1f(this._progShade.camX, camera.position.x);
        gl.uniform1f(this._progShade.camY, camera.position.y);
        gl.uniform1f(this._progShade.camZ, camera.position.z);
        gl.uniformMatrix4fv(this._progShade.u_viewMatrix, false, this._viewMatrix);

        // Set the light texture as a uniform input to the shader
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, this._lightTexture.glTexture);
        gl.uniform1i(this._progShade.u_lightbuffer, 2);

        // Bind g-buffers
        const firstGBufferBinding = 4; // You may have to change this if you use other texture slots
        for (let i = 0; i < NUM_GBUFFERS; i++) {
            gl.activeTexture(gl[`TEXTURE${i + firstGBufferBinding}`]);
            gl.bindTexture(gl.TEXTURE_2D, this._gbuffers[i]);
            gl.uniform1i(this._progShade[`u_gbuffers[${i}]`], i + firstGBufferBinding);
        }

        // Draw the scene. This function takes the shader program so that the model's textures can be bound to the right inputs
        scene.draw(this._progShade);
    }

};