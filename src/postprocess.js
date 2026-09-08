import {TemporalResolve} from './temporal.js';
import {ContactOcclusion} from './contact-occlusion.js';
/** Linear-light scene -> quarter-resolution bloom -> filmic display transform.
 * Each pass has distinct sampled/attachment resources (no feedback hazards).
 * WebGL float renderability and MSAA counts are queried, never assumed.
 */
import {clamp} from './math.js';
export const LOOKS = Object.freeze({
 natural:{saturation:1.02,contrast:1.03,temperature:0},
 cinema:{saturation:.93,contrast:1.10,temperature:.06},
 alpine:{saturation:.91,contrast:1.04,temperature:-.08},
 vintage:{saturation:.72,contrast:1.06,temperature:.16}
});
export function postOptions(value={}) {
 const v=value&&typeof value==='object'?value:{};
 const finite=(x,lo,hi,d)=>Number.isFinite(x)?clamp(x,lo,hi):d;
 return {look:Object.hasOwn(LOOKS,v.look)?v.look:'natural',bloom:finite(v.bloom,0,1,.24),
  vignette:finite(v.vignette,0,.6,.15),grain:finite(v.grain,0,.15,0),occlusion:finite(v.occlusion,0,1,.85),surfaces:v.surfaces!==false,normalMapping:v.normalMapping!==false,temporal:v.temporal!==false};
}
export function targetSize(width,height,scale=1,max=4096) {
 const w=Math.max(1,Number.isFinite(width)?width:1),h=Math.max(1,Number.isFinite(height)?height:1);
 const s=Math.max(.1,Math.min(Number.isFinite(scale)?scale:1,max/w,max/h));
 // Clamp proportionally, including unusually large/hostile viewport values.
 const k=Math.min(s,max/w,max/h);
 return [Math.max(1,Math.floor(w*k)),Math.max(1,Math.floor(h*k))];
}
export const POST_WGSL=/* wgsl */`
struct Post {screen:vec4f,look:vec4f,style:vec4f};
@group(0) @binding(0) var<uniform> u:Post;
@group(0) @binding(1) var scene:texture_2d<f32>;
@group(0) @binding(2) var glow:texture_2d<f32>;
@group(0) @binding(3) var linearSampler:sampler;
@group(0) @binding(4) var ambientVisibility:texture_2d<f32>;
@group(0) @binding(5) var geometry:texture_2d<f32>;
fn geometryAt(uv:vec2f)->vec4f{let size=vec2i(textureDimensions(geometry));return textureLoad(geometry,clamp(vec2i(uv*vec2f(size)),vec2i(0),size-1),0);}
fn visibilityAt(uv:vec2f,depth:f32)->f32{
 if(u.style.w<.5||depth<.001){return 1.;}let size=vec2i(textureDimensions(ambientVisibility));let center=vec2i(uv*vec2f(size));var sum=0.;var weights=0.;
 for(var y=-1;y<=1;y++){for(var x=-1;x<=1;x++){let q=textureLoad(ambientVisibility,clamp(center+vec2i(x,y),vec2i(0),size-1),0);let w=exp(-abs(q.y-depth)/max(.08,depth*.003))/f32(1+x*x+y*y);sum+=q.x*w;weights+=w;}}
 return select(1.,sum/max(weights,.0001),weights>.0001);
}
struct Out {@builtin(position) position:vec4f,@location(0) uv:vec2f};
@vertex fn vs(@builtin(vertex_index) i:u32)->Out {
 let p=vec2f(f32((i<<1u)&2u),f32(i&2u));var o:Out;
 o.position=vec4f(p*2.-1.,0.,1.);o.uv=vec2f(p.x,1.-p.y);return o;
}
fn sampleScene(uv:vec2f)->vec3f {return textureSampleLevel(scene,linearSampler,uv,0.).rgb;}
fn threshold(c:vec3f)->vec3f {let l=max(max(c.r,c.g),c.b);let knee=clamp(l-.65,0.,.7);let soft=knee*knee/1.4;return c*max(l-1.,soft)/max(l,.0001);}
@fragment fn extract(v:Out)->@location(0) vec4f {
 let d=1./u.screen.xy;var c=vec3f(0);
 c+=sampleScene(v.uv+vec2f(-1.5,-1.5)*d);c+=sampleScene(v.uv+vec2f(1.5,-1.5)*d);
 c+=sampleScene(v.uv+vec2f(-1.5,1.5)*d);c+=sampleScene(v.uv+vec2f(1.5,1.5)*d);
 return vec4f(threshold(c*.25),1);
}
fn blur(uv:vec2f,axis:vec2f)->vec4f {
 let d=axis/vec2f(textureDimensions(scene));var c=sampleScene(uv)*.227027;
 c+=(sampleScene(uv+d*1.384615)+sampleScene(uv-d*1.384615))*.316216;
 c+=(sampleScene(uv+d*3.230769)+sampleScene(uv-d*3.230769))*.070270;
 return vec4f(c,1);
}
@fragment fn blurH(v:Out)->@location(0) vec4f {return blur(v.uv,vec2f(1,0));}
@fragment fn blurV(v:Out)->@location(0) vec4f {return blur(v.uv,vec2f(0,1));}
fn aces(c:vec3f)->vec3f {let x=max(c,vec3f(0));return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),vec3f(0),vec3f(1));}
@fragment fn composite(v:Out)->@location(0) vec4f {
 let g=geometryAt(v.uv);var c=sampleScene(v.uv)*(1.-clamp(select(g.w,-g.w-.1,g.w<0.),0.,.85)*(1.-visibilityAt(v.uv,g.z)))+textureSampleLevel(glow,linearSampler,v.uv,0.).rgb*u.look.x;
 c*=vec3f(1.+u.style.x*.25,1.,1.-u.style.x*.25);
 c=aces(c*u.screen.w);let lum=dot(c,vec3f(.2126,.7152,.0722));c=mix(vec3f(lum),c,u.look.y);
 c=pow(clamp(c,vec3f(0),vec3f(1)),vec3f(u.look.z));
 let q=v.uv*(1.-v.uv);let vig=pow(clamp(q.x*q.y*16.,0.,1.),.28);
 c*=mix(1.,vig,u.look.w);
 c=pow(max(c,vec3f(0)),vec3f(1./2.2));
 let grain=fract(sin(dot(v.position.xy+u.screen.z*17.,vec2f(12.9898,78.233)))*43758.5453)-.5;
 return vec4f(clamp(c+grain*u.style.y,vec3f(0),vec3f(1)),1);
}
`;
const GL_VS=`#version 300 es
precision highp float;out vec2 uv;void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.-1.,0,1);uv=p;}`;
const GL_COMMON=`#version 300 es
precision highp float;uniform vec4 screen,look,style;uniform sampler2D scene,glow,ambientVisibility,geometry;in vec2 uv;out vec4 outColor;
vec3 sampleScene(vec2 p){return texture(scene,p).rgb;}
vec4 geometryAt(vec2 uv){ivec2 size=textureSize(geometry,0);return texelFetch(geometry,clamp(ivec2(uv*vec2(size)),ivec2(0),size-1),0);}
float visibilityAt(vec2 uv,float depth){if(style.w<.5||depth<.001)return 1.;ivec2 size=textureSize(ambientVisibility,0),center=ivec2(uv*vec2(size));float sum=0.,weights=0.;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec4 q=texelFetch(ambientVisibility,clamp(center+ivec2(x,y),ivec2(0),size-1),0);float w=exp(-abs(q.y-depth)/max(.08,depth*.003))/float(1+x*x+y*y);sum+=q.x*w;weights+=w;}return weights>.0001?sum/weights:1.;}
vec3 aces(vec3 c){vec3 x=max(c,vec3(0));return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
`;
const GL_FS={
 extract:GL_COMMON+`void main(){vec2 d=1./screen.xy;vec3 c=(sampleScene(uv+vec2(-1.5,-1.5)*d)+sampleScene(uv+vec2(1.5,-1.5)*d)+sampleScene(uv+vec2(-1.5,1.5)*d)+sampleScene(uv+vec2(1.5,1.5)*d))*.25;float l=max(max(c.r,c.g),c.b),knee=clamp(l-.65,0.,.7);outColor=vec4(c*max(l-1.,knee*knee/1.4)/max(l,.0001),1);}`,
 blurH:GL_COMMON+`void main(){vec2 d=vec2(1,0)/vec2(textureSize(scene,0));vec3 c=sampleScene(uv)*.227027+(sampleScene(uv+d*1.384615)+sampleScene(uv-d*1.384615))*.316216+(sampleScene(uv+d*3.230769)+sampleScene(uv-d*3.230769))*.070270;outColor=vec4(c,1);}`,
 blurV:GL_COMMON+`void main(){vec2 d=vec2(0,1)/vec2(textureSize(scene,0));vec3 c=sampleScene(uv)*.227027+(sampleScene(uv+d*1.384615)+sampleScene(uv-d*1.384615))*.316216+(sampleScene(uv+d*3.230769)+sampleScene(uv-d*3.230769))*.070270;outColor=vec4(c,1);}`,
 composite:GL_COMMON+`void main(){vec4 g=geometryAt(uv);vec3 c=sampleScene(uv)*(1.-clamp(g.w<0.?-g.w-.1:g.w,0.,.85)*(1.-visibilityAt(uv,g.z)))+texture(glow,uv).rgb*look.x;c*=vec3(1.+style.x*.25,1.,1.-style.x*.25);c=style.z>.5?aces(c*screen.w):pow(max(c,vec3(0)),vec3(2.2));float lum=dot(c,vec3(.2126,.7152,.0722));c=mix(vec3(lum),c,look.y);c=pow(clamp(c,vec3(0),vec3(1)),vec3(look.z));vec2 q=uv*(1.-uv);c*=mix(1.,pow(clamp(q.x*q.y*16.,0.,1.),.28),look.w);c=pow(max(c,vec3(0)),vec3(1./2.2));float grain=fract(sin(dot(gl_FragCoord.xy+screen.z*17.,vec2(12.9898,78.233)))*43758.5453)-.5;outColor=vec4(clamp(c+grain*style.y,0.,1.),1);}`
};

