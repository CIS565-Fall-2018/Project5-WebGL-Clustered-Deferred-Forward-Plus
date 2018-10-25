export default function(params) {
  return `
  #version 100
  precision highp float;
  
  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  uniform sampler2D u_clusterbuffer;
  uniform sampler2D u_lightbuffer;
  uniform mat4 u_viewMatrix;
  uniform mat4 u_invviewMatrix;
  uniform float u_near;
  uniform float u_far;
  uniform float u_screenwidth;
  uniform float u_screenheight;
  uniform int u_shadingtype;
  
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
    int texelComponent = component - pixel * 4;
    if (texelComponent == 0) {
      return texel[0];
    } else if (texelComponent == 1) {
      return texel[1];
    } else if (texelComponent == 2) {
      return texel[2];
    } else if (texelComponent == 3) {
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
    light.radius = v1.w;//ExtractFloat(u_lightbuffer, ${params.numLights}, 2, index, 3);
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
    vec4 gbuffer0 = texture2D(u_gbuffers[0], v_uv);
    vec4 gbuffer1 = texture2D(u_gbuffers[1], v_uv);
    //vec4 gbuffer2 = texture2D(u_gbuffers[2], v_uv);
    //vec3 normal = gbuffer2.xyz;
    vec3 normal;
    vec3 v_position = gbuffer1.xyz;
    
    vec2 snor = vec2(gbuffer0.w,gbuffer1.w);
    float ival = sqrt(1.0 - gbuffer0.w *gbuffer0.w-gbuffer1.w*gbuffer1.w);
    vec4 normdecompressed = u_invviewMatrix*vec4(snor,ival,0.0);
    normal = normalize(normdecompressed.xyz);
    
    
    vec3 albedo = gbuffer0.rgb;
    int clusterXidx = int( gl_FragCoord.x / (float(u_screenwidth) / float(${params.xSlices})) );
    int clusterYidx = int( gl_FragCoord.y /  (float(u_screenheight) / float(${params.ySlices})) );
    
    
    vec4 viewPosRaw = u_viewMatrix * vec4(v_position,1.0);
    vec4 viewpos =  u_invviewMatrix*vec4(0.0,0.0,0.0,1.0);
    
    
    int clusterZidx = int( (-viewPosRaw.z-u_near) / (float(u_far-u_near) / float(${params.zSlices})) );
    int clusterIdx = clusterXidx + clusterYidx*${params.xSlices} + clusterZidx*${params.xSlices}*${params.ySlices};
    int clusterCount = ${params.xSlices}*${params.ySlices}*${params.zSlices};
    
    float U = float(clusterIdx+1) / float(clusterCount+1);
    int clusterLightCount = int(texture2D(u_clusterbuffer, vec2(U,0)).r);
    int texelsPerCol = int(float(${params.maxLightsPerCluster}+1)/4.0) + 1;
    
    vec3 fragColor = vec3(0.0);
    for (int i = 0; i < ${params.numLights}; ++i) {
          if(i >= clusterLightCount) { break; } 
          int texelIdx = int(float(i+1) * 0.25);
          float V = float(texelIdx+1) / float(texelsPerCol+1);
          vec4 texel = texture2D(u_clusterbuffer, vec2(U,V));
          int lightIdx;
          int texelComponent = (i+1) - (texelIdx * 4);
          if (texelComponent == 0) {
              lightIdx = int(texel[0]);
          } else if (texelComponent == 1) {
              lightIdx = int(texel[1]);
          } else if (texelComponent == 2) {
              lightIdx = int(texel[2]);
          } else if (texelComponent == 3) {
              lightIdx = int(texel[3]);
          }
          Light light = UnpackLight(lightIdx);
          float lightDistance = distance(light.position, v_position);
          vec3 L = (light.position - v_position) / lightDistance;
          float lightIntensity = 0.6*cubicGaussian(2.0 * lightDistance / light.radius);
          
          //blinn-phon shading
          vec3 viewdir = normalize(vec3(viewpos) - v_position);
          vec3 lightdir = normalize(L);
          vec3 halfv  = normalize(lightdir+viewdir);
          float theta = max(0.0,dot(halfv,normal));
          float specterm;
          if(u_shadingtype == 1)
          {
          specterm = pow(theta,1000.0);
          }
          else
          {
          specterm = 0.0;
          }
          
          //lambert shading
          float lambertTerm = max(dot(L, normal), 0.0);
          
          //toon shading:
          float toonnum = 3.3;
          float toonnumspec = 0.3;
          float toonmag = 0.7;
          float toonlamb = floor(lambertTerm*toonnum)/toonnum;
          float toonspec = floor(specterm*toonnumspec)/toonnumspec;
          if(u_shadingtype==2)
          {
            lambertTerm = lambertTerm*(1.0-toonmag)+toonlamb*toonmag;
            specterm = specterm*(1.0-toonmag)+toonspec*toonmag;
          }
          
          fragColor += albedo * (lambertTerm + 3.0*specterm)* light.color * vec3(lightIntensity);
      }//lightloop
      float depthval = -viewPosRaw.z; 
      const vec3 ambientLight = vec3(0.025);
      fragColor += albedo * ambientLight;
      //fragColor = 0.04*vec3(depthval);
      gl_FragColor = vec4(fragColor, 1.0);
    }
    `;
}