export default function(params) {
    return `
  #version 100
  precision highp float;
  
  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  
  uniform sampler2D u_clusterbuffer;
  uniform sampler2D u_lightbuffer;
  
  uniform mat4 u_camera_view_mat;
  uniform float u_camera_near;
  uniform float u_camera_far;
  uniform vec3 u_camera_pos;
  
  varying vec2 v_uv;
  
  struct Light {
    vec3 position;
    float radius;
    vec3 color;
  };
  
  float ExtractFloat(sampler2D texture, int textureWidth, int textureHeight, int index, int component) {
    float u = float(index + 1) / float(textureWidth + 1);
    int pixel = component / 4;
    float v = float(pixel + 1) / float(textureHeight + 1);
    vec4 texel = texture2D(texture, vec2(u, v));
    int pixelComponent = component - pixel * 4;
    if (pixelComponent == 0) {
      return texel[0];
    } else if (pixelComponent == 1) {
      return texel[1];
    } else if (pixelComponent == 2) {
      return texel[2];
    } else if (pixelComponent == 3) {
      return texel[3];
    }
  }
  
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
    vec4 gb0 = texture2D(u_gbuffers[0], v_uv);
    vec4 gb1 = texture2D(u_gbuffers[1], v_uv);
    
    vec3 v_position = gb0.xyz;
    vec3 albedo = gb1.rgb;
    float theta = gb0[3];
    float phi = gb1[3];
    vec3 normal = vec3(cos(phi)*cos(theta), cos(phi) * sin(theta), sin(phi));
    
    vec4 fragment_pos = u_camera_view_mat * vec4(v_position, 1.0);
    int x = int(gl_FragCoord.x * float(${params.xSlices}) / float(${params.width}));
    int y = int(gl_FragCoord.y * float(${params.ySlices}) / float(${params.height}));
    int z = 0;
    if (-fragment_pos.z > u_camera_near){
      z = int((-fragment_pos.z - u_camera_near) / (float(u_camera_far - u_camera_near) / float(${params.zSlices})));
    }
    
    int index = x + y * ${params.xSlices} + z * ${params.xSlices} * ${params.ySlices};
    float ratio = float(index + 1)/float(${params.xSlices} * ${params.ySlices} * ${params.zSlices} + 1);
    int num_clustered = int (texture2D(u_clusterbuffer, vec2(ratio, 0.0)).r);
    int fragment_count = int((${params.maxLightPerCluster} + 1) / 4) + 1;
    vec3 specular = vec3(1.0);
    vec3 ambientColor = vec3(0.8);
    vec3 fragColor = vec3(0.0);
   
    for (int i = 0; i < ${params.numLights}; ++i) {
      if (i >= num_clustered) {
        break;
      }
      
      int index_1 = int((i+1)/4);
      float ratio_1 = float(index_1)/ float(fragment_count);
      vec4 element = texture2D(u_clusterbuffer, vec2(ratio,ratio_1));
      int pos = i + 1 - 4 * index_1;
      int idx;
      if (pos == 0){
        idx = int(element[0]);
      }else if (pos == 1){
        idx = int(element[1]);
      }else if (pos == 2){
        idx = int(element[2]);
      }else if (pos == 3){
        idx = int(element[3]);
      }

      Light light = UnpackLight(idx);
      float lightDistance = distance(light.position, v_position);
      vec3 L = (light.position - v_position) / lightDistance;
      vec3 eye_dir = normalize(u_camera_pos - v_position);

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);

      specular *= pow(max(dot(normalize(L + eye_dir), normal), 0.0), 10.0);

      //fragColor += vec3(lightIntensity) * ambientColor * light.color * (0.1 + albedo * lambertTerm + specular);


      fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);
    }
    
    gl_FragColor = vec4(fragColor, 1.0);
    //gl_FragColor = vec4(v_uv, 0.0, 1.0);
  }
  `;
}