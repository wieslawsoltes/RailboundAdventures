export const WGSL_COMMON = /* wgsl */`
struct Frame {
 vp: mat4x4f, invVP: mat4x4f, lightVP: mat4x4f,
 cameraTime: vec4f, sunDay: vec4f, sunExposure: vec4f, fog: vec4f,
 env: vec4f, headPos: vec4f, headDir: vec4f, ground: vec4f, rock: vec4f, viewport: vec4f,
};
@group(0) @binding(0) var<uniform> u: Frame;
fn hash(p:vec2f)->f32 { return fract(sin(dot(p,vec2f(127.1,311.7)))*43758.5453); }
fn noise(p:vec2f)->f32 {let i=floor(p); let a=fract(p);let f=a*a*(vec2f(3.)-2.*a);return mix(mix(hash(i),hash(i+vec2f(1,0)),f.x),mix(hash(i+vec2f(0,1)),hash(i+vec2f(1,1)),f.x),f.y);}
fn fbm(p0:vec2f)->f32 {var p=p0;var n=0.;var a=.5;for(var i=0;i<4;i++){n+=noise(p)*a;p=p*2.03+vec2f(13.4,7.1);a*=.5;}return n;}
fn aces(c:vec3f)->vec3f {return clamp(c,vec3f(0),vec3f(128));}
fn atmosphere(rd:vec3f,clouds:bool)->vec3f {
 let day=u.sunDay.w;let h=clamp(rd.y*.8+.18,0.,1.);let horizon=mix(vec3f(.018,.027,.055),pow(u.fog.rgb,vec3f(2.2))*.95,day);
 let zenith=mix(vec3f(.002,.005,.018),vec3f(.12,.30,.50),day);var sky=mix(horizon,zenith,pow(h,.6));
 let sun=max(0.,dot(rd,u.sunDay.xyz));sky+=u.sunExposure.rgb*(pow(sun,1400.)*5.+pow(sun,22.)*.12)*day;
 sky+=vec3f(.52,.21,.065)*pow(sun,9.)*(1.-smoothstep(.18,.55,u.sunDay.y))*day;
 if(clouds && rd.y>0.){let uv=rd.xz/max(.07,rd.y)*1.6+vec2f(u.cameraTime.w*.0018,0);let n=fbm(uv);let cloud=smoothstep(.63-u.env.x*.38,.76-u.env.x*.4,n)*smoothstep(0.,.14,rd.y);sky=mix(sky,mix(vec3f(.038,.052,.07),vec3f(.76,.78,.76),day)*( .65+n*.55),cloud*.92);}
 if(day<.25&&rd.y>.05){let star=pow(hash(floor(rd.xz/(rd.y+.5)*1100.)),1800.);sky+=vec3f(star*(1.-day*4.));}
 let moonDir=normalize(vec3f(-u.sunDay.x,.38,-u.sunDay.z));
 let moon=dot(rd,moonDir);sky+=vec3f(.40,.48,.63)*smoothstep(.9991,.9997,moon)*(1.-day);
 if(u.env.z>1.5&&u.env.z<2.5&&day<.3&&rd.y>.08){
  let curtain=sin(rd.x*8.+rd.z*5.+sin(rd.z*11.+u.cameraTime.w*.03)*.6);
  let ribbon=exp(-pow((rd.y-.34-curtain*.12)*12.,2.));
  sky+=mix(vec3f(.04,.33,.16),vec3f(.15,.05,.27),rd.y)*ribbon*(1.-day)*(.6+noise(rd.xz*75.)*.4);
 }
 return sky;
}
`;
export const WGSL_SKY = WGSL_COMMON+/* wgsl */`
struct SkyOut {@builtin(position) position:vec4f,@location(0) ndc:vec2f};
@vertex fn vs(@builtin(vertex_index) i:u32)->SkyOut {var pts=array<vec2f,3>(vec2f(-1,-1),vec2f(3,-1),vec2f(-1,3));var o:SkyOut;o.position=vec4f(pts[i],.99999,1);o.ndc=pts[i];return o;}
@fragment fn fs(v:SkyOut)->@location(0) vec4f {let w=u.invVP*vec4f(v.ndc,1,1);let rd=normalize(w.xyz/w.w-u.cameraTime.xyz);return vec4f(aces(atmosphere(rd,true)),1);}
`;
export const WGSL_VERTEX=/* wgsl */`
struct Vin {@location(0) p:vec3f,@location(1) n:vec3f,@location(2) uv:vec2f,@location(3) m0:vec4f,@location(4) m1:vec4f,@location(5) m2:vec4f,@location(6) m3:vec4f,@location(7) color:vec4f,@location(8) props:vec4f};
struct Vout {@builtin(position) position:vec4f,@location(0) world:vec3f,@location(1) normal:vec3f,@location(2) color:vec4f,@location(3) props:vec4f,@location(4) uv:vec2f,@location(5) light:vec4f};
@vertex fn vs(v:Vin)->Vout {let m=mat4x4f(v.m0,v.m1,v.m2,v.m3);var p=m*vec4f(v.p,1);var o:Vout;
 if(v.props.x>4.5&&v.props.x<5.5){p.x+=sin(u.cameraTime.w*1.3+p.z*.08)*.13*u.viewport.w*max(0.,v.p.y);}
 o.position=u.vp*p;o.world=p.xyz;o.normal=normalize(v.m0.xyz*v.n.x/max(.00001,dot(v.m0.xyz,v.m0.xyz))+v.m1.xyz*v.n.y/max(.00001,dot(v.m1.xyz,v.m1.xyz))+v.m2.xyz*v.n.z/max(.00001,dot(v.m2.xyz,v.m2.xyz)));o.color=v.color;o.props=v.props;o.uv=v.uv;o.light=u.lightVP*p;return o;}
`;
export const WGSL_MAIN = WGSL_COMMON+/* wgsl */`
@group(0) @binding(1) var shadow: texture_depth_2d;
@group(0) @binding(2) var shadowSampler: sampler_comparison;
`+WGSL_VERTEX+/* wgsl */`
fn shadeShadow(lp:vec4f,n:vec3f)->f32 {let p=lp.xyz/lp.w;let uv=p.xy*vec2f(.5,-.5)+vec2f(.5);if(any(uv<vec2f(.002))||any(uv>vec2f(.998))||p.z<0.||p.z>1.||u.headDir.w<.5){return 1.;}let bias=.00012+.00045*(1.-max(0.,dot(n,u.sunDay.xyz)));var s=0.;let size=vec2f(textureDimensions(shadow));for(var x=-1;x<=1;x++){for(var y=-1;y<=1;y++){s+=textureSampleCompareLevel(shadow,shadowSampler,uv+vec2f(f32(x),f32(y))/size,p.z-bias);}}return s/9.;}
@fragment fn fs(v:Vout)->@location(0) vec4f {
 var n=normalize(v.normal);let view=normalize(u.cameraTime.xyz-v.world);var col=pow(v.color.rgb,vec3f(2.2));let kind=v.props.x;var rough=v.props.y;var metal=v.props.z;var emissive=v.props.w;
 if(kind>.5&&kind<1.5){
  let terrainNoise=fbm(v.world.xz*.0023);let moisture=clamp(v.uv.x,0.,1.);let drainage=clamp(v.uv.y,0.,1.);
  let blend=pow(abs(n),vec3f(4.));let weights=blend/max(dot(blend,vec3f(1.)),.001);
  let grain=noise(v.world.yz*.24)*weights.x+noise(v.world.xz*.24)*weights.y+noise(v.world.xy*.24)*weights.z;
  let detail=noise(v.world.xz*1.3);
  var grass=pow(u.ground.rgb,vec3f(2.2))*(.65+terrainNoise*.65+grain*.14);
  let dry=vec3f(.29,.235,.125);grass=mix(grass,dry,(1.-moisture)*.24);
  var rock=pow(u.rock.rgb,vec3f(2.2))*(.55+grain*.55+terrainNoise*.25);
  let slope=1.-max(0.,n.y);col=mix(grass,rock,smoothstep(.13,.45,slope));
  col=mix(col,rock*.80,drainage*smoothstep(.02,.22,slope)*.32);
  if(u.env.z>2.5&&u.env.z<3.5){
   let strata=.88+.08*sin(v.world.y*.31+terrainNoise*4.)+.045*sin(v.world.y*1.13);
   col=mix(grass*vec3f(1.08,.96,.8),rock,smoothstep(.07,.30,slope))*strata;
  }
  if(u.env.z>4.5&&u.env.z<5.5){col=mix(col,vec3f(.19,.11,.17),smoothstep(.51,.68,terrainNoise)*(1.-smoothstep(.05,.22,slope))*.3);}
  let shore=(1.-smoothstep(u.env.w+1.,u.env.w+12.,v.world.y))*(1.-smoothstep(.05,.28,slope));
  col=mix(col,vec3f(.30,.28,.20),shore*.65);col*=.94+detail*.12;
  let snow=smoothstep(u.viewport.z-65.,u.viewport.z+65.,v.world.y+(terrainNoise-.5)*110.)*smoothstep(.38,.72,n.y);
  col=mix(col,vec3f(.82,.85,.86),snow);col*=1.-u.env.y*.19;rough=.91;
  n=normalize(n+vec3f((noise(v.world.xz*.41)-.5)*.075,0.,(noise(v.world.zx*.53)-.5)*.075));
 }
 if(kind>5.5&&kind<6.5){col*=.89+noise((v.world.xz+vec2f(v.world.y*.71,v.world.y*.31))*5.)*.16;}
 if(kind>6.5&&kind<7.5){let grit=hash(floor(v.world.xz*23.));col*=.7+grit*.6;}
 let light=u.sunDay.xyz;let ndl=max(0.,dot(n,light));let visibility=shadeShadow(v.light,n);let hemi=mix(vec3f(.09,.105,.1),vec3f(.24,.30,.37),n.y*.5+.5)*mix(.12,1.,u.sunDay.w);
 let sun=u.sunExposure.rgb*ndl*visibility*u.sunDay.w*(2.6-u.env.x*.9);
 let halfV=normalize(light+view);let ndh=max(0.,dot(n,halfV));let r=max(.06,rough);let alpha=r*r;let a2=alpha*alpha;let den=ndh*ndh*(a2-1.)+1.;let D=a2/(3.14159*den*den+.0001);let F=mix(vec3f(.035),col,metal)+(vec3f(1.)-mix(vec3f(.035),col,metal))*pow(1.-max(0.,dot(halfV,view)),5.);let nv=max(.02,dot(n,view));let k=(r+1.)*(r+1.)/8.;
 let G=nv/(nv*(1.-k)+k)*ndl/max(.001,ndl*(1.-k)+k);
 let spec=F*D*G/max(.04,4.*nv*max(ndl,.02));
 let cloudShadow=mix(1.,.70,smoothstep(.42,.75,fbm(v.world.xz*.00032+u.cameraTime.w*.0015))*u.env.x);
 var color=col*hemi+((vec3f(1.)-F)*col*(1.-metal)/3.14159+spec)*sun*3.0*cloudShadow;
 if(kind>2.5&&kind<3.5){let refl=atmosphere(reflect(-view,n),false);let fr=.24+.65*pow(1.-max(0.,dot(n,view)),4.);color=mix(col*.4,refl,fr)+spec*sun*.35;}
 if(kind>1.5&&kind<2.5){let t=u.cameraTime.w;let wave=sin(v.world.x*.11+t*.9)*.05+sin(v.world.z*.17-t*.7)*.035; n=normalize(vec3f(wave,1.,cos(v.world.z*.09+t*.7)*.06));let fr=.04+.88*pow(1.-max(0.,dot(n,view)),4.);let reflection=atmosphere(reflect(-view,n),true);let sparkle=pow(max(0.,dot(reflect(-light,n),view)),170.)*u.sunDay.w*3.;color=mix(pow(v.color.rgb,vec3f(2.2))*(.6+ndl*.45),reflection,fr)+u.sunExposure.rgb*sparkle;}
 if(kind>4.5&&kind<5.5){color*=.7+noise(v.world.xz*3.1+vec2f(v.world.y*1.7))*.38;color+=col*max(0.,dot(-n,light))*.32*u.sunDay.w;}
 if(u.headPos.w>.01){let delta=v.world-u.headPos.xyz;let d=length(delta);let cone=smoothstep(.90,.982,dot(normalize(delta),u.headDir.xyz));color+=col*vec3f(1.,.91,.68)*cone*max(0.,dot(n,-normalize(delta)))*u.headPos.w/(1.+d*d*.008);}
 if(kind>8.5&&kind<9.5){let foam=.64+.36*noise(vec2f(v.world.x*1.2,v.world.y*.24+u.cameraTime.w*2.8));color=mix(color,vec3f(.64,.79,.82)*foam,.7);}
 if(kind>9.5&&kind<10.5){let crest=.65+.35*sin(v.world.x*.09+v.world.z*.12-u.cameraTime.w*1.2);color=mix(color,vec3f(.65,.79,.79),crest*.72);}
 color+=col*emissive;
 let distance=length(v.world-u.cameraTime.xyz);let heightFog=exp(-max(v.world.y-u.env.w,0.)*.00085);let fog=1.-exp(-distance*u.fog.w*heightFog);color=mix(color,atmosphere(normalize(v.world-u.cameraTime.xyz),false),clamp(fog,0.,.99));
 return vec4f(aces(color),select(1.,v.color.a,kind>7.5));
}
`;
export const WGSL_SHADOW = WGSL_COMMON+/* wgsl */`
struct Vin {@location(0) p:vec3f,@location(3) m0:vec4f,@location(4) m1:vec4f,@location(5) m2:vec4f,@location(6) m3:vec4f};
@vertex fn vs(v:Vin)->@builtin(position) vec4f{return u.lightVP*mat4x4f(v.m0,v.m1,v.m2,v.m3)*vec4f(v.p,1);}
`;
/** GLSL ES 3.0 fallback deliberately shares the same material model and frame layout. */
export const GLSL_COMMON=/* glsl */`
precision highp float;
layout(std140) uniform Frame {mat4 vp;mat4 invVP;mat4 lightVP;vec4 cameraTime;vec4 sunDay;vec4 sunExposure;vec4 fog;vec4 env;vec4 headPos;vec4 headDir;vec4 ground;vec4 rock;vec4 viewport;} u;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),a=fract(p),f=a*a*(3.-2.*a);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float n=0.,a=.5;for(int i=0;i<4;i++){n+=noise(p)*a;p=p*2.03+vec2(13.4,7.1);a*=.5;}return n;}
vec3 aces(vec3 c){
#ifdef RAILBOUND_LDR_SCENE
 vec3 x=max(c*u.sunExposure.w,vec3(0));return pow(clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.),vec3(1./2.2));
#else
 return clamp(c,0.,128.);
#endif
}
vec3 atmosphere(vec3 rd,bool clouds){float day=u.sunDay.w,h=clamp(rd.y*.8+.18,0.,1.);vec3 horizon=mix(vec3(.018,.027,.055),pow(u.fog.rgb,vec3(2.2))*.95,day),zenith=mix(vec3(.002,.005,.018),vec3(.12,.30,.50),day);vec3 sky=mix(horizon,zenith,pow(h,.6));float sun=max(0.,dot(rd,u.sunDay.xyz));sky+=u.sunExposure.rgb*(pow(sun,1400.)*5.+pow(sun,22.)*.12)*day;sky+=vec3(.52,.21,.065)*pow(sun,9.)*(1.-smoothstep(.18,.55,u.sunDay.y))*day;
 if(clouds&&rd.y>0.){vec2 uv=rd.xz/max(.07,rd.y)*1.6+vec2(u.cameraTime.w*.0018,0);float n=fbm(uv),cloud=smoothstep(.63-u.env.x*.38,.76-u.env.x*.4,n)*smoothstep(0.,.14,rd.y);sky=mix(sky,mix(vec3(.038,.052,.07),vec3(.76,.78,.76),day)*(.65+n*.55),cloud*.92);}if(day<.25&&rd.y>.05){float star=pow(hash(floor(rd.xz/(rd.y+.5)*1100.)),1800.);sky+=vec3(star*(1.-day*4.));}vec3 moonDir=normalize(vec3(-u.sunDay.x,.38,-u.sunDay.z));float moon=dot(rd,moonDir);sky+=vec3(.40,.48,.63)*smoothstep(.9991,.9997,moon)*(1.-day);if(u.env.z>1.5&&u.env.z<2.5&&day<.3&&rd.y>.08){float curtain=sin(rd.x*8.+rd.z*5.+sin(rd.z*11.+u.cameraTime.w*.03)*.6),ribbon=exp(-pow((rd.y-.34-curtain*.12)*12.,2.));sky+=mix(vec3(.04,.33,.16),vec3(.15,.05,.27),rd.y)*ribbon*(1.-day)*(.6+noise(rd.xz*75.)*.4);}return sky;}
`;
export const GLSL_SKY_VS=`#version 300 es
precision highp float;out vec2 ndc;void main(){vec2 p=gl_VertexID==0?vec2(-1,-1):gl_VertexID==1?vec2(3,-1):vec2(-1,3);ndc=p;gl_Position=vec4(p,.99999,1);}`;
export const GLSL_SKY_FS=`#version 300 es\n`+GLSL_COMMON+`in vec2 ndc;out vec4 outColor;void main(){vec4 w=u.invVP*vec4(ndc,1,1);vec3 rd=normalize(w.xyz/w.w-u.cameraTime.xyz);outColor=vec4(aces(atmosphere(rd,true)),1);}`;
export const GLSL_MAIN_VS=`#version 300 es\n`+GLSL_COMMON+`
layout(location=0) in vec3 aPos;layout(location=1) in vec3 aNormal;layout(location=2) in vec2 aUV;layout(location=3) in mat4 model;layout(location=7) in vec4 tint;layout(location=8) in vec4 params;
out vec3 world;out vec3 normal;out vec4 color;out vec4 props;out vec2 uv;out vec4 lightPos;
void main(){vec4 p=model*vec4(aPos,1);if(params.x>4.5&&params.x<5.5)p.x+=sin(u.cameraTime.w*1.3+p.z*.08)*.13*u.viewport.w*max(0.,aPos.y);gl_Position=u.vp*p;world=p.xyz;normal=normalize(model[0].xyz*aNormal.x/max(.00001,dot(model[0].xyz,model[0].xyz))+model[1].xyz*aNormal.y/max(.00001,dot(model[1].xyz,model[1].xyz))+model[2].xyz*aNormal.z/max(.00001,dot(model[2].xyz,model[2].xyz)));color=tint;props=params;uv=aUV;lightPos=u.lightVP*p;}`;
export const GLSL_MAIN_FS=`#version 300 es\n`+GLSL_COMMON+`
precision highp sampler2DShadow;uniform sampler2DShadow shadowTex;in vec3 world;in vec3 normal;in vec4 color;in vec4 props;in vec2 uv;in vec4 lightPos;out vec4 outColor;
float shadeShadow(vec4 lp,vec3 n){vec3 p=lp.xyz/lp.w;vec2 uv=p.xy*.5+.5;float z=p.z*.5+.5;if(any(lessThan(uv,vec2(.002)))||any(greaterThan(uv,vec2(.998)))||z<0.||z>1.||u.headDir.w<.5)return 1.;float bias=.00012+.00045*(1.-max(0.,dot(n,u.sunDay.xyz)));float s=0.;vec2 size=vec2(textureSize(shadowTex,0));for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)s+=texture(shadowTex,vec3(uv+vec2(float(x),float(y))/size,z-bias));return s/9.;}
void main(){vec3 n=normalize(normal),view=normalize(u.cameraTime.xyz-world),col=pow(color.rgb,vec3(2.2));float kind=props.x,rough=props.y,metal=props.z,emissive=props.w;
 if(kind>.5&&kind<1.5){
  float terrainNoise=fbm(world.xz*.0023);float moisture=clamp(uv.x,0.,1.);float drainage=clamp(uv.y,0.,1.);
  vec3 blend=pow(abs(n),vec3(4.));vec3 weights=blend/max(dot(blend,vec3(1.)),.001);
  float grain=noise(world.yz*.24)*weights.x+noise(world.xz*.24)*weights.y+noise(world.xy*.24)*weights.z;
  float detail=noise(world.xz*1.3);
  vec3 grass=pow(u.ground.rgb,vec3(2.2))*(.65+terrainNoise*.65+grain*.14);
  vec3 dry=vec3(.29,.235,.125);grass=mix(grass,dry,(1.-moisture)*.24);
  vec3 rock=pow(u.rock.rgb,vec3(2.2))*(.55+grain*.55+terrainNoise*.25);
  float slope=1.-max(0.,n.y);col=mix(grass,rock,smoothstep(.13,.45,slope));
  col=mix(col,rock*.80,drainage*smoothstep(.02,.22,slope)*.32);
  if(u.env.z>2.5&&u.env.z<3.5){
   float strata=.88+.08*sin(world.y*.31+terrainNoise*4.)+.045*sin(world.y*1.13);
   col=mix(grass*vec3(1.08,.96,.8),rock,smoothstep(.07,.30,slope))*strata;
  }
  if(u.env.z>4.5&&u.env.z<5.5){col=mix(col,vec3(.19,.11,.17),smoothstep(.51,.68,terrainNoise)*(1.-smoothstep(.05,.22,slope))*.3);}
  float shore=(1.-smoothstep(u.env.w+1.,u.env.w+12.,world.y))*(1.-smoothstep(.05,.28,slope));
  col=mix(col,vec3(.30,.28,.20),shore*.65);col*=.94+detail*.12;
  float snow=smoothstep(u.viewport.z-65.,u.viewport.z+65.,world.y+(terrainNoise-.5)*110.)*smoothstep(.38,.72,n.y);
  col=mix(col,vec3(.82,.85,.86),snow);col*=1.-u.env.y*.19;rough=.91;
  n=normalize(n+vec3((noise(world.xz*.41)-.5)*.075,0.,(noise(world.zx*.53)-.5)*.075));
 }
 if(kind>5.5&&kind<6.5)col*=.89+noise((world.xz+vec2(world.y*.71,world.y*.31))*5.)*.16;
 if(kind>6.5&&kind<7.5)col*=.7+hash(floor(world.xz*23.))*.6;
 vec3 light=u.sunDay.xyz;float ndl=max(0.,dot(n,light)),visibility=shadeShadow(lightPos,n);vec3 hemi=mix(vec3(.09,.105,.1),vec3(.24,.30,.37),n.y*.5+.5)*mix(.12,1.,u.sunDay.w);vec3 sun=u.sunExposure.rgb*ndl*visibility*u.sunDay.w*(2.6-u.env.x*.9);vec3 halfV=normalize(light+view);float ndh=max(0.,dot(n,halfV)),r=max(.06,rough),alpha=r*r,a2=alpha*alpha,den=ndh*ndh*(a2-1.)+1.,D=a2/(3.14159*den*den+.0001);vec3 F=mix(vec3(.035),col,metal)+(1.-mix(vec3(.035),col,metal))*pow(1.-max(0.,dot(halfV,view)),5.);float nv=max(.02,dot(n,view)),k=(r+1.)*(r+1.)/8.,G=nv/(nv*(1.-k)+k)*ndl/max(.001,ndl*(1.-k)+k);vec3 spec=F*D*G/max(.04,4.*nv*max(ndl,.02));float cloudShadow=mix(1.,.70,smoothstep(.42,.75,fbm(world.xz*.00032+u.cameraTime.w*.0015))*u.env.x);vec3 result=col*hemi+((vec3(1.)-F)*col*(1.-metal)/3.14159+spec)*sun*3.0*cloudShadow;
 if(kind>2.5&&kind<3.5){vec3 refl=atmosphere(reflect(-view,n),false);float fr=.24+.65*pow(1.-max(0.,dot(n,view)),4.);result=mix(col*.4,refl,fr)+spec*sun*.35;}
 if(kind>1.5&&kind<2.5){float t=u.cameraTime.w,wave=sin(world.x*.11+t*.9)*.05+sin(world.z*.17-t*.7)*.035;n=normalize(vec3(wave,1.,cos(world.z*.09+t*.7)*.06));float fr=.04+.88*pow(1.-max(0.,dot(n,view)),4.);vec3 reflection=atmosphere(reflect(-view,n),true);float sparkle=pow(max(0.,dot(reflect(-light,n),view)),170.)*u.sunDay.w*3.;result=mix(pow(color.rgb,vec3(2.2))*(.6+ndl*.45),reflection,fr)+u.sunExposure.rgb*sparkle;}
 if(kind>4.5&&kind<5.5){result*=.7+noise(world.xz*3.1+vec2(world.y*1.7))*.38;result+=col*max(0.,dot(-n,light))*.32*u.sunDay.w;}
 if(u.headPos.w>.01){vec3 delta=world-u.headPos.xyz;float d=length(delta),cone=smoothstep(.90,.982,dot(normalize(delta),u.headDir.xyz));result+=col*vec3(1.,.91,.68)*cone*max(0.,dot(n,-normalize(delta)))*u.headPos.w/(1.+d*d*.008);}
 if(kind>8.5&&kind<9.5){float foam=.64+.36*noise(vec2(world.x*1.2,world.y*.24+u.cameraTime.w*2.8));result=mix(result,vec3(.64,.79,.82)*foam,.7);}
 if(kind>9.5&&kind<10.5){float crest=.65+.35*sin(world.x*.09+world.z*.12-u.cameraTime.w*1.2);result=mix(result,vec3(.65,.79,.79),crest*.72);}
 result+=col*emissive;float distance=length(world-u.cameraTime.xyz),heightFog=exp(-max(world.y-u.env.w,0.)*.00085),f=1.-exp(-distance*u.fog.w*heightFog);result=mix(result,atmosphere(normalize(world-u.cameraTime.xyz),false),clamp(f,0.,.99));outColor=vec4(aces(result),kind>7.5?color.a:1.);}`;
export const GLSL_SHADOW_VS=`#version 300 es\n`+GLSL_COMMON+`layout(location=0) in vec3 aPos;layout(location=3) in mat4 model;void main(){gl_Position=u.lightVP*model*vec4(aPos,1);}`;
export const GLSL_SHADOW_FS=`#version 300 es\nprecision highp float;void main(){}`;
