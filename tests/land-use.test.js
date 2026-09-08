import test from 'node:test';
import assert from 'node:assert/strict';
import {stationLandUse,stationReservations} from '../src/land-use.js';
import {authoredSite} from '../src/authored-assets.js';
import {urbanLandUse,GroundCover} from '../src/botany.js';
function world(yaw=0,curved=false){
 const c=Math.cos(yaw),s=Math.sin(yaw),rotate=([x,y,z])=>[x*c+z*s,y,z*c-x*s];
 const edge={at(distance){const a=distance/500;const f=curved?rotate([Math.sin(a),0,Math.cos(a)]):rotate([0,0,1]);return {p:curved?rotate([500*(1-Math.cos(a)),5,500*Math.sin(a)]):rotate([0,5,distance]),f,right:[f[2],0,-f[0]]};}};
 return {seed:73,network:{edges:new Map([['main',edge]]),nearest:()=>null},stations:[{edge:'main',s:300,platform:160}],districts:[],def:{theme:'pine',water:0,snowLine:1000},terrain:{options:{vegetation:1},climate:()=>({moisture:.5,slope:0})},height:()=>5,baseHeight:()=>5,surfaceHeight:()=>5};
}
test('station buildings and each track-aligned platform bay reserve world space',()=>{
 for(const yaw of [0,.6,Math.PI])for(const curved of [false,true]){
  const w=world(yaw,curved);const edge=w.network.edges.get('main');
  for(let ds=-160;ds<14;ds+=7){const p=edge.at(300+ds);assert.equal(stationLandUse(w,p.p[0]+p.right[0]*4.7,p.p[2]+p.right[2]*4.7),true);}
  const p=edge.at(208),x=p.p[0]+p.right[0]*17,z=p.p[2]+p.right[2]*17;
  assert.equal(stationLandUse(w,x,z),true);assert.equal(stationLandUse(w,x+2000,z),false);
 }
});
test('station reservations are cached, immutable and replaced with a new station list',()=>{
 const w=world(),a=stationReservations(w);assert.equal(stationReservations(w),a);assert.ok(Object.isFrozen(a));assert.ok(Object.isFrozen(a[0].bays));
 w.stations=[{edge:'main',s:600,platform:160}];assert.notEqual(stationReservations(w),a);assert.equal(stationLandUse(w,17,208),false);
});
test('natural props and vegetation share station exclusions including model radius',()=>{
 const w=world();assert.equal(authoredSite(w,17,208,1),null);assert.equal(urbanLandUse(w,17,208),true);
 assert.equal(stationLandUse(w,25,208),false);assert.equal(stationLandUse(w,25,208,1),true);assert.equal(authoredSite(w,25,208,1),null);
 assert.deepEqual(authoredSite(w,40,208,1),[40,5,208]);
});
test('ground-cover tiles never instantiate inside station reservations',()=>{
 const w=world(),cover=new GroundCover();let count=0;
 for(let x=-1;x<=1;x++)for(let z=3;z<=8;z++)for(const b of cover.buildTile(w,x,z,'high').batches)for(let i=0;i<b.count;i++){
  assert.equal(stationLandUse(w,b.data[i*24+12],b.data[i*24+14],1),false);count++;
 }assert.ok(count>100);
});
test('empty or malformed station reservations cannot contaminate unrelated worlds',()=>{
 assert.equal(stationLandUse({},1,1),false);const w=world();w.stations=[{edge:'missing',s:10,platform:100},{edge:'main',s:NaN,platform:100}];assert.deepEqual(stationReservations(w),[]);assert.equal(stationLandUse(w,NaN,1),false);
});
