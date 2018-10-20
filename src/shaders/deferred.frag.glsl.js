export default function(params) {
  return `
  #version 100
  precision highp float;
  
  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  
  uniform sampler2D u_clusterbuffer;
  uniform sampler2D u_lightbuffer;
  
  uniform mat4 u_viewMatrix;
  uniform float u_cameraNear;
  uniform float u_cameraFar;
  uniform vec3 u_cameraPos;
  
  varying vec2 v_uv;
  
  struct Light {
    vec3 position;
    float radius;
    vec3 color;
  };
  
  Light UnpackLight(int index) {
    Light light;
    float u = float(index + 1) / float(${params.numLights + 1});
    vec4 v1 = texture2D(u_lightbuffer, vec2(u, 0.3));
    vec4 v2 = texture2D(u_lightbuffer, vec2(u, 0.6));
    light.position = v1.xyz;

    // LOOK: This extracts the 4th float (radius) of the (index)th light in the buffer
    // Note that this is just an example implementation to extract one float.
    // There are more efficient ways if you need adjacent values
    light.radius = ExtractFloat(u_lightbuffer, ${params.numLights}, 2, index, 3);

    light.color = v2.rgb;
    return light;
  }
  
  // Cubic approximation of gaussian curve so we falloff to exactly 0 at the light radius
  float cubicGaussian(float h) {
    if (h < 1.0) {
      return 0.25 * pow(2.0 - h, 3.0) - pow(1.0 - h, 3.0);
    } else if (h < 2.0) {
      return 0.25 * pow(2.0 - h, 3.0);
    } else {
      return 0.0;
    }
  }
  
  void main() {
    // TODO: extract data from g buffers and do lighting
    vec4 gb0 = texture2D(u_gbuffers[0], v_uv);
    vec4 gb1 = texture2D(u_gbuffers[1], v_uv);
    
    vec3 v_pos = gb0.xyz;
    vec3 albedo = gb1.rgb;
    float theta = gb0[3];
    float phi = gb1[3];
    vec3 norm = vec3(cos(phi)*cos(theta), cos(phi) * sin(theta), sin(phi));
    
    vec4 pos = u_viewMatrix * vec4(v_position, 1.0);
    int x_cluster = int(gl_FragCoord.x * float(${params.xSlices}) / float(${params.width}));
    int y_cluster = int(gl_FragCoord.y * float(${params.ySlices}) / float(${params.height}));
    int z_cluster = 0;
    if (-pos.z > u_cameraNear){
      z_clutser = int((-pos.z -u_cameraNear)* float(${params.zSlices}) / float(u_cameraFar - u_cameraNear));
    }
    
    int index = x_cluster + y_cluster * ${params.xSlices} + z * ${params.xSlices} * ${params.ySlices};
    float u = float(index + 1)/float(${params.xSlices} * ${params.ySlices} * ${params.zSlices} + 1);
    int num_clustered = int (texture2D(u_clusterbuffer, vec2(u, 0.0))[0]);
    vec3 specular = vec3(1.0);
    vec3 ambientColor = vec3(0.9);
   
    for (int i = 0; i < ${params.numLights}; ++i) {
    // a lot of offset of 1 errors !!
      if (i >= num_clustered) break;
      int V = int((${params.maxLightPerCluster} + 1)/4 + 1);
      int vi = int((i+1)/4);
      // only this way can get the correct fraction
      float v = float(vi)/ float(V);
      vec4 pixel = texture2D(u_clusterbuffer, vec2(u,v));
      int offset = i + 1 - idx;
      int idx;
      if (offset == 0){
        idx = int(pixel[0]);
      }else if (offset == 1){
        idx = int(pixel[1]);
      }else if (offset == 2){
        idx = int(pixel[2]);
      }else if (offset == 3){
        idx = int(pixel[3]);
      }
      
      Light light = UnpackLight(idx);
      float lightDistance = distance(light.position, v_position);
      vec3 L = (light.position - v_position) / lightDistance;
      vec3 eyeDir = normalize(u_cameraPos - v_position);

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);
      
      specular *= pow(max(dot(normalize(L + eyeDir), norm), 0), 16.0);
      
      fragColor += pow(vec3(lightIntensity) * ambientColor * light.color(0.1 + albedo * lambertian + specular), 1.0/2.2);

             
      //fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);
    }
    
    gl_FragColor = vec4(fragColor, 1.0);
    //gl_FragColor = vec4(v_uv, 0.0, 1.0);
  }
  `;
}