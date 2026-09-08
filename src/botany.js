/** Living Worlds: deterministic, instanced botany with shared near/mid/far meshes.
 * Compound-leaf cards are analytically cut out in both colour and shadow passes.
 * No external textures, random frame-dependent placement or per-tree draw calls.
 */
import {Geometry,MeshBuilder,Batch,PRIMITIVES} from './geometry.js';
import {rng,hash2,noise2,hex,clamp,smooth,add,sub,mul,norm,cross,transform,TAU} from './math.js';
export const BOTANY_REVISION=1;
export const SPECIES=['fir','oak','birch','cherry','pine'];
const palettes={fir:['#3e6542','#597b48'],pine:['#536e43','#749053'],oak:['#668344','#8b9d50'],birch:['#8caa57','#728d44'],cherry:['#dfb6bd','#c799a7']};
const cached=new Map();
function tube(b,a,c,r0,r1,sides=7){
 const axis=norm(sub(c,a)),right=norm(cross(axis,Math.abs(axis[1])>.95?[1,0,0]:[0,1,0])),up=cross(right,axis);
 const start=b.v.length/8;
 for(let j=0;j<2;j++)for(let i=0;i<=sides;i++){
  const t=i/sides*TAU,n=add(mul(right,Math.cos(t)),mul(up,Math.sin(t))),p=add(j?c:a,mul(n,j?r1:r0));
  b.vertex(p,n,[i/sides,j?Math.hypot(...sub(c,a))/Math.max(r0,.001):0]);
 }
 for(let i=0;i<sides;i++){const n=start+i,m=n+sides+1;b.i.push(n,m,n+1,n+1,m,m+1);}
}
function card(b,p,scale,yaw,tilt,normal){
 const right=[Math.cos(yaw),0,-Math.sin(yaw)],up=[Math.sin(yaw)*Math.sin(tilt),Math.cos(tilt),Math.cos(yaw)*Math.sin(tilt)];
 const a=mul(right,scale*.5),c=mul(up,scale*.5);
 b.quad(sub(sub(p,a),c),sub(add(p,a),c),add(add(p,a),c),add(sub(p,a),c),normal);
}
export function treeArchetype(species='fir',variant=0,lod=0){
 if(!SPECIES.includes(species))species='fir';variant=(variant|0)&1;lod=clamp(lod|0,0,2);
 const key=`botany-${species}-${variant}-${lod}`;if(cached.has(key))return cached.get(key);
 const wood=new MeshBuilder(),leaf=new MeshBuilder(),r=rng(9271+SPECIES.indexOf(species)*301+variant*99);
 const conifer=species==='fir'||species==='pine',birch=species==='birch';
 const lean=(r()-.5)*.10,tip=[lean,1,(r()-.5)*.08];
 tube(wood,[0,0,0],tip,birch?.012:.021,.002,lod===0?8:5);
 const clusters=[];
 if(conifer){
  const tiers=lod===0?12:lod===1?8:5;
  for(let i=0;i<tiers;i++){
   const y=.22+i/tiers*.76,extent=(1-y)*.44+.025,branches=lod===2?4:6;
   for(let j=0;j<branches;j++){
    const a=j/branches*TAU+i*2.399+variant,root=[lean*y,y,tip[2]*y],end=add(root,[Math.cos(a)*extent,y>.85?0:-.045,Math.sin(a)*extent]);
    if(lod<2)tube(wood,root,end,.004*(1-y)+.001,.001,5);
    for(let k=0;k<(lod===0?5:2);k++){
     const t=.30+k/(lod===0?6:3),p=add(root,mul(sub(end,root),t));
     const width=extent*(lod===2?1.7:lod===1?1.05:.64);
     clusters.push({p,scale:Math.max(.037,width),angle:a+Math.PI*.5,tilt:.7+(r()-.5)*.6});
    }
   }
  }
 }else{
  const branches=lod===0?11:lod===1?8:5;
  for(let i=0;i<branches;i++){
   const a=i*2.399+variant,y=.42+(i%4)*.085,extent=(birch?.18:.27)*(.7+r()*.5);
   const root=[lean*y,y,tip[2]*y],end=[Math.cos(a)*extent+lean,y+.20+r()*.13,Math.sin(a)*extent];
   if(lod<2)tube(wood,root,end,.008,.002,lod===0?7:5);
   const leaves=lod===0?22:lod===1?8:4;
   for(let k=0;k<leaves;k++){
    const theta=r()*TAU,v=r()*2-1,rad=Math.pow(r(),.4)*(birch?.12:.17);
    const p=add(end,[Math.cos(theta)*Math.sqrt(1-v*v)*rad,v*rad*.8,Math.sin(theta)*Math.sqrt(1-v*v)*rad]);
    const size=lod===0?.065+r()*.045:lod===1?.15:.23;
    clusters.push({p,scale:size,angle:r()*TAU,tilt:(r()-.5)*2.5});
   }
  }
 }
 for(const c of clusters){const n=norm([c.p[0]*2,c.p[1]-.42,c.p[2]*2]);card(leaf,c.p,c.scale,c.angle,c.tilt,n);}
 const result={wood:wood.geometry(),leaf:leaf.geometry(),leafCards:clusters.length,species,variant,lod};
 PRIMITIVES[key+'-wood']=result.wood;PRIMITIVES[key+'-leaf']=result.leaf;cached.set(key,result);return result;
}
/** Cell bounds are exact enough to cull canopy cells instead of entire forests. */
export class ForestBuilder {
 constructor(builder){this.builder=builder;this.cells=new Map();this.treeCount=0;}
 add(p,height,species,variation=0){
  if(!Number.isFinite(height)||height<=0||!p.every(Number.isFinite))return;
  const variant=variation>.5?1:0,cx=Math.floor(p[0]/192),cz=Math.floor(p[2]/192),palette=palettes[species]||palettes.fir;
  const color=hex(palette[variant]),wood=hex(species==='birch'?'#c9c7b1':'#6e604b'),yaw=variation*TAU;
  const matrix=transform(p,[height,height,height],yaw);
  for(let lod=0;lod<3;lod++){
   const model=treeArchetype(species,variant,lod);
   for(const role of ['wood','leaf']){
    if(lod===2&&role==='wood')continue;
    const key=`${cx},${cz},${species},${variant},${lod},${role}`;
    let batch=this.cells.get(key);
    if(!batch){batch=new Batch(model[role],{center:[cx*192+96,p[1]+height*.5,cz*192+96],radius:180,maxDistance:5800,castShadow:lod<2});
     batch.lodNear=lod===0?420:lod===1?1300:0;batch.lodFar=lod===0?0:lod===1?420:1300;
     batch.cutout=role==='leaf';batch.detailClass='forest';this.cells.set(key,batch);this.builder.batches.push(batch);}
    batch.radius=Math.max(batch.radius,Math.hypot(p[0]-batch.center[0],p[1]+height*.5-batch.center[1],p[2]-batch.center[2])+height*.65);
    batch.add(matrix,role==='leaf'?color:wood,role==='leaf'?[11,.86,species==='fir'||species==='pine'?1:0,variation]:[15,.94,0,0]);
   }
  }
  this.treeCount++;
 }
 finish(){for(const batch of this.cells.values())batch.finish();this.cells.clear();}
}
export function addLivingTree(world,p,height,variation=.5,species=null){
 if(!world.forest)world.forest=new ForestBuilder(world.builder);
 if(!species){const t=world.def.theme;species=t==='sakura'?(variation>.45?'cherry':'pine'):t==='nordic'?(variation>.7?'birch':'fir'):['pine','coast','metro'].includes(t)?(variation>.4?'oak':'pine'):'fir';}
 world.forest.add(p,height,species,variation);
}
export function urbanLandUse(world,x,z){
 for(const d of world.districts||[]){const dx=x-d.origin[0],dz=z-d.origin[2],lx=dx*d.right[0]+dz*d.right[2],lz=dx*d.forward[0]+dz*d.forward[2];
  if(lx>d.minX-8&&lx<d.maxX+8&&lz>d.minZ-8&&lz<d.maxZ+8)return true;}
 return false;
}
function plantCactus(world,p,height,variation){
 const b=world.builder,color=hex('#788762');b.instance('cylinder',add(p,[0,height*.5,0]),[.55,height,.55],color,[6,.9,0,0]);b.instance('sphere',add(p,[0,height,0]),[.55,.55,.55],color);
 for(const side of [-1,1]){const y=height*(side<0?.42:.62),x=side*(.7+variation*.45);b.segment(add(p,[0,y,0]),add(p,[x,y,0]),.35,color);b.instance('cylinder',add(p,[x,y+height*.14,0]),[.35,height*.28,.35],color);b.instance('sphere',add(p,[x,y+height*.28,0]),[.35,.35,.35],color);}
}
export async function buildLivingForest(world,onProgress=()=>{}){
 const f=world.terrain,w=world.def,span=Math.max(w.rx,w.rz)*2.05,spacing=f.profile.spacing*.58;
 let row=0,count=0;
 for(let z=-span;z<span;z+=spacing){for(let x=-span;x<span;x+=spacing){
  const ix=Math.floor(x/spacing),iz=Math.floor(z/spacing),v=hash2(ix,iz,world.seed+7);
  const px=x+spacing*(.12+.76*hash2(ix,iz,world.seed+11)),pz=z+spacing*(.12+.76*hash2(ix,iz,world.seed+19));
  const patch=noise2(px*.0022,pz*.0022,world.seed+911),chance=f.profile.forest*(.25+.75*smooth(.18,.68,patch))*f.options.vegetation;
  if(v>chance||urbanLandUse(world,px,pz))continue;
  const h=world.baseHeight(px,pz);if(h<w.water+2||h>w.snowLine+30)continue;
  const c=f.climate(px,pz,h);if(c.slope>.76||world.network.nearest(px,pz,11))continue;
  const p=[px,(world.surfaceHeight?.(px,pz)??world.height(px,pz))-.08,pz],variation=hash2(ix,iz,world.seed+61);
  const height=(10+variation*15)*(1-smooth(w.snowLine-130,w.snowLine+30,h)*.48);
  if(w.theme==='canyon'){if(v>.032)continue;if(variation>.35)plantCactus(world,p,height*.25,variation);else addLivingTree(world,p,height*.32,variation,'pine');}
  else addLivingTree(world,p,height,variation);
  count++;if(count>=70000)break;
 }if(count>=70000)break;if(++row%24===0){onProgress('Growing layered woodland',.74+.10*(z+span)/(2*span));await new Promise(resolve=>setTimeout(resolve,0));}}
 world.features.trees+=count;world.features.forestTrees=count;world.features.botanyRevision=BOTANY_REVISION;
 // Fallen timber, mossy outcrops and patches of young woodland follow the corridor.
 const r=rng(world.seed^0x703fa20);let understory=0;
 for(const edge of world.network.edges.values())for(let s=0;s<edge.length;s+=11){
  const pose=edge.at(s),offset=(r()>.5?1:-1)*(18+r()*170),p=add(pose.p,mul(pose.right,offset));
  const h=world.baseHeight(p[0],p[2]);if(h<w.water+2||h>w.snowLine||urbanLandUse(world,p[0],p[2])||world.network.nearest(p[0],p[2],9))continue;
  const c=f.climate(p[0],p[2],h);if(c.slope>.64)continue;p[1]=world.surfaceHeight?.(p[0],p[2])??world.height(p[0],p[2]);
  if(r()>.15&&w.theme!=='canyon'){addLivingTree(world,p,1.4+r()*3.4,r(),w.theme==='highland'?'cherry':'oak');understory++;}
  else if(r()>.4){const batch=world.builder.instance('boulder',add(p,[0,.35,0]),[2+r()*4,1+r()*2,2+r()*4],hex(w.rock),[6,.96,0,0],r()*TAU);batch.maxDistance=1300;}
  else if(w.theme!=='canyon'){const end=add(p,[3+r()*4,.25,r()*2]);world.builder.segment(add(p,[0,.35,0]),end,.4,hex('#63533f'),[15,.98,0,0]);}
 }
 world.features.shrubs+=understory;world.features.ecosystemSeed=world.seed;
}
function meadowGeometry(){
 const b=new MeshBuilder(),r=rng(412);for(let i=0;i<14;i++){
  const a=r()*TAU,h=.25+r()*.65,root=[(r()-.5)*1.9,0,(r()-.5)*1.9],side=[Math.cos(a)*.025,0,Math.sin(a)*.025];
  const mid=add(root,[Math.sin(a)*.15,h*.6,Math.cos(a)*.15]),tip=add(root,[Math.sin(a)*.36,h,Math.cos(a)*.36]);
  b.quad(sub(root,side),add(root,side),add(mid,mul(side,.65)),sub(mid,mul(side,.65)),[0,.85,0]);b.tri(sub(mid,mul(side,.65)),add(mid,mul(side,.65)),tip,[0,.85,0]);
 }return b.geometry();
}
PRIMITIVES.meadow=meadowGeometry();
/** Fixed-space hashed ground-cover tiles: bounded CPU cache, explicit GPU release.
 * Candidate positions do not change with quality. Only radius/acceptance change.
 */
