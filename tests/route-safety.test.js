import test from 'node:test';
import assert from 'node:assert/strict';
import {WORLDS} from '../src/data.js';
import {TerrainField} from '../src/generation.js';
import {RailNetwork} from '../src/tracks.js';

// Reproduces the coastal branch cusp exposed by seed 1 at maximum relief.
// Check every segment, not just sparse speed/grade samples.
for (const def of WORLDS) test(`${def.id}: extreme seeds retain forward branch tangents and bounded grades`, () => {
 for (const seed of [1,720251,2147483647]) {
  const terrain=new TerrainField(def,seed,{relief:1.65,erosion:1}).prepare();
  const network=new RailNetwork(def,null,{seed,terrain,generationVersion:3});
  const main=network.edges.get('main').points,branch=network.edges.get('branch').points;
  assert.equal(branch.length,main.length);
  for (const edge of network.edges.values()) for(let i=1;i<edge.points.length;i++) {
   const a=edge.points[i-1],b=edge.points[i],horizontal=Math.hypot(b[0]-a[0],b[2]-a[2]);
   assert.ok(horizontal>1e-5,`${seed}/${edge.id}: degenerate segment`);
   assert.ok(Math.abs(b[1]-a[1])/horizontal<.045,`${seed}/${edge.id}: excessive grade`);
  }
  for(let i=1;i<branch.length;i++) {
   const a=main[i-1],b=main[i],c=branch[i-1],d=branch[i];
   const ux=b[0]-a[0],uz=b[2]-a[2],vx=d[0]-c[0],vz=d[2]-c[2];
   assert.ok(ux*vx+uz*vz>0,`${seed}: folded parallel route`);
   assert.ok(Math.hypot(vx,vz)>.6*Math.hypot(ux,uz),`${seed}: compressed branch cusp`);
  }
 }
});
