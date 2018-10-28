export default function(params) {
  return `
  #version 100
  precision highp float;
  
  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  uniform mat4 u_viewMatrix;
  uniform mat4 u_inverseViewMatrix;
  uniform float u_screenWidth;
  uniform float u_screenHeight;
  uniform float u_nearClip;
  uniform float u_farClip;
  uniform int u_xSlices;
  uniform int u_ySlices;
  uniform int u_zSlices;
  uniform int u_maxLightsPerCluster;
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
  
  void main() {
    // TODO: extract data from g buffers and do lighting
    vec4 gb0 = texture2D(u_gbuffers[0], v_uv);
    vec4 gb1 = texture2D(u_gbuffers[1], v_uv);
    //vec4 gb2 = texture2D(u_gbuffers[2], v_uv);

    vec3 v_position = gb0.rgb;
    vec3 albedo = gb1.rgb;
    vec3 normal = vec3(gb0.a, gb1.a, 0.0);
    normal.z = sqrt(1.0 - (normal.x * normal.x) - (normal.y * normal.y));
    normal = normalize(normal);
    normal = vec3(u_inverseViewMatrix * vec4(normal, 0.0));
    //vec3 normal = gb2.rgb;

    vec4 fragViewPos = u_viewMatrix * vec4(v_position, 1.0);
    fragViewPos.z = -1.0 * fragViewPos.z;

    int cluster_x = int(gl_FragCoord.x * float(u_xSlices) / u_screenWidth);
    int cluster_y = int(gl_FragCoord.y * float(u_ySlices) / u_screenHeight);
    int cluster_z = int((fragViewPos - u_nearClip) * float(u_zSlices) / (u_farClip - u_nearClip));
    int cluster_idx = cluster_x + cluster_y * u_xSlices + cluster_z * u_xSlices * u_ySlices;
    int num_clusters = u_xSlices * u_ySlices * u_zSlices;
    int clusterNumLights = int(ExtractFloat(u_clusterbuffer, ${params.clusterTextureWidth}, ${params.clusterTextureHeight}, cluster_idx, 0));

    vec3 fragColor = vec3(0.0);

    for(int i = 1; i < ${params.clusterTextureHeight} * 4 - 1; ++i) {
      if (i > clusterNumLights) break;
      int light_idx = int(ExtractFloat(u_clusterbuffer, ${params.clusterTextureWidth}, ${params.clusterTextureHeight}, cluster_idx, i));
      Light light = UnpackLight(light_idx);
      float lightDistance = distance(light.position, v_position);
      vec3 L = (light.position - v_position) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);

      fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}