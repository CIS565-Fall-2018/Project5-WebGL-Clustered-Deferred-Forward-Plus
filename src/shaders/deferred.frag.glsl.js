export default function(params) {
  return `
  #version 100
  precision highp float;

  uniform mat4 u_viewProjectionMatrix;
  uniform float u_near;
  uniform float u_far;
  uniform float u_screenWidth;
  uniform float u_screenHeight;
  uniform float u_xSlices;
  uniform float u_ySlices;
  uniform float u_zSlices;
  uniform vec3 u_cameraPos;

  
  uniform sampler2D u_gbuffers[${params.numGBuffers}];
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
    vec4 v1 = texture2D(u_lightbuffer, vec2(u, 0.0));
    vec4 v2 = texture2D(u_lightbuffer, vec2(u, 0.5));
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
    vec3 normal = texture2D(u_gbuffers[0], v_uv).xyz; // normal
    vec3 albedo = texture2D(u_gbuffers[1], v_uv).rgb; // albedo
    vec3 v_position = texture2D(u_gbuffers[2], v_uv).xyz; // world space position

    vec3 fragColor = vec3(0.0);

    // okay so here we gotta transform the position to screen space
    vec4 screenSpacePos = u_viewProjectionMatrix * vec4(v_position, 1.0);
    float oldZ = screenSpacePos.z / (u_far - u_near);
    screenSpacePos = screenSpacePos / screenSpacePos.w;

    // then figure out which cluster we're inside?
    // so we need the screen height and width and we gotta know what z caps out at 
    float clusterWidthX = u_screenWidth / u_xSlices;
    float clusterHeightY = u_screenHeight / u_ySlices;
    float clusterDepthZ = (u_far - u_near) / u_zSlices;

    // now to get my cluster index 
    int cx = int((((screenSpacePos.x + 1.0) / 2.0) * u_screenWidth) / clusterWidthX);
    int cy = int((((screenSpacePos.y + 1.0) / 2.0) * u_screenHeight) / clusterHeightY);
    int cz = int(oldZ * u_zSlices);
    //int cz = int((((oldZ + 1.0) / 2.0) * (u_far - u_near)) / clusterDepthZ);
    int clusterIndex = cx + cy * int(u_xSlices) + cz * int(u_xSlices) * int(u_ySlices);

    // get the number of lights in the cluster
    float numLights = ExtractFloat(u_clusterbuffer, int(u_xSlices * u_ySlices * u_zSlices), int(26), clusterIndex, 0);

    for (int i = 0; i < 100; ++i) {
      int lightIndex = int(ExtractFloat(u_clusterbuffer, int(u_xSlices * u_ySlices * u_zSlices), int(26), clusterIndex, i+1));
      if (lightIndex != 0) {
        Light light = UnpackLight(lightIndex);
        float lightDistance = distance(light.position, v_position);
        vec3 L = (light.position - v_position) / lightDistance;

        float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
        float lambertTerm = max(dot(L, normal), 0.0);

        // Now perform Blinn-Phong shading to calculate specular value
        // Reference:  https://learnopengl.com/Advanced-Lighting/Advanced-Lighting
        vec3 lightDir = normalize(light.position - v_position);
        vec3 viewDir = normalize(u_cameraPos - v_position);
        vec3 halfwayDir = normalize(lightDir + viewDir);

        float shininess = 4.0;
        float spec = pow(max(dot(normal, halfwayDir), 0.0), shininess);

        //fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity) * spec;
        fragColor += albedo * light.color * vec3(lightIntensity) * spec;
      }
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}