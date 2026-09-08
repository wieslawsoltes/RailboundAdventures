/** Half-resolution, world-radius screen-space ambient visibility.
 * Geometry MRT stores octahedral geometric normal, radial camera depth and an
 * estimated indirect-light fraction. No depth readback or CPU pixel processing.
 * Bilateral upsampling happens in the display shader. This is not ray-traced GI.
 */
export function decodeOctahedral(x,y){
 let a=x*2-1,b=y*2-1,z=1-Math.abs(a)-Math.abs(b);
 if(z<0){const old=a;a=(1-Math.abs(b))*(a<0?-1:1);b=(1-Math.abs(old))*(b<0?-1:1);}
 const n=Math.hypot(a,b,z);return [a/n,b/n,z/n];
}
export function occlusionSamples(quality){return quality==='low'?0:quality==='medium'?8:quality==='ultra'?24:16;}
export const OCCLUSION_WGSL=/* wgsl */`
struct Params{invVP:mat4x4f,camera:vec4f,screen:vec4f,tuning:vec4f};
@group(0) @binding(0) var<uniform> u:Params;
@group(0) @binding(1) var geometry:texture_2d<f32>;
struct O{@builtin(position) position:vec4f,@location(0) uv:vec2f};
@vertex fn vs(@builtin(vertex_index) i:u32)->O{let p=vec2f(f32((i<<1u)&2u),f32(i&2u));var o:O;o.position=vec4f(p*2.-1.,0,1);o.uv=vec2f(p.x,1.-p.y);return o;}
fn at(uv:vec2f)->vec4f{let size=vec2i(textureDimensions(geometry));return textureLoad(geometry,clamp(vec2i(uv*vec2f(size)),vec2i(0),size-1),0);}
fn decode(q:vec2f)->vec3f{let f=q*2.-1.;var n=vec3f(f,1.-abs(f.x)-abs(f.y));if(n.z<0.){n=vec3f((1.-abs(n.yx))*sign(n.xy+vec2f(.00001)),n.z);}return normalize(n);}
fn position(uv:vec2f,d:f32)->vec3f{let p=u.invVP*vec4f(uv*vec2f(2,-2)+vec2f(-1,1),1,1);return u.camera.xyz+normalize(p.xyz/p.w-u.camera.xyz)*d;}
@fragment fn fs(v:O)->@location(0) vec4f {
 let center=at(v.uv);if(center.z<.001||center.z>350.){return vec4f(1,center.z,0,1);}
 let p=position(v.uv,center.z);let n=decode(center.xy);let radius=u.tuning.x;
 let pixelRadius=clamp(radius*u.tuning.y/max(center.z,.1),2.,100.);
 let angle=fract(sin(dot(floor(v.position.xy),vec2f(12.9898,78.233)))*43758.5453)*6.283185;
 var sum=0.;var weight=0.;let count=i32(u.tuning.w);
 for(var i=0;i<24;i++){if(i>=count){break;}let fraction=(f32(i)+.5)/f32(count);let a=angle+f32(i)*2.399963;
  let uv=v.uv+vec2f(cos(a),sin(a))*sqrt(fraction)*pixelRadius/u.screen.xy;
  if(any(uv<=vec2f(0))||any(uv>=vec2f(1))){continue;}
  let neighbor=at(uv);if(neighbor.z<.001){continue;}let delta=position(uv,neighbor.z)-p;let distance=length(delta);
  let influence=1.-smoothstep(radius*.35,radius,distance);let horizon=max(0.,dot(n,delta)/max(distance,.001)-.075);
  sum+=horizon*influence;weight+=1.;
 }
 let visibility=clamp(1.-sum/max(weight,1.)*2.6*u.tuning.z,.18,1.);return vec4f(visibility,center.z,0,1);
}`;
const GL_VS=`#version 300 es
precision highp float;out vec2 uv;void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.-1.,0,1);uv=p;}`;
export const OCCLUSION_GLSL=`#version 300 es
precision highp float;uniform mat4 inverseVP;uniform vec4 camera,screen,tuning;uniform sampler2D geometry;in vec2 uv;out vec4 outColor;
vec4 at(vec2 uv){ivec2 size=textureSize(geometry,0);return texelFetch(geometry,clamp(ivec2(uv*vec2(size)),ivec2(0),size-1),0);}
vec3 decode(vec2 q){vec2 f=q*2.-1.;vec3 n=vec3(f,1.-abs(f.x)-abs(f.y));if(n.z<0.)n=vec3((1.-abs(n.yx))*sign(n.xy+vec2(.00001)),n.z);return normalize(n);}
vec3 position(vec2 uv,float d){vec4 p=inverseVP*vec4(uv*2.-1.,1,1);return camera.xyz+normalize(p.xyz/p.w-camera.xyz)*d;}
void main(){vec4 center=at(uv);if(center.z<.001||center.z>350.){outColor=vec4(1,center.z,0,1);return;}
 vec3 p=position(uv,center.z),n=decode(center.xy);float radius=tuning.x,pixelRadius=clamp(radius*tuning.y/max(center.z,.1),2.,100.);
 float angle=fract(sin(dot(floor(gl_FragCoord.xy),vec2(12.9898,78.233)))*43758.5453)*6.283185,sum=0.,weight=0.;int count=int(tuning.w);
 for(int i=0;i<24;i++){if(i>=count)break;float fraction=(float(i)+.5)/float(count),a=angle+float(i)*2.399963;vec2 q=uv+vec2(cos(a),sin(a))*sqrt(fraction)*pixelRadius/screen.xy;
  if(any(lessThanEqual(q,vec2(0)))||any(greaterThanEqual(q,vec2(1))))continue;vec4 neighbor=at(q);if(neighbor.z<.001)continue;
  vec3 delta=position(q,neighbor.z)-p;float distance=length(delta),influence=1.-smoothstep(radius*.35,radius,distance),horizon=max(0.,dot(n,delta)/max(distance,.001)-.075);sum+=horizon*influence;weight+=1.;
 }float visibility=clamp(1.-sum/max(weight,1.)*2.6*tuning.z,.18,1.);outColor=vec4(visibility,center.z,0,1);
}`;
export class ContactOcclusion {
 constructor(){this.frame=new Float32Array(28);this.passCount=0;}
 async initGPU(device){
  this.device=device;this.uniform=device.createBuffer({label:'World-radius ambient occlusion parameters',size:112,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
  const module=device.createShaderModule({code:OCCLUSION_WGSL});const info=await module.getCompilationInfo();if(info.messages.some(m=>m.type==='error'))throw new Error(info.messages.map(m=>m.message).join('\n'));
  this.pipeline=await device.createRenderPipelineAsync({layout:'auto',vertex:{module,entryPoint:'vs'},fragment:{module,entryPoint:'fs',targets:[{format:'rgba16float'}]},primitive:{topology:'triangle-list'}});
 }
 initGL(gl,compile){this.gl=gl;this.program=compile(GL_VS,OCCLUSION_GLSL);this.vao=gl.createVertexArray();this.locations={};for(const key of ['inverseVP','camera','screen','tuning'])this.locations[key]=gl.getUniformLocation(this.program,key);gl.useProgram(this.program);gl.uniform1i(gl.getUniformLocation(this.program,'geometry'),0);}
 resize(width,height,geometry){
  this.release();this.width=Math.max(1,Math.ceil(width/2));this.height=Math.max(1,Math.ceil(height/2));this.geometry=geometry;
  if(this.device){this.texture=this.device.createTexture({label:'Half-resolution ambient visibility and depth',size:[this.width,this.height],format:'rgba16float',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING});this.group=this.device.createBindGroup({layout:this.pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.uniform}},{binding:1,resource:geometry.createView()}]});}
  else if(this.gl){const g=this.gl;this.texture=g.createTexture();g.bindTexture(g.TEXTURE_2D,this.texture);g.texImage2D(g.TEXTURE_2D,0,g.RGBA16F,this.width,this.height,0,g.RGBA,g.HALF_FLOAT,null);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.NEAREST);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.NEAREST);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);this.fb=g.createFramebuffer();g.bindFramebuffer(g.FRAMEBUFFER,this.fb);g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.TEXTURE_2D,this.texture,0);if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE)throw new Error('Ambient visibility framebuffer incomplete');g.bindFramebuffer(g.FRAMEBUFFER,null);}
 }
 prepare(renderer,camera,strength,quality){
  this.passCount=0;this.active=!!this.texture&&strength>0&&occlusionSamples(quality)>0;
  if(!this.active)return;
  this.frame.set(renderer.frame.subarray(16,32));this.frame.set([...camera.position,1],16);
  this.frame.set([renderer.width,renderer.height,0,0],20);this.frame.set([3.2,renderer.height/(2*Math.tan((camera.fov||56)*Math.PI/360)),strength,occlusionSamples(quality)],24);
 }
 encodeGPU(encoder){if(!this.active)return;this.device.queue.writeBuffer(this.uniform,0,this.frame);const pass=encoder.beginRenderPass({label:'Ambient visibility',colorAttachments:[{view:this.texture.createView(),loadOp:'clear',storeOp:'store',clearValue:[1,0,0,1]}]});pass.setPipeline(this.pipeline);pass.setBindGroup(0,this.group);pass.draw(3);pass.end();this.passCount=1;}
 drawGL(){if(!this.active)return;const g=this.gl,l=this.locations;g.bindFramebuffer(g.FRAMEBUFFER,this.fb);g.viewport(0,0,this.width,this.height);g.disable(g.DEPTH_TEST);g.depthMask(false);g.disable(g.BLEND);g.useProgram(this.program);g.uniformMatrix4fv(l.inverseVP,false,this.frame.subarray(0,16));g.uniform4fv(l.camera,this.frame.subarray(16,20));g.uniform4fv(l.screen,this.frame.subarray(20,24));g.uniform4fv(l.tuning,this.frame.subarray(24,28));g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,this.geometry.texture);g.bindVertexArray(this.vao);g.drawArrays(g.TRIANGLES,0,3);g.bindVertexArray(null);this.passCount=1;}
 release(){if(this.device)this.texture?.destroy();else if(this.gl){this.gl.deleteTexture(this.texture);this.gl.deleteFramebuffer(this.fb);}this.texture=null;this.group=null;this.fb=null;}
 dispose(){this.release();this.uniform?.destroy();if(this.gl){this.gl.deleteProgram(this.program);this.gl.deleteVertexArray(this.vao);}}
}
