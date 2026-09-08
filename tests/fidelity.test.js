import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {mipSizes,validateMaterialManifest,SURFACE_IDS,SurfaceLibrary} from '../src/materials.js';
import {SHADOW_EXTENTS,stabilizedShadow,shadowCascadeCount} from '../src/shadow-cascades.js';
import {decodeOctahedral,occlusionSamples,ContactOcclusion} from '../src/contact-occlusion.js';
import {facadeWindows,pavedApron,traceWindowRoom,addArchitecturalDetail,buildPublicRealm,ARCHITECTURE_DETAIL_RANGE} from '../src/urban-detail.js';
import {SceneBuilder} from '../src/geometry.js';
import {postOptions} from '../src/postprocess.js';
import {norm,pointTransform,transform} from '../src/math.js';
import {WGSL_MAIN,GLSL_MAIN_FS} from '../src/shaders.js';

const root=new URL('../',import.meta.url),manifest=JSON.parse(readFileSync(new URL('assets/materials/manifest.json',root)));
function flat(){return {def:{water:0},surfaceHeight:()=>5,network:{nearest:()=>null},features:{},builder:new SceneBuilder()};}
const building={position:[20,5,40],width:12,depth:18,height:12.8,floors:4,style:'stone'};
const district={yaw:.7,origin:[20,5,40],right:[Math.cos(.7),0,-Math.sin(.7)],forward:[Math.sin(.7),0,Math.cos(.7)]};

