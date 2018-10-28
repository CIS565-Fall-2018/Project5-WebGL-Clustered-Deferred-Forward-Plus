export default function(params) {
  return `
  #version 100
  precision highp float;
  
  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  varying vec2 v_uv;

  // NEW: variables for deffered
  uniform sampler2D u_clusterbuffer;
  uniform sampler2D u_lightbuffer;
  
  // From Forward Plus
  uniform mat4 u_viewMatrix;
  uniform mat4 u_invViewMatrix;
  uniform float u_screenWidth;
  uniform float u_screenHeight;
  uniform float u_camera_near;
  uniform float u_camera_far;

  // Helper functions from Forward Plus

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

  // extract data from g buffers and do lighting
  void main() 
  {
    // NEW: extract data from g buffers
    vec4 gbuffer0 = texture2D(u_gbuffers[0], v_uv);
    vec4 gbuffer1 = texture2D(u_gbuffers[1], v_uv);
    vec3 albedo = gbuffer0.rgb;
    vec3 v_position = gbuffer1.xyz;
    
    // NEW: calculations for the normal
    vec2 snor = vec2(gbuffer0.w, gbuffer1.w);
    float zValue = sqrt(1.0 - gbuffer0.w * gbuffer0.w - gbuffer1.w * gbuffer1.w);
    vec3 normal = normalize(vec4(u_invViewMatrix * vec4(snor, zValue, 0.0)).xyz);

    // From forward plus
    int clusterXIndex = int( gl_FragCoord.x / (float(u_screenWidth) / float(${params.xSlices})) );
    int clusterYIndex = int( gl_FragCoord.y /  (float(u_screenHeight) / float(${params.ySlices})) );
    vec4 cameraPos = u_viewMatrix * vec4(v_position,1.0);
    int clusterZIndex = int( (-cameraPos.z - u_camera_near) / (float(u_camera_far - u_camera_near) / float(${params.zSlices})) );
    int clusterIndex = clusterXIndex + clusterYIndex * ${params.xSlices} + clusterZIndex * ${params.xSlices} * ${params.ySlices};
    //NEW: fragment position used for blinn-phong shading
    vec4 fragPos =  u_invViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);

    // From forward plus
    int numClusters = ${params.xSlices} * ${params.ySlices} * ${params.zSlices};
    float u = float(clusterIndex + 1) / float(numClusters + 1);
    int numClusterLights = int(texture2D(u_clusterbuffer, vec2(u, 0)).r);
    int texelsPerCol = int(float(${params.maxLightsPerCluster} + 1) * 0.25) + 1;
    

    vec3 fragColor = vec3(0.0);

    for (int i = 0; i < ${params.numLights}; ++i) 
    {

      if(i >= numClusterLights) { break; } 
      int texIndex = int(float(i+1) * 0.25);
      float V = float(texIndex+1) / float(texelsPerCol+1);
      vec4 texel = texture2D(u_clusterbuffer, vec2(u,V));

      int lightIndex;
      int texelComponent = (i + 1) - (texIndex * 4);
      if (texelComponent == 0) { lightIndex = int(texel[0]); } 
      else if (texelComponent == 1) { lightIndex = int(texel[1]); } 
      else if (texelComponent == 2) { lightIndex = int(texel[2]); } 
      else if (texelComponent == 3) { lightIndex = int(texel[3]); }
      Light light = UnpackLight(lightIndex);

      float lightDistance = distance(light.position, v_position);
      vec3 L = (light.position - v_position) / lightDistance;
      float lightIntensity = 0.6*cubicGaussian(2.0 * lightDistance / light.radius);
      
      // default lambert shading
      float lambertComponent = max(dot(L, normal), 0.0);
      float specularComponent = 0.0;
      
      /*
      // NEW: Toon Shading
      float lambertStep = 5.1;
      float lerpU = 0.80;
      float toonLambertComponent = floor(lambertComponent * lambertStep) / lambertStep;
      lambertComponent = lambertComponent * (1.0 - lerpU) + toonLambertComponent * lerpU;
      specularComponent = 0.0;
      */
      
      
      // NEW: Blinn-Phong Shading
      vec3 cameraDirection = normalize(vec3(fragPos) - v_position);
      vec3 lightDirection = normalize(L);
      float theta = max(0.0, dot(normalize(lightDirection + cameraDirection), normal));
      specularComponent = pow(theta,1000.0);
      

      /*
      // NEW: Iridescence
      vec3 cameraDirection2 = normalize(vec3(fragPos) - v_position);
      float angle = dot(cameraDirection2, normal);
      float r = 0.005*abs(cos(3.0*angle + 1.0));
      float g = 0.005*abs(cos(3.0*angle + 2.0));
      float b = 0.005*abs(cos(3.0*angle + 3.0));
      fragColor += vec3(r, g, b);
      */

      /*
      // NEW: Sobel
      vec4 col1 = -1.0*texture2D(u_gbuffers[0], vec2(v_uv.x-0.001, v_uv.y-0.001));
      vec4 col2 = -2.0*texture2D(u_gbuffers[0], vec2(v_uv.x-0.001, v_uv.y));
      vec4 col3 = -1.0*texture2D(u_gbuffers[0], vec2(v_uv.x-0.001, v_uv.y+0.001));
      vec4 col4 = 1.0*texture2D(u_gbuffers[0], vec2(v_uv.x+0.001, v_uv.y-0.001));
      vec4 col5 = 2.0*texture2D(u_gbuffers[0], vec2(v_uv.x+0.001, v_uv.y));
      vec4 col6 = 1.0*texture2D(u_gbuffers[0], vec2(v_uv.x+0.001, v_uv.y+0.001));
      vec4 gx = col1 + col2 + col3 + col4 + col5 + col6;
      vec4 col7 = 1.0*texture2D(u_gbuffers[0], vec2(v_uv.x-0.001, v_uv.y-0.001));
      vec4 col8 = 2.0*texture2D(u_gbuffers[0], vec2(v_uv.x, v_uv.y-0.001));
      vec4 col9 = 1.0*texture2D(u_gbuffers[0], vec2(v_uv.x+0.001, v_uv.y-0.001));
      vec4 col10 = -1.0*texture2D(u_gbuffers[0], vec2(v_uv.x-0.001, v_uv.y+0.001));
      vec4 col11 = -2.0*texture2D(u_gbuffers[0], vec2(v_uv.x, v_uv.y+0.001));
      vec4 col12 = -1.0*texture2D(u_gbuffers[0], vec2(v_uv.x+0.001, v_uv.y+0.001));
      vec4 gy = col7 + col8 + col9 + col10 + col11 + col12;
      vec4 g = sqrt(gx*gx + gy*gy);
      float lerpT = 0.7;
      albedo =  albedo * (1.0 - lerpT) + vec3(g.rgb) * lerpT;
      */

      fragColor += albedo * (lambertComponent + 3.0 * specularComponent) * light.color * vec3(lightIntensity);

    }

    // NEW: add some ambient lighting
    vec3 ambientComponent = 0.05 * albedo;
    fragColor += ambientComponent;

    gl_FragColor = vec4(fragColor, 1.0);

  }
  `;
}