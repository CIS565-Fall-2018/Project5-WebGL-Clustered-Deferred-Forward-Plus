export default function(params) {
  return `
  // TODO: This is pretty much just a clone of forward.frag.glsl.js

  #version 100
  precision highp float;

  uniform sampler2D u_colmap;
  uniform sampler2D u_normap;
  uniform sampler2D u_lightbuffer;

  uniform mat4 u_viewMatrix;
  uniform float u_nearClip;
  uniform float u_farClip;
  uniform vec2 u_dimensions;

  // TODO: Read this buffer to determine the lights influencing a cluster
  uniform sampler2D u_clusterbuffer;

  varying vec3 v_position;
  varying vec3 v_normal;
  varying vec2 v_uv;

  const int xSlices = ${params.xSlices};
  const int ySlices = ${params.ySlices};  
  const int zSlices = ${params.zSlices};
  const int maxNumLightsPerCluster = ${params.MAX_LIGHTS_PER_CLUSTER};
  
  vec3 fragColor, albedo, normap, normal;

  vec3 applyNormalMap(vec3 geomnor, vec3 normap) {
    normap = normap * 2.0 - 1.0;
    vec3 up = normalize(vec3(0.001, 1, 0.001));
    vec3 surftan = normalize(cross(geomnor, up));
    vec3 surfbinor = cross(geomnor, surftan);
    return normap.y * surftan + normap.x * surfbinor + normap.z * geomnor;
    
  }

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

  void shadeLight(Light light) {
    float lightDistance = distance(light.position, v_position);
    vec3 L = (light.position - v_position) / lightDistance;

    float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
    float lambertTerm = max(dot(L, normal), 0.0);

    fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);  
  
  }

  void UnpackCluster(int clusterId) {
    float u = float(clusterId + 1) / float(xSlices * ySlices * zSlices + 1);
    
    int numLights = int(texture2D(u_clusterbuffer, vec2(u, 0.0))[0]);
    int totalRows = int(float(maxNumLightsPerCluster + 1) / 4.0) + 1;
    for (int i = 0; i < maxNumLightsPerCluster; i++) {
      if (i >= numLights) {
        break;
      }
      int row = (i + 1) / 4; 
      int col = (i + 1) - 4 * row;
    
      int lightId = int(ExtractFloat(u_clusterbuffer, xSlices * ySlices * zSlices, totalRows, clusterId, i + 1));

      Light light = UnpackLight(lightId);
      shadeLight(light);
    }

  }

  void main() {
    albedo = texture2D(u_colmap, v_uv).rgb;
    normap = texture2D(u_normap, v_uv).xyz;
    normal = applyNormalMap(v_normal, normap);
    fragColor = vec3(0.0);

    float deltaZ = (u_farClip - u_nearClip)/float(zSlices);
    float deltaX = float(u_dimensions.x) / float(xSlices);
    float deltaY = float(u_dimensions.y) / float(ySlices);

    vec4 pos = u_viewMatrix * vec4(v_position, 1.0);
    pos[2] = pos[2] * -1.0;

    int z = int((pos.z - u_nearClip) / deltaZ);
    int x = int(gl_FragCoord.x/deltaX);
    int y = int(gl_FragCoord.y/deltaY);
    int clusterId = x + y * xSlices + z * xSlices * ySlices;

    UnpackCluster(clusterId);    

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;
    gl_FragColor = vec4(fragColor, 1.0);
  }



  `;
}