export class PostProcessor {
 constructor(){this.options=postOptions();this.width=0;this.height=0;this.passCount=0;this.resources=[];this.frame=new Float32Array(12);this.occlusion=new ContactOcclusion();this.temporal=new TemporalResolve();}
 async initGPU(device,format){
  this.device=device;this.hdr=true;this.format=format;await this.occlusion.initGPU(device);await this.temporal.initGPU(device);
  this.uniform=device.createBuffer({label:'Display transform',size:48,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
  this.sampler=device.createSampler({magFilter:'linear',minFilter:'linear',addressModeU:'clamp-to-edge',addressModeV:'clamp-to-edge'});
  this.layout=device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,buffer:{type:'uniform'}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:'float'}},{binding:2,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:'float'}},{binding:3,visibility:GPUShaderStage.FRAGMENT,sampler:{type:'filtering'}},{binding:4,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:'float'}},{binding:5,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:'float'}}]});
  const module=device.createShaderModule({label:'Linear bloom and filmic display',code:POST_WGSL});
  const errors=(await module.getCompilationInfo()).messages.filter(m=>m.type==='error');
  if(errors.length)throw new Error(errors.map(e=>`${e.lineNum}: ${e.message}`).join('\n'));
  this.pipelines={};
  for(const entryPoint of ['extract','blurH','blurV','composite'])this.pipelines[entryPoint]=await device.createRenderPipelineAsync({
   label:'Post '+entryPoint,layout:device.createPipelineLayout({bindGroupLayouts:[this.layout]}),
   vertex:{module,entryPoint:'vs'},fragment:{module,entryPoint,targets:[{format:entryPoint==='composite'?format:'rgba16float'}]},primitive:{topology:'triangle-list'}
  });
 }
 initGL(gl,compile){
  this.gl=gl;this.hdr=!!gl.getExtension('EXT_color_buffer_float');this.colorFormat=this.hdr?gl.RGBA16F:gl.RGBA8;if(this.hdr){this.occlusion.initGL(gl,compile);this.temporal.initGL(gl,compile);}
  this.programs={};this.locations={};this.vao=gl.createVertexArray();
  for(const [name,fs] of Object.entries(GL_FS)) {
   const p=this.programs[name]=compile(GL_VS,fs),loc=this.locations[name]={};gl.useProgram(p);
   for(const key of ['screen','look','style'])loc[key]=gl.getUniformLocation(p,key);
   gl.uniform1i(gl.getUniformLocation(p,'scene'),0);gl.uniform1i(gl.getUniformLocation(p,'glow'),1);gl.uniform1i(gl.getUniformLocation(p,'geometry'),2);gl.uniform1i(gl.getUniformLocation(p,'ambientVisibility'),3);
  }
  const colorSamples=Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER,this.colorFormat,gl.SAMPLES));
  const depthSamples=Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,gl.SAMPLES));
  this.samples=Math.max(0,...colorSamples.filter(n=>n<=4&&depthSamples.includes(n)));
 }
 releaseTargets(){
  if(this.device){for(const r of this.resources)r.destroy();}
  else if(this.gl)for(const [kind,r] of this.resources)this.gl[kind](r);
  this.resources=[];this.groups=null;this.occlusion.release();this.temporal.release();this.groupCache=new Map();
 }
 resize(w,h){
  if(this.width===w&&this.height===h)return;
  this.releaseTargets();this.width=w;this.height=h;this.bw=Math.max(1,Math.floor(w/4));this.bh=Math.max(1,Math.floor(h/4));
  if(this.device){
   const texture=(width,height)=>{const t=this.device.createTexture({size:[width,height],format:'rgba16float',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING});this.resources.push(t);return t;};
   this.scene=texture(w,h);this.geometry=texture(w,h);this.occlusion.resize(w,h,this.geometry);this.a=texture(this.bw,this.bh);this.b=texture(this.bw,this.bh);
   const group=this.makeGroup=(scene,glow)=>this.device.createBindGroup({layout:this.layout,entries:[{binding:0,resource:{buffer:this.uniform}},{binding:1,resource:scene.createView()},{binding:2,resource:glow.createView()},{binding:3,resource:this.sampler},{binding:4,resource:this.occlusion.texture.createView()},{binding:5,resource:this.geometry.createView()}]});
   // Unused bindings also must never alias the current render attachment.
   this.groups={extract:group(this.scene,this.scene),blurH:group(this.a,this.scene),blurV:group(this.b,this.scene),composite:group(this.scene,this.a)};
  } else {
   const g=this.gl,own=(kind,r)=>{this.resources.push([kind,r]);return r;};
   const target=(width,height)=>{
    const texture=own('deleteTexture',g.createTexture());g.bindTexture(g.TEXTURE_2D,texture);
    g.texImage2D(g.TEXTURE_2D,0,this.colorFormat,width,height,0,g.RGBA,this.hdr?g.HALF_FLOAT:g.UNSIGNED_BYTE,null);
    for(const [p,v] of [[g.TEXTURE_MIN_FILTER,g.LINEAR],[g.TEXTURE_MAG_FILTER,g.LINEAR],[g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE],[g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE]])g.texParameteri(g.TEXTURE_2D,p,v);
    const fb=own('deleteFramebuffer',g.createFramebuffer());g.bindFramebuffer(g.FRAMEBUFFER,fb);g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.TEXTURE_2D,texture,0);
    return {texture,fb};
   };
   this.scene=target(w,h);this.geometry=target(w,h);if(this.hdr)this.occlusion.resize(w,h,this.geometry);this.a=target(this.bw,this.bh);this.b=target(this.bw,this.bh);
   this.sceneFB=this.scene.fb;
   if(this.samples){
    this.sceneFB=own('deleteFramebuffer',g.createFramebuffer());g.bindFramebuffer(g.FRAMEBUFFER,this.sceneFB);
    const color=own('deleteRenderbuffer',g.createRenderbuffer());g.bindRenderbuffer(g.RENDERBUFFER,color);g.renderbufferStorageMultisample(g.RENDERBUFFER,this.samples,this.colorFormat,w,h);g.framebufferRenderbuffer(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.RENDERBUFFER,color);
   }else g.bindFramebuffer(g.FRAMEBUFFER,this.sceneFB);
   if(this.hdr){
    if(this.samples){const auxiliary=own('deleteRenderbuffer',g.createRenderbuffer());g.bindRenderbuffer(g.RENDERBUFFER,auxiliary);g.renderbufferStorageMultisample(g.RENDERBUFFER,this.samples,this.colorFormat,w,h);g.framebufferRenderbuffer(g.FRAMEBUFFER,g.COLOR_ATTACHMENT1,g.RENDERBUFFER,auxiliary);}
    else g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT1,g.TEXTURE_2D,this.geometry.texture,0);
    g.drawBuffers([g.COLOR_ATTACHMENT0,g.COLOR_ATTACHMENT1]);
   }
   const depth=own('deleteRenderbuffer',g.createRenderbuffer());g.bindRenderbuffer(g.RENDERBUFFER,depth);
   if(this.samples)g.renderbufferStorageMultisample(g.RENDERBUFFER,this.samples,g.DEPTH_COMPONENT24,w,h);else g.renderbufferStorage(g.RENDERBUFFER,g.DEPTH_COMPONENT24,w,h);
   g.framebufferRenderbuffer(g.FRAMEBUFFER,g.DEPTH_ATTACHMENT,g.RENDERBUFFER,depth);
   if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE)throw new Error('Scene framebuffer is incomplete');
   g.bindFramebuffer(g.FRAMEBUFFER,null);g.bindRenderbuffer(g.RENDERBUFFER,null);
  }
 }
 update(env,time,quality){
  const o=postOptions(this.options),look=LOOKS[o.look];this.bloomActive=o.bloom>0&&quality!=='low'&&this.hdr;
  this.frame.set([this.width,this.height,time,Number.isFinite(env.exposure)?env.exposure:1]);
  this.frame.set([this.bloomActive?o.bloom:0,look.saturation,look.contrast,o.vignette],4);
  this.frame.set([look.temperature,o.grain,this.hdr?1:0,this.occlusion.active?1:0],8);
 }
 encodeGPU(encoder,output,env,time,quality){
  if(this.temporalRevision!==this.temporal.resourceRevision){this.groupCache.clear();this.temporalRevision=this.temporal.resourceRevision;}
  const source=this.temporal.active?this.temporal.encodeGPU(encoder):this.scene;
  if(source!==this.scene){if(!this.groupCache.has(source))this.groupCache.set(source,{extract:this.makeGroup(source,source),composite:this.makeGroup(source,this.a)});Object.assign(this.groups,this.groupCache.get(source));}
  else{if(!this.groupCache.has(source))this.groupCache.set(source,{extract:this.makeGroup(source,source),composite:this.makeGroup(source,this.a)});Object.assign(this.groups,this.groupCache.get(source));}
  this.update(env,time,quality);this.device.queue.writeBuffer(this.uniform,0,this.frame);this.passCount=0;
  const pass=(name,view)=>{const p=encoder.beginRenderPass({label:'Post '+name,colorAttachments:[{view,loadOp:'clear',storeOp:'store',clearValue:{r:0,g:0,b:0,a:1}}]});p.setPipeline(this.pipelines[name]);p.setBindGroup(0,this.groups[name]);p.draw(3);p.end();this.passCount++;};
  if(this.bloomActive){pass('extract',this.a.createView());pass('blurH',this.b.createView());pass('blurV',this.a.createView());}
  pass('composite',output);
 }
 drawGL(env,time,quality){
  this.update(env,time,quality);const g=this.gl;this.passCount=0;
  if(this.samples){g.bindFramebuffer(g.READ_FRAMEBUFFER,this.sceneFB);g.readBuffer(g.COLOR_ATTACHMENT0);g.bindFramebuffer(g.DRAW_FRAMEBUFFER,this.scene.fb);g.drawBuffers([g.COLOR_ATTACHMENT0]);g.blitFramebuffer(0,0,this.width,this.height,0,0,this.width,this.height,g.COLOR_BUFFER_BIT,g.NEAREST);
   if(this.hdr){g.readBuffer(g.COLOR_ATTACHMENT1);g.bindFramebuffer(g.DRAW_FRAMEBUFFER,this.geometry.fb);g.drawBuffers([g.COLOR_ATTACHMENT0]);g.blitFramebuffer(0,0,this.width,this.height,0,0,this.width,this.height,g.COLOR_BUFFER_BIT,g.NEAREST);g.readBuffer(g.COLOR_ATTACHMENT0);}}
  const resolved=this.temporal.active?this.temporal.drawGL():this.scene.texture;
  this.occlusion.drawGL();
  g.disable(g.DEPTH_TEST);g.disable(g.BLEND);g.depthMask(false);g.bindVertexArray(this.vao);
  const pass=(name,target,source,glow,w,h)=>{
   g.bindFramebuffer(g.FRAMEBUFFER,target);g.drawBuffers(target?[g.COLOR_ATTACHMENT0]:[g.BACK]);g.viewport(0,0,w,h);g.useProgram(this.programs[name]);const l=this.locations[name];
   g.uniform4fv(l.screen,this.frame.subarray(0,4));g.uniform4fv(l.look,this.frame.subarray(4,8));g.uniform4fv(l.style,this.frame.subarray(8,12));
   g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,source);g.activeTexture(g.TEXTURE1);g.bindTexture(g.TEXTURE_2D,glow);g.activeTexture(g.TEXTURE2);g.bindTexture(g.TEXTURE_2D,this.geometry.texture);g.activeTexture(g.TEXTURE3);g.bindTexture(g.TEXTURE_2D,this.occlusion.texture||this.geometry.texture);g.drawArrays(g.TRIANGLES,0,3);this.passCount++;
  };
  if(this.bloomActive){pass('extract',this.a.fb,resolved,resolved,this.bw,this.bh);pass('blurH',this.b.fb,this.a.texture,this.scene.texture,this.bw,this.bh);pass('blurV',this.a.fb,this.b.texture,this.scene.texture,this.bw,this.bh);}
  pass('composite',null,resolved,this.a.texture,this.width,this.height);
  g.activeTexture(g.TEXTURE0);g.bindVertexArray(null);g.depthMask(true);g.enable(g.DEPTH_TEST);
 }
 dispose(){this.releaseTargets();this.occlusion.dispose();this.temporal.dispose();this.uniform?.destroy?.();if(this.gl){for(const p of Object.values(this.programs))this.gl.deleteProgram(p);this.gl.deleteVertexArray(this.vao);}}
}
