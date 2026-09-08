/** Authored parametric station kit. All dimensions are metres. Platforms and
 * stopping points remain semantic railway data; the kit never changes track.
 */
import {MeshBuilder,PRIMITIVES} from './geometry.js';
import {transform,mat4Mul,pointTransform,hex,frameMatrix,add,mul,norm,sub,TAU} from './math.js';
const METAL=[0,.4,.65,0],STONE=[6,.92,0,0],GLASS=[3,.16,.15,0];
const C={steel:hex('#344a4d'),stone:hex('#b6b0a0'),trim:hex('#dad5c5'),glass:hex('#607f82'),wood:hex('#685647'),roof:hex('#53636a'),lamp:hex('#ffe2a8')};
export function canopyStrip(width=5.7,height=1.35,length=10,segments=20){
 const key=`station-vault-${width}-${height}-${length}-${segments}`;if(PRIMITIVES[key])return key;
 const b=new MeshBuilder();
 for(let i=0;i<segments;i++){
  const a=i/segments*Math.PI,c=(i+1)/segments*Math.PI;
  const p=t=>[Math.cos(t)*width*.5,Math.sin(t)*height];const pa=p(a),pb=p(c);
  const n=norm([Math.cos((a+c)*.5)/width,Math.sin((a+c)*.5)/height,0]);
  b.quad([pa[0],pa[1],-length*.5],[pa[0],pa[1],length*.5],[pb[0],pb[1],length*.5],[pb[0],pb[1],-length*.5],n);
 }PRIMITIVES[key]=b.geometry();return key;
}
export function buildStationCanopy(world,station){
 const b=world.builder,e=world.network.edges.get(station.edge),modern=['metro','coast','sakura'].includes(world.def.theme);
 const length=Math.min(120,station.platform-22),start=-Math.min(station.platform-12,142);
 const roof=canopyStrip(5.7,modern?1.28:.78,10.05,16);
 for(let ds=start;ds<start+length;ds+=10){
  const p=e.at(station.s+ds),origin=world.railCross(p,4.9,4.96),matrix=frameMatrix(origin,p.f);
  const at=(x,y,z=0)=>pointTransform(matrix,[x,y,z]);
  b.oriented(roof,matrix,modern?C.glass:C.roof,modern?GLASS:METAL);
  // Two explicit truss chords and their triangular web are visible from the cab.
  for(const end of [-5,5]){
   let previous=null,previousLower=null;
   for(let i=0;i<=16;i++){
    const angle=i/16*Math.PI,x=Math.cos(angle)*2.85,y=Math.sin(angle)*(modern?1.28:.78);
    const upper=at(x,y,end),lower=at(x,y-.19,end);
    if(previous){b.segment(previous,upper,.066,C.steel,METAL);b.segment(previousLower,lower,.065,C.steel,METAL);b.segment(previousLower,upper,.035,C.steel,METAL);}
    previous=upper;previousLower=lower;
   }
  }
  const pillar=world.railCross(p,6.75,2.96);
  b.oriented('cylinder',frameMatrix(pillar,p.f,[.16,4.12,.16]),C.steel,METAL);
  b.oriented('box',frameMatrix(world.railCross(p,6.75,1.01),p.f,[.34,.20,.34]),C.trim,STONE);
  b.segment(world.railCross(p,6.75,3.8),world.railCross(p,4.55,5.02),.105,C.steel,METAL);
  b.segment(world.railCross(p,6.75,4.1),world.railCross(p,7.42,4.96),.09,C.steel,METAL);
  b.oriented('box',frameMatrix(world.railCross(p,4.4,4.70),p.f,[.17,.07,3.0]),C.lamp,[4,.45,0,1.2]);
  // Longitudinal purlins follow each short track-aligned bay, not a chord through the curve.
  for(const x of [-2.75,-1.25,0,1.25,2.75]){
   const y=Math.sqrt(Math.max(0,1-(x/2.85)**2))*(modern?1.28:.78);
   b.segment(at(x,y,-5),at(x,y,5),.055,C.steel,METAL);
  }
 }
 world.features.stationCanopies=(world.features.stationCanopies||0)+1;
}
export function buildStationArchitecture(world,station){
 const e=world.network.edges.get(station.edge),pose=e.at(station.s-92),modern=['metro','sakura','coast'].includes(world.def.theme);
 const p=world.railCross(pose,17,0),yaw=Math.atan2(pose.f[0],pose.f[2]);
 const h=world.surfaceHeight?.(p[0],p[2])??world.height(p[0],p[2]);p[1]=Math.max(p[1]-.45,h);
 const base=transform(p,[1,1,1],yaw),b=world.builder;
 const part=(g,pos,size,color,props=METAL,roll=0)=>b.oriented(g,mat4Mul(base,transform(pos,size,0,0,roll)),color,props);
 const box=(pos,size,color,props=STONE,roll=0)=>part('box',pos,size,color,props,roll);
 const point=v=>pointTransform(base,v);
 // Separate solid wings around a full-height glazed concourse, with a real roof silhouette.
 for(const side of [-1,1]){
  box([0,3.05,side*11.7],[11.4,6.1,11.4],C.stone);
  box([0,.35,side*11.7],[11.65,.7,11.65],C.trim);
  box([0,5.92,side*11.7],[11.65,.2,11.75],C.trim);
  if(modern){box([0,6.32,side*11.7],[11.9,.5,11.85],C.roof,METAL);box([1.2,6.8,side*11.7],[2.7,.65,2.1],C.steel);}
  else{
   for(const x of [-1,1])box([x*3.03,7.10,side*11.7],[6.65,.20,12.5],C.roof,[14,.83,0,0],-x*.40);
   box([3.7,8.1,side*11.7+2.6],[.72,2.6,.76],C.stone);box([3.7,9.39,side*11.7+2.6],[.95,.12,.99],C.trim);
  }
  for(let z=side*11.7-4.2;z<=side*11.7+4.3;z+=2.8)for(const x of [-1,1]){
   box([x*5.73,3.2,z],[.06,2.55,1.65],C.glass,GLASS);
   for(const j of [-1,1])box([x*5.79,3.2+j*1.35,z],[.18,.13,1.92],C.trim);
   for(const j of [-1,0,1])box([x*5.81,3.2,z+j*.86],[.12,2.7,.072],C.trim);
   box([x*5.86,1.80,z],[.34,.16,2.04],C.trim);
  }
 }
 // Central atrium. Glass and structural ribs are independently modeled.
 const vault=canopyStrip(12.1,2.5,12.9,24),atrium=mat4Mul(base,transform([0,6.25,0]));
 b.oriented(vault,atrium,C.glass,GLASS);
 for(const z of [-6.45,-3.22,0,3.22,6.45]){
  let prev=null;for(let i=0;i<=24;i++){
   const a=i/24*Math.PI,q=point([Math.cos(a)*6.05,6.25+Math.sin(a)*2.5,z]);
   if(prev)b.segment(prev,q,.085,C.steel,METAL);prev=q;
  }
 }
 for(const x of [-1,1]){
  box([x*6.02,3.50,0],[.065,5.6,12.7],C.glass,GLASS);
  for(let z=-6.4;z<6.5;z+=1.6)box([x*6.07,3.50,z],[.14,5.8,.11],C.steel,METAL);
  for(const y of [.78,3.40,6.25])box([x*6.08,y,0],[.14,.1,12.9],C.steel,METAL);
  box([x*6.11,2.1,0],[.11,2.7,2.2],C.glass,GLASS);
  for(const z of [-.52,.52])box([x*6.2,2.04,z],[.1,.64,.038],C.trim,METAL);
 }
 box([0,.32,0],[12.4,.64,12.95],C.trim);box([-6.48,.68,0],[.8,.14,3.1],C.trim);
 // Station clock, suspended under the outer canopy. Face geometry stays legible up close.
 part('cylinder',[-6.28,5.1,3.5],[1.06,.09,1.06],C.trim,STONE,Math.PI/2);
 box([-6.35,5.21,3.5],[.045,.28,.032],C.steel,METAL);box([-6.36,5.10,3.63],[.04,.035,.30],C.steel,METAL);
 for(const z of [-3.2,3.2]){
  box([-6.6,1.25,z],[.25,.72,.35],C.steel,METAL);box([-6.6,1.68,z],[.29,.12,.39],C.lamp,[4,.4,0,.6]);
 }
 world.features.buildings++;world.features.authoredStations=(world.features.authoredStations||0)+1;
}
