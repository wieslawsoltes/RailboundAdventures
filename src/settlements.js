/** Parcel-based regional settlements. Road graph -> buildable lots -> architecture.
 * Streets and foundations sample the rendered terrain. Every lot reserves a
 * footprint; water, steep grades, rail clearance and overlaps are rejected.
 */
import {Geometry,MeshBuilder,PRIMITIVES} from './geometry.js';
import {rng,hash2,hex,clamp,add,mul,transform,mat4Mul,norm,sub,TAU} from './math.js';
import {addLivingTree} from './botany.js';
export const CITY_REVISION=1;
export const DISTRICT_PROFILES={
 metro:{cols:6,rows:9,pitch:72,height:12,style:'metropolitan'},
 sakura:{cols:4,rows:6,pitch:62,height:5,style:'compact'},
 coast:{cols:4,rows:5,pitch:70,height:4,style:'coastal'},
 pine:{cols:3,rows:5,pitch:70,height:4,style:'old-town'},
 alpine:{cols:3,rows:4,pitch:68,height:3,style:'alpine'},
 nordic:{cols:3,rows:4,pitch:70,height:3,style:'nordic'},
 highland:{cols:3,rows:4,pitch:72,height:3,style:'stone'},
 canyon:{cols:3,rows:4,pitch:78,height:2,style:'desert'}
};
const WALLS=['#b6afa1','#c9c1ad','#a99079','#bcb8af','#9faaa8','#b0a393','#c5b7a4'];
const ASPHALT=hex('#434b4c'),PAVING=hex('#acaaa0'),CURB=hex('#c8c4b7'),STEEL=hex('#3a4547');
function surface(world,x,z){return world.surfaceHeight?.(x,z)??world.height(x,z);}
export function districtPoint(d,x,z){return [d.origin[0]+d.right[0]*x+d.forward[0]*z,0,d.origin[2]+d.right[2]*x+d.forward[2]*z];}
export function planSettlements(world){
 const profile=DISTRICT_PROFILES[world.def.theme]||DISTRICT_PROFILES.pine;
 return world.stations.map((station,index)=>{
  const pose=world.network.edges.get(station.edge).at(station.s-80),cols=profile.cols,rows=profile.rows,pitch=profile.pitch;
  const d={id:`district-${index}`,name:station.name,origin:[...pose.p],right:[...pose.right],forward:[...pose.f],yaw:Math.atan2(pose.f[0],pose.f[2]),cols,rows,pitch,minX:32,maxX:32+cols*pitch,minZ:-rows*pitch*.5,maxZ:rows*pitch*.5,profile,roads:[],lots:[],buildings:[]};
  for(let row=0;row<=rows;row++)for(let col=0;col<cols;col++)d.roads.push({a:[32+col*pitch,d.minZ+row*pitch],b:[32+(col+1)*pitch,d.minZ+row*pitch],axis:'x'});
  for(let col=0;col<=cols;col++)for(let row=0;row<rows;row++)d.roads.push({a:[32+col*pitch,d.minZ+row*pitch],b:[32+col*pitch,d.minZ+(row+1)*pitch],axis:'z'});
  const random=rng(world.seed^Math.imul(index+1,0x45d9f3b));
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
   const cx=32+(col+.5)*pitch,cz=d.minZ+(row+.5)*pitch,park=(col+row*3+index)%11===4;
   d.lots.push({id:`${index}:${col}:${row}`,cx,cz,park,seed:random(),col,row});
  }
  return d;
 });
}
export function footprint(world,p,width,depth,yaw){
 const c=Math.cos(yaw),s=Math.sin(yaw),points=[];
 for(const x of [-width*.5,0,width*.5])for(const z of [-depth*.5,0,depth*.5]){
  const px=p[0]+x*c+z*s,pz=p[2]-x*s+z*c,h=surface(world,px,pz);
  if(h<world.def.water+1.2||world.network.nearest(px,pz,9))return null;
  points.push(h);
 }
 const low=Math.min(...points),high=Math.max(...points);return high-low>5?null:{low,high};
}
function localPart(world,d,origin,pos,size,color,props=[0,.8,0,0],name='box',roll=0){
 const base=transform(origin,[1,1,1],d.yaw);
 return world.builder.oriented(name,mat4Mul(base,transform(pos,size,0,0,roll)),color,props);
}
/** Road span validator prevents roads from bridging lakes or climbing cliff faces. */
export function roadSamples(world,d,road){
 const length=Math.hypot(road.b[0]-road.a[0],road.b[1]-road.a[1]),n=Math.ceil(length/4),points=[];
 for(let i=0;i<=n;i++){
  const t=i/n,p=districtPoint(d,road.a[0]+(road.b[0]-road.a[0])*t,road.a[1]+(road.b[1]-road.a[1])*t),h=surface(world,p[0],p[2]);
  if(h<world.def.water+1.4||world.network.nearest(p[0],p[2],10))return null;
  if(points.length&&Math.abs(h-points.at(-1)[1])/(length/n)>.13)return null;
  p[1]=h+.13;points.push(p);
 }return points;
}
/** Keep the largest connected street component; do not strand blocks on islands. */
export function connectedRoads(roads,candidates){
 const adjacency=new Map();const key=p=>p.join(',');
 for(const index of candidates.keys())for(const p of [roads[index].a,roads[index].b]){
  const k=key(p);if(!adjacency.has(k))adjacency.set(k,[]);adjacency.get(k).push(index);
 }
 const seen=new Set();let largest=[];
 for(const first of candidates.keys()){
  if(seen.has(first))continue;const component=[],queue=[first];seen.add(first);
  for(let q=0;q<queue.length;q++){const i=queue[q];component.push(i);
   for(const p of [roads[i].a,roads[i].b])for(const next of adjacency.get(key(p))||[])
    if(!seen.has(next)){seen.add(next);queue.push(next);}
  }
  if(component.length>largest.length)largest=component;
 }
 return new Map(largest.map(i=>[i,candidates.get(i)]));
}
function buildRoad(world,d,road,points){
 const b=world.builder,mesh=new MeshBuilder(),sidewalk=new MeshBuilder(),direction=norm(sub(points.at(-1),points[0])),side=norm([-direction[2],0,direction[0]]);
 const ground=(p,off,y=0)=>{const q=add(p,mul(side,off));q[1]=surface(world,q[0],q[2])+.16+y;return q;};
 for(let i=0;i<points.length-1;i++){
  const a=points[i],c=points[i+1];mesh.quad(ground(a,-4.2),ground(c,-4.2),ground(c,4.2),ground(a,4.2),[0,1,0]);
  for(const sign of [-1,1]){
   sidewalk.quad(ground(a,sign*4.2,.13),ground(c,sign*4.2,.13),ground(c,sign*7,.13),ground(a,sign*7,.13),[0,1,0]);
   sidewalk.quad(ground(a,sign*4.2),ground(c,sign*4.2),ground(c,sign*4.2,.13),ground(a,sign*4.2,.13));
  }
  if(i%3===1){const a1=ground(a,0,.035),c1=ground(c,0,.035);b.segment(a1,c1,.11,hex('#d0cbb9'),[0,.96,0,0],.014);}
 }
 const middle=points[Math.floor(points.length/2)],radius=d.pitch*.8;
 const asphalt=b.mesh(mesh.geometry(),middle,radius,[13,.92,0,0],ASPHALT);asphalt.maxDistance=3600;
 const walk=b.mesh(sidewalk.geometry(),middle,radius,[6,.92,0,0],PAVING);walk.maxDistance=2700;
 for(const t of [.18,.75]){
  const p=ground(points[Math.floor((points.length-1)*t)],5.8,.13);
  const lamp=b.instance('cylinder',add(p,[0,3.3,0]),[.11,6.6,.11],STEEL);lamp.maxDistance=2600;
  b.segment(add(p,[0,6.6,0]),add(p,mul(side,-1.2)).map((v,i)=>i===1?v+6.6:v),.08,STEEL);
  b.instance('box',add(add(p,mul(side,-1.05)),[0,6.55,0]),[.55,.10,.35],hex('#f0deb2'),[4,.6,0,.45]);
 }
 // Zebra crossings and stop line at each end, built on the same terrain samples.
 for(const end of [0,points.length-1])for(let lane=-3;lane<=3;lane+=1.1){
  const p=ground(points[end],lane,.035),yaw=Math.atan2(direction[0],direction[2]);
  b.instance('box',p,[.62,.025,2.2],hex('#d8d4c5'),[0,.95,0,0],yaw);
 }
 world.features.roadSegments=(world.features.roadSegments||0)+1;
}
function gable(world,d,p,width,depth,height,color){
 const base=transform(p,[1,1,1],d.yaw),m=new MeshBuilder(),w=width*.5+.55,z=depth*.5+.6,rise=Math.min(width*.30,4.8);
 m.quad([-w,height,-z],[0,height+rise,-z],[0,height+rise,z],[-w,height,z]);
 m.quad([0,height+rise,-z],[w,height,-z],[w,height,z],[0,height+rise,z]);
 // End walls close the attic instead of leaving a hollow roof.
 m.tri([-w,height,-z],[w,height,-z],[0,height+rise,-z],[0,0,-1]);m.tri([w,height,z],[-w,height,z],[0,height+rise,z],[0,0,1]);
 const geom=m.geometry();for(let i=0;i<geom.vertices.length;i+=8){const x=geom.vertices[i],y=geom.vertices[i+1],z0=geom.vertices[i+2];geom.vertices[i]=base[0]*x+base[8]*z0+base[12];geom.vertices[i+1]=y+p[1];geom.vertices[i+2]=base[2]*x+base[10]*z0+base[14];const nx=geom.vertices[i+3],nz=geom.vertices[i+5];geom.vertices[i+3]=base[0]*nx+base[8]*nz;geom.vertices[i+5]=base[2]*nx+base[10]*nz;geom.vertices[i+6]=x;geom.vertices[i+7]=z0;}
 world.builder.mesh(geom,add(p,[0,height,0]),Math.hypot(width,depth)+rise,[14,.9,0,0],color).maxDistance=3200;
}
function building(world,d,p,width,depth,floors,style,seed){
 const pad=footprint(world,p,width+1,depth+1,d.yaw);if(!pad)return false;
 const b=world.builder,height=floors*3.2,base=[p[0],pad.high+.12,p[2]],palette=WALLS[Math.floor(seed*WALLS.length)%WALLS.length],color=hex(palette);
 localPart(world,d,base,[0,(pad.low-pad.high)/2-.3,0],[width+.5,pad.high-pad.low+.6,depth+.5],hex('#87877d'),[6,.97,0,0]);
 world.features.foundations=(world.features.foundations||0)+1;
 const facade=localPart(world,d,base,[0,height*.5,0],[width,height,depth],color,[12,.85,style==='glass'?1:0,seed]);facade.maxDistance=5500;
 const roof=hex(style==='alpine'||style==='nordic'?'#535d5d':style==='stone'?'#6a6a63':style==='compact'?'#5c6369':'#866e5e');
 if(floors<=4&&style!=='glass'&&style!=='desert')gable(world,d,base,width,depth,height,roof);
 else{
  localPart(world,d,base,[0,height+.12,0],[width+.45,.24,depth+.45],hex('#8d938f'),[14,.92,0,0]);
  for(const side of [-1,1]){
   localPart(world,d,base,[side*width*.5,height+.5,0],[.2,.75,depth+.2],color,[6,.92,0,0]);
   localPart(world,d,base,[0,height+.5,side*depth*.5],[width,.75,.2],color,[6,.92,0,0]);
  }
  localPart(world,d,base,[width*.20,height+1,0],[width*.30,1.4,depth*.28],hex('#777f80'),[6,.78,.3,0]);
  for(let j=0;j<3;j++)localPart(world,d,base,[width*.20,height+1.72,(j-1)*depth*.07],[width*.19,.07,.13],STEEL,[0,.4,.6,0]);
 }
 // Storefront and entry: the opening faces the parcel's access lane.
 localPart(world,d,base,[0,1.2,depth*.5+.06],[1.7,2.4,.13],hex('#263a3c'),[3,.2,.2,0]);
 localPart(world,d,base,[0,2.66,depth*.5+.6],[width*.7,.16,1.45],hex(seed>.5?'#506961':'#875e49'),[0,.9,0,0]);
 localPart(world,d,base,[0,.11,depth*.5+.7],[width*.72,.22,1.35],CURB,[6,.93,0,0]);
 if(floors>2&&style!=='glass')for(let floor=1;floor<Math.min(floors,7);floor++){
  for(const side of [-1,1]){
   const x=side*width*.27,y=floor*3.2+.1,z=depth*.5+.62;
   const slab=localPart(world,d,base,[x,y,z],[width*.33,.15,1.35],color,[6,.9,0,0]);slab.maxDistance=2300;
   localPart(world,d,base,[x,y+.62,z+.6],[width*.33,.80,.075],hex('#697979'),[0,.6,.4,0]);
   for(let k=-1;k<=1;k++)localPart(world,d,base,[x+k*width*.11,y+.6,z+.65],[.045,.85,.045],STEEL);
  }
 }
 // Corner drainpipes, chimney, and roof solar panels form recognisable silhouettes.
 for(const side of [-1,1])localPart(world,d,base,[side*(width*.5+.075),height*.48,-depth*.42],[.10,height*.96,.10],STEEL,[0,.6,.3,0]);
 if(floors<=4){localPart(world,d,base,[width*.22,height+2.3,-depth*.22],[.9,3.1,1.1],hex('#8d8376'),[12,.95,0,seed]);
  if(seed>.5)for(let k=0;k<3;k++)localPart(world,d,base,[-width*.23,height+width*.12+.5,(k-1)*2.1],[width*.32,.09,1.8],hex('#2b4654'),[3,.19,.5,0],'box',-.43);}
 d.buildings.push({position:base,width,depth,height,floors,style});world.features.buildings++;return true;
}
function garden(world,d,lot){
 const p=districtPoint(d,lot.cx,lot.cz),h=surface(world,p[0],p[2]);if(h<world.def.water+2)return;
 const r=rng(Math.floor(lot.seed*1e9));
 for(let i=0;i<16;i++){
  const q=districtPoint(d,lot.cx+(r()-.5)*(d.pitch-23),lot.cz+(r()-.5)*(d.pitch-23));q[1]=surface(world,q[0],q[2]);
  if(q[1]<world.def.water+1||world.network.nearest(q[0],q[2],11))continue;addLivingTree(world,q,7+r()*6,r(),'oak');world.features.trees++;
 }
 // Park path is narrow and conforming rather than a floating square lawn.
 for(let z=-d.pitch*.30;z<d.pitch*.3;z+=4){const q=districtPoint(d,lot.cx,lot.cz+z);q[1]=surface(world,q[0],q[2])+.1;world.builder.instance('box',q,[2.3,.1,4.1],hex('#b4ac95'),[6,.95,0,0],d.yaw);}
 world.features.parks=(world.features.parks||0)+1;
}
export async function buildSettlements(world,onProgress=()=>{}){
 world.districts=world.districts||planSettlements(world);world.features.cityRevision=CITY_REVISION;
 for(const d of world.districts){
  const candidates=new Map();for(let i=0;i<d.roads.length;i++){const points=roadSamples(world,d,d.roads[i]);if(points)candidates.set(i,points);}
  const connected=connectedRoads(d.roads,candidates),valid=new Set(connected.keys());for(const [i,points] of connected){d.roads[i].built=true;buildRoad(world,d,d.roads[i],points);}
  for(const lot of d.lots){
   // Reject landlocked parcels: at least one of their four frontages must exist.
   const {col,row}=lot,first=(d.rows+1)*d.cols;
   const access=[row*d.cols+col,(row+1)*d.cols+col,first+col*d.rows+row,first+(col+1)*d.rows+row].some(i=>valid.has(i));
   if(!access)continue;if(lot.park){garden(world,d,lot);continue;}
   const r=rng(Math.floor(lot.seed*0xffffffff)),metro=world.def.theme==='metro',commercial=metro&&(col<3&&row>1&&row<d.rows-2),pitch=d.pitch;
   for(const sx of [-1,1])for(const sz of [-1,1]){
    const width=12+r()*8,depth=15+r()*8,p=districtPoint(d,lot.cx+sx*pitch*.22,lot.cz+sz*pitch*.22),style=commercial&&r()>.5?'glass':d.profile.style;
    const floors=commercial?5+Math.floor(r()**2*24):1+Math.floor(r()*d.profile.height);
    if(building(world,d,p,width,depth,floors,style,r())){
     const q=districtPoint(d,lot.cx+sx*(pitch*.42),lot.cz+sz*pitch*.22);q[1]=surface(world,q[0],q[2]);
     if(q[1]>world.def.water+1){addLivingTree(world,q,7+r()*5,r(),world.def.theme==='sakura'?'cherry':'oak');world.features.trees++;}
    }
   }
  }
  // Parked vehicles occupy curbside bays, not random positions amongst buildings.
  for(let i=0;i<d.roads.length;i+=3){const road=d.roads[i];if(!road.built)continue;
   const x=(road.a[0]+road.b[0])*.5+(road.axis==='z'?3.1:0),z=(road.a[1]+road.b[1])*.5+(road.axis==='x'?3.1:0),p=districtPoint(d,x,z);p[1]=surface(world,p[0],p[2])+.18;
   world.buildCar(p,d.yaw+(road.axis==='x'?Math.PI*.5:0),i);world.features.parkedCars=(world.features.parkedCars||0)+1;
  }
  if(d.buildings.length){const center=d.buildings[Math.floor(d.buildings.length*.5)].position;world.viewpoints.push({name:`${d.name} streets`,position:add(center,mul(d.forward,85)).map((v,i)=>i===1?v+55:v),target:add(center,[0,8,0])});}
  onProgress('Laying streets, parcels & neighbourhoods',.59);await new Promise(resolve=>setTimeout(resolve,0));
 }
 world.features.districts=world.districts.filter(d=>d.buildings.length).length;
}
