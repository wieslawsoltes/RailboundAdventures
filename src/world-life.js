/** Deterministic scenic animation. Nothing here mutates the rail connectivity graph. */
import {Batch,Geometry,MeshBuilder,PRIMITIVES} from './geometry.js';
import {rng,hex,transform,add,mul,norm,sub,frameMatrix,mat4Mul,TAU,lerp} from './math.js';
PRIMITIVES.birdWing=new Geometry([0,0,0,0,1,0,0,0,.90,.015,-.15,0,1,0,1,0,1.35,0,.36,0,1,0,1,1,.35,0,.21,0,1,0,0,1],[0,1,2,0,2,3]);
export function flockPose(flock,time,index){
 const phase=flock.phase+index*.21,t=time*flock.speed+phase,r=flock.radius+index*3;
 return {position:[flock.x+Math.cos(t)*r,flock.y+Math.sin(t*.63+index)*5,flock.z+Math.sin(t)*r*.62],yaw:-t,flap:Math.sin(time*4.7+phase*3)*.43};
}
export class WorldLife {
 constructor(){this.wings=new Batch(PRIMITIVES.birdWing,{dynamic:true,castShadow:false});this.bodies=new Batch(PRIMITIVES.sphere,{dynamic:true,castShadow:false});this.flocks=[];this.visibleBirds=0;}
 reset(world){
  const random=rng(world.seed^0x54ea2c1);this.flocks=[];
  for(const edge of world.network.edges.values())for(let i=0;i<8;i++){
   const p=edge.at(random()*edge.length),x=p.p[0]+(random()-.5)*600,z=p.p[2]+(random()-.5)*600;
   const y=Math.max(world.height(x,z),world.def.water)+40+random()*95;
   this.flocks.push({x,y,z,radius:35+random()*70,phase:random()*TAU,speed:.065+random()*.08,count:3+(i%3)});
  }
 }
 update(world,camera,time,quality='high',enabled=true){
  this.wings.reset();this.bodies.reset();this.visibleBirds=0;const max=quality==='low'?12:quality==='medium'?32:80;
  if(enabled)for(const f of this.flocks){
   if(Math.hypot(f.x-camera.position[0],f.z-camera.position[2])>1200)continue;
   for(let i=0;i<f.count&&this.visibleBirds<max;i++){
    const p=flockPose(f,time,i),base=transform(p.position,[1,1,1],p.yaw),color=world.def.theme==='coast'?hex('#d5d8cd'):hex('#393f3b');
    color[3]=-1; // Negative tint alpha marks moving geometry for temporal rejection.
    for(const side of [-1,1])this.wings.add(mat4Mul(base,transform([0,0,0],[side,1,1],0,0,p.flap*side)),color,[0,.9,0,0]);
    this.bodies.add(mat4Mul(base,transform([0,-.08,.12],[.23,.22,.66])),color,[0,.9,0,0]);this.visibleBirds++;
   }
  }
  for(const b of [this.wings,this.bodies]){b.center=camera.position;b.radius=1500;b.flush();}
  return [this.wings,this.bodies];
 }
}

/** Marching-square shoreline ribbons from the actual eroded field, not a radial shore.
 * Ambiguous cells generate two separate segments, never a long crossed quad.
 */
export function shoreSegments(field,water){
 const segments=[],n=field.size,h=field.heights,step=field.step,half=field.half;
 const position=(x,z)=>[x*step-half,water+.10,z*step-half];
 for(let z=0;z<n-1;z++)for(let x=0;x<n-1;x++){
  const points=[[x,z],[x+1,z],[x+1,z+1],[x,z+1]],hits=[];
  for(let i=0;i<4;i++){
   const a=points[i],b=points[(i+1)%4],ha=h[a[1]*n+a[0]]-water,hb=h[b[1]*n+b[0]]-water;
   if((ha<0)===(hb<0))continue;
   const t=ha/(ha-hb);hits.push(position(lerp(a[0],b[0],t),lerp(a[1],b[1],t)));
  }
  for(let i=0;i+1<hits.length;i+=2)segments.push([hits[i],hits[i+1]]);
 }
 return segments;
}
export function buildShoreline(world){
 if(!world.terrain)return;
 // Brush edits are intentionally sparse; resample only when the editor changed relief.
 const field=world.editor.heightEdits?.length?{...world.terrain,heights:Float32Array.from(world.terrain.heights,(_,i)=>world.height((i%world.terrain.size)*world.terrain.step-world.terrain.half,Math.floor(i/world.terrain.size)*world.terrain.step-world.terrain.half))}:world.terrain;
 const segments=shoreSegments(field,world.def.water),tiles=new Map();
 for(const [a,b] of segments){
  const dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz);if(length<.1)continue;
  const normal=[-dz/length,0,dx/length],width=world.def.theme==='coast'?3:1.3;
  const center=mul(add(a,b),.5),key=`${Math.floor(center[0]/640)}:${Math.floor(center[2]/640)}`;
  let tile=tiles.get(key);if(!tile){tile={mesh:new MeshBuilder(),center};tiles.set(key,tile);}
  tile.mesh.quad(add(a,mul(normal,-width)),add(b,mul(normal,-width)),add(b,mul(normal,width)),add(a,mul(normal,width)),[0,1,0]);
 }
 for(const {mesh,center} of tiles.values()){
  const b=world.builder.mesh(mesh.geometry(),center,950,[10,.4,0,.1],[.72,.83,.83,.35]);b.castShadow=false;b.transparent=true;b.maxDistance=4200;
 }
 world.features.shoreSegments=segments.length;
}