test('surface mip chains include every level to 1px and reject invalid sizes',()=>{
 assert.deepEqual(mipSizes(8),[8,4,2,1]);assert.equal(mipSizes(512).length,10);assert.equal(mipSizes(256).length,9);
 for(const n of [0,-1,3,NaN,Infinity,2049,2.5])assert.throws(()=>mipSizes(n),RangeError);
});
test('all material channels retain their recorded hashes and bounded total size',()=>{
 assert.equal(validateMaterialManifest(manifest),manifest);let bytes=0;
 for(const layer of manifest.layers)for(const kind of ['albedo','surface']){const raw=readFileSync(new URL('assets/materials/'+layer[kind],root));bytes+=raw.length;assert.equal(createHash('sha256').update(raw).digest('hex'),layer.sha256[kind]);}
 assert.equal(manifest.layers.length,8);assert.ok(bytes<8_000_000);
 assert.equal(manifest.license,'CC0-1.0');assert.ok(readFileSync(new URL('assets/materials/LICENSE.txt',root),'utf8').includes('CC0'));
});
test('surface library validation rejects escaping filenames, corrupt hashes and reordered layers',()=>{
 for(const mutate of [v=>v.layers.reverse(),v=>v.layers[0]=null,v=>v.layers[0].albedo='../bad.jpg',v=>v.layers[0].surface='https://x/y.png',v=>v.layers[0].sha256.albedo+='00',v=>v.layers[0].meters=NaN]){const m=structuredClone(manifest);mutate(m);assert.throws(()=>validateMaterialManifest(m));}
 for(const v of [null,[],{}, {...manifest,version:2}])assert.throws(()=>validateMaterialManifest(v));
});
test('complete offline shell includes every material pair and new runtime module',()=>{
 const shell=readFileSync(new URL('sw.js',root),'utf8');
 for(const name of ['materials','fidelity-shaders','contact-occlusion','shadow-cascades','urban-detail'])assert.ok(shell.includes("'src/"+name+".js'"));
 for(const layer of manifest.layers)for(const kind of ['albedo','surface'])assert.ok(shell.includes("'assets/materials/"+layer[kind]+"'"));
});
test('material GPU resource disposal aborts pending loads and is idempotent',()=>{
 const lib=new SurfaceLibrary();let released=0;lib.device={};lib.color=lib.surface={destroy(){released++;}};lib.ready=true;
 lib.dispose();lib.dispose();assert.equal(released,2);assert.equal(lib.status,'disposed');assert.equal(lib.ready,false);assert.ok(lib.abort.signal.aborted);
});
test('material failure enables the procedural fallback without rejecting startup',async()=>{
 const fetch=globalThis.fetch,warn=console.warn,lib=new SurfaceLibrary();lib.allocateGL=()=>{};
 globalThis.fetch=async()=>({ok:false,status:503});console.warn=()=>{};
 try{await lib.initialize(null,{});assert.equal(lib.ready,false);assert.equal(lib.loaded,0);assert.equal(lib.status,'fallback');assert.match(lib.errors[0],/503/);}finally{globalThis.fetch=fetch;console.warn=warn;}
});
test('shadow ranges share metric scene space and have bounded quality counts',()=>{
 assert.deepEqual(SHADOW_EXTENTS,[72,280,1100]);assert.equal(shadowCascadeCount('low'),1);assert.equal(shadowCascadeCount('high'),3);
 const target=[435.25,167,-835.6],sun=norm([.4,.8,.3]);
 for(const gpu of [false,true])for(const extent of SHADOW_EXTENTS){const m=stabilizedShadow(target,sun,extent,1536,gpu);assert.ok(m.every(Number.isFinite));const center=pointTransform(m,target);assert.ok(Math.abs(center[0])<2/1536&&Math.abs(center[1])<2/1536);assert.ok(center[2]>=-1&&center[2]<=1);}
});
test('shadow stabilization quantizes translation on the actual light-space texel lattice',()=>{
 for(let i=0;i<30;i++){const m=stabilizedShadow([123+i*.013,78,432],norm([.5,.7,.2]),280,1536);for(const k of [12,13])assert.ok(Math.abs(m[k]*768-Math.round(m[k]*768))<.0002);}
});
test('invalid shadow parameters cannot produce nonfinite projection matrices',()=>{
 for(const [p,d,e,s] of [[[NaN,1,2],[1,2,3],72,1536],[[1,2,3],[NaN,2,3],72,1536],[[1,2,3],[1,2,3],0,1536],[[1,2,3],[1,2,3],72,0]])assert.throws(()=>stabilizedShadow(p,d,e,s),RangeError);
});
test('octahedral auxiliary normals round-trip through all hemispheres',()=>{
 for(let i=0;i<100;i++){const v=norm([Math.sin(i*.71),Math.cos(i*.51),Math.sin(i*.19+.4)]),sum=v.reduce((a,b)=>a+Math.abs(b),0);let [x,y,z]=v.map(n=>n/sum);if(z<0){const old=x;x=(1-Math.abs(y))*(x<0?-1:1);y=(1-Math.abs(old))*(y<0?-1:1);}const back=decodeOctahedral(x*.5+.5,y*.5+.5);for(let k=0;k<3;k++)assert.ok(Math.abs(v[k]-back[k])<1e-6);}
});
test('contact shading quality budgets are monotonic and low quality removes the pass',()=>{
 assert.deepEqual(['low','medium','high','ultra'].map(occlusionSamples),[0,8,16,24]);
 const ao=new ContactOcclusion();ao.texture={};const r={frame:new Float32Array(124),width:1280,height:800},c={position:[1,2,3],fov:60};
 ao.prepare(r,c,.85,'high');assert.equal(ao.active,true);assert.equal(ao.frame[27],16);
 ao.prepare(r,c,0,'high');assert.equal(ao.active,false);ao.prepare(r,c,.85,'low');assert.equal(ao.active,false);assert.equal(ao.passCount,0);
});
test('contact target resize uses rounded half resolution and releases previous ownership',()=>{
 const ao=new ContactOcclusion();let releases=0;ao.texture={destroy(){releases++;}};ao.device={createTexture(){return {destroy(){releases++;},createView(){return {};}};},createBindGroup(){return {};}};ao.pipeline={getBindGroupLayout(){return {};}};const geometry={createView(){return {};}};
 const usage=globalThis.GPUTextureUsage;globalThis.GPUTextureUsage={RENDER_ATTACHMENT:1,TEXTURE_BINDING:2};
 try{ao.resize(391,845,geometry);assert.equal(ao.width,196);assert.equal(ao.height,423);assert.equal(releases,1);ao.release();ao.release();assert.equal(releases,2);}finally{globalThis.GPUTextureUsage=usage;}
});
test('display validation clamps occlusion and requires explicit Boolean texture flags',()=>{
 const options=postOptions({occlusion:Infinity,surfaces:false,normalMapping:false});assert.ok(Number.isFinite(options.occlusion));assert.equal(options.surfaces,false);assert.equal(options.normalMapping,false);assert.ok(postOptions({occlusion:200}).occlusion<=2);
});
test('opaque geometry MRT and surface sampling exist in both renderer shader contracts',()=>{
 assert.ok(WGSL_MAIN.includes('@location(1) geometry:vec4f'));assert.ok(WGSL_MAIN.includes('textureSampleGrad(materialColor'));
 assert.ok(GLSL_MAIN_FS.includes('textureGrad(materialColor'));assert.ok(GLSL_MAIN_FS.includes('outGeometry'));
 assert.doesNotMatch(WGSL_MAIN,/\b(?:let|var)\s+macro\b/);assert.ok(WGSL_MAIN.includes('surfaceAO'));assert.ok(WGSL_MAIN.includes('roomRay('));
});
test('facade frames match metre-scaled window spacing and remain inside face bounds',()=>{
 for(const modern of [false,true]){const frames=facadeWindows(14,200,modern);assert.equal(frames.length,40);for(const f of frames){assert.ok(f.x-f.width/2>=-7);assert.ok(f.x+f.width/2<=7);assert.ok(f.y-f.height/2>0);assert.ok(f.y+f.height/2<32);}}
 for(const width of [0,NaN,-3])assert.equal(facadeWindows(width,10).length,0);
});
test('paved aprons conform to rendered ground and remain inside reserved footprint margins',()=>{
 const w=flat(),r=pavedApron(w,district,building);assert.ok(r.cells>10);const v=r.batch.geometry.vertices,c=Math.cos(district.yaw),s=Math.sin(district.yaw);
 for(let i=0;i<v.length;i+=8){const dx=v[i]-20,dz=v[i+2]-40,x=c*dx-s*dz,z=s*dx+c*dz;assert.ok(Math.abs(x)<=building.width/2+.451);assert.ok(z>=-building.depth/2-.451&&z<=building.depth/2+1.201);assert.ok(Math.abs(v[i+1]-5.045)<.0001);assert.ok(v[i+4]>.9);}
});
test('aprons reject flooded sites and rail intrusions rather than paving through them',()=>{
 const w=flat();w.surfaceHeight=()=>0;assert.equal(pavedApron(w,district,building),null);w.surfaceHeight=()=>5;w.network.nearest=()=>({});assert.equal(pavedApron(w,district,building),null);
});
test('architectural details are bounded instancing with no per-window geometry',()=>{
 const w=flat(),r=addArchitecturalDetail(w,district,building,.73);assert.ok(r.windows>50);assert.ok(r.batch.count>r.windows*4);assert.equal(r.batch.maxDistance,ARCHITECTURE_DETAIL_RANGE);assert.ok(r.batch.data.every(Number.isFinite));assert.equal(w.features.windowFrames,r.windows);assert.equal(w.features.shopAwnings,1);
 const other=addArchitecturalDetail(w,district,{...building,position:[40,5,80]},.4);assert.equal(other.batch.geometry,r.batch.geometry);
});
test('street furniture is generated only for built streets and clear rendered sites',()=>{
 const w=flat(),d={...district,roads:[{built:false},{built:true,axis:'z',a:[0,0],b:[0,30]}]};w.districts=[d];assert.equal(buildPublicRealm(w),1);assert.ok(w.builder.batches[0].data.every(Number.isFinite));w.network.nearest=()=>({});assert.equal(buildPublicRealm(w),0);
});

