import {stationLandUse} from './land-use.js';
/** Curated CC0 art: immutable geometry and independently owned GPU texture arrays.
 * A failed art download never prevents driving: the procedural scene remains usable.
 */
import {SurfaceLibrary} from './materials.js';
import {Geometry,PRIMITIVES,Batch} from './geometry.js';
import {rng,hash2,clamp,transform} from './math.js';
export const AUTHORED_IDS=Object.freeze(['rock_moss_set_01','tree_stump_02','fern_02','pine_tree_01']);
export const AUTHORED_MODELS=new Map();
export const AUTHORED_STATE={ready:false,revision:0};
const HASH=/^[a-f0-9]{64}$/;
export function validateAuthoredManifest(value){
 if(!value||value.version!==1||value.size!==512||value.meshFile!=='hero-meshes.bin'||!HASH.test(value.meshHash||''))throw new Error('Unsupported authored library');
 if(!Number.isInteger(value.meshBytes)||value.meshBytes<16||value.meshBytes>16000000)throw new Error('Authored mesh budget');
 if(!Array.isArray(value.layers)||value.layers.length!==4||!Array.isArray(value.meshes)||value.meshes.length>32||!value.meshes.length)throw new Error('Authored layer count');
 value.layers.forEach((l,i)=>{if(l.id!==AUTHORED_IDS[i]||l.license!=='CC0-1.0')throw new Error('Authored layer order/license');for(const k of ['albedo','surface'])if(!/^[a-z0-9-]+\.png$/.test(l[k])||!HASH.test(l.sha256?.[k]||''))throw new Error('Invalid authored map');});
 const names=new Set(),ranges=[];
 for(const m of value.meshes){
  if(!/^[a-zA-Z0-9_-]+$/.test(m.name)||names.has(m.name)||!Number.isInteger(m.layer)||m.layer<0||m.layer>2||typeof m.cutout!=='boolean')throw new Error('Invalid authored mesh');names.add(m.name);
  if(!Array.isArray(m.lods)||m.lods.length!==3||!Array.isArray(m.bounds)||m.bounds.length!==2||!m.bounds.every(b=>Array.isArray(b)&&b.length===3&&b.every(Number.isFinite)))throw new Error('Invalid authored bounds/LODs');
  if(m.bounds[0].some((v,i)=>v>m.bounds[1][i])||m.bounds.flat().some(v=>Math.abs(v)>50))throw new Error('Authored geometry outside metre budget');
  let previous=Infinity;
  for(const l of m.lods){
   if(!Number.isInteger(l.vertexCount)||l.vertexCount<3||l.vertexCount>100000||!Number.isInteger(l.indexCount)||l.indexCount<3||l.indexCount%3||l.indexCount>300000||l.indexCount>previous||!Number.isFinite(l.error)||l.error<0)throw new Error('Invalid authored LOD counts');previous=l.indexCount;
   for(const [offset,size] of [[l.vertexOffset,l.vertexCount*32],[l.indexOffset,l.indexCount*4]]){
    if(!Number.isInteger(offset)||offset<16||offset%4||offset+size>value.meshBytes)throw new Error('Authored buffer range');ranges.push([offset,offset+size]);
   }
  }
 }
 ranges.sort((a,b)=>a[0]-b[0]);for(let i=1;i<ranges.length;i++)if(ranges[i][0]<ranges[i-1][1])throw new Error('Aliased authored buffers');
 return value;
}
export function decodeAuthoredGeometry(manifest,buffer){
 validateAuthoredManifest(manifest);if(!(buffer instanceof ArrayBuffer)||buffer.byteLength!==manifest.meshBytes)throw new Error('Authored buffer length');
 const head=new DataView(buffer);if(head.getUint32(0,true)!==0x31414252||head.getUint32(4,true)!==1||head.getUint32(8,true)!==32)throw new Error('Authored buffer header');
 const models=new Map();
 for(const m of manifest.meshes){
  const lods=m.lods.map(l=>{
   const vertices=new Float32Array(buffer,l.vertexOffset,l.vertexCount*8),indices=new Uint32Array(buffer,l.indexOffset,l.indexCount);
   if(!vertices.every(Number.isFinite)||indices.some(i=>i>=l.vertexCount))throw new Error('Invalid authored vertex/index data');
   for(let i=0;i<vertices.length;i+=8){if(Math.max(Math.abs(vertices[i]),Math.abs(vertices[i+1]),Math.abs(vertices[i+2]))>50||Math.hypot(vertices[i+3],vertices[i+4],vertices[i+5])<.5)throw new Error('Invalid authored normal/position');}
   for(let i=0;i<vertices.length;i+=8)for(let k=0;k<3;k++)if(vertices[i+k]<m.bounds[0][k]-.01||vertices[i+k]>m.bounds[1][k]+.01)throw new Error('Authored LOD escapes declared bounds');
   return new Geometry(vertices,indices);
  });models.set(m.name,{...m,lods});
 }return models;
}
export class AuthoredLibrary extends SurfaceLibrary {
 constructor(){super({layerCount:4,baseURL:'assets/authored/',embedded:'RAILBOUND_AUTHORED_ASSETS',validate:validateAuthoredManifest,unit:3,colorName:'heroColor',surfaceName:'heroSurface'});}
 async initialize(device,gl){
  AUTHORED_STATE.ready=false;
  await super.initialize(device,gl);if(!this.ready)return;
  this.ready=false;AUTHORED_STATE.ready=false;
  const timeout=setTimeout(()=>this.abort.abort(),30000);
  try{
   const embedded=globalThis.RAILBOUND_AUTHORED_ASSETS;
   const response=await fetch(embedded?.['hero-meshes.bin']||'assets/authored/hero-meshes.bin',{signal:this.abort.signal});
   if(!response.ok)throw new Error('Authored mesh HTTP '+response.status);
   const bytes=await response.arrayBuffer();if(bytes.byteLength!==this.manifest.meshBytes)throw new Error('Authored mesh length');
   if(globalThis.crypto?.subtle){const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');if(hash!==this.manifest.meshHash)throw new Error('Authored mesh checksum');}
   const models=decodeAuthoredGeometry(this.manifest,bytes);if(this.disposed)return;
   // Geometry is CPU immutable; renderer ownership of uploaded buffers is separate.
   for(const [name,model] of models){AUTHORED_MODELS.set(name,model);model.lods.forEach((g,i)=>PRIMITIVES['authored-'+name+'-'+i]=g);}
   this.ready=true;this.status='ready';AUTHORED_STATE.ready=true;AUTHORED_STATE.revision++;
  }catch(e){this.status='fallback';this.errors.push(String(e.message));console.warn('Authored props unavailable; procedural scenery retained.',e.message);}finally{clearTimeout(timeout);}
 }
 dispose(){if(this.ready)AUTHORED_STATE.ready=false;super.dispose();}
}
export function authoredSite(world,x,z,radius=1){
 if(!Number.isFinite(x+z+radius)||radius<=0)return null;
 const f=world.terrain;if(!f||stationLandUse(world,x,z,radius))return null;
 const centre=world.surfaceHeight(x,z),low=world.def.water+(.18);
 if(!Number.isFinite(centre)||centre<low)return null;
 const rail=world.network.nearest(x,z,60);if(rail&&rail.distance<radius+4.2)return null;
 if(world.districts?.some(d=>{const dx=x-d.origin[0],dz=z-d.origin[2],lx=dx*d.right[0]+dz*d.right[2],lz=dx*d.forward[0]+dz*d.forward[2];return lx>d.minX-radius-8&&lx<d.maxX+radius+8&&lz>d.minZ-radius-8&&lz<d.maxZ+radius+8;}))return null;
 const heights=[[radius,0],[-radius,0],[0,radius],[0,-radius]].map(([dx,dz])=>world.surfaceHeight(x+dx,z+dz));
 if(heights.some(h=>!Number.isFinite(h)||h<low)||Math.max(...heights)-Math.min(...heights)>radius*1.1)return null;
 return [x,Math.min(centre,...heights),z];
}
/** Fixed-world placement, independent of camera/quality. Near/mid/far share transforms. */
export function buildAuthoredNature(world){
 if(!AUTHORED_STATE.ready||!world.terrain||world.def.id==='canyon')return;
 const groups=[...AUTHORED_MODELS.values()],rocks=groups.filter(m=>m.layer===0),stumps=groups.filter(m=>m.layer===1),ferns=groups.filter(m=>m.layer===2);
 if(!rocks.length||!stumps.length||!ferns.length)return;
 const batches=new Map(),samples=[],density=world.terrain.options.vegetation;
 const add=(model,p,scale,yaw)=>{
  const matrix=transform(p,[scale,scale,scale],yaw),cell=128,cx=Math.floor(p[0]/cell),cz=Math.floor(p[2]/cell);
  for(let lod=0;lod<3;lod++){
   const key=model.name+','+cx+','+cz+','+lod;let b=batches.get(key);
   if(!b){b=new Batch(model.lods[lod],{center:[(cx+.5)*cell,p[1]+3,(cz+.5)*cell],radius:110,maxDistance:model.cutout?260:950,castShadow:lod<2});
    b.lodNear=[75,230,0][lod];b.lodFar=[0,75,230][lod];b.cutout=model.cutout;b.detailClass='authored';batches.set(key,b);world.builder.batches.push(b);}
   b.radius=Math.max(b.radius,Math.hypot(p[0]-b.center[0],p[1]-b.center[1],p[2]-b.center[2])+scale*6);
   b.add(matrix,[1,1,1,1],[model.cutout?18:17,.8,model.layer,0]);
  }
  if(samples.length<256)samples.push({name:model.name,position:p,scale});world.features.authoredProps++;
 };
 world.features.authoredProps=0;
 // Trail-side ensembles: a rock, fallen root base and fern colony read as an ecosystem.
 ensembles: for(const edge of world.network.edges.values())for(let s=23;s<edge.length;s+=24){
  const pose=edge.at(s),r=rng((hash2(Math.floor(pose.p[0]),Math.floor(pose.p[2]),world.seed+574)*0x7fffffff)|0);
  if(r()>Math.min(.85,density*.52))continue;
  const side=r()>.5?1:-1,d=8+r()*24,x=pose.p[0]+pose.right[0]*d*side,z=pose.p[2]+pose.right[2]*d*side;
  const eco=world.terrain.climate(x,z);if(eco.slope>1.1)continue;
  const model=r()<.78?rocks[(r()*rocks.length)|0]:stumps[0],scale=model.layer===0?.3+r()*.9:.55+r()*.55;
  const p=authoredSite(world,x,z,scale*(model.layer===0?1.5:.75));if(!p)continue;
  add(model,[p[0],p[1]-.08*scale,p[2]],scale,r()*Math.PI*2);
  if(eco.moisture>.35&&world.def.id!=='canyon')for(let j=0;j<2+Math.floor(r()*4);j++){
   const a=r()*Math.PI*2,rad=1.2+r()*3,q=authoredSite(world,x+Math.cos(a)*rad,z+Math.sin(a)*rad,.5);
   if(q)add(ferns[(r()*ferns.length)|0],q,.65+r()*.65,r()*Math.PI*2);
  }
  if(world.features.authoredProps>=2794)break ensembles;
 }
 for(const b of batches.values())b.finish();world.authoredSamples=samples;
}
