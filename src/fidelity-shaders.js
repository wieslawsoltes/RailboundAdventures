/** Texture-backed material evaluation in linear light. The same eight-layer
 * contract is used by WGSL and GLSL. Gradients are captured before divergence.
 */
// Smooth, non-folding domain warp for natural surfaces. The analytic Jacobian
// keeps mip/anisotropic footprints correct; built surfaces retain metric UVs.
export function warpNaturalUV(uv, gradient=[0,0]) {
 if (![...uv,...gradient].every(Number.isFinite)||uv.length!==2||gradient.length!==2) throw new TypeError('Finite UV and gradient required');
 const a=uv[0]*.17+uv[1]*.09,b=uv[0]*-.11+uv[1]*.19;
 return {uv:[uv[0]+2.4*Math.sin(a),uv[1]+2.4*Math.sin(b)],
  gradient:[gradient[0]+2.4*Math.cos(a)*(gradient[0]*.17+gradient[1]*.09),gradient[1]+2.4*Math.cos(b)*(gradient[0]*-.11+gradient[1]*.19)]};
}
export const SURFACE_WGSL=/* wgsl */`
@group(0) @binding(3) var materialColor:texture_2d_array<f32>;
@group(0) @binding(4) var materialSurface:texture_2d_array<f32>;
@group(0) @binding(5) var materialSampler:sampler;
struct Surface {color:vec3f,bump:vec3f,rough:f32,ao:f32};
fn naturalUV(p:vec2f)->vec2f{return p+2.4*sin(vec2f(dot(p,vec2f(.17,.09)),dot(p,vec2f(-.11,.19))));}
fn naturalGradient(p:vec2f,d:vec2f)->vec2f{return d+2.4*cos(vec2f(dot(p,vec2f(.17,.09)),dot(p,vec2f(-.11,.19))))*vec2f(dot(d,vec2f(.17,.09)),dot(d,vec2f(-.11,.19)));}
fn naturalBump(p:vec2f,b:vec2f)->vec2f{let c=2.4*cos(vec2f(dot(p,vec2f(.17,.09)),dot(p,vec2f(-.11,.19))));return b+vec2f(c.x*.17*b.x-c.y*.11*b.y,c.x*.09*b.x+c.y*.19*b.y);}
fn readSurface(p:vec3f,n:vec3f,dx:vec3f,dy:vec3f,layer:i32,scale:f32)->Surface {
 let s=sign(n+vec3f(.00001));let ww=pow(abs(n),vec3f(6.));let w=ww/max(dot(ww,vec3f(1)),.0001);
 var x=vec2f(-s.x*p.z,p.y)*scale;var y=vec2f(p.x,-s.y*p.z)*scale;var z=vec2f(s.z*p.x,p.y)*scale;
 var xdx=vec2f(-s.x*dx.z,dx.y)*scale;var xdy=vec2f(-s.x*dy.z,dy.y)*scale;
 var ydx=vec2f(dx.x,-s.y*dx.z)*scale;var ydy=vec2f(dy.x,-s.y*dy.z)*scale;
 var zdx=vec2f(s.z*dx.x,dx.y)*scale;var zdy=vec2f(s.z*dy.x,dy.y)*scale;
 let sourceX=x;let sourceY=y;let sourceZ=z;
 if(layer<3){xdx=naturalGradient(x,xdx);xdy=naturalGradient(x,xdy);ydx=naturalGradient(y,ydx);ydy=naturalGradient(y,ydy);zdx=naturalGradient(z,zdx);zdy=naturalGradient(z,zdy);x=naturalUV(x);y=naturalUV(y);z=naturalUV(z);}
 let ca=textureSampleGrad(materialColor,materialSampler,x,layer,xdx,xdy).rgb;
 let cb=textureSampleGrad(materialColor,materialSampler,y,layer,ydx,ydy).rgb;
 let cc=textureSampleGrad(materialColor,materialSampler,z,layer,zdx,zdy).rgb;
 let a=textureSampleGrad(materialSurface,materialSampler,x,layer,xdx,xdy);
 let b=textureSampleGrad(materialSurface,materialSampler,y,layer,ydx,ydy);
 let c=textureSampleGrad(materialSurface,materialSampler,z,layer,zdx,zdy);
 var ax=(a.xy*2.-1.);var by=(b.xy*2.-1.);var cz=(c.xy*2.-1.);
 if(layer<3){ax=naturalBump(sourceX,ax);by=naturalBump(sourceY,by);cz=naturalBump(sourceZ,cz);}
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
 let face=select(vec3f(-1),vec3f(1),direction>=vec3f(0));
 let inv=face/max(abs(direction),vec3f(.00001));
 let hitT=(face-origin)*inv;let hit=origin+direction*min(min(hitT.x,hitT.y),hitT.z);
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
vec2 naturalUV(vec2 p){return p+2.4*sin(vec2(dot(p,vec2(.17,.09)),dot(p,vec2(-.11,.19))));}
vec2 naturalGradient(vec2 p,vec2 d){return d+2.4*cos(vec2(dot(p,vec2(.17,.09)),dot(p,vec2(-.11,.19))))*vec2(dot(d,vec2(.17,.09)),dot(d,vec2(-.11,.19)));}
vec2 naturalBump(vec2 p,vec2 b){vec2 c=2.4*cos(vec2(dot(p,vec2(.17,.09)),dot(p,vec2(-.11,.19))));return b+vec2(c.x*.17*b.x-c.y*.11*b.y,c.x*.09*b.x+c.y*.19*b.y);}
Surface readSurface(vec3 p,vec3 n,vec3 dx,vec3 dy,int layer,float scale){
 vec3 s=sign(n+vec3(.00001)),ww=pow(abs(n),vec3(6.)),w=ww/max(dot(ww,vec3(1)),.0001);
 vec2 x=vec2(-s.x*p.z,p.y)*scale,y=vec2(p.x,-s.y*p.z)*scale,z=vec2(s.z*p.x,p.y)*scale;
 vec2 xdx=vec2(-s.x*dx.z,dx.y)*scale,xdy=vec2(-s.x*dy.z,dy.y)*scale;
 vec2 ydx=vec2(dx.x,-s.y*dx.z)*scale,ydy=vec2(dy.x,-s.y*dy.z)*scale;
 vec2 zdx=vec2(s.z*dx.x,dx.y)*scale,zdy=vec2(s.z*dy.x,dy.y)*scale;
 vec2 sourceX=x,sourceY=y,sourceZ=z;
 if(layer<3){xdx=naturalGradient(x,xdx);xdy=naturalGradient(x,xdy);ydx=naturalGradient(y,ydx);ydy=naturalGradient(y,ydy);zdx=naturalGradient(z,zdx);zdy=naturalGradient(z,zdy);x=naturalUV(x);y=naturalUV(y);z=naturalUV(z);}
 vec3 ca=textureGrad(materialColor,vec3(x,float(layer)),xdx,xdy).rgb,cb=textureGrad(materialColor,vec3(y,float(layer)),ydx,ydy).rgb,cc=textureGrad(materialColor,vec3(z,float(layer)),zdx,zdy).rgb;
 vec4 a=textureGrad(materialSurface,vec3(x,float(layer)),xdx,xdy),b=textureGrad(materialSurface,vec3(y,float(layer)),ydx,ydy),c=textureGrad(materialSurface,vec3(z,float(layer)),zdx,zdy);
 vec2 ax=a.xy*2.-1.,by=b.xy*2.-1.,cz=c.xy*2.-1.;
 if(layer<3){ax=naturalBump(sourceX,ax);by=naturalBump(sourceY,by);cz=naturalBump(sourceZ,cz);}Surface result;
 result.color=ca*w.x+cb*w.y+cc*w.z;result.bump=vec3(0,ax.y,-s.x*ax.x)*w.x+vec3(by.x,0,-s.y*by.y)*w.y+vec3(s.z*cz.x,cz.y,0)*w.z;
 result.rough=dot(vec3(a.z,b.z,c.z),w);result.ao=dot(vec3(a.w,b.w,c.w),w);return result;
}
Surface blendSurface(Surface a,Surface b,float t){return Surface(mix(a.color,b.color,t),mix(a.bump,b.bump,t),mix(a.rough,b.rough,t),mix(a.ao,b.ao,t));}
vec3 bumpNormal(vec3 n,vec3 b){return normalize(n+(b-n*dot(n,b))*u.fidelity.y);}
vec2 octNormal(vec3 n){vec3 p=n/(abs(n.x)+abs(n.y)+abs(n.z));return (p.z<0.?(1.-abs(p.yx))*sign(p.xy+vec2(.00001)):p.xy)*.5+.5;}
vec3 roomRay(vec2 cell,vec3 view,vec3 n,vec3 t,float seed){
 vec3 tangent=normalize(t),up=normalize(cross(n,tangent));vec3 origin=vec3(cell*2.-1.,.999),direction=vec3(-dot(view,tangent),-dot(view,up),-max(.07,abs(dot(view,n))));
 vec3 face=mix(vec3(-1),vec3(1),step(vec3(0),direction));vec3 inv=face/max(abs(direction),vec3(.00001)),hitT=(face-origin)*inv,hit=origin+direction*min(min(hitT.x,hitT.y),hitT.z);
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
   var grass=readSurface(v.world,rawNormal,worldDx,worldDy,0,1./2.1);
   let biomeGrass=pow(u.ground.rgb,vec3f(2.2));
   grass.color=mix(grass.color,biomeGrass*clamp(grass.color/vec3f(.324265,.299196,.106823),vec3f(.25),vec3f(2.5)),.78);
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
   Surface loam=readSurface(world,rawNormal,worldDx,worldDy,1,1./1.4),grass=readSurface(world,rawNormal,worldDx,worldDy,0,1./2.1);
   vec3 biomeGrass=pow(u.ground.rgb,vec3(2.2));
   grass.color=mix(grass.color,biomeGrass*clamp(grass.color/vec3(.324265,.299196,.106823),vec3(.25),vec3(2.5)),.78);
   Surface terrain=blendSurface(grass,loam,soilWeight);
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
