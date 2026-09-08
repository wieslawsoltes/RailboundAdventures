/** Camera-reprojected temporal antialiasing for static opaque geometry.
 * Moving rolling stock, water and transparent effects reject history. Foliage
 * uses conservative neighborhood/depth rejection (no fabricated motion vectors).
 * MSAA remains the spatial fallback at all quality levels.
 */
import {mat4Inverse,sub,norm,dot,length} from './math.js';
export function halton(index,base){if(!Number.isSafeInteger(index)||index<0||!Number.isInteger(base)||base<2)throw new RangeError('Invalid Halton sequence');let value=0,fraction=1;for(let i=index;i>0;i=Math.floor(i/base)){fraction/=base;value+=(i%base)*fraction;}return value;}
export function temporalJitter(index){return [halton((index%8)+1,2)-.5,halton((index%8)+1,3)-.5];}
export function temporalCameraCut(previous,current){
 if(!previous)return true;
 return previous.mode!==current.mode||Math.abs(previous.fov-current.fov)>.01||length(sub(previous.position,current.position))>30||dot(previous.direction,current.direction)<.85;
}
export function encodeIndirect(share,reactive=false){const v=Math.min(.85,Math.max(0,share));return reactive?-v-.1:v;}
export function decodeIndirect(encoded){return Math.min(.85,Math.max(0,encoded<0?-encoded-.1:encoded));}
export function clipHistory(history,low,high){return history.map((v,i)=>Math.max(low[i],Math.min(high[i],v)));}
export const TEMPORAL_WGSL=`
struct Settings{inverseVP:mat4x4f,previousVP:mat4x4f,camera:vec4f,previousCamera:vec4f,params:vec4f,flags:vec4f};
@group(0) @binding(0) var<uniform> u:Settings;
@group(0) @binding(1) var current:texture_2d<f32>;
@group(0) @binding(2) var geometry:texture_2d<f32>;
@group(0) @binding(3) var history:texture_2d<f32>;
@group(0) @binding(4) var filterSampler:sampler;
struct V{@builtin(position) p:vec4f,@location(0) uv:vec2f};
@vertex fn vs(@builtin(vertex_index) i:u32)->V{let p=vec2f(f32((i<<1u)&2u),f32(i&2u));var o:V;o.p=vec4f(p*2.-1.,0,1);o.uv=vec2f(p.x,1.-p.y);return o;}
fn yc(c:vec3f)->vec3f{return vec3f(dot(c,vec3f(.25,.5,.25)),(c.r-c.b)*.5,c.g*.5-(c.r+c.b)*.25);}
fn rgb(c:vec3f)->vec3f{return vec3f(c.x+c.y-c.z,c.x+c.z,c.x-c.y-c.z);}
@fragment fn fs(v:V)->@location(0) vec4f{
 let size=vec2i(textureDimensions(current));let pixel=clamp(vec2i(v.p.xy),vec2i(0),size-1);
 let now=textureLoad(current,pixel,0).rgb;let g=textureLoad(geometry,pixel,0);let depth=g.z;let storedDepth=select(depth,-max(depth,.01),g.w<0.);
 if(u.params.z<.5||depth<.01||g.w<0.){return vec4f(now,storedDepth);}
 let farPoint=u.inverseVP*vec4f(v.uv*vec2f(2.,-2.)+vec2f(-1.,1.),1,1);
 let world=u.camera.xyz+normalize(farPoint.xyz/farPoint.w-u.camera.xyz)*depth;
 let clip=u.previousVP*vec4f(world,1);if(clip.w<=0.){return vec4f(now,storedDepth);}
 let previousUV=clip.xy/clip.w*vec2f(.5,-.5)+vec2f(.5);
 if(any(previousUV<vec2f(0))||any(previousUV>vec2f(1))){return vec4f(now,storedDepth);}
 let previousPixel=clamp(vec2i(previousUV*vec2f(size)),vec2i(0),size-1);
 let oldDepth=textureLoad(history,previousPixel,0).a;let expected=length(world-u.previousCamera.xyz);
 if(oldDepth<.01||abs(oldDepth-expected)>max(.12,expected*.003)){return vec4f(now,storedDepth);}
 // Reject every contributing bilinear tap, not only the nearest history pixel.
 // Otherwise a moving train can leak into an adjacent static pixel at silhouettes.
 let corner=vec2i(floor(previousUV*vec2f(size)-vec2f(.5)));
 for(var hy=0;hy<2;hy++){for(var hx=0;hx<2;hx++){
  let hd=textureLoad(history,clamp(corner+vec2i(hx,hy),vec2i(0),size-1),0).a;
  if(hd<.01||abs(hd-expected)>max(.12,expected*.003)){return vec4f(now,storedDepth);}
 }}
 var low=vec3f(1e10);var high=vec3f(-1e10);var mean=vec3f(0);var square=vec3f(0);
 for(var y=-1;y<=1;y++){for(var x=-1;x<=1;x++){
  let c=yc(textureLoad(current,clamp(pixel+vec2i(x,y),vec2i(0),size-1),0).rgb);
  low=min(low,c);high=max(high,c);mean+=c;square+=c*c;
 }}mean/=9.;let sigma=sqrt(max(vec3f(0),square/9.-mean*mean));
 let old=yc(textureSampleLevel(history,filterSampler,previousUV,0.).rgb);
 let clipped=clamp(old,max(low,mean-sigma*1.5),min(high,mean+sigma*1.5));
 let motion=length((previousUV-v.uv)*u.params.xy);let change=abs(clipped.x-yc(now).x)/max(.05,yc(now).x);
 let weight=u.params.w*clamp(1.-motion*.025,.15,1.)*clamp(1.-change*.75,.15,1.);
 return vec4f(max(vec3f(0),mix(now,rgb(clipped),weight)),depth);
}`;
const GL_VERTEX=`#version 300 es
precision highp float;out vec2 uv;void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.-1.,0,1);uv=p;}`;
export const TEMPORAL_GLSL=`#version 300 es
precision highp float;uniform mat4 inverseVP,previousVP;uniform vec4 camera,previousCamera,params;uniform sampler2D current,geometry,history;in vec2 uv;out vec4 result;
vec3 yc(vec3 c){return vec3(dot(c,vec3(.25,.5,.25)),(c.r-c.b)*.5,c.g*.5-(c.r+c.b)*.25);}
vec3 rgb(vec3 c){return vec3(c.x+c.y-c.z,c.x+c.z,c.x-c.y-c.z);}
void main(){
 ivec2 size=textureSize(current,0),pixel=clamp(ivec2(gl_FragCoord.xy),ivec2(0),size-1);
 vec3 now=texelFetch(current,pixel,0).rgb;vec4 g=texelFetch(geometry,pixel,0);float depth=g.z;float storedDepth=g.w<0.?-max(depth,.01):depth;result=vec4(now,storedDepth);
 if(params.z<.5||depth<.01||g.w<0.)return;
 vec4 farPoint=inverseVP*vec4(uv*2.-1.,1,1);vec3 world=camera.xyz+normalize(farPoint.xyz/farPoint.w-camera.xyz)*depth;
 vec4 clip=previousVP*vec4(world,1);if(clip.w<=0.)return;vec2 previousUV=clip.xy/clip.w*.5+.5;
 if(any(lessThan(previousUV,vec2(0)))||any(greaterThan(previousUV,vec2(1))))return;
 float oldDepth=texelFetch(history,clamp(ivec2(previousUV*vec2(size)),ivec2(0),size-1),0).a,expected=length(world-previousCamera.xyz);
 if(oldDepth<.01||abs(oldDepth-expected)>max(.12,expected*.003))return;
 ivec2 corner=ivec2(floor(previousUV*vec2(size)-vec2(.5)));
 for(int hy=0;hy<2;hy++)for(int hx=0;hx<2;hx++){
  float hd=texelFetch(history,clamp(corner+ivec2(hx,hy),ivec2(0),size-1),0).a;
  if(hd<.01||abs(hd-expected)>max(.12,expected*.003))return;
 }
 vec3 low=vec3(1e10),high=vec3(-1e10),mean=vec3(0),square=vec3(0);
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec3 c=yc(texelFetch(current,clamp(pixel+ivec2(x,y),ivec2(0),size-1),0).rgb);low=min(low,c);high=max(high,c);mean+=c;square+=c*c;}
 mean/=9.;vec3 sigma=sqrt(max(vec3(0),square/9.-mean*mean));vec3 old=yc(texture(history,previousUV).rgb),clipped=clamp(old,max(low,mean-sigma*1.5),min(high,mean+sigma*1.5));
 float motion=length((previousUV-uv)*params.xy),change=abs(clipped.x-yc(now).x)/max(.05,yc(now).x);
 float weight=params.w*clamp(1.-motion*.025,.15,1.)*clamp(1.-change*.75,.15,1.);result=vec4(max(vec3(0),mix(now,rgb(clipped),weight)),depth);
}`;
export class TemporalResolve {
 constructor(){this.uniformData=new Float32Array(48);this.history=[];this.valid=false;this.active=false;this.sample=0;this.write=0;this.passCount=0;this.resetCount=0;this.width=0;this.height=0;this.resourceRevision=0;}
 async initGPU(device){
  this.device=device;this.uniform=device.createBuffer({label:'Temporal reprojection state',size:192,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
  this.sampler=device.createSampler({minFilter:'linear',magFilter:'linear'});
  const module=device.createShaderModule({label:'Variance-clipped camera temporal resolve',code:TEMPORAL_WGSL});
  const errors=(await module.getCompilationInfo()).messages.filter(m=>m.type==='error');if(errors.length)throw new Error(errors.map(e=>e.message).join('\n'));
  this.pipeline=await device.createRenderPipelineAsync({layout:'auto',vertex:{module,entryPoint:'vs'},fragment:{module,entryPoint:'fs',targets:[{format:'rgba16float'}]},primitive:{topology:'triangle-list'}});
 }
 initGL(gl,compile){this.gl=gl;this.program=compile(GL_VERTEX,TEMPORAL_GLSL);this.vao=gl.createVertexArray();this.locations={};for(const name of ['inverseVP','previousVP','camera','previousCamera','params','current','geometry','history'])this.locations[name]=gl.getUniformLocation(this.program,name);}
 invalidate(reason='explicit'){this.valid=false;this.sample=0;this.resetCount++;this.reason=reason;}
 release(){if(this.history.length)this.resourceRevision++;for(const target of this.history){if(this.device)target.destroy();else{this.gl.deleteTexture(target.texture);this.gl.deleteFramebuffer(target.fb);}}this.history=[];this.groups=null;this.width=0;this.height=0;this.invalidate('targets');}
 resize(width,height,scene,geometry){
  if(width===this.width&&height===this.height&&this.scene===scene&&this.geometry===geometry)return;
  this.release();this.width=width;this.height=height;this.scene=scene;this.geometry=geometry;this.write=0;
  for(let i=0;i<2;i++){
   if(this.device)this.history.push(this.device.createTexture({label:'Temporal history '+i,size:[width,height],format:'rgba16float',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.RENDER_ATTACHMENT}));
   else{const g=this.gl,t=g.createTexture(),fb=g.createFramebuffer();g.bindTexture(g.TEXTURE_2D,t);g.texImage2D(g.TEXTURE_2D,0,g.RGBA16F,width,height,0,g.RGBA,g.HALF_FLOAT,null);for(const [k,v]of[[g.TEXTURE_MIN_FILTER,g.LINEAR],[g.TEXTURE_MAG_FILTER,g.LINEAR],[g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE],[g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE]])g.texParameteri(g.TEXTURE_2D,k,v);g.bindFramebuffer(g.FRAMEBUFFER,fb);g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.TEXTURE_2D,t,0);if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE)throw new Error('Temporal framebuffer incomplete');this.history.push({texture:t,fb});}
  }
  if(this.device)this.groups=this.history.map(history=>this.device.createBindGroup({layout:this.pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.uniform}},{binding:1,resource:scene.createView()},{binding:2,resource:geometry.createView()},{binding:3,resource:history.createView()},{binding:4,resource:this.sampler}]}));
  else this.gl.bindFramebuffer(this.gl.FRAMEBUFFER,null);
 }
 prepare(renderer,camera,unjitteredVP,world,env,sceneKey){
  const post=renderer.post,enabled=post.hdr&&post.options.temporal!==false&&['high','ultra'].includes(renderer.settings.quality);
  this.passCount=0;this.active=enabled;
  if(!enabled){if(this.history.length)this.release();this.valid=false;return [0,0];}
  this.resize(renderer.width,renderer.height,post.scene,post.geometry);
  const signature=[world.id,env.weather,Math.round(env.hour*8),renderer.settings.quality,renderer.settings.shadows,renderer.settings.surfaces,renderer.settings.normalMapping].join('|');
  const state={mode:camera.mode,fov:camera.fov||56,position:camera.position.slice(),direction:norm(sub(camera.target,camera.position))};
  if(this.sceneKey!==sceneKey||this.signature!==signature||temporalCameraCut(this.previousState,state))this.invalidate('camera/environment/scene');
  this.sceneKey=sceneKey;this.signature=signature;this.pendingState=state;this.pendingVP=unjitteredVP.slice();
  this.uniformData.set(mat4Inverse(unjitteredVP),0);this.uniformData.set(this.previousVP||unjitteredVP,16);
  this.uniformData.set([...state.position,1],32);this.uniformData.set([...(this.previousState?.position||state.position),1],36);
  this.uniformData.set([this.width,this.height,this.valid?1:0,.82],40);return temporalJitter(this.sample++);
 }
 /** Capture the exact projection that rasterized radial depth, including jitter. */
 setProjection(vp){if(!this.active)return;this.pendingVP=vp.slice();this.uniformData.set(mat4Inverse(vp),0);if(!this.valid)this.uniformData.set(vp,16);}
 commit(){this.previousState=this.pendingState;this.previousVP=this.pendingVP;this.valid=true;this.write^=1;this.passCount=1;}
 encodeGPU(encoder){
  if(!this.active)return this.scene;
  const output=this.history[this.write];this.device.queue.writeBuffer(this.uniform,0,this.uniformData);
  const pass=encoder.beginRenderPass({label:'Temporal resolve',colorAttachments:[{view:output.createView(),loadOp:'clear',storeOp:'store',clearValue:[0,0,0,0]}]});pass.setPipeline(this.pipeline);pass.setBindGroup(0,this.groups[this.write^1]);pass.draw(3);pass.end();this.commit();return output;
 }
 drawGL(){
  if(!this.active)return this.scene?.texture;
  const g=this.gl,o=this.history[this.write],l=this.locations;g.bindFramebuffer(g.FRAMEBUFFER,o.fb);g.drawBuffers([g.COLOR_ATTACHMENT0]);g.viewport(0,0,this.width,this.height);g.disable(g.DEPTH_TEST);g.disable(g.BLEND);g.depthMask(false);g.bindVertexArray(this.vao);g.useProgram(this.program);
  g.uniformMatrix4fv(l.inverseVP,false,this.uniformData.subarray(0,16));g.uniformMatrix4fv(l.previousVP,false,this.uniformData.subarray(16,32));g.uniform4fv(l.camera,this.uniformData.subarray(32,36));g.uniform4fv(l.previousCamera,this.uniformData.subarray(36,40));g.uniform4fv(l.params,this.uniformData.subarray(40,44));
  [this.scene.texture,this.geometry.texture,this.history[this.write^1].texture].forEach((t,i)=>{g.activeTexture(g.TEXTURE0+i);g.bindTexture(g.TEXTURE_2D,t);g.uniform1i(l[['current','geometry','history'][i]],i);});g.drawArrays(g.TRIANGLES,0,3);this.commit();return o.texture;
 }
 dispose(){this.release();this.uniform?.destroy();if(this.gl){this.gl.deleteProgram(this.program);this.gl.deleteVertexArray(this.vao);}}
}
