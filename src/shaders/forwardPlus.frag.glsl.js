export default function(params) {
  return `
  // TODO: This is pretty much just a clone of forward.frag.glsl.js

  #version 100
  precision highp float;

  uniform sampler2D u_colmap;
  uniform sampler2D u_normap;
  uniform sampler2D u_lightbuffer;

  uniform float u_nearClip;
  uniform vec2 u_clusterTileSize;
  uniform float u_clusterZStride;
  uniform mat4 u_viewMatrix;

  // TODO: Read this buffer to determine the lights influencing a cluster
  uniform sampler2D u_clusterbuffer;

  varying vec3 v_position;
  varying vec3 v_normal;
  varying vec2 v_uv;

  vec3 applyNormalMap(vec3 geomnor, vec3 normap) {
    normap = normap * 2.0 - 1.0;
    vec3 up = normalize(vec3(0.001, 1, 0.001));
    vec3 surftan = normalize(cross(geomnor, up));
    vec3 surfbinor = cross(geomnor, surftan);
    return normalize(normap.y * surftan + normap.x * surfbinor + normap.z * geomnor);
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
    vec3 albedo = texture2D(u_colmap, v_uv).rgb;
    vec3 normap = texture2D(u_normap, v_uv).xyz;
    vec3 normal = applyNormalMap(v_normal, normap);

    vec3 fragColor = vec3(0.0);

    //changed
    vec3 viewSpacePos3 = vec3(u_viewMatrix * vec4(v_position, 1.0));
    //which cluster is this fragment in??
    int clusterXIdx = int(gl_FragCoord.x / u_clusterTileSize.x);
    int clusterYIdx = int(gl_FragCoord.y / u_clusterTileSize.y);
    int clusterZIdx = int((-viewSpacePos3.z - u_nearClip) / u_clusterZStride);

    //cluster texture dimensions
    const int clusterTextureWidth = int(${params.numXSlices}) * int(${params.numYSlices}) * int(${params.numZSlices});
    const int clusterTextureHeight = int(ceil((float(${params.maxLightsPerCluster}) + 1.0) / 4.0));

    //get light influence counts from cluster texture buffer:
    //get cluster index
    int clusterIdx = clusterXIdx + clusterYIdx * int(${params.numXSlices}) + clusterZIdx * int(${params.numXSlices}) * int(${params.numYSlices});
    
    //uv coords in cluster texture
    float clusterTex_u = float(clusterIdx + 1) / float(clusterTextureWidth + 1);
    float clusterTex_v = 0.0;
    float clusterTex_v_offset = 1.0 / float(clusterTextureHeight + 1);
    clusterTex_v += clusterTex_v_offset;

    //get the texel using the uv
    vec4 clusterTex = texture2D(u_clusterbuffer, vec2(clusterTex_u, clusterTex_v));
    //read influencing data from cluster texel
    int influencingLightCount = int(cluster_Tex[0]);
    //maximum number of light sources in cluster
    const int numLightsMax = int(min(float(${params.maxLightsPerCluster}), float(${params.numLights})));

    //shade lights
    int clusterTexIdxToFetch = 1;
    for(int i = 0; i < numLightsMax; i++)
    {
      if(i == influencingLightCount)
      {
        break;
      }
      int lightIdx;
      if(clusterTexIdxToFetch <= 3){
        lightIdx = int(cluster_Tex[clusterTexIdxToFetch]);
      }
      clusterTexIdxToFetch++;

      Light light = UnpackLight(lightIdx);

      float lightDistance = distance(light.position, v_position);
      vec3 L = (light.position - v_position) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);

      fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);
      
      if(clusterTexIdxToFetch == 4){
        clusterTexIdxToFetch = 0;
        clusterTex_v += clusterTex_v_offset;
        cluster_Tex = texture2D(u_clusterbuffer, vec2(clusterTex_u, clusterTex_v));
      }
    
    }
//    for (int i = 0; i < ${params.numLights}; ++i) {
//      Light light = UnpackLight(i);
//     float lightDistance = distance(light.position, v_position);
//      vec3 L = (light.position - v_position) / lightDistance;

//      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
//      float lambertTerm = max(dot(L, normal), 0.0);

//      fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);
//    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}
