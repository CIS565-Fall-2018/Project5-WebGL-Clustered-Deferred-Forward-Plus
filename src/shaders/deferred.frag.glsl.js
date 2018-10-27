export default function(params) {
  return `
  #version 100
  precision highp float;
  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  
  uniform mat4 u_viewMatrix;
  uniform mat4 u_invViewMatrix;
  uniform vec2 u_cameraClip;
  uniform vec2 u_canvasSize;
  uniform sampler2D u_lightbuffer;
  uniform sampler2D u_clusterbuffer;
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

  int xSlices = int(${params.numXSlices});
  int ySlices = int(${params.numYSlices});
  int zSlices = int(${params.numZSlices});
  
  void main() {
    // TODO: extract data from g buffers and do lighting
    vec4 gBufferCol = texture2D(u_gbuffers[0], v_uv);
    vec4 gBufferPos = texture2D(u_gbuffers[1], v_uv);
    vec4 gBufferNorm = texture2D(u_gbuffers[2], v_uv); 
    vec3 albedo = gBufferCol.rgb;
    vec3 normal = gBufferNorm.xyz;
    vec3 v_position = gBufferPos.xyz;
    vec3 fragColor = vec3(0.0);
    int numClusters = xSlices * ySlices * zSlices;
    vec4 pos_screen = vec4(gl_FragCoord.xyz, 1.0);
    vec4 pos_camera = u_viewMatrix * vec4(v_position, 1.0);
    pos_camera /= pos_camera[3];
    // Compute cluster index for the fragment.
    int xIdx = int(pos_screen[0]/u_canvasSize[0] * float(xSlices));
    int yIdx = int(pos_screen[1]/u_canvasSize[1] * float(ySlices));
    int zIdx = int((- pos_camera.z - u_cameraClip[0]) / float(u_cameraClip[1] - u_cameraClip[0]) * float(zSlices)); 
    int clusterIdx = xIdx + yIdx * zSlices + zIdx * xSlices * ySlices;
    vec2 uv_clustercount = vec2(float(clusterIdx + 1) / float(numClusters + 1), 0.0);
    int lightCount = int(texture2D(u_clusterbuffer, uv_clustercount)[0]);
    const int maxLights = ${params.numLights};
    for (int i = 1; i <= maxLights; ++i) {
      if (lightCount < i)
      {
        break;
      }
      float u = uv_clustercount[0];
      float v = float(i / 4 + 1) / ceil((float(${params.maxLights_perCluster}) + 1.0) / 4.0 + 1.0);
      vec4 clusterTexture = texture2D(u_clusterbuffer, vec2(u, v));
      
      int lightIdx;
      int remainder = i - 4 * (i / 4);
      if (remainder == 0) {      
        lightIdx = int(clusterTexture[0]);
      }      
      else if (remainder == 1) {    
        lightIdx = int(clusterTexture[1]);
      }      
      else if (remainder == 2) {      
        lightIdx = int(clusterTexture[2]);
      }
      else if (remainder == 3) {
        lightIdx = int(clusterTexture[3]);
      }
      else {    
        continue;
      }
      Light light = UnpackLight(lightIdx);
      float lightDistance = distance(light.position, v_position);
      vec3 L = (light.position - v_position) / lightDistance;
      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);
      //Blinn-phong
      vec4 view_pos = u_invViewMatrix[3];      
      vec3 V = normalize(view_pos.xyz - v_position);
      vec3 H = normalize(L + V);
      float specular = max(dot(H, normal), 0.0);
      float speculatTerm = pow(specular, 100.0);      
      fragColor += (albedo + vec3(speculatTerm)) * lambertTerm * light.color * lightIntensity;
    }
    
    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;
    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}