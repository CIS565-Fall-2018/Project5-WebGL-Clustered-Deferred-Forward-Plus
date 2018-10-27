export default function(params) {
    return `
#version 100
precision highp float;

uniform sampler2D u_gbuffers[${params.numGBuffers}];

varying vec2 v_uv;

void main() {

  vec3 fragCol = texture2D(u_gbuffers[0], v_uv).rgb;
  gl_FragColor = vec4(fragCol, 1.0);

}
  `;
}