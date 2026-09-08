/** Near-field architecture and public-space dressing; no per-window draw calls.
 * Detail batches are bounded per building and use shared primitive geometry.
 * Paved aprons conform to the rendered terrain and remain inside their parcels.
 */
import {Batch,MeshBuilder,PRIMITIVES} from './geometry.js';
import {hex,transform,mat4Mul,add} from './math.js';
const STONE=hex('#c4bfb0'),FRAME=hex('#4d5857'),METAL=hex('#354241'),TIMBER=hex('#7d6950');
const terrain=(w,x,z)=>w.surfaceHeight?.(x,z)??w.height(x,z);
export const ARCHITECTURE_DETAIL_RANGE=360;
export function facadeWindows(width,height,modern=false){
 if(![width,height].every(Number.isFinite)||width<=0||height<=0)return [];
 const margin=modern?.065:.19,windows=[];
 // The shader uses metre-scaled UV coordinates from the lower-left corner.
 for(let y=0;y+3.2<=Math.min(height+.01,32);y+=3.2)for(let x=0;x+3<=width+.001;x+=3)
  windows.push({x:-width/2+x+1.5,y:y+(3.2*(.21+.84))/2,width:3*(1-2*margin),height:3.2*(.84-.21)});
 return windows;
}
export function pavedApron(world,d,building){
 const {position:p,width,depth}=building,c=Math.cos(d.yaw),s=Math.sin(d.yaw),mesh=new MeshBuilder();
 const point=(x,z)=>{const wx=p[0]+c*x+s*z,wz=p[2]-s*x+c*z;return [wx,terrain(world,wx,wz)+.045,wz];};
 const strips=[[-width/2-.45,-depth/2-.45,width/2+.45,-depth/2],[-width/2-.45,depth/2,width/2+.45,depth/2+1.2],[-width/2-.45,-depth/2,-width/2,depth/2],[width/2,-depth/2,width/2+.45,depth/2]];
 let cells=0;
 for(const [left,near,right,far] of strips)for(let z=near;z<far-.001;z+=2)for(let x=left;x<right-.001;x+=2){
  const q=[point(x,z),point(Math.min(right,x+2),z),point(Math.min(right,x+2),Math.min(far,z+2)),point(x,Math.min(far,z+2))];
  if(q.some(v=>!v.every(Number.isFinite)||v[1]<world.def.water+1||world.network.nearest(v[0],v[2],9)))continue;
  if(Math.max(...q.map(v=>v[1]))-Math.min(...q.map(v=>v[1]))>.5)continue;
  mesh.quad(q[0],q[3],q[2],q[1]);cells++;
 }
 if(!cells)return null;
 const batch=world.builder.mesh(mesh.geometry(),p,Math.hypot(width,depth),[16,.90,0,0],STONE);batch.maxDistance=1300;batch.castShadow=false;
 return {batch,cells};
}
export function addArchitecturalDetail(world,d,building,seed){
 const {position:p,width,depth,height,style}=building,modern=style==='glass';
 const matrix=transform(p,[1,1,1],d.yaw),batch=new Batch(PRIMITIVES.box,{center:add(p,[0,Math.min(height,32)*.5,0]),radius:Math.hypot(width,depth,Math.min(height,32))*.65,maxDistance:ARCHITECTURE_DETAIL_RANGE});
 batch.lodNear=ARCHITECTURE_DETAIL_RANGE;batch.detailClass='architecture';
 const part=(pos,size,color=STONE,props=[6,.86,0,0])=>batch.add(mat4Mul(matrix,transform(pos,size)),color,props);
 let windows=0;
 for(const face of [0,1,2,3]){
  const faceWidth=face<2?width:depth,orientation=face%2===0?1:-1;
  for(const w of facadeWindows(faceWidth,modern?Math.min(height,9.6):height,modern)){
   // Four frames sit outside the facade, leaving its parallax window visible.
   const map=(u,y,out)=>face<2?[orientation*u,y,orientation*(depth/2+out)]:[orientation*(width/2+out),y,-orientation*u];
   const scale=(u,y,out)=>face<2?[u,y,out]:[out,y,u];
   const dark=modern?FRAME:STONE;
   for(const side of [-1,1])part(map(w.x+side*(w.width/2+.04),w.y,.055),scale(.08,w.height+.18,.11),dark,modern?[0,.38,.48,0]:[6,.84,0,0]);
   part(map(w.x,w.y-w.height/2-.03,.09),scale(w.width+.30,.11,.27),dark);
   part(map(w.x,w.y+w.height/2+.06,.045),scale(w.width+.20,.10,.11),dark);
   windows++;
  }
 }
 // Small-scale cues at the entrance: door frame, pull handle, lamp and notice.
 for(const side of [-1,1])part([side*.91,1.25,depth*.5+.12],[.11,2.5,.19],FRAME,[0,.5,.3,0]);
 part([0,2.52,depth*.5+.12],[1.93,.1,.19],FRAME,[0,.5,.3,0]);part([.45,1.15,depth*.5+.18],[.045,.40,.06],STONE,[0,.22,.85,0]);
 part([1.6,1.7,depth*.5+.14],[.36,.48,.05],hex('#c1b59b'),[0,.8,0,0]);
 part([-1.9,2.35,depth*.5+.18],[.34,.33,.26],METAL,[0,.4,.5,0]);
 part([-1.9,2.34,depth*.5+.325],[.21,.21,.03],hex('#eee1b7'),[4,.4,0,.36]);
 // One framed shop awning, with a striped valance, in suitable local centres.
 if(!modern&&building.floors>=2&&seed>.4){
  const awning=hex(seed>.72?'#53634c':'#846051'),span=Math.min(width*.5,6.5);
  part([width*.23,2.48,depth*.5+.73],[span,.12,1.35],awning,[0,.94,0,0]);
  for(let x=-span/2;x<span/2;x+=.38)part([width*.23+x+.095,2.33,depth*.5+1.40],[.18,.26,.035],STONE,[0,.98,0,0]);
  world.features.shopAwnings=(world.features.shopAwnings||0)+1;
 }
 batch.finish();world.builder.batches.push(batch);
 const apron=pavedApron(world,d,building);
 world.features.windowFrames=(world.features.windowFrames||0)+windows;
 world.features.pavedAprons=(world.features.pavedAprons||0)+(apron?1:0);
 return {batch,windows,apron};
}
function point(d,x,z){return [d.origin[0]+d.right[0]*x+d.forward[0]*z,0,d.origin[2]+d.right[2]*x+d.forward[2]*z];}
export function buildPublicRealm(world){
 let count=0;
 for(const d of world.districts||[])for(let i=0;i<d.roads.length;i++){
  const road=d.roads[i];if(!road.built||i%3!==1)continue;
  const x=(road.a[0]+road.b[0])*.5,z=(road.a[1]+road.b[1])*.5,along=road.axis==='z',yaw=d.yaw+(along?0:Math.PI*.5);
  const p=point(d,x+(along?5.65:0),z+(along?0:5.65));p[1]=terrain(world,p[0],p[2])+.30;
  if(p[1]<world.def.water+1.3||world.network.nearest(p[0],p[2],10))continue;
  const base=transform(p,[1,1,1],yaw),b=new Batch(PRIMITIVES.box,{center:add(p,[0,1,0]),radius:5,maxDistance:330});b.lodNear=400;b.detailClass='street';
  const part=(v,s,col,props=[0,.78,0,0])=>b.add(mat4Mul(base,transform(v,s)),col,props);
  if(i%2){
   // Slatted bench and backrest, two steel legs.
   for(let k=0;k<5;k++)part([(k-2)*.115,.47,0],[.095,.065,1.75],TIMBER);
   for(let k=0;k<3;k++)part([.30,.70+k*.10,0],[.065,.075,1.75],TIMBER);
   for(const side of [-1,1]){part([0,.22,side*.65],[.43,.43,.06],METAL,[0,.60,.3,0]);part([.29,.64,side*.65],[.06,.74,.06],METAL,[0,.60,.3,0]);}
  }else{
   // Street bin with metal rim and an inset dark opening.
   part([0,.43,0],[.50,.86,.55],METAL,[0,.6,.3,0]);part([0,.89,0],[.57,.07,.62],STONE,[0,.4,.5,0]);part([-.257,.69,0],[.03,.17,.35],hex('#121b1b'));
  }
  // A curb drain uses actual slots; detail is culled outside its range.
  const drain=[-1.42,-.10,2];part(drain,[.54,.035,.85],METAL,[0,.55,.55,0]);
  for(let k=0;k<5;k++)part([drain[0],-.075,drain[2]+(k-2)*.135],[.44,.014,.06],hex('#151d1b'));
  b.finish();world.builder.batches.push(b);count++;
 }
 world.features.streetFurniture=count;return count;
}
