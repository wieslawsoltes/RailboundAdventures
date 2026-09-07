import {norm,sub,cross,TAU,transform,frameMatrix,add,mul,length} from './math.js';
export class Geometry {
 constructor(vertices,indices){this.vertices=new Float32Array(vertices);this.indices=new Uint32Array(indices);this.gpu=null;this.gl=null;}
}
export class MeshBuilder {
 constructor(){this.v=[];this.i=[];}
 vertex(p,n=[0,1,0],uv=[0,0]){const i=this.v.length/8;this.v.push(...p,...n,...uv);return i;}
 tri(a,b,c,normal=null){const n=normal||norm(cross(sub(b,a),sub(c,a))),i=this.v.length/8;this.vertex(a,n,[0,0]);this.vertex(b,n,[1,0]);this.vertex(c,n,[1,1]);this.i.push(i,i+1,i+2);}
 quad(a,b,c,d,normal=null){const n=normal||norm(cross(sub(b,a),sub(c,a))),i=this.v.length/8;this.vertex(a,n,[0,0]);this.vertex(b,n,[1,0]);this.vertex(c,n,[1,1]);this.vertex(d,n,[0,1]);this.i.push(i,i+1,i+2,i,i+2,i+3);}
 geometry(){return new Geometry(this.v,this.i);}
}
export function boxGeometry(){const b=new MeshBuilder();b.quad([-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]);b.quad([.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]);b.quad([.5,-.5,.5],[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5]);b.quad([-.5,-.5,-.5],[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5]);b.quad([-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5],[-.5,.5,-.5]);b.quad([-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5]);return b.geometry();}
export function cylinderGeometry(segments=16,topRadius=1){const b=new MeshBuilder();for(let i=0;i<segments;i++){const a=i/segments*TAU,c=(i+1)/segments*TAU,p=[Math.cos(a)*.5,-.5,Math.sin(a)*.5],q=[Math.cos(c)*.5,-.5,Math.sin(c)*.5],r=[Math.cos(c)*.5*topRadius,.5,Math.sin(c)*.5*topRadius],s=[Math.cos(a)*.5*topRadius,.5,Math.sin(a)*.5*topRadius];b.quad(q,p,s,r);b.tri([0,-.5,0],p,q,[0,-1,0]);if(topRadius>0)b.tri([0,.5,0],r,s,[0,1,0]);}return b.geometry();}
export function sphereGeometry(segments=16,rings=10){const b=new MeshBuilder();for(let j=0;j<=rings;j++){const p=j/rings*Math.PI;for(let i=0;i<=segments;i++){const t=i/segments*TAU,n=[Math.sin(p)*Math.cos(t),Math.cos(p),Math.sin(p)*Math.sin(t)];b.vertex(mul(n,.5),n,[i/segments,j/rings]);}}for(let j=0;j<rings;j++)for(let i=0;i<segments;i++){const a=j*(segments+1)+i,c=a+segments+1;b.i.push(a,a+1,c,c,a+1,c+1);}return b.geometry();}
export function pineFarGeometry(){const b=new MeshBuilder();for(let layer=0;layer<5;layer++){const y=layer*.17,r=.48*(1-layer*.16);const seg=11;for(let i=0;i<seg;i++){const a=i/seg*TAU,c=(i+1)/seg*TAU;const p=[Math.cos(a)*r,y+Math.sin(i*7)*.025,Math.sin(a)*r],q=[Math.cos(c)*r,y+Math.sin((i+1)*7)*.025,Math.sin(c)*r],top=[Math.cos(a+c)*.018,y+.35,Math.sin(a+c)*.018];b.tri(q,p,top);b.tri([0,y+.015,0],p,q,[0,-1,0]);}}return b.geometry();}
/** Irregular branch whorls form real 3D silhouettes, rather than stacked cones. */
export function pineGeometry(){
 const b=new MeshBuilder();
 for(let layer=0;layer<14;layer++){
  const y=layer/14,rad=.46*Math.pow(1-y,.83),count=layer>10?5:8;
  for(let j=0;j<count;j++){
   const a=j/count*TAU+layer*2.399,random=.74+.28*Math.sin(j*23.1+layer*37.7),r=rad*random;
   const f=[Math.cos(a),0,Math.sin(a)],side=[-f[2],0,f[0]],root=[f[0]*r*.13,y+.026,f[2]*r*.13],tip=[f[0]*r,y-.034,f[2]*r];
   for(let k=0;k<3;k++){
    const t=.27+k*.24,width=rad*(.24-k*.047),p=[f[0]*r*t,y+.03-t*.07,f[2]*r*t];
    const l=add(p,mul(side,width)),rr=add(p,mul(side,-width)),up=[p[0],p[1]+rad*.075,p[2]];
    const end=[f[0]*r*Math.min(1,t+.35),tip[1]-.025*Math.sin(k*19+j),f[2]*r*Math.min(1,t+.35)];
    b.tri(l,up,end);b.tri(up,rr,end);
   }
  }
 }
 return b.geometry();
}
export function foliageGeometry(){const base=sphereGeometry(14,9),v=base.vertices;for(let i=0;i<v.length;i+=8){const n=[v[i],v[i+1],v[i+2]],r=.83+.11*Math.sin(n[0]*34+n[1]*21)+.12*Math.sin(n[2]*27+n[1]*35);v[i]*=r;v[i+1]*=r;v[i+2]*=r;}return base;}
export function bodyGeometry(){const b=new MeshBuilder(),ring=[[-.42,-.5],[.42,-.5],[.5,-.36],[.5,.31],[.4,.5],[-.4,.5],[-.5,.31],[-.5,-.36]];for(let i=0;i<ring.length;i++){const a=ring[i],c=ring[(i+1)%ring.length];b.quad([a[0],a[1],-.5],[c[0],c[1],-.5],[c[0],c[1],.5],[a[0],a[1],.5]);b.tri([0,0,.5],[a[0],a[1],.5],[c[0],c[1],.5],[0,0,1]);b.tri([0,0,-.5],[c[0],c[1],-.5],[a[0],a[1],-.5],[0,0,-1]);}return b.geometry();}
export function noseGeometry(){const b=new MeshBuilder();const rings=[[-.5,.48,.5,0],[.05,.45,.43,-.04],[.5,.24,.15,-.23],[.62,.09,.09,-.24]];const sides=12;for(let j=0;j<rings.length-1;j++){const [z,r,h,y]=rings[j],[z1,r1,h1,y1]=rings[j+1];for(let i=0;i<sides;i++){const t=i/sides*TAU,u=(i+1)/sides*TAU;b.quad([Math.cos(t)*r,Math.sin(t)*h+y,z],[Math.cos(u)*r,Math.sin(u)*h+y,z],[Math.cos(u)*r1,Math.sin(u)*h1+y1,z1],[Math.cos(t)*r1,Math.sin(t)*h1+y1,z1]);}}return b.geometry();}
export const PRIMITIVES={box:boxGeometry(),cylinder:cylinderGeometry(18),cone:cylinderGeometry(12,0),sphere:sphereGeometry(),pine:pineGeometry(),pineFar:pineFarGeometry(),foliage:foliageGeometry(),foliageFar:sphereGeometry(7,5),body:bodyGeometry(),nose:noseGeometry()};
/** One instance = model matrix (64 B), linear material tint (16 B), material parameters (16 B). */
export class Batch {
 constructor(geometry,{center=[0,0,0],radius=1e6,maxDistance=12000,castShadow=true,dynamic=false}={}){this.geometry=geometry;this.center=center;this.radius=radius;this.maxDistance=maxDistance;this.castShadow=castShadow;this.dynamic=dynamic;this.items=[];this.data=null;this.count=0;this.dirty=true;this.gpuBuffer=null;this.glBuffer=null;this.capacity=0;}
 add(matrix,color=[1,1,1,1],props=[0,.65,0,0]){this.items.push(...matrix,...color,...props);this.count++;return this;}
 finish(){this.data=new Float32Array(this.items);this.items=[];this.dirty=true;return this;}
 reset(){this.items.length=0;this.count=0;}
 flush(){const n=this.items.length;if(!this.data||this.data.length<n)this.data=new Float32Array(Math.max(n,(this.data?.length||256)*2));this.data.set(this.items);this.dirty=true;}
 dispose(renderer){renderer?.disposeBatch(this);}
}
export class SceneBuilder {
 constructor(){this.batches=[];this.cells=new Map();this.geometry=PRIMITIVES;}
 instance(name,p,scale,color,props=[0,.7,0,0],yaw=0,pitch=0,roll=0){const cx=Math.floor(p[0]/480),cz=Math.floor(p[2]/480),key=`${name}:${cx}:${cz}`;let batch=this.cells.get(key);if(!batch){batch=new Batch(this.geometry[name],{center:[cx*480+240,p[1],cz*480+240],radius:520,maxDistance:name==='pine'||name==='foliage'?3400:4200});this.cells.set(key,batch);this.batches.push(batch);}batch.radius=Math.max(batch.radius,Math.hypot(p[0]-batch.center[0],p[1]-batch.center[1],p[2]-batch.center[2])+Math.hypot(...scale)*.6);batch.add(transform(p,scale,yaw,pitch,roll),color,props);return batch;}
 oriented(name,matrix,color,props=[0,.7,0,0]){const p=[matrix[12],matrix[13],matrix[14]],cx=Math.floor(p[0]/480),cz=Math.floor(p[2]/480),key=`${name}:${cx}:${cz}`;let batch=this.cells.get(key);if(!batch){batch=new Batch(this.geometry[name],{center:[cx*480+240,p[1],cz*480+240],radius:520,maxDistance:3600});this.cells.set(key,batch);this.batches.push(batch);}batch.radius=Math.max(batch.radius,Math.hypot(p[0]-batch.center[0],p[1]-batch.center[1],p[2]-batch.center[2])+Math.hypot(matrix[0],matrix[1],matrix[2],matrix[4],matrix[5],matrix[6],matrix[8],matrix[9],matrix[10])*.6);batch.add(matrix,color,props);return batch;}
 segment(a,b,width,color,props=[0,.65,0,0],depth=width){const mid=mul(add(a,b),.5),m=frameMatrix(mid,sub(b,a),[width,depth,length(sub(b,a))]);return this.oriented('box',m,color,props);}
 mesh(geometry,center=[0,0,0],radius=1000,props=[0,.8,0,0],color=[1,1,1,1]){const batch=new Batch(geometry,{center,radius});batch.add(transform([0,0,0]),color,props).finish();this.batches.push(batch);return batch;}
 finish(){const lod=[];for(const b of this.cells.values()){b.finish();if(b.geometry===this.geometry.pine||b.geometry===this.geometry.foliage){const isPine=b.geometry===this.geometry.pine;b.lodNear=isPine?600:700;const far=new Batch(isPine?this.geometry.pineFar:this.geometry.foliageFar,{center:b.center,radius:b.radius,maxDistance:b.maxDistance});far.data=b.data;far.count=b.count;far.lodFar=b.lodNear;lod.push(far);}}this.batches.push(...lod);this.cells.clear();return this.batches;}
}
