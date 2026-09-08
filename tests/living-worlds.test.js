import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {treeArchetype,SPECIES,ForestBuilder,GroundCover,urbanLandUse} from '../src/botany.js';
import {planSettlements,footprint,roadSamples,connectedRoads,buildSettlements} from '../src/settlements.js';
import {SceneBuilder} from '../src/geometry.js';
import {WORLDS} from '../src/data.js';
import {RailwayWorld} from '../src/world.js';
import {LEAF_WGSL,LEAF_GLSL} from '../src/living-shaders.js';
import {WGSL_MAIN,WGSL_SHADOW,GLSL_SHADOW_VS,GLSL_SHADOW_FS} from '../src/shaders.js';
function stub(){return {def:{theme:'pine',water:0,snowLine:9999},seed:51,height:()=>5,baseHeight:()=>5,surfaceHeight:()=>5,network:{nearest:()=>null,edges:new Map([['test',{at:()=>({p:[0,5,0],right:[1,0,0],f:[0,0,1]})}]])},stations:[{name:'Test Town',edge:'test',s:0}],terrain:{climate:()=>({moisture:.4,slope:.01})},builder:new SceneBuilder(),features:{buildings:0,trees:0,shrubs:0},viewpoints:[],buildCar(){}};}
for(const species of SPECIES)test(`${species}: compound leaves and branches are finite, cached and lower-detail with distance`,()=>{
 let previous=Infinity;
 for(let lod=0;lod<3;lod++){
  const m=treeArchetype(species,0,lod);assert.equal(m,treeArchetype(species,0,lod));assert.ok(m.leafCards>=20);assert.ok(m.leaf.indices.length<previous);previous=m.leaf.indices.length;
  for(const g of [m.wood,m.leaf]){assert.ok(g.vertices.every(Number.isFinite));assert.ok(g.indices.every(i=>i<g.vertices.length/8));for(let i=0;i<g.vertices.length;i+=8)assert.ok(Math.hypot(...g.vertices.slice(i+3,i+6))>.8);}
 }
 assert.notDeepEqual(treeArchetype(species,0,0).leaf.vertices,treeArchetype(species,1,0).leaf.vertices);
});
test('forest batches share meshes and instance transforms across disjoint LOD ranges',()=>{
 const builder=new SceneBuilder(),f=new ForestBuilder(builder);f.add([0,3,0],20,'oak',.3);f.add([5,3,5],18,'oak',.4);f.finish();
 const leaves=builder.batches.filter(b=>b.cutout);assert.equal(leaves.length,3);for(const b of leaves){assert.equal(b.count,2);assert.equal(b.data.length,48);assert.ok(b.radius>=180);}assert.equal(leaves[0].lodNear,leaves[1].lodFar);assert.equal(leaves[1].lodNear,leaves[2].lodFar);
});
test('invalid trees cannot contaminate the scene',()=>{const b=new SceneBuilder(),f=new ForestBuilder(b);f.add([NaN,0,0],20,'oak');f.add([0,0,0],Infinity,'oak');assert.equal(b.batches.length,0);});
test('leaf alpha and wind are evaluated in shadow passes on both APIs',()=>{
 assert.ok(WGSL_MAIN.includes(LEAF_WGSL));assert.ok(WGSL_SHADOW.includes(LEAF_WGSL));assert.ok(WGSL_SHADOW.includes('discard'));
 assert.ok(GLSL_SHADOW_VS.includes(LEAF_GLSL));assert.ok(GLSL_SHADOW_FS.includes('leafMask'));assert.ok(GLSL_SHADOW_VS.includes('canopyWind(p,'));
});
test('street graph discards disconnected islands instead of emitting isolated roads',()=>{
 const roads=[{a:[0,0],b:[0,1]},{a:[0,1],b:[1,1]},{a:[5,5],b:[5,6]}],candidates=new Map(roads.map((r,i)=>[i,[r.a,r.b]]));assert.deepEqual([...connectedRoads(roads,candidates).keys()],[0,1]);
});
test('street samples reject water, steep grades and railway intrusions',()=>{
 const w=stub(),d=planSettlements(w)[0],road=d.roads[0];assert.ok(roadSamples(w,d,road));w.surfaceHeight=()=>-1;assert.equal(roadSamples(w,d,road),null);w.surfaceHeight=x=>x;assert.equal(roadSamples(w,d,road),null);w.surfaceHeight=()=>5;w.network.nearest=()=>({distance:0});assert.equal(roadSamples(w,d,road),null);
});
test('parcel foundations reject flooded, steep and track-occupied footprints',()=>{
 const w=stub();assert.ok(footprint(w,[0,5,0],20,20,0));w.surfaceHeight=x=>x+5;assert.equal(footprint(w,[0,5,0],20,20,0),null);w.surfaceHeight=()=>0;assert.equal(footprint(w,[0,5,0],20,20,0),null);w.surfaceHeight=()=>5;w.network.nearest=()=>({});assert.equal(footprint(w,[0,5,0],20,20,0),null);
});
test('settlement zoning is deterministic and respects world orientation',()=>{
 const w=stub();w.districts=planSettlements(w);assert.deepEqual(w.districts,planSettlements(w));assert.equal(urbanLandUse(w,75,0),true);assert.equal(urbanLandUse(w,-75,0),false);assert.equal(urbanLandUse(w,10000,0),false);
});
test('complete flat district has connected streets, parks, buildings, facade materials and no lot overlap',async()=>{
 const w=stub();await buildSettlements(w);w.forest?.finish();const d=w.districts[0];assert.ok(w.features.roadSegments>30);assert.ok(w.features.parks>0);assert.ok(w.features.buildings>25);assert.ok(w.features.parkedCars>0);
 for(let i=0;i<d.buildings.length;i++)for(let j=i+1;j<d.buildings.length;j++){
  const a=d.buildings[i],b=d.buildings[j];assert.ok(Math.abs(a.position[0]-b.position[0])>(a.width+b.width)/2||Math.abs(a.position[2]-b.position[2])>(a.depth+b.depth)/2);
 }
 const batches=w.builder.finish();assert.ok(batches.some(b=>b.data?.some((v,i)=>i%24===20&&v===12)));
 for(const b of batches)assert.ok(b.data.every(Number.isFinite));
});
test('metropolis districts have larger footprints and mixed heights than rural villages',()=>{
 const w=stub(),rural=planSettlements(w)[0];w.def.theme='metro';const metro=planSettlements(w)[0];assert.ok(metro.lots.length>rural.lots.length*2);assert.ok(metro.profile.height>rural.profile.height);
});
test('ground cover deterministic tiles and nested quality placement',()=>{
 const w=stub(),g=new GroundCover(),hi=g.buildTile(w,0,0,'high'),again=g.buildTile(w,0,0,'high'),lo=g.buildTile(w,0,0,'low');assert.deepEqual(hi.batches[0].data,again.batches[0].data);assert.ok(hi.instances>lo.instances);
 const positions=t=>new Set(t.batches.flatMap(b=>Array.from({length:b.count},(_,i)=>[b.data[i*24+12],b.data[i*24+14]].join(','))));
 const h=positions(hi);for(const p of positions(lo))assert.ok(h.has(p));
});
test('ground cover releases GPU instance buffers and bounds tile cache while travelling',()=>{
 const w=stub(),g=new GroundCover(),r={disposed:0,disposeBatch(){this.disposed++;}},c={position:[0,6,0]};
 let max=0;for(let i=0;i<6;i++){c.position[0]=i*700;g.update(w,c,r,'low',200);max=Math.max(max,g.tiles.size);}assert.ok(max<50);assert.ok(r.disposed>0);g.clear(r);assert.equal(g.tiles.size,0);
});
test('ground cover stays out of water, railway and street parcels',()=>{
 const w=stub(),g=new GroundCover();w.network.nearest=()=>({});assert.equal(g.buildTile(w,0,0,'high').instances,0);w.network.nearest=()=>null;w.baseHeight=()=>-1;assert.equal(g.buildTile(w,0,0,'high').instances,0);
});
test('offline precache includes all Living Worlds dependencies',()=>{
 const source=readFileSync(new URL('../sw.js',import.meta.url),'utf8');for(const module of ['botany','settlements','living-shaders'])assert.ok(source.includes(`src/${module}.js`));
});
