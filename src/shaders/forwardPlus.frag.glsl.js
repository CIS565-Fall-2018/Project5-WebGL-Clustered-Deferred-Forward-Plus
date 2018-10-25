export default function(params) {
  return `
  // TODO: This is pretty much just a clone of forward.frag.glsl.js

  #version 100
  precision highp float;

  uniform sampler2D u_colmap;
  uniform sampler2D u_normap;
  uniform sampler2D u_lightbuffer;

  // Read this buffer to determine the lights influencing a cluster
  uniform sampler2D u_clusterbuffer;

  uniform mat4 u_view_matrix;
  uniform vec3 u_slice_dimensions;
  uniform vec2 u_resolution;
  uniform float u_near_clip;
  uniform float u_far_clip;
  uniform vec3 u_camera_position;

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

    vec4 pos = u_view_matrix * vec4(v_position, 1.0);

    // locate fragment's cluster
    vec3 loc = vec3(floor(gl_FragCoord.x * u_slice_dimensions.x / u_resolution.x),
                    floor(gl_FragCoord.y * u_slice_dimensions.y / u_resolution.y),
                    floor(-pos.z - u_nearclip) * u_slice_dimensions.z / (u_farclip - u_nearclip));

    // get rest of cluster information - left as floats for math ease
    float index_of_cluster =
      loc.x + loc.y * u_slice_dimensions.x + loc.z * u_slice_dimensions.x * u_slice_dimensions.y;
    float num_clusters = u_slice_dimensions.x * u_slice_dimensions.y * u_slice_dimensions.z;

    // offset by 1 for both bc indexing in [0, length - 1]
    float row = (index_of_cluster + 1) / (num_clusters + 1);

    int light_count = floor(texture2D(u_clusterbuffer, vec2(row, 0))[0]);

    // begin color calculation based on cluster information
    vec3 fragColor = vec3(0.0);
    for (int i = 0; i < ${params.numLights}; ++i) {
      // check
      if (i >= light_count) {
        break;
      }

      float light_index = ExtractFloat( u_clusterbuffer,
                                       (int)num_clusters,
                                       ${Math.floor((params.numLights_perCluster + 1) / 4)},
                                       (int)index_of_cluster,
                                       i + 1);
      Light light = UnpackLight((int)light_index);
      float lightDistance = distance(light.position, v_position);
      vec3 L = (light.position - v_position) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);

      // regular shading
      fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);

      // blinn-phong
      //vec3 view_dir = normalize(u_camera_position - v_position);
      //vec3 half_vec_for_calc = normalize(L + viewDir);
      //float specularTerm = pow(max(dot(normal, half_vec_for_calc), 0), 100);
      //fragColor += (albedo + vec3(specularTerm)) * lambertTerm * light.color lightIntensity;
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}
