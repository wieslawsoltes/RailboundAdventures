/** Test-only readback of actual HDR scene/geometry/history targets. */
async () => {
 const r=railbound.renderer,t=r.post.temporal;
 if(!t.active||!t.valid)throw new Error('Temporal probe requires a resolved frame');
 const w=r.width,h=r.height;
 if(r.device){
  const d=r.device;d.pushErrorScope('validation');
  const module=d.createShaderModule({code:`
   @group(0) @binding(0) var scene:texture_2d<f32>;
   @group(0) @binding(1) var geom:texture_2d<f32>;
   @group(0) @binding(2) var resolved:texture_2d<f32>;
   @group(0) @binding(3) var previous:texture_2d<f32>;
   @group(0) @binding(4) var<storage,read_write> result:array<atomic<u32>,6>;
   @compute @workgroup_size(8,8) fn main(@builtin(global_invocation_id) id:vec3u){
    let size=textureDimensions(scene);if(any(id.xy>=size)){return;}
    let p=vec2i(id.xy);let g=textureLoad(geom,p,0);let a=textureLoad(scene,p,0);let b=textureLoad(resolved,p,0);
    let delta=abs(a.rgb-b.rgb);let difference=max(max(delta.x,delta.y),delta.z);
    if(g.w<0.){atomicAdd(&result[0],1u);atomicMax(&result[1],bitcast<u32>(difference));if(b.a<0.){atomicAdd(&result[2],1u);}}
    if(g.w>=0.&&g.z>.01){
     var wasReactive=true;for(var y=-2;y<=2;y++){for(var x=-2;x<=2;x++){
      if(textureLoad(previous,clamp(p+vec2i(x,y),vec2i(0),vec2i(size)-1),0).a>=0.){wasReactive=false;}
     }}
     if(wasReactive){atomicAdd(&result[3],1u);atomicMax(&result[4],bitcast<u32>(difference));}
    }
   }`});
  const pipeline=await d.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}});
  const result=d.createBuffer({size:24,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});
  const read=d.createBuffer({size:24,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
  try{
   const textures=[r.post.scene,r.post.geometry,t.history[t.write^1],t.history[t.write]];
   const bind=d.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[...textures.map((tex,i)=>({binding:i,resource:tex.createView()})),{binding:4,resource:{buffer:result}}]});
   const e=d.createCommandEncoder(),p=e.beginComputePass();p.setPipeline(pipeline);p.setBindGroup(0,bind);p.dispatchWorkgroups(Math.ceil(w/8),Math.ceil(h/8));p.end();e.copyBufferToBuffer(result,0,read,0,24);d.queue.submit([e.finish()]);
   await read.mapAsync(GPUMapMode.READ);const words=new Uint32Array(read.getMappedRange()).slice();read.unmap();
   const asFloat=n=>new Float32Array(new Uint32Array([n]).buffer)[0];
   const error=await d.popErrorScope();if(error)throw new Error(error.message);
   return {reactive:words[0],maxReactiveError:asFloat(words[1]),negativeHistory:words[2],disoccluded:words[3],maxDisocclusionError:asFloat(words[4])};
  }finally{read.destroy();result.destroy();}
 }
 const g=r.gl,old=g.getParameter(g.READ_FRAMEBUFFER_BINDING);
 const read=fb=>{g.bindFramebuffer(g.READ_FRAMEBUFFER,fb);g.readBuffer(g.COLOR_ATTACHMENT0);const a=new Float32Array(w*h*4);g.readPixels(0,0,w,h,g.RGBA,g.FLOAT,a);return a;};
 try{
  const a=read(r.post.scene.fb),geometry=read(r.post.geometry.fb),b=read(t.history[t.write^1].fb),previous=read(t.history[t.write].fb);
  const result={reactive:0,maxReactiveError:0,negativeHistory:0,disoccluded:0,maxDisocclusionError:0};
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const i=(y*w+x)*4,difference=Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]));
   if(geometry[i+3]<0){result.reactive++;result.maxReactiveError=Math.max(result.maxReactiveError,difference);if(b[i+3]<0)result.negativeHistory++;}
   else if(geometry[i+2]>.01){
    let wasReactive=true;outer:for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
     if(previous[(Math.max(0,Math.min(h-1,y+dy))*w+Math.max(0,Math.min(w-1,x+dx)))*4+3]>=0){wasReactive=false;break outer;}
    }
    if(wasReactive){result.disoccluded++;result.maxDisocclusionError=Math.max(result.maxDisocclusionError,difference);}
   }
  }
  const error=g.getError();if(error)throw new Error('Temporal readback WebGL '+error);return result;
 }finally{g.bindFramebuffer(g.READ_FRAMEBUFFER,old);}
}