export class GroundCover {
 constructor(){this.tiles=new Map();this.world=null;this.visibleInstances=0;this.pending=0;}
 clear(renderer){for(const t of this.tiles.values())for(const b of t.batches)renderer?.disposeBatch(b);this.tiles.clear();this.world=null;}
 update(world,camera,renderer,quality='high',budget=3){
  if(this.world!==world){this.clear(renderer);this.world=world;}
  const x=camera.position[0],z=camera.position[2],ground=world.surfaceHeight?.(x,z)??world.height(x,z);
  if(camera.position[1]-ground>95){this.visibleInstances=0;return [];}
  const radius=quality==='low'?70:quality==='medium'?115:quality==='ultra'?215:165,cell=40,cx=Math.floor(x/cell),cz=Math.floor(z/cell),n=Math.ceil(radius/cell),wanted=[];
  for(let j=-n;j<=n;j++)for(let i=-n;i<=n;i++){const tx=cx+i,tz=cz+j,d=Math.hypot((tx+.5)*cell-x,(tz+.5)*cell-z);if(d<radius+cell*.7)wanted.push({tx,tz,d,key:`${tx}:${tz}:${quality}`});}
  wanted.sort((a,b)=>a.d-b.d);const active=new Set(wanted.map(t=>t.key));
  for(const [key,t] of this.tiles)if(!active.has(key)){for(const b of t.batches)renderer?.disposeBatch(b);this.tiles.delete(key);}
  let generated=0;this.pending=0;const out=[];this.visibleInstances=0;
  for(const t of wanted){if(!this.tiles.has(t.key)){if(generated>=budget){this.pending++;continue;}this.tiles.set(t.key,this.buildTile(world,t.tx,t.tz,quality));generated++;}
   const tile=this.tiles.get(t.key);out.push(...tile.batches);this.visibleInstances+=tile.instances;}
  return out;
 }
 buildTile(world,tx,tz,quality){
  const batches=new Map(),cell=40,step=quality==='low'?5:quality==='medium'?3.8:2.8;let instances=0;
  for(let j=0;j<14;j++)for(let i=0;i<14;i++){
   const r=rng((Math.imul(tx*14+i,73856093)^Math.imul(tz*14+j,19349663)^world.seed)>>>0);
   // Fixed 14x14 candidate grid; nested hash threshold avoids reshuffling grass.
   const px=tx*cell+(i+.15+r()*.7)*cell/14,pz=tz*cell+(j+.15+r()*.7)*cell/14,accept=r();
   if(accept>(2.8/step)**2*Math.min(1,world.terrain?.options?.vegetation??1)||urbanLandUse(world,px,pz)||world.network.nearest(px,pz,7.2))continue;
   const raw=world.baseHeight(px,pz),f=world.terrain;if(raw<world.def.water+.5||raw>world.def.snowLine||!f)continue;
   const c=f.climate(px,pz,raw);if(c.slope>.75)continue;
   const desert=world.def.theme==='canyon';if(desert&&accept>.12)continue;
   const h=world.surfaceHeight?.(px,pz)??world.height(px,pz),name=!desert&&accept>.96?'flower':c.moisture>.67&&accept<.3?'fern':'meadow';
   let b=batches.get(name);if(!b){b=new Batch(PRIMITIVES[name],{center:[tx*cell+20,h,tz*cell+20],radius:40,maxDistance:250,castShadow:false});b.detailClass='groundcover';batches.set(name,b);}
   const scale=(desert?.6:.75)+r()*.45;
   const color=hex(name==='flower'?(accept>.98?'#e6d6a0':'#b5a2c7'):desert?'#a99b64':world.def.theme==='highland'?'#8d9662':accept>.5?'#819451':'#5d803d');
   b.add(transform([px,h-.025,pz],[1.4,scale,1.4],r()*TAU),color,[5,.94,0,0]);
   b.radius=Math.max(b.radius,Math.hypot(px-b.center[0],h-b.center[1],pz-b.center[2])+3);instances++;
  }
  for(const b of batches.values())b.finish();return {batches:[...batches.values()],instances};
 }
}
