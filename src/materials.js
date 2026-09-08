/** Auditable, same-origin PBR surface library. No runtime CDN dependencies.
 * Color arrays use hardware sRGB decode; packed XY/roughness/AO stays linear.
 * All mip levels and array layers are initialized before they can be sampled.
 */
export const SURFACE_IDS=Object.freeze(['Ground037','Ground048','Rock030','Asphalt012','PavingStones036','Bark006','Gravel023','Concrete034']);
export const SURFACE_METERS=Object.freeze([2.1,1.4,3,3,2,1,1.5,1.1]);
export function mipSizes(size){if(!Number.isInteger(size)||size<1||size>2048||(size&(size-1)))throw new RangeError('Power-of-two material size required');const result=[];for(let n=size;n>=1;n>>=1)result.push(n);return result;}
export function validateMaterialManifest(value){
 if(!value||value.version!==1||value.size!==512||!Array.isArray(value.layers)||value.layers.length!==SURFACE_IDS.length)throw new Error('Unsupported material library');
 value.layers.forEach((layer,i)=>{if(!layer||layer.id!==SURFACE_IDS[i]||layer.meters!==SURFACE_METERS[i])throw new Error('Material layer order mismatch');for(const kind of ['albedo','surface']){if(!/^[A-Za-z0-9-]+\.(jpg|png)$/.test(layer[kind])||!/^[a-f0-9]{64}$/.test(layer.sha256?.[kind]||''))throw new Error('Invalid material entry');}});
 return value;
}
const MIP_SHADER=`
@group(0) @binding(0) var image:texture_2d<f32>;
@group(0) @binding(1) var linearSampler:sampler;
struct O{@builtin(position) p:vec4f,@location(0) uv:vec2f};
@vertex fn vs(@builtin(vertex_index) i:u32)->O{let p=vec2f(f32((i<<1u)&2u),f32(i&2u));var o:O;o.p=vec4f(p*2.-1.,0,1);o.uv=vec2f(p.x,1.-p.y);return o;}
@fragment fn fs(v:O)->@location(0) vec4f{return textureSampleLevel(image,linearSampler,v.uv,0.);}`;
export class SurfaceLibrary {
 constructor(){this.loaded=0;this.ready=false;this.status='loading';this.errors=[];this.disposed=false;this.abort=new AbortController();this.size=512;}
 async initialize(device,gl){
  this.device=device;this.gl=gl;
  // Memory-constrained devices use 256px maps. The backing source remains 512px.
  this.size=globalThis.matchMedia?.('(max-width: 600px)').matches?256:512;
  this.levels=mipSizes(this.size).length;this.bytes=2*SURFACE_IDS.length*mipSizes(this.size).reduce((n,s)=>n+s*s*4,0);
  if(device)await this.allocateGPU();else this.allocateGL();
  const timeout=setTimeout(()=>this.abort.abort(new Error('Material loading timeout')),30000);
  try{
   const embedded=globalThis.RAILBOUND_MATERIAL_ASSETS;
   const response=embedded?null:await fetch('assets/materials/manifest.json',{signal:this.abort.signal});
   if(response&&!response.ok)throw new Error('Material manifest HTTP '+response.status);
   const manifest=validateMaterialManifest(embedded?.manifest||await response.json());
   // Two concurrent surface pairs bound decode memory on phones.
   for(let first=0;first<manifest.layers.length;first+=2){const result=await Promise.allSettled(manifest.layers.slice(first,first+2).map(async (layer,j)=>{
    const bitmaps=[];
    try{
     for(const kind of ['albedo','surface']){
      const url=embedded?.[layer[kind]]||'assets/materials/'+layer[kind];
      const r=await fetch(url,{signal:this.abort.signal});if(!r.ok)throw new Error(layer.id+' '+r.status);
      const bytes=await r.arrayBuffer();if(bytes.byteLength>3000000)throw new Error('Material budget exceeded');
      if(globalThis.crypto?.subtle){const digest=await crypto.subtle.digest('SHA-256',bytes);const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');if(hash!==layer.sha256[kind])throw new Error('Material checksum mismatch: '+layer.id);}
      const bitmap=await createImageBitmap(new Blob([bytes]),{colorSpaceConversion:'none',premultiplyAlpha:'none',resizeWidth:this.size,resizeHeight:this.size,resizeQuality:'high'});bitmaps.push(bitmap);
     }
     if(this.disposed)return;
     if(device)this.uploadGPU(first+j,bitmaps);else this.uploadGL(first+j,bitmaps);this.loaded++;
    }finally{for(const image of bitmaps)image.close();}
   }));const failure=result.find(r=>r.status==='rejected');if(failure)throw failure.reason;}
   if(this.disposed)return;
   this.ready=this.loaded===SURFACE_IDS.length;this.status=this.ready?'ready':'fallback';
  }catch(error){if(!this.disposed){this.status='fallback';this.errors.push(String(error.message));console.warn('Surface textures unavailable; procedural materials remain active.',error.message);}}finally{clearTimeout(timeout);}
 }
 async allocateGPU(){
  const d=this.device,usage=GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT;
  this.color=d.createTexture({label:'sRGB surface color array',size:[this.size,this.size,8],mipLevelCount:this.levels,format:'rgba8unorm-srgb',usage});
  this.surface=d.createTexture({label:'Linear normal XY, roughness, AO array',size:[this.size,this.size,8],mipLevelCount:this.levels,format:'rgba8unorm',usage});
  this.colorView=this.color.createView({dimension:'2d-array'});this.surfaceView=this.surface.createView({dimension:'2d-array'});
  this.sampler=d.createSampler({addressModeU:'repeat',addressModeV:'repeat',magFilter:'linear',minFilter:'linear',mipmapFilter:'linear',maxAnisotropy:8});
  this.mipSampler=d.createSampler({magFilter:'linear',minFilter:'linear'});
  const module=d.createShaderModule({label:'Linear-space material mip generation',code:MIP_SHADER});this.mipPipelines=[];
  for(const format of ['rgba8unorm-srgb','rgba8unorm'])this.mipPipelines.push(await d.createRenderPipelineAsync({layout:'auto',vertex:{module,entryPoint:'vs'},fragment:{module,entryPoint:'fs',targets:[{format}]},primitive:{topology:'triangle-list'}}));
 }
 uploadGPU(layer,images){
  const d=this.device,encoder=d.createCommandEncoder({label:'Generate surface mip chain'});
  for(const [i,texture] of [this.color,this.surface].entries()){
   d.queue.copyExternalImageToTexture({source:images[i]},{texture,origin:[0,0,layer],premultipliedAlpha:false},[this.size,this.size]);
   for(let level=1;level<this.levels;level++){
    const pipeline=this.mipPipelines[i],view=l=>texture.createView({dimension:'2d',baseArrayLayer:layer,arrayLayerCount:1,baseMipLevel:l,mipLevelCount:1});
    const group=d.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:view(level-1)},{binding:1,resource:this.mipSampler}]});
    const pass=encoder.beginRenderPass({colorAttachments:[{view:view(level),loadOp:'clear',storeOp:'store',clearValue:[0,0,0,0]}]});pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.draw(3);pass.end();
   }
  }d.queue.submit([encoder.finish()]);
 }
 allocateGL(){
  const g=this.gl;this.color=g.createTexture();this.surface=g.createTexture();const anisotropy=g.getExtension('EXT_texture_filter_anisotropic');
  for(const [i,texture] of [this.color,this.surface].entries()){
   g.bindTexture(g.TEXTURE_2D_ARRAY,texture);g.texStorage3D(g.TEXTURE_2D_ARRAY,this.levels,i===0?g.SRGB8_ALPHA8:g.RGBA8,this.size,this.size,8);
   g.texParameteri(g.TEXTURE_2D_ARRAY,g.TEXTURE_MIN_FILTER,g.LINEAR_MIPMAP_LINEAR);g.texParameteri(g.TEXTURE_2D_ARRAY,g.TEXTURE_MAG_FILTER,g.LINEAR);
   g.texParameteri(g.TEXTURE_2D_ARRAY,g.TEXTURE_WRAP_S,g.REPEAT);g.texParameteri(g.TEXTURE_2D_ARRAY,g.TEXTURE_WRAP_T,g.REPEAT);
   if(anisotropy)g.texParameterf(g.TEXTURE_2D_ARRAY,anisotropy.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(8,g.getParameter(anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
  }g.bindTexture(g.TEXTURE_2D_ARRAY,null);
 }
 uploadGL(layer,images){
  const g=this.gl;g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL,false);g.pixelStorei(g.UNPACK_COLORSPACE_CONVERSION_WEBGL,g.NONE);
  for(const [i,texture] of [this.color,this.surface].entries()){
   g.bindTexture(g.TEXTURE_2D_ARRAY,texture);g.texSubImage3D(g.TEXTURE_2D_ARRAY,0,0,0,layer,this.size,this.size,1,g.RGBA,g.UNSIGNED_BYTE,images[i]);g.generateMipmap(g.TEXTURE_2D_ARRAY);
  }g.bindTexture(g.TEXTURE_2D_ARRAY,null);
 }
 bindGL(program){const g=this.gl;g.useProgram(program);for(const [i,key,texture] of [[1,'materialColor',this.color],[2,'materialSurface',this.surface]]){g.activeTexture(g.TEXTURE0+i);g.bindTexture(g.TEXTURE_2D_ARRAY,texture);g.uniform1i(g.getUniformLocation(program,key),i);}g.activeTexture(g.TEXTURE0);}
 dispose(){if(this.disposed)return;this.disposed=true;this.abort.abort();if(this.device){this.color?.destroy();this.surface?.destroy();}else if(this.gl){this.gl.deleteTexture(this.color);this.gl.deleteTexture(this.surface);}this.ready=false;this.status='disposed';}
}
