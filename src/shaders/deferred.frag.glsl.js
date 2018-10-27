export default function(params) {
  return `
  #version 100
  precision highp float;
  
  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  
  uniform sampler2D u_lightbuffer;
  uniform sampler2D u_clusterbuffer;
  
  uniform float u_Near;
  uniform float u_Far;
  uniform float u_PlaneH;
  uniform float u_PlaneW;
  
  uniform vec3 u_Cam;
  uniform vec2 u_Res;


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
  
  int findCluster (vec3 pos) {
    float z_norm = (pos.z - u_Near) / (u_Far - u_Near);
    
    float w = (u_Near + (u_Far - u_Near) * z_norm) * u_PlaneW;
    float h = (u_Near + (u_Far - u_Near) * z_norm) * u_PlaneH;
    
    float x_size = 2.0 * w / float(${params.xSlices});
    float y_size = 2.0 * h / float(${params.ySlices});
    
    int x = int((pos.x - w) / x_size);
    int y = int((pos.y - h) / y_size);
    int z = int((pos.z - u_Near) * float(${params.zSlices}) / (u_Far - u_Near));
    
    
    return (x + y * ${params.xSlices} + z * ${params.xSlices} * ${params.ySlices});
  }
  
  float toonShade(vec3 normal) {
      float dx = 1.0 / u_Res.x;
      float dy = 1.0 / u_Res.y;
      float edgeDetect = 1.0;
      float s = max(v_uv.x - dx, 0.0);
      vec4 sample = texture2D(u_gbuffers[0], vec2(s, v_uv.y));
      if ( dot(sample.xyz, normal) < 0.2 ) edgeDetect = 0.0;
      if (edgeDetect > 0.0) {
        s = min(v_uv.x + dx, 1.0);
        sample = texture2D(u_gbuffers[0], vec2(s, v_uv.y));
        if ( dot(sample.xyz, normal) < 0.2 ) edgeDetect = 0.0;
      }
      if (edgeDetect > 0.0) {
        s = min(v_uv.y + dy, 1.0);
        sample = texture2D(u_gbuffers[0], vec2(v_uv.x, s));
        if ( dot(sample.xyz, normal) < 0.2 ) edgeDetect = 0.0;
      }
      if (edgeDetect > 0.0) {
        s = min(v_uv.y - dy, 1.0);
        sample = texture2D(u_gbuffers[0], vec2(v_uv.x, s));
        if ( dot(sample.xyz, normal) < 0.2 ) edgeDetect = 0.0;
      }
      
      return edgeDetect;
  }
  
  void main() {
  
     vec4 normal = texture2D(u_gbuffers[0], v_uv);
     vec4 albedo = texture2D(u_gbuffers[1], v_uv);
     vec4 v_position = texture2D(u_gbuffers[2], v_uv);
     vec3 pos = vec3(normal[3], albedo[3], v_position[3]);
     
     float shine = 8.0;
     
     vec3 fragColor = vec3(0.0);
    
    // determine fragment cluster
    int num_clusters = ${params.xSlices} * ${params.ySlices} * ${params.zSlices};
    int clusterIdx = findCluster(pos);
    
    float u = float(clusterIdx + 1) / float(num_clusters + 1);
    // number of lights in cluster
    int n = int(texture2D(u_clusterbuffer, vec2(u, 0.0))[0]);

    int light_idx = 0;
    
    for (int i = 0; i < ${params.numLights}; ++i) {
      // check if within # of lights in cluster
      if (i >= n) break;
      // Retrieve light index
      int elements = (int(${params.maxLights}) + 1) / 4;
      
      light_idx = int(ExtractFloat(u_clusterbuffer, num_clusters, elements, clusterIdx, i+1));
    
      Light light = UnpackLight(light_idx);
      
      float lightDistance = distance(light.position, v_position.xyz);
      vec3 L = (light.position - v_position.xyz) / lightDistance;
      
      vec3 C = normalize(u_Cam - v_position.xyz);
      
      vec3 hwVec = normalize(normalize(L) + C);
      float spec = pow(max(dot(normal.xyz, hwVec), 0.0), shine);

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal.xyz), 0.0);
      
      
      float tot_light = (lambertTerm + spec);
      
      float edgeDetect = 1.0;
      vec3 toon_col = albedo.xyz * floor(tot_light * 6.0) / 6.0;
      
      if (${params.TOON} > 0) {
        edgeDetect = toonShade(normal.xyz);
        fragColor += toon_col * edgeDetect * tot_light * light.color * vec3(lightIntensity);
      }

      else fragColor += albedo.xyz * tot_light * light.color * vec3(lightIntensity);
      
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo.xyz * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}