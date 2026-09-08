import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validateAuthoredManifest,decodeAuthoredGeometry,AuthoredLibrary,AUTHORED_STATE,AUTHORED_MODELS,authoredSite,buildAuthoredNature} from '../src/authored-assets.js';
import {halton,temporalJitter,temporalCameraCut,encodeIndirect,decodeIndirect,clipHistory,TemporalResolve,TEMPORAL_WGSL,TEMPORAL_GLSL} from '../src/temporal.js';
import {coachShellGeometry,roundedGlazingGeometry,installRollingArt} from '../src/rolling-art.js';
import {canopyStrip,buildStationArchitecture,buildStationCanopy} from '../src/station-art.js';
import {Geometry,SceneBuilder,PRIMITIVES} from '../src/geometry.js';
import {mat4Identity,cross,sub,dot,add,mul} from '../src/math.js';
import {postOptions,PostProcessor} from '../src/postprocess.js';
import {WorldLife} from '../src/world-life.js';
import {WGSL_MAIN,WGSL_SHADOW,GLSL_MAIN_FS,GLSL_SHADOW_FS} from '../src/shaders.js';
const root=new URL('../',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('assets/authored/manifest.json',root),'utf8'));
const bytes=readFileSync(new URL('assets/authored/hero-meshes.bin',root));
const array=()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length);
function flatWorld(){return {seed:731,def:{id:'pine',theme:'pine',water:0},surfaceHeight:()=>5,height:()=>5,terrain:{options:{vegetation:1},climate:()=>({moisture:.8,slope:0})},network:{nearest:()=>null,edges:new Map([['track',{length:3000,at:s=>({p:[0,5,s],right:[1,0,0],f:[0,0,1]})}]])},districts:[],builder:new SceneBuilder(),features:{buildings:0},railCross(p,x,y=0){return add(add(p.p,mul(p.right,x)),[0,y,0]);}};}

