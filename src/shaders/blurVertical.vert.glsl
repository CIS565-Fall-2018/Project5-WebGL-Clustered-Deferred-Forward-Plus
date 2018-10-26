//blurVertical.vert.glsl
#version 100
precision highp float;

uniform float u_dst_height;

attribute vec3 a_position;

varying vec2 blurTexureCoords[11];

void main(){
	gl_Position = vec4(a_position, 1.0);

	vec2 centerTexCoords = a_position.xy * 0.5 + 0.5;

	float pixelSize = 1.0/u_dst_height;

	for(int i = -5; i < = 5; i++){
	blurTexureCoords[i + 5] = centerTexCoords + vec2(0.0, pixelSize * float(i));
	}
}