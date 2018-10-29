export default function(params) {
  return `
  #version 100
  precision highp float;
  
  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  
  uniform sampler2D u_lightbuffer;
  uniform sampler2D u_clusterbuffer;

  uniform mat4 u_viewMatrix;
  uniform mat4 u_viewInvMatrix;
  uniform mat4 u_viewProjInvMatrix;

  uniform float u_screenWidth;
  uniform float u_screenHeight;
  uniform float u_cameraFar;
  uniform float u_cameraNear;

  const int numxSlices = int(${params.numxSlices});
  const int numySlices = int(${params.numySlices});
  const int numzSlices = int(${params.numzSlices});
  const int numMaxLightsPerCluster = int(${params.numMaxLightPerCluster});


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
    // TODO: extract data from g buffers and do lighting

    vec3 albedo     = texture2D(u_gbuffers[0], v_uv).xyz;
    vec3 v_position = texture2D(u_gbuffers[1], v_uv).xyz;
    vec3 normal     = texture2D(u_gbuffers[2], v_uv).xyz;
    vec3 fragColor = vec3(0.0);
    vec4 viewPos = u_viewMatrix * vec4(v_position, 1.0);
    float zInterval = (u_cameraFar - u_cameraNear) / float(numzSlices); 
    int z = int((-viewPos.z - u_cameraNear) / zInterval);
    float xInterval = float(u_screenWidth) / float(numxSlices);
    int x = int(gl_FragCoord.x / xInterval);
    float yInterval = float(u_screenHeight) / float(numySlices);
    int y = int(gl_FragCoord.y / yInterval);
    int index = x + y * numxSlices + z * numxSlices * numySlices;
    float uCoord = float(index + 1) / float(numxSlices * numySlices * numzSlices + 1);
    int lightCount = int(texture2D(u_clusterbuffer, vec2(uCoord, 0.0))[0]);
    int TexelsinColumn = int(float(numMaxLightsPerCluster + 1) / 4.0) + 1;
    for(int index = 0; index < numMaxLightsPerCluster; ++index)
    {
      if(index + 1 > lightCount)
      {
        break;
      }


      // ============================ Basic Lambert ============================ 
      int pixel = (index + 1) / 4;
      float vCoord = float(pixel + 1) / float(TexelsinColumn + 1);
      vec4 clusterTexel = texture2D(u_clusterbuffer, vec2(uCoord, vCoord));
      int lightIndex;
      int component = (index + 1) - 4 * pixel;
      if (component == 0)      
        lightIndex = int(clusterTexel[0]);      
      else if (component == 1)     
        lightIndex = int(clusterTexel[1]);      
      else if (component == 2)      
        lightIndex = int(clusterTexel[2]);
      else if (component == 3)
        lightIndex = int(clusterTexel[3]);
      Light light = UnpackLight(lightIndex);
      float lightDistance = distance(light.position, v_position);
      vec3 L = (light.position - v_position) / lightDistance;
      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);
      fragColor += albedo * lambertTerm  * light.color * vec3(lightIntensity);

      // ============================ blinn-phong ============================ 
      // vec3 specColor = vec3(1.0);
      // vec3 V = -normalize(vec3(viewPos));
      // vec3 H = normalize(L + V);
      // float dotNL = max(dot(normal, L), 0.0);
      // float specularTerm = pow(max(dot(H, normal), 0.0), 1.0);
      // fragColor += (albedo * lambertTerm + dotNL * specColor * specularTerm) * light.color * vec3(lightIntensity);


      // ============================ cel shading ============================ 
      // float numShades = 2.0;
      // float celIntensity = ceil(lambertTerm * numShades) / numShades;
      // lambertTerm *= celIntensity;
      // fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);

    }
    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;
    // gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
    // gl_FragColor = vec4(v_position, 1.0);
    // gl_FragColor = vec4(normal, 1.0);
    // gl_FragColor = vec4(u_screenWidth, u_screenWidth, u_screenWidth, 1.0);
    // gl_FragColor = viewPos;
    // gl_FragColor = vec4(v_uv, 0.0,  1.0);
    gl_FragColor = vec4(fragColor, 1.0);
    // gl_FragColor = vec4(vec3(v_position.z / (u_cameraFar - u_cameraNear)), 1.0);
    // gl_FragColor = vec4(abs(vec3(v_position.z)) / 10.0, 1.0);


  }
  `;
}