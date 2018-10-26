//CombineFragmentbuffer.frag.glsl
#version 100
precision highp float;

uniform sampler2D u_colorTex;
uniform sampler2D u_brightnessTex;

varying vec2 v_uv;

void main(){
	
	vec3 fragColor = vec3(0.0);

	vec3 sceneCol = texture2D(u_colorTex , v_uv),rgb;
	vec3 brightnessCol = texture2D(u_brightnessTex, v_uv).rgb;

	gl_FragColor = vec4(0.8 * sceneCol + 2.5 * brightnessCol, 1.0);
	
}