test('authored asset provenance and derived files match recorded SHA-256',()=>{
 assert.equal(validateAuthoredManifest(manifest),manifest);assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.meshHash);assert.equal(bytes.length,manifest.meshBytes);assert.equal(manifest.meshes.length,11);
 let total=bytes.length;for(const layer of manifest.layers){assert.equal(layer.license,'CC0-1.0');assert.ok(Object.keys(layer.authors).length);assert.ok(layer.sourceURL.startsWith('https://polyhaven.com/a/'));for(const kind of ['albedo','surface']){const raw=readFileSync(new URL('assets/authored/'+layer[kind],root));total+=raw.length;assert.equal(createHash('sha256').update(raw).digest('hex'),layer.sha256[kind]);}}
 assert.ok(total<9_000_000);
});
test('authored manifest rejects path escapes, aliasing, invalid budgets and wrong layers',()=>{
 for(const mutate of [m=>m.layers[0].albedo='../escape.png',m=>m.layers.reverse(),m=>m.meshBytes=999999999,m=>m.meshes[0].lods[0].vertexOffset=17,m=>m.meshes[0].lods[0].indexOffset=16,m=>m.meshes[0].layer=4,m=>m.meshes[0].bounds[0][0]=Infinity,m=>m.meshes[0].lods[1].indexCount=999999,m=>m.meshHash='bad',m=>m.meshes[0].name='../mesh']){
  const value=structuredClone(manifest);mutate(value);assert.throws(()=>validateAuthoredManifest(value));
 }
});
test('all 33 authored LOD meshes decode to finite bounded independent geometry',()=>{
 const models=decodeAuthoredGeometry(manifest,array());assert.equal(models.size,11);
 for(const m of models.values()){let count=Infinity;for(const g of m.lods){assert.ok(g instanceof Geometry);assert.ok(g.indices.length<count);count=g.indices.length;assert.equal(g.vertices.length%8,0);assert.ok(g.vertices.every(Number.isFinite));assert.ok(g.indices.every(i=>i<g.vertices.length/8));}}
 const first=[...models.values()][0].lods[0];const prior=first.vertices[0];const buffer=array();decodeAuthoredGeometry(manifest,buffer);new Uint8Array(buffer).fill(0);assert.equal(first.vertices[0],prior);
});
test('authored decoder rejects bad headers, nonfinite positions, escaping bounds and invalid indices',()=>{
 assert.throws(()=>decodeAuthoredGeometry(manifest,array().slice(0,-4)));
 for(const mutate of [b=>new DataView(b).setUint32(0,0,true),b=>new DataView(b).setFloat32(manifest.meshes[0].lods[0].vertexOffset,NaN,true),b=>new DataView(b).setFloat32(manifest.meshes[0].lods[0].vertexOffset,49,true),b=>new DataView(b).setUint32(manifest.meshes[0].lods[0].indexOffset,0xffffffff,true)]){const b=array();mutate(b);assert.throws(()=>decodeAuthoredGeometry(manifest,b));}
});
test('authored material failure clears readiness and leaves procedural fallback operational',async()=>{
 const fetch=globalThis.fetch,warn=console.warn,lib=new AuthoredLibrary();lib.allocateGL=()=>{};AUTHORED_STATE.ready=true;
 globalThis.fetch=async()=>({ok:false,status:503});console.warn=()=>{};
 try{await lib.initialize(null,{});assert.equal(AUTHORED_STATE.ready,false);assert.equal(lib.ready,false);assert.equal(lib.status,'fallback');}finally{globalThis.fetch=fetch;console.warn=warn;}
});
test('authored disposal aborts pending IO and invalidates only active art readiness',()=>{
 const lib=new AuthoredLibrary();let released=0;lib.device={};lib.color=lib.surface={destroy(){released++;}};lib.ready=true;AUTHORED_STATE.ready=true;lib.dispose();lib.dispose();assert.equal(released,2);assert.equal(AUTHORED_STATE.ready,false);assert.ok(lib.abort.signal.aborted);
});
test('authored prop sites reject water, tracks, steep ground and settlement reservations',()=>{
 const w=flatWorld();assert.deepEqual(authoredSite(w,25,25),[25,5,25]);w.surfaceHeight=()=>0;assert.equal(authoredSite(w,25,25),null);w.surfaceHeight=x=>x;assert.equal(authoredSite(w,25,25),null);w.surfaceHeight=()=>5;w.network.nearest=()=>({distance:1});assert.equal(authoredSite(w,25,25),null);w.network.nearest=()=>null;
 w.districts=[{origin:[0,0,0],right:[1,0,0],forward:[0,0,1],minX:0,maxX:100,minZ:0,maxZ:100}];assert.equal(authoredSite(w,25,25),null);assert.equal(authoredSite(w,NaN,25),null);
});
test('authored ensembles are deterministic, metre-scaled and share transforms between LODs',()=>{
 const models=decodeAuthoredGeometry(manifest,array());for(const [k,v]of models)AUTHORED_MODELS.set(k,v);AUTHORED_STATE.ready=true;
 try{const a=flatWorld(),b=flatWorld();buildAuthoredNature(a);buildAuthoredNature(b);assert.ok(a.features.authoredProps>30&&a.features.authoredProps<=2800);assert.deepEqual(a.authoredSamples,b.authoredSamples);assert.deepEqual(a.builder.batches.map(b=>b.data),b.builder.batches.map(b=>b.data));const batch=a.builder.batches;for(let i=0;i<batch.length;i+=3){assert.deepEqual(batch[i].data,batch[i+1].data);assert.deepEqual(batch[i].data,batch[i+2].data);assert.ok(batch[i].geometry.indices.length>batch[i+2].geometry.indices.length);assert.ok(batch[i].data.every(Number.isFinite));}}
 finally{AUTHORED_STATE.ready=false;AUTHORED_MODELS.clear();}
});
test('mossy authored props are omitted from the desert biome and unavailable assets never block a world',()=>{
 const w=flatWorld();AUTHORED_STATE.ready=false;assert.doesNotThrow(()=>buildAuthoredNature(w));assert.equal(w.builder.batches.length,0);AUTHORED_STATE.ready=true;w.def.id='canyon';buildAuthoredNature(w);assert.equal(w.builder.batches.length,0);AUTHORED_STATE.ready=false;
});
test('Halton jitter is bounded, periodic and never stalls on invalid sequence parameters',()=>{
 assert.equal(halton(1,2),.5);assert.equal(halton(2,2),.25);const unique=new Set();for(let i=0;i<32;i++){const j=temporalJitter(i);assert.ok(j.every(x=>x>=-.5&&x<=.5));assert.deepEqual(j,temporalJitter(i+8));unique.add(j.join(','));}assert.equal(unique.size,8);for(const a of [[1,1],[1,0],[-1,2],[NaN,2],[1,2.2]])assert.throws(()=>halton(...a),RangeError);
});
test('temporal history rejects camera cuts but accepts small continuous moves',()=>{
 const a={mode:'free',fov:60,position:[1,2,3],direction:[0,0,1]};assert.equal(temporalCameraCut(null,a),true);assert.equal(temporalCameraCut(a,{...a,position:[1.1,2,3]}),false);for(const b of [{mode:'cab'},{fov:61},{position:[100,2,3]},{direction:[1,0,0]}])assert.equal(temporalCameraCut(a,{...a,...b}),true);
});
test('reactivity encoding preserves indirect-share shading without confusing zero illumination',()=>{
 for(const share of [0,.01,.1,.5,.85,2])for(const reactive of [false,true]){const value=encodeIndirect(share,reactive);assert.equal(value<0,reactive);assert.ok(Math.abs(decodeIndirect(value)-Math.min(.85,share))<1e-6);}assert.deepEqual(clipHistory([-3,5,.7],[0,.1,.3],[1,.5,1]),[0,.5,.7]);
});
test('temporal settings round trip through cinematic validation',()=>{assert.equal(postOptions({temporal:false}).temporal,false);assert.equal(postOptions().temporal,true);assert.equal(postOptions(postOptions({temporal:false})).temporal,false);});
test('temporal ping-pong targets are distinct and destroyed once on resize or disable',()=>{
 const t=new TemporalResolve();let released=0,created=0;const usage=globalThis.GPUTextureUsage;globalThis.GPUTextureUsage={RENDER_ATTACHMENT:1,TEXTURE_BINDING:2};t.device={createTexture(){created++;return{destroy(){released++;},createView(){return{};}};},createBindGroup(x){return x;}};t.pipeline={getBindGroupLayout(){return{};}};const scene={createView(){return{};}},g={createView(){return{};}};
 try{t.resize(100,80,scene,g);assert.equal(t.history.length,2);assert.notEqual(t.history[0],t.history[1]);assert.equal(created,2);t.resize(100,80,scene,g);assert.equal(created,2);t.resize(120,80,scene,g);assert.equal(released,2);t.release();t.release();assert.equal(released,4);assert.equal(t.history.length,0);}finally{globalThis.GPUTextureUsage=usage;}
});
test('temporal preparation resets on scene, settings and camera changes, and low quality disables allocation',()=>{
 const t=new TemporalResolve();t.resize=(w,h)=>{t.width=w;t.height=h;};const r={width:800,height:600,post:{hdr:true,options:{temporal:true},scene:{},geometry:{}},settings:{quality:'high',surfaces:true,normalMapping:true,shadows:true}},c={mode:'free',fov:60,position:[0,3,5],target:[0,3,0]},w={id:'pine'},e={weather:'clear',hour:13},key={};
 t.prepare(r,c,mat4Identity(),w,e,key);assert.equal(t.uniformData[42],0);t.commit();t.prepare(r,c,mat4Identity(),w,e,key);assert.equal(t.uniformData[42],1);r.settings.shadows=false;t.prepare(r,c,mat4Identity(),w,e,key);assert.equal(t.uniformData[42],0);t.commit();t.prepare(r,c,mat4Identity(),w,e,{});assert.equal(t.uniformData[42],0);r.settings.quality='low';assert.deepEqual(t.prepare(r,c,mat4Identity(),w,e,key),[0,0]);assert.equal(t.active,false);
});
test('reactive transparent and moving-vehicle rejection exists on both backend contracts',()=>{
 for(const code of [TEMPORAL_WGSL,TEMPORAL_GLSL]){assert.ok(code.includes('g.w<0.'));assert.ok(code.includes('oldDepth'));assert.ok(code.includes('sigma*1.5'));}assert.ok(WGSL_MAIN.includes('reactive'));assert.ok(GLSL_MAIN_FS.includes('reactive'));assert.ok(WGSL_SHADOW.includes('heroColor'));assert.ok(GLSL_SHADOW_FS.includes('heroColor'));
});
test('manufactured coach shells and glazing have bounded smooth normals and outward triangle winding',()=>{
 for(const g of [coachShellGeometry(),roundedGlazingGeometry()]){assert.ok(g.vertices.every(Number.isFinite));for(let i=0;i<g.vertices.length;i+=8){for(let k=0;k<3;k++)assert.ok(Math.abs(g.vertices[i+k])<=.50001);assert.ok(Math.abs(Math.hypot(...g.vertices.slice(i+3,i+6))-1)<1e-5);}for(let i=0;i<g.indices.length;i+=3){const [a,b,c]=Array.from(g.indices.slice(i,i+3),n=>Array.from(g.vertices.slice(n*8,n*8+3)));const geometric=cross(sub(b,a),sub(c,a)),normal=Array.from(g.vertices.slice(g.indices[i]*8+3,g.indices[i]*8+6));assert.ok(dot(geometric,normal)>-1e-7);}}
 installRollingArt();const shell=PRIMITIVES['coach-shell-smooth'];installRollingArt();assert.equal(shell,PRIMITIVES['coach-shell-smooth']);
});
test('station barrel-vault geometry is cached, finite and fits its declared metric span',()=>{
 const key=canopyStrip(12,2.5,14,24);assert.equal(key,canopyStrip(12,2.5,14,24));const g=PRIMITIVES[key];assert.equal(g.indices.length,24*6);for(let i=0;i<g.vertices.length;i+=8){assert.ok(Math.abs(g.vertices[i])<=6.001);assert.ok(g.vertices[i+1]>=0&&g.vertices[i+1]<=2.501);assert.ok(Math.abs(g.vertices[i+2])<=7.001);}
});
test('station kits preserve rail identities while emitting separate structure and glazing',()=>{
 for(const theme of ['pine','metro']){const w=flatWorld(),st={edge:'track',s:200,platform:160};w.def.theme=theme;const edge=w.network.edges.get(st.edge);buildStationCanopy(w,st);buildStationArchitecture(w,st);const b=w.builder.finish();assert.equal(w.features.authoredStations,1);assert.equal(w.features.stationCanopies,1);assert.equal(w.network.edges.get(st.edge),edge);assert.ok(b.reduce((s,x)=>s+x.count,0)>400);assert.ok(b.some(x=>Array.from(x.data).some((v,i)=>i%24===20&&v===3)));for(const batch of b)assert.ok(batch.data.every(Number.isFinite));}
});
test('offline shell contains all new art modules, mesh pack and texture pairs',()=>{
 const shell=readFileSync(new URL('sw.js',root),'utf8');for(const name of ['authored-assets','authored-shaders','station-art','rolling-art','temporal'])assert.ok(shell.includes("'src/"+name+".js'"));assert.ok(shell.includes("'assets/authored/hero-meshes.bin'"));for(const l of manifest.layers)for(const k of ['albedo','surface'])assert.ok(shell.includes("'assets/authored/"+l[k]+"'"));
});
test('GPU postprocess binds the selected group without a global assignment',()=>{
 const p=new PostProcessor(),seen=[];p.temporal.active=false;p.scene={};p.a={createView:()=>({})};p.b={createView:()=>({})};p.uniform={};p.groupCache=new Map();
 p.makeGroup=(source,glow)=>({source,glow});p.groups={blurH:{},blurV:{}};p.pipelines={};p.device={queue:{writeBuffer(){}}};p.options={...p.options,bloom:0};
 const e={beginRenderPass(){return{setPipeline(){},setBindGroup(index,group){seen.push(group);},draw(){},end(){}};}};
 assert.doesNotThrow(()=>p.encodeGPU(e,{}, {exposure:1},0,'high'));assert.equal(seen.length,1);assert.equal(seen[0].source,p.scene);
});
test('every contributing history tap is checked for a reactive silhouette',()=>{
 for(const code of [TEMPORAL_WGSL,TEMPORAL_GLSL]){assert.ok(code.includes('corner'));assert.ok(code.includes('hd<.01'));assert.ok(code.includes('storedDepth'));}
});
test('changing auxiliary geometry identity invalidates equal-size temporal targets',()=>{
 const t=new TemporalResolve();let created=0;const usage=globalThis.GPUTextureUsage;globalThis.GPUTextureUsage={RENDER_ATTACHMENT:1,TEXTURE_BINDING:2};
 t.device={createTexture(){created++;return{destroy(){},createView:()=>({})};},createBindGroup:()=>({})};t.pipeline={getBindGroupLayout:()=>({})};
 const scene={createView:()=>({})};try{t.resize(32,32,scene,{createView:()=>({})});t.resize(32,32,scene,{createView:()=>({})});assert.equal(created,4);}finally{globalThis.GPUTextureUsage=usage;}
});
test('animated bird geometry is reactive without changing its opaque material',()=>{
 const life=new WorldLife();life.flocks=[{x:0,y:10,z:0,phase:0,speed:.1,radius:20,count:3}];
 const batches=life.update({def:{theme:'pine'}},{position:[0,0,0]},1,'high',true);
 assert.ok(life.visibleBirds>0);for(const b of batches)for(let i=0;i<b.count;i++){assert.equal(b.data[i*24+19],-1);assert.equal(b.data[i*24+20],0);}
});
