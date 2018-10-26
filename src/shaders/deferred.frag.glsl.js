export default function(params) {
  return `
  #version 100
  precision highp float;

  #define PI 3.1415962

  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  uniform sampler2D u_lightbuffer;
  uniform sampler2D u_clusterbuffer;
  uniform vec2 u_screendimension;
  uniform vec2 u_cameraclip;
  uniform mat4 u_viewMatrix;
  uniform mat4 u_viewInvMatrix;
  uniform mat4 u_viewProjInvMatrix;

  varying vec2 v_uv;

  const int numXSlices = int(${params.numXSlices});
  const int numYSlices = int(${params.numYSlices});
  const int numZSlices = int(${params.numZSlices});
  const int numSlices = numXSlices * numYSlices * numZSlices;
  const int maxLightsPerCluster = int(${params.maxLightsPerCluster});

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
    
    /*
    // TODO: extract data from g buffers and do lighting
    vec4 gb0 = texture2D(u_gbuffers[0], v_uv);
    vec4 gb1 = texture2D(u_gbuffers[1], v_uv);
    vec4 gb2 = texture2D(u_gbuffers[2], v_uv);

    vec3 albedo = gb0.rgb;
    vec3 pos = gb1.xyz; // world position
    vec3 normal = gb2.xyz;
    vec3 vpos = (u_viewMatrix * vec4(pos, 1.0)).xyz; // camera space position
    */

    //optimization
    vec4 gb0 = texture2D(u_gbuffers[0], v_uv);
    vec4 gb1 = texture2D(u_gbuffers[1], v_uv);

    vec3 albedo = gb0.rgb;
    vec3 normal = gb1.xyz;
    float posz_ndc = gb0.w; // camera space z
    float posz_v = gb1.w;

    vec4 screenpos = vec4(v_uv * 2.0 - vec2(1.0), posz_ndc, 1.0);
    vec4 pos = u_viewProjInvMatrix * screenpos;
    pos /= pos.w;

    vec4 vpos = u_viewMatrix * pos;
  
    vec3 fragColor = vec3(0.0);

    float xstep = u_screendimension[0] / float(numXSlices);
    float ystep = u_screendimension[1] / float(numYSlices);
    float zstep = (u_cameraclip[1] - u_cameraclip[0]) / float(numZSlices);

    int x = int(gl_FragCoord.x / xstep);
    int y = int(gl_FragCoord.y / ystep);
    int z = int((- vpos[2] - u_cameraclip[0]) / zstep); //uniform

    int cIndex = x + y * numXSlices + z * numXSlices * numYSlices;
    float u = float(cIndex + 1) / float(numSlices + 1);
    int lightCount = int(texture2D(u_clusterbuffer, vec2(u, 0.0))[0]);
    int clusterColNum = int(float(maxLightsPerCluster + 1) / 4.0) + 1;

    //Read in the lights in that cluster from the populated data
    //Do shading for just those lights
    for(int i = 0; i < maxLightsPerCluster; ++i) {
      if(i > lightCount - 1) break;
      
      float v = float((i + 1) / 4 + 1) / float(clusterColNum + 1);
      int lightId = int(texture2D(u_clusterbuffer, vec2(u, v))[(i + 1) - 4 * ((i + 1) / 4)]);

      Light light = UnpackLight(lightId);
      float lightDistance = distance(light.position, pos.xyz);
      vec3 L = (light.position - pos.xyz) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);

      fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);
    
      // Blinn-Phong shading
      
      /*
      vec3 specColor = vec3(1.0);
      vec3 V = -normalize(vpos.xyz);
      vec3 H = normalize(L + V);
      float specularTerm = pow(max(dot(H, normal), 0.0), 10.0);
      fragColor += (specColor * specularTerm) * light.color * vec3(lightIntensity);
      */
      
    
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);

  }
  `;
}