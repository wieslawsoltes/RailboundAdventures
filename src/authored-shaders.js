/** UV-bound art materials. Texture derivatives are evaluated before branching;
 * derivative normal frames remain valid on reflected/scaled instances.
 */
export const HERO_BINDINGS_WGSL=`
@group(0) @binding(6) var heroColor:texture_2d_array<f32>;
@group(0) @binding(8) var heroSampler:sampler;
`;
export const HERO_BINDINGS_GLSL=`precision highp sampler2DArray;uniform sampler2DArray heroColor;`;
export const HERO_WGSL=HERO_BINDINGS_WGSL+`
@group(0) @binding(7) var heroSurface:texture_2d_array<f32>;
fn artNormal(n:vec3f,dp1:vec3f,dp2:vec3f,du1:vec2f,du2:vec2f,xy:vec2f)->vec3f {
 let dp2perp=cross(dp2,n);let dp1perp=cross(n,dp1);
 let t=dp2perp*du1.x+dp1perp*du2.x;let b=dp2perp*du1.y+dp1perp*du2.y;
 let inv=inverseSqrt(max(max(dot(t,t),dot(b,b)),.00000001));
 let z=sqrt(max(.01,1.-dot(xy,xy)));return normalize(t*(xy.x*inv)+b*(xy.y*inv)+n*z);
}
`;
export const HERO_GLSL=HERO_BINDINGS_GLSL+`
uniform sampler2DArray heroSurface;
vec3 artNormal(vec3 n,vec3 dp1,vec3 dp2,vec2 du1,vec2 du2,vec2 xy){
 vec3 dp2perp=cross(dp2,n),dp1perp=cross(n,dp1),t=dp2perp*du1.x+dp1perp*du2.x,b=dp2perp*du1.y+dp1perp*du2.y;
 float inv=inversesqrt(max(max(dot(t,t),dot(b,b)),.00000001));return normalize(t*(xy.x*inv)+b*(xy.y*inv)+n*sqrt(max(.01,1.-dot(xy,xy))));
}
`;
export const HERO_APPLY_WGSL=`
 if(kind>16.5&&kind<18.5){
  let layer=i32(clamp(round(v.props.z),0.,3.));
  let paint=textureSampleGrad(heroColor,heroSampler,v.uv,layer,uvDx,uvDy);
  let surf=textureSampleGrad(heroSurface,heroSampler,v.uv,layer,uvDx,uvDy);
  metal=0.;emissive=0.;rough=clamp(surf.b,.15,.98);surfaceAO=mix(1.,surf.a,.72);col*=paint.rgb;
  if(u.fidelity.y>.5){n=artNormal(n,worldDx,worldDy,uvDx,uvDy,(surf.rg*2.-1.)*.75);}
  if(kind>17.5){coverage=smoothstep(.12,.72,paint.a);if(coverage<.025){discard;}rough=.9;}
 }
`;
export const HERO_APPLY_GLSL=`
 if(kind>16.5&&kind<18.5){
  float layer=clamp(round(props.z),0.,3.);vec4 paint=textureGrad(heroColor,vec3(uv,layer),uvDx,uvDy),surf=textureGrad(heroSurface,vec3(uv,layer),uvDx,uvDy);
  metal=0.;emissive=0.;rough=clamp(surf.b,.15,.98);surfaceAO=mix(1.,surf.a,.72);col*=paint.rgb;
  if(u.fidelity.y>.5)n=artNormal(n,worldDx,worldDy,uvDx,uvDy,(surf.rg*2.-1.)*.75);
  if(kind>17.5){coverage=smoothstep(.12,.72,paint.a);if(coverage<.025)discard;rough=.9;}
 }
`;