test('window-box rays stay finite and in bounds at normal incidence and nearly parallel axes',()=>{
 for(const ray of [[0,0,-1],[-.000001,0,-1],[.000001,0,-1],[.5,.8,-.07],[-.7,-.2,-.1]])for(const cell of [[.3,.6],[.5,.5],[.01,.99]]){
  const hit=traceWindowRoom(cell,ray);assert.ok(hit.every(x=>Number.isFinite(x)&&Math.abs(x)<=1.00001));assert.ok(hit.some(x=>Math.abs(Math.abs(x)-1)<1e-4));
 }
 assert.deepEqual(traceWindowRoom([.5,.5],[0,0,-1]),[0,0,-1]);assert.throws(()=>traceWindowRoom([2,0],[0,0,-1]));
});
test('shadow projection rejects zero sun and remains nonsingular directly overhead',()=>{
 assert.throws(()=>stabilizedShadow([0,0,0],[0,0,0],72,1536));assert.throws(()=>stabilizedShadow([0,0,0],[1,2,3],Infinity,1536));
 const m=stabilizedShadow([0,10,0],[0,1,0],72,1536);assert.ok(m.every(Number.isFinite));assert.ok(Math.abs(m[0])+Math.abs(m[1])+Math.abs(m[2])>0);
});

import {warpNaturalUV,SURFACE_WGSL,SURFACE_GLSL,SURFACE_APPLY_WGSL,SURFACE_APPLY_GLSL} from '../src/fidelity-shaders.js';
test('natural-surface warp has correct analytic gradients and never folds',()=>{
 for(let x=-120;x<=120;x+=7.4)for(let y=-70;y<=70;y+=6.7){
  const p=[x,y],dx=warpNaturalUV(p,[1,0]).gradient,dy=warpNaturalUV(p,[0,1]).gradient;
  assert.ok(dx[0]*dy[1]-dx[1]*dy[0]>.2);
  const e=.0001,u=warpNaturalUV(p).uv;
  for(const [d,step] of [[dx,[e,0]],[dy,[0,e]]]){
   const v=warpNaturalUV([x+step[0],y+step[1]]).uv;
   for(let i=0;i<2;i++)assert.ok(Math.abs((v[i]-u[i])/e-d[i])<.00002);
  }
 }
 assert.throws(()=>warpNaturalUV([NaN,0]));
 const a=warpNaturalUV([.31,.65]).uv,b=warpNaturalUV([1.31,.65]).uv;
 assert.ok(Math.abs((b[0]-a[0])-1)>.05,'adjacent repeated tile no longer aligns');
});
test('both material backends transform natural-surface gradients and normal covectors',()=>{
 for(const source of [SURFACE_WGSL,SURFACE_GLSL]){
  assert.ok(source.includes('naturalGradient(x,xdx)'));
  assert.ok(source.includes('naturalBump(sourceX,ax)'));
 }
 assert.ok(SURFACE_APPLY_WGSL.includes('biomeGrass'));
 assert.ok(SURFACE_APPLY_GLSL.includes('biomeGrass'));
});
