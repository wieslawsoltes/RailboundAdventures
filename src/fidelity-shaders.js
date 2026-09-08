/** Texture-backed material evaluation in linear light. The same eight-layer
 * contract is used by WGSL and GLSL. Gradients are captured before divergence.
 */
export const SURFACE_WGSL=/* wgsl */`
@group(0) @binding(3) var materialColor:texture_2d_array<f32>;
@group(0) @binding(4) var materialSurface:texture_2d_array<f32>;
@group(0) @binding(5) var materialSampler:sampler;
struct Surface {color:vec3f,bump:vec3f,rough:f32,ao:f32};
fn readSurface(p:vec3f,n:vec3f,dx:vec3f,dy:vec3f,layer:i32,scale:f32)->Surface {
 let s=sign(n+vec3f(.00001));let ww=pow(abs(n),vec3f(6.));let w=ww/max(dot(ww,vec3f(1)),.0001);
 let x=vec2f(-s.x*p.z,p.y)*scale;let y=vec2f(p.x,-s.y*p.z)*scale;let z=vec2f(s.z*p.x,p.y)*scale;
 let xdx=vec2f(-s.x*dx.z,dx.y)*scale;let xdy=vec2f(-s.x*dy.z,dy.y)*scale;
 let ydx=vec2f(dx.x,-s.y*dx.z)*scale;let ydy=vec2f(dy.x,-s.y*dy.z)*scale;
 let zdx=vec2f(s.z*dx.x,dx.y)*scale;let zdy=vec2f(s.z*dy.x,dy.y)*scale;
 let ca=textureSampleGrad(materialColor,materialSampler,x,layer,xdx,xdy).rgb;
 let cb=textureSampleGrad(materialColor,materialSampler,y,layer,ydx,ydy).rgb;
 let cc=textureSampleGrad(materialColor,materialSampler,z,layer,zdx,zdy).rgb;
 let a=textureSampleGrad(materialSurface,materialSampler,x,layer,xdx,xdy);
 let b=textureSampleGrad(materialSurface,materialSampler,y,layer,ydx,ydy);
 let c=textureSampleGrad(materialSurface,materialSampler,z,layer,zdx,zdy);
 let ax=(a.xy*2.-1.);let by=(b.xy*2.-1.);let cz=(c.xy*2.-1.);
 var result:Surface;result.color=ca*w.x+cb*w.y+cc*w.z;
 result.bump=vec3f(0,ax.y,-s.x*ax.x)*w.x+vec3f(by.x,0,-s.y*by.y)*w.y+vec3f(s.z*cz.x,cz.y,0)*w.z;
 result.rough=dot(vec3f(a.z,b.z,c.z),w);result.ao=dot(vec3f(a.w,b.w,c.w),w);return result;
}
fn blendSurface(a:Surface,b:Surface,t:f32)->Surface {return Surface(mix(a.color,b.color,t),mix(a.bump,b.bump,t),mix(a.rough,b.rough,t),mix(a.ao,b.ao,t));}
fn bumpNormal(n:vec3f,b:vec3f)->vec3f{return normalize(n+(b-n*dot(n,b))*u.fidelity.y);}
fn octNormal(n:vec3f)->vec2f{let p=n/(abs(n.x)+abs(n.y)+abs(n.z));return select(p.xy,(1.-abs(p.yx))*sign(p.xy+vec2f(.00001)),p.z<0.)*.5+.5;}
fn roomRay(cell:vec2f,view:vec3f,n:vec3f,t:vec3f,seed:f32)->vec3f {
 let tangent=normalize(t);let up=normalize(cross(n,tangent));
 let origin=vec3f(cell*2.-1.,.999);let direction=vec3f(-dot(view,tangent),-dot(view,up),-max(.07,abs(dot(view,n))));
 let inv=sign(direction+vec3f(.00001))/max(abs(direction),vec3f(.00001));
 let hitT=(sign(direction)-origin)*inv;let hit=origin+direction*min(min(hitT.x,hitT.y),hitT.z);
 let floorTone=mix(vec3f(.15,.085,.045),vec3f(.12,.135,.14),seed);
 let wallTone=mix(vec3f(.32,.30,.24),vec3f(.16,.24,.27),seed);
 var room=wallTone*(.60+.24*hit.z);
 if(abs(hit.x)>.998){room=wallTone*.47;}
 if(hit.y<-.998){let boards=.8+.2*step(.04,fract((hit.x+hit.z*.2)*8.));room=floorTone*boards;}
 if(hit.y>.998){room=vec3f(.28,.27,.235);}
 let furniture=step(abs(hit.x+seed*.4-.2),.45)*step(hit.y,-.38)*step(-.85,hit.y)*step(hit.z,-.99);
 room=mix(room,vec3f(.04,.035,.028),furniture);
 let picture=step(abs(hit.x-.2),.25)*step(abs(hit.y-.1),.30)*step(hit.z,-.99);
 room=mix(room,mix(vec3f(.055,.10,.12),vec3f(.14,.075,.04),seed),picture);
 return room;
}
`;
export const SURFACE_GLSL=/* glsl */`
precision highp sampler2DArray;uniform sampler2DArray materialColor,materialSurface;
struct Surface{vec3 color;vec3 bump;float rough;float ao;};
Surface readSurface(vec3 p,vec3 n,vec3 dx,vec3 dy,int layer,float scale){
 vec3 s=sign(n+vec3(.00001)),ww=pow(abs(n),vec3(6.)),w=ww/max(dot(ww,vec3(1)),.0001);
 vec2 x=vec2(-s.x*p.z,p.y)*scale,y=vec2(p.x,-s.y*p.z)*scale,z=vec2(s.z*p.x,p.y)*scale;
 vec2 xdx=vec2(-s.x*dx.z,dx.y)*scale,xdy=vec2(-s.x*dy.z,dy.y)*scale;
 vec2 ydx=vec2(dx.x,-s.y*dx.z)*scale,ydy=vec2(dy.x,-s.y*dy.z)*scale;
 vec2 zdx=vec2(s.z*dx.x,dx.y)*scale,zdy=vec2(s.z*dy.x,dy.y)*scale;
 vec3 ca=textureGrad(materialColor,vec3(x,float(layer)),xdx,xdy).rgb,cb=textureGrad(materialColor,vec3(y,float(layer)),ydx,ydy).rgb,cc=textureGrad(materialColor,vec3(z,float(layer)),zdx,zdy).rgb;
 vec4 a=textureGrad(materialSurface,vec3(x,float(layer)),xdx,xdy),b=textureGrad(materialSurface,vec3(y,float(layer)),ydx,ydy),c=textureGrad(materialSurface,vec3(z,float(layer)),zdx,zdy);
 vec2 ax=a.xy*2.-1.,by=b.xy*2.-1.,cz=c.xy*2.-1.;Surface result;
 result.color=ca*w.x+cb*w.y+cc*w.z;result.bump=vec3(0,ax.y,-s.x*ax.x)*w.x+vec3(by.x,0,-s.y*by.y)*w.y+vec3(s.z*cz.x,cz.y,0)*w.z;
 result.rough=dot(vec3(a.z,b.z,c.z),w);result.ao=dot(vec3(a.w,b.w,c.w),w);return result;
}
Surface blendSurface(Surface a,Surface b,float t){return Surface(mix(a.color,b.color,t),mix(a.bump,b.bump,t),mix(a.rough,b.rough,t),mix(a.ao,b.ao,t));}
vec3 bumpNormal(vec3 n,vec3 b){return normalize(n+(b-n*dot(n,b))*u.fidelity.y);}
vec2 octNormal(vec3 n){vec3 p=n/(abs(n.x)+abs(n.y)+abs(n.z));return (p.z<0.?(1.-abs(p.yx))*sign(p.xy+vec2(.00001)):p.xy)*.5+.5;}
vec3 roomRay(vec2 cell,vec3 view,vec3 n,vec3 t,float seed){
 vec3 tangent=normalize(t),up=normalize(cross(n,tangent));vec3 origin=vec3(cell*2.-1.,.999),direction=vec3(-dot(view,tangent),-dot(view,up),-max(.07,abs(dot(view,n))));
 vec3 inv=sign(direction+vec3(.00001))/max(abs(direction),vec3(.00001)),hitT=(sign(direction)-origin)*inv,hit=origin+direction*min(min(hitT.x,hitT.y),hitT.z);
 vec3 floorTone=mix(vec3(.15,.085,.045),vec3(.12,.135,.14),seed),wallTone=mix(vec3(.32,.30,.24),vec3(.16,.24,.27),seed),room=wallTone*(.60+.24*hit.z);
 if(abs(hit.x)>.998)room=wallTone*.47;
 if(hit.y<-.998){float boards=.8+.2*step(.04,fract((hit.x+hit.z*.2)*8.));room=floorTone*boards;}
 if(hit.y>.998)room=vec3(.28,.27,.235);
 float furniture=step(abs(hit.x+seed*.4-.2),.45)*step(hit.y,-.38)*step(-.85,hit.y)*step(hit.z,-.99);room=mix(room,vec3(.04,.035,.028),furniture);
 float picture=step(abs(hit.x-.2),.25)*step(abs(hit.y-.1),.30)*step(hit.z,-.99);room=mix(room,mix(vec3(.055,.10,.12),vec3(.14,.075,.04),seed),picture);return room;
}
`;
export const SURFACE_APPLY_WGSL=/* wgsl */`
 var surfaceAO=1.;
 if(u.fidelity.x>.001){
  if(kind>.5&&kind<1.5){
   let slope=1.-max(0.,rawNormal.y);let moisture=clamp(v.uv.x,0.,1.);let macroNoise=fbm(v.world.xz*.0023);
   let soilWeight=clamp((1.-moisture)*.7+smoothstep(.35,.65,fbm(v.world.xz*.018))*.48,0.,.82);
   let loam=readSurface(v.world,rawNormal,worldDx,worldDy,1,1./1.4);
   let grass=readSurface(v.world,rawNormal,worldDx,worldDy,0,1./2.1);
   var terrain=blendSurface(grass,loam,soilWeight);
   let rockWeight=smoothstep(.08,.40,slope);
   if(rockWeight>.001){terrain=blendSurface(terrain,readSurface(v.world,rawNormal,worldDx,worldDy,2,1./3.),rockWeight);}
   var albedo=terrain.color*(.80+macroNoise*.45);
   if(u.env.z>2.5&&u.env.z<3.5){albedo=mix(loam.color*vec3f(2.8,1.55,.85),terrain.color*vec3f(1.65,1.05,.66),rockWeight);}
   if(u.env.z>4.5&&u.env.z<5.5){albedo*=vec3f(1.15,.96,.96);}
   let shore=(1.-smoothstep(u.env.w+1.,u.env.w+8.,v.world.y))*(1.-smoothstep(.06,.3,slope));albedo=mix(albedo,loam.color*vec3f(1.8,1.7,1.35),shore);
   let snow=smoothstep(u.viewport.z-65.,u.viewport.z+65.,v.world.y+(macroNoise-.5)*110.)*smoothstep(.38,.72,rawNormal.y);
   albedo=mix(albedo,vec3f(.76,.81,.86),snow);col=mix(col,albedo,u.fidelity.x);
   n=bumpNormal(rawNormal,terrain.bump*(1.-snow*.85));surfaceAO=mix(terrain.ao,1.,snow);
   let puddles=u.env.y*smoothstep(.45,.68,noise(v.world.xz*.27))*(1.-smoothstep(.01,.10,slope));
   rough=mix(terrain.rough,.10,puddles);col*=1.-u.env.y*.22;
  }else{
   var layer=-1;var scale=1.;var strength=0.;
   if(kind>5.5&&kind<6.5){layer=7;scale=1./1.1;strength=.60;}
   if(kind>6.5&&kind<7.5){layer=6;scale=1./1.5;strength=1.;}
   if(kind>12.5&&kind<13.5){layer=3;scale=1./3.;strength=1.;}
   if(kind>14.5&&kind<15.5){layer=5;scale=1.;strength=.82;}
   if(kind>15.5&&kind<16.5){layer=4;scale=.5;strength=1.;}
   if(layer>=0){let tex=readSurface(v.world,rawNormal,worldDx,worldDy,layer,scale);col=mix(col,tex.color*mix(vec3f(1),col*3.,select(0.,.75,layer==5)),strength*u.fidelity.x);n=bumpNormal(rawNormal,tex.bump);surfaceAO=tex.ao;rough=mix(rough,tex.rough,.7);
    if(kind>12.5&&kind<13.5){let puddles=u.env.y*smoothstep(.35,.65,noise(v.world.xz*.19));rough=mix(rough,.075,puddles);col*=1.-puddles*.35;}}
  }
 }
 rough=clamp(sqrt(rough*rough+normalVariance),.08,1.);metal=clamp(metal,0.,1.);
`;
export const SURFACE_APPLY_GLSL=/* glsl */`
 float surfaceAO=1.;
 if(u.fidelity.x>.001){
  if(kind>.5&&kind<1.5){
   float slope=1.-max(0.,rawNormal.y),moisture=clamp(uv.x,0.,1.),macroNoise=fbm(world.xz*.0023);
   float soilWeight=clamp((1.-moisture)*.7+smoothstep(.35,.65,fbm(world.xz*.018))*.48,0.,.82);
   Surface loam=readSurface(world,rawNormal,worldDx,worldDy,1,1./1.4),grass=readSurface(world,rawNormal,worldDx,worldDy,0,1./2.1),terrain=blendSurface(grass,loam,soilWeight);
   float rockWeight=smoothstep(.08,.40,slope);if(rockWeight>.001)terrain=blendSurface(terrain,readSurface(world,rawNormal,worldDx,worldDy,2,1./3.),rockWeight);
   vec3 albedo=terrain.color*(.80+macroNoise*.45);
   if(u.env.z>2.5&&u.env.z<3.5)albedo=mix(loam.color*vec3(2.8,1.55,.85),terrain.color*vec3(1.65,1.05,.66),rockWeight);
   if(u.env.z>4.5&&u.env.z<5.5)albedo*=vec3(1.15,.96,.96);
   float shore=(1.-smoothstep(u.env.w+1.,u.env.w+8.,world.y))*(1.-smoothstep(.06,.3,slope));albedo=mix(albedo,loam.color*vec3(1.8,1.7,1.35),shore);
   float snow=smoothstep(u.viewport.z-65.,u.viewport.z+65.,world.y+(macroNoise-.5)*110.)*smoothstep(.38,.72,rawNormal.y);
   albedo=mix(albedo,vec3(.76,.81,.86),snow);col=mix(col,albedo,u.fidelity.x);n=bumpNormal(rawNormal,terrain.bump*(1.-snow*.85));surfaceAO=mix(terrain.ao,1.,snow);
   float puddles=u.env.y*smoothstep(.45,.68,noise(world.xz*.27))*(1.-smoothstep(.01,.10,slope));rough=mix(terrain.rough,.10,puddles);col*=1.-u.env.y*.22;
  }else{
   int layer=-1;float scale=1.,strength=0.;
   if(kind>5.5&&kind<6.5){layer=7;scale=1./1.1;strength=.60;}
   if(kind>6.5&&kind<7.5){layer=6;scale=1./1.5;strength=1.;}
   if(kind>12.5&&kind<13.5){layer=3;scale=1./3.;strength=1.;}
   if(kind>14.5&&kind<15.5){layer=5;scale=1.;strength=.82;}
   if(kind>15.5&&kind<16.5){layer=4;scale=.5;strength=1.;}
   if(layer>=0){Surface tex=readSurface(world,rawNormal,worldDx,worldDy,layer,scale);col=mix(col,tex.color*mix(vec3(1),col*3.,layer==5?.75:0.),strength*u.fidelity.x);n=bumpNormal(rawNormal,tex.bump);surfaceAO=tex.ao;rough=mix(rough,tex.rough,.7);
    if(kind>12.5&&kind<13.5){float puddles=u.env.y*smoothstep(.35,.65,noise(world.xz*.19));rough=mix(rough,.075,puddles);col*=1.-puddles*.35;}}
  }
 }
 rough=clamp(sqrt(rough*rough+normalVariance),.08,1.);metal=clamp(metal,0.,1.);
`;
