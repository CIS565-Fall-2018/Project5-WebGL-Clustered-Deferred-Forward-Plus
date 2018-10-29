export default function(params) {
  return `
  // TODO: This is pretty much just a clone of forward.frag.glsl.js

  #version 100
  precision highp float;

  #define CLUSTER_X ${params.clusterX}
  #define CLUSTER_Y ${params.clusterY}
  #define CLUSTER_Z ${params.clusterZ}

  uniform sampler2D u_colmap;
  uniform sampler2D u_normap;
  uniform sampler2D u_lightbuffer;

  // TODO: Read this buffer to determine the lights influencing a cluster
  uniform sampler2D u_clusterbuffer;

  uniform float nearClipPlane;
  uniform float farClipPlane;
  uniform float camX;
  uniform float camY;
  uniform float camZ;
  
  uniform mat4 u_viewMatrix;//me
  uniform mat4 u_viewProjectionMatrix;//me

  varying vec3 v_position;
  varying vec3 v_normal;
  varying vec2 v_uv;
  
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
  
  int UnpackCluster(int x, int y, int z, int index) {
    int indexOver4 = index / 4;
    float u = (float(x + y * CLUSTER_X + z * CLUSTER_X * CLUSTER_Y) + 0.3) / float(CLUSTER_X*CLUSTER_Y*CLUSTER_Z);//0.3 is the offset, 15 is the frustum count in each axis
    float v = (float(indexOver4) + 0.3) / ceil(float(${params.numLights} + 1) / 4.0);//0.3 is the offset, 101 is the MAX_LIGHTS_PER_CLUSTER + 1
    vec4 texel = texture2D(u_clusterbuffer, vec2(u, v));
    int pixelComponent = index - indexOver4 * 4;
    if (pixelComponent == 0) {
      return int(texel[0]);
    } else if (pixelComponent == 1) {
      return int(texel[1]);
    } else if (pixelComponent == 2) {
      return int(texel[2]);
    } else if (pixelComponent == 3) {
      return int(texel[3]);
    }
  }

  void main() {
    vec3 albedo = texture2D(u_colmap, v_uv).rgb;
    vec3 normap = texture2D(u_normap, v_uv).xyz;
    vec3 normal = applyNormalMap(v_normal, normap);

    vec3 fragColor = vec3(0.0);

    vec4 ndc_position = u_viewProjectionMatrix * vec4(v_position, 1.0);
    ndc_position /= ndc_position.w;
    vec3 CAMERA_position = (u_viewMatrix * vec4(v_position, 1.0)).xyz;

    int x = int(clamp((ndc_position.x * 0.5 + 0.5) * float(CLUSTER_X), 0.0, float(CLUSTER_X)));//from [-1,1] to [0, 15] to [0,15)
    int y = int(clamp((ndc_position.y * 0.5 + 0.5) * float(CLUSTER_Y), 0.0, float(CLUSTER_Y)));//from [-1,1] to [0, 15] to [0,15)
    int z = int(clamp((- CAMERA_position.z - nearClipPlane) / (farClipPlane - nearClipPlane) * float(CLUSTER_Z), 0.0, float(CLUSTER_Z)));//from [-1,1] to [0, 15] to [0,15)
    int lightCount = UnpackCluster(x, y, z, 0);
    
    for (int i = 0; i < ${params.numLights}; ++i) {
      if(i >= lightCount)
        break;

      Light light = UnpackLight(UnpackCluster(x, y, z, i + 1));
      float lightDistance = distance(light.position, v_position);
      vec3 L = (light.position - v_position) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      //float lambertTerm = max(dot(L, normal), 0.0);
      vec3 camera = vec3(camX, camY, camZ);//vec3(-u_viewMatrix[3][0], -u_viewMatrix[3][1], -u_viewMatrix[3][2]);
      vec3 Eye = normalize(camera - v_position);
      vec3 H = normalize((L + Eye)/2.0);
      float blinnPhongTerm = pow(abs(dot(H, normal)), 5.0);

      fragColor += albedo * blinnPhongTerm * light.color * vec3(lightIntensity);//albedo * lambertTerm * light.color * vec3(lightIntensity);
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);// + lightCountCol;
  }
  `;
}
