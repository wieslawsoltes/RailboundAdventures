import test from 'node:test';
import assert from 'node:assert/strict';
import {STOCK,WORLDS} from '../src/data.js';
import {RollingStockRenderer} from '../src/rolling-stock.js';
import {RailNetwork} from '../src/tracks.js';
import {Train} from '../src/physics.js';
import {PRIMITIVES,SceneBuilder} from '../src/geometry.js';

for(const stock of STOCK)test(stock.id+': detailed assemblies are finite, cached and animated by role',()=>{
 const r=new RollingStockRenderer(),parts=r.model(stock,0,false),stats=Object.values(r.detailCounts)[0];
 assert.ok(stats.parts>200,JSON.stringify(stats));assert.ok(stats.assemblies<stats.parts/3);
 assert.equal(r.model(stock,0,false),parts);assert.ok(parts.some(p=>p.tier===2));
 for(const part of parts){const g=PRIMITIVES[part.g];assert.ok(g);assert.ok(g.vertices.every(Number.isFinite));assert.ok(g.indices.every(i=>i<g.vertices.length/8));}
 assert.ok(parts.some(p=>p.role==='headlight'));
 if(['electric','highspeed','metro'].includes(stock.kind))assert.ok(parts.some(p=>p.role==='pantograph'));
});
test('close mechanical detail is culled with distance, without culling the train shell',()=>{
 const n=new RailNetwork(WORLDS[0]),train=new Train(n,STOCK[0]),r=new RollingStockRenderer();
 const position=train.cursor.pose().p,world={signals:[],weather:'clear'};
 const count=distance=>r.update([train],world,{position:[position[0]+distance,position[1]+6,position[2]],target:position},0,0,'chase').reduce((v,b)=>v+b.count,0);
 const close=count(12),middle=count(250),far=count(1300);assert.ok(close>middle&&middle>far,{close,middle,far});assert.ok(far>20);
});
test('wheel flange has real radial and axial profile, rather than a plain cylinder',()=>{
 const g=PRIMITIVES.wheel,v=g.vertices,radii=new Set(),axial=new Set();
 for(let i=0;i<v.length;i+=8){radii.add(Math.round(Math.hypot(v[i],v[i+2])*100));axial.add(Math.round(v[i+1]*100));}
 assert.ok(radii.size>=4&&axial.size>=5);assert.ok(g.indices.length>500);
});
test('spring is a genuine helical tube with finite normals and indices',()=>{
 const g=PRIMITIVES.spring;assert.ok(g.vertices.length>2000);assert.ok(g.vertices.every(Number.isFinite));assert.ok(g.indices.every(i=>i<g.vertices.length/8));
});
test('broadleaf and conifer LODs share instance placement and reduce triangle counts',()=>{
 const b=new SceneBuilder();for(const name of ['pine','foliage'])b.instance(name,[0,0,0],[10,10,10],[.3,.5,.2,1]);
 const batches=b.finish();assert.equal(batches.length,4);
 for(const near of batches.filter(x=>x.lodNear)){const far=batches.find(x=>x.lodFar===near.lodNear);assert.equal(far.data,near.data);assert.ok(far.geometry.indices.length<near.geometry.indices.length*.5);}
});
