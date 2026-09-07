import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {TerrainField, generationOptions, surveyRoute, REGION_PROFILES} from '../src/generation.js';
import {RailwayWorld} from '../src/world.js';
import {RailNetwork, RailCursor} from '../src/tracks.js';
import {WORLDS, STOCK} from '../src/data.js';
import {validateProject} from '../src/persistence.js';
import {PRIMITIVES} from '../src/geometry.js';

const digest=a=>createHash('sha256').update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
const near=(a,b,e=1e-4)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
const project=editor=>({format:'railbound-adventures',version:2,world:'alpine',editor,player:{stock:STOCK[0].id}});
const fields=new Map();
const field=def=>{if(!fields.has(def.id))fields.set(def.id,new TerrainField(def).prepare());return fields.get(def.id);};

test('options clamp finite ranges and accept null/untrusted values',()=>{
 assert.deepEqual(generationOptions(null),{relief:1,vegetation:1,erosion:.65});
 assert.deepEqual(generationOptions({relief:Infinity,vegetation:-1,erosion:9}),{relief:1,vegetation:.25,erosion:1});
 assert.equal(generationOptions({relief:8}).relief,1.65);
});
test('same seed reproduces eroded heights and drainage bit for bit',()=>{
 const a=field(WORLDS[0]),b=new TerrainField(WORLDS[0]).prepare();
 assert.equal(digest(a.heights),digest(b.heights));assert.equal(digest(a.flow),digest(b.flow));
});
test('seed affects macro relief, hydraulic erosion and surveyed alignment',()=>{
 const a=field(WORLDS[0]),b=new TerrainField(WORLDS[0],a.seed+1).prepare();
 assert.notEqual(digest(a.heights),digest(b.heights));assert.notEqual(digest(a.flow),digest(b.flow));
 assert.notDeepEqual(surveyRoute(WORLDS[0],a),surveyRoute(WORLDS[0],b));
});
test('erosion is functional and approximately conserves sediment mass',()=>{
 const def=WORLDS[3],a=new TerrainField(def,def.seed,{erosion:0}).prepare(),b=field(def);
 assert.notEqual(digest(a.heights),digest(b.heights));assert.equal(a.stats.droplets,0);assert.ok(b.stats.droplets>5000);
 near(a.stats.mean,b.stats.mean,.02);
});
test('relief parameter changes actual height geometry',()=>{
 const def=WORLDS[0],a=new TerrainField(def,1234,{relief:.55,erosion:0}),b=new TerrainField(def,1234,{relief:1.65,erosion:0});
 assert.ok(b.height(2500,1800)-a.height(2500,1800)>100);
});
test('sampling at grid vertices and the grid boundary stays finite',()=>{
 const f=field(WORLDS[0]);
 for(const x of [-f.half,0,f.half])for(const z of [-f.half,0,f.half])assert.ok(Number.isFinite(f.height(x,z)));
 const x=33,z=77;near(f.height(x*f.step-f.half,z*f.step-f.half),f.heights[z*f.size+x],.001);
});
test('climate masks have bounded moisture, drainage and temperature',()=>{
 for(const def of WORLDS){const f=field(def);for(let i=0;i<60;i++){
  const c=f.climate(Math.sin(i*7)*f.half,Math.cos(i*13)*f.half);
  for(const key of ['moisture','drainage','temperature'])assert.ok(c[key]>=0&&c[key]<=1);
  assert.ok(c.slope>=0&&Number.isFinite(c.slope));
 }}
});
test('eight regions have independent geometry signatures, not recolored terrain',()=>{
 const signatures=new Set(WORLDS.map(def=>digest(field(def).heights)));assert.equal(signatures.size,8);
 assert.equal(new Set(Object.values(REGION_PROFILES).map(p=>p.geology)).size,8);
 // A radial bowl would have negligible angular variance at constant radius.
 for(const def of WORLDS){const f=field(def),values=Array.from({length:40},(_,i)=>f.height(Math.cos(i*Math.PI/20)*1500,Math.sin(i*Math.PI/20)*1500));
  assert.ok(Math.max(...values)-Math.min(...values)>30,def.id+' should not be rotationally uniform');
 }
});
test('legacy save migration retains the v2 track topology and original control heights',()=>{
 const p=validateProject(project({seed:8472}));assert.equal(p.editor.generationVersion,2);
 const n=new RailNetwork(WORLDS[0],null,{generationVersion:2});assert.equal(n.controls.length,14);
 const w=new RailwayWorld(WORLDS[0],p.editor);assert.equal(w.terrain,null);
 assert.deepEqual(w.network.controls,n.controls);
});
test('generation revision and settings round-trip without storing baked terrain',()=>{
 const p=validateProject(project({seed:72432,generationVersion:3,generation:{relief:1.2,vegetation:.45,erosion:.8}}));
 const q=validateProject(JSON.parse(JSON.stringify(p)));assert.deepEqual(q.editor,p.editor);
 assert.equal(q.editor.generationVersion,3);assert.equal(q.editor.generation.relief,1.2);assert.ok(!('heights' in q.editor));
});
test('worker transfer payload recreates the same numerical field',()=>{
 const a=field(WORLDS[0]),b=new TerrainField(WORLDS[0]);
 const cloned=structuredClone({heights:a.heights,flow:a.flow,stats:a.stats});
 Object.assign(b,cloned);for(let i=0;i<50;i++)near(a.height(i*11,i*-8),b.height(i*11,i*-8));
});
for(const def of WORLDS)test(def.id+': connected graded route, alternate corridor and finite scene',async()=>{
 const w=new RailwayWorld(def,{},field(def));await w.build();
 const n=w.network;assert.ok(n.totalLength>12000&&n.totalLength<60000);
 for(const edge of n.edges.values()){
  for(let s=0;s<edge.length;s+=83){const p=edge.at(s);assert.ok(p.p.every(Number.isFinite));assert.ok(Math.abs(p.grade)<.045,`${def.id} grade ${p.grade}`);}
  for(const next of edge.id==='approach'?['main','branch']:[n.next(edge.id)]){
   const a=edge.at(edge.length).p,b=n.edges.get(next).at(0).p;near(Math.hypot(...a.map((v,i)=>v-b[i])),0,.02);
  }
 }
 const cursor=new RailCursor(n);n.switchBranch=true;cursor.advance(n.edges.get('approach').length+30);assert.equal(cursor.edge,'branch');
 assert.ok(w.features.terrainTiles>200);assert.ok(w.features.landmarks>0);assert.ok(w.features.trees>0);
 const unique=new Set(w.batches.map(b=>b.geometry));for(const g of unique){assert.equal(g.vertices.length%8,0);assert.equal(g.indices.length%3,0);assert.ok(g.vertices.every(Number.isFinite));assert.ok(g.indices.every(i=>i<g.vertices.length/8));}
 for(const b of w.batches){assert.ok(b.data.every(Number.isFinite));assert.ok(Number.isFinite(b.radius));}
});
test('changed seeds create different route lengths and station coordinates',()=>{
 const a=new RailwayWorld(WORLDS[0],{seed:22}),b=new RailwayWorld(WORLDS[0],{seed:198765});
 assert.ok(Math.abs(a.network.totalLength-b.network.totalLength)>100);
 assert.notDeepEqual(a.network.edges.get('approach').at(a.stations[0].s).p,b.network.edges.get('approach').at(b.stations[0].s).p);
});
test('displaced boulders have outward finite normals',()=>{
 const v=PRIMITIVES.boulder.vertices;let positive=0;for(let i=0;i<v.length;i+=8){const d=v[i]*v[i+3]+v[i+1]*v[i+4]+v[i+2]*v[i+5];assert.ok(d>=-.001);if(d>.01)positive++;}assert.ok(positive>70);
});
test('offline shell contains every runtime module including the terrain worker',()=>{
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 for(const name of readdirSync(new URL('../src/',import.meta.url)).filter(n=>n.endsWith('.js')))assert.ok(sw.includes('src/'+name),'missing offline module '+name);
});
