#version 100
#extension GL_EXT_draw_buffers: enable

precision highp float;
uniform sampler2D u_oriScreenBuffer;

varying vec2 v_uv;

void main(){
	vec3 screenCol = vec3(texture2D(u_oriScreenBuffer, v_uv));

	float brightness = screenCol.r * 0.2126 + screenCol.g * 0.7152 + screenCol.b * 0.0722;

	screenCol = brightness * screenCol;

	//gl_FragColor = vec4(screenCol, 1.0);
	//render to FBO
	gl_FragData[0] = vec4(screenCol, 1.0);
}