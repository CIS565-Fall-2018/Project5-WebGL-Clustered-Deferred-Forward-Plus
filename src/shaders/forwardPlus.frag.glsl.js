export default function(params) {
  return `
  // TODO: This is pretty much just a clone of forward.frag.glsl.js

  #version 100
  precision highp float;

  uniform sampler2D u_colmap;
  uniform sampler2D u_normap;
  uniform sampler2D u_lightbuffer;

  uniform mat4 view_matrix;
  uniform float screen_width;
  uniform float screen_height;
  uniform float camera_near;
  uniform float camera_far;  

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

  void main() {
    vec3 albedo = texture2D(u_colmap, v_uv).rgb;
    vec3 normap = texture2D(u_normap, v_uv).xyz;
    vec3 normal = applyNormalMap(v_normal, normap);

    vec4 vec4_position = vec4(v_position, 1.0);
    vec3 view_space_position = vec3(view_matrix * vec4_position);
    view_space_position.z = -view_space_position.z;

    float x_slices = float(${params.x_slices});
    float y_slices = float(${params.y_slices});
    float z_slices = float(${params.z_slices});

    float index_x = floor(gl_FragCoord.x / (screen_width / x_slices));
    float index_y = floor(gl_FragCoord.y / (screen_height / y_slices));
    float index_z = floor((view_space_position.z - camera_near) / ((camera_far - camera_near) / z_slices));

    int cluster_index = int(index_x) + int(index_y) * ${params.x_slices} + int(index_z) * ${params.x_slices} * ${params.y_slices};

    vec3 fragColor = vec3(0.0);

    for (int i = 0; i < ${params.numLights}; ++i) {
      int cluster_total = ${params.x_slices} * ${params.y_slices} * ${params.z_slices};

      float u_index = float(cluster_index + 1) / float(cluster_total + 1);
      int max_cluster_lights = int(texture2D(u_clusterbuffer, vec2(u_index, 0)).x);

      if(i > max_cluster_lights) {
        break;
      }
      int light_index = int(ExtractFloat(u_clusterbuffer, cluster_total, int(0.25 * float(${params.max_lights_per_cluster} + 1)), cluster_index, i + 1));
      Light light = UnpackLight(light_index);
      float lightDistance = distance(light.position, v_position);
      vec3 L = (light.position - v_position) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);

      //fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);

      //bliinn phong
      float specular = pow(max(dot(normalize(-view_space_position), normalize(normalize(-view_space_position) + L)), 0.0), 8.0);
      fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity) + specular * light.color * 0.025;
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}
