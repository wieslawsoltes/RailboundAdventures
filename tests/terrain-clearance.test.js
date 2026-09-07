import test from 'node:test';
import assert from 'node:assert/strict';
import {terrainPatch} from '../src/terrain-mesh.js';
import {RailwayWorld} from '../src/world.js';
import {WORLDS,STOCK} from '../src/data.js';
import {Train} from '../src/physics.js';
import {CameraRig} from '../src/camera.js';

test('conforming adaptive mesh samples its actual rendered triangles',()=>{
 const world={height:(x,z)=>Math.sin(x*.013)*25+Math.cos(z*.017)*10,network:{nearest:(x,z)=>Math.abs(x-100)<100?{}:null},terrain:{climate:()=>({moisture:.4,drainage:0})}};
 const patch=terrainPatch(world,0,0,640,32,true);
 assert.ok(patch.division.includes(4)&&patch.division.includes(1));
 for(let z=7;z<640;z+=23)for(let x=3;x<640;x+=17){const h=patch.heightAt(x,z);assert.ok(Number.isFinite(h));assert.ok(Math.abs(h-world.height(x,z))<1.2);}
 const edges=new Map(),v=patch.geometry.vertices,ii=patch.geometry.indices;
 for(let c=0;c<patch.cells.length;c+=2)for(let i=patch.cells[c];i<patch.cells[c]+patch.cells[c+1];i+=3)for(let j=0;j<3;j++){
  const a=ii[i+j],b=ii[i+(j+1)%3],key=a<b?`${a},${b}`:`${b},${a}`;edges.set(key,(edges.get(key)||0)+1);
 }
 for(const [key,count] of edges){assert.ok(count<=2);if(count===1){const [a,b]=key.split(',').map(Number);assert.ok([0,640].some(s=>(v[a*8]===s&&v[b*8]===s)||(v[a*8+2]===s&&v[b*8+2]===s)),'Internal terrain edge must have two incident triangles: '+key);}}
});

test('Alpine deep cutting leaves the loading gauge clear after terrain tessellation',()=>{
 const world=new RailwayWorld(WORLDS[0]),edge=world.network.edges.get('approach'),patches=new Map();
 const surface=(x,z)=>{const ix=Math.floor(x/640),iz=Math.floor(z/640),key=ix+','+iz;if(!patches.has(key))patches.set(key,terrainPatch(world,ix*640,iz*640,640,32,true));return patches.get(key).heightAt(x,z);};
 world.surfaceHeight=surface;
 // This interval contains the below-ground cab screenshot reproduced in CI.
 for(let s=450;s<1000;s+=7){const p=edge.at(s);for(const offset of [-1.6,0,1.6]){const x=p.p[0]+p.right[0]*offset,z=p.p[2]+p.right[2]*offset;assert.ok(surface(x,z)<p.p[1]+.35,`Terrain intersects train gauge at ${s}, offset ${offset}`);}}
 const train=new Train(world.network,STOCK[1],'player','approach',580),camera=new CameraRig();camera.setMode('orbit');camera.distance=36;camera.azimuth=.62;camera.elevation=.13;camera.update(train,world,1/60,new Set());
 assert.ok(camera.position[1]>=surface(camera.position[0],camera.position[2])+2.4);
 const horizontal=Math.hypot(camera.position[0]-camera.target[0],camera.position[2]-camera.target[2]);assert.ok(horizontal>25,'Collision avoidance must not collapse the boom into a coach');
 for(let i=1;i<=16;i++){const t=i/16,p=camera.position.map((v,j)=>camera.target[j]+(v-camera.target[j])*t);assert.ok(p[1]>=surface(p[0],p[2])+2.4,'Camera sightline must clear the rendered terrain');}
});
