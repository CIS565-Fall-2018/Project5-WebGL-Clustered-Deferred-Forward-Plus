export default function(params) {
    return `
  // TODO: This is pretty much just a clone of forward.frag.glsl.js

  #version 100
  #extension GL_EXT_draw_buffers: enable
  precision highp float;

  #define CLUSTER_X ${params.clusterX}
  #define CLUSTER_Y ${params.clusterY}
  #define CLUSTER_Z ${params.clusterZ}

  uniform sampler2D u_lightbuffer;
  
  uniform mat4 u_viewMatrix;
  
  uniform float xstart;
  uniform float xend;
  uniform float xstep;
  
  uniform float ystart;
  uniform float yend;
  uniform float ystep;
  
  uniform float zstart;
  uniform float zend;
  uniform float zstep;

  varying vec2 v_uv;
  
  struct Light {
    vec3 position;
    float radius;
    vec3 color;
  };
  
  struct Frustum {
    vec3 points0;
    vec3 points1;
    vec3 points2;
    vec3 points3;
    vec3 points4;
    vec3 points5;
    vec3 normals0;
    vec3 normals1;
    vec3 normals2;
    vec3 normals3;
    vec3 normals4;
    vec3 normals5;
  };
  
  Frustum GenerateFrustum(float x, float y, float z) {
    Frustum frustum;
    //  6-------------7
    //  ||    f2     ||
    //  | |         | |
    //  |  2-------3  |
    //  |f3|  f0   |f1|
    //  |  0-------1  |
    //  | |         | |
    //  ||    f4     ||
    //  4-------------5
    
    float scale0 = (zstart + z * zstep) / zstart;
    vec3 p0 = vec3(xstart + x * xstep, ystart + y * ystep, zstart) * scale0;
    vec3 p1 = vec3(xstart + (x + 1.0) * xstep, ystart + y * ystep, zstart) * scale0;
    vec3 p2 = vec3(xstart + x * xstep, ystart + (y + 1.0) * ystep, zstart) * scale0;
    vec3 p3 = vec3(xstart + (x + 1.0) * xstep, ystart + (y + 1.0) * ystep, zstart) * scale0;
    
    float scale1 = (zstart + (z + 1.0) * zstep) / zstart;
    vec3 p4 = vec3(xstart + x * xstep, ystart + y * ystep, zstart) * scale1;
    vec3 p5 = vec3(xstart + (x + 1.0) * xstep, ystart + y * ystep, zstart) * scale1;
    vec3 p6 = vec3(xstart + x * xstep, ystart + (y + 1.0) * ystep, zstart) * scale1;
    vec3 p7 = vec3(xstart + (x + 1.0) * xstep, ystart + (y + 1.0) * ystep, zstart) * scale1;
    
    frustum.points0 = p0;
    frustum.points1 = p1;
    frustum.points2 = p2;
    frustum.points3 = p0;
    frustum.points4 = p0;
    frustum.points5 = p4;
    
    frustum.normals0 = normalize(cross(normalize(p1 - p0), normalize(p2 - p0)));
    frustum.normals1 = normalize(cross(normalize(p5 - p1), normalize(p3 - p1)));
    frustum.normals2 = normalize(cross(normalize(p3 - p2), normalize(p6 - p2)));
    frustum.normals3 = normalize(cross(normalize(p2 - p0), normalize(p4 - p0)));
    frustum.normals4 = normalize(cross(normalize(p4 - p0), normalize(p1 - p0)));
    frustum.normals5 = normalize(cross(normalize(p6 - p4), normalize(p5 - p4)));
    
    return frustum;
  }
  
  bool FrustumSphereOverlap(Frustum frustum, vec3 sphereCenter, float sphereRadius)
  {
        float distance = 0.0;

        for(int i = 0;i<6;++i)
        {
        
            if(i==0)
            {
                distance = dot(frustum.normals0, sphereCenter - frustum.points0);
            }
            else if(i==1)
            {
                distance = dot(frustum.normals1, sphereCenter - frustum.points1);
            }
            else if(i==2)
            {
                distance = dot(frustum.normals2, sphereCenter - frustum.points2);
            }
            else if(i==3)
            {
                distance = dot(frustum.normals3, sphereCenter - frustum.points3);
            }
            else if(i==4)
            {
                distance = dot(frustum.normals4, sphereCenter - frustum.points4);
            }
            else if(i==5)
            {
                distance = dot(frustum.normals5, sphereCenter - frustum.points5);
            }

            if(abs(distance) < sphereRadius)
            {
                // intersect, return true
                // return true;
            }
            else if(distance > sphereRadius)
            {
                // outside, return false
                return false;
            }
            else
            {
                // potentially inside, do nothing
            }
        }
        // all inside, return true
        return true;
  }

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
    ivec2 pixelIdx = ivec2(gl_FragCoord.xy);    // floored
    int clusterIdx = pixelIdx.x;
    int lightIdxStart = pixelIdx.y * 4;
    
    int mod = clusterIdx;
    int z = mod / (CLUSTER_X * CLUSTER_Y);   //floored
    mod = mod - (CLUSTER_X * CLUSTER_Y) * z;   //mod
    int y = mod / CLUSTER_X;    //floored
    mod = mod - CLUSTER_X * y;  //mod
    int x = mod;    //floored
    
    Frustum frustum = GenerateFrustum(float(x), float(y), float(z));
    
    vec4 fragColor = vec4(0, 0, 0, 0);
    
    for (int i = 0; i < 4; ++i) {
      int lightIdx = lightIdxStart + i;
      
      if(lightIdx >= ${params.numLights})
        break;

      Light light = UnpackLight(lightIdx);
      
      vec4 lightPositionView = u_viewMatrix * vec4(light.position, 1.0);
      if(FrustumSphereOverlap(frustum, lightPositionView.xyz, light.radius))
      {
        ////////////////////////////////////////////////////////////////////
        //DEBUG, USING RED CHANNEL TO MARK THE LIGHTS WHO ARE IN THE CLUSTER
        // if(i==0) fragColor.r += 0.25;
        // else if(i==1) fragColor.r += 0.25;
        // else if(i==2) fragColor.r += 0.25;
        // else if(i==3) fragColor.r += 0.25;
        ////////////////////////////////////////////////////////////////////
        
        if(i==0) fragColor.r = 1.0;
        else if(i==1) fragColor.g = 1.0;
        else if(i==2) fragColor.b = 1.0;
        else if(i==3) fragColor.a = 1.0;
      }  
      // else
      // {
      //   ////////////////////////////////////////////////////////////////////
      //   //DEBUG, USING GREEN CHANNEL TO MARK THE LIGHTS WHO ARE not IN THE CLUSTER
      //   // if(i==0) fragColor.g += 0.25;
      //   // else if(i==1) fragColor.g += 0.25;
      //   // else if(i==2) fragColor.g += 0.25;
      //   // else if(i==3) fragColor.g += 0.25;
      //   ////////////////////////////////////////////////////////////////////
      // }
    }
    
    gl_FragData[0] = fragColor;
    
  }
  `;
}
