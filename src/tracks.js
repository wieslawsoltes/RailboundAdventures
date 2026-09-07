import {TerrainField, surveyRoute} from './generation.js';
import {clamp,lerp,mix3,norm,sub,add,mul,cross,length,catmull,mod,TAU} from './math.js';
/** Arc-length parameterized, sampled railway edges. Drawing and physics use the same centerline. */
export class TrackEdge {
 constructor(id,points,limit=120){this.id=id;this.points=points;this.limit=limit;this.arc=new Float64Array(points.length);for(let i=1;i<points.length;i++)this.arc[i]=this.arc[i-1]+length(sub(points[i],points[i-1]));this.length=this.arc.at(-1);if(!(this.length>1))throw new Error('Track edge is too short');}
 at(distance){const s=clamp(distance,0,this.length);let a=0,b=this.arc.length-1;while(a+1<b){const m=(a+b)>>1;if(this.arc[m]<=s)a=m;else b=m;}const d=this.arc[b]-this.arc[a],p=mix3(this.points[a],this.points[b],d?(s-this.arc[a])/d:0),f=norm(sub(this.points[b],this.points[a]));return {p,f,right:norm(cross([0,1,0],f)),grade:f[1]/Math.max(.1,Math.hypot(f[0],f[2])),s,edge:this.id};}
 curvature(s){const a=this.at(s-6).f,b=this.at(s+6).f;return Math.hypot(a[0]-b[0],a[2]-b[2])/12;}
 speedLimit(s){const k=this.curvature(s);return Math.min(this.limit,k>.00004?Math.sqrt(.85/k)*3.6:this.limit);}
}
function splineLoop(points,spacing=3){const result=[];for(let i=0;i<points.length;i++){const a=points[mod(i-1,points.length)],b=points[i],c=points[(i+1)%points.length],d=points[(i+2)%points.length],n=Math.max(8,Math.ceil(length(sub(c,b))/spacing));for(let j=0;j<n;j++)result.push(catmull(a,b,c,d,j/n));}result.push([...result[0]]);return result;}
export class RailNetwork {
 constructor(world,customPoints=null,options={}){this.world=world;this.switchBranch=false;this.edges=new Map();this.spatial=new Map();this.cell=100;let controls;
  if(customPoints?.length>=4){controls=customPoints.map(p=>[p.x,p.y,p.z]);}
  else if(options.generationVersion!==2){controls=surveyRoute(world,options.terrain||new TerrainField(world,options.seed||world.seed,options.generation));}
  else{controls=[];for(let i=0;i<14;i++){const t=i/14*TAU;const radius=1+.085*Math.sin(t*3+.7)+.055*Math.cos(t*5);controls.push([Math.sin(t)*world.rx*radius,world.railY+Math.sin(t*2+.2)*world.gradeHeight+Math.cos(t*3)*world.gradeHeight*.2,Math.cos(t)*world.rz*radius]);}}
  this.controls=controls.map(p=>({x:p[0],y:p[1],z:p[2]}));const all=splineLoop(controls);
  if(options.generationVersion!==2&&!customPoints){
   const terrain=options.terrain||new TerrainField(world,options.seed||world.seed,options.generation);
   let best=0,score=Infinity;const count=all.length-1;
   for(let i=0;i<count;i+=32){const p=all[i],q=all[(i+64)%count],h=terrain.height(p[0],p[2]),cost=Math.abs(p[1]-h-3)+Math.abs(q[1]-terrain.height(q[0],q[2])-3)*.6;
    if(cost<score){best=i;score=cost;}}
   const rotated=all.slice(0,count);all.length=0;for(let i=0;i<count;i++)all.push(rotated[(i+best)%count]);all.push([...all[0]]);
  }
  const a=Math.floor(all.length*.24),b=Math.floor(all.length*.43);const main=new TrackEdge('main',all.slice(a,b+1),world.limit);this.edges.set('approach',new TrackEdge('approach',all.slice(0,a+1),world.limit));this.edges.set('main',main);this.edges.set('return',new TrackEdge('return',all.slice(b),world.limit));
  const p0=all[a],p1=all[b],f0=norm(sub(all[a+2],all[a])),f1=norm(sub(all[b],all[b-2]));const span=length(sub(p1,p0));const branch=[];const c0=add(p0,mul(f0,span*.45)),c1=sub(p1,mul(f1,span*.45));for(let j=0;j<=Math.ceil(span/3);j++){const t=j/Math.ceil(span/3),u=1-t;branch.push([0,1,2].map(k=>u*u*u*p0[k]+3*u*u*t*c0[k]+3*u*t*t*c1[k]+t*t*t*p1[k]));}
  if(options.generationVersion!==2&&!customPoints){
   // A genuine scenic alternative follows the same corridor rather than a
   // straight chord through the middle of every world. Zero endpoint derivative.
   branch.length=0;
   // Parallel offsets have a cusp when offset * curvature approaches one.
   // Bound the entire excursion using sampled horizontal curvature, retaining
   // a smooth sin-squared envelope rather than introducing local kinks.
   let maxCurvature=0;
   for(let j=a+1;j<b;j++) {
    const p=all[j-1],q=all[j],r=all[j+1];
    const ux=q[0]-p[0],uz=q[2]-p[2],vx=r[0]-q[0],vz=r[2]-q[2];
    const lu=Math.hypot(ux,uz),lv=Math.hypot(vx,vz);
    if(lu>1e-6&&lv>1e-6)maxCurvature=Math.max(maxCurvature,Math.hypot(vx/lv-ux/lu,vz/lv-uz/lu)/((lu+lv)*.5));
   }
   const excursion=Math.min(world.theme==='canyon'?200:130,.2/Math.max(1e-9,maxCurvature));
   for(let j=a;j<=b;j++) {const t=(j-a)/(b-a),p=all[j],before=all[Math.max(0,j-1)],after=all[Math.min(all.length-1,j+1)],dx=after[0]-before[0],dz=after[2]-before[2],len=Math.hypot(dx,dz)||1;
    const offset=Math.sin(Math.PI*t)**2*excursion;
    branch.push([p[0]-dz/len*offset,p[1],p[2]+dx/len*offset]);
   }
  }
  this.edges.set('branch',new TrackEdge('branch',branch,Math.min(75,world.limit)));this.totalLength=this.edges.get('approach').length+main.length+this.edges.get('return').length;
  for(const e of this.edges.values())for(let s=0;s<=e.length;s+=15){const p=e.at(Math.min(s,e.length));this._index(p);}this.junction=this.edges.get('approach').at(this.edges.get('approach').length).p;
  const xs=all.map(p=>p[0]),zs=all.map(p=>p[2]);this.bounds={minX:Math.min(...xs)-500,maxX:Math.max(...xs)+500,minZ:Math.min(...zs)-500,maxZ:Math.max(...zs)+500};
  this.generationVersion=options.generationVersion===2?2:3;
 }
 _index(p){const key=`${Math.floor(p.p[0]/this.cell)},${Math.floor(p.p[2]/this.cell)}`;if(!this.spatial.has(key))this.spatial.set(key,[]);this.spatial.get(key).push(p);}
 next(id){return id==='approach'?(this.switchBranch?'branch':'main'):id==='return'?'approach':'return';}
 previous(id){return id==='approach'?'return':id==='return'?'main':'approach';}
 nearest(x,z,maxDistance=Infinity){const cx=Math.floor(x/this.cell),cz=Math.floor(z/this.cell);let best=null,bd=maxDistance*maxDistance;const radius=Number.isFinite(maxDistance)?Math.min(5,Math.ceil(maxDistance/this.cell)+1):3;for(let dx=-radius;dx<=radius;dx++)for(let dz=-radius;dz<=radius;dz++)for(const p of this.spatial.get(`${cx+dx},${cz+dz}`)||[]){const d=(p.p[0]-x)**2+(p.p[2]-z)**2;if(d<bd){bd=d;best=p;}}if(!best&&!Number.isFinite(maxDistance)){for(const e of this.edges.values())for(let s=0;s<e.length;s+=30){const p=e.at(s),d=(p.p[0]-x)**2+(p.p[2]-z)**2;if(d<bd){bd=d;best=p;}}}if(!best)return null;let s=best.s;const e=this.edges.get(best.edge);for(const step of [5,1,.2]){let ds=0;for(let k=-2;k<=2;k++){const q=e.at(s+k*step),d=(q.p[0]-x)**2+(q.p[2]-z)**2;if(d<bd){bd=d;ds=k*step;}}s=clamp(s+ds,0,e.length);}return {...e.at(s),distance:Math.sqrt(bd)};}
 lengthAlong(branch=false){return this.edges.get('approach').length+this.edges.get(branch?'branch':'main').length+this.edges.get('return').length;}
}
/** Traversal history is retained so every bogie follows the actual turnout taken. */
export class RailCursor {
 constructor(network,edge='approach',s=0){this.net=network;this.path=[network.previous(edge),edge];this.index=1;this.s=s;this.odometer=0;}
 advance(ds){if(!Number.isFinite(ds))throw new Error('Nonfinite rail displacement');this.s+=ds;this.odometer+=Math.abs(ds);let guard=0;while(this.s>this.net.edges.get(this.edge).length&&guard++<100){this.s-=this.net.edges.get(this.edge).length;const next=this.net.next(this.edge);this.path.length=this.index+1;this.path.push(next);this.index++;}while(this.s<0&&guard++<100){if(this.index===0){this.path.unshift(this.net.previous(this.edge));this.index++;}this.index--;this.s+=this.net.edges.get(this.edge).length;}if(this.index>30){this.path.splice(0,this.index-10);this.index=10;} }
 get edge(){return this.path[this.index];}
 pose(offset=0){let i=this.index,s=this.s+offset,id=this.edge,guard=0;while(s<0&&guard++<100){id=i>0?this.path[--i]:this.net.previous(id);s+=this.net.edges.get(id).length;}while(s>this.net.edges.get(id).length&&guard++<100){s-=this.net.edges.get(id).length;id=(i>=0&&i+1<this.path.length)?this.path[++i]:this.net.next(id);if(i>=this.path.length-1)i=this.path.length;}return this.net.edges.get(id).at(s);}
 distanceTo(edge,s,max=Infinity){let id=this.edge,dist=-this.s;for(let i=0;i<12&&dist<max;i++){if(id===edge&&s+dist>=-.1)return Math.max(0,s+dist);dist+=this.net.edges.get(id).length;id=this.net.next(id);}return Infinity;}
 snapshot(){return {path:[...this.path],index:this.index,s:this.s,odometer:this.odometer};}
 restore(o){if(!o||!Array.isArray(o.path)||o.path.length>100||!o.path.every(e=>this.net.edges.has(e))||!Number.isInteger(o.index)||o.index<0||o.index>=o.path.length||!Number.isFinite(o.s))throw new Error('Invalid rail cursor');for(let i=1;i<o.path.length;i++){const prev=o.path[i-1],next=o.path[i];if(!(prev==='approach'?['main','branch'].includes(next):prev==='return'?next==='approach':next==='return'))throw new Error('Rail cursor contains disconnected edges.');}this.path=[...o.path];this.index=o.index;this.s=clamp(o.s,0,this.net.edges.get(this.edge).length);this.odometer=Number.isFinite(o.odometer)?clamp(o.odometer,0,1e10):0;}
}
