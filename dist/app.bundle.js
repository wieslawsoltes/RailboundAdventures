'use strict';
// ---- src/math.js ----
const __m_src_math_js = (() => {

/** Column-major right-handed math; world +Y is up; train local +Z is forward. */
const TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); };
const mod = (a,n) => ((a%n)+n)%n;
const v3 = (x=0,y=0,z=0) => [x,y,z];
const add = (a,b) => [a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const sub = (a,b) => [a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const mul = (a,n) => [a[0]*n,a[1]*n,a[2]*n];
const dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const length = a => Math.hypot(...a);
const norm = a => {const l=length(a)||1;return mul(a,1/l);};
const mix3 = (a,b,t) => [lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)];
function rng(seed=1) { let a=seed>>>0; return () => {a+=0x6D2B79F5;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;}; }
function hash2(x,z,seed=0){let h=Math.imul(x|0,374761393)^Math.imul(z|0,668265263)^Math.imul(seed|0,1274126177);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;}
function noise2(x,z,seed=0){const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz,u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);return lerp(lerp(hash2(ix,iz,seed),hash2(ix+1,iz,seed),u),lerp(hash2(ix,iz+1,seed),hash2(ix+1,iz+1,seed),u),v);}
function fbm(x,z,seed=0,octaves=5){let v=0,a=.5;for(let i=0;i<octaves;i++){v+=noise2(x,z,seed+i*31)*a;x=x*2.03+15.7;z=z*2.03-6.3;a*=.5;}return v;}
function mat4Identity(){return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);}
function mat4Mul(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o;}
function perspective(fov,aspect,near,far,webgpu=true){const f=1/Math.tan(fov/2),m=new Float32Array(16);m[0]=f/aspect;m[5]=f;m[11]=-1;if(webgpu){m[10]=far/(near-far);m[14]=far*near/(near-far);}else{m[10]=(far+near)/(near-far);m[14]=2*far*near/(near-far);}return m;}
function orthographic(l,r,b,t,n,f,webgpu=true){const m=mat4Identity();m[0]=2/(r-l);m[5]=2/(t-b);m[12]=-(r+l)/(r-l);m[13]=-(t+b)/(t-b);m[10]=(webgpu?1:2)/(n-f);m[14]=webgpu?n/(n-f):(f+n)/(n-f);return m;}
function lookAt(eye,target,up=[0,1,0]){const z=norm(sub(eye,target)),x=norm(cross(up,z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);}
function mat4Inverse(a){const out=new Float32Array(16);const aug=Array.from({length:4},(_,r)=>[a[r],a[4+r],a[8+r],a[12+r],...Array.from({length:4},(_,c)=>+(c===r))]);for(let i=0;i<4;i++){let p=i;for(let r=i+1;r<4;r++)if(Math.abs(aug[r][i])>Math.abs(aug[p][i]))p=r;if(Math.abs(aug[p][i])<1e-12)return mat4Identity();[aug[i],aug[p]]=[aug[p],aug[i]];const d=aug[i][i];for(let c=0;c<8;c++)aug[i][c]/=d;for(let r=0;r<4;r++)if(r!==i){const s=aug[r][i];for(let c=0;c<8;c++)aug[r][c]-=aug[i][c]*s;}}for(let r=0;r<4;r++)for(let c=0;c<4;c++)out[c*4+r]=aug[r][c+4];return out;}
function transform(p,scale=[1,1,1],yaw=0,pitch=0,roll=0){const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch),cr=Math.cos(roll),sr=Math.sin(roll);const m=mat4Identity();m[0]=(cy*cr+sy*sp*sr)*scale[0];m[1]=cp*sr*scale[0];m[2]=(-sy*cr+cy*sp*sr)*scale[0];m[4]=(-cy*sr+sy*sp*cr)*scale[1];m[5]=cp*cr*scale[1];m[6]=(sy*sr+cy*sp*cr)*scale[1];m[8]=sy*cp*scale[2];m[9]=-sp*scale[2];m[10]=cy*cp*scale[2];m[12]=p[0];m[13]=p[1];m[14]=p[2];return m;}
function frameMatrix(p,tangent,scale=[1,1,1]){const f=norm(tangent),right=norm(cross([0,1,0],f)),up=cross(f,right);return new Float32Array([right[0]*scale[0],right[1]*scale[0],right[2]*scale[0],0,up[0]*scale[1],up[1]*scale[1],up[2]*scale[1],0,f[0]*scale[2],f[1]*scale[2],f[2]*scale[2],0,...p,1]);}
function pointTransform(m,p){return [m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];}
function hex(s){const n=parseInt(s.replace('#',''),16);return [((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255,1];}
function catmull(p0,p1,p2,p3,t){const t2=t*t,t3=t2*t;return [0,1,2].map(i=>.5*((2*p1[i])+(-p0[i]+p2[i])*t+(2*p0[i]-5*p1[i]+4*p2[i]-p3[i])*t2+(-p0[i]+3*p1[i]-3*p2[i]+p3[i])*t3));}
function downloadFile(name,data,type='application/json'){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}

return {TAU,clamp,lerp,smooth,mod,v3,add,sub,mul,dot,cross,length,norm,mix3,rng,hash2,noise2,fbm,mat4Identity,mat4Mul,perspective,orthographic,lookAt,mat4Inverse,transform,frameMatrix,pointTransform,hex,catmull,downloadFile};
})();
// ---- src/geometry.js ----
const __m_src_geometry_js = (() => {
const {norm,sub,cross,TAU,transform,frameMatrix,add,mul,length} = __m_src_math_js;

class Geometry {
 constructor(vertices,indices){this.vertices=new Float32Array(vertices);this.indices=new Uint32Array(indices);this.gpu=null;this.gl=null;}
}
class MeshBuilder {
 constructor(){this.v=[];this.i=[];}
 vertex(p,n=[0,1,0],uv=[0,0]){const i=this.v.length/8;this.v.push(...p,...n,...uv);return i;}
 tri(a,b,c,normal=null){const n=normal||norm(cross(sub(b,a),sub(c,a))),i=this.v.length/8;this.vertex(a,n,[0,0]);this.vertex(b,n,[1,0]);this.vertex(c,n,[1,1]);this.i.push(i,i+1,i+2);}
 quad(a,b,c,d,normal=null){const n=normal||norm(cross(sub(b,a),sub(c,a))),i=this.v.length/8;this.vertex(a,n,[0,0]);this.vertex(b,n,[1,0]);this.vertex(c,n,[1,1]);this.vertex(d,n,[0,1]);this.i.push(i,i+1,i+2,i,i+2,i+3);}
 geometry(){return new Geometry(this.v,this.i);}
}
function boxGeometry(){const b=new MeshBuilder();b.quad([-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]);b.quad([.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]);b.quad([.5,-.5,.5],[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5]);b.quad([-.5,-.5,-.5],[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5]);b.quad([-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5],[-.5,.5,-.5]);b.quad([-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5]);return b.geometry();}
function cylinderGeometry(segments=16,topRadius=1){const b=new MeshBuilder();for(let i=0;i<segments;i++){const a=i/segments*TAU,c=(i+1)/segments*TAU,p=[Math.cos(a)*.5,-.5,Math.sin(a)*.5],q=[Math.cos(c)*.5,-.5,Math.sin(c)*.5],r=[Math.cos(c)*.5*topRadius,.5,Math.sin(c)*.5*topRadius],s=[Math.cos(a)*.5*topRadius,.5,Math.sin(a)*.5*topRadius];b.quad(q,p,s,r);b.tri([0,-.5,0],p,q,[0,-1,0]);if(topRadius>0)b.tri([0,.5,0],r,s,[0,1,0]);}return b.geometry();}
function sphereGeometry(segments=16,rings=10){const b=new MeshBuilder();for(let j=0;j<=rings;j++){const p=j/rings*Math.PI;for(let i=0;i<=segments;i++){const t=i/segments*TAU,n=[Math.sin(p)*Math.cos(t),Math.cos(p),Math.sin(p)*Math.sin(t)];b.vertex(mul(n,.5),n,[i/segments,j/rings]);}}for(let j=0;j<rings;j++)for(let i=0;i<segments;i++){const a=j*(segments+1)+i,c=a+segments+1;b.i.push(a,a+1,c,c,a+1,c+1);}return b.geometry();}
function pineFarGeometry(){const b=new MeshBuilder();for(let layer=0;layer<5;layer++){const y=layer*.17,r=.48*(1-layer*.16);const seg=11;for(let i=0;i<seg;i++){const a=i/seg*TAU,c=(i+1)/seg*TAU;const p=[Math.cos(a)*r,y+Math.sin(i*7)*.025,Math.sin(a)*r],q=[Math.cos(c)*r,y+Math.sin((i+1)*7)*.025,Math.sin(c)*r],top=[Math.cos(a+c)*.018,y+.35,Math.sin(a+c)*.018];b.tri(q,p,top);b.tri([0,y+.015,0],p,q,[0,-1,0]);}}return b.geometry();}
/** Irregular branch whorls form real 3D silhouettes, rather than stacked cones. */
function pineGeometry(){
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
function foliageGeometry(){const base=sphereGeometry(14,9),v=base.vertices;for(let i=0;i<v.length;i+=8){const n=[v[i],v[i+1],v[i+2]],r=.83+.11*Math.sin(n[0]*34+n[1]*21)+.12*Math.sin(n[2]*27+n[1]*35);v[i]*=r;v[i+1]*=r;v[i+2]*=r;}return base;}
function bodyGeometry(){const b=new MeshBuilder(),ring=[[-.42,-.5],[.42,-.5],[.5,-.36],[.5,.31],[.4,.5],[-.4,.5],[-.5,.31],[-.5,-.36]];for(let i=0;i<ring.length;i++){const a=ring[i],c=ring[(i+1)%ring.length];b.quad([a[0],a[1],-.5],[c[0],c[1],-.5],[c[0],c[1],.5],[a[0],a[1],.5]);b.tri([0,0,.5],[a[0],a[1],.5],[c[0],c[1],.5],[0,0,1]);b.tri([0,0,-.5],[c[0],c[1],-.5],[a[0],a[1],-.5],[0,0,-1]);}return b.geometry();}
function noseGeometry(){const b=new MeshBuilder();const rings=[[-.5,.48,.5,0],[.05,.45,.43,-.04],[.5,.24,.15,-.23],[.62,.09,.09,-.24]];const sides=12;for(let j=0;j<rings.length-1;j++){const [z,r,h,y]=rings[j],[z1,r1,h1,y1]=rings[j+1];for(let i=0;i<sides;i++){const t=i/sides*TAU,u=(i+1)/sides*TAU;b.quad([Math.cos(t)*r,Math.sin(t)*h+y,z],[Math.cos(u)*r,Math.sin(u)*h+y,z],[Math.cos(u)*r1,Math.sin(u)*h1+y1,z1],[Math.cos(t)*r1,Math.sin(t)*h1+y1,z1]);}}return b.geometry();}
const PRIMITIVES={box:boxGeometry(),cylinder:cylinderGeometry(18),cone:cylinderGeometry(12,0),sphere:sphereGeometry(),pine:pineGeometry(),pineFar:pineFarGeometry(),foliage:foliageGeometry(),foliageFar:sphereGeometry(7,5),body:bodyGeometry(),nose:noseGeometry()};
/** One instance = model matrix (64 B), linear material tint (16 B), material parameters (16 B). */
class Batch {
 constructor(geometry,{center=[0,0,0],radius=1e6,maxDistance=12000,castShadow=true,dynamic=false}={}){this.geometry=geometry;this.center=center;this.radius=radius;this.maxDistance=maxDistance;this.castShadow=castShadow;this.dynamic=dynamic;this.items=[];this.data=null;this.count=0;this.dirty=true;this.gpuBuffer=null;this.glBuffer=null;this.capacity=0;}
 add(matrix,color=[1,1,1,1],props=[0,.65,0,0]){this.items.push(...matrix,...color,...props);this.count++;return this;}
 finish(){this.data=new Float32Array(this.items);this.items=[];this.dirty=true;return this;}
 reset(){this.items.length=0;this.count=0;}
 flush(){const n=this.items.length;if(!this.data||this.data.length<n)this.data=new Float32Array(Math.max(n,(this.data?.length||256)*2));this.data.set(this.items);this.dirty=true;}
 dispose(renderer){renderer?.disposeBatch(this);}
}
class SceneBuilder {
 constructor(){this.batches=[];this.cells=new Map();this.geometry=PRIMITIVES;}
 instance(name,p,scale,color,props=[0,.7,0,0],yaw=0,pitch=0,roll=0){const cx=Math.floor(p[0]/480),cz=Math.floor(p[2]/480),key=`${name}:${cx}:${cz}`;let batch=this.cells.get(key);if(!batch){batch=new Batch(this.geometry[name],{center:[cx*480+240,p[1],cz*480+240],radius:520,maxDistance:name==='pine'||name==='foliage'?3400:4200});this.cells.set(key,batch);this.batches.push(batch);}batch.radius=Math.max(batch.radius,Math.hypot(p[0]-batch.center[0],p[1]-batch.center[1],p[2]-batch.center[2])+Math.hypot(...scale)*.6);batch.add(transform(p,scale,yaw,pitch,roll),color,props);return batch;}
 oriented(name,matrix,color,props=[0,.7,0,0]){const p=[matrix[12],matrix[13],matrix[14]],cx=Math.floor(p[0]/480),cz=Math.floor(p[2]/480),key=`${name}:${cx}:${cz}`;let batch=this.cells.get(key);if(!batch){batch=new Batch(this.geometry[name],{center:[cx*480+240,p[1],cz*480+240],radius:520,maxDistance:3600});this.cells.set(key,batch);this.batches.push(batch);}batch.radius=Math.max(batch.radius,Math.hypot(p[0]-batch.center[0],p[1]-batch.center[1],p[2]-batch.center[2])+Math.hypot(matrix[0],matrix[1],matrix[2],matrix[4],matrix[5],matrix[6],matrix[8],matrix[9],matrix[10])*.6);batch.add(matrix,color,props);return batch;}
 segment(a,b,width,color,props=[0,.65,0,0],depth=width){const mid=mul(add(a,b),.5),m=frameMatrix(mid,sub(b,a),[width,depth,length(sub(b,a))]);return this.oriented('box',m,color,props);}
 mesh(geometry,center=[0,0,0],radius=1000,props=[0,.8,0,0],color=[1,1,1,1]){const batch=new Batch(geometry,{center,radius});batch.add(transform([0,0,0]),color,props).finish();this.batches.push(batch);return batch;}
 finish(){const lod=[];for(const b of this.cells.values()){b.finish();if(b.geometry===this.geometry.pine||b.geometry===this.geometry.foliage){const isPine=b.geometry===this.geometry.pine;b.lodNear=isPine?600:700;const far=new Batch(isPine?this.geometry.pineFar:this.geometry.foliageFar,{center:b.center,radius:b.radius,maxDistance:b.maxDistance});far.data=b.data;far.count=b.count;far.lodFar=b.lodNear;lod.push(far);}}this.batches.push(...lod);this.cells.clear();return this.batches;}
}

return {Geometry,MeshBuilder,boxGeometry,cylinderGeometry,sphereGeometry,pineFarGeometry,pineGeometry,foliageGeometry,bodyGeometry,noseGeometry,PRIMITIVES,Batch,SceneBuilder};
})();
// ---- src/botany.js ----
const __m_src_botany_js = (() => {
const {Geometry,MeshBuilder,Batch,PRIMITIVES} = __m_src_geometry_js;
const {rng,hash2,noise2,hex,clamp,smooth,add,sub,mul,norm,cross,transform,TAU} = __m_src_math_js;
/** Living Worlds: deterministic, instanced botany with shared near/mid/far meshes.
 * Compound-leaf cards are analytically cut out in both colour and shadow passes.
 * No external textures, random frame-dependent placement or per-tree draw calls.
 */


const BOTANY_REVISION=1;
const FOREST_CELL=320;
const SPECIES=['fir','oak','birch','cherry','pine'];
const palettes={fir:['#315642','#466746'],pine:['#38583f','#557248'],oak:['#42633e','#687e46'],birch:['#62814a','#507040'],cherry:['#cfabb4','#b88899']};
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
function treeArchetype(species='fir',variant=0,lod=0){
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
   const leaves=lod===0?56:lod===1?8:4;
   for(let k=0;k<leaves;k++){
    const theta=r()*TAU,v=r()*2-1,rad=Math.pow(r(),.4)*(birch?.12:.17);
    const p=add(end,[Math.cos(theta)*Math.sqrt(1-v*v)*rad,v*rad*.8,Math.sin(theta)*Math.sqrt(1-v*v)*rad]);
    const size=lod===0?.036+r()*.026:lod===1?.15:.23;
    clusters.push({p,scale:size,angle:r()*TAU,tilt:(r()-.5)*2.5});
   }
  }
 }
 for(const c of clusters){const n=norm([c.p[0]*2,c.p[1]-.42,c.p[2]*2]);card(leaf,c.p,c.scale,c.angle,c.tilt,n);}
 const result={wood:wood.geometry(),leaf:leaf.geometry(),leafCards:clusters.length,species,variant,lod};
 PRIMITIVES[key+'-wood']=result.wood;PRIMITIVES[key+'-leaf']=result.leaf;cached.set(key,result);return result;
}
/** Cell bounds are exact enough to cull canopy cells instead of entire forests. */
class ForestBuilder {
 constructor(builder){this.builder=builder;this.cells=new Map();this.treeCount=0;}
 add(p,height,species,variation=0){
  if(!Number.isFinite(height)||height<=0||!p.every(Number.isFinite))return;
  const variant=variation>.5?1:0,cx=Math.floor(p[0]/FOREST_CELL),cz=Math.floor(p[2]/FOREST_CELL),palette=palettes[species]||palettes.fir;
  const color=hex(palette[variant]),wood=hex(species==='birch'?'#c9c7b1':'#6e604b'),yaw=variation*TAU;
  const matrix=transform(p,[height,height,height],yaw);
  for(let lod=0;lod<3;lod++){
   const model=treeArchetype(species,variant,lod);
   for(const role of ['wood','leaf']){
    if(lod===2&&role==='wood')continue;
    const key=`${cx},${cz},${species},${variant},${lod},${role}`;
    let batch=this.cells.get(key);
    if(!batch){batch=new Batch(model[role],{center:[(cx+.5)*FOREST_CELL,p[1]+height*.5,(cz+.5)*FOREST_CELL],radius:FOREST_CELL*.8,maxDistance:5800,castShadow:lod<2});
     batch.lodNear=lod===0?280:lod===1?1300:0;batch.lodFar=lod===0?0:lod===1?280:1300;
     batch.cutout=role==='leaf';batch.detailClass='forest';this.cells.set(key,batch);this.builder.batches.push(batch);}
    batch.radius=Math.max(batch.radius,Math.hypot(p[0]-batch.center[0],p[1]+height*.5-batch.center[1],p[2]-batch.center[2])+height*.65);
    batch.add(matrix,role==='leaf'?color:wood,role==='leaf'?[11,.86,species==='fir'||species==='pine'?1:0,variation]:[15,.94,0,0]);
   }
  }
  this.treeCount++;
 }
 finish(){for(const batch of this.cells.values())batch.finish();this.cells.clear();}
}
function addLivingTree(world,p,height,variation=.5,species=null){
 if(!world.forest)world.forest=new ForestBuilder(world.builder);
 if(!species){const t=world.def.theme;species=t==='sakura'?(variation>.45?'cherry':'pine'):t==='nordic'?(variation>.7?'birch':'fir'):['pine','coast','metro'].includes(t)?(variation>.4?'oak':'pine'):'fir';}
 world.forest.add(p,height,species,variation);
}
function urbanLandUse(world,x,z){
 for(const d of world.districts||[]){const dx=x-d.origin[0],dz=z-d.origin[2],lx=dx*d.right[0]+dz*d.right[2],lz=dx*d.forward[0]+dz*d.forward[2];
  if(lx>d.minX-8&&lx<d.maxX+8&&lz>d.minZ-8&&lz<d.maxZ+8)return true;}
 return false;
}
function plantCactus(world,p,height,variation){
 const b=world.builder,color=hex('#788762');b.instance('cylinder',add(p,[0,height*.5,0]),[.55,height,.55],color,[6,.9,0,0]);b.instance('sphere',add(p,[0,height,0]),[.55,.55,.55],color);
 for(const side of [-1,1]){const y=height*(side<0?.42:.62),x=side*(.7+variation*.45);b.segment(add(p,[0,y,0]),add(p,[x,y,0]),.35,color);b.instance('cylinder',add(p,[x,y+height*.14,0]),[.35,height*.28,.35],color);b.instance('sphere',add(p,[x,y+height*.28,0]),[.35,.35,.35],color);}
}
/** Bounded, scan-order-independent top-K sampling. Every accepted site receives
 * an independent priority; reaching the population budget never clips a map edge.
 */
class ForestReservoir {
 constructor(capacity=70000){this.capacity=Math.max(0,Math.min(70000,capacity|0));this.heap=[];this.offered=0;}
 offer(site,priority){
  if(!Number.isFinite(priority)||!this.capacity)return;this.offered++;const h=this.heap,node={site,priority};
  if(h.length<this.capacity){h.push(node);let i=h.length-1;while(i){const p=(i-1)>>1;if(h[p].priority>=priority)break;h[i]=h[p];i=p;}h[i]=node;return;}
  if(priority>=h[0].priority)return;let i=0;while(i*2+1<h.length){let j=i*2+1;if(j+1<h.length&&h[j+1].priority>h[j].priority)j++;if(h[j].priority<=priority)break;h[i]=h[j];i=j;}h[i]=node;
 }
 sites(){return this.heap.slice().sort((a,b)=>a.priority-b.priority).map(n=>n.site);}
}
async function buildLivingForest(world,onProgress=()=>{}){
 const f=world.terrain,w=world.def,span=Math.max(w.rx,w.rz)*2.05,spacing=f.profile.spacing*.58;
 let row=0,count=0;const sites=new ForestReservoir();
 for(let z=-span;z<span;z+=spacing){for(let x=-span;x<span;x+=spacing){
  const ix=Math.floor(x/spacing),iz=Math.floor(z/spacing),v=hash2(ix,iz,world.seed+7);
  const px=x+spacing*(.12+.76*hash2(ix,iz,world.seed+11)),pz=z+spacing*(.12+.76*hash2(ix,iz,world.seed+19));
  const patch=noise2(px*.0022,pz*.0022,world.seed+911),chance=f.profile.forest*(.25+.75*smooth(.18,.68,patch))*f.options.vegetation;
  if(v>chance||urbanLandUse(world,px,pz))continue;
  const h=world.baseHeight(px,pz);if(h<w.water+2||h>w.snowLine+30)continue;
  const c=f.climate(px,pz,h);if(c.slope>.76||world.network.nearest(px,pz,11))continue;
  const p=[px,(world.surfaceHeight?.(px,pz)??world.height(px,pz))-.08,pz],variation=hash2(ix,iz,world.seed+61);
  const height=(10+variation*15)*(1-smooth(w.snowLine-130,w.snowLine+30,h)*.48);
  if(w.theme==='canyon'&&v>.032)continue;
  sites.offer({p,height,variation},hash2(ix,iz,world.seed+13817));
 }if(++row%24===0){onProgress('Growing layered woodland',.74+.10*(z+span)/(2*span));await new Promise(resolve=>setTimeout(resolve,0));}}
 for(const site of sites.sites()){const {p,height,variation}=site;
  if(w.theme==='canyon'){if(variation>.35)plantCactus(world,p,height*.25,variation);else addLivingTree(world,p,height*.32,variation,'pine');}
  else addLivingTree(world,p,height,variation);
  if(++count%4000===0)await new Promise(resolve=>setTimeout(resolve,0));
 }
 world.features.forestCandidates=sites.offered;world.features.trees+=count;world.features.forestTrees=count;world.features.botanyRevision=BOTANY_REVISION;
 // Fallen timber, mossy outcrops and patches of young woodland follow the corridor.
 let understory=0,edgeIndex=0;
 for(const edge of world.network.edges.values()){
 const corridor=edgeIndex++;
 for(let s=0,index=0;s<edge.length;s+=6.5,index++){
  if(hash2(index,corridor,world.seed+9017)>clamp(f.options.vegetation,.25,1.7)/1.7)continue;
  const r=rng((hash2(index,corridor,world.seed+9037)*4294967296)>>>0);
  const pose=edge.at(s),offset=(r()>.5?1:-1)*(18+r()*170),p=add(pose.p,mul(pose.right,offset));
  const h=world.baseHeight(p[0],p[2]);if(h<w.water+2||h>w.snowLine||urbanLandUse(world,p[0],p[2])||world.network.nearest(p[0],p[2],9))continue;
  const c=f.climate(p[0],p[2],h);if(c.slope>.64)continue;p[1]=world.surfaceHeight?.(p[0],p[2])??world.height(p[0],p[2]);
  if(r()>.15&&w.theme!=='canyon'){addLivingTree(world,p,1.4+r()*3.4,r(),w.theme==='highland'?'cherry':'oak');understory++;}
  else if(r()>.4){const batch=world.builder.instance('boulder',add(p,[0,.35,0]),[2+r()*4,1+r()*2,2+r()*4],hex(w.rock),[6,.96,0,0],r()*TAU);batch.maxDistance=1300;}
  else if(w.theme!=='canyon'){const end=add(p,[3+r()*4,.25,r()*2]);world.builder.segment(add(p,[0,.35,0]),end,.4,hex('#63533f'),[15,.98,0,0]);}
 }}
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
class GroundCover {
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

return {BOTANY_REVISION,FOREST_CELL,SPECIES,treeArchetype,ForestBuilder,addLivingTree,urbanLandUse,ForestReservoir,buildLivingForest,GroundCover};
})();
// ---- src/postprocess.js ----
const __m_src_postprocess_js = (() => {
const {clamp} = __m_src_math_js;
/** Linear-light scene -> quarter-resolution bloom -> filmic display transform.
 * Each pass has distinct sampled/attachment resources (no feedback hazards).
 * WebGL float renderability and MSAA counts are queried, never assumed.
 */

const LOOKS = Object.freeze({
 natural:{saturation:1.02,contrast:1.03,temperature:0},
 cinema:{saturation:.93,contrast:1.10,temperature:.06},
 alpine:{saturation:.91,contrast:1.04,temperature:-.08},
 vintage:{saturation:.72,contrast:1.06,temperature:.16}
});
function postOptions(value={}) {
 const v=value&&typeof value==='object'?value:{};
 const finite=(x,lo,hi,d)=>Number.isFinite(x)?clamp(x,lo,hi):d;
 return {look:Object.hasOwn(LOOKS,v.look)?v.look:'natural',bloom:finite(v.bloom,0,1,.24),
  vignette:finite(v.vignette,0,.6,.15),grain:finite(v.grain,0,.15,0)};
}
function targetSize(width,height,scale=1,max=4096) {
 const w=Math.max(1,Number.isFinite(width)?width:1),h=Math.max(1,Number.isFinite(height)?height:1);
 const s=Math.max(.1,Math.min(Number.isFinite(scale)?scale:1,max/w,max/h));
 // Clamp proportionally, including unusually large/hostile viewport values.
 const k=Math.min(s,max/w,max/h);
 return [Math.max(1,Math.floor(w*k)),Math.max(1,Math.floor(h*k))];
}
const POST_WGSL=/* wgsl */`
struct Post {screen:vec4f,look:vec4f,style:vec4f};
@group(0) @binding(0) var<uniform> u:Post;
@group(0) @binding(1) var scene:texture_2d<f32>;
@group(0) @binding(2) var glow:texture_2d<f32>;
@group(0) @binding(3) var linearSampler:sampler;
struct Out {@builtin(position) position:vec4f,@location(0) uv:vec2f};
@vertex fn vs(@builtin(vertex_index) i:u32)->Out {
 let p=vec2f(f32((i<<1u)&2u),f32(i&2u));var o:Out;
 o.position=vec4f(p*2.-1.,0.,1.);o.uv=vec2f(p.x,1.-p.y);return o;
}
fn sampleScene(uv:vec2f)->vec3f {return textureSampleLevel(scene,linearSampler,uv,0.).rgb;}
fn threshold(c:vec3f)->vec3f {let l=max(max(c.r,c.g),c.b);let knee=clamp(l-.65,0.,.7);let soft=knee*knee/1.4;return c*max(l-1.,soft)/max(l,.0001);}
@fragment fn extract(v:Out)->@location(0) vec4f {
 let d=1./u.screen.xy;var c=vec3f(0);
 c+=sampleScene(v.uv+vec2f(-1.5,-1.5)*d);c+=sampleScene(v.uv+vec2f(1.5,-1.5)*d);
 c+=sampleScene(v.uv+vec2f(-1.5,1.5)*d);c+=sampleScene(v.uv+vec2f(1.5,1.5)*d);
 return vec4f(threshold(c*.25),1);
}
fn blur(uv:vec2f,axis:vec2f)->vec4f {
 let d=axis/vec2f(textureDimensions(scene));var c=sampleScene(uv)*.227027;
 c+=(sampleScene(uv+d*1.384615)+sampleScene(uv-d*1.384615))*.316216;
 c+=(sampleScene(uv+d*3.230769)+sampleScene(uv-d*3.230769))*.070270;
 return vec4f(c,1);
}
@fragment fn blurH(v:Out)->@location(0) vec4f {return blur(v.uv,vec2f(1,0));}
@fragment fn blurV(v:Out)->@location(0) vec4f {return blur(v.uv,vec2f(0,1));}
fn aces(c:vec3f)->vec3f {let x=max(c,vec3f(0));return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),vec3f(0),vec3f(1));}
@fragment fn composite(v:Out)->@location(0) vec4f {
 var c=sampleScene(v.uv)+textureSampleLevel(glow,linearSampler,v.uv,0.).rgb*u.look.x;
 c*=vec3f(1.+u.style.x*.25,1.,1.-u.style.x*.25);
 c=aces(c*u.screen.w);let lum=dot(c,vec3f(.2126,.7152,.0722));c=mix(vec3f(lum),c,u.look.y);
 c=pow(clamp(c,vec3f(0),vec3f(1)),vec3f(u.look.z));
 let q=v.uv*(1.-v.uv);let vig=pow(clamp(q.x*q.y*16.,0.,1.),.28);
 c*=mix(1.,vig,u.look.w);
 c=pow(max(c,vec3f(0)),vec3f(1./2.2));
 let grain=fract(sin(dot(v.position.xy+u.screen.z*17.,vec2f(12.9898,78.233)))*43758.5453)-.5;
 return vec4f(clamp(c+grain*u.style.y,vec3f(0),vec3f(1)),1);
}
`;
const GL_VS=`#version 300 es
precision highp float;out vec2 uv;void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.-1.,0,1);uv=p;}`;
const GL_COMMON=`#version 300 es
precision highp float;uniform vec4 screen,look,style;uniform sampler2D scene,glow;in vec2 uv;out vec4 outColor;
vec3 sampleScene(vec2 p){return texture(scene,p).rgb;}
vec3 aces(vec3 c){vec3 x=max(c,vec3(0));return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
`;
const GL_FS={
 extract:GL_COMMON+`void main(){vec2 d=1./screen.xy;vec3 c=(sampleScene(uv+vec2(-1.5,-1.5)*d)+sampleScene(uv+vec2(1.5,-1.5)*d)+sampleScene(uv+vec2(-1.5,1.5)*d)+sampleScene(uv+vec2(1.5,1.5)*d))*.25;float l=max(max(c.r,c.g),c.b),knee=clamp(l-.65,0.,.7);outColor=vec4(c*max(l-1.,knee*knee/1.4)/max(l,.0001),1);}`,
 blurH:GL_COMMON+`void main(){vec2 d=vec2(1,0)/vec2(textureSize(scene,0));vec3 c=sampleScene(uv)*.227027+(sampleScene(uv+d*1.384615)+sampleScene(uv-d*1.384615))*.316216+(sampleScene(uv+d*3.230769)+sampleScene(uv-d*3.230769))*.070270;outColor=vec4(c,1);}`,
 blurV:GL_COMMON+`void main(){vec2 d=vec2(0,1)/vec2(textureSize(scene,0));vec3 c=sampleScene(uv)*.227027+(sampleScene(uv+d*1.384615)+sampleScene(uv-d*1.384615))*.316216+(sampleScene(uv+d*3.230769)+sampleScene(uv-d*3.230769))*.070270;outColor=vec4(c,1);}`,
 composite:GL_COMMON+`void main(){vec3 c=sampleScene(uv)+texture(glow,uv).rgb*look.x;c*=vec3(1.+style.x*.25,1.,1.-style.x*.25);c=style.z>.5?aces(c*screen.w):pow(max(c,vec3(0)),vec3(2.2));float lum=dot(c,vec3(.2126,.7152,.0722));c=mix(vec3(lum),c,look.y);c=pow(clamp(c,vec3(0),vec3(1)),vec3(look.z));vec2 q=uv*(1.-uv);c*=mix(1.,pow(clamp(q.x*q.y*16.,0.,1.),.28),look.w);c=pow(max(c,vec3(0)),vec3(1./2.2));float grain=fract(sin(dot(gl_FragCoord.xy+screen.z*17.,vec2(12.9898,78.233)))*43758.5453)-.5;outColor=vec4(clamp(c+grain*style.y,0.,1.),1);}`
};

class PostProcessor {
 constructor(){this.options=postOptions();this.width=0;this.height=0;this.passCount=0;this.resources=[];this.frame=new Float32Array(12);}
 async initGPU(device,format){
  this.device=device;this.hdr=true;this.format=format;
  this.uniform=device.createBuffer({label:'Display transform',size:48,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
  this.sampler=device.createSampler({magFilter:'linear',minFilter:'linear',addressModeU:'clamp-to-edge',addressModeV:'clamp-to-edge'});
  this.layout=device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,buffer:{type:'uniform'}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:'float'}},{binding:2,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:'float'}},{binding:3,visibility:GPUShaderStage.FRAGMENT,sampler:{type:'filtering'}}]});
  const module=device.createShaderModule({label:'Linear bloom and filmic display',code:POST_WGSL});
  const errors=(await module.getCompilationInfo()).messages.filter(m=>m.type==='error');
  if(errors.length)throw new Error(errors.map(e=>`${e.lineNum}: ${e.message}`).join('\n'));
  this.pipelines={};
  for(const entryPoint of ['extract','blurH','blurV','composite'])this.pipelines[entryPoint]=await device.createRenderPipelineAsync({
   label:'Post '+entryPoint,layout:device.createPipelineLayout({bindGroupLayouts:[this.layout]}),
   vertex:{module,entryPoint:'vs'},fragment:{module,entryPoint,targets:[{format:entryPoint==='composite'?format:'rgba16float'}]},primitive:{topology:'triangle-list'}
  });
 }
 initGL(gl,compile){
  this.gl=gl;this.hdr=!!gl.getExtension('EXT_color_buffer_float');this.colorFormat=this.hdr?gl.RGBA16F:gl.RGBA8;
  this.programs={};this.locations={};this.vao=gl.createVertexArray();
  for(const [name,fs] of Object.entries(GL_FS)) {
   const p=this.programs[name]=compile(GL_VS,fs),loc=this.locations[name]={};gl.useProgram(p);
   for(const key of ['screen','look','style'])loc[key]=gl.getUniformLocation(p,key);
   gl.uniform1i(gl.getUniformLocation(p,'scene'),0);gl.uniform1i(gl.getUniformLocation(p,'glow'),1);
  }
  const colorSamples=Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER,this.colorFormat,gl.SAMPLES));
  const depthSamples=Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,gl.SAMPLES));
  this.samples=Math.max(0,...colorSamples.filter(n=>n<=4&&depthSamples.includes(n)));
 }
 releaseTargets(){
  if(this.device){for(const r of this.resources)r.destroy();}
  else if(this.gl)for(const [kind,r] of this.resources)this.gl[kind](r);
  this.resources=[];this.groups=null;
 }
 resize(w,h){
  if(this.width===w&&this.height===h)return;
  this.releaseTargets();this.width=w;this.height=h;this.bw=Math.max(1,Math.floor(w/4));this.bh=Math.max(1,Math.floor(h/4));
  if(this.device){
   const texture=(width,height)=>{const t=this.device.createTexture({size:[width,height],format:'rgba16float',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING});this.resources.push(t);return t;};
   this.scene=texture(w,h);this.a=texture(this.bw,this.bh);this.b=texture(this.bw,this.bh);
   const group=(scene,glow)=>this.device.createBindGroup({layout:this.layout,entries:[{binding:0,resource:{buffer:this.uniform}},{binding:1,resource:scene.createView()},{binding:2,resource:glow.createView()},{binding:3,resource:this.sampler}]});
   // Unused bindings also must never alias the current render attachment.
   this.groups={extract:group(this.scene,this.scene),blurH:group(this.a,this.scene),blurV:group(this.b,this.scene),composite:group(this.scene,this.a)};
  } else {
   const g=this.gl,own=(kind,r)=>{this.resources.push([kind,r]);return r;};
   const target=(width,height)=>{
    const texture=own('deleteTexture',g.createTexture());g.bindTexture(g.TEXTURE_2D,texture);
    g.texImage2D(g.TEXTURE_2D,0,this.colorFormat,width,height,0,g.RGBA,this.hdr?g.HALF_FLOAT:g.UNSIGNED_BYTE,null);
    for(const [p,v] of [[g.TEXTURE_MIN_FILTER,g.LINEAR],[g.TEXTURE_MAG_FILTER,g.LINEAR],[g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE],[g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE]])g.texParameteri(g.TEXTURE_2D,p,v);
    const fb=own('deleteFramebuffer',g.createFramebuffer());g.bindFramebuffer(g.FRAMEBUFFER,fb);g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.TEXTURE_2D,texture,0);
    return {texture,fb};
   };
   this.scene=target(w,h);this.a=target(this.bw,this.bh);this.b=target(this.bw,this.bh);
   this.sceneFB=this.scene.fb;
   if(this.samples){
    this.sceneFB=own('deleteFramebuffer',g.createFramebuffer());g.bindFramebuffer(g.FRAMEBUFFER,this.sceneFB);
    const color=own('deleteRenderbuffer',g.createRenderbuffer());g.bindRenderbuffer(g.RENDERBUFFER,color);g.renderbufferStorageMultisample(g.RENDERBUFFER,this.samples,this.colorFormat,w,h);g.framebufferRenderbuffer(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.RENDERBUFFER,color);
   }else g.bindFramebuffer(g.FRAMEBUFFER,this.sceneFB);
   const depth=own('deleteRenderbuffer',g.createRenderbuffer());g.bindRenderbuffer(g.RENDERBUFFER,depth);
   if(this.samples)g.renderbufferStorageMultisample(g.RENDERBUFFER,this.samples,g.DEPTH_COMPONENT24,w,h);else g.renderbufferStorage(g.RENDERBUFFER,g.DEPTH_COMPONENT24,w,h);
   g.framebufferRenderbuffer(g.FRAMEBUFFER,g.DEPTH_ATTACHMENT,g.RENDERBUFFER,depth);
   if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE)throw new Error('Scene framebuffer is incomplete');
   g.bindFramebuffer(g.FRAMEBUFFER,null);g.bindRenderbuffer(g.RENDERBUFFER,null);
  }
 }
 update(env,time,quality){
  const o=postOptions(this.options),look=LOOKS[o.look];this.bloomActive=o.bloom>0&&quality!=='low'&&this.hdr;
  this.frame.set([this.width,this.height,time,Number.isFinite(env.exposure)?env.exposure:1]);
  this.frame.set([this.bloomActive?o.bloom:0,look.saturation,look.contrast,o.vignette],4);
  this.frame.set([look.temperature,o.grain,this.hdr?1:0,0],8);
 }
 encodeGPU(encoder,output,env,time,quality){
  this.update(env,time,quality);this.device.queue.writeBuffer(this.uniform,0,this.frame);this.passCount=0;
  const pass=(name,view)=>{const p=encoder.beginRenderPass({label:'Post '+name,colorAttachments:[{view,loadOp:'clear',storeOp:'store',clearValue:{r:0,g:0,b:0,a:1}}]});p.setPipeline(this.pipelines[name]);p.setBindGroup(0,this.groups[name]);p.draw(3);p.end();this.passCount++;};
  if(this.bloomActive){pass('extract',this.a.createView());pass('blurH',this.b.createView());pass('blurV',this.a.createView());}
  pass('composite',output);
 }
 drawGL(env,time,quality){
  this.update(env,time,quality);const g=this.gl;this.passCount=0;
  if(this.samples){g.bindFramebuffer(g.READ_FRAMEBUFFER,this.sceneFB);g.bindFramebuffer(g.DRAW_FRAMEBUFFER,this.scene.fb);g.blitFramebuffer(0,0,this.width,this.height,0,0,this.width,this.height,g.COLOR_BUFFER_BIT,g.NEAREST);}
  g.disable(g.DEPTH_TEST);g.disable(g.BLEND);g.depthMask(false);g.bindVertexArray(this.vao);
  const pass=(name,target,source,glow,w,h)=>{
   g.bindFramebuffer(g.FRAMEBUFFER,target);g.viewport(0,0,w,h);g.useProgram(this.programs[name]);const l=this.locations[name];
   g.uniform4fv(l.screen,this.frame.subarray(0,4));g.uniform4fv(l.look,this.frame.subarray(4,8));g.uniform4fv(l.style,this.frame.subarray(8,12));
   g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,source);g.activeTexture(g.TEXTURE1);g.bindTexture(g.TEXTURE_2D,glow);g.drawArrays(g.TRIANGLES,0,3);this.passCount++;
  };
  if(this.bloomActive){pass('extract',this.a.fb,this.scene.texture,this.scene.texture,this.bw,this.bh);pass('blurH',this.b.fb,this.a.texture,this.scene.texture,this.bw,this.bh);pass('blurV',this.a.fb,this.b.texture,this.scene.texture,this.bw,this.bh);}
  pass('composite',null,this.scene.texture,this.a.texture,this.width,this.height);
  g.activeTexture(g.TEXTURE0);g.bindVertexArray(null);g.depthMask(true);g.enable(g.DEPTH_TEST);
 }
 dispose(){this.releaseTargets();this.uniform?.destroy?.();if(this.gl){for(const p of Object.values(this.programs))this.gl.deleteProgram(p);this.gl.deleteVertexArray(this.vao);}}
}

return {LOOKS,postOptions,targetSize,POST_WGSL,PostProcessor};
})();
// ---- src/data.js ----
const __m_src_data_js = (() => {

/** Original fictional routes and rolling stock. SI units throughout the simulation. */
const WORLDS = [
 {id:'alpine',name:'Alpine Crossing',region:'HIGH ALPINE • EUROPE',tag:'Mountain passenger',description:'Glacial water, stone viaducts and pine-covered slopes beneath a snow-capped massif.',icon:'mountain',seed:8472,rx:2050,rz:1530,water:35,railY:80,gradeHeight:14,mountains:1120,snowLine:530,trees:7200,theme:'alpine',limit:140,sky:'#a2bed0',ground:'#577456',rock:'#9b9c94',waterColor:'#225f64',accent:'#95d2b3',stations:['Linden Central','Lake Brienz','Summit Junction','Felsen Pass','Alpenhof'],hour:16.4},
 {id:'coast',name:'Pacific Coast',region:'PACIFIC RIM • COASTAL',tag:'Ocean express',description:'Run along surf-washed cliffs, through seaside towns and over long coastal bridges.',icon:'waves',seed:14681,rx:2400,rz:1480,water:8,railY:40,gradeHeight:10,mountains:580,snowLine:9999,trees:3800,theme:'coast',limit:160,sky:'#adcbd8',ground:'#809575',rock:'#b5ab91',waterColor:'#2e879b',accent:'#70c9e2',stations:['Crescent Bay','Oceanview','Salt Point','Harbor East','Seacliff'],hour:15.7},
 {id:'nordic',name:'Nordic Fjords',region:'SCANDINAVIA • ARCTIC',tag:'Winter railway',description:'A cold, demanding railway around a deep fjord. Snow reduces wheel adhesion.',icon:'snow',seed:2839,rx:1770,rz:2000,water:18,railY:64,gradeHeight:17,mountains:1360,snowLine:150,trees:6200,theme:'nordic',limit:110,sky:'#c0ced4',ground:'#798a82',rock:'#838e91',waterColor:'#304f63',accent:'#d0dce9',stations:['Nordvik','Birch Harbor','Fjord Bridge','Isdal','Aurora'],hour:13.3},
 {id:'canyon',name:'Canyon Trails',region:'AMERICAN SOUTHWEST',tag:'Heavy haul',description:'Haul a long freight through layered red sandstone and a vast high-desert basin.',icon:'sun',seed:31862,rx:2680,rz:1920,water:12,railY:86,gradeHeight:23,mountains:740,snowLine:9999,trees:500,theme:'canyon',limit:100,sky:'#c6c9c1',ground:'#b38b63',rock:'#b56f4c',waterColor:'#547f74',accent:'#e8aa73',stations:['Red Mesa','Copper Ridge','Dry Creek','Eagle Rock','West Yard'],hour:17.1},
 {id:'sakura',name:'Sakura Valley',region:'EAST ASIA • COUNTRYSIDE',tag:'High-speed intercity',description:'Rice fields, blossom trees, electrified lines and compact hillside villages.',icon:'flower',seed:58209,rx:2850,rz:1680,water:6,railY:45,gradeHeight:8,mountains:630,snowLine:750,trees:7300,theme:'sakura',limit:220,sky:'#b7cddd',ground:'#789463',rock:'#839085',waterColor:'#679da0',accent:'#edb7c7',stations:['Harukawa','Midori Park','Sakura Bridge','Hoshino','Kitayama'],hour:10.5},
 {id:'highland',name:'Highland Wanderer',region:'NORTH ATLANTIC • HIGHLANDS',tag:'Heritage excursion',description:'Stone stations, open moorland, a dark loch and a long, curving viaduct.',icon:'cloud',seed:66483,rx:2350,rz:1660,water:25,railY:76,gradeHeight:20,mountains:930,snowLine:840,trees:3200,theme:'highland',limit:100,sky:'#b9c3c3',ground:'#777e58',rock:'#8a8880',waterColor:'#3b6466',accent:'#a9ba83',stations:['Glenhaven','Lochside','Blackwood','Ben Alder','Fort Glen'],hour:16.8},
 {id:'pine',name:'Pine Valley',region:'CENTRAL EUROPE • FOREST',tag:'Regional railway',description:'Gentle curves, dense woodland and small towns make an inviting place to learn.',icon:'tree',seed:7931,rx:1940,rz:1370,water:10,railY:48,gradeHeight:6,mountains:420,snowLine:9999,trees:9500,theme:'pine',limit:140,sky:'#b5d0d8',ground:'#688257',rock:'#949689',waterColor:'#407a6a',accent:'#86c39d',stations:['Oakbridge','Pine Hollow','Mill Lake','Fernhill','Woodland End'],hour:11.4},
 {id:'metro',name:'Neon Metropolis',region:'URBAN NETWORK • NIGHT',tag:'City commuter',description:'Concrete viaducts, illuminated towers, busy platforms and closely spaced services.',icon:'city',seed:98671,rx:1810,rz:1470,water:0,railY:32,gradeHeight:4,mountains:180,snowLine:9999,trees:1300,theme:'metro',limit:100,sky:'#8da1b2',ground:'#798478',rock:'#89918e',waterColor:'#254b66',accent:'#a7a0ed',stations:['Union Terminal','River Market','North Exchange','Tech Quarter','Westgate'],hour:20.2}
];
const STOCK = [
 {id:'aurora',name:'Aurora E200',family:'Electric intercity',kind:'electric',power:4200000,tractive:250000,mass:84000,drivenMass:84000,carMass:38000,carLength:23,locoLength:22,maxSpeed:200,defaultCars:3,maxCars:10,color:'#e3e6e1',stripe:'#c45c38',secondary:'#26373a',capacity:76,drag:6.4,description:'A versatile 4.2 MW electric locomotive with air-braked passenger coaches.'},
 {id:'velocity',name:'Velocity 320',family:'High-speed trainset',kind:'highspeed',power:8000000,tractive:310000,mass:78000,drivenMass:160000,carMass:44000,carLength:25,locoLength:27,maxSpeed:320,defaultCars:4,maxCars:10,color:'#e8e8df',stripe:'#227b8d',secondary:'#253c49',capacity:84,drag:4.1,description:'A streamlined distributed-traction trainset for fast intercity running.'},
 {id:'atlas',name:'Atlas D90',family:'Diesel freight',kind:'diesel',power:2900000,tractive:470000,mass:128000,drivenMass:128000,carMass:76000,carLength:17,locoLength:23,maxSpeed:120,defaultCars:6,maxCars:18,color:'#d38e3f',stripe:'#293637',secondary:'#364442',capacity:0,drag:12,description:'A heavy diesel-electric hauling loaded container flats and box wagons.'},
 {id:'heritage',name:'Heritage Pacific',family:'Steam excursion',kind:'steam',power:1700000,tractive:190000,mass:132000,drivenMass:82000,carMass:35000,carLength:20,locoLength:25,maxSpeed:120,defaultCars:3,maxCars:10,color:'#253b32',stripe:'#c5a765',secondary:'#1c2326',capacity:58,drag:9,description:'A steam locomotive with a working boiler model, regulator, fire and animated motion.'},
 {id:'metro',name:'Metro M8',family:'Electric commuter',kind:'metro',power:2400000,tractive:230000,mass:48000,drivenMass:112000,carMass:37000,carLength:20,locoLength:20,maxSpeed:120,defaultCars:3,maxCars:8,color:'#c7cecb',stripe:'#526795',secondary:'#263745',capacity:112,drag:5.5,description:'A frequent-stop commuter set with quick acceleration and wide platform doors.'},
 {id:'ranger',name:'Ranger DMU',family:'Regional diesel',kind:'regional',power:1100000,tractive:125000,mass:56000,drivenMass:56000,carMass:40000,carLength:22,locoLength:23,maxSpeed:160,defaultCars:1,maxCars:5,color:'#dbd8ca',stripe:'#658668',secondary:'#263b35',capacity:68,drag:5.4,description:'A light regional multiple unit suited to quiet branch lines and scenic journeys.'}
];
const WEATHER = {
 clear:{name:'Clear',fog:.000075,wet:0,cloud:.12,wind:.3},
 cloudy:{name:'Overcast',fog:.00018,wet:.12,cloud:.86,wind:.5},
 rain:{name:'Rain',fog:.00038,wet:1,cloud:1,wind:.8},
 storm:{name:'Storm',fog:.00065,wet:1,cloud:1,wind:1.6},
 snow:{name:'Snowfall',fog:.00042,wet:.85,cloud:.78,wind:.6},
 mist:{name:'Morning mist',fog:.0011,wet:.2,cloud:.38,wind:.1}
};
const SCENARIOS = [
 {id:'free',name:'Free roam',description:'Your railway. No timetable, no pressure. Drive, explore and build.'},
 {id:'passenger',name:'Passenger service',description:'Call at every station, stop precisely and open the doors to board passengers.'},
 {id:'freight',name:'Freight delivery',description:'Move your consist to the far-side yard and stop inside the delivery marker.'},
 {id:'precision',name:'Precision driver',description:'Complete three passenger stops without speeding or triggering the safety system.'}
];

return {WORLDS,STOCK,WEATHER,SCENARIOS};
})();
// ---- src/journey.js ----
const __m_src_journey_js = (() => {
const {clamp} = __m_src_math_js;
const {WEATHER} = __m_src_data_js;
/** Read-only driving coach. SI internally; never substitutes for train protection. */


function serviceStoppingDistance(speed,grade=0,cars=0,wet=0){
 const v=Math.abs(Number.isFinite(speed)?speed:0),slope=Number.isFinite(grade)?clamp(grade,-.12,.12):0;
 const decel=Math.max(.20,.78-clamp(wet,0,1)*.16+9.80665*slope),delay=2+clamp(cars,0,18)*.12;
 return v*delay+v*v/(2*decel);
}
function speedEnvelope(target,distance,grade=0,wet=0){
 const a=Math.max(.20,.78-clamp(wet,0,1)*.16+9.80665*clamp(grade,-.12,.12));
 return Math.sqrt(Math.max(0,target*target+2*a*Math.max(0,distance)));
}
function cleanJourney(value={}){
 const v=value&&typeof value==='object'?value:{},result={};
 for(const key of ['distance','seconds','overspeed','harsh','energy','stops'])result[key]=Number.isFinite(v[key])?clamp(v[key],0,1e9):0;
 return result;
}
class JourneyDirector {
 constructor(){this.stats=cleanJourney();this.profile=[];this.clock=0;this.lastSpeed=null;this.lastOdometer=null;this.jerk=0;this.guidance={message:'Ready for departure',target:0,distance:0,kind:'clear'};this.previousAcceleration=0;this.stationId=null;this.stationCounted=false;}
 reset(value){this.stats=cleanJourney(value);this.clock=0;this.lastSpeed=null;this.lastOdometer=null;this.previousAcceleration=0;this.jerk=0;this.stationId=null;this.stationCounted=false;this.profile=[];}
 step(dt,train,world,env,limit,mission){
  if(!Number.isFinite(dt)||dt<=0||dt>.1)return;
  const v=Math.abs(train.speed),position=train.cursor.odometer;
  if(this.lastOdometer!==null){const d=Math.abs(position-this.lastOdometer);if(d<v*dt+2)this.stats.distance+=d;}
  this.lastOdometer=position;this.stats.seconds+=dt;
  if(v*3.6>limit+3)this.stats.overspeed+=dt;
  const raw=(train.acceleration-this.previousAcceleration)/dt;
  this.jerk+=(clamp(raw,-15,15)-this.jerk)*(1-Math.exp(-dt*3));this.previousAcceleration=train.acceleration;
  if(v>.8&&(Math.abs(this.jerk)>1.2||Math.abs(train.acceleration)>1.15))this.stats.harsh+=dt;
  this.stats.energy+=Math.max(0,Math.abs(train.traction*train.speed))*dt/3600000;
  const p=train.cursor.pose(),station=world.stations.find(s=>s.edge===p.edge&&Math.abs(s.s-p.s)<18);
  if(station&&v<.15&&train.controls.doors&&this.stationId!==station.id){this.stats.stops++;this.stationId=station.id;}
  else if(!station)this.stationId=null;
  this.clock-=dt;
  if(this.clock<=0){this.clock=.4;this.survey(train,world,env,limit,mission);}
 }
 survey(train,world,env,limit,mission){
  const direction=Math.sign(train.speed)||train.controls.reverser||1,v=Math.abs(train.speed),wet=(WEATHER[env.weather]||WEATHER.clear).wet;
  const grade=train.grade*direction,stop=serviceStoppingDistance(v,grade,train.cars,wet),range=clamp(stop*1.5+600,1200,4000);
  this.profile=[];let routeGrade=grade,target=limit/3.6,constraint={distance:range,kind:'clear',message:'Line clear — enjoy the journey'};
  for(let d=0;d<=range;d+=60){
   const p=train.cursor.pose(direction*d),edge=world.network.edges.get(p.edge),speed=Math.min(train.stock.maxSpeed,edge.speedLimit(p.s));
   const travelGrade=p.grade*direction;routeGrade=Math.min(routeGrade,travelGrade);
   this.profile.push({distance:d,height:p.p[1],limit:speed,grade:travelGrade});
   const permitted=speedEnvelope(speed/3.6,Math.max(0,d-v*(2+train.cars*.12)),routeGrade,wet);
   if(permitted<target){target=permitted;constraint={distance:d,kind:'limit',message:`Curve / limit ahead · ${Math.round(speed)} km/h`};}
  }
  const gradeTo=distance=>Math.min(grade,...this.profile.filter(p=>p.distance<=distance).map(p=>p.grade));
  const danger=world.traffic?.dangerDistance(train,Math.min(4000,range))??Infinity;
  if(Number.isFinite(danger)){
   const safe=speedEnvelope(0,Math.max(0,danger-30-v*2),gradeTo(danger),wet);
   if(safe<target){target=safe;constraint={distance:danger,kind:'signal',message:'Occupied block — prepare to stop'};}
  }
  if(mission?.target&&!mission.complete&&direction>0){
   const d=train.cursor.distanceTo(mission.target.edge,mission.target.s);
   const safe=speedEnvelope(0,Math.max(0,d-10-v*(2+train.cars*.12)),gradeTo(d),wet);
   if(d<range&&safe<target){target=safe;constraint={distance:d,kind:'station',message:`Approaching ${mission.target.name}`};}
  }
  this.guidance={...constraint,target:target*3.6,stoppingDistance:stop,brake:v>target+.6,comfort:Math.max(0,100-Math.abs(this.jerk)*22-Math.max(0,Math.abs(train.acceleration)-.65)*30)};
  if(train.derailed)this.guidance={...this.guidance,kind:'disabled',message:'Recover the train in Setup',brake:false};
 }
 get score(){return Math.round(clamp(100-(this.stats.overspeed*80+this.stats.harsh*30)/Math.max(30,this.stats.seconds),0,100));}
}

return {serviceStoppingDistance,speedEnvelope,cleanJourney,JourneyDirector};
})();
// ---- src/world-life.js ----
const __m_src_world_life_js = (() => {
const {Batch,Geometry,MeshBuilder,PRIMITIVES} = __m_src_geometry_js;
const {rng,hex,transform,add,mul,norm,sub,frameMatrix,mat4Mul,TAU,lerp} = __m_src_math_js;
/** Deterministic scenic animation. Nothing here mutates the rail connectivity graph. */


PRIMITIVES.birdWing=new Geometry([0,0,0,0,1,0,0,0,.90,.015,-.15,0,1,0,1,0,1.35,0,.36,0,1,0,1,1,.35,0,.21,0,1,0,0,1],[0,1,2,0,2,3]);
function flockPose(flock,time,index){
 const phase=flock.phase+index*.21,t=time*flock.speed+phase,r=flock.radius+index*3;
 return {position:[flock.x+Math.cos(t)*r,flock.y+Math.sin(t*.63+index)*5,flock.z+Math.sin(t)*r*.62],yaw:-t,flap:Math.sin(time*4.7+phase*3)*.43};
}
class WorldLife {
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
function shoreSegments(field,water){
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
function buildShoreline(world){
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

return {flockPose,WorldLife,shoreSegments,buildShoreline};
})();
// ---- src/cinematic-ui.js ----
const __m_src_cinematic_ui_js = (() => {
const {postOptions,LOOKS} = __m_src_postprocess_js;
const {cleanJourney} = __m_src_journey_js;


const $=id=>document.getElementById(id);
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function installCinematicUI(app){
 const photo=document.createElement('button');photo.id='photo-mode';photo.textContent='Studio';photo.title='Photo studio (F2)';photo.onclick=()=>togglePhotoMode(app);$('photo').after(photo);
 const journey=document.createElement('button');journey.id='journey-open';journey.textContent='Journey';journey.onclick=()=>app.ui.openPanel('journey');photo.after(journey);
 const coach=document.createElement('button');coach.id='driver-coach';coach.className='driver-coach';coach.setAttribute('aria-label','Open route guidance and journey telemetry');coach.innerHTML='<span id="coach-message">Route guidance</span><span class="coach-metrics"><b id="coach-stop">0 m</b> service stop <b id="coach-score">100</b> driving score</span>';coach.onclick=()=>app.ui.openPanel('journey');document.querySelector('.journey-card').append(coach);
 const studio=document.createElement('section');studio.id='photo-studio';studio.className='photo-studio glass hidden';studio.setAttribute('aria-label','Photo studio');
 studio.innerHTML=`<div class="studio-title"><span>PHOTO STUDIO <small>WASD · drag to look</small></span><button id="photo-exit" class="secondary">Exit · Esc</button></div><div class="studio-fields"><label>Lens <input id="photo-fov" type="range" min="24" max="90" step="1" value="56"></label><label>Exposure <input id="photo-exposure" type="range" min="0.5" max="1.8" step="0.01" value="1"></label><label>Look <select id="photo-look">${Object.keys(LOOKS).map(l=>`<option>${l}</option>`).join('')}</select></label><button class="primary" id="photo-capture">Capture PNG</button></div>`;
 document.body.append(studio);$('photo-exit').onclick=()=>togglePhotoMode(app,false);$('photo-capture').onclick=()=>app.photo();
 $('photo-fov').oninput=e=>app.camera.fov=Number(e.target.value);$('photo-exposure').oninput=e=>app.env.exposure=Number(e.target.value);
 $('photo-look').onchange=e=>{app.settings.cinematic.look=e.target.value;app.applySettings();};
}
/** Capture owned camera state without aliasing mutable vectors. */
function snapshotPhotoCamera(camera){
 const state={};
 for(const key of ['mode','fov','distance','azimuth','elevation','cabYaw','cabPitch','freeYaw','freePitch','photoOrbit'])state[key]=camera[key];
 for(const key of ['position','target','trackAnchor'])state[key]=camera[key]?camera[key].slice():null;
 return state;
}
function restorePhotoCamera(camera,state){
 camera.setMode(state.mode);
 for(const [key,value] of Object.entries(state))camera[key]=Array.isArray(value)?value.slice():value;
 camera.initial=true;
}
function togglePhotoMode(app,on=!app.photoMode){
 if(!app.ready||on===!!app.photoMode)return;
 if(on){
  if(app.ui.dialog.open)app.ui.closePanel();
  app.photoState={paused:app.paused,camera:snapshotPhotoCamera(app.camera)};app.paused=true;app.keys.clear();app.camera.setMode('free');app.photoMode=true;
  $('photo-fov').value=app.camera.fov;$('photo-exposure').value=app.env.exposure;$('photo-look').value=app.settings.cinematic.look;
 }else{
  app.photoMode=false;app.paused=app.photoState.paused;restorePhotoCamera(app.camera,app.photoState.camera);app.photoState=null;app.keys.clear();
 }
 document.body.classList.toggle('photo-mode',app.photoMode);$('photo-studio').classList.toggle('hidden',!app.photoMode);
 app.accumulator=0;app.ui.update();
}
function cinematicPanel(ui){
 const a=ui.app,s=a.settings,o=postOptions(s.cinematic);
 $('panel-content').innerHTML=`<div class="panel-two-column"><section class="panel-section"><h3>Lighting & display</h3><p class="map-note">Linear-light scene, multisample antialiasing, soft bloom and a single filmic display transform. The low quality preset omits bloom.</p><label class="field"><span>Color grade</span><select id="cin-look">${Object.keys(LOOKS).map(l=>`<option value="${l}" ${l===o.look?'selected':''}>${l}</option>`).join('')}</select></label>${ui.field('Bloom','cin-bloom',0,100,1,Math.round(o.bloom*100),'%')}${ui.field('Vignette','cin-vignette',0,60,1,Math.round(o.vignette*100),'%')}${ui.field('Film grain','cin-grain',0,15,1,Math.round(o.grain*100),'%')}<div class="panel-notice">Scene: <b>${a.renderer.post.hdr?'16-bit floating-point HDR':'LDR compatibility'}</b> · post passes: ${a.renderer.post.passCount} · renderer: ${a.renderer.kind}</div></section><section class="panel-section"><h3>Immersion & comfort</h3>${ui.toggle('Scenic wildlife','cin-wildlife',s.wildlife,'Deterministic flocks; no effect on train physics.')}${ui.toggle('Environmental audio','cin-ambience',s.ambience,'Weather and occasional birds. Train sounds remain independent.')}${ui.toggle('Camera motion','cin-motion',s.cameraMotion,'Subtle cab suspension. Disable for reduced motion.')}${ui.toggle('Driving coach','cin-coach',s.coach,'Read-only stopping guidance and route profile.')}<div class="button-row"><button class="primary" id="cin-studio">Open photo studio</button><button class="secondary" id="cin-journey">Journey telemetry</button></div><p class="map-note">F2 enters photo mode; Escape exits. Photo mode pauses the simulation and restores your previous camera and pause state. Color grade and exposure adjustments remain selected.</p></section></div>`;
 $('cin-look').onchange=e=>{s.cinematic.look=e.target.value;a.applySettings();};
 for(const key of ['bloom','vignette','grain'])ui.bindRange('cin-'+key,v=>{s.cinematic[key]=v/100;a.applySettings();},v=>v+'%');
 for(const [id,key] of [['wildlife','wildlife'],['ambience','ambience'],['motion','cameraMotion'],['coach','coach']])$('cin-'+id).onchange=e=>{s[key]=e.target.checked;a.applySettings();};
 $('cin-studio').onclick=()=>{ui.closePanel();togglePhotoMode(a,true);};$('cin-journey').onclick=()=>ui.openPanel('journey');
}
function journeyPanel(ui){
 const a=ui.app,j=a.journey;
 j.survey(a.player,a.world,a.env,a.currentLimit,a.mission);
 $('panel-content').innerHTML=`<section class="panel-section"><h3>Reading the railway</h3><p id="journey-guidance">${escape(j.guidance.message)}</p><canvas id="route-profile" width="1000" height="230" aria-label="Elevation and speed limits ahead"></canvas><p class="map-note">Solid line: terrain elevation along the railway. Dashed line: posted speed. Amber area: estimated service stopping distance. Distances are measured along your selected route, including the turnout.</p></section><div class="journey-stats"><div><b>${(j.stats.distance/1000).toFixed(2)}</b><span>km driven</span></div><div><b>${j.score}</b><span>driving score / 100</span></div><div><b>${Math.floor(j.stats.seconds/60)}</b><span>minutes driven</span></div><div><b>${j.stats.energy.toFixed(1)}</b><span>traction kWh</span></div><div><b>${j.stats.stops}</b><span>station door openings</span></div></div><div class="panel-notice">Advisory only. The stopping estimate includes train-length brake propagation, gradient and wet adhesion; it is not a guarantee. Automatic train protection remains independent. Score measures time spent overspeeding or driving harshly.</div><div class="button-row"><button class="primary" id="journey-continue">Return to cab</button><button class="secondary" id="journey-reset">Reset journey statistics</button><button class="secondary" id="journey-look">Display & immersion</button></div>`;
 drawProfile(a);$('journey-continue').onclick=()=>ui.closePanel();$('journey-look').onclick=()=>ui.openPanel('cinematic');
 $('journey-reset').onclick=()=>{a.journey.reset(cleanJourney());journeyPanel(ui);};
}
function drawProfile(app){
 const canvas=$('route-profile'),points=app.journey.profile;if(!canvas||!points.length)return;
 const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height,pad=38,range=points.at(-1).distance;
 const min=Math.min(...points.map(p=>p.height)),max=Math.max(...points.map(p=>p.height));c.clearRect(0,0,w,h);c.fillStyle='#152820';c.fillRect(0,0,w,h);
 const x=d=>pad+d/range*(w-pad*2),y=v=>h-pad-(v-min)/Math.max(15,max-min)*(h-pad*2);
 c.fillStyle='#d3ad6130';c.fillRect(pad,pad,Math.min(w-pad*2,app.journey.guidance.stoppingDistance/range*(w-pad*2)),h-pad*2);
 c.strokeStyle='#a6be9633';c.lineWidth=1;c.fillStyle='#b7c5ad';c.font='13px system-ui';
 for(let i=0;i<=4;i++){const xx=x(i*range/4);c.beginPath();c.moveTo(xx,pad);c.lineTo(xx,h-pad);c.stroke();c.fillText(Math.round(i*range/4)+' m',xx-15,h-12);}
 c.strokeStyle='#c9dcba';c.lineWidth=2.5;c.beginPath();points.forEach((p,i)=>i?c.lineTo(x(p.distance),y(p.height)):c.moveTo(x(p.distance),y(p.height)));c.stroke();
 c.setLineDash([7,5]);c.strokeStyle='#d1b080';c.lineWidth=1.5;c.beginPath();points.forEach((p,i)=>{const yy=h-pad-p.limit/app.player.stock.maxSpeed*(h-pad*2);i?c.lineTo(x(p.distance),yy):c.moveTo(x(p.distance),yy);});c.stroke();c.setLineDash([]);
 c.fillText(`${Math.round(max)} m elevation`,pad+8,22);
}
function updateCinematicUI(app){
 if(!$('driver-coach'))return;const j=app.journey,g=j.guidance;
 $('driver-coach').hidden=app.settings.coach===false;
 $('coach-message').textContent=g.brake?'Brake early · '+g.message:g.message;
 $('coach-stop').textContent=Math.round(g.stoppingDistance||0)+' m';$('coach-score').textContent=j.score;
 $('driver-coach').classList.toggle('braking-advice',!!g.brake);
}

return {installCinematicUI,snapshotPhotoCamera,restorePhotoCamera,togglePhotoMode,cinematicPanel,journeyPanel,drawProfile,updateCinematicUI};
})();
// ---- src/living-shaders.js ----
const __m_src_living_shaders_js = (() => {

/** Matched WebGPU/WebGL botanical silhouettes and world-space architectural materials. */
const LEAF_WGSL=/* wgsl */`
fn leafMask(uv:vec2f,needle:f32)->f32 {
 let p=uv-vec2f(.5);var mask=-1.;
 if(needle>.5){
  let width=(.5-abs(p.y))*.85;
  let tooth=abs(fract((p.y+abs(p.x)*.65)*17.)-.5);
  mask=min(width-abs(p.x),.16-tooth)*8.;mask=max(mask,(.018-abs(p.x))*15.);
 }else{
  for(var i=0;i<7;i++){
   let row=f32(i/2);let side=select(-1.,1.,i%2==0);let center=select(vec2f(side*.20,-.30+row*.19),vec2f(0,.34),i==6);
   let q=(p-center)/select(vec2f(.18,.145),vec2f(.13,.18),i==6);mask=max(mask,1.-dot(q,q));
  }
  mask=max(mask,(.009-abs(p.x))*20.);
 }
 return smoothstep(-.08,.13,mask);
}
fn canopyWind(p:vec3f,root:vec3f,local:vec3f,height:f32,uv:vec2f)->vec3f{
 let gust=sin(u.cameraTime.w*.85+root.x*.021+root.z*.017);
 let bend=local.y*local.y*height*.012*u.viewport.w;
 let flutter=sin(u.cameraTime.w*3.2+p.x*1.3+p.z*.9)*.035*uv.y*u.viewport.w;
 return p+vec3f(gust*bend+flutter,flutter*.24,cos(u.cameraTime.w*.71+root.z*.019)*bend*.52);
}
`;
const LEAF_GLSL=/* glsl */`
float leafMask(vec2 uv,float needle){
 vec2 p=uv-vec2(.5);float mask=-1.;
 if(needle>.5){float width=(.5-abs(p.y))*.85;float tooth=abs(fract((p.y+abs(p.x)*.65)*17.)-.5);mask=min(width-abs(p.x),.16-tooth)*8.;mask=max(mask,(.018-abs(p.x))*15.);}
 else{for(int i=0;i<7;i++){float row=float(i/2),side=i%2==0?1.:-1.;vec2 center=i==6?vec2(0,.34):vec2(side*.20,-.30+row*.19);vec2 q=(p-center)/(i==6?vec2(.13,.18):vec2(.18,.145));mask=max(mask,1.-dot(q,q));}mask=max(mask,(.009-abs(p.x))*20.);}
 return smoothstep(-.08,.13,mask);
}
vec3 canopyWind(vec3 p,vec3 root,vec3 local,float height,vec2 uv){float gust=sin(u.cameraTime.w*.85+root.x*.021+root.z*.017),bend=local.y*local.y*height*.012*u.viewport.w,flutter=sin(u.cameraTime.w*3.2+p.x*1.3+p.z*.9)*.035*uv.y*u.viewport.w;return p+vec3(gust*bend+flutter,flutter*.24,cos(u.cameraTime.w*.71+root.z*.019)*bend*.52);}
`;
const MATERIAL_WGSL=/* wgsl */`
 var coverage=1.;var glassAmount=0.;
 if(kind>10.5&&kind<11.5){coverage=leafMask(v.uv,v.props.z);if(coverage<.25){discard;}
  metal=0.;emissive=0.;rough=.89;let veins=.82+.18*abs(sin(v.uv.y*73.+v.uv.x*24.));
  col*=veins*(.80+.20*v.uv.y);n=normalize(n+vec3f(0,.15,0));
 }
 if(kind>11.5&&kind<12.5){
  emissive=0.;metal=0.;let grid=v.uv/vec2f(3.,3.2);let cell=fract(grid);let room=floor(grid);
  let modern=v.props.z>.5;let margin=select(.19,.065,modern);
  let win=step(margin,cell.x)*step(cell.x,1.-margin)*step(.21,cell.y)*step(cell.y,.84)*step(abs(n.y),.5);
  let pane=step(.017,abs(cell.x-.5))*step(.013,abs(cell.y-.53));
  let blinds=.62+.38*step(.07,fract(cell.y*14.));let seed=hash(room+floor(v.world.xz*.01)+vec2f(floor(v.props.w*4096.+.5)));
  let interior=mix(vec3f(.028,.043,.039),vec3f(.15,.12,.074),step(.58,seed));
  let brick=fract(vec2f(v.uv.x*2.+floor(v.uv.y*5.)*.5,v.uv.y*5.));let mortar=1.-step(.055,min(brick.x,brick.y));
  let wall=col*(.90+noise(v.world.xz*3.+vec2f(v.world.y))*.12)*(1.-mortar*.16);
  col=mix(wall,interior*blinds,win);col=mix(col,vec3f(.035,.05,.052),win*(1.-pane));
  let cornice=1.-smoothstep(.025,.065,abs(cell.y-.985));col*=1.-cornice*.28;
  glassAmount=win*pane;rough=mix(.88,.18,glassAmount);metal=glassAmount*.18;
  emissive=win*pane*step(.52,seed)*(1.-u.sunDay.w)*8.;
 }
 if(kind>12.5&&kind<13.5){
  let grit=noise(v.world.xz*18.);let wear=noise(v.world.xz*.24);col*=.72+grit*.35+wear*.12;
  let wet=u.env.y*(.4+.6*smoothstep(.35,.72,wear));rough=mix(.95,.2,wet);metal=.02;
 }
 if(kind>13.5&&kind<14.5){let tile=fract(v.uv*vec2f(2.,3.));let seam=1.-step(.07,min(tile.x,tile.y));col*=.92-seam*.22+noise(v.world.xz*2.)*.10;}
 if(kind>14.5&&kind<15.5){let ridge=noise(vec2f(v.uv.x*47.,v.uv.y*.04));col*=.6+ridge*.65;rough=.98;}
`;
const MATERIAL_GLSL=/* glsl */`
 float coverage=1.,glassAmount=0.;
 if(kind>10.5&&kind<11.5){coverage=leafMask(uv,props.z);if(coverage<.25)discard;metal=0.;emissive=0.;rough=.89;float veins=.82+.18*abs(sin(uv.y*73.+uv.x*24.));col*=veins*(.80+.20*uv.y);n=normalize(n+vec3(0,.15,0));}
 if(kind>11.5&&kind<12.5){
  emissive=0.;metal=0.;vec2 grid=uv/vec2(3.,3.2),cell=fract(grid),room=floor(grid);bool modern=props.z>.5;float margin=modern?.065:.19;
  float win=step(margin,cell.x)*step(cell.x,1.-margin)*step(.21,cell.y)*step(cell.y,.84)*step(abs(n.y),.5);
  float pane=step(.017,abs(cell.x-.5))*step(.013,abs(cell.y-.53));float blinds=.62+.38*step(.07,fract(cell.y*14.)),seed=hash(room+floor(world.xz*.01)+vec2(floor(props.w*4096.+.5)));
  vec3 interior=mix(vec3(.028,.043,.039),vec3(.15,.12,.074),step(.58,seed));vec2 brick=fract(vec2(uv.x*2.+floor(uv.y*5.)*.5,uv.y*5.));float mortar=1.-step(.055,min(brick.x,brick.y));
  vec3 wall=col*(.90+noise(world.xz*3.+world.y)*.12)*(1.-mortar*.16);col=mix(wall,interior*blinds,win);col=mix(col,vec3(.035,.05,.052),win*(1.-pane));
  float cornice=1.-smoothstep(.025,.065,abs(cell.y-.985));col*=1.-cornice*.28;glassAmount=win*pane;rough=mix(.88,.18,glassAmount);metal=glassAmount*.18;emissive=win*pane*step(.52,seed)*(1.-u.sunDay.w)*8.;
 }
 if(kind>12.5&&kind<13.5){float grit=noise(world.xz*18.),wear=noise(world.xz*.24);col*=.72+grit*.35+wear*.12;float wet=u.env.y*(.4+.6*smoothstep(.35,.72,wear));rough=mix(.95,.2,wet);metal=.02;}
 if(kind>13.5&&kind<14.5){vec2 tile=fract(uv*vec2(2.,3.));float seam=1.-step(.07,min(tile.x,tile.y));col*=.92-seam*.22+noise(world.xz*2.)*.10;}
 if(kind>14.5&&kind<15.5){float ridge=noise(vec2(uv.x*47.,uv.y*.04));col*=.6+ridge*.65;rough=.98;}
`;

return {LEAF_WGSL,LEAF_GLSL,MATERIAL_WGSL,MATERIAL_GLSL};
})();
// ---- src/shaders.js ----
const __m_src_shaders_js = (() => {
const {LEAF_WGSL,LEAF_GLSL,MATERIAL_WGSL,MATERIAL_GLSL} = __m_src_living_shaders_js;

const WGSL_COMMON = /* wgsl */`
struct Frame {
 vp: mat4x4f, invVP: mat4x4f, lightVP: mat4x4f,
 cameraTime: vec4f, sunDay: vec4f, sunExposure: vec4f, fog: vec4f,
 env: vec4f, headPos: vec4f, headDir: vec4f, ground: vec4f, rock: vec4f, viewport: vec4f,
};
@group(0) @binding(0) var<uniform> u: Frame;
fn hash(p:vec2f)->f32 { return fract(sin(dot(p,vec2f(127.1,311.7)))*43758.5453); }
fn noise(p:vec2f)->f32 {let i=floor(p); let a=fract(p);let f=a*a*(vec2f(3.)-2.*a);return mix(mix(hash(i),hash(i+vec2f(1,0)),f.x),mix(hash(i+vec2f(0,1)),hash(i+vec2f(1,1)),f.x),f.y);}
fn fbm(p0:vec2f)->f32 {var p=p0;var n=0.;var a=.5;for(var i=0;i<4;i++){n+=noise(p)*a;p=p*2.03+vec2f(13.4,7.1);a*=.5;}return n;}
fn aces(c:vec3f)->vec3f {return clamp(c,vec3f(0),vec3f(128));}
fn atmosphere(rd:vec3f,clouds:bool)->vec3f {
 let day=u.sunDay.w;let h=clamp(rd.y*.8+.18,0.,1.);let horizon=mix(vec3f(.018,.027,.055),pow(u.fog.rgb,vec3f(2.2))*.95,day);
 let zenith=mix(vec3f(.002,.005,.018),vec3f(.12,.30,.50),day);var sky=mix(horizon,zenith,pow(h,.6));
 let sun=max(0.,dot(rd,u.sunDay.xyz));sky+=u.sunExposure.rgb*(pow(sun,1400.)*5.+pow(sun,22.)*.12)*day;
 sky+=vec3f(.52,.21,.065)*pow(sun,9.)*(1.-smoothstep(.18,.55,u.sunDay.y))*day;
 if(clouds && rd.y>0.){let uv=rd.xz/max(.07,rd.y)*1.6+vec2f(u.cameraTime.w*.0018,0);let n=fbm(uv);let cloud=smoothstep(.63-u.env.x*.38,.76-u.env.x*.4,n)*smoothstep(0.,.14,rd.y);sky=mix(sky,mix(vec3f(.038,.052,.07),vec3f(.76,.78,.76),day)*( .65+n*.55),cloud*.92);}
 if(day<.25&&rd.y>.05){let star=pow(hash(floor(rd.xz/(rd.y+.5)*1100.)),1800.);sky+=vec3f(star*(1.-day*4.));}
 let moonDir=normalize(vec3f(-u.sunDay.x,.38,-u.sunDay.z));
 let moon=dot(rd,moonDir);sky+=vec3f(.40,.48,.63)*smoothstep(.9991,.9997,moon)*(1.-day);
 if(u.env.z>1.5&&u.env.z<2.5&&day<.3&&rd.y>.08){
  let curtain=sin(rd.x*8.+rd.z*5.+sin(rd.z*11.+u.cameraTime.w*.03)*.6);
  let ribbon=exp(-pow((rd.y-.34-curtain*.12)*12.,2.));
  sky+=mix(vec3f(.04,.33,.16),vec3f(.15,.05,.27),rd.y)*ribbon*(1.-day)*(.6+noise(rd.xz*75.)*.4);
 }
 return sky;
}
`;
const WGSL_SKY = WGSL_COMMON+/* wgsl */`
struct SkyOut {@builtin(position) position:vec4f,@location(0) ndc:vec2f};
@vertex fn vs(@builtin(vertex_index) i:u32)->SkyOut {var pts=array<vec2f,3>(vec2f(-1,-1),vec2f(3,-1),vec2f(-1,3));var o:SkyOut;o.position=vec4f(pts[i],.99999,1);o.ndc=pts[i];return o;}
@fragment fn fs(v:SkyOut)->@location(0) vec4f {let w=u.invVP*vec4f(v.ndc,1,1);let rd=normalize(w.xyz/w.w-u.cameraTime.xyz);return vec4f(aces(atmosphere(rd,true)),1);}
`;
const WGSL_VERTEX=/* wgsl */`
struct Vin {@location(0) p:vec3f,@location(1) n:vec3f,@location(2) uv:vec2f,@location(3) m0:vec4f,@location(4) m1:vec4f,@location(5) m2:vec4f,@location(6) m3:vec4f,@location(7) color:vec4f,@location(8) props:vec4f};
struct Vout {@builtin(position) position:vec4f,@location(0) world:vec3f,@location(1) normal:vec3f,@location(2) color:vec4f,@location(3) @interpolate(flat) props:vec4f,@location(4) uv:vec2f,@location(5) light:vec4f};
@vertex fn vs(v:Vin)->Vout {let m=mat4x4f(v.m0,v.m1,v.m2,v.m3);var p=m*vec4f(v.p,1);var o:Vout;
 if(v.props.x>4.5&&v.props.x<5.5){p.x+=sin(u.cameraTime.w*1.3+p.z*.08)*.13*u.viewport.w*max(0.,v.p.y);}
 if(v.props.x>10.5&&v.props.x<11.5){p=vec4f(canopyWind(p.xyz,v.m3.xyz,v.p,length(v.m1.xyz),v.uv),1.);}
 o.position=u.vp*p;o.world=p.xyz;o.normal=normalize(v.m0.xyz*v.n.x/max(.00001,dot(v.m0.xyz,v.m0.xyz))+v.m1.xyz*v.n.y/max(.00001,dot(v.m1.xyz,v.m1.xyz))+v.m2.xyz*v.n.z/max(.00001,dot(v.m2.xyz,v.m2.xyz)));o.color=v.color;o.props=v.props;o.uv=v.uv;if(v.props.x>11.5&&v.props.x<12.5){o.uv=v.uv*vec2f(select(length(v.m0.xyz),length(v.m2.xyz),abs(v.n.x)>.5),length(v.m1.xyz));}o.light=u.lightVP*p;return o;}
`;
const WGSL_MAIN = WGSL_COMMON+LEAF_WGSL+/* wgsl */`
@group(0) @binding(1) var shadow: texture_depth_2d;
@group(0) @binding(2) var shadowSampler: sampler_comparison;
`+WGSL_VERTEX+/* wgsl */`
fn shadeShadow(lp:vec4f,n:vec3f)->f32 {let p=lp.xyz/lp.w;let uv=p.xy*vec2f(.5,-.5)+vec2f(.5);if(any(uv<vec2f(.002))||any(uv>vec2f(.998))||p.z<0.||p.z>1.||u.headDir.w<.5){return 1.;}let bias=.00012+.00045*(1.-max(0.,dot(n,u.sunDay.xyz)));var s=0.;let size=vec2f(textureDimensions(shadow));for(var x=-1;x<=1;x++){for(var y=-1;y<=1;y++){s+=textureSampleCompareLevel(shadow,shadowSampler,uv+vec2f(f32(x),f32(y))/size,p.z-bias);}}return s/9.;}
@fragment fn fs(v:Vout)->@location(0) vec4f {
 var n=normalize(v.normal);let view=normalize(u.cameraTime.xyz-v.world);var col=pow(v.color.rgb,vec3f(2.2));let kind=v.props.x;var rough=v.props.y;var metal=v.props.z;var emissive=v.props.w;
`+MATERIAL_WGSL+/* wgsl */`
 if(kind>.5&&kind<1.5){
  let terrainNoise=fbm(v.world.xz*.0023);let moisture=clamp(v.uv.x,0.,1.);let drainage=clamp(v.uv.y,0.,1.);
  let blend=pow(abs(n),vec3f(4.));let weights=blend/max(dot(blend,vec3f(1.)),.001);
  let grain=noise(v.world.yz*.24)*weights.x+noise(v.world.xz*.24)*weights.y+noise(v.world.xy*.24)*weights.z;
  let detail=noise(v.world.xz*1.3);
  var grass=pow(u.ground.rgb,vec3f(2.2))*(.65+terrainNoise*.65+grain*.14);
  let dry=vec3f(.29,.235,.125);grass=mix(grass,dry,(1.-moisture)*.24);
  var rock=pow(u.rock.rgb,vec3f(2.2))*(.55+grain*.55+terrainNoise*.25);
  let slope=1.-max(0.,n.y);col=mix(grass,rock,smoothstep(.13,.45,slope));
  col=mix(col,rock*.80,drainage*smoothstep(.02,.22,slope)*.32);
  if(u.env.z>2.5&&u.env.z<3.5){
   let strata=.88+.08*sin(v.world.y*.31+terrainNoise*4.)+.045*sin(v.world.y*1.13);
   col=mix(grass*vec3f(1.08,.96,.8),rock,smoothstep(.07,.30,slope))*strata;
  }
  if(u.env.z>4.5&&u.env.z<5.5){col=mix(col,vec3f(.19,.11,.17),smoothstep(.51,.68,terrainNoise)*(1.-smoothstep(.05,.22,slope))*.3);}
  let shore=(1.-smoothstep(u.env.w+1.,u.env.w+12.,v.world.y))*(1.-smoothstep(.05,.28,slope));
  col=mix(col,vec3f(.30,.28,.20),shore*.65);col*=.94+detail*.12;
  let snow=smoothstep(u.viewport.z-65.,u.viewport.z+65.,v.world.y+(terrainNoise-.5)*110.)*smoothstep(.38,.72,n.y);
  col=mix(col,vec3f(.82,.85,.86),snow);col*=1.-u.env.y*.19;rough=.91;
  n=normalize(n+vec3f((noise(v.world.xz*.41)-.5)*.075,0.,(noise(v.world.zx*.53)-.5)*.075));
 }
 if(kind>5.5&&kind<6.5){col*=.89+noise((v.world.xz+vec2f(v.world.y*.71,v.world.y*.31))*5.)*.16;}
 if(kind>6.5&&kind<7.5){let grit=hash(floor(v.world.xz*23.));col*=.7+grit*.6;}
 let light=u.sunDay.xyz;let ndl=max(0.,dot(n,light));let visibility=shadeShadow(v.light,n);let hemi=mix(vec3f(.09,.105,.1),vec3f(.24,.30,.37),n.y*.5+.5)*mix(.12,1.,u.sunDay.w);
 let sun=u.sunExposure.rgb*ndl*visibility*u.sunDay.w*(2.6-u.env.x*.9);
 let halfV=normalize(light+view);let ndh=max(0.,dot(n,halfV));let r=max(.06,rough);let alpha=r*r;let a2=alpha*alpha;let den=ndh*ndh*(a2-1.)+1.;let D=a2/(3.14159*den*den+.0001);let F=mix(vec3f(.035),col,metal)+(vec3f(1.)-mix(vec3f(.035),col,metal))*pow(1.-max(0.,dot(halfV,view)),5.);let nv=max(.02,dot(n,view));let k=(r+1.)*(r+1.)/8.;
 let G=nv/(nv*(1.-k)+k)*ndl/max(.001,ndl*(1.-k)+k);
 let spec=F*D*G/max(.04,4.*nv*max(ndl,.02));
 let cloudShadow=mix(1.,.70,smoothstep(.42,.75,fbm(v.world.xz*.00032+u.cameraTime.w*.0015))*u.env.x);
 var color=col*hemi+((vec3f(1.)-F)*col*(1.-metal)/3.14159+spec)*sun*3.0*cloudShadow;
 if(kind>2.5&&kind<3.5){let refl=atmosphere(reflect(-view,n),false);let fr=.24+.65*pow(1.-max(0.,dot(n,view)),4.);color=mix(col*.4,refl,fr)+spec*sun*.35;}
 if(kind>1.5&&kind<2.5){let t=u.cameraTime.w;let wave=sin(v.world.x*.11+t*.9)*.05+sin(v.world.z*.17-t*.7)*.035; n=normalize(vec3f(wave,1.,cos(v.world.z*.09+t*.7)*.06));let fr=.04+.88*pow(1.-max(0.,dot(n,view)),4.);let reflection=atmosphere(reflect(-view,n),true);let sparkle=pow(max(0.,dot(reflect(-light,n),view)),170.)*u.sunDay.w*3.;color=mix(pow(v.color.rgb,vec3f(2.2))*(.6+ndl*.45),reflection,fr)+u.sunExposure.rgb*sparkle;}
 if(kind>4.5&&kind<5.5){color*=.7+noise(v.world.xz*3.1+vec2f(v.world.y*1.7))*.38;color+=col*max(0.,dot(-n,light))*.32*u.sunDay.w;}
 if(u.headPos.w>.01){let delta=v.world-u.headPos.xyz;let d=length(delta);let cone=smoothstep(.90,.982,dot(normalize(delta),u.headDir.xyz));color+=col*vec3f(1.,.91,.68)*cone*max(0.,dot(n,-normalize(delta)))*u.headPos.w/(1.+d*d*.008);}
 if(kind>8.5&&kind<9.5){let foam=.64+.36*noise(vec2f(v.world.x*1.2,v.world.y*.24+u.cameraTime.w*2.8));color=mix(color,vec3f(.64,.79,.82)*foam,.7);}
 if(kind>9.5&&kind<10.5){let crest=.65+.35*sin(v.world.x*.09+v.world.z*.12-u.cameraTime.w*1.2);color=mix(color,vec3f(.65,.79,.79),crest*.72);}
 if(kind>10.5&&kind<11.5){color+=col*pow(max(0.,dot(-view,light)),3.)*.42*u.sunDay.w*visibility;}
 if(glassAmount>0.){color=mix(color,atmosphere(reflect(-view,n),false)*.65,glassAmount*.45);}
 color+=col*emissive;
 let distance=length(v.world-u.cameraTime.xyz);let heightFog=exp(-max(v.world.y-u.env.w,0.)*.00085);let fog=1.-exp(-distance*u.fog.w*heightFog);color=mix(color,atmosphere(normalize(v.world-u.cameraTime.xyz),false),clamp(fog,0.,.99));
 return vec4f(aces(color),select(select(1.,v.color.a,kind>7.5),coverage,kind>10.5&&kind<11.5));
}
`;
const WGSL_SHADOW=WGSL_COMMON+LEAF_WGSL+/* wgsl */`
struct Vin {@location(0) p:vec3f,@location(2) uv:vec2f,@location(3) m0:vec4f,@location(4) m1:vec4f,@location(5) m2:vec4f,@location(6) m3:vec4f,@location(8) props:vec4f};
struct ShadowOut {@builtin(position) position:vec4f,@location(0) uv:vec2f,@location(1) @interpolate(flat) props:vec4f};
@vertex fn vs(v:Vin)->ShadowOut {var p=(mat4x4f(v.m0,v.m1,v.m2,v.m3)*vec4f(v.p,1)).xyz;
 if(v.props.x>10.5&&v.props.x<11.5){p=canopyWind(p,v.m3.xyz,v.p,length(v.m1.xyz),v.uv);}
 var o:ShadowOut;o.position=u.lightVP*vec4f(p,1);o.uv=v.uv;o.props=v.props;return o;}
@fragment fn fs(v:ShadowOut){if(v.props.x>10.5&&v.props.x<11.5&&leafMask(v.uv,v.props.z)<.45){discard;}}
`;
/** GLSL ES 3.0 fallback deliberately shares the same material model and frame layout. */
const GLSL_COMMON=/* glsl */`
precision highp float;
layout(std140) uniform Frame {mat4 vp;mat4 invVP;mat4 lightVP;vec4 cameraTime;vec4 sunDay;vec4 sunExposure;vec4 fog;vec4 env;vec4 headPos;vec4 headDir;vec4 ground;vec4 rock;vec4 viewport;} u;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),a=fract(p),f=a*a*(3.-2.*a);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float n=0.,a=.5;for(int i=0;i<4;i++){n+=noise(p)*a;p=p*2.03+vec2(13.4,7.1);a*=.5;}return n;}
vec3 aces(vec3 c){
#ifdef RAILBOUND_LDR_SCENE
 vec3 x=max(c*u.sunExposure.w,vec3(0));return pow(clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.),vec3(1./2.2));
#else
 return clamp(c,0.,128.);
#endif
}
vec3 atmosphere(vec3 rd,bool clouds){float day=u.sunDay.w,h=clamp(rd.y*.8+.18,0.,1.);vec3 horizon=mix(vec3(.018,.027,.055),pow(u.fog.rgb,vec3(2.2))*.95,day),zenith=mix(vec3(.002,.005,.018),vec3(.12,.30,.50),day);vec3 sky=mix(horizon,zenith,pow(h,.6));float sun=max(0.,dot(rd,u.sunDay.xyz));sky+=u.sunExposure.rgb*(pow(sun,1400.)*5.+pow(sun,22.)*.12)*day;sky+=vec3(.52,.21,.065)*pow(sun,9.)*(1.-smoothstep(.18,.55,u.sunDay.y))*day;
 if(clouds&&rd.y>0.){vec2 uv=rd.xz/max(.07,rd.y)*1.6+vec2(u.cameraTime.w*.0018,0);float n=fbm(uv),cloud=smoothstep(.63-u.env.x*.38,.76-u.env.x*.4,n)*smoothstep(0.,.14,rd.y);sky=mix(sky,mix(vec3(.038,.052,.07),vec3(.76,.78,.76),day)*(.65+n*.55),cloud*.92);}if(day<.25&&rd.y>.05){float star=pow(hash(floor(rd.xz/(rd.y+.5)*1100.)),1800.);sky+=vec3(star*(1.-day*4.));}vec3 moonDir=normalize(vec3(-u.sunDay.x,.38,-u.sunDay.z));float moon=dot(rd,moonDir);sky+=vec3(.40,.48,.63)*smoothstep(.9991,.9997,moon)*(1.-day);if(u.env.z>1.5&&u.env.z<2.5&&day<.3&&rd.y>.08){float curtain=sin(rd.x*8.+rd.z*5.+sin(rd.z*11.+u.cameraTime.w*.03)*.6),ribbon=exp(-pow((rd.y-.34-curtain*.12)*12.,2.));sky+=mix(vec3(.04,.33,.16),vec3(.15,.05,.27),rd.y)*ribbon*(1.-day)*(.6+noise(rd.xz*75.)*.4);}return sky;}
`;
const GLSL_SKY_VS=`#version 300 es
precision highp float;out vec2 ndc;void main(){vec2 p=gl_VertexID==0?vec2(-1,-1):gl_VertexID==1?vec2(3,-1):vec2(-1,3);ndc=p;gl_Position=vec4(p,.99999,1);}`;
const GLSL_SKY_FS=`#version 300 es\n`+GLSL_COMMON+`in vec2 ndc;out vec4 outColor;void main(){vec4 w=u.invVP*vec4(ndc,1,1);vec3 rd=normalize(w.xyz/w.w-u.cameraTime.xyz);outColor=vec4(aces(atmosphere(rd,true)),1);}`;
const GLSL_MAIN_VS=`#version 300 es\n`+GLSL_COMMON+LEAF_GLSL+`
layout(location=0) in vec3 aPos;layout(location=1) in vec3 aNormal;layout(location=2) in vec2 aUV;layout(location=3) in mat4 model;layout(location=7) in vec4 tint;layout(location=8) in vec4 params;
out vec3 world;out vec3 normal;out vec4 color;flat out vec4 props;out vec2 uv;out vec4 lightPos;
void main(){vec4 p=model*vec4(aPos,1);if(params.x>4.5&&params.x<5.5)p.x+=sin(u.cameraTime.w*1.3+p.z*.08)*.13*u.viewport.w*max(0.,aPos.y);if(params.x>10.5&&params.x<11.5)p=vec4(canopyWind(p.xyz,model[3].xyz,aPos,length(model[1].xyz),aUV),1.);gl_Position=u.vp*p;world=p.xyz;normal=normalize(model[0].xyz*aNormal.x/max(.00001,dot(model[0].xyz,model[0].xyz))+model[1].xyz*aNormal.y/max(.00001,dot(model[1].xyz,model[1].xyz))+model[2].xyz*aNormal.z/max(.00001,dot(model[2].xyz,model[2].xyz)));color=tint;props=params;uv=aUV;if(params.x>11.5&&params.x<12.5)uv*=vec2(abs(aNormal.x)>.5?length(model[2].xyz):length(model[0].xyz),length(model[1].xyz));lightPos=u.lightVP*p;}`;
const GLSL_MAIN_FS=`#version 300 es\n`+GLSL_COMMON+LEAF_GLSL+`
precision highp sampler2DShadow;uniform sampler2DShadow shadowTex;in vec3 world;in vec3 normal;in vec4 color;flat in vec4 props;in vec2 uv;in vec4 lightPos;out vec4 outColor;
float shadeShadow(vec4 lp,vec3 n){vec3 p=lp.xyz/lp.w;vec2 uv=p.xy*.5+.5;float z=p.z*.5+.5;if(any(lessThan(uv,vec2(.002)))||any(greaterThan(uv,vec2(.998)))||z<0.||z>1.||u.headDir.w<.5)return 1.;float bias=.00012+.00045*(1.-max(0.,dot(n,u.sunDay.xyz)));float s=0.;vec2 size=vec2(textureSize(shadowTex,0));for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)s+=texture(shadowTex,vec3(uv+vec2(float(x),float(y))/size,z-bias));return s/9.;}
void main(){vec3 n=normalize(normal),view=normalize(u.cameraTime.xyz-world),col=pow(color.rgb,vec3(2.2));float kind=props.x,rough=props.y,metal=props.z,emissive=props.w;
`+MATERIAL_GLSL+/* glsl */`
 if(kind>.5&&kind<1.5){
  float terrainNoise=fbm(world.xz*.0023);float moisture=clamp(uv.x,0.,1.);float drainage=clamp(uv.y,0.,1.);
  vec3 blend=pow(abs(n),vec3(4.));vec3 weights=blend/max(dot(blend,vec3(1.)),.001);
  float grain=noise(world.yz*.24)*weights.x+noise(world.xz*.24)*weights.y+noise(world.xy*.24)*weights.z;
  float detail=noise(world.xz*1.3);
  vec3 grass=pow(u.ground.rgb,vec3(2.2))*(.65+terrainNoise*.65+grain*.14);
  vec3 dry=vec3(.29,.235,.125);grass=mix(grass,dry,(1.-moisture)*.24);
  vec3 rock=pow(u.rock.rgb,vec3(2.2))*(.55+grain*.55+terrainNoise*.25);
  float slope=1.-max(0.,n.y);col=mix(grass,rock,smoothstep(.13,.45,slope));
  col=mix(col,rock*.80,drainage*smoothstep(.02,.22,slope)*.32);
  if(u.env.z>2.5&&u.env.z<3.5){
   float strata=.88+.08*sin(world.y*.31+terrainNoise*4.)+.045*sin(world.y*1.13);
   col=mix(grass*vec3(1.08,.96,.8),rock,smoothstep(.07,.30,slope))*strata;
  }
  if(u.env.z>4.5&&u.env.z<5.5){col=mix(col,vec3(.19,.11,.17),smoothstep(.51,.68,terrainNoise)*(1.-smoothstep(.05,.22,slope))*.3);}
  float shore=(1.-smoothstep(u.env.w+1.,u.env.w+12.,world.y))*(1.-smoothstep(.05,.28,slope));
  col=mix(col,vec3(.30,.28,.20),shore*.65);col*=.94+detail*.12;
  float snow=smoothstep(u.viewport.z-65.,u.viewport.z+65.,world.y+(terrainNoise-.5)*110.)*smoothstep(.38,.72,n.y);
  col=mix(col,vec3(.82,.85,.86),snow);col*=1.-u.env.y*.19;rough=.91;
  n=normalize(n+vec3((noise(world.xz*.41)-.5)*.075,0.,(noise(world.zx*.53)-.5)*.075));
 }
 if(kind>5.5&&kind<6.5)col*=.89+noise((world.xz+vec2(world.y*.71,world.y*.31))*5.)*.16;
 if(kind>6.5&&kind<7.5)col*=.7+hash(floor(world.xz*23.))*.6;
 vec3 light=u.sunDay.xyz;float ndl=max(0.,dot(n,light)),visibility=shadeShadow(lightPos,n);vec3 hemi=mix(vec3(.09,.105,.1),vec3(.24,.30,.37),n.y*.5+.5)*mix(.12,1.,u.sunDay.w);vec3 sun=u.sunExposure.rgb*ndl*visibility*u.sunDay.w*(2.6-u.env.x*.9);vec3 halfV=normalize(light+view);float ndh=max(0.,dot(n,halfV)),r=max(.06,rough),alpha=r*r,a2=alpha*alpha,den=ndh*ndh*(a2-1.)+1.,D=a2/(3.14159*den*den+.0001);vec3 F=mix(vec3(.035),col,metal)+(1.-mix(vec3(.035),col,metal))*pow(1.-max(0.,dot(halfV,view)),5.);float nv=max(.02,dot(n,view)),k=(r+1.)*(r+1.)/8.,G=nv/(nv*(1.-k)+k)*ndl/max(.001,ndl*(1.-k)+k);vec3 spec=F*D*G/max(.04,4.*nv*max(ndl,.02));float cloudShadow=mix(1.,.70,smoothstep(.42,.75,fbm(world.xz*.00032+u.cameraTime.w*.0015))*u.env.x);vec3 result=col*hemi+((vec3(1.)-F)*col*(1.-metal)/3.14159+spec)*sun*3.0*cloudShadow;
 if(kind>2.5&&kind<3.5){vec3 refl=atmosphere(reflect(-view,n),false);float fr=.24+.65*pow(1.-max(0.,dot(n,view)),4.);result=mix(col*.4,refl,fr)+spec*sun*.35;}
 if(kind>1.5&&kind<2.5){float t=u.cameraTime.w,wave=sin(world.x*.11+t*.9)*.05+sin(world.z*.17-t*.7)*.035;n=normalize(vec3(wave,1.,cos(world.z*.09+t*.7)*.06));float fr=.04+.88*pow(1.-max(0.,dot(n,view)),4.);vec3 reflection=atmosphere(reflect(-view,n),true);float sparkle=pow(max(0.,dot(reflect(-light,n),view)),170.)*u.sunDay.w*3.;result=mix(pow(color.rgb,vec3(2.2))*(.6+ndl*.45),reflection,fr)+u.sunExposure.rgb*sparkle;}
 if(kind>4.5&&kind<5.5){result*=.7+noise(world.xz*3.1+vec2(world.y*1.7))*.38;result+=col*max(0.,dot(-n,light))*.32*u.sunDay.w;}
 if(u.headPos.w>.01){vec3 delta=world-u.headPos.xyz;float d=length(delta),cone=smoothstep(.90,.982,dot(normalize(delta),u.headDir.xyz));result+=col*vec3(1.,.91,.68)*cone*max(0.,dot(n,-normalize(delta)))*u.headPos.w/(1.+d*d*.008);}
 if(kind>8.5&&kind<9.5){float foam=.64+.36*noise(vec2(world.x*1.2,world.y*.24+u.cameraTime.w*2.8));result=mix(result,vec3(.64,.79,.82)*foam,.7);}
 if(kind>9.5&&kind<10.5){float crest=.65+.35*sin(world.x*.09+world.z*.12-u.cameraTime.w*1.2);result=mix(result,vec3(.65,.79,.79),crest*.72);}
 if(kind>10.5&&kind<11.5)result+=col*pow(max(0.,dot(-view,light)),3.)*.42*u.sunDay.w*visibility;
 if(glassAmount>0.)result=mix(result,atmosphere(reflect(-view,n),false)*.65,glassAmount*.45);
 result+=col*emissive;float distance=length(world-u.cameraTime.xyz),heightFog=exp(-max(world.y-u.env.w,0.)*.00085),f=1.-exp(-distance*u.fog.w*heightFog);result=mix(result,atmosphere(normalize(world-u.cameraTime.xyz),false),clamp(f,0.,.99));outColor=vec4(aces(result),kind>10.5&&kind<11.5?coverage:(kind>7.5?color.a:1.));}`;
const GLSL_SHADOW_VS=`#version 300 es\n`+GLSL_COMMON+LEAF_GLSL+`
layout(location=0) in vec3 aPos;layout(location=2) in vec2 aUV;layout(location=3) in mat4 model;layout(location=8) in vec4 params;
out vec2 uv;flat out vec4 props;void main(){vec3 p=(model*vec4(aPos,1)).xyz;if(params.x>10.5&&params.x<11.5)p=canopyWind(p,model[3].xyz,aPos,length(model[1].xyz),aUV);gl_Position=u.lightVP*vec4(p,1);uv=aUV;props=params;}`;
const GLSL_SHADOW_FS=`#version 300 es\n`+GLSL_COMMON+LEAF_GLSL+`in vec2 uv;flat in vec4 props;void main(){if(props.x>10.5&&props.x<11.5&&leafMask(uv,props.z)<.45)discard;}`;

return {WGSL_COMMON,WGSL_SKY,WGSL_VERTEX,WGSL_MAIN,WGSL_SHADOW,GLSL_COMMON,GLSL_SKY_VS,GLSL_SKY_FS,GLSL_MAIN_VS,GLSL_MAIN_FS,GLSL_SHADOW_VS,GLSL_SHADOW_FS};
})();
// ---- src/renderer.js ----
const __m_src_renderer_js = (() => {
const {PostProcessor,targetSize} = __m_src_postprocess_js;
const {mat4Mul,mat4Inverse,perspective,lookAt,orthographic,add,mul,norm,sub,length,dot,hex,clamp,smooth} = __m_src_math_js;
const {WEATHER} = __m_src_data_js;
const {WGSL_MAIN,WGSL_SKY,WGSL_SHADOW,GLSL_MAIN_VS,GLSL_MAIN_FS,GLSL_SKY_VS,GLSL_SKY_FS,GLSL_SHADOW_VS,GLSL_SHADOW_FS} = __m_src_shaders_js;




const VERTEX_LAYOUT=[{arrayStride:32,attributes:[{shaderLocation:0,offset:0,format:'float32x3'},{shaderLocation:1,offset:12,format:'float32x3'},{shaderLocation:2,offset:24,format:'float32x2'}]},{arrayStride:96,stepMode:'instance',attributes:Array.from({length:6},(_,i)=>({shaderLocation:3+i,offset:i*16,format:'float32x4'}))}];
class Renderer {
 constructor(canvas,onError=console.error){this.canvas=canvas;this.onError=onError;this.kind='Starting';this.frame=new Float32Array(88);this.drawCalls=0;this.triangles=0;this.shadowSize=1536;this.width=0;this.height=0;this.samples=4;this.lost=false;this.geometries=new Set();this.batches=new Set();this.settings={quality:'high',shadows:true,resolution:1};this.lastError=null;this.post=new PostProcessor();this.sceneFormat='rgba16float';}
 async initialize(forceGL=false){if(!forceGL&&navigator.gpu&&globalThis.isSecureContext){try{await this.initGPU();return;}catch(e){console.warn('WebGPU initialization failed; trying WebGL 2.',e);this.lastError=e.message;if(this.device){this.device.destroy();this.device=null;}if(this.context){this.context.unconfigure();const next=this.canvas.cloneNode();this.canvas.replaceWith(next);this.canvas=next;this.context=null;}}this.post.dispose();this.post=new PostProcessor();}this.initGL();}
 async initGPU(){const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});if(!adapter)throw new Error('No WebGPU adapter available.');this.device=await adapter.requestDevice();const d=this.device;this.device.lost.then(info=>{if(info.reason==='destroyed')return;this.lost=true;this.onError(`Graphics device lost: ${info.message||info.reason}. Reload to recover.`);});d.addEventListener('uncapturederror',e=>{console.error(e.error);this.onError(e.error.message);});this.context=this.canvas.getContext('webgpu');if(!this.context)throw new Error('WebGPU canvas context unavailable');this.format=navigator.gpu.getPreferredCanvasFormat();this.context.configure({device:d,format:this.format,alphaMode:'opaque'});await this.post.initGPU(d,this.format);
  this.uniform=d.createBuffer({size:this.frame.byteLength,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
  this.shadowTexture=d.createTexture({size:[this.shadowSize,this.shadowSize],format:'depth32float',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING});this.shadowView=this.shadowTexture.createView();this.sampler=d.createSampler({compare:'less-equal',magFilter:'linear',minFilter:'linear'});
  const basicLayout=d.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:'uniform'}}]});
  const mainLayout=d.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:'uniform'}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:'depth'}},{binding:2,visibility:GPUShaderStage.FRAGMENT,sampler:{type:'comparison'}}]});
  this.basicGroup=d.createBindGroup({layout:basicLayout,entries:[{binding:0,resource:{buffer:this.uniform}}]});this.mainGroup=d.createBindGroup({layout:mainLayout,entries:[{binding:0,resource:{buffer:this.uniform}},{binding:1,resource:this.shadowView},{binding:2,resource:this.sampler}]});
  const modules=[];for(const code of [WGSL_MAIN,WGSL_SKY,WGSL_SHADOW]){const module=d.createShaderModule({code});const info=await module.getCompilationInfo();const errors=info.messages.filter(m=>m.type==='error');if(errors.length)throw new Error(errors.map(m=>`${m.lineNum}:${m.linePos} ${m.message}`).join('\n'));modules.push(module);}
  const mainPipelineLayout=d.createPipelineLayout({bindGroupLayouts:[mainLayout]}),basicPipelineLayout=d.createPipelineLayout({bindGroupLayouts:[basicLayout]});
  this.pipeline=await d.createRenderPipelineAsync({layout:mainPipelineLayout,vertex:{module:modules[0],entryPoint:'vs',buffers:VERTEX_LAYOUT},fragment:{module:modules[0],entryPoint:'fs',targets:[{format:this.sceneFormat}]},primitive:{topology:'triangle-list',cullMode:'none'},depthStencil:{format:'depth32float',depthWriteEnabled:true,depthCompare:'less'},multisample:{count:this.samples}});
  this.foliagePipeline=await d.createRenderPipelineAsync({layout:mainPipelineLayout,vertex:{module:modules[0],entryPoint:'vs',buffers:VERTEX_LAYOUT},fragment:{module:modules[0],entryPoint:'fs',targets:[{format:this.sceneFormat}]},primitive:{topology:'triangle-list',cullMode:'none'},depthStencil:{format:'depth32float',depthWriteEnabled:true,depthCompare:'less'},multisample:{count:this.samples,alphaToCoverageEnabled:true}});
  this.particlePipeline=await d.createRenderPipelineAsync({layout:mainPipelineLayout,vertex:{module:modules[0],entryPoint:'vs',buffers:VERTEX_LAYOUT},fragment:{module:modules[0],entryPoint:'fs',targets:[{format:this.sceneFormat,blend:{color:{srcFactor:'src-alpha',dstFactor:'one-minus-src-alpha'},alpha:{srcFactor:'one',dstFactor:'one-minus-src-alpha'}}}]},primitive:{topology:'triangle-list',cullMode:'none'},depthStencil:{format:'depth32float',depthWriteEnabled:false,depthCompare:'less'},multisample:{count:this.samples}});
  this.skyPipeline=await d.createRenderPipelineAsync({layout:basicPipelineLayout,vertex:{module:modules[1],entryPoint:'vs'},fragment:{module:modules[1],entryPoint:'fs',targets:[{format:this.sceneFormat}]},primitive:{topology:'triangle-list'},depthStencil:{format:'depth32float',depthWriteEnabled:false,depthCompare:'always'},multisample:{count:this.samples}});
  this.shadowPipeline=await d.createRenderPipelineAsync({layout:basicPipelineLayout,vertex:{module:modules[2],entryPoint:'vs',buffers:VERTEX_LAYOUT},fragment:{module:modules[2],entryPoint:'fs',targets:[]},primitive:{topology:'triangle-list',cullMode:'none'},depthStencil:{format:'depth32float',depthWriteEnabled:true,depthCompare:'less',depthBias:1,depthBiasSlopeScale:1.5}});
  this.kind='WebGPU';this.adapterInfo=adapter.info?`${adapter.info.vendor||''} ${adapter.info.architecture||''}`.trim():'WebGPU adapter';
 }
 initGL(){const g=this.canvas.getContext('webgl2',{alpha:false,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:true});if(!g)throw new Error('This browser does not expose WebGPU or WebGL 2. Enable hardware acceleration and reload.');this.gl=g;this.kind='WebGL 2';this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;this.onError('Graphics context lost. Reload to recover.');});
  this.post.initGL(g,(vs,fs)=>this.compileGL(vs,fs));const compatible=s=>this.post.hdr?s:s.replace('#version 300 es','#version 300 es\n#define RAILBOUND_LDR_SCENE');this.glMain=this.compileGL(GLSL_MAIN_VS,compatible(GLSL_MAIN_FS));this.glSky=this.compileGL(GLSL_SKY_VS,compatible(GLSL_SKY_FS));this.glShadow=this.compileGL(GLSL_SHADOW_VS,GLSL_SHADOW_FS);
  this.uniform=g.createBuffer();g.bindBuffer(g.UNIFORM_BUFFER,this.uniform);g.bufferData(g.UNIFORM_BUFFER,this.frame.byteLength,g.DYNAMIC_DRAW);g.bindBufferBase(g.UNIFORM_BUFFER,0,this.uniform);
  for(const program of [this.glMain,this.glSky,this.glShadow]){const index=g.getUniformBlockIndex(program,'Frame');if(index!==g.INVALID_INDEX)g.uniformBlockBinding(program,index,0);}
  this.shadowTexture=g.createTexture();g.bindTexture(g.TEXTURE_2D,this.shadowTexture);g.texImage2D(g.TEXTURE_2D,0,g.DEPTH_COMPONENT24,this.shadowSize,this.shadowSize,0,g.DEPTH_COMPONENT,g.UNSIGNED_INT,null);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_COMPARE_MODE,g.COMPARE_REF_TO_TEXTURE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_COMPARE_FUNC,g.LEQUAL);
  this.shadowFB=g.createFramebuffer();g.bindFramebuffer(g.FRAMEBUFFER,this.shadowFB);g.framebufferTexture2D(g.FRAMEBUFFER,g.DEPTH_ATTACHMENT,g.TEXTURE_2D,this.shadowTexture,0);g.drawBuffers([g.NONE]);g.readBuffer(g.NONE);if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE)throw new Error('Shadow framebuffer unavailable');g.bindFramebuffer(g.FRAMEBUFFER,null);
  g.useProgram(this.glMain);g.uniform1i(g.getUniformLocation(this.glMain,'shadowTex'),0);g.enable(g.DEPTH_TEST);g.disable(g.CULL_FACE);this.emptyVAO=g.createVertexArray();
 }
 compileGL(vs,fs){const g=this.gl,p=g.createProgram();for(const [type,source] of [[g.VERTEX_SHADER,vs],[g.FRAGMENT_SHADER,fs]]){const s=g.createShader(type);g.shaderSource(s,source);g.compileShader(s);if(!g.getShaderParameter(s,g.COMPILE_STATUS))throw new Error(g.getShaderInfoLog(s));g.attachShader(p,s);g.deleteShader(s);}g.linkProgram(p);if(!g.getProgramParameter(p,g.LINK_STATUS))throw new Error(g.getProgramInfoLog(p));return p;}
 resize(){const rect=this.canvas.getBoundingClientRect();const scale=Math.min(globalThis.devicePixelRatio||1,this.settings.quality==='ultra'?2:1.5)*this.settings.resolution;const max=this.device?.limits.maxTextureDimension2D||4096;const [w,h]=targetSize(rect.width,rect.height,scale,max);if(w===this.width&&h===this.height)return;this.width=this.canvas.width=w;this.height=this.canvas.height=h;this.post.resize(w,h);if(this.device){this.colorMSAA?.destroy();this.depth?.destroy();this.colorMSAA=this.device.createTexture({size:[w,h],format:this.sceneFormat,sampleCount:this.samples,usage:GPUTextureUsage.RENDER_ATTACHMENT});this.depth=this.device.createTexture({size:[w,h],format:'depth32float',sampleCount:this.samples,usage:GPUTextureUsage.RENDER_ATTACHMENT});}}
 updateUniforms(camera,world,env,train,time){const gpu=this.kind==='WebGPU',fov=(camera.fov||56)*Math.PI/180;this.vp=mat4Mul(perspective(fov,this.width/this.height,.15,15000,gpu),lookAt(camera.position,camera.target));this.frame.set(this.vp,0);this.frustum=[];for(const [axis,sign] of [[0,1],[0,-1],[1,1],[1,-1],[2,-1]]){const plane=[this.vp[3]+sign*this.vp[axis],this.vp[7]+sign*this.vp[4+axis],this.vp[11]+sign*this.vp[8+axis],this.vp[15]+sign*this.vp[12+axis]],n=Math.hypot(plane[0],plane[1],plane[2]);this.frustum.push(plane.map(x=>x/n));}this.frame.set(mat4Inverse(this.vp),16);
  const angle=(env.hour-6)/24*Math.PI*2;const altitude=Math.sin(angle);const day=smooth(-.13,.16,altitude);const sun=norm([Math.cos(angle)*.72,Math.max(.08,altitude),.38]);const target=train&&camera.mode!=='free'?train.cursor.pose(-train.length*.32).p:camera.target;const shadowTarget=[Math.round(target[0]),target[1],Math.round(target[2])];this.shadowCenter=shadowTarget;
  const lightVP=mat4Mul(orthographic(-230,230,-230,230,1,1700,gpu),lookAt(add(shadowTarget,mul(sun,800)),shadowTarget));this.frame.set(lightVP,32);this.frame.set([...camera.position,time],48);this.frame.set([...sun,day],52);const warm=1-smooth(.08,.65,altitude);this.frame.set([1,.98-warm*.13,.90-warm*.26,env.exposure||1],56);const w=WEATHER[env.weather]||WEATHER.clear;this.frame.set([...hex(world.sky).slice(0,3),w.fog],60);this.frame.set([w.cloud,w.wet,['alpine','coast','nordic','canyon','sakura','highland','pine','metro'].indexOf(world.theme),world.water],64);
  if(train){const head=train.cursor.pose(train.stock.locoLength*.5);this.frame.set([head.p[0],head.p[1]+2.4,head.p[2],train.controls.headlights?14:0],68);this.frame.set([...head.f,this.settings.shadows?1:0],72);}else{this.frame.set([0,0,0,0],68);this.frame.set([0,0,1,this.settings.shadows?1:0],72);}
  this.frame.set(hex(world.ground),76);this.frame.set(hex(world.rock),80);this.frame.set([this.width,this.height,env.weather==='snow'?world.railY-15:world.snowLine,w.wind],84);
 }
 visible(b,camera,shadow=false){if(!b.count)return false;if(shadow){return b.castShadow&&length(sub(b.center,this.shadowCenter))<b.radius+340;}const delta=sub(b.center,camera.position),dist=length(delta);if(this.frustum.some(p=>p[0]*b.center[0]+p[1]*b.center[1]+p[2]*b.center[2]+p[3]<-b.radius))return false;const qualityRange=this.settings.quality==='low'?.62:this.settings.quality==='medium'?.8:1;const limit=b.maxDistance<9000?b.maxDistance*qualityRange:b.maxDistance;if(dist>b.radius+limit)return false;if(dist>b.radius+30){const facing=dot(delta,norm(sub(camera.target,camera.position)));if(facing< -b.radius)return false;}return true;}
 ensureGPU(b){const d=this.device,geo=b.geometry;if(!geo.gpu){const vb=d.createBuffer({size:geo.vertices.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),ib=d.createBuffer({size:geo.indices.byteLength,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});d.queue.writeBuffer(vb,0,geo.vertices);d.queue.writeBuffer(ib,0,geo.indices);geo.gpu={vb,ib};this.geometries.add(geo);}const bytes=b.count*96;if(!b.gpuBuffer||b.capacity<bytes){b.gpuBuffer?.destroy();b.capacity=Math.max(96,bytes*2);b.gpuBuffer=d.createBuffer({size:b.capacity,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});b.dirty=true;this.batches.add(b);}if(b.dirty&&bytes){d.queue.writeBuffer(b.gpuBuffer,0,b.data.buffer,b.data.byteOffset,bytes);b.dirty=false;}}
 ensureGL(b){const g=this.gl,geo=b.geometry;if(!geo.gl){const vb=g.createBuffer(),ib=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,vb);g.bufferData(g.ARRAY_BUFFER,geo.vertices,g.STATIC_DRAW);g.bindBuffer(g.ELEMENT_ARRAY_BUFFER,ib);g.bufferData(g.ELEMENT_ARRAY_BUFFER,geo.indices,g.STATIC_DRAW);geo.gl={vb,ib};this.geometries.add(geo);}const bytes=b.count*96;if(!b.glBuffer||b.capacity<bytes){if(b.glBuffer)g.deleteBuffer(b.glBuffer);if(b.vao)g.deleteVertexArray(b.vao);b.glBuffer=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,b.glBuffer);b.capacity=Math.max(96,bytes*2);g.bufferData(g.ARRAY_BUFFER,b.capacity,b.dynamic?g.DYNAMIC_DRAW:g.STATIC_DRAW);b.dirty=true;b.vao=g.createVertexArray();g.bindVertexArray(b.vao);g.bindBuffer(g.ARRAY_BUFFER,geo.gl.vb);for(const [loc,size,offset] of [[0,3,0],[1,3,12],[2,2,24]]){g.enableVertexAttribArray(loc);g.vertexAttribPointer(loc,size,g.FLOAT,false,32,offset);}g.bindBuffer(g.ARRAY_BUFFER,b.glBuffer);for(let i=0;i<6;i++){g.enableVertexAttribArray(i+3);g.vertexAttribPointer(i+3,4,g.FLOAT,false,96,i*16);g.vertexAttribDivisor(i+3,1);}g.bindBuffer(g.ELEMENT_ARRAY_BUFFER,geo.gl.ib);g.bindVertexArray(null);this.batches.add(b);}if(b.dirty&&bytes){g.bindBuffer(g.ARRAY_BUFFER,b.glBuffer);g.bufferSubData(g.ARRAY_BUFFER,0,b.data.subarray(0,b.count*24));b.dirty=false;}}
 drawGPU(pass,b){pass.setVertexBuffer(0,b.geometry.gpu.vb);pass.setVertexBuffer(1,b.gpuBuffer);pass.setIndexBuffer(b.geometry.gpu.ib,'uint32');pass.drawIndexed(b.geometry.indices.length,b.count);this.drawCalls++;this.triangles+=b.geometry.indices.length/3*b.count;}
 render(batches,camera,world,env,train,time){if(this.lost)return;this.resize();this.updateUniforms(camera,world,env,train,time);this.drawCalls=0;this.triangles=0;const visible=[],shadow=[];for(const b of batches){const distance=length(sub(b.center,camera.position));const lodScale=this.settings.quality==='low'?.35:this.settings.quality==='medium'?.65:1;if((b.lodNear&&distance>b.lodNear*lodScale)||(b.lodFar&&distance<=b.lodFar*lodScale))continue;if(this.visible(b,camera))visible.push(b);if(this.settings.shadows&&this.visible(b,camera,true))shadow.push(b);}visible.sort((a,b)=>Number(!!a.transparent)-Number(!!b.transparent)||(a.transparent?length(sub(b.center,camera.position))-length(sub(a.center,camera.position)):0));const need=new Set([...visible,...shadow]);
  if(this.device){for(const b of need)this.ensureGPU(b);const d=this.device;d.queue.writeBuffer(this.uniform,0,this.frame);const encoder=d.createCommandEncoder();if(this.settings.shadows){const pass=encoder.beginRenderPass({colorAttachments:[],depthStencilAttachment:{view:this.shadowView,depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'store'}});pass.setPipeline(this.shadowPipeline);pass.setBindGroup(0,this.basicGroup);for(const b of shadow)this.drawGPU(pass,b);pass.end();}
   const pass=encoder.beginRenderPass({colorAttachments:[{view:this.colorMSAA.createView(),resolveTarget:this.post.scene.createView(),clearValue:{r:.2,g:.3,b:.4,a:1},loadOp:'clear',storeOp:'discard'}],depthStencilAttachment:{view:this.depth.createView(),depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'discard'}});pass.setPipeline(this.skyPipeline);pass.setBindGroup(0,this.basicGroup);pass.draw(3);pass.setPipeline(this.pipeline);pass.setBindGroup(0,this.mainGroup);for(const b of visible){pass.setPipeline(b.transparent?this.particlePipeline:b.cutout?this.foliagePipeline:this.pipeline);this.drawGPU(pass,b);}pass.end();this.post.encodeGPU(encoder,this.context.getCurrentTexture().createView(),env,time,this.settings.quality);d.queue.submit([encoder.finish()]);
  }else{const g=this.gl;for(const b of need)this.ensureGL(b);g.bindBuffer(g.UNIFORM_BUFFER,this.uniform);g.bufferSubData(g.UNIFORM_BUFFER,0,this.frame);const draw=b=>{g.bindVertexArray(b.vao);g.drawElementsInstanced(g.TRIANGLES,b.geometry.indices.length,g.UNSIGNED_INT,0,b.count);this.drawCalls++;this.triangles+=b.geometry.indices.length/3*b.count;};g.enable(g.DEPTH_TEST);g.depthMask(true);g.depthFunc(g.LESS);if(this.settings.shadows){g.bindFramebuffer(g.FRAMEBUFFER,this.shadowFB);g.viewport(0,0,this.shadowSize,this.shadowSize);g.clear(g.DEPTH_BUFFER_BIT);g.useProgram(this.glShadow);g.enable(g.POLYGON_OFFSET_FILL);g.polygonOffset(1.5,1);for(const b of shadow)draw(b);g.disable(g.POLYGON_OFFSET_FILL);}g.bindFramebuffer(g.FRAMEBUFFER,this.post.sceneFB);g.viewport(0,0,this.width,this.height);g.clearColor(.25,.4,.6,1);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);g.useProgram(this.glSky);g.bindVertexArray(this.emptyVAO);g.depthMask(false);g.disable(g.DEPTH_TEST);g.drawArrays(g.TRIANGLES,0,3);g.depthMask(true);g.enable(g.DEPTH_TEST);g.useProgram(this.glMain);g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,this.shadowTexture);for(const b of visible){if(b.transparent){g.enable(g.BLEND);g.blendFunc(g.SRC_ALPHA,g.ONE_MINUS_SRC_ALPHA);g.depthMask(false);}else{g.disable(g.BLEND);g.depthMask(true);}if(b.cutout)g.enable(g.SAMPLE_ALPHA_TO_COVERAGE);else g.disable(g.SAMPLE_ALPHA_TO_COVERAGE);draw(b);}g.disable(g.SAMPLE_ALPHA_TO_COVERAGE);g.disable(g.BLEND);g.depthMask(true);g.bindVertexArray(null);this.post.drawGL(env,time,this.settings.quality);}this.drawCalls+=this.post.passCount;
 }
 disposeBatch(b){if(b.gpuBuffer)b.gpuBuffer.destroy();if(b.glBuffer)this.gl?.deleteBuffer(b.glBuffer);if(b.vao)this.gl?.deleteVertexArray(b.vao);b.gpuBuffer=b.glBuffer=b.vao=null;b.capacity=0;b.dirty=true;this.batches.delete(b);}
 disposeGeometry(geo){if(geo.gpu){geo.gpu.vb.destroy();geo.gpu.ib.destroy();geo.gpu=null;}if(geo.gl){this.gl.deleteBuffer(geo.gl.vb);this.gl.deleteBuffer(geo.gl.ib);geo.gl=null;}this.geometries.delete(geo);}
 disposeWorld(batches,sharedGeometry){for(const b of batches){this.disposeBatch(b);if(!sharedGeometry.has(b.geometry))this.disposeGeometry(b.geometry);}}
}

return {Renderer};
})();
// ---- src/settlements.js ----
const __m_src_settlements_js = (() => {
const {Geometry,MeshBuilder,PRIMITIVES} = __m_src_geometry_js;
const {rng,hash2,hex,clamp,add,mul,transform,mat4Mul,norm,sub,TAU} = __m_src_math_js;
const {addLivingTree} = __m_src_botany_js;
/** Parcel-based regional settlements. Road graph -> buildable lots -> architecture.
 * Streets and foundations sample the rendered terrain. Every lot reserves a
 * footprint; water, steep grades, rail clearance and overlaps are rejected.
 */



const CITY_REVISION=1;
const DISTRICT_PROFILES={
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
function districtPoint(d,x,z){return [d.origin[0]+d.right[0]*x+d.forward[0]*z,0,d.origin[2]+d.right[2]*x+d.forward[2]*z];}
function planSettlements(world){
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
function footprint(world,p,width,depth,yaw){
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
function roadSamples(world,d,road){
 const length=Math.hypot(road.b[0]-road.a[0],road.b[1]-road.a[1]),n=Math.ceil(length/4),points=[];
 for(let i=0;i<=n;i++){
  const t=i/n,p=districtPoint(d,road.a[0]+(road.b[0]-road.a[0])*t,road.a[1]+(road.b[1]-road.a[1])*t),h=surface(world,p[0],p[2]);
  if(h<world.def.water+1.4||world.network.nearest(p[0],p[2],10))return null;
  if(points.length&&Math.abs(h-points.at(-1)[1])/(length/n)>.13)return null;
  p[1]=h+.13;points.push(p);
 }return points;
}
/** Keep the largest connected street component; do not strand blocks on islands. */
function connectedRoads(roads,candidates){
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
/** Planar oriented footprint test (four separating axes), shared across districts. */
function footprintsOverlap(a,b){
 const axes=[...a.axes,...b.axes],dx=b.center[0]-a.center[0],dz=b.center[1]-a.center[1];
 for(const [x,z] of axes){const radius=q=>q.half[0]*Math.abs(x*q.axes[0][0]+z*q.axes[0][1])+q.half[1]*Math.abs(x*q.axes[1][0]+z*q.axes[1][1]);
  if(Math.abs(dx*x+dz*z)>=radius(a)+radius(b))return false;
 }return true;
}
function rectangle(p,width,depth,yaw){return {center:[p[0],p[2]],half:[width*.5,depth*.5],axes:[[Math.cos(yaw),-Math.sin(yaw)],[Math.sin(yaw),Math.cos(yaw)]]};}
/** Tiered massing keeps upper volumes inside the validated footprint. */
function buildingMassing(width,depth,floors,style,seed){
 const height=floors*3.2;
 if(style!=='glass'||floors<9)return [{y:0,height,width,depth}];
 const podium=3*3.2,shoulder=Math.floor(floors*(.66+seed*.09))*3.2;
 return [{y:0,height:podium,width,depth},
  {y:podium,height:shoulder-podium,width:width*.88,depth:depth*.90},
  {y:shoulder,height:height-shoulder,width:width*(.62+seed*.10),depth:depth*.72}];
}

/** Shared curbside vehicle silhouettes. No per-vehicle mesh allocations. */
const vehicleCache=new Map();
function parkedVehicleArchetype(estate=false){
 const key=estate?'estate':'sedan';if(vehicleCache.has(key))return vehicleCache.get(key);
 const groups=Object.fromEntries(['paint','glass','rubber','chrome','lamps','tail'].map(k=>[k,new MeshBuilder()]));
 const append=(role,name,p,scale,roll=0)=>{
  const mesh=groups[role],g=PRIMITIVES[name],m=transform(p,scale,0,0,roll),start=mesh.v.length/8;
  for(let i=0;i<g.vertices.length;i+=8){const v=g.vertices,x=v[i],y=v[i+1],z=v[i+2],nx=v[i+3]/scale[0],ny=v[i+4]/scale[1],nz=v[i+5]/scale[2];
   const n=norm([nx*Math.cos(roll)-ny*Math.sin(roll),nx*Math.sin(roll)+ny*Math.cos(roll),nz]);
   mesh.vertex([m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]],n,[v[i+6],v[i+7]]);
  }for(const i of g.indices)mesh.i.push(start+i);
 };
 const profiles=[[-2.2,.76,.58],[-1.95,.90,.75],[-1.24,.94,.85],[.64,.94,.85],[1.66,.85,.67],[2.2,.69,.55]];
 const ring=([z,w,h])=>[[-w*.82,.27,z],[w*.82,.27,z],[w,.37,z],[w,h-.10,z],[w*.86,h,z],[-w*.86,h,z],[-w,h-.10,z],[-w,.37,z]];
 const rings=profiles.map(ring),body=groups.paint;
 for(let j=0;j<rings.length-1;j++)for(let i=0;i<8;i++)body.quad(rings[j][i],rings[j][(i+1)%8],rings[j+1][(i+1)%8],rings[j+1][i]);
 for(const end of [0,rings.length-1])for(let i=1;i<7;i++)body.tri(rings[end][0],rings[end][i],rings[end][i+1]);
 const rear=estate?-1.6:-.78,back=estate?-1.90:-1.36;
 // Sloping front/rear screens, a painted roof, and two side windows.
 groups.glass.quad([-.74,.88,.69],[.74,.88,.69],[.65,1.43,.12],[-.65,1.43,.12]);
 groups.glass.quad([.72,.87,back],[-.72,.87,back],[-.65,1.43,rear],[.65,1.43,rear]);
 groups.paint.quad([-.65,1.44,rear],[-.65,1.44,.12],[.65,1.44,.12],[.65,1.44,rear]);
 for(const side of [-1,1]){
  groups.glass.quad([side*.76,.88,back],[side*.76,.88,.69],[side*.65,1.43,.12],[side*.65,1.43,rear]);
  append('rubber','box',[side*.705,1.15,-.27],[.10,.60,.105]);
  append('paint','box',[side*.98,.96,.50],[.19,.13,.25]);
  for(const z of [-1.40,1.37]){
   append('rubber','cylinder',[side*.87,.35,z],[.69,.22,.69],Math.PI*.5);
   append('chrome','cylinder',[side*1.00,.35,z],[.39,.04,.39],Math.PI*.5);
  }
  for(const z of [-.85,.18])append('chrome','box',[side*.943,.81,z],[.027,.043,.17]);
  append('lamps','box',[side*.54,.55,2.16],[.43,.115,.10]);
  append('tail','box',[side*.58,.60,-2.14],[.35,.12,.10]);
 }
 append('rubber','box',[0,.38,2.20],[1.10,.16,.04]);append('chrome','box',[0,.41,-2.22],[.38,.14,.02]);
 const parts=[];for(const [role,builder] of Object.entries(groups)){const name=`street-car-${key}-${role}`,geometry=builder.geometry();PRIMITIVES[name]=geometry;parts.push({role,name,geometry});}
 vehicleCache.set(key,parts);return parts;
}
function streetCar(world,p,yaw,seed){
 const paints=['#747f82','#384c60','#837962','#a7aaa5','#814a42'];const tint=hex(paints[seed%paints.length]);
 const colors={paint:tint,glass:hex('#34454c'),rubber:hex('#272b2b'),chrome:hex('#9ca5a4'),lamps:hex('#e5e1c7'),tail:hex('#922f29')};
 for(const part of parkedVehicleArchetype(seed%3===0)){
  const props=part.role==='glass'?[3,.18,.35,0]:part.role==='paint'?[0,.28,.35,0]:part.role==='chrome'?[0,.25,.75,0]:[0,.72,0,0];
  const b=world.builder.instance(part.name,p,[1,1,1],colors[part.role],props,yaw);b.maxDistance=1900;
 }
}
function building(world,d,p,width,depth,floors,style,seed){
 const bounds=rectangle(p,width+1,depth+3,d.yaw);
 if((world.cityFootprints||[]).some(q=>footprintsOverlap(bounds,q))||(world.streetFootprints||[]).some(q=>footprintsOverlap(bounds,q)))return false;
 const pad=footprint(world,p,width+1,depth+1,d.yaw);if(!pad)return false;
 (world.cityFootprints??=[]).push(bounds);
 const b=world.builder,height=floors*3.2,base=[p[0],pad.high+.12,p[2]],palette=WALLS[Math.floor(seed*WALLS.length)%WALLS.length],color=hex(palette);
 localPart(world,d,base,[0,(pad.low-pad.high)/2-.3,0],[width+.5,pad.high-pad.low+.6,depth+.5],hex('#87877d'),[6,.97,0,0]);
 world.features.foundations=(world.features.foundations||0)+1;
 const massing=buildingMassing(width,depth,floors,style,seed);
 for(const tier of massing){
  const facade=localPart(world,d,base,[0,tier.y+tier.height*.5,0],[tier.width,tier.height,tier.depth],color,[12,.85,style==='glass'?1:0,seed]);facade.maxDistance=5500;
  localPart(world,d,base,[0,tier.y+tier.height+.03,0],[tier.width+.24,.15,tier.depth+.24],hex('#858a85'),[14,.90,0,0]);
 }
 if(massing.length>1)world.features.steppedTowers=(world.features.steppedTowers||0)+1;
 const roofWidth=massing.at(-1).width,roofDepth=massing.at(-1).depth;
 const roof=hex(style==='alpine'||style==='nordic'?'#535d5d':style==='stone'?'#6a6a63':style==='compact'?'#5c6369':'#866e5e');
 if(floors<=4&&style!=='glass'&&style!=='desert')gable(world,d,base,width,depth,height,roof);
 else{
  localPart(world,d,base,[0,height+.12,0],[roofWidth+.45,.24,roofDepth+.45],hex('#8d938f'),[14,.92,0,0]);
  for(const side of [-1,1]){
   localPart(world,d,base,[side*roofWidth*.5,height+.5,0],[.2,.75,roofDepth+.2],color,[6,.92,0,0]);
   localPart(world,d,base,[0,height+.5,side*roofDepth*.5],[roofWidth,.75,.2],color,[6,.92,0,0]);
  }
  localPart(world,d,base,[roofWidth*.20,height+1,0],[roofWidth*.30,1.4,roofDepth*.28],hex('#777f80'),[6,.78,.3,0]);
  for(let j=0;j<3;j++)localPart(world,d,base,[roofWidth*.20,height+1.72,(j-1)*roofDepth*.07],[roofWidth*.19,.07,.13],STEEL,[0,.4,.6,0]);
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
 for(const tier of massing)for(const side of [-1,1])localPart(world,d,base,[side*(tier.width*.5+.075),tier.y+tier.height*.5,-tier.depth*.42],[.10,tier.height,.10],STEEL,[0,.6,.3,0]);
 if(floors<=4){localPart(world,d,base,[width*.22,height+2.3,-depth*.22],[.9,3.1,1.1],hex('#8d8376'),[12,.95,0,seed]);
  if(seed>.5)for(let k=0;k<3;k++)localPart(world,d,base,[-width*.23,height+width*.12+.5,(k-1)*2.1],[width*.32,.09,1.8],hex('#2b4654'),[3,.19,.5,0],'box',-.43);}
 d.buildings.push({position:base,width,depth,height,floors,style,tiers:massing.length});world.features.buildings++;return true;
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
async function buildSettlements(world,onProgress=()=>{}){
 world.districts=world.districts||planSettlements(world);world.features.cityRevision=CITY_REVISION;
 world.cityFootprints=[];world.streetFootprints=[];const streetKeys=new Set(),plans=[];
 // Reserve every street before placing any building, including adjacent districts.
 for(const d of world.districts){
  const candidates=new Map();for(let i=0;i<d.roads.length;i++){const points=roadSamples(world,d,d.roads[i]);if(points)candidates.set(i,points);}
  const connected=connectedRoads(d.roads,candidates),valid=new Set(connected.keys());plans.push({d,valid});
  for(const [i,points] of connected){d.roads[i].built=true;const a=points[0],b=points.at(-1),key=[a,b].map(p=>[p[0],p[2]].map(v=>v.toFixed(2)).join(',')).sort().join('|');
   if(streetKeys.has(key))continue;streetKeys.add(key);buildRoad(world,d,d.roads[i],points);
   const mid=mul(add(a,b),.5),yaw=Math.atan2(b[0]-a[0],b[2]-a[2]);world.streetFootprints.push(rectangle(mid,14.6,Math.hypot(b[0]-a[0],b[2]-a[2])+14.6,yaw));
  }
 }
 for(const {d,valid} of plans){
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
   streetCar(world,p,d.yaw+(road.axis==='x'?Math.PI*.5:0),i);world.features.parkedCars=(world.features.parkedCars||0)+1;
  }
  if(d.buildings.length){const center=d.buildings[Math.floor(d.buildings.length*.5)].position;world.viewpoints.push({name:`${d.name} streets`,position:add(center,mul(d.forward,85)).map((v,i)=>i===1?v+55:v),target:add(center,[0,8,0])});}
  onProgress('Laying streets, parcels & neighbourhoods',.59);await new Promise(resolve=>setTimeout(resolve,0));
 }
 world.features.districts=world.districts.filter(d=>d.buildings.length).length;
}

return {CITY_REVISION,DISTRICT_PROFILES,districtPoint,planSettlements,footprint,roadSamples,connectedRoads,footprintsOverlap,buildingMassing,parkedVehicleArchetype,buildSettlements};
})();
// ---- src/cinematic-models.js ----
const __m_src_cinematic_models_js = (() => {
const {Geometry,MeshBuilder,PRIMITIVES} = __m_src_geometry_js;
const {add,sub,mul,norm,cross,hex,transform,frameMatrix,mat4Mul,pointTransform,clamp,TAU} = __m_src_math_js;
/** Geometric corrections: continuous train noses and terrain-grounded construction. */



// The high-speed shell uses the same octagonal cross-section as the coach body.
// All dimensions are in metres. Windscreens sit on the actual loft, not in front of it.
function noseSurface(length,t,angle){
 const width=1.585*(1-.89*t*t),roof=4.81-2.72*Math.pow(t,1.18),floor=1.46+.10*t;
 const c=Math.cos(angle),s=Math.sin(angle),superellipse=v=>Math.sign(v)*Math.pow(Math.abs(v),.55);
 return [superellipse(c)*width,(roof+floor)/2+superellipse(s)*(roof-floor)/2,length*.5-7+7*t];
}
function loft(length,t0,t1,a0,a1,rows,columns,offset=0){
 const vertices=[],indices=[];
 for(let j=0;j<=rows;j++)for(let i=0;i<=columns;i++){
  const t=t0+(t1-t0)*j/rows,a=a0+(a1-a0)*i/columns,p=noseSurface(length,t,a);
  const along=sub(noseSurface(length,clamp(t+.002,0,1),a),noseSurface(length,clamp(t-.002,0,1),a));
  const around=sub(noseSurface(length,t,a+.002),noseSurface(length,t,a-.002));
  const n=norm(cross(around,along));vertices.push(...add(p,mul(n,offset)),...n,t,i/columns);
 }
 for(let j=0;j<rows;j++)for(let i=0;i<columns;i++){const a=j*(columns+1)+i,b=a+columns+1;indices.push(a,a+1,b,a+1,b+1,b);}
 return new Geometry(vertices,indices);
}
function highSpeedNose(stock){
 const L=stock.locoLength,key='velocity-loft-'+L,glass=key+'-glazing';
 if(!PRIMITIVES[key]){
  PRIMITIVES[key]=loft(L,0,1,0,TAU,28,40);
  PRIMITIVES[glass]=loft(L,.19,.54,Math.PI*.18,Math.PI*.82,12,20,.035);
  const cap=new MeshBuilder(),center=[0,1.825,L*.5];
  for(let i=0;i<40;i++)cap.tri(center,noseSurface(L,1,i*TAU/40),noseSurface(L,1,(i+1)*TAU/40),[0,0,1]);
  PRIMITIVES[key+'-cap']=cap.geometry();
  const rim=[[.19,.205,Math.PI*.18,Math.PI*.82],[.525,.54,Math.PI*.18,Math.PI*.82],[.19,.54,Math.PI*.18,Math.PI*.192],[.19,.54,Math.PI*.808,Math.PI*.82]];
  rim.forEach((p,i)=>PRIMITIVES[key+'-rim-'+i]=loft(L,...p,12,20,.045));
 }
 const parts=[{g:key,m:transform([0,0,0]),c:hex(stock.color),pr:[0,.27,.40,0],role:'shell',tier:0},
  {g:glass,m:transform([0,0,0]),c:hex('#1d3944'),pr:[3,.11,.35,0],role:'glass',tier:0}];
 parts.push({g:key+'-cap',m:transform([0,0,0]),c:hex(stock.color),pr:[0,.3,.4,0],role:'shell',tier:0});
 for(let i=0;i<4;i++)parts.push({g:key+'-rim-'+i,m:transform([0,0,0]),c:hex('#263330'),pr:[0,.8,0,0],role:'cab',tier:0});
 const strip=new MeshBuilder();
 for(const side of [-1,1])for(let j=0;j<26;j++){
  const t=j/28,u=(j+1)/28,angle=side===1?-.05:Math.PI+.05;
  const p=noseSurface(L,t,angle),q=noseSurface(L,u,angle);p[0]+=side*.018;q[0]+=side*.018;
  strip.quad(p,q,add(q,[0,-.12,0]),add(p,[0,-.12,0]));
 }
 const stripe=key+'-stripe';if(!PRIMITIVES[stripe])PRIMITIVES[stripe]=strip.geometry();
 parts.push({g:stripe,m:transform([0,0,0]),c:hex(stock.stripe),pr:[0,.33,.35,0],role:'shell',tier:0});
 return parts;
}

/** Footprint samples: a pad closes visual terrain/mesh gaps without floating corners.
 * New towns reject extreme slopes instead of growing implausibly tall foundations.
 */
function foundation(world,p,size,yaw=0){
 const [sx,,sz]=size,c=Math.cos(yaw),s=Math.sin(yaw),heights=[];
 for(const x of [-sx*.52,0,sx*.52])for(const z of [-sz*.52,0,sz*.52])
  heights.push(world.height(p[0]+x*c+z*s,p[2]-x*s+z*c));
 return {low:Math.min(...heights)-1.1,high:Math.max(...heights),spread:Math.max(...heights)-Math.min(...heights)};
}
function buildingFoundation(world,p,size,yaw,station=false){
 const f=foundation(world,p,size,yaw),top=Math.max(p[1],f.high)+.08;
 // A short stepped podium hides sub-tile interpolation differences at close range.
 world.builder.oriented('box',transform([p[0],(top+f.low)*.5,p[2]],[size[0]+.35,Math.max(.4,top-f.low),size[2]+.35],yaw),hex('#8c8b7c'),[6,.97,0,0]);
 world.features.foundations=(world.features.foundations||0)+1;
 return [p[0],top,p[2]];
}

/** A viaduct span owns its deck, two bearings and exactly one boundary pier.
 * Pier axes are vertical even on a graded route; no leaning 100 m pillars.
 * Arch springings meet those piers, avoiding the former independent 24/27 m grids.
 */
function buildViaducts(world){
 const b=world.builder,stone=hex('#a6a493'),metal=hex('#596c6c'),water=world.def.water;
 const spans=[];
 for(const edge of world.network.edges.values()){
  const n=Math.ceil(edge.length/27),step=edge.length/n;let wasBridge=false;
  for(let i=0;i<n;i++){
   const s0=i*step,s1=(i+1)*step,mid=edge.at((s0+s1)*.5),h=world.baseHeight(mid.p[0],mid.p[2]);
   if(mid.p[1]-h<=13){wasBridge=false;continue;}
   const a=edge.at(s0),c=edge.at(s1),ground=p=>Math.max(water-4,world.baseHeight(p[0],p[2])-1.5);
   const pier=p=>{const bottom=ground(p.p),top=p.p[1]-2.8,height=top-bottom;
    if(height<.3)return;
    const yaw=Math.atan2(p.f[0],p.f[2]);
    b.oriented('box',transform([p.p[0],bottom+height*.5,p.p[2]],[2.8,height,2.25],yaw),stone,[6,.94,0,0]);
    b.oriented('box',transform([p.p[0],top+.3,p.p[2]],[5.1,.65,2.8],yaw),stone,[6,.94,0,0]);
    b.oriented('box',transform([p.p[0],bottom+.55,p.p[2]],[4.4,1.1,3.8],yaw),stone,[6,.94,0,0]);
   };
   if(!wasBridge)pier(a);pier(c);wasBridge=true;
   const chord=sub(c.p,a.p),length=Math.hypot(...chord),matrix=frameMatrix(add(mul(add(a.p,c.p),.5),[0,-1.06,0]),chord,[5.1,1.35,length+.12]);
   b.oriented('box',matrix,stone,[6,.94,0,0]);
   for(const side of [-1,1]){
    const rail=(p,y)=>world.railCross(p,side*2.42,y);
    b.segment(rail(a,.82),rail(c,.82),.075,metal,[0,.48,.6,0]);
    b.segment(rail(a,.34),rail(c,.34),.05,metal);
    for(let j=0;j<6;j++){const p=edge.at(s0+j*step/6);b.segment(rail(p,-.25),rail(p,.88),.065,metal);}
    const gap=Math.min(a.p[1]-ground(a.p),c.p[1]-ground(c.p));
    if(gap>15&&['alpine','highland','nordic','pine'].includes(world.def.theme)){
     const rise=Math.min(step*.37,gap*.55);
     for(let j=0;j<16;j++){
      const t=j/16,u=(j+1)/16,p=edge.at(s0+step*t),q=edge.at(s0+step*u);
      b.segment(rail(p,-2.4-rise*(1-Math.sin(Math.PI*t))),rail(q,-2.4-rise*(1-Math.sin(Math.PI*u))),.8,stone,[6,.96,0,0],1.05);
     }
    }else{
     for(let j=0;j<4;j++){
      const p=edge.at(s0+j*step/4),q=edge.at(s0+(j+1)*step/4);
      b.segment(rail(p,-3.9),rail(q,-3.9),.18,metal,[0,.5,.6,0]);
      b.segment(rail(p,j%2?-3.9:-1.5),rail(q,j%2?-1.5:-3.9),.15,metal,[0,.5,.6,0]);
     }
    }
   }
   spans.push({edge:edge.id,s0,s1,length,pierTop:c.p[1]-2.8,pierBottom:ground(c.p)});world.features.bridges++;
  }
 }
 world.viaductSpans=spans;return spans;
}

return {noseSurface,highSpeedNose,foundation,buildingFoundation,buildViaducts};
})();
// ---- src/generation.js ----
const __m_src_generation_js = (() => {
const {clamp, lerp, smooth, noise2, fbm, rng, hash2} = __m_src_math_js;
/**
 * Expedition terrain generator, revision 3.
 * Pure, deterministic CPU field: no DOM, renderer, wall clock or Math.random.
 * Domain-warped macro geology -> thermal/hydraulic erosion -> climate/drainage.
 * The renderer, railway survey, vegetation and map all sample this same field.
 */


const GENERATOR_VERSION = 3;
const REGION_PROFILES = {
 alpine: {name:'Glacial watershed', geology:'Folded ridges · braided meltwater · hanging valleys', species:'Fir / larch / alpine meadow', relief:1, forest:.76, grade:.028, spacing:34},
 coast: {name:'Pacific headlands', geology:'Scalloped cliffs · sea stacks · sheltered coves', species:'Coastal pine / oak / dune grass', relief:.7, forest:.56, grade:.023, spacing:38},
 nordic: {name:'Dendritic fjord', geology:'Branching sea inlets · granite walls · snowfields', species:'Spruce / birch / tundra', relief:1.2, forest:.53, grade:.028, spacing:39},
 canyon: {name:'Mesa country', geology:'Terraced sandstone · incised river · hoodoo fields', species:'Saguaro / juniper / desert scrub', relief:.9, forest:.15, grade:.026, spacing:55},
 sakura: {name:'Volcanic lowlands', geology:'Volcanic cone · alluvial plain · rice terraces', species:'Cherry / bamboo / cedar', relief:.65, forest:.70, grade:.020, spacing:35},
 highland: {name:'Lochs & moorland', geology:'Glacial troughs · drumlins · exposed tors', species:'Scots pine / heather / birch', relief:.85, forest:.38, grade:.027, spacing:44},
 pine: {name:'Forest watershed', geology:'Meandering river · wooded ridges · wetlands', species:'Oak / beech / spruce / fern', relief:.55, forest:.92, grade:.024, spacing:29},
 metro: {name:'Estuary metropolis', geology:'Tidal channels · docklands · urban terraces', species:'Plane tree / riparian reeds / parks', relief:.18, forest:.24, grade:.020, spacing:50}
};

function generationOptions(value = {}) {
 value = value && typeof value === 'object' ? value : {};
 const number = (v, lo, hi, fallback) => Number.isFinite(v) ? clamp(v, lo, hi) : fallback;
 return {relief:number(value.relief,.55,1.65,1), vegetation:number(value.vegetation,.25,1.7,1), erosion:number(value.erosion,0,1,.65)};
}

// These are design corridors, not circular paths. The survey adds deterministic
// lateral variation, follows the terrain, and fits an independently graded railway.
const CORRIDORS = {
 alpine:[[-.62,-1.1],[-.26,-.94],[.12,-.65],[.52,-.38],[.67,-.03],[.43,.29],[.08,.53],[.12,.90],[.53,1.15],[1,1.22],[1.34,.86],[1.23,.4],[1.08,-.04],[1.15,-.48],[.81,-.92],[.34,-1.27],[-.22,-1.38],[-.64,-1.3]],
 coast:[[.12,-1.48],[.05,-1.02],[.27,-.60],[-.02,-.25],[.1,.16],[.3,.51],[.09,.89],[.35,1.34],[.7,1.54],[1.15,1.41],[1.37,.96],[1.24,.49],[1.45,.09],[1.12,-.30],[1.37,-.76],[1.02,-1.18],[.58,-1.52]],
 nordic:[[-.27,-1.43],[-.43,-1.04],[-.55,-.62],[-.32,-.18],[-.23,.26],[-.58,.66],[-.85,1.06],[-.63,1.46],[-.16,1.65],[.28,1.44],[.65,1.17],[.81,.76],[.51,.45],[.39,.07],[.67,-.30],[.5,-.75],[.18,-1.16]],
 canyon:[[-1.20,-1.04],[-.75,-1.28],[-.25,-1.02],[.18,-1.13],[.7,-.8],[1.04,-.31],[.68,-.01],[.30,-.21],[-.05,-.07],[-.07,.27],[.39,.43],[.85,.48],[1.19,.79],[.94,1.17],[.42,1.25],[-.15,1.07],[-.68,1.15],[-1.07,.75],[-.86,.24],[-1.20,-.35]],
 sakura:[[-1.35,-.58],[-.91,-.76],[-.37,-.65],[.21,-.45],[.78,-.28],[1.30,-.13],[1.65,.24],[1.50,.71],[.99,.90],[.45,.7],[-.10,.43],[-.66,.53],[-1.20,.39],[-1.53,.03]],
 highland:[[-1.35,-.70],[-.90,-.83],[-.49,-.48],[-.11,-.15],[.18,.26],[.70,.48],[1.07,.89],[.89,1.27],[.41,1.46],[-.11,1.35],[-.46,.98],[-.88,.70],[-1.31,.88],[-1.60,.42],[-1.68,-.16]],
 pine:[[-1.33,-1.01],[-.81,-1.31],[-.30,-1.07],[.08,-.60],[.57,-.46],[1.10,-.74],[1.43,-.27],[1.38,.33],[1.08,.85],[.62,.92],[.20,.63],[-.11,.91],[-.57,1.10],[-1.04,.74],[-1.39,.23]],
 metro:[[-1.23,-1.10],[-.66,-1.13],[-.08,-1.12],[.42,-.82],[.53,-.30],[.95,-.06],[1.38,.09],[1.45,.68],[1.13,1.13],[.53,1.13],[.05,.94],[-.04,.42],[-.50,.26],[-1.08,.28],[-1.37,-.19],[-1.37,-.7]]
};

class TerrainField {
 constructor(def, seed = def.seed, options = {}) {
  this.def = def; this.seed = (Math.trunc(seed) >>> 0) || 1;
  this.options = generationOptions(options);
  this.profile = REGION_PROFILES[def.theme] || REGION_PROFILES.pine;
  this.half = Math.ceil(Math.max(def.rx,def.rz)*2.65/640)*640;
  this.size = 257; this.step = this.half*2/(this.size-1);
  const r = rng(this.seed ^ 0x24cf018a);
  this.phase = r()*6.283; this.offset = [(r()-.5)*600,(r()-.5)*600];
  this.riverWidth = def.theme==='nordic'?245: def.theme==='metro'?170: def.theme==='canyon'?54:85;
  this.heights = null; this.flow = null; this.stats = null; this.execution = 'main-thread';
 }
 /** A continental river spine; tributaries are expressed in the same metric space. */
 riverX(z) { return this.offset[0] + Math.sin(z/1150+this.phase)*370 + Math.sin(z/530+this.phase*.47)*135; }
 channel(x,z) {
  let d=Math.abs(x-this.riverX(z));
  if(this.def.theme==='nordic') {
   d=Math.min(d,Math.abs(x-(this.riverX(z)+Math.max(0,z+350)*.72))/1.23,
     Math.abs(x-(this.riverX(z)-Math.max(0,z-700)*.87))/1.33);
  } else if(this.def.theme==='metro') d=Math.min(d,Math.abs(z+460-Math.sin(x/1300)*300)*.95);
  else if(this.def.theme==='alpine') d=Math.min(d,Math.abs(x-this.riverX(z)-Math.max(0,z-1350)*.55)/1.15);
  return d;
 }
 /** Metric, non-radial macro relief. Isolated volcanoes/lochs are local features. */
 rawHeight(x,z) {
  const s=this.seed, w=this.def, theme=w.theme, ox=x+this.offset[0], oz=z+this.offset[1];
  const warpX=(fbm(ox*.00032,oz*.00032,s+11,3)-.44)*620;
  const warpZ=(fbm(ox*.00032+30,oz*.00032-20,s+47,3)-.44)*620;
  const a=ox+warpX,b=oz+warpZ,n=fbm(a*.00059,b*.00059,s,5),detail=fbm(a*.003,b*.003,s+71,3);
  const ridge=(1-Math.abs(2*fbm(a*.00074,b*.00074,s+173,4)-1))**3;
  const d=this.channel(x,z),width=this.riverWidth;
  const bank=smooth(width*.75,width+300,d),mount=smooth(width+120,width+1600,d);
  const relief=w.mountains*this.options.relief;
  let h;
  if(theme==='alpine') h=w.water-20+bank*76+mount*(ridge*.82+n*.18)*relief+bank*(detail-.44)*30;
  else if(theme==='coast') {
   const shore=-540+Math.sin(z/890+this.phase)*365+Math.sin(z/320)*105;
   const inland=x-shore;
   h=w.water-42+smooth(-105,170,inland)*103+smooth(160,2100,inland)*(n*.52+ridge*.48)*relief+(detail-.45)*33;
   // Isolated offshore stacks, not an island rim.
   const islands=noise2(a*.0013,b*.0013,s+304);
   h+=smooth(.64,.88,islands)*smooth(-160,-650,inland)*175;
  } else if(theme==='nordic') h=w.water-85+smooth(width*.83,width+270,d)*175+mount*(ridge*.8+n*.35)*relief+(detail-.4)*24*bank;
  else if(theme==='canyon') {
   const mesa=(n*.45+ridge*.45)*relief;
   const terrace=Math.floor(mesa/34)*34+smooth(.72,1,(mesa/34)%1)*34;
   h=w.water-13+bank*100+smooth(width+90,width+800,d)*(90+terrace)+(detail-.44)*25;
  } else if(theme==='sakura') {
   const volcano=Math.max(0,1-Math.hypot((x+2050)/2300,(z-2900)/2300));
   const crater=smooth(.84,1,volcano)*260;
   const field=bank*(43+(n-.4)*70+detail*12);
   h=w.water-12+field+volcano**1.55*relief*1.9-crater+smooth(3200,6000,z)*(n+ridge)*relief*.45;
  } else if(theme==='highland') {
   const loch=Math.min(Math.hypot((x+700)/440,(z-650)/1850),Math.hypot((x+2200)/380,(z+1200)/1150));
   const drumlin=(.5+.5*Math.sin(a*.0018+b*.0008))**2;
   h=w.water+36+(n*.55+drumlin*.25+ridge*.35)*relief*.66;
   h=lerp(w.water-22,h,smooth(.68,1.48,loch));
   h=lerp(w.water-7,h,smooth(45,300,d));
  } else if(theme==='metro') h=w.water-10+smooth(width*.8,width+120,d)*(32+n*38)+smooth(2400,5000,z)*ridge*150;
  else h=w.water-10+bank*49+mount*(n*.65+ridge*.28)*relief*.65+(detail-.43)*25*bank;
  return h;
 }
 prepare() {
  if(this.heights) return this;
  const start=performance.now(),n=this.size,step=this.step,h=new Float32Array(n*n);
  for(let z=0;z<n;z++) for(let x=0;x<n;x++) h[z*n+x]=this.rawHeight(x*step-this.half,z*step-this.half);
  const erosion=this.options.erosion;
  // Conservative thermal transport: every removal has a corresponding deposit.
  // Talus is measured in metres per cell, not resolution-dependent height units.
  const delta=new Float32Array(h.length),talus=step*.58;
  for(let iteration=0;iteration<5;iteration++) {
   delta.fill(0);
   for(let z=1;z<n-1;z++) for(let x=1;x<n-1;x++) {
    const i=z*n+x;
    for(const j of [i+1,i+n]) {
     const difference=h[i]-h[j],excess=Math.abs(difference)-talus;
     if(excess>0) {const move=Math.sign(difference)*excess*.11*erosion;delta[i]-=move;delta[j]+=move;}
    }
   }
   for(let i=0;i<h.length;i++) h[i]+=delta[i];
  }
  // Deterministic Lagrangian droplets: inertia, sediment capacity, erosion,
  // deposition and evaporation. Bounded lifetime and a low sea-level floor.
  const random=rng(this.seed^0x68bc21eb),drops=Math.round(9000*erosion);
  const sample=(x,z)=>{const ix=Math.floor(x),iz=Math.floor(z),u=x-ix,v=z-iz,i=iz*n+ix;
   const a=h[i],b=h[i+1],c=h[i+n],d=h[i+n+1];
   return {y:lerp(lerp(a,b,u),lerp(c,d,u),v),gx:lerp(b-a,d-c,v),gz:lerp(c-a,d-b,u),i,u,v};};
  const deposit=(p,amount)=>{h[p.i]+=amount*(1-p.u)*(1-p.v);h[p.i+1]+=amount*p.u*(1-p.v);h[p.i+n]+=amount*(1-p.u)*p.v;h[p.i+n+1]+=amount*p.u*p.v;};
  for(let k=0;k<drops;k++) {
   let x=2+random()*(n-5),z=2+random()*(n-5),dx=0,dz=0,water=1,speed=1,sediment=0;
   for(let age=0;age<38;age++) {
    const p=sample(x,z);dx=dx*.28-p.gx*.72;dz=dz*.28-p.gz*.72;
    const len=Math.hypot(dx,dz);if(len<1e-5) break;dx/=len;dz/=len;
    const nx=x+dx,nz=z+dz;
    if(nx<1||nz<1||nx>n-3||nz>n-3) {deposit(p,sediment);sediment=0;break;}
    const q=sample(nx,nz),dh=q.y-p.y,capacity=Math.max(-dh,.04)*speed*water*2.4;
    if(dh>0||sediment>capacity) {const amount=dh>0?Math.min(dh,sediment):(sediment-capacity)*.24;deposit(p,amount);sediment-=amount;}
    else {const amount=Math.min((capacity-sediment)*.12,Math.max(0,-dh),Math.max(0,p.y-this.def.water+8),2.3);deposit(p,-amount);sediment+=amount;}
    speed=Math.sqrt(Math.max(.04,speed*speed-dh*.12));water*=.965;x=nx;z=nz;
    if(water<.1||q.y<this.def.water-3) break;
   }
   // Do not leak remaining sediment when a droplet terminates.
   if(sediment>0) deposit(sample(x,z),sediment);
  }
  this.heights=h;
  // D8 flow accumulation descending in height is acyclic. Used as a biome and
  // drainage mask; it is not advertised as a fluid simulation.
  const flow=new Float32Array(h.length).fill(1),order=Array.from(h.keys()).sort((a,b)=>h[b]-h[a]);
  for(const i of order) {
   const x=i%n,z=Math.floor(i/n);if(x===0||z===0||x===n-1||z===n-1) continue;
   let next=i,best=0;
   for(const [dx,dz] of [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]]) {
    const j=i+dz*n+dx,slope=(h[i]-h[j])/(dx&&dz?Math.SQRT2:1);
    if(slope>best) {best=slope;next=j;}
   }
   if(next!==i) flow[next]+=flow[i];
  }
  this.flow=flow;let min=Infinity,max=-Infinity,sum=0;
  for(const y of h) {min=Math.min(min,y);max=Math.max(max,y);sum+=y;}
  this.stats={min,max,mean:sum/h.length,cells:h.length,droplets:drops,milliseconds:performance.now()-start};
  return this;
 }
 interpolate(values,x,z) {
  const u=clamp((x+this.half)/this.step,0,this.size-1.000001),v=clamp((z+this.half)/this.step,0,this.size-1.000001),ix=Math.floor(u),iz=Math.floor(v),i=iz*this.size+ix;
  return lerp(lerp(values[i],values[i+1],u-ix),lerp(values[i+this.size],values[i+this.size+1],u-ix),v-iz);
 }
 height(x,z) {return this.heights&&Math.abs(x)<=this.half&&Math.abs(z)<=this.half?this.interpolate(this.heights,x,z):this.rawHeight(x,z);}
 climate(x,z,height=this.height(x,z)) {
  const drainage=this.flow?clamp(Math.log2(this.interpolate(this.flow,x,z)+1)/10,0,1):0;
  const moisture=clamp(fbm(x*.0008,z*.0008,this.seed+983,3)*.8+(1-smooth(70,900,this.channel(x,z)))*.42+drainage*.25,0,1);
  const slope=Math.hypot(this.height(x-8,z)-this.height(x+8,z),this.height(x,z-8)-this.height(x,z+8))/16;
  return {moisture,drainage,slope,temperature:clamp(.88-height/1700,0,1)};
 }
}

/** Terrain-aware corridor survey; cyclic grade projection gives a continuous railway. */
function surveyRoute(def, terrain) {
 const random=rng(terrain.seed^0x72eb4d13),profile=terrain.profile;
 const template=CORRIDORS[def.theme]||CORRIDORS.pine;
 const sx=def.rx*(1.18+random()*.16),sz=def.rz*(1.18+random()*.18);
 const raw=template.map(([x,z],i)=>[x*sx+(random()-.5)*140,z*sz+(random()-.5)*140]);
 const controls=[];
 for(let i=0;i<raw.length;i++) {
  const p=raw[i],prev=raw[(i+raw.length-1)%raw.length],next=raw[(i+1)%raw.length];
  const dx=next[0]-prev[0],dz=next[1]-prev[1],len=Math.hypot(dx,dz),nx=-dz/len,nz=dx/len;
  // Penalize earthworks and cross-slope while retaining the authored corridor.
  let best=p,bestCost=Infinity;
  for(let lane=-2;lane<=2;lane++) {
   const x=p[0]+nx*lane*48,z=p[1]+nz*lane*48,h=terrain.height(x,z);
   const slope=Math.abs(terrain.height(x+nx*18,z+nz*18)-terrain.height(x-nx*18,z-nz*18));
   const cost=Math.abs(h-def.railY)*.32+slope*.75+lane*lane*14+(h<def.water?22:0);
   if(cost<bestCost) {bestCost=cost;best=[x,z];}
  }
  controls.push([best[0],Math.max(def.water+12,terrain.height(...best)+1.9),best[1]]);
 }
 // Smooth the vertical alignment, then project adjacent grades. Doing both
 // forward and reverse passes also constrains the seam of the circuit.
 for(let pass=0;pass<12;pass++) {
  const heights=controls.map(p=>p[1]);
  for(let i=0;i<controls.length;i++) controls[i][1]=heights[i]*.5+(heights[(i+1)%heights.length]+heights[(i+heights.length-1)%heights.length])*.25;
 }
 for(let pass=0;pass<40;pass++) for(let i=0;i<controls.length;i++) {
  const a=controls[i],b=controls[(i+1)%controls.length],limit=Math.hypot(b[0]-a[0],b[2]-a[2])*profile.grade*.72;
  const excess=Math.abs(a[1]-b[1])-limit;
  if(excess>0) {const shift=Math.sign(a[1]-b[1])*excess*.5;a[1]-=shift;b[1]+=shift;}
 }
 return controls;
}

return {GENERATOR_VERSION,REGION_PROFILES,generationOptions,TerrainField,surveyRoute};
})();
// ---- src/terrain-mesh.js ----
const __m_src_terrain_mesh_js = (() => {
const {Geometry} = __m_src_geometry_js;
const {norm,clamp} = __m_src_math_js;
/** Track-aware terrain tessellation with conforming transition edges.
 * Numerical cuttings can be much narrower than a regular terrain tile. Only
 * cells near the railway subdivide; adjacent coarse cells share their edge
 * vertices. Camera queries use the SAME triangles that the near mesh renders.
 */


function terrainPatch(world,x0,z0,span,n,refine=false){
 const vertices=[],indices=[],step=span/n,cache=new Map(),levels=new Map();
 const cells=new Uint32Array(n*n*2),division=new Uint8Array(n*n);
 let low=Infinity,high=-Infinity;
 const level=(x,z)=>{
  if(!refine)return 1;const key=x+','+z;if(levels.has(key))return levels.get(key);
  const near=world.network.nearest(x0+(x+.5)*step,z0+(z+.5)*step,85+step);
  const value=near?4:1;levels.set(key,value);return value;
 };
 const vertex=(x,z)=>{
  const key=x+','+z;if(cache.has(key))return cache.get(key);
  const wx=x0+x*step/4,wz=z0+z*step/4,y=world.height(wx,wz),e=refine?2.5:Math.max(4,step*.22);
  const normal=norm([world.height(wx-e,wz)-world.height(wx+e,wz),2*e,world.height(wx,wz-e)-world.height(wx,wz+e)]);
  const climate=world.terrain.climate(wx,wz,y),index=vertices.length/8;
  vertices.push(wx,y,wz,...normal,climate.moisture,climate.drainage);
  low=Math.min(low,y);high=Math.max(high,y);cache.set(key,index);return index;
 };
 for(let z=0;z<n;z++)for(let x=0;x<n;x++){
  const cell=z*n+x,start=indices.length,m=level(x,z),gx=x*4,gz=z*4;
  division[cell]=m;cells[cell*2]=start;
  if(m===4){
   for(let j=0;j<4;j++)for(let i=0;i<4;i++){
    const a=vertex(gx+i,gz+j),b=vertex(gx+i,gz+j+1),c=vertex(gx+i+1,gz+j),d=vertex(gx+i+1,gz+j+1);
    indices.push(a,b,c,c,b,d);
   }
  }else{
   const edge=[level(x-1,z),level(x,z+1),level(x+1,z),level(x,z-1)];
   if(edge.every(v=>v===1)){
    const a=vertex(gx,gz),b=vertex(gx,gz+4),c=vertex(gx+4,gz),d=vertex(gx+4,gz+4);indices.push(a,b,c,c,b,d);
   }else{
    const border=[],corners=[[gx,gz],[gx,gz+4],[gx+4,gz+4],[gx+4,gz]],center=vertex(gx+2,gz+2);
    for(let e=0;e<4;e++){const a=corners[e],b=corners[(e+1)%4];for(let k=0;k<edge[e];k++)border.push(vertex(a[0]+(b[0]-a[0])*k/edge[e],a[1]+(b[1]-a[1])*k/edge[e]));}
    for(let i=0;i<border.length;i++)indices.push(center,border[i],border[(i+1)%border.length]);
   }
  }
  cells[cell*2+1]=indices.length-start;
 }
 // Boundary skirts have the same subdivisions as the patch edge they seal.
 const perimeter=[];
 for(let x=0;x<n;x++)for(let i=0,m=Math.max(level(x,0),level(x,-1));i<m;i++)perimeter.push(vertex(x*4+i*4/m,0));
 for(let z=0;z<n;z++)for(let i=0,m=Math.max(level(n-1,z),level(n,z));i<m;i++)perimeter.push(vertex(n*4,z*4+i*4/m));
 for(let x=n-1;x>=0;x--)for(let i=0,m=Math.max(level(x,n-1),level(x,n));i<m;i++)perimeter.push(vertex((x+1)*4-i*4/m,n*4));
 for(let z=n-1;z>=0;z--)for(let i=0,m=Math.max(level(0,z),level(-1,z));i<m;i++)perimeter.push(vertex(0,(z+1)*4-i*4/m));
 for(let j=0;j<perimeter.length;j++){
  const a=perimeter[j],b=perimeter[(j+1)%perimeter.length],i=vertices.length/8,av=vertices.slice(a*8,a*8+8),bv=vertices.slice(b*8,b*8+8);
  av[1]-=32;bv[1]-=32;vertices.push(...av,...bv);indices.push(a,b,i,i,b,i+1);
 }
 const geometry=new Geometry(vertices,indices),v=geometry.vertices,ii=geometry.indices;
 const triangleHeight=(offset,x,z)=>{
  const a=ii[offset]*8,b=ii[offset+1]*8,c=ii[offset+2]*8;
  const ax=v[a],az=v[a+2],bx=v[b],bz=v[b+2],cx=v[c],cz=v[c+2];
  const den=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(den)<1e-8)return null;
  const u=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/den,w=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/den,t=1-u-w;
  return u>=-1e-5&&w>=-1e-5&&t>=-1e-5?u*v[a+1]+w*v[b+1]+t*v[c+1]:null;
 };
 return {geometry,center:[x0+span/2,(low+high)/2,z0+span/2],radius:Math.hypot(span*.71,(high-low)*.5)+40,
  cells,division,step,x0,z0,span,
  heightAt(x,z){
   const tx=clamp((x-x0)/step,0,n-1e-8),tz=clamp((z-z0)/step,0,n-1e-8),ix=Math.floor(tx),iz=Math.floor(tz),cell=iz*n+ix,start=cells[cell*2];
   if(division[cell]===4){const u=(tx-ix)*4,w=(tz-iz)*4,sx=Math.floor(u),sz=Math.floor(w),offset=start+(sz*4+sx)*6+((u-sx)+(w-sz)>1?3:0);return triangleHeight(offset,x,z)??world.height(x,z);}
   for(let i=start;i<start+cells[cell*2+1];i+=3){const h=triangleHeight(i,x,z);if(h!==null)return h;}
   return world.height(x,z);
  }
 };
}

return {terrainPatch};
})();
// ---- src/world-detail.js ----
const __m_src_world_detail_js = (() => {
const {terrainPatch} = __m_src_terrain_mesh_js;
const {Geometry, MeshBuilder, PRIMITIVES, Batch, sphereGeometry} = __m_src_geometry_js;
const {rng, hash2, noise2, fbm, hex, clamp, smooth, lerp, norm, add, sub, mul, transform, frameMatrix, mat4Mul, TAU} = __m_src_math_js;

/** Expedition scene construction. All placement consumes named, deterministic streams. */



const STONE=hex('#9a998d'),TIMBER=hex('#72624b'),STEEL=hex('#4c6266'),WHITE=hex('#e6e4d6');
const yieldUI=()=>new Promise(resolve=>setTimeout(resolve,0));

function rockGeometry() {
 const g=sphereGeometry(10,7),v=g.vertices;
 for(let i=0;i<v.length;i+=8) {const x=v[i],y=v[i+1],z=v[i+2],r=.83+noise2(x*7+y*3,z*7,416)*.43;v[i]*=r;v[i+1]*=r;v[i+2]*=r;}
 // Recompute area-weighted vertex normals after displacement.
 for(let i=0;i<v.length;i+=8) v[i+3]=v[i+4]=v[i+5]=0;
 for(let i=0;i<g.indices.length;i+=3) {
  const a=g.indices[i]*8,b=g.indices[i+1]*8,c=g.indices[i+2]*8;
  const u=[v[b]-v[a],v[b+1]-v[a+1],v[b+2]-v[a+2]],w=[v[c]-v[a],v[c+1]-v[a+1],v[c+2]-v[a+2]];
  const n=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]];
  for(const j of [a,b,c]) for(let k=0;k<3;k++) v[j+3+k]+=n[k];
 }
 for(let i=0;i<v.length;i+=8) {const n=norm([v[i+3],v[i+4],v[i+5]]);v.set(n,i+3);}
 return g;
}
function grassGeometry(fern=false) {
 const b=new MeshBuilder(),random=rng(fern?27:71);
 for(let i=0;i<(fern?8:11);i++) {
  const angle=random()*TAU,h=.5+random()*.5,x=(random()-.5)*.8,z=(random()-.5)*.8;
  const dir=[Math.cos(angle),0,Math.sin(angle)],side=[-dir[2],0,dir[0]];
  if(fern) {
   for(let j=0;j<6;j++) {const t=j/6,p=[x+dir[0]*t*.8,h*Math.sin(t*2.1),z+dir[2]*t*.8],tip=add(p,mul(dir,.24)),width=(1-t)*.28;
    b.tri(add(p,mul(side,width)),p,tip);b.tri(p,add(p,mul(side,-width)),tip);}
  } else {
   const root=[x,0,z],mid=[x+dir[0]*.16,h*.65,z+dir[2]*.16],tip=[x+dir[0]*.38,h,z+dir[2]*.38],width=.032;
   b.quad(add(root,mul(side,width)),add(root,mul(side,-width)),add(mid,mul(side,-width*.65)),add(mid,mul(side,width*.65)));
   b.tri(add(mid,mul(side,width*.65)),add(mid,mul(side,-width*.65)),tip);
  }
 }
 return b.geometry();
}
function flowerGeometry() {
 const b=new MeshBuilder();for(let i=0;i<5;i++){const a=i*TAU/5,c=(i+1)*TAU/5;
  b.tri([0,.6,0],[Math.cos(a)*.18,.64,Math.sin(a)*.18],[Math.cos(c)*.18,.64,Math.sin(c)*.18]);}
 return b.geometry();
}
PRIMITIVES.boulder=rockGeometry();PRIMITIVES.grass=grassGeometry();PRIMITIVES.fern=grassGeometry(true);PRIMITIVES.flower=flowerGeometry();

function terrainTile(world,x0,z0,span,n,refine=false) {
 const patch=terrainPatch(world,x0,z0,span,n,refine);
 const batch=world.builder.mesh(patch.geometry,patch.center,patch.radius,[1,.95,0,0]);
 batch.maxDistance=15000;
 if(n!==8)world.terrainPatches.set(`${Math.floor(x0/span)},${Math.floor(z0/span)}`,patch);
 return batch;
}

async function buildExpeditionTerrain(world,onProgress=()=>{}) {
 const f=world.terrain,tile=640,count=f.half/tile;let done=0;
 world.terrainPatches=new Map();
 world.surfaceHeight=(x,z)=>world.terrainPatches.get(`${Math.floor(x/tile)},${Math.floor(z/tile)}`)?.heightAt(x,z)??world.height(x,z);
 for(let z=-count;z<count;z++) {
  for(let x=-count;x<count;x++) {
   const cx=x*tile+tile*.5,cz=z*tile+tile*.5;
   const near=world.network.nearest(cx,cz,850),fine=!!near;
   const batch=terrainTile(world,x*tile,z*tile,tile,fine?32:12,fine);
   if(fine) {batch.lodNear=3000;const far=terrainTile(world,x*tile,z*tile,tile,8);far.lodFar=3000;far.castShadow=false;}
   done++;
  }
  if(z%3===0) {onProgress('Eroding ridges & surveying drainage',.13+.19*done/(count*count*4));await yieldUI();}
 }
 world.features.terrainTiles=done;world.features.terrainCells=f.heights.length;
}

function inSettlement(world,x,z) {
 for(const st of world.stations) {
  const p=world.network.edges.get(st.edge).at(st.s-80),dx=x-p.p[0],dz=z-p.p[2];
  const along=dx*p.f[0]+dz*p.f[2],across=dx*p.right[0]+dz*p.right[2];
  if(along>-340&&along<320&&across>-28&&across<330)return true;
 }
 return false;
}
function canopy(world,p,h,variation,species) {
 const b=world.builder,w=world.def;
 const birch=species==='birch',cherry=species==='cherry',oak=species==='oak';
 b.instance('cylinder',add(p,[0,h*.38,0]),[h*(oak?.053:.032),h*.76,h*.032],hex(birch?'#bfc4b5':'#63533f'),[6,.93,0,0]);
 const color=hex(cherry?'#dfa9bc':birch?'#8d9f58':variation>.5?'#526f3b':'#3e6544');
 for(let i=0;i<5;i++) {
  const angle=i*2.399+variation*5,r=h*(oak?.26:.16),end=add(p,[Math.cos(angle)*r,h*(.61+(i%3)*.08),Math.sin(angle)*r]);
  b.segment(add(p,[0,h*.40,0]),end,h*.018,TIMBER,[6,.9,0,0]);
  b.instance('foliage',end,[h*.44,h*(oak?.29:.38),h*.42],color,[5,.95,0,0],angle);
 }
 if(birch) for(let y=1;y<h*.55;y+=1.3) b.instance('box',add(p,[0,y,.01]),[h*.04,.09,h*.04],hex('#636d5d'),[0,1,0,0]);
}
function cactus(world,p,h,v) {
 const b=world.builder,color=hex(v>.5?'#718258':'#83906a');h*=.35;
 b.instance('cylinder',add(p,[0,h*.5,0]),[.55,h,.55],color,[6,.96,0,0]);
 b.instance('sphere',add(p,[0,h,0]),[.55,.55,.55],color);
 for(const side of [-1,1]) {const y=h*(side<0?.4:.65),x=side*(.8+v*.6);
  b.segment(add(p,[0,y,0]),add(p,[x,y,0]),.35,color,[6,.9,0,0]);
  b.instance('cylinder',add(p,[x,y+h*.16,0]),[.34,h*.32,.34],color,[6,.95,0,0]);
  b.instance('sphere',add(p,[x,y+h*.32,0]),[.34,.4,.34],color);
 }
}
function plant(world,x,z,variation,climate) {
 const h=world.height(x,z),p=[x,h,z],theme=world.def.theme,b=world.builder;
 const size=9+hash2(Math.floor(x),Math.floor(z),world.seed+51)*18;
 if(theme==='canyon') {if(variation>.32)cactus(world,p,size,variation);else canopy(world,p,size*.45,variation,'oak');}
 else if(theme==='sakura'&&variation>.51) canopy(world,p,size*.69,variation,'cherry');
 else if(theme==='sakura'&&variation<.17) {
  for(let i=0;i<5;i++){const px=x+Math.sin(i*2.4)*1.1,pz=z+Math.cos(i*2.4)*1.1;b.instance('cylinder',[px,h+size*.4,pz],[.15,size*.8,.15],hex('#78835b'));b.instance('foliage',[px,h+size*.7,pz],[2.1,size*.4,2.1],hex('#729653'),[5,.98,0,0]);}
 } else if((['pine','coast','metro'].includes(theme)&&variation>.38)||(theme==='nordic'&&variation>.82)) canopy(world,p,size,variation,variation>.75?'birch':'oak');
 else world.tree(p,size,variation);
 world.features.trees++;
}

async function buildEcosystem(world,onProgress=()=>{}) {
 const f=world.terrain,b=world.builder,w=world.def,random=rng(world.seed^0x5dd715ef);
 const spacing=f.profile.spacing/Math.sqrt(f.options.vegetation),span=Math.max(w.rx,w.rz)*2.05;
 // Stratified, jittered cells avoid independent white-noise clumps and holes.
 // Named hash streams keep unrelated landmarks stable when density changes.
 let row=0;
 for(let z=-span;z<span;z+=spacing) {
  for(let x=-span;x<span;x+=spacing) {
   const ix=Math.floor(x/spacing),iz=Math.floor(z/spacing),v=hash2(ix,iz,world.seed+7);
   const px=x+spacing*(.15+.7*hash2(ix,iz,world.seed+11)),pz=z+spacing*(.15+.7*hash2(ix,iz,world.seed+19));
   const h=world.baseHeight(px,pz);if(h<w.water+2||h>w.snowLine+30)continue;
   const c=f.climate(px,pz,h),patch=noise2(px*.0018,pz*.0018,world.seed+911);
   const chance=f.profile.forest*smooth(.14,.7,patch)*(.48+c.moisture);
   if(v>chance||c.slope>.83||inSettlement(world,px,pz)||world.network.nearest(px,pz,16))continue;
   plant(world,px,pz,hash2(ix,iz,world.seed+61),c);
  }
  if(++row%35===0){onProgress('Growing climate-aware forests',.74+.08*(z+span)/(2*span));await yieldUI();}
 }
 // Near-track ecological detail is distance-limited on the GPU, and never
 // scatters into the loading gauge, platforms or streets.
 const edges=[...world.network.edges.values()];
 for(let i=0;i<6500*f.options.vegetation;i++) {
  const e=edges[i%edges.length],pose=e.at(random()*e.length),side=random()>.5?1:-1,offset=12+random()**2*230;
  const p=add(pose.p,mul(pose.right,side*offset));p[1]=world.height(p[0],p[2]);
  if(p[1]<w.water+.8||p[1]>w.snowLine||inSettlement(world,p[0],p[2]))continue;
  const c=f.climate(p[0],p[2],p[1]);if(c.slope>.74||world.network.nearest(p[0],p[2],8))continue;
  const desert=w.theme==='canyon',heather=w.theme==='highland';
  if(i%7===0) {
   const batch=b.instance('foliage',add(p,[0,.7,0]),[1.4+random()*2,1.4,1.7],hex(heather?'#8b7182':desert?'#8f895d':'#597540'),[5,.94,0,0],random()*TAU);
   batch.maxDistance=1000;world.features.shrubs++;
  } else {
   const name=c.moisture>.6&&!desert?'fern':'grass',scale=.55+random()*1.2;
   const batch=b.instance(name,p,[scale*1.8,scale,scale*1.8],hex(desert?'#b5a06a':heather?'#8c895b':'#879459'),[5,.98,0,0],random()*TAU);
   batch.maxDistance=300;batch.castShadow=false;
   if(i%9===0&&!desert){const flower=b.instance('flower',p,[scale,scale,scale],hex(heather?'#b37eaa':i%2?'#dac99c':'#ccc4dc'),[5,.85,0,0]);flower.maxDistance=220;flower.castShadow=false;world.features.flowers++;}
  }
 }
 for(let i=0;i<420;i++) {
  const e=edges[i%edges.length],p=e.at(random()*e.length),pos=add(p.p,mul(p.right,(random()>.5?1:-1)*(25+random()*370)));
  pos[1]=world.height(pos[0],pos[2]);if(pos[1]<w.water-1||inSettlement(world,pos[0],pos[2]))continue;
  const size=1.3+random()**2*16;b.instance('boulder',add(pos,[0,size*.28,0]),[size,size*.82,size*1.2],hex(w.rock),[6,.98,0,0],random()*TAU);
 }
 world.features.ecosystemSeed=world.seed;
}

/** Long engineering structures respond to actual route-to-terrain clearances. */
function buildCivilEngineering(world,includeBridges=true) {
 const b=world.builder,theme=world.def.theme;
 for(const edge of world.network.edges.values()) {
  let inBridge=false;
  for(let s=18;s<edge.length-30;s+=24) {
   const p=edge.at(s),height=world.baseHeight(p.p[0],p.p[2]),gap=p.p[1]-height;
   if(gap>14) {
    if(!includeBridges)continue; // New viaduct builder owns bridge geometry.
    if(!inBridge)world.features.landmarks++;inBridge=true;
    // Trussed deck and diagonals follow the railway, including the alternative.
    if(['canyon','coast','metro'].includes(theme)) for(const side of [-1,1]) {
     const a=world.railCross(edge.at(s-12),side*2.6,-1.5),c=world.railCross(edge.at(s+12),side*2.6,-1.5),lower=add(a,[0,-3.1,0]),end=add(c,[0,-3.1,0]);
     b.segment(lower,end,.2,STEEL,[0,.65,.55,0]);b.segment(a,end,.17,STEEL,[0,.65,.55,0]);b.segment(lower,c,.17,STEEL,[0,.65,.55,0]);
    } else {
     // Masonry arch soffits rather than rectangular blocks alone.
     for(const side of [-1,1]) for(let j=0;j<10;j++) {
      const t=j/10*Math.PI,u=(j+1)/10*Math.PI;
      const a=edge.at(s+Math.cos(t)*11),c=edge.at(s+Math.cos(u)*11);
      b.segment(world.railCross(a,side*2.2,-11+Math.sin(t)*8),world.railCross(c,side*2.2,-11+Math.sin(u)*8),1.0,STONE,[6,.97,0,0],1.15);
     }
    }
   }else {inBridge=false;if(height-p.p[1]>15&&s%72<24){world.features.cuttings++;for(const side of [-1,1]){
    const pos=world.railCross(p,side*13,-.4);b.oriented('box',frameMatrix(add(pos,[0,2,0]),p.f,[.6,4,24.2]),STONE,[6,.94,0,0]);
   }}}
  }
 }
}
function landmarkAnchor(world,fraction,side=1,distance=100) {
 const edge=world.network.edges.get('return'),p=edge.at(edge.length*fraction),point=add(p.p,mul(p.right,side*distance));point[1]=world.height(point[0],point[2]);
 return {p:point,yaw:Math.atan2(p.f[0],p.f[2]),rail:p};
}
function localParts(world,p,yaw) {
 const base=transform(p,[1,1,1],yaw),b=world.builder;
 return (g,position,size,color=STONE,props=[6,.93,0,0],rotation=[0,0,0])=>b.oriented(g,mat4Mul(base,transform(position,size,...rotation)),color,props);
}
function boats(world,z) {
 const f=world.terrain,b=world.builder,x=f.riverX(z),water=world.def.water;
 for(let i=0;i<3;i++) {
  const p=[x+i*25,water+1,z+i*42],part=localParts(world,p,.3+i*.17);
  part('body',[0,0,0],[5,2.2,15],hex('#476772'));part('box',[0,1.5,-1],[3.3,2.7,5],WHITE);
  part('box',[0,2,1.55],[2.7,.9,.06],hex('#3c5961'),[3,.18,.3,0]);part('cylinder',[0,5,1],[.12,8,.12],STEEL);
 }
}
function buildLandmarks(world) {
 const w=world.def,b=world.builder,f=world.terrain,random=rng(world.seed^0x1a2789bc);
 const a=landmarkAnchor(world,.26,1,110),part=localParts(world,a.p,a.yaw);
 const names={alpine:'High-country cabins',coast:'Headland lighthouse',nordic:'Granite fjord',canyon:'Sandstone arch',sakura:'Five-tier temple',highland:'Ruined highland keep',pine:'Woodland sawmill',metro:'Container terminal'};
 const eye=add(a.p,[Math.cos(a.yaw)*145,75,-Math.sin(a.yaw)*145]);eye[1]=Math.max(eye[1],world.height(eye[0],eye[2])+28);
 world.viewpoints.push({name:names[w.theme],position:eye,target:add(a.p,[0,12,0])});
 const overlook=[f.riverX(400)+750,0,950];overlook[1]=Math.max(w.water+380,world.height(overlook[0],overlook[2])+220);
 world.viewpoints.push({name:'Watershed panorama',position:overlook,target:[f.riverX(400),w.water+70,400]});
 if(w.theme==='alpine'||w.theme==='nordic') {
  // Avalanche fences and high-country cabins on surveyed slopes.
  for(let i=0;i<7;i++) {
   const c=landmarkAnchor(world,.12+i*.07,-1,95+random()*80);
   if(c.p[1]>w.water+4)world.buildHouse(c.p,[8,5,13],c.yaw);
   for(let j=-3;j<=3;j++){const q=add(c.p,[j*7,0,30]);q[1]=world.height(q[0],q[2]);b.instance('box',add(q,[0,1.8,0]),[.22,3.6,.22],TIMBER);b.instance('box',add(q,[0,2,0]),[7.3,.16,.15],TIMBER);}
  }
  // Stepped, suspended waterfall ribbons placed against actual steep banks.
  for(let i=0;i<4;i++) {
   const c=landmarkAnchor(world,.18+i*.16,1,190),h=c.p[1],foot=add(c.p,[0,0,50]);foot[1]=world.height(foot[0],foot[2]);
   if(h-foot[1]>14) {const mesh=new MeshBuilder();for(let j=0;j<8;j++){const t=j/8,u=(j+1)/8;const left=[c.p[0]-2,lerp(h,foot[1],t)+.25,lerp(c.p[2],foot[2],t)],right=[c.p[0]+2,left[1],left[2]],end=[foot[0]+2,lerp(h,foot[1],u)+.25,lerp(c.p[2],foot[2],u)];mesh.quad(left,right,end,[foot[0]-2,end[1],end[2]]);}const batch=b.mesh(mesh.geometry(),c.p,120,[9,.3,0,.18],hex('#c0dfe2'));batch.castShadow=false;world.features.waterfalls=(world.features.waterfalls||0)+1;}
  }
  if(w.theme==='nordic')boats(world,-900);
 } else if(w.theme==='coast') {
  // Sea-stack geology and breakwater harbour; coastline is not concentric.
  for(let i=0;i<24;i++){const z=(random()-.5)*w.rz*4,x=-860+Math.sin(z/890+f.phase)*365;const h=25+random()*80;b.instance('boulder',[x,w.water+h*.28,z],[25+random()*45,h,35+random()*45],hex(w.rock),[6,.94,0,0],random()*TAU);}
  for(let i=0;i<12;i++)part('box',[i*8,1,25],[8.1,2,10],STONE);
  part('cylinder',[35,20,25],[9,40,9],WHITE);part('cylinder',[35,41,25],[11,2,11],hex('#8b5247'));part('sphere',[35,44,25],[6,4,6],hex('#f9dd98'),[4,.4,0,2]);
 } else if(w.theme==='canyon') {
  for(let i=0;i<32;i++){const c=landmarkAnchor(world,.05+random()*.9,random()>.5?1:-1,70+random()*240),h=12+random()*45;
   b.instance('boulder',add(c.p,[0,h*.3,0]),[7+random()*10,h,8],hex('#ae7452'),[6,.99,0,0]);b.instance('boulder',add(c.p,[0,h*.78,0]),[13,7,11],hex('#be8f66'),[6,.99,0,0]);}
  // A walk-through sandstone arch beside the line.
  for(let i=0;i<20;i++){const angle=i/19*Math.PI;part('boulder',[Math.cos(angle)*26,8+Math.sin(angle)*29,0],[10,12,12],hex('#c18b65'));}
 } else if(w.theme==='sakura') {
  // Five-tier temple with progressively smaller, overhanging roofs.
  for(let level=0;level<5;level++){const width=23-level*3,y=level*6;
   part('box',[0,y+2.4,0],[width*.7,4.8,width*.7],hex('#9b654b'));part('body',[0,y+5.5,0],[width,2.3,width],hex('#435654'));
   for(const x of [-1,1])for(const z of [-1,1])part('cylinder',[x*width*.32,y+2.5,z*width*.32],[.5,5,.5],hex('#7d4438'));
  }
  part('cylinder',[0,33,0],[.3,10,.3],hex('#b5a16b'));
  for(let i=0;i<70;i++) {
   const c=landmarkAnchor(world,.05+random()*.85,1,180+random()*250);if(c.p[1]<w.water+4)continue;
   const pp=localParts(world,c.p,c.yaw);for(let j=0;j<3;j++){pp('box',[0,j*.23,j*9],[26,.2,8.5],hex(j%2?'#849957':'#a5ac67'));pp('box',[0,j*.23+.22,j*9+4.3],[27,.35,.55],hex('#7d8059'));}
  }
 } else if(w.theme==='highland') {
  // Ruined keep, curtain walls, crenellations; deliberately unlike village houses.
  for(const x of [-18,18])for(const z of [-18,18]){part('cylinder',[x,11,z],[11,22,11]);for(let i=0;i<8;i++){const t=i*TAU/8;part('box',[x+Math.cos(t)*4.8,23,z+Math.sin(t)*4.8],[1.5,2.5,1.5]);}}
  for(const x of [-18,18])part('box',[x,7,0],[3,14,35]);for(const z of [-18,18])part('box',[0,7,z],[35,14,3]);
  for(let x=-16;x<18;x+=4)part('box',[x,15,18],[2,2.5,3]);
 } else if(w.theme==='pine') {
  world.buildHouse(a.p,[18,9,35],a.yaw);
  for(let i=0;i<60;i++)part('cylinder',[22+(i%6)*.9,.65+Math.floor(i/20)*.8,-12+Math.floor(i%20/6)*7],[.8,6.8,.8],TIMBER,[6,.97,0,0],[0,Math.PI/2,0]);
  part('cylinder',[-12,4,9],[7,.6,7],TIMBER,[6,.97,0,0],[0,0,Math.PI/2]);
  for(let i=0;i<12;i++) {const t=i*TAU/12;part('box',[-12,4+Math.sin(t)*3.1,9+Math.cos(t)*3.1],[1.5,.3,1.4],TIMBER,[6,.96,0,0],[0,t,0]);}
 } else {
  // Port cranes, stacked containers and industrial pipework diversify the skyline.
  for(let i=0;i<4;i++){const x=i*42;part('box',[x,23,0],[3,46,3],hex('#ca9754'));part('box',[x,47,9],[3,2,68],hex('#ca9754'));part('cylinder',[x,34,38],[.13,25,.13],STEEL);part('box',[x,20,38],[3,2,3],STEEL);}
  for(let i=0;i<45;i++)part('box',[i%9*8,1.5+Math.floor(i/18)*3.05,-24-Math.floor(i/9)*15],[6.8,3,12],hex(['#9b624a','#597582','#a99965'][i%3]));
  boats(world,800);
 }
 world.features.landmarks+=1;
}

return {buildExpeditionTerrain,buildEcosystem,buildCivilEngineering,buildLandmarks};
})();
// ---- src/tracks.js ----
const __m_src_tracks_js = (() => {
const {TerrainField, surveyRoute} = __m_src_generation_js;
const {clamp,lerp,mix3,norm,sub,add,mul,cross,length,catmull,mod,TAU} = __m_src_math_js;


/** Arc-length parameterized, sampled railway edges. Drawing and physics use the same centerline. */
class TrackEdge {
 constructor(id,points,limit=120){this.id=id;this.points=points;this.limit=limit;this.arc=new Float64Array(points.length);for(let i=1;i<points.length;i++)this.arc[i]=this.arc[i-1]+length(sub(points[i],points[i-1]));this.length=this.arc.at(-1);if(!(this.length>1))throw new Error('Track edge is too short');}
 at(distance){const s=clamp(distance,0,this.length);let a=0,b=this.arc.length-1;while(a+1<b){const m=(a+b)>>1;if(this.arc[m]<=s)a=m;else b=m;}const d=this.arc[b]-this.arc[a],p=mix3(this.points[a],this.points[b],d?(s-this.arc[a])/d:0),f=norm(sub(this.points[b],this.points[a]));return {p,f,right:norm(cross([0,1,0],f)),grade:f[1]/Math.max(.1,Math.hypot(f[0],f[2])),s,edge:this.id};}
 curvature(s){const a=this.at(s-6).f,b=this.at(s+6).f;return Math.hypot(a[0]-b[0],a[2]-b[2])/12;}
 speedLimit(s){const k=this.curvature(s);return Math.min(this.limit,k>.00004?Math.sqrt(.85/k)*3.6:this.limit);}
}
function splineLoop(points,spacing=3){const result=[];for(let i=0;i<points.length;i++){const a=points[mod(i-1,points.length)],b=points[i],c=points[(i+1)%points.length],d=points[(i+2)%points.length],n=Math.max(8,Math.ceil(length(sub(c,b))/spacing));for(let j=0;j<n;j++)result.push(catmull(a,b,c,d,j/n));}result.push([...result[0]]);return result;}
class RailNetwork {
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
class RailCursor {
 constructor(network,edge='approach',s=0){this.net=network;this.path=[network.previous(edge),edge];this.index=1;this.s=s;this.odometer=0;}
 advance(ds){if(!Number.isFinite(ds))throw new Error('Nonfinite rail displacement');this.s+=ds;this.odometer+=Math.abs(ds);let guard=0;while(this.s>this.net.edges.get(this.edge).length&&guard++<100){this.s-=this.net.edges.get(this.edge).length;const next=this.net.next(this.edge);this.path.length=this.index+1;this.path.push(next);this.index++;}while(this.s<0&&guard++<100){if(this.index===0){this.path.unshift(this.net.previous(this.edge));this.index++;}this.index--;this.s+=this.net.edges.get(this.edge).length;}if(this.index>30){this.path.splice(0,this.index-10);this.index=10;} }
 get edge(){return this.path[this.index];}
 pose(offset=0){let i=this.index,s=this.s+offset,id=this.edge,guard=0;while(s<0&&guard++<100){id=i>0?this.path[--i]:this.net.previous(id);s+=this.net.edges.get(id).length;}while(s>this.net.edges.get(id).length&&guard++<100){s-=this.net.edges.get(id).length;id=(i>=0&&i+1<this.path.length)?this.path[++i]:this.net.next(id);if(i>=this.path.length-1)i=this.path.length;}return this.net.edges.get(id).at(s);}
 distanceTo(edge,s,max=Infinity){let id=this.edge,dist=-this.s;for(let i=0;i<12&&dist<max;i++){if(id===edge&&s+dist>=-.1)return Math.max(0,s+dist);dist+=this.net.edges.get(id).length;id=this.net.next(id);}return Infinity;}
 snapshot(){return {path:[...this.path],index:this.index,s:this.s,odometer:this.odometer};}
 restore(o){if(!o||!Array.isArray(o.path)||o.path.length>100||!o.path.every(e=>this.net.edges.has(e))||!Number.isInteger(o.index)||o.index<0||o.index>=o.path.length||!Number.isFinite(o.s))throw new Error('Invalid rail cursor');for(let i=1;i<o.path.length;i++){const prev=o.path[i-1],next=o.path[i];if(!(prev==='approach'?['main','branch'].includes(next):prev==='return'?next==='approach':next==='return'))throw new Error('Rail cursor contains disconnected edges.');}this.path=[...o.path];this.index=o.index;this.s=clamp(o.s,0,this.net.edges.get(this.edge).length);this.odometer=Number.isFinite(o.odometer)?clamp(o.odometer,0,1e10):0;}
}

return {TrackEdge,RailNetwork,RailCursor};
})();
// ---- src/physics.js ----
const __m_src_physics_js = (() => {
const {clamp,lerp} = __m_src_math_js;
const {STOCK,WEATHER} = __m_src_data_js;
const {RailCursor} = __m_src_tracks_js;



const G=9.80665;
class Train {
 constructor(network,stock=STOCK[0],id='player',edge='approach',s=220){this.id=id;this.stock=stock;this.cursor=new RailCursor(network,edge,s);this.cars=stock.defaultCars;this.speed=0;this.acceleration=0;this.traction=0;this.brakeForce=0;this.grade=0;this.throttleLag=0;this.pipe=5;this.reservoir=8;this.cylinders=Array(this.cars+1).fill(.5);this.wheelslip=0;this.energy=0;this.fuel=100;this.boiler=13.5;this.water=85;this.fire=65;this.doorAmount=0;this.derailed=false;this.derailTimer=0;this.risk=0;this.couplerForce=0;this.controls={throttle:0,brake:.65,dynamic:0,independent:0,reverser:1,master:true,pantograph:true,parking:false,doors:false,headlights:true,sand:false,emergency:false,wipers:false,fireman:true};this.ai=false;this.dwell=0;this.lastStation=null;this.passengers=0;this.events=[];this.protection=false;this.failureReason=null;}
 get mass(){return this.stock.mass+this.cars*this.stock.carMass;}
 get length(){return this.stock.locoLength+this.cars*(this.stock.carLength+.65);}
 get electric(){return ['electric','highspeed','metro'].includes(this.stock.kind);}
 carOffset(i){return i===0?0:-(this.stock.locoLength*.5+this.stock.carLength*.5+.65+(i-1)*(this.stock.carLength+.65));}
 setCars(n){if(Math.abs(this.speed)>.15)throw new Error('Stop before changing the consist.');this.cars=clamp(Math.round(n),0,this.stock.maxCars);this.cylinders=Array(this.cars+1).fill(this.cylinders[0]||0);}
 setStock(stock){if(Math.abs(this.speed)>.15)throw new Error('Stop before changing locomotives.');this.stock=stock;this.cars=stock.defaultCars;this.cylinders=Array(this.cars+1).fill(.5);this.fuel=100;this.boiler=13.5;this.derailed=false;}
 setReverser(v){if(Math.abs(this.speed)>.25)throw new Error('Stop before moving the reverser.');this.controls.reverser=clamp(Math.round(v),-1,1);this.controls.throttle=0;}
 toggleDoors(){if(Math.abs(this.speed)>.15)throw new Error('Doors are interlocked above walking speed.');this.controls.doors=!this.controls.doors;if(this.controls.doors)this.controls.throttle=0;return this.controls.doors;}
 emergency(){this.controls.emergency=true;this.controls.throttle=0;}
 resetEmergency(){if(Math.abs(this.speed)>.2)throw new Error('Bring the train to a stand before resetting.');this.controls.emergency=false;this.controls.brake=.7;this.protection=false;}
 step(dt,env,{safety=true,limit=120,danger=Infinity}={}){
  if(!(dt>0&&dt<=.1))throw new Error('Physics step must be in (0, 0.1] seconds.');const c=this.controls,v=Math.abs(this.speed),weather=WEATHER[env.weather]||WEATHER.clear;
  this.protection=false;
  if(safety&&v>.5&&(v*3.6>limit+9||danger<v*v/(2*.72)+22)){this.protection=true;if(danger<Math.max(12,v*.7))this.emergency();}
  const handle=c.emergency?1:Math.max(c.brake,this.protection?.75:0);const pipeTarget=5*(1-handle);const pipeRate=pipeTarget<this.pipe?(c.emergency?2.6:1.15):.42;this.pipe+=clamp(pipeTarget-this.pipe,-pipeRate*dt,pipeRate*dt);this.reservoir=clamp(this.reservoir+(c.master?.09:0)*dt-Math.max(0,pipeTarget-this.pipe)*.02*dt,0,9);
  let brakeAvg=0;for(let i=0;i<this.cylinders.length;i++){const target=i===0?clamp((5-this.pipe)/3.5,0,1):this.cylinders[i-1];const rate=i===0?4:2.8;this.cylinders[i]+=clamp(target-this.cylinders[i],-rate*dt,rate*dt);brakeAvg+=this.cylinders[i]*(i===0?this.stock.mass:this.stock.carMass);}brakeAvg/=this.mass;
  this.doorAmount=lerp(this.doorAmount,+c.doors,Math.min(1,dt*2));
  const available=c.master&&!c.parking&&!c.doors&&!c.emergency&&!this.protection&&!this.derailed&&(!this.electric||(c.pantograph&&env.electrified!==false))&&(this.electric||this.fuel>0);
  this.throttleLag=lerp(this.throttleLag,available?c.throttle:0,Math.min(1,dt*(this.stock.kind==='steam'?.7:1.4)));
  let power=this.stock.power;
  if(this.stock.kind==='steam'){if(c.fireman){this.fire=lerp(this.fire,60+c.throttle*30,dt*.03);this.water=clamp(this.water+(this.water<55?.25:-.006)*dt,0,100);}this.boiler=clamp(this.boiler+((this.fire/100)*.058-this.throttleLag*(.055+v*.0008)-.003)*dt,2,16);power*=clamp((this.boiler-2)/11,0,1);this.water=clamp(this.water-this.throttleLag*.008*dt,0,100);}
  const nominal=Math.min(this.stock.tractive,power/Math.max(v,2.5))*this.throttleLag;
  const mu=clamp(.27-weather.wet*.13-(env.weather==='snow'?.04:0)+(c.sand?.075:0),.075,.36);
  const adhesion=Math.min(this.stock.drivenMass,this.mass)*G*mu;
  this.wheelslip=nominal>adhesion?clamp((nominal-adhesion)/adhesion,0,1):0;
  this.traction=available?Math.min(nominal,adhesion)*c.reverser:0;
  if(v*3.6>this.stock.maxSpeed&&Math.sign(this.traction)===Math.sign(this.speed))this.traction=0;
  this.grade=0;for(let i=0;i<=this.cars;i++)this.grade+=this.cursor.pose(this.carOffset(i)).grade*(i===0?this.stock.mass:this.stock.carMass);this.grade/=this.mass;
  const gravity=-this.mass*G*this.grade;const rolling=this.mass*G*.0014+this.mass*.000065*v+this.stock.drag*v*v;
  const airbrake=brakeAvg*this.mass*(c.emergency?1.32:1.08);const independent=c.independent*this.stock.mass*1.2;const dynamic=c.dynamic*Math.min(this.stock.power*.65/Math.max(v,5),this.stock.tractive*.65)*clamp(v/3,0,1);
  this.brakeForce=Math.min(airbrake+independent+dynamic+(c.parking?this.mass*2.1:0),this.mass*G*mu);
  let force=this.traction+gravity;const resistance=rolling+this.brakeForce;const old=this.speed;
  if(v<.035&&Math.abs(force)<=resistance){this.speed=0;this.acceleration=0;}else{const dir=v>.005?Math.sign(this.speed):Math.sign(force);force-=dir*resistance;this.acceleration=clamp(force/this.mass,-3.5,3.5);this.speed+=this.acceleration*dt;if(old*this.speed<0&&Math.abs(this.traction+gravity)<=resistance)this.speed=0;}
  if(this.derailed){this.speed*=Math.exp(-dt*1.8);this.controls.throttle=0;}
  this.speed=clamp(this.speed,-this.stock.maxSpeed/3.6*1.3,this.stock.maxSpeed/3.6*1.3);
  this.cursor.advance((old+this.speed)*.5*dt);
  const pose=this.cursor.pose();const curve=this.cursor.net.edges.get(pose.edge).curvature(pose.s);this.risk=v*v*curve;this.derailTimer=this.risk>2.8?this.derailTimer+dt:Math.max(0,this.derailTimer-dt*2);if(this.derailTimer>.8&&!this.derailed){this.derailed=true;this.failureReason='Excessive curve speed';this.emergency();this.events.push('Excessive curve speed. Train disabled; use Recover in the simulation panel.');}
  this.couplerForce=this.cars*this.stock.carMass*this.acceleration;
  const mechanical=Math.abs(this.traction*this.speed);this.energy+=(mechanical-(this.electric?dynamic*v*.55:0))*dt/3600000;
  if(!this.electric)this.fuel=clamp(this.fuel-(mechanical/(.32*36e6)+.002)*dt/25,0,100);
 }
 snapshot(){return {id:this.id,stock:this.stock.id,cars:this.cars,cursor:this.cursor.snapshot(),speed:this.speed,pipe:this.pipe,reservoir:this.reservoir,throttleLag:this.throttleLag,doorAmount:this.doorAmount,derailTimer:this.derailTimer,acceleration:this.acceleration,cylinders:[...this.cylinders],controls:{...this.controls},fuel:this.fuel,energy:this.energy,boiler:this.boiler,water:this.water,fire:this.fire,derailed:this.derailed,failureReason:this.failureReason,passengers:this.passengers,ai:this.ai,dwell:this.dwell,lastStation:this.lastStation};}
 restore(o){const st=STOCK.find(s=>s.id===o.stock);if(!st)throw new Error('Unknown rolling stock.');this.stock=st;this.cars=clamp(Math.round(Number(o.cars)||0),0,st.maxCars);this.cursor.restore(o.cursor);this.speed=clamp(Number(o.speed)||0,-100,100);this.pipe=clamp(Number(o.pipe)||0,0,5);this.cylinders=Array.from({length:this.cars+1},(_,i)=>clamp(Number(o.cylinders?.[i])||0,0,1));for(const key of Object.keys(this.controls)){const value=o.controls?.[key];if(typeof this.controls[key]==='boolean')this.controls[key]=!!value;else this.controls[key]=clamp(Number(value)||0,key==='reverser'?-1:0,1);}for(const key of ['fuel','energy','boiler','water','fire','passengers'])if(Number.isFinite(o[key]))this[key]=clamp(o[key],key==='energy'?-1e9:0,key==='energy'?1e9:10000);for(const [key,lo,hi] of [['reservoir',0,9],['throttleLag',0,1],['doorAmount',0,1],['derailTimer',0,10],['acceleration',-3.5,3.5]])if(Number.isFinite(o[key]))this[key]=clamp(o[key],lo,hi);this.ai=!!o.ai;this.derailed=!!o.derailed;this.failureReason=typeof o.failureReason==='string'?o.failureReason.slice(0,100):null;this.controls.reverser=Math.round(this.controls.reverser);this.dwell=clamp(Number(o.dwell)||0,0,120);this.lastStation=typeof o.lastStation==='string'?o.lastStation:null;}
}
class Traffic {
 constructor(network){this.net=network;this.occupied=new Map();this.holds=new Set();this.blockSize=400;this.intervals=new Map();}
 block(pose){return `${pose.edge}:${Math.floor(pose.s/this.blockSize)}`;}
 update(trains){
  this.occupied.clear();this.intervals.clear();
  for(const t of trains){
   const front=t.stock.locoLength*.5,rear=front-t.length;let start=t.cursor.pose(rear),edge=start.edge,lo=start.s,hi=start.s;
   const push=()=>{if(!this.intervals.has(edge))this.intervals.set(edge,[]);this.intervals.get(edge).push({id:t.id,lo,hi});};
   const n=Math.max(1,Math.ceil(t.length/8));
   for(let i=0;i<=n;i++){const pose=t.cursor.pose(rear+(front-rear)*i/n),key=this.block(pose);if(!this.occupied.has(key))this.occupied.set(key,new Set());this.occupied.get(key).add(t.id);if(pose.edge!==edge){hi=this.net.edges.get(edge).length;push();edge=pose.edge;lo=0;}hi=pose.s;}push();
  }
 }
 contacts(){const pairs=new Map();for(const list of this.intervals.values())for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){const a=list[i],b=list[j];if(a.id!==b.id&&Math.min(a.hi,b.hi)-Math.max(a.lo,b.lo)>.25){const ids=[a.id,b.id].sort();pairs.set(ids.join('|'),ids);}}return [...pairs.values()];}
 dangerDistance(train,max=1800){for(let d=30;d<=max;d+=25){const direction=Math.sign(train.speed)||train.controls.reverser||1,p=train.cursor.pose(direction<0?-train.length+train.stock.locoLength*.5-d:d),key=this.block(p),occ=this.occupied.get(key);if(this.holds.has(key)||(occ&&[...occ].some(id=>id!==train.id)))return Math.max(0,d-30);}return Infinity;}
 aspect(edge,s,trainId='player'){const cursor=new RailCursor(this.net,edge,s);let caution=false;for(let d=20;d<900;d+=80){const key=this.block(cursor.pose(d)),occ=this.occupied.get(key);if(this.holds.has(key)||(occ&&[...occ].some(id=>id!==trainId))){if(d<420)return 'red';caution=true;}}return caution?'yellow':'green';}
 switchLocked(trains){for(const t of trains)for(let off=15;off>-t.length-20;off-=25){const p=t.cursor.pose(off);if((p.edge==='approach'&&this.net.edges.get('approach').length-p.s<90)||(['main','branch'].includes(p.edge)&&p.s<100))return true;}return false;}
 controlAI(train,dt,stations,env){const p=train.cursor.pose(),e=this.net.edges.get(p.edge),danger=this.dangerDistance(train),v=Math.abs(train.speed);let target=Math.min(train.stock.maxSpeed,e.speedLimit(p.s+Math.max(80,v*8)))*.76/3.6;let closest=null,dist=Infinity;
  for(const st of stations){const d=train.cursor.distanceTo(st.edge,st.s);if(d<dist&&st.id!==train.lastStation){dist=d;closest=st;}}
  const c=train.controls;c.master=true;c.reverser=1;c.pantograph=true;c.parking=false;
  if(train.dwell>0){train.dwell-=dt;c.throttle=0;c.brake=.7;c.doors=true;if(train.dwell<=0)c.doors=false;return;}
  if(closest&&dist<14&&v<.22){train.dwell=18;train.lastStation=closest.id;c.doors=true;c.throttle=0;c.brake=.7;return;}
  const last=stations.find(s=>s.id===train.lastStation);if(last&&(p.edge!==last.edge||Math.abs(p.s-last.s)>160))train.lastStation=null;
  target=Math.min(target,Math.sqrt(Math.max(0,(dist-9)*2*.58)),Math.sqrt(Math.max(0,(danger-55)*2*.8)));
  c.doors=false;c.emergency=false;const error=target-v;c.throttle=error>0?clamp(error*.2,0,.82):0;c.brake=error<-.3?clamp(-error*.18,0,.85):0;c.dynamic=error<-.2?.15:0;
 }
}
function makeStations(network,world,extra=[]){const defs=[['approach',220],['approach',network.edges.get('approach').length*.73],['main',network.edges.get('main').length*.64],['return',network.edges.get('return').length*.3],['return',network.edges.get('return').length*.75]];return defs.map(([edge,s],i)=>({id:`station-${i}`,name:world.stations[i],edge,s,platform:180,dwell:20})).concat(extra.filter(s=>network.edges.has(s.edge)).map((s,i)=>({id:`custom-${i}`,name:s.name||`New station ${i+1}`,edge:s.edge,s:clamp(s.s,10,network.edges.get(s.edge).length-10),platform:150,dwell:20})));}
class Mission {
 constructor(mode='free'){this.mode=mode;this.score=1000;this.stops=0;this.boarded=0;this.target=null;this.dwell=0;this.complete=false;this.message='The railway is yours. Explore at your own pace.';this.lastId=null;this.penaltyClock=0;this.stopLog=[];}
 chooseTarget(train,stations){let nearest=null,dist=Infinity;for(const st of stations){if(st.id===this.lastId)continue;const d=train.cursor.distanceTo(st.edge,st.s);if(d<dist){dist=d;nearest=st;}}this.target=nearest;return dist;}
 step(dt,train,stations,limit){if(this.mode==='free'||this.complete)return;let distance=this.target?train.cursor.distanceTo(this.target.edge,this.target.s):this.chooseTarget(train,stations);if(!this.target)return;
  const p=train.cursor.pose();const signed=p.edge===this.target.edge?this.target.s-p.s:distance;
  if(this.mode==='freight'){if(!this.target||this.target.id==='station-0')this.target=stations.at(-1);distance=train.cursor.distanceTo(this.target.edge,this.target.s);if(distance<20&&Math.abs(train.speed)<.15){this.complete=true;this.score+=500;this.message='Freight delivered. Excellent work.';}else this.message=`Deliver your consist to ${this.target.name}`;return;}
  if(signed< -35&&p.edge===this.target.edge){this.score=Math.max(0,this.score-120);this.lastId=this.target.id;this.stopLog.push({station:this.target.name,result:'Missed'});this.dwell=0;this.chooseTarget(train,stations);return;}
  if(Math.abs(signed)<18&&Math.abs(train.speed)<.15&&train.controls.doors){this.dwell+=dt;this.message=`Boarding at ${this.target.name} · ${Math.ceil(this.target.dwell-this.dwell)} s`;if(this.dwell>=this.target.dwell){const count=24+Math.floor((train.cursor.odometer%35));this.boarded+=count;train.passengers=clamp(train.passengers+count-12,0,train.cars*train.stock.capacity);this.stops++;this.score+=Math.round(120-Math.abs(signed)*2);this.stopLog.push({station:this.target.name,result:`Stopped ${Math.abs(signed).toFixed(1)} m from marker`});this.lastId=this.target.id;this.dwell=0;if(this.stops>=3){this.complete=true;this.message='Service complete. Thank you for a smooth journey.';}else{this.chooseTarget(train,stations);this.message='Boarding complete. Close the doors and depart.';}}}else{this.dwell=0;this.message=`Call at ${this.target.name}. Stop at the marker and open doors.`;}
  this.penaltyClock+=dt;if(this.penaltyClock>=1){this.penaltyClock=0;if(Math.abs(train.speed)*3.6>limit+3)this.score=Math.max(0,this.score-3);if(Math.abs(train.acceleration)>1.1)this.score=Math.max(0,this.score-1);if(train.protection)this.score=Math.max(0,this.score-2);}
 }
}

return {Train,Traffic,makeStations,Mission};
})();
// ---- src/world.js ----
const __m_src_world_js = (() => {
const {planSettlements,buildSettlements} = __m_src_settlements_js;
const {buildLivingForest,addLivingTree} = __m_src_botany_js;
const {foundation,buildingFoundation,buildViaducts} = __m_src_cinematic_models_js;
const {buildShoreline} = __m_src_world_life_js;
const {TerrainField, GENERATOR_VERSION} = __m_src_generation_js;
const {buildExpeditionTerrain, buildEcosystem, buildLandmarks, buildCivilEngineering} = __m_src_world_detail_js;
const {clamp,lerp,smooth,fbm,noise2,rng,hex,add,sub,mul,norm,cross,frameMatrix,transform,mat4Mul,pointTransform,TAU} = __m_src_math_js;
const {Geometry,MeshBuilder,SceneBuilder,PRIMITIVES} = __m_src_geometry_js;
const {RailNetwork} = __m_src_tracks_js;
const {makeStations} = __m_src_physics_js;










const C={rail:hex('#a0a4a0'),railSide:hex('#5f6663'),tie:hex('#837d6d'),ballast:hex('#8e9187'),concrete:hex('#c2beb0'),dark:hex('#333b38'),trunk:hex('#584b3b'),lamp:hex('#ffde9b')};
class RailwayWorld {
 constructor(def,editor={},preparedTerrain=null){this.def=def;this.editor={seed:def.seed,generationVersion:GENERATOR_VERSION,generation:{relief:1,vegetation:1,erosion:.65},objects:[],heightEdits:[],stations:[],customTrack:null,electrified:true,...editor};this.seed=this.editor.seed;this.terrain=this.editor.generationVersion===2?null:(preparedTerrain||new TerrainField(def,this.seed,this.editor.generation).prepare());this.network=new RailNetwork(def,this.editor.customTrack,{seed:this.seed,generationVersion:this.editor.generationVersion,terrain:this.terrain,generation:this.editor.generation});this.stations=makeStations(this.network,def,this.editor.stations);this.batches=[];this.signals=[];this.viewpoints=[];this.features={bridges:0,trees:0,buildings:0,shrubs:0,flowers:0,landmarks:0,cuttings:0};this.builder=new SceneBuilder();this.heightCache=new Map();this.random=rng(this.seed);}
 static async create(def,editor={}) {
  if(editor.generationVersion===2||typeof Worker==='undefined'||globalThis.RAILBOUND_STANDALONE)return new RailwayWorld(def,editor);
  const terrain=new TerrainField(def,editor.seed||def.seed,editor.generation);
  try {
   const data=await new Promise((resolve,reject)=>{
    const worker=new Worker('src/generation-worker.js',{type:'module'});
    const timer=setTimeout(()=>{worker.terminate();reject(new Error('Terrain worker timed out'));},30000);
    const finish=(fn,value)=>{clearTimeout(timer);worker.terminate();fn(value);};
    worker.onmessage=e=>e.data.error?finish(reject,new Error(e.data.error)):finish(resolve,e.data);
    worker.onerror=e=>finish(reject,new Error(e.message));
    worker.postMessage({def,seed:terrain.seed,options:terrain.options});
   });
   terrain.heights=data.heights;terrain.flow=data.flow;terrain.stats=data.stats;terrain.execution='worker';
  } catch {terrain.prepare();}
  return new RailwayWorld(def,editor,terrain);
 }
 baseHeight(x,z){if(this.terrain){let h=this.terrain.height(x,z);for(const e of this.editor.heightEdits){const d=Math.hypot(x-e.x,z-e.z)/e.radius;if(d<1)h+=e.delta*(1-d*d)**2;}return h;}const w=this.def,r=Math.hypot(x/w.rx,z/w.rz);const n=fbm(x*.00065,z*.00065,this.seed),detail=fbm(x*.004,z*.004,this.seed+43,3);const bank=smooth(.72,1.13,r);let h=w.water-16+bank*68;const mountain=smooth(1.05,1.72,r);let ridge=Math.pow(Math.abs(n-.48)*2.3,.8)*.60+detail*.42;h+=mountain*ridge*w.mountains;h+=bank*(detail-.45)*18;
  if(w.theme==='canyon'){h=w.water-18+bank*86+mountain*(Math.floor(n*11)/11*.6+detail*.3)*w.mountains;}
  if(w.theme==='metro')h=w.water-8+bank*35+mountain*n*120;
  if(w.theme==='sakura')h=w.water-8+bank*42+mountain*ridge*w.mountains;
  for(const e of this.editor.heightEdits){const d=Math.hypot(x-e.x,z-e.z)/e.radius;if(d<1)h+=e.delta*(1-d*d)**2;}
  return h;
 }
 height(x,z){let h=this.baseHeight(x,z);const near=this.network.nearest(x,z,this.terrain?70:38);if(near){const bridge=near.p[1]-h>13;if(!bridge){const target=near.p[1]-.38;h=lerp(target,h,smooth(this.terrain?14:4,this.terrain?60:32,near.distance));}}
  for(const st of this.stations){const p=this.network.edges.get(st.edge).at(st.s-60),dx=x-p.p[0],dz=z-p.p[2];const along=dx*p.f[0]+dz*p.f[2],across=dx*p.right[0]+dz*p.right[2];if(across>1&&across<100&&Math.abs(along)<150){const t=smooth(100,150,Math.abs(along))*1+smooth(55,100,across);h=lerp(p.p[1]-.4,h,clamp(t,0,1));}}
  return h;
 }
 async build(onProgress=()=>{}){if(this.terrain)this.districts=planSettlements(this);onProgress('Shaping terrain',.12);await new Promise(r=>setTimeout(r,0));if(this.terrain)await buildExpeditionTerrain(this,onProgress);else this.buildTerrain();onProgress('Laying rail and bridges',.36);await new Promise(r=>setTimeout(r,0));this.buildTracks();if(this.terrain)buildCivilEngineering(this,false);onProgress('Building stations and villages',.56);await new Promise(r=>setTimeout(r,0));this.buildStations();if(this.terrain)await buildSettlements(this,onProgress);else this.buildTownscapes();onProgress('Planting forests',.73);await new Promise(r=>setTimeout(r,0));if(this.terrain){await buildLivingForest(this,onProgress);buildLandmarks(this);}else this.buildVegetation();this.buildDecorations();this.buildWater();buildShoreline(this);this.forest?.finish();this.batches=this.builder.finish();onProgress('Preparing the railway',.92);return this;}
 buildTerrain(){const b=this.builder,w=this.def,span=Math.max(w.rx,w.rz)*2.8,chunk=span/8,N=24;for(let iz=-8;iz<8;iz++)for(let ix=-8;ix<8;ix++){const verts=[],inds=[],x0=ix*chunk,z0=iz*chunk,step=chunk/N;for(let z=0;z<=N;z++)for(let x=0;x<=N;x++){const wx=x0+x*step,wz=z0+z*step,h=this.height(wx,wz);const e=5,n=norm([this.height(wx-e,wz)-this.height(wx+e,wz),2*e,this.height(wx,wz-e)-this.height(wx,wz+e)]);verts.push(wx,h,wz,...n,wx*.01,wz*.01);}for(let z=0;z<N;z++)for(let x=0;x<N;x++){const i=z*(N+1)+x;inds.push(i,i+N+1,i+1,i+1,i+N+1,i+N+2);}const center=[x0+chunk/2,this.baseHeight(x0+chunk/2,z0+chunk/2),z0+chunk/2];const batch=b.mesh(new Geometry(verts,inds),center,chunk*1.8,[1,.95,0,0]);batch.maxDistance=15000;}}
 buildWater(){const w=this.def,b=this.builder;const mesh=new MeshBuilder();const s=this.terrain?this.terrain.half:Math.max(w.rx,w.rz)*2.5;mesh.quad([-s,w.water,s],[s,w.water,s],[s,w.water,-s],[-s,w.water,-s],[0,1,0]);const batch=b.mesh(mesh.geometry(),[0,w.water,0],s*1.5,[2,.12,.1,0],hex(w.waterColor));batch.castShadow=false;batch.maxDistance=14000;}
 railCross(p,offset,y){return [p.p[0]+p.right[0]*offset,p.p[1]+y,p.p[2]+p.right[2]*offset];}
 buildTracks(){const b=this.builder,w=this.def;const electrified=this.editor.electrified;
  for(const edge of this.network.edges.values()){
   const n=Math.ceil(edge.length/3);const pieces=new Map();const getChunk=s=>{const c=Math.floor(s/210);if(!pieces.has(c))pieces.set(c,{rail:new MeshBuilder(),bed:new MeshBuilder(),center:edge.at(s).p});return pieces.get(c);};
   for(let i=0;i<n;i++){const s=i/n*edge.length,t=(i+1)/n*edge.length,p=edge.at(s),q=edge.at(t),chunk=getChunk(s);chunk.bed.quad(this.railCross(p,-2.25,-.22),this.railCross(q,-2.25,-.22),this.railCross(q,2.25,-.22),this.railCross(p,2.25,-.22),[0,1,0]);for(const side of [-1,1]){const off=side*.7175;const r0=this.railCross(p,off-.038,.19),r1=this.railCross(q,off-.038,.19),r2=this.railCross(q,off+.038,.19),r3=this.railCross(p,off+.038,.19);chunk.rail.quad(r0,r1,r2,r3,[0,1,0]);chunk.rail.quad(this.railCross(p,off-.031,.025),this.railCross(q,off-.031,.025),r1,r0);chunk.rail.quad(r3,r2,this.railCross(q,off+.031,.025),this.railCross(p,off+.031,.025));}
   }
   for(const c of pieces.values()){const bed=b.mesh(c.bed.geometry(),c.center,180,[7,.96,0,0],C.ballast);bed.maxDistance=5800;const rail=b.mesh(c.rail.geometry(),c.center,180,[0,.26,.85,0],C.rail);rail.maxDistance=4800;}
   for(let s=0;s<edge.length;s+=.86){const p=edge.at(s);b.oriented('box',frameMatrix(add(p.p,[0,-.015,0]),p.f,[2.7,.19,.25]),C.tie,[0,.96,0,0]);}
   if(electrified){for(let s=0;s<edge.length;s+=54){const p=edge.at(s),q=edge.at(Math.min(s+54,edge.length));const pole=this.railCross(p,-3.2,3.7);b.oriented('box',frameMatrix(pole,p.f,[.16,7.4,.17]),C.railSide,[0,.55,.5,0]);b.oriented('box',frameMatrix(this.railCross(p,-1.65,6.35),p.f,[3.5,.12,.13]),C.railSide,[0,.55,.5,0]);b.segment(this.railCross(p,-3.1,7.0),this.railCross(p,-.3,6.35),.065,C.railSide);b.instance('cylinder',this.railCross(p,-.1,6.15),[.16,.36,.16],hex('#4b544b'),[0,.45,.1,0]);b.segment(this.railCross(p,0,5.92),this.railCross(q,0,5.92),.027,C.dark,[0,.3,.5,0]);b.segment(this.railCross(p,0,6.65),this.railCross(q,0,6.65),.02,C.dark);b.segment(this.railCross(p,0,5.92),this.railCross(p,0,6.65),.022,C.dark);}}
   for(let s=360;s<edge.length-35;s+=400){const p=edge.at(s),pos=this.railCross(p,3.3,0);b.instance('cylinder',add(pos,[0,2.6,0]),[.14,5.2,.14],C.railSide);b.oriented('box',frameMatrix(add(pos,[0,5.1,0]),p.f,[.62,1.64,.25]),C.dark);this.signals.push({edge:edge.id,s,pos: add(pos,[0,5.1,0]),f:p.f});}
  }
  buildViaducts(this);this.buildJunction();this.buildGallery();
 }
 buildJunction(){const b=this.builder,p=this.network.edges.get('approach').at(this.network.edges.get('approach').length-12);b.oriented('box',frameMatrix(this.railCross(p,2.8,.18),p.f,[1.1,.36,.65]),hex('#827b66'));b.instance('cylinder',this.railCross(p,3.5,.7),[.07,1.2,.07],C.dark);b.oriented('box',frameMatrix(this.railCross(p,3.5,1.4),p.f,[.58,.32,.12]),hex('#e9c568'));}
 buildGallery(){const b=this.builder,w=this.def;if(['metro','sakura','coast'].includes(w.theme))return;const edge=this.network.edges.get('main'),start=edge.length*.46;for(let s=start;s<start+90;s+=6){const p=edge.at(s);b.oriented('box',frameMatrix(add(p.p,[0,6.3,0]),p.f,[9,1.5,6.15]),hex('#aaa89b'),[6,.95,0,0]);for(const side of [-1,1])b.oriented('box',frameMatrix(this.railCross(p,side*3.65,2.7),p.f,[.8,5.8,.85]),hex('#aaa89b'),[6,.95,0,0]);if(w.theme==='alpine'||w.theme==='nordic')b.oriented('box',frameMatrix(this.railCross(p,-4.2,3.6),p.f,[1.2,7.7,6.15]),hex(w.rock),[6,.96,0,0]);}}
 buildStations(){const b=this.builder,w=this.def;for(const st of this.stations){const edge=this.network.edges.get(st.edge);for(let ds=-st.platform;ds<14;ds+=7){const p=edge.at(st.s+ds);b.oriented('box',frameMatrix(this.railCross(p,4.7,.34),p.f,[5.8,1.1,7.1]),C.concrete,[6,.95,0,0]);b.oriented('box',frameMatrix(this.railCross(p,2.02,.905),p.f,[.3,.025,7.05]),hex('#d5be66'));b.oriented('box',frameMatrix(this.railCross(p,7.34,.95),p.f,[.1,.18,7.05]),hex('#a2a399'));}
   for(let ds=-140;ds<-25;ds+=12){const p=edge.at(st.s+ds);b.oriented('box',frameMatrix(this.railCross(p,5.1,5.2),p.f,[6.8,.23,12.12]),w.theme==='metro'?hex('#89909b'):hex('#717d75'),[0,.7,.25,0]);b.oriented('box',frameMatrix(this.railCross(p,6.5,3),p.f,[.18,4.4,.18]),C.dark,[0,.55,.4,0]);b.oriented('box',frameMatrix(this.railCross(p,4.4,4.96),p.f,[.22,.1,3]),C.lamp,[4,.5,0,2.5]);}
   for(let ds=-155;ds<10;ds+=28){const p=edge.at(st.s+ds);b.instance('cylinder',this.railCross(p,7.6,3.7),[.12,5.6,.12],C.dark);b.instance('sphere',this.railCross(p,7.6,6.5),[.42,.35,.42],C.lamp,[4,.4,0,1.2]);}
   const p=edge.at(st.s-92),yaw=Math.atan2(p.f[0],p.f[2]);this.buildHouse(this.railCross(p,16.4,0),[12,7.8,32],yaw,true);b.oriented('box',frameMatrix(this.railCross(p,12,3),p.f,[.16,2.7,5.5]),hex('#263b3f'));b.oriented('box',frameMatrix(this.railCross(p,2.4,2.15),p.f,[.12,1.05,.6]),hex('#e4e2cf'));b.oriented('box',frameMatrix(this.railCross(p,2.4,2.14),p.f,[.13,.75,.42]),hex('#42534f'));
   for(let ds=-110;ds<-30;ds+=32){const pp=edge.at(st.s+ds);b.oriented('box',frameMatrix(this.railCross(pp,6.1,1.5),pp.f,[.75,.13,2.1]),hex('#675a46'));for(const z of [-.65,.65]){const pp2=edge.at(st.s+ds+z);b.oriented('box',frameMatrix(this.railCross(pp2,6.1,1.18),pp2.f,[.62,.65,.08]),C.dark);} }
   for(let i=0;i<9;i++){const pp=edge.at(st.s-25-i*11);this.buildPerson(this.railCross(pp,3.1+(i%3)*.8,1.01),i);}
  }}
 buildPerson(p,seed){const b=this.builder;const colors=['#4c687a','#a28872','#667663','#9b5851','#3d454d'];b.instance('cylinder',add(p,[0,.68,0]),[.42,.82,.30],hex(colors[seed%colors.length]));b.instance('sphere',add(p,[0,1.27,0]),[.29,.35,.29],hex('#c9a98b'));for(const side of [-1,1])b.instance('box',add(p,[side*.11,.22,0]),[.14,.47,.17],C.dark);}
 buildHouse(p,size,yaw=0,station=false){p=buildingFoundation(this,p,size,yaw,station);const b=this.builder,w=this.def,[sx,sy,sz]=size;const stone=['highland','alpine','nordic'].includes(w.theme);const bodyColor=station?hex('#d9cfb4'):hex(stone?'#c3c0ad':w.theme==='canyon'?'#c1a084':'#d0c7b3');const base=transform(p,[1,1,1],yaw);const part=(pos,scale,col,props=[0,.86,0,0],roll=0)=>b.oriented('box',mat4Mul(base,transform(pos,scale,0,0,roll)),col,props);
  part([0,sy*.5,0],[sx,sy,sz],bodyColor,[6,.96,0,0]);const roofColor=hex(w.theme==='nordic'?'#615c59':w.theme==='sakura'?'#525b5a':w.theme==='highland'?'#5f635e':'#7a6250');part([-sx*.265,sy+sx*.12,0],[sx*.58,.24,sz+1],roofColor,[0,.85,0,0],.42);part([sx*.265,sy+sx*.12,0],[sx*.58,.24,sz+1],roofColor,[0,.85,0,0],-.42);
  for(const side of [-1,1])for(let z=-sz*.35;z<=sz*.35;z+=Math.max(2.8,sz/7)){part([side*(sx*.5+.03),sy*.52,z],[.05,sy*.27,1.35],hex('#435c61'),[3,.18,.2,0]);part([side*(sx*.5+.08),sy*.37,z],[.15,.08,1.55],hex('#e0dac6'));}
  for(const end of [-1,1])for(const x of [-sx*.27,sx*.27]){part([x,sy*.58,end*(sz*.5+.035)],[1.45,1.8,.08],hex('#3d5358'),[3,.26,.15,0]);part([x,sy*.58,end*(sz*.5+.082)],[.065,1.82,.035],hex('#d7d0bd'));part([x,sy*.58,end*(sz*.5+.084)],[1.46,.065,.035],hex('#d7d0bd'));part([x,sy*.58-.94,end*(sz*.5+.09)],[1.66,.10,.20],hex('#d2cbb6'));}
  for(const side of [-1,1]){part([side*(sx*.5+.13),sy-.08,0],[.14,.18,sz+.4],hex('#4a504a'),[0,.8,.25,0]);part([side*(sx*.5+.02),.23,0],[.08,.46,sz],hex('#a29e8e'),[6,.9,0,0]);}
  part([0,sy*.32,sz*.5+.03],[sx*.17,sy*.60,.07],hex('#5d675c'));part([sx*.27,sy+sx*.32,sz*.27],[1,2.7,1.1],hex('#92897b'));this.features.buildings++;}
 buildTownscapes(){const b=this.builder,w=this.def,r=this.random;for(const st of this.stations){const origin=this.network.edges.get(st.edge).at(st.s-60);const yaw=Math.atan2(origin.f[0],origin.f[2]);const count=w.theme==='metro'?64:w.theme==='canyon'?12:25;for(let i=0;i<count;i++){const along=(r()-.5)*600,across=35+r()*290;const p=add(add(origin.p,mul(origin.f,along)),mul(origin.right,across));p[1]=this.height(p[0],p[2]);if(p[1]<w.water+3)continue;const size=[7+r()*8,4.5+r()*5,8+r()*11];if(w.theme==='metro'){size[0]=18+r()*23;size[1]=20+r()**2*160;size[2]=18+r()*22;this.buildTower(p,size,yaw);}else {const rotation=yaw+(r()-.5)*.3;if(foundation(this,p,size,rotation).spread>size[1]*.75)continue;if(this.network.nearest(p[0],p[2],Math.hypot(size[0],size[2])*.55+7))continue;this.buildHouse(p,size,rotation);}}
   for(let ds=-230;ds<200;ds+=12){const pp=add(add(origin.p,mul(origin.f,ds)),mul(origin.right,29));pp[1]=this.height(pp[0],pp[2])+.05;b.oriented('box',frameMatrix(pp,origin.f,[7,.08,12.1]),hex('#676c66'),[6,.97,0,0]);b.oriented('box',frameMatrix(add(pp,[0,.047,0]),origin.f,[.12,.01,4]),hex('#d0cbbb'));}
   for(let i=0;i<7;i++){const pp=add(add(origin.p,mul(origin.f,-70+i*12)),mul(origin.right,23));pp[1]=this.height(pp[0],pp[2]);this.buildCar(pp,yaw,i);}
  }
  if(w.theme==='sakura'){for(let i=0;i<120;i++){const x=(r()-.5)*w.rx*3,z=(r()-.5)*w.rz*3,h=this.height(x,z);if(h<w.water+8||h>w.railY+25)continue;b.instance('box',[x,h+.08,z],[30,.13,55],hex(i%2?'#98ad66':'#7c9a60'),[6,.95,0,0]);}}
  if(w.theme==='coast'){const p=this.network.edges.get('return').at(400);const pos=add(p.p,mul(p.right,55));pos[1]=this.height(pos[0],pos[2]);b.instance('cylinder',add(pos,[0,12,0]),[6,24,6],hex('#e6dfcb'));b.instance('cylinder',add(pos,[0,24,0]),[7.5,2,7.5],hex('#9d5a4c'));b.instance('cylinder',add(pos,[0,27,0]),[4.2,4,4.2],hex('#d1dccb'),[3,.25,.2,0]);b.instance('cone',add(pos,[0,30,0]),[7,3,7],hex('#654a41'));}
 }
 buildTower(p,size,yaw){p=buildingFoundation(this,p,size,yaw);const b=this.builder,[sx,sy,sz]=size;const base=transform(p,[1,1,1],yaw);b.oriented('box',mat4Mul(base,transform([0,sy*.5,0],size)),hex('#555f69'),[3,.4,.2,0]);for(let y=3;y<sy;y+=3.3){for(const side of [-1,1]){b.oriented('box',mat4Mul(base,transform([side*(sx/2+.04),y,0],[.13,.17,sz+.1])),hex('#869398'));for(let z=-sz/2+2;z<sz/2;z+=3.6){const lit=((y*5+z*3+sx)|0)%4!==0;b.oriented('box',mat4Mul(base,transform([side*(sx/2+.09),y+1.25,z],[.025,1.7,2.2])),lit?hex('#ccb987'):hex('#2b414e'),[lit?4:3,.3,.1,lit?1.25:0]);}}}this.features.buildings++;}
 buildCar(p,yaw,index){const b=this.builder,base=transform(p,[1,1,1],yaw);const color=hex(['#bdc3bf','#455c67','#894e43','#b9ac8f'][index%4]);b.oriented('body',mat4Mul(base,transform([0,.8,0],[1.75,.8,4.2])),color,[0,.3,.5,0]);b.oriented('body',mat4Mul(base,transform([0,1.35,-.12],[1.52,.8,2.35])),hex('#35474b'),[3,.2,.3,0]);for(const x of [-.85,.85])for(const z of [-1.25,1.25])b.oriented('cylinder',mat4Mul(base,transform([x,.43,z],[.6,.18,.6],0,0,Math.PI*.5)),C.dark);}
 buildVegetation(){const w=this.def,r=this.random,b=this.builder;const desired=Math.round(w.trees*1.65);let placed=0;for(let tries=0;tries<desired*6&&placed<desired;tries++){const x=(r()-.5)*w.rx*4,z=(r()-.5)*w.rz*4;const h=this.height(x,z);if(h<w.water+2||h>w.snowLine+20)continue;const near=this.network.nearest(x,z,22);if(near&&near.distance<8)continue;let stationArea=false;for(const st of this.stations){const p=this.network.edges.get(st.edge).at(st.s-65);const d=sub([x,h,z],p.p),side=d[0]*p.right[0]+d[2]*p.right[2],along=d[0]*p.f[0]+d[2]*p.f[2];if(side>-32&&side<38&&Math.abs(along)<180)stationArea=true;}if(stationArea)continue;const h1=this.baseHeight(x+8,z),h2=this.baseHeight(x,z+8);if(Math.abs(h1-h)>17||Math.abs(h2-h)>17)continue;if(noise2(x*.005,z*.005,this.seed)<.26)continue;
  const scale=10+r()*14;this.tree([x,h,z],scale,r());placed++;}
  this.features.trees=placed;
  for(let i=0;i<130;i++){const edge=[...this.network.edges.values()][i%4],p=edge.at(r()*edge.length),pos=add(p.p,mul(p.right,(r()>.5?1:-1)*(18+r()*75)));pos[1]=this.height(pos[0],pos[2]);if(pos[1]<w.water)continue;b.instance('sphere',add(pos,[0,1.4,0]),[3+r()*7,2+r()*4,3+r()*6],hex(w.rock),[6,.95,0,0],r()*TAU);}
 }
 tree(p,height,variation=.5){if(this.terrain){addLivingTree(this,p,height,variation);return;}const b=this.builder,w=this.def;const snow=w.theme==='nordic'&&p[1]>120;const trunkHeight=height*.78;
  if(w.theme==='canyon'){b.instance('cylinder',add(p,[0,height*.14,0]),[.4,height*.28,.4],hex('#6a7a50'));b.instance('sphere',add(p,[0,height*.27,0]),[2.5,2,2.5],hex('#7f895b'),[5,.9,0,0]);return;}
  b.instance('cylinder',add(p,[0,trunkHeight*.5,0]),[height*.036,trunkHeight,height*.036],C.trunk,[0,.98,0,0]);const broad=['sakura','pine','coast','metro'].includes(w.theme)&&variation>.35;
  if(broad){const color=hex(w.theme==='sakura'&&variation>.64?'#cda3af':variation>.7?'#718252':'#4f7454');for(let i=0;i<3;i++)b.instance('foliage',add(p,[(i-1)*height*.16,height*(.66+i*.09),Math.sin(i*3)*height*.14]),[height*.55,height*.51,height*.54],color,[5,.95,0,0]);}
  else{const color=snow?hex('#afbcba'):hex(variation>.5?'#385c48':'#446950');b.instance('pine',add(p,[0,height*.12,0]),[height*.5,height*.9,height*.5],color,[5,.95,0,0],variation*TAU);}
 }
 buildDecorations(){for(const o of this.editor.objects){const p=[o.x,this.height(o.x,o.z),o.z];if(o.type==='tree')this.tree(p,o.size||18,.7);else if(o.type==='building')this.buildHouse(p,[12,8,15],o.rotation||0);else if(o.type==='rock')this.builder.instance('sphere',add(p,[0,3,0]),[9,6,8],hex(this.def.rock),[6,.94,0,0]);}}
}

return {RailwayWorld};
})();
// ---- src/train-detail.js ----
const __m_src_train_detail_js = (() => {
const {PRIMITIVES,Geometry,MeshBuilder} = __m_src_geometry_js;
const {hex,transform,mat4Mul,frameMatrix,pointTransform,add,sub,mul,norm,TAU} = __m_src_math_js;
/** Detailed rolling-stock assemblies, baked by material and independently LOD'd.
 * No imported model or texture: every wheel flange, coil, pipe and grille is geometry.
 */


const STEEL=[0,.26,.82,0],PAINT=[0,.40,.40,0],RUBBER=[0,.96,0,0],GLASS=[3,.12,.28,0];
const silver=hex('#a8afaa'),dark=hex('#273330'),rubber=hex('#151d1c'),brass=hex('#b09a61');

function wheelGeometry() {
 const profile=[[-.56,.39],[-.52,.51],[-.34,.53],[-.25,.48],[.30,.48],[.48,.43],[.51,.23],[.57,.19]],segments=32;
 const vertices=[],indices=[];
 for(let j=0;j<profile.length;j++) {
  const [y,r]=profile[j],a=profile[Math.max(0,j-1)],b=profile[Math.min(profile.length-1,j+1)],ny=-(b[1]-a[1]),nr=b[0]-a[0];
  for(let i=0;i<=segments;i++){const t=i/segments*TAU,n=norm([Math.cos(t)*nr,ny,Math.sin(t)*nr]);vertices.push(Math.cos(t)*r,y,Math.sin(t)*r,...n,i/segments,j/(profile.length-1));}
 }
 for(let j=0;j<profile.length-1;j++)for(let i=0;i<segments;i++){const a=j*(segments+1)+i,b=a+segments+1;indices.push(a,b,a+1,a+1,b,b+1);}
 return new Geometry(vertices,indices);
}
function springGeometry() {
 const b=new MeshBuilder(),turns=5,steps=70,sides=6,r=.33,tube=.065;
 const point=(i,j)=>{const t=i/steps,angle=t*TAU*turns,u=j/sides*TAU;return [Math.cos(angle)*(r+Math.cos(u)*tube),t-.5+Math.sin(u)*tube,Math.sin(angle)*(r+Math.cos(u)*tube)];};
 for(let i=0;i<steps;i++)for(let j=0;j<sides;j++)b.quad(point(i,j),point(i,j+1),point(i+1,j+1),point(i+1,j));
 return b.geometry();
}
function noseGeometry() {
 const rings=18,segments=32,vertices=[],indices=[];
 for(let j=0;j<=rings;j++) {
  const t=j/rings,width=.5*(1-.9*t**1.7),height=.49*(1-.84*t**1.15),y=-.24*t,z=-.5+t*1.13;
  for(let i=0;i<=segments;i++){const angle=i/segments*TAU,ca=Math.cos(angle),sa=Math.sin(angle),n=norm([ca,sa,.6*t]);vertices.push(ca*width,sa*height+y,z,...n,i/segments,t);}
 }
 for(let j=0;j<rings;j++)for(let i=0;i<segments;i++){const a=j*(segments+1)+i,b=a+segments+1;indices.push(a,a+1,b,b,a+1,b+1);}
 return new Geometry(vertices,indices);
}
PRIMITIVES.wheel=wheelGeometry();PRIMITIVES.spring=springGeometry();PRIMITIVES.nose=noseGeometry();

function assembler() {
 const parts=[];
 const part=(g,p,s,c=dark,pr=PAINT,rot=[0,0,0],role='detail',tier=1)=>parts.push({g,m:transform(p,s,...rot),c,pr,role,tier});
 const box=(p,s,c=dark,pr=PAINT,role='detail',tier=1)=>part('box',p,s,c,pr,[0,0,0],role,tier);
 const pipe=(a,b,width=.055,c=silver,role='detail',tier=1)=>parts.push({g:'cylinder',m:mat4Mul(frameMatrix(mul(add(a,b),.5),sub(b,a)),transform([0,0,0],[width,Math.hypot(...sub(b,a)),width],0,Math.PI/2,0)),c,pr:STEEL,role,tier});
 return {parts,part,box,pipe};
}

function vehicleDetails(stock,index,last) {
 const {parts,part,box,pipe}=assembler(),loco=index===0,L=loco?stock.locoLength:stock.carLength,color=hex(stock.color),stripe=hex(stock.stripe),freight=stock.kind==='diesel'&&!loco;
 // Longitudinal solebars, battery boxes, air reservoirs, brake distributors,
 // underfloor cable trays and diagonal body supports are visible from trackside.
 for(const side of [-1,1]) {
  box([side*1.27,1.14,0],[.18,.50,L-1.8],dark,STEEL);
  for(let z=-L*.33;z<L*.34;z+=2.4){box([side*1.39,1.24,z],[.1,.26,.10],silver,STEEL,'detail',2);}
  pipe([side*.80,.85,-L*.33],[side*.80,.85,L*.33],.065,dark);
  box([side*.63,.73,-.8],[.92,.72,1.8],hex('#58615b'),PAINT);
  for(const z of [-L*.42,L*.42]) {
   for(let j=0;j<3;j++)box([side*1.66,1.1+j*.18,z],[.34,.06,.7],silver,STEEL);
   pipe([side*1.57,1.5,z+.44],[side*1.57,2.55,z+.44],.045,silver,'detail',2);
  }
 }
 for(const z of [-2.8,2.4])part('cylinder',[0,.76,z],[.66,1.45,.66],dark,STEEL,[0,0,Math.PI/2]);
 pipe([0,.88,-L*.43],[0,.88,L*.43],.08,hex('#6a6c58'));
 // End beams, coupler jaws, brake hoses and screw-coupling hardware.
 for(const end of [-1,1]) {
  const z=end*(L*.5+.28);box([0,1.16,z],[.42,.3,.55],dark,STEEL);
  box([.19,1.16,z+end*.28],[.14,.36,.23],silver,STEEL);
  for(const side of [-1,1]) {
   for(let j=0;j<7;j++){const t=j/7,u=(j+1)/7;pipe([side*.48,.92-Math.sin(t*Math.PI)*.44,z+t*.34*end],[side*.48,.92-Math.sin(u*Math.PI)*.44,z+u*.34*end],.05,rubber,'detail',2);}
   box([side*.7,1.38,z],[.12,.12,.07],end>0?hex('#b85d46'):hex('#b1a27e'),PAINT,'detail',2);
  }
 }
 if(!freight) {
  // Rubber window seals and body panel joints separate the glazing from paint.
  const end=loco&&stock.kind==='highspeed'?L*.22:L*.5-2.6;
  if(!(loco&&['diesel','steam'].includes(stock.kind)))for(const side of [-1,1]) {
   for(let z=-L*.5+2.6;z<end;z+=2.24) {
    for(const y of [3.12,4.24])box([side*1.615,y,z],[.026,.038,1.76],rubber,RUBBER,'seal',1);
    for(const dz of [-.86,.86])box([side*1.615,3.68,z+dz],[.026,1.16,.038],rubber,RUBBER,'seal',1);
   }
   for(let z=-L*.3;z<L*.29;z+=3.8)box([side*1.603,2.00,z],[.015,.1,.18],silver,STEEL,'detail',2);
   // Vented underfloor radiator cabinets, individual louvers at inspection LOD.
   box([side*1.42,1.20,1.8],[.18,.64,2.7],dark,STEEL);
   for(let z=.55;z<3;z+=.16)box([side*1.53,1.2,z],[.04,.5,.055],silver,STEEL,'detail',2);
  }
  if(!loco) {
   for(const end of [-1,1]) for(let i=0;i<8;i++) {
    const z=end*(L*.5+.03+i*.045);box([0,4.31,z],[2.45,.06,.045],rubber,RUBBER);for(const side of [-1,1])box([side*1.22,3.05,z],[.06,2.48,.045],rubber,RUBBER);
   }
   for(const z of [-L*.2,L*.2]){box([0,4.98,z],[1.6,.32,2.6],hex('#9aa29b'));for(let dz=-1;dz<=1;dz+=.25)box([0,5.15,z+dz],[1.25,.035,.08],dark,STEEL,'detail',2);}
  }
 }
 if(loco) {
  if(['electric','highspeed','metro'].includes(stock.kind)) {
   const roofEnd=stock.kind==='highspeed'?L*.5-7.7:L*.28;
   for(let z=-L*.31;z<roofEnd;z+=1.65) {
    for(const side of [-1,1]){part('spring',[side*.74,5.20,z],[.21,.42,.21],hex('#77745d'),PAINT,[0,0,0],'roof',2);pipe([side*.74,5.43,z],[side*.74,5.43,Math.min(z+1.65,roofEnd)],.055,hex('#a88756'),'roof');}
   }
   box([0,5.19,-L*.34],[1.5,.25,.66],dark,STEEL,'roof');
   for(const side of [-1,1])part('cone',[side*.58,5.27,Math.min(L*.26,roofEnd-.4)],[.24,.6,.24],silver,STEEL,[0,Math.PI/2,0],'roof');
  }
  if(stock.kind==='diesel') {
   for(const z of [-7,-3]) {
    part('cylinder',[0,5.04,z],[1.65,.07,1.65],rubber,STEEL);
    for(let i=0;i<12;i++){const t=i*TAU/12;pipe([Math.cos(t)*.2,5.10,z+Math.sin(t)*.2],[Math.cos(t)*.78,5.10,z+Math.sin(t)*.78],.05,silver,'detail',2);}
    for(let x=-.7;x<=.7;x+=.18)box([x,5.13,z],[.026,.025,1.4],dark,STEEL,'detail',2);
   }
   part('cylinder',[.35,5.12,-.4],[.33,.65,.33],dark,STEEL);
   for(const side of [-1,1])for(let z=-9;z<1;z+=1.65) {
    box([side*1.352,2.43,z],[.028,1.65,.018],dark,RUBBER,'detail',2);
    box([side*1.40,2.98,z+.45],[.025,.12,.2],silver,STEEL,'detail',2);
   }
   for(const z of [-L*.48,L*.48])for(let i=0;i<8;i++)box([-1.3+i*.34,1.65,z],[.17,.36,.08],i%2?stripe:hex('#e0b65e'));
  }
  if(stock.kind==='steam') {
   for(const side of [-1,1]) {
    pipe([side*1.08,3.7,-2],[side*1.08,3.7,8.4],.1,brass);
    pipe([side*.93,2.0,-1.2],[side*.93,2.0,6.8],.17,dark);
    part('cylinder',[side*1.17,1.30,5.8],[.74,2.0,.74],dark,STEEL,[0,Math.PI/2,0]);
    for(let z=-1.5;z<8.6;z+=.42)part('sphere',[side*1.17,3.46,z],[.075,.075,.075],silver,STEEL,[0,0,0],'detail',2);
   }
   for(const z of [-.4,1.1,3.8])part('cylinder',[0,4.51,z],[.26,.42,.26],brass,STEEL);
   // Individual coal lumps, and cab firebox controls.
   for(let i=0;i<45;i++)part('sphere',[(i%5-2)*.51,4.16+Math.sin(i*1.73)*.15,-11.4+Math.floor(i/5)*.5],[.6,.4,.7],rubber,RUBBER,[i,0,0],'detail',1);
   box([0,2.66,-2.34],[1.30,1.65,.3],dark,STEEL,'cab',1);
   part('sphere',[0,2.25,-2.52],[.58,.55,.12],hex('#d66b31'),[4,.8,0,.9],[0,0,0],'cab',1);
  }
  // Detailed cab desk: instrument bezels, switches, gauges, reverser lever,
  // seat frames and backrests. Visible only at useful inspection distances.
  const cabZ=stock.kind==='steam'?-4.4:L*.34;
  for(const side of [-1,1]) {
   box([side*.66,2.3,cabZ-.76],[.55,.16,.61],rubber,RUBBER,'cab');
   box([side*.66,2.70,cabZ-1.05],[.56,.87,.12],hex('#59645b'),PAINT,'cab');
   box([side*.66,1.86,cabZ-.8],[.10,.74,.12],silver,STEEL,'cab');
   for(let i=0;i<6;i++)part('cylinder',[side*.52+(i%3-.5)*.11,3.04,cabZ+.5+Math.floor(i/3)*.12],[.052,.065,.052],hex(i%3?'#c6bb93':'#b36b4b'),PAINT,[0,0,0],'cab',2);
   pipe([side*.90,2.94,cabZ+.35],[side*.90,3.2,cabZ+.5],.055,silver,'cab');
   part('sphere',[side*.90,3.2,cabZ+.5],[.13,.13,.13],rubber,RUBBER,[0,0,0],'cab');
  }
  for(let i=0;i<3;i++) {
   const x=-.4+i*.4;part('cylinder',[x,3.09,cabZ+.76],[.25,.05,.25],silver,STEEL,[0,0,0],'cab');
   part('cylinder',[x,3.12,cabZ+.76],[.21,.016,.21],hex('#d9d7c5'),PAINT,[0,0,0],'cab');
   box([x,3.135,cabZ+.73],[.009,.007,.09],dark,RUBBER,'cab',2);
  }
  if(!['steam','highspeed'].includes(stock.kind))for(const side of [-1,1]) {
   const z=L*.487;pipe([side*.75,3.22,z+.025],[side*.36,4.14,z+.025],.035,dark,'wiper',1);
   box([side*.45,4.34,z],[.20,.06,.08],silver,STEEL,'detail',2);
   for(const dx of [-.25,.25])box([side*1.01+dx,2.55,L*.503],[.025,.37,.04],dark,STEEL);
  }
 }
 if(freight) {
  if(index%4===0){for(const z of [-L*.27,L*.27])part('cylinder',[0,2.9,z],[2.86,.055,2.86],silver,STEEL,[0,Math.PI/2,0]);}
  else {
   for(const end of [-1,1]) {
    const z=end*(L*.5-1.39);box([0,2.95,z],[.035,2.49,.04],dark,RUBBER);
    for(const x of [-.94,-.44,.44,.94]){pipe([x,1.78,z+end*.05],[x,4.05,z+end*.05],.035,silver);box([x,2.7,z+end*.10],[.21,.04,.08],silver,STEEL,'detail',2);}
    for(const x of [-1.27,1.27])for(const y of [1.72,4.19])box([x,y,z],[.17,.15,.12],silver,STEEL);
   }
  }
  for(const side of [-1,1])for(const z of [-L*.38,L*.38]){box([side*1.47,1.65,z],[.23,.09,.27],hex('#bb9f60'));}
 }
 return parts;
}

function bogieDetails(heavy=false) {
 const {parts,box,part,pipe}=assembler();
 for(const side of [-1,1]) {
  for(const z of [-1.03,1.03]) {
   part('spring',[side*1.08,1.23,z],[.38,.51,.38],silver,STEEL,[0,0,0],'detail',1);
   box([side*1.22,.82,z],[.26,.26,.28],hex('#63736e'),STEEL);
   pipe([side*1.1,1.15,z-.25],[side*1.1,1.51,z+.23],.09,silver);
   box([side*.98,.72,z+.42],[.2,.30,.16],dark,STEEL);
   for(const dz of [-.10,.10])part('sphere',[side*1.37,.83,z+dz],[.045,.045,.045],silver,STEEL,[0,0,0],'detail',2);
  }
  part('cylinder',[side*.87,1.37,0],[.65,.29,.65],rubber,RUBBER);
  pipe([side*.92,.73,-1.0],[side*.92,.73,1.0],.045,silver);
  box([side*1.22,.92,0],[.14,.19,2.9],hex('#596860'),STEEL);
 }
 for(const z of [-1.03,1.03])for(const side of [-1,1])part('cylinder',[side*.70,.73,z],[.66,.055,.66],silver,STEEL,[0,0,Math.PI/2]);
 box([0,1.22,0],[1.55,.30,1.2],dark,STEEL);
 if(heavy)part('cylinder',[0,.80,0],[.52,1.6,.52],hex('#606b61'),STEEL,[0,0,Math.PI/2]);
 return parts;
}

/** Bake immutable local transforms once, preserving material, animation role and LOD.
 * The runtime transforms assemblies, not thousands of decorative individual parts.
 */
function bakeAssemblies(parts,prefix) {
 const groups=new Map();
 for(const p of parts) {
  const key=`${p.role}|${p.tier||0}|${p.c.join(',')}|${p.pr.join(',')}`;
  let group=groups.get(key);if(!group){group={role:p.role,tier:p.tier||0,c:p.c,pr:p.pr,v:[],i:[]};groups.set(key,group);}
  const geometry=PRIMITIVES[p.g];if(!geometry)throw new Error(`Unknown detail primitive ${p.g}`);
  const base=group.v.length/8,m=p.m;
  for(let i=0;i<geometry.vertices.length;i+=8) {
   const v=geometry.vertices,position=pointTransform(m,[v[i],v[i+1],v[i+2]]),n=[0,0,0];
   for(let k=0;k<3;k++){const d=m[k*4]**2+m[k*4+1]**2+m[k*4+2]**2||1;for(let j=0;j<3;j++)n[j]+=m[k*4+j]*v[i+3+k]/d;}
   group.v.push(...position,...norm(n),v[i+6],v[i+7]);
  }
  for(const i of geometry.indices)group.i.push(base+i);
 }
 const out=[];let i=0;
 for(const g of groups.values()) {const name=`assembly:${prefix}:${i++}`;PRIMITIVES[name]=new Geometry(g.v,g.i);out.push({g:name,m:transform([0,0,0]),c:g.c,pr:g.pr,role:g.role,tier:g.tier});}
 return out;
}

return {vehicleDetails,bogieDetails,bakeAssemblies};
})();
// ---- src/rolling-stock.js ----
const __m_src_rolling_stock_js = (() => {
const {highSpeedNose} = __m_src_cinematic_models_js;
const {vehicleDetails,bogieDetails,bakeAssemblies} = __m_src_train_detail_js;
const {hex,transform,frameMatrix,mat4Mul,add,sub,mul,norm,pointTransform,TAU,clamp} = __m_src_math_js;
const {Batch,PRIMITIVES,MeshBuilder} = __m_src_geometry_js;




const METAL=hex('#808b89'),DARK=hex('#283330'),BLACK=hex('#171f20'),GLASS=hex('#263e46'),CREAM=hex('#f4e7c5');
const PAINT=[0,.32,.45,0],RUBBER=[0,.94,0,0],WINDOW=[3,.11,.3,0],STEEL=[0,.24,.85,0];
const LABEL_FONT={R:['1110','1001','1110','1010','1001'],A:['0110','1001','1111','1001','1001'],I:['111','010','010','010','111'],L:['1000','1000','1000','1000','1111'],B:['1110','1001','1110','1001','1110'],O:['0110','1001','1001','1001','0110'],U:['1001','1001','1001','1001','0110'],N:['1001','1101','1011','1001','1001'],D:['1110','1001','1001','1001','1110']};
function makeLabel(){const b=new MeshBuilder();let x=0;for(const ch of 'RAILBOUND'){const glyph=LABEL_FONT[ch];for(let y=0;y<5;y++)for(let c=0;c<glyph[y].length;c++)if(glyph[y][c]==='1'){const z=(x+c)*.105,v=(4-y)*.105;b.quad([0,v,z],[0,v+.096,z],[0,v+.096,z+.096],[0,v,z+.096],[1,0,0]);}x+=glyph[0].length+1;}return b.geometry();}
PRIMITIVES.label=makeLabel();
class RollingStockRenderer {
 constructor(){this.batches=new Map();this.cache=new Map();this.smoke=[];this.particleClock=0;this.smokeBatch=new Batch(PRIMITIVES.sphere,{dynamic:true});this.smokeBatch.transparent=true;this.smokeBatch.castShadow=false;this.time=0;this.bogieCache=new Map();this.cameraPosition=[0,0,0];this.detailCounts={};}
 batch(name){if(!this.batches.has(name))this.batches.set(name,new Batch(PRIMITIVES[name],{dynamic:true,castShadow:true}));return this.batches.get(name);}
 emit(name,matrix,color,props=PAINT){this.batch(name).add(matrix,color,props);}
 model(stock,index,last){const key=`${stock.id}:${index===0?'engine':index%4}:${last}`;if(this.cache.has(key))return this.cache.get(key);const parts=[];const isLoco=index===0,L=isLoco?stock.locoLength:stock.carLength,col=hex(stock.color),stripe=hex(stock.stripe);
  const part=(g,p,s,c=col,pr=PAINT,rot=[0,0,0],role='')=>parts.push({g,m:transform(p,s,...rot),c,pr,role});
  const box=(p,s,c=col,pr=PAINT,role='')=>part('box',p,s,c,pr,[0,0,0],role);
  const rod=(a,b,r=.05,c=METAL,role='')=>parts.push({g:'cylinder',m:mat4Mul(frameMatrix(mul(add(a,b),.5),sub(b,a)),transform([0,0,0],[r,Math.hypot(...sub(b,a)),r],0,Math.PI/2,0)),c,pr:STEEL,role});
  const streamlined=isLoco&&stock.kind==='highspeed';box([0,1.16,streamlined?-3.5:0],[2.82,.5,L-(streamlined?7:.9)],DARK,RUBBER);box([0,1.62,streamlined?-3.5:0],[3.16,.28,L-(streamlined?7:.2)],col);
  if(stock.kind==='diesel'&&!isLoco){const containers=['#aa593e','#526f76','#9b9a7b','#556b50'];if(index%4===0){part('cylinder',[0,2.9,0],[2.8,L-3,2.8],hex('#acaea1'),[0,.43,.45,0],[0,Math.PI/2,0]);part('sphere',[0,2.9,L*.5-1.5],[2.8,2.8,2.8],hex('#acaea1'));part('sphere',[0,2.9,-L*.5+1.5],[2.8,2.8,2.8],hex('#acaea1'));box([0,4.35,0],[.5,.4,.7],DARK);}else{const cc=hex(containers[index%4]);box([0,2.95,0],[2.65,2.55,L-2.8],cc,[0,.72,.15,0]);for(const side of [-1,1]){for(let z=-L*.5+1.8;z<L*.5-1.8;z+=.62)box([side*1.34,2.93,z],[.06,2.48,.07],cc,[0,.74,.15,0]);box([side*1.345,4.15,0],[.08,.1,L-2.65],METAL);}}}
  else if(stock.kind==='steam'&&isLoco){part('cylinder',[0,3.03,3.1],[2.45,11.8,2.45],col,PAINT,[0,Math.PI/2,0],'shell');part('cylinder',[0,3.03,9.05],[2.53,.22,2.53],BLACK,PAINT,[0,Math.PI/2,0]);for(const z of [-1.5,.3,2.3,4.3,6.3])part('cylinder',[0,3.03,z],[2.51,.08,2.51],hex('#9a9c82'),STEEL,[0,Math.PI/2,0]);part('cylinder',[0,4.7,6.7],[.65,1.6,.65],BLACK);part('cylinder',[0,5.4,6.7],[.87,.15,.87],BLACK);part('sphere',[0,4.28,2],[.9,1.05,.9],hex('#b99854'));box([0,3.07,-4.25],[3.08,3.22,4.2],col,PAINT,'shell');box([0,4.78,-4.25],[3.4,.3,4.6],BLACK);for(const side of [-1,1])box([side*1.553,3.8,-3.6],[.04,1.25,1.7],GLASS,WINDOW,'glass');box([0,2.8,-9.3],[3.14,2.55,5.65],col);box([0,4.08,-9.3],[2.84,.13,5.25],BLACK,RUBBER);for(const side of [-1,1]){box([side*1.62,1.52,2.7],[.65,.14,14.2],DARK);rod([side*1.5,3.5,-2],[side*1.5,3.5,8.5],.065,hex('#c3af75'));}box([0,3.1,9.3],[.53,.62,.3],CREAM,[4,.2,0,3],'headlight');}
  else if(stock.kind==='diesel'&&isLoco){box([0,3.18,-2.8],[2.68,3.12,L*.61],col);box([0,3.35,L*.28],[3.2,3.5,5.4],col,PAINT,'shell');box([0,5.18,L*.28],[3.38,.22,5.8],DARK);box([0,4.25,L*.405],[2.67,1.2,.08],GLASS,WINDOW,'glass');for(const side of [-1,1]){box([side*1.62,4.22,L*.28],[.07,1.2,2.9],GLASS,WINDOW,'glass');box([side*1.46,3.35,-3.9],[.04,1.8,L*.41],DARK);for(let z=-L*.38;z<L*.07;z+=.4)box([side*1.49,3.35,z],[.05,1.72,.08],hex('#72786a'));box([side*1.72,1.65,0],[.45,.18,L-.4],DARK);rod([side*1.84,2.75,-L*.45],[side*1.84,2.75,L*.44],.055,CREAM);for(let z=-L*.42;z<L*.4;z+=2)rod([side*1.84,1.7,z],[side*1.84,2.75,z],.048,CREAM);}box([0,2.3,L*.47],[2.85,1.4,1.3],col);for(const x of [-.85,.85])box([x,3.01,L*.502],[.4,.23,.11],CREAM,[4,.25,0,5],'headlight');for(const z of [-7,-3])part('cylinder',[0,4.85,z],[1.75,.2,1.75],DARK);}
  else{const hs=stock.kind==='highspeed'&&isLoco;const bodyLen=hs?L-7:L-.9;part('body',[0,3.1,hs?-3.5:0],[3.17,3.42,bodyLen],col,PAINT,[0,0,0],'shell');box([0,4.87,hs?-3.5:0],[2.47,.16,bodyLen-.4],hex('#c8ceca'));for(const side of [-1,1]){box([side*1.587,2.5,hs?-3.5:0],[.028,.36,bodyLen-.5],stripe);box([side*1.587,1.9,hs?-3.5:0],[.028,.18,bodyLen-.5],DARK);const start=-L*.5+2.6,end=hs?L*.22:L*.5-2.6;for(let z=start;z<end;z+=2.24)box([side*1.593,3.68,z],[.025,1.06,1.65],GLASS,WINDOW,'glass');for(const z of [-L*.37,(hs?L*.18:L*.37)]){box([side*1.607,2.98,z],[.045,2.62,1.28],col,PAINT,`door${side}`);box([side*1.634,3.69,z],[.024,.89,.86],GLASS,WINDOW,`door${side}`);box([side*1.644,2.79,z+.46],[.028,.24,.035],METAL,STEEL,`door${side}`);box([side*1.72,1.64,z],[.36,.11,1.43],DARK);}if(isLoco)part('label',[side*1.609,2.05,-3],[1,.50,.50],hex('#f2ede1'),[0,.7,0,0],[side<0?Math.PI:0,0,0]);}
   if(isLoco){if(hs){parts.push(...highSpeedNose(stock));for(const side of [-1,1])part('sphere',[side*.27,1.97,L*.491],[.22,.13,.055],CREAM,[4,.24,0,5],[0,0,0],'headlight');}else{box([0,3.72,L*.481],[2.66,1.13,.055],GLASS,WINDOW,'glass');box([0,3.72,L*.488],[.065,1.19,.08],DARK);box([0,2.39,L*.49],[2.9,1.03,.18],col);box([0,1.93,L*.495],[2.92,.22,.2],stripe);for(const x of [-1.01,1.01])box([x,2.55,L*.502],[.39,.27,.065],CREAM,[4,.23,0,4.5],'headlight');box([0,4.36,L*.484],[.36,.18,.07],CREAM,[4,.25,0,2.5],'headlight');}
    if(!hs)box([0,4.93,L*.34],[2.64,.09,2.9],DARK,PAINT,'cab');box([0,2.67,L*.37],[2.82,.25,1.0],DARK,PAINT,'cab');box([0,2.91,L*.395],[1.17,.12,.63],hex('#30464b'),PAINT,'cab');box([-.5,2.991,L*.394],[.46,.015,.35],hex('#559d9a'),[4,.4,0,.6],'cab');box([.5,2.991,L*.394],[.33,.015,.3],hex('#50745d'),[4,.4,0,.5],'cab');if(!hs){for(const side of [-1,1])box([side*1.44,3.6,L*.465],[.11,2.12,.14],DARK,PAINT,'cab');box([0,4.57,L*.465],[2.98,.11,.15],DARK,PAINT,'cab');box([0,2.43,L*.465],[2.98,.15,.15],DARK,PAINT,'cab');}
   }
  }
  if(isLoco&&['electric','highspeed','metro'].includes(stock.kind)){for(const z of [-L*.21,L*.15]){box([0,5.04,z],[1.8,.25,2.3],hex('#818b82'));for(const side of [-1,1]){rod([side*.42,5.05,z-1.05],[side*.42,5.52,z+.4],.067,DARK,'pantograph');rod([side*.42,5.52,z+.4],[side*.42,5.96,z-.3],.067,DARK,'pantograph');}box([0,5.99,z-.3],[1.6,.06,.22],METAL,STEEL,'pantograph');}for(let z=-L*.33;z<(stock.kind==='highspeed'?L*.5-8:L*.3);z+=2.6)box([0,4.99,z],[1.3,.22,1.1],hex('#a5ada5'));}
  if(!isLoco&&stock.kind!=='diesel'){box([0,3.05,L*.498],[2.43,2.48,.14],DARK);box([0,3.04,-L*.498],[2.43,2.48,.14],DARK);box([0,2.92,L*.505],[1.17,2.16,.1],hex('#78837e'));}
  for(const z of [-L*.5-.2,L*.5+.2]){box([0,1.1,z],[.28,.23,.63],METAL,STEEL);for(const side of [-1,1]){part('cylinder',[side*.92,1.19,z],[.32,.35,.32],DARK,RUBBER,[0,Math.PI/2,0]);}}
  if(last){for(const x of [-1.05,1.05])box([x,2.36,-L*.503],[.18,.22,.05],hex('#d53e2c'),[4,.4,0,2]);}
  parts.push(...vehicleDetails(stock,index,last));
  const baked=bakeAssemblies(parts,key);this.detailCounts[key]={parts:parts.length,assemblies:baked.length,triangles:baked.reduce((sum,p)=>sum+PRIMITIVES[p.g].indices.length/3,0)};
  this.cache.set(key,baked);return baked;
 }
 emitBogie(base,train,isLoco,phase){
  const distance=Math.hypot(base[12]-this.cameraPosition[0],base[13]-this.cameraPosition[1],base[14]-this.cameraPosition[2]);
  if(distance<450){const key=isLoco&&train.stock.kind==='diesel'?'heavy':'standard';if(!this.bogieCache.has(key))this.bogieCache.set(key,bakeAssemblies(bogieDetails(key==='heavy'),'bogie-'+key));
   for(const p of this.bogieCache.get(key)){if(p.tier===2&&distance>100)continue;this.emit(p.g,base,p.c,p.pr);}}
this.emit('box',mat4Mul(base,transform([0,1.00,0],[2.3,.48,3.2])),DARK,RUBBER);for(const z of [-1.03,1.03]){this.emit('cylinder',mat4Mul(base,transform([0,.74,z],[.20,2.2,.20],0,0,Math.PI/2)),METAL,STEEL);for(const side of [-1,1]){const wm=mat4Mul(base,mat4Mul(transform([side*1.015,.73,z],[1,1,1],0,phase),transform([0,0,0],[1.10,.16,1.10],0,0,Math.PI/2)));this.emit('wheel',wm,hex('#737e78'),STEEL);this.emit('cylinder',mat4Mul(base,transform([side*1.12,.73,z],[.69,.07,.69],0,0,Math.PI/2)),METAL,STEEL);this.emit('box',mat4Mul(base,transform([side*1.18,.98,z],[.28,.42,.37])),DARK,RUBBER);}}
  for(const side of [-1,1])this.emit('box',mat4Mul(base,transform([side*1.19,1.13,0],[.20,.36,3.17])),hex('#53615a'),STEEL);
 }
 drawTrain(train,cameraMode){for(let i=0;i<=train.cars;i++){const off=train.carOffset(i),L=i===0?train.stock.locoLength:train.stock.carLength,a=train.cursor.pose(off+L*.33),z=train.cursor.pose(off-L*.33),p=train.cursor.pose(off);const base=frameMatrix(p.p,sub(a.p,z.p));const distance=Math.hypot(p.p[0]-this.cameraPosition[0],p.p[1]-this.cameraPosition[1],p.p[2]-this.cameraPosition[2]);
   const parts=this.model(train.stock,i,i===train.cars);for(const part of parts){if(part.role==='cab'&&!(train.id==='player'&&i===0&&cameraMode==='cab'))continue;if((part.tier===1&&distance>450)||(part.tier===2&&distance>100))continue;if(train.id==='player'&&i===0&&cameraMode==='cab'&&(part.role==='shell'||part.role==='glass'||part.role==='seal'||part.role==='wiper'))continue;let local=part.m,props=part.pr;if(part.role==='pantograph'&&!train.controls.pantograph)local=mat4Mul(mat4Mul(transform([0,4.84,0],[1,.12,1]),transform([0,-4.84,0])),local);if(part.role.startsWith('door'))local=mat4Mul(transform([0,0,train.doorAmount*.9]),local);if(part.role==='headlight'&&!train.controls.headlights)props=[0,.25,.3,0];this.emit(part.g,mat4Mul(base,local),part.c,props);}
   const phase=-train.cursor.odometer/.55;
   if(train.stock.kind==='steam'&&i===0){for(const zz of [-2.4,0,2.4])for(const side of [-1,1]){const wp=[side*1.12,1.03,zz];this.emit('cylinder',mat4Mul(base,transform(wp,[1.68,.19,1.68],0,0,Math.PI/2)),BLACK,STEEL);for(let spoke=0;spoke<8;spoke++){const angle=phase+spoke*Math.PI/4;const m=mat4Mul(transform(wp,[1,1,1],0,angle),transform([0,0,0],[.13,1.48,.045]));this.emit('box',mat4Mul(base,m),hex('#9fa598'),STEEL);}}for(const side of [-1,1]){const y=1.03+Math.sin(phase)*.45,z=Math.cos(phase)*.45;this.emit('box',mat4Mul(base,transform([side*1.26,y,z],[.11,.14,5.25])),METAL,STEEL);}for(const zz of [-9,7.4])this.emitBogie(mat4Mul(base,transform([0,0,zz],[.9,1,.7])),train,true,phase);}
   else{this.emitBogie(frameMatrix(a.p,a.f),train,i===0,phase);this.emitBogie(frameMatrix(z.p,z.f),train,i===0,phase);}
   if(train.id==='player'&&i===0&&cameraMode==='cab'&&train.controls.wipers){const t=Math.sin(this.time*3.1)*.7;for(const side of [-1,1])this.emit('box',mat4Mul(base,transform([side*.63,3.43,L*.47],[.04,1.1,.035],0,0,t)),BLACK);}
  }
 }
 update(trains,world,camera,dt,time,mode){this.time=time;this.cameraPosition=camera.position;for(const b of this.batches.values())b.reset();for(const t of trains){const p=t.cursor.pose().p;if(t.id==='player'||Math.hypot(p[0]-camera.position[0],p[2]-camera.position[2])<2500)this.drawTrain(t,mode);}for(const s of world.signals){if(Math.hypot(s.pos[0]-camera.position[0],s.pos[2]-camera.position[2])>1600)continue;const aspect=world.traffic?.aspect(s.edge,s.s)||'green';const base=frameMatrix(s.pos,s.f);for(const [i,color]of ['red','yellow','green'].entries()){const on=aspect===color;this.emit('sphere',mat4Mul(base,transform([0,.46-i*.44,.19],[.24,.24,.13])),hex(on?{red:'#ff493b',yellow:'#ffd37a',green:'#8ce9a0'}[color]:'#172421'),[4,.3,0,on?3:0]);}}
  for(const b of this.batches.values()){b.center=camera.target;b.radius=1e7;b.flush();}
  this.updateParticles(trains,world,camera,dt,time);
  return [...this.batches.values(),this.smokeBatch];
 }
 updateParticles(trains,world,camera,dt,time){this.particleClock+=dt;const player=trains[0];if(this.particleClock>.17){this.particleClock=0;for(const t of trains){if(!['steam','diesel','regional'].includes(t.stock.kind)||!t.controls.master)continue;const p=t.cursor.pose(t.stock.kind==='steam'?6.7:-3);this.smoke.push({p:add(p.p,[0,t.stock.kind==='steam'?5.8:5.4,0]),age:0,life:t.stock.kind==='steam'?8:4,scale:t.stock.kind==='steam'?1.3:.5,dark:t.stock.kind!=='steam'});}}
  this.smokeBatch.reset();for(let i=this.smoke.length-1;i>=0;i--){const s=this.smoke[i];s.age+=dt;if(s.age>s.life){this.smoke.splice(i,1);continue;}s.p[0]+=dt*1.1;s.p[1]+=dt*(s.dark?1.1:2.4);const size=s.scale+s.age*.75;this.smokeBatch.add(transform(s.p,[size,size*.85,size]),s.dark?[.4,.42,.42,.22*(1-s.age/s.life)]:[.83,.86,.85,.32*(1-s.age/s.life)],[8,1,0,0]);}
  const weather=world.weather||'clear';if(['rain','storm','snow'].includes(weather)){const snow=weather==='snow',count=snow?130:170;for(let i=0;i<count;i++){const x=Math.sin(i*732.4)*45,z=Math.cos(i*193.8)*45;const y=((i*9.173-time*(snow?2.4:37))%42+42)%42-7;const pos=add(camera.position,[x,y,z]);this.smokeBatch.add(transform(pos,snow?[.1,.1,.1]:[.017,1.1,.017],0,0,.08),snow?[.93,.96,.97,.65]:[.65,.77,.85,.32],[8,1,0,snow?.1:0]);}}
  this.smokeBatch.center=camera.position;this.smokeBatch.radius=10000;this.smokeBatch.flush();
 }
}

return {RollingStockRenderer};
})();
// ---- src/camera.js ----
const __m_src_camera_js = (() => {
const {add,sub,mul,norm,mix3,clamp,cross,frameMatrix,pointTransform} = __m_src_math_js;

const CAMERA_MODES=['cab','chase','orbit','aerial','trackside','free'];
class CameraRig {
 constructor(){this.mode='chase';this.position=[0,100,0];this.target=[0,60,0];this.distance=90;this.azimuth=-.87;this.elevation=.28;this.fov=56;this.initial=true;this.cabYaw=0;this.cabPitch=0;this.trackAnchor=null;this.freeYaw=0;this.freePitch=0;this.photoOrbit=false;this.motion=true;}
 setMode(mode){if(!CAMERA_MODES.includes(mode))return;this.mode=mode;this.initial=true;this.trackAnchor=null;if(mode==='aerial')this.distance=480;else if(mode==='chase'||mode==='orbit')this.distance=90;if(mode==='free'){const f=norm(sub(this.target,this.position));this.freeYaw=Math.atan2(f[0],f[2]);this.freePitch=Math.asin(f[1]);}}
 rotate(dx,dy){if(this.mode==='cab'){this.cabYaw=clamp(this.cabYaw-dx*.004,-1.55,1.55);this.cabPitch=clamp(this.cabPitch-dy*.003,-.6,.6);}else if(this.mode==='free'){this.freeYaw-=dx*.004;this.freePitch=clamp(this.freePitch-dy*.003,-1.5,1.5);}else{this.azimuth-=dx*.005;this.elevation=clamp(this.elevation+dy*.004,.055,1.48);}}
 zoom(delta){if(this.mode==='cab'){this.fov=clamp(this.fov+delta*.02,38,90);return;}this.distance=clamp(this.distance*Math.exp(delta*.001),10,2200);}
 update(train,world,dt,keys){const p=train.cursor.pose(),pose=train.cursor.pose((globalThis.innerWidth/globalThis.innerHeight||1.6)<.75?-2:-Math.min(train.length*.25,40)),f=p.f,right=p.right,surface=world.surfaceHeight?.bind(world)||world.height.bind(world);let eye,aim;
  if(this.mode==='free'){const dir=[Math.sin(this.freeYaw)*Math.cos(this.freePitch),Math.sin(this.freePitch),Math.cos(this.freeYaw)*Math.cos(this.freePitch)],r=norm(cross([0,1,0],dir));const speed=(keys?.has('ShiftLeft')?180:38)*dt;for(const [key,vec]of [['KeyW',dir],['KeyS',mul(dir,-1)],['KeyD',r],['KeyA',mul(r,-1)],['KeyE',[0,1,0]],['KeyQ',[0,-1,0]]])if(keys?.has(key))this.position=add(this.position,mul(vec,speed));this.target=add(this.position,mul(dir,50));return;}
  if(this.mode==='cab'){eye=add(add(p.p,mul(f,train.stock.kind==='steam'?-3:train.stock.locoLength*(train.stock.kind==='highspeed'?.27:.34))),[0,3.78,0]);eye=add(eye,mul(right,-.45));const look=norm(add(add(mul(f,Math.cos(this.cabYaw)),mul(right,Math.sin(this.cabYaw))),[0,this.cabPitch,0]));aim=add(eye,mul(look,90));const vibration=this.motion?Math.min(Math.abs(train.speed)/35,1)*.014:0;eye[1]+=Math.sin(train.cursor.odometer*1.7)*vibration;eye=add(eye,mul(right,Math.sin(train.cursor.odometer*.11)*vibration*1.2));this.position=eye;this.target=aim;this.initial=false;return;}
  if(this.mode==='trackside'){if(!this.trackAnchor||Math.hypot(...sub(this.trackAnchor,p.p))>210){const ahead=train.cursor.pose(100);this.trackAnchor=add(add(ahead.p,mul(ahead.right,-20)),[0,4,0]);}eye=this.trackAnchor;aim=add(p.p,[0,2.5,0]);}
  else{if(this.photoOrbit&&this.mode==='orbit')this.azimuth+=dt*.12;aim=add(pose.p,[0,2.4,0]);const el=this.mode==='aerial'?Math.max(.8,this.elevation):this.elevation;const horizontal=this.distance*Math.cos(el);eye=add(add(add(aim,mul(right,Math.sin(this.azimuth)*horizontal)),mul(f,Math.cos(this.azimuth)*horizontal)),[0,Math.sin(el)*this.distance,0]);const ground=surface(eye[0],eye[2]);eye[1]=Math.max(eye[1],ground+2.5,world.def.water+3);}
  if(this.mode==='chase'||this.mode==='orbit'){
   // Raise the boom over the rendered surface. Shortening it toward the target
   // could put the camera inside a coach in a steep cutting.
   for(let i=1;i<=16;i++){const t=i/16,q=mix3(aim,eye,t),ground=surface(q[0],q[2])+2.5;if(q[1]<ground)eye[1]=Math.max(eye[1],aim[1]+(ground-aim[1])/t);}
  }const alpha=this.initial?1:1-Math.exp(-dt*(this.mode==='chase'?4.8:7));this.position=mix3(this.position,eye,alpha);this.target=mix3(this.target,aim,alpha);this.position[1]=Math.max(this.position[1],surface(this.position[0],this.position[2])+2.5);this.initial=false;
 }
}

return {CAMERA_MODES,CameraRig};
})();
// ---- src/audio.js ----
const __m_src_audio_js = (() => {
const {clamp,rng} = __m_src_math_js;
/** Procedural layered sound, bounded voice count, no autoplay or external media.
 * A compressor protects against rail, rain, brake and horn transients summing.
 */

function audioMix(train,weather,cameraMode='chase',hour=12){
 const speed=Math.abs(train.speed),c=train.controls,cab=cameraMode==='cab',steam=train.stock.kind==='steam';
 const diesel=['diesel','regional'].includes(train.stock.kind),rain=['rain','storm'].includes(weather);
 return {pitch:steam?42+speed*2.6:diesel?32+c.throttle*32+speed*.6:45+speed*5.4,
  motor:c.master?(diesel?.035+c.throttle*.085:steam?.026:.008+c.throttle*.045):0,
  rail:clamp(speed*.006,0,.32)*(cab?.62:1),wind:clamp(speed*speed*.000017,0,.14)*(cab?.4:1),
  squeal:clamp((train.risk||0)*.027,0,.08)*clamp(speed/5,0,1),brake:clamp(c.brake*speed*.003,0,.075),
  rain:rain?(cab?.022:.065):0,ambient:hour>6&&hour<20?(rain?.003:.013):.006,cab,steam,diesel};
}
class RailAudio {
 constructor(){this.enabled=false;this.context=null;this.volume=.36;this.horning=false;this.ambience=true;this.lastJoint=0;this.lastChirp=-100;this.nodes=[];}
 async enable(){
  if(!this.context){
   const C=globalThis.AudioContext||globalThis.webkitAudioContext;if(!C)return;
   const c=this.context=new C(),own=n=>{this.nodes.push(n);return n;};
   this.master=own(c.createGain());this.master.gain.value=0;this.compressor=own(c.createDynamicsCompressor());
   this.compressor.threshold.value=-12;this.compressor.knee.value=18;this.compressor.ratio.value=5;this.master.connect(this.compressor).connect(c.destination);
   const oscillator=(type,f)=>{const o=own(c.createOscillator()),g=own(c.createGain());g.gain.value=0;o.type=type;o.frequency.value=f;o.connect(g).connect(this.master);o.start();return {o,g};};
   const n=c.createBuffer(1,c.sampleRate*3,c.sampleRate),a=n.getChannelData(0),random=rng(47391);let low=0;
   for(let i=0;i<a.length;i++){low=(low+(random()*2-1)*.12)*.985;a[i]=low;}
   this.noise=own(c.createBufferSource());this.noise.buffer=n;this.noise.loop=true;this.noise.start();
   const noise=(type,f,q=.6)=>{const filter=own(c.createBiquadFilter()),gain=own(c.createGain());filter.type=type;filter.frequency.value=f;filter.Q.value=q;gain.gain.value=0;this.noise.connect(filter).connect(gain).connect(this.master);return {filter,gain};};
   this.engine=oscillator('sawtooth',40);this.harmonic=oscillator('triangle',80);
   this.rail=noise('bandpass',600);this.wind=noise('lowpass',420);this.rain=noise('highpass',1500);
   this.brake=noise('bandpass',1800,2.5);this.joint=noise('lowpass',170);
   this.squeal=oscillator('sine',1900);this.chirp=oscillator('sine',2300);
   this.horns=[185,233,277].map(f=>oscillator('triangle',f));
  }
  await this.context.resume();this.enabled=true;this.master.gain.setTargetAtTime(this.volume,this.context.currentTime,.1);
 }
 toggle(){if(this.enabled){this.enabled=false;this.master?.gain.setTargetAtTime(0,this.context.currentTime,.05);}else return this.enable();}
 horn(on){this.horning=on;if(this.context)for(const h of this.horns)h.g.gain.setTargetAtTime(on?.11:0,this.context.currentTime,.035);}
 update(train,weather,paused,cameraMode='chase',hour=12){
  if(!this.context)return;
  const c=this.context,t=c.currentTime,m=audioMix(train,weather,cameraMode,hour),smooth=(p,v,tau=.10)=>p.setTargetAtTime(v,t,tau);
  smooth(this.master.gain,this.enabled&&!paused?this.volume:0,.08);
  smooth(this.engine.o.frequency,m.pitch);smooth(this.harmonic.o.frequency,m.pitch*2.01);
  smooth(this.engine.g.gain,m.motor*(m.cab?.70:1));smooth(this.harmonic.g.gain,m.motor*.23);
  smooth(this.rail.gain.gain,m.rail);smooth(this.rail.filter.frequency,400+Math.abs(train.speed)*18);
  smooth(this.wind.gain.gain,m.wind);smooth(this.rain.gain.gain,this.ambience?m.rain:0);
  smooth(this.brake.gain.gain,m.brake);smooth(this.squeal.g.gain,m.squeal);
  smooth(this.squeal.o.frequency,1750+Math.sin(train.cursor.odometer*.08)*130);
  if(paused||!this.enabled)return;
  const joint=Math.floor(Math.abs(train.cursor.odometer)/(m.steam?2.0:18));
  if(joint!==this.lastJoint){this.lastJoint=joint;const p=this.joint.gain.gain;p.cancelScheduledValues(t);p.setValueAtTime(Math.min(.21,.03+Math.abs(train.speed)*.003),t);p.exponentialRampToValueAtTime(.0001,t+.10);}
  if(this.ambience&&t-this.lastChirp>4.7&&m.ambient>.008){
   this.lastChirp=t;const p=this.chirp.g.gain,f=this.chirp.o.frequency;p.cancelScheduledValues(t);f.cancelScheduledValues(t);
   p.setValueAtTime(.0001,t);p.exponentialRampToValueAtTime(m.ambient,t+.05);p.exponentialRampToValueAtTime(.0001,t+.5);
   f.setValueAtTime(2100,t);f.exponentialRampToValueAtTime(3300,t+.15);f.exponentialRampToValueAtTime(2400,t+.44);
  }
 }
 stop(){this.horn(false);if(this.context)this.master.gain.setTargetAtTime(0,this.context.currentTime,.01);}
 async dispose(){this.stop();for(const n of this.nodes){try{n.stop?.();n.disconnect();}catch{}}this.nodes=[];await this.context?.close();this.context=null;this.enabled=false;}
}

return {audioMix,RailAudio};
})();
// ---- src/generation-ui.js ----
const __m_src_generation_ui_js = (() => {
const {WORLDS} = __m_src_data_js;
const {TerrainField,REGION_PROFILES,generationOptions,surveyRoute} = __m_src_generation_js;
const {clamp,hex,lerp} = __m_src_math_js;
/** Expedition controls and numerical terrain previews (not stock images). */




function thumbnail(canvas,def,seed,options) {
 const field=new TerrainField(def,seed,options),ctx=canvas.getContext('2d'),width=canvas.width=176,height=canvas.height=106;
 const image=ctx.createImageData(width,height),range=Math.max(def.rx,def.rz)*2.05;
 const grass=hex(def.ground),rock=hex(def.rock),water=hex(def.waterColor);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
  const wx=(x/width-.5)*range*2,wz=(y/height-.5)*range*2,h=field.rawHeight(wx,wz),dx=field.rawHeight(wx+26,wz)-h,dz=field.rawHeight(wx,wz+26)-h;
  const slope=clamp(Math.hypot(dx,dz)/45,0,1),shade=clamp(.94+(dx-dz)*.008,.48,1.3),snow=clamp((h-def.snowLine)/100,0,1),i=(y*width+x)*4;
  for(let k=0;k<3;k++)image.data[i+k]=255*(h<def.water?water[k]*.7:lerp(lerp(grass[k],rock[k],slope),.91,snow)*shade);
  image.data[i+3]=255;
 }
 ctx.putImageData(image,0,0);const controls=surveyRoute(def,field);
 const draw=(color,widthValue)=>{ctx.strokeStyle=color;ctx.lineWidth=widthValue;ctx.beginPath();controls.forEach((p,i)=>{const x=(p[0]/(range*2)+.5)*width,y=(p[2]/(range*2)+.5)*height;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();ctx.stroke();};
 draw('#172524',3);draw('#f0d5a5',1.3);
}

function expeditionPanel(ui) {
 const app=ui.app,world=app.world,field=world.terrain,options=generationOptions(world.editor.generation);
 const $=id=>document.getElementById(id);
 $('panel-content').innerHTML=`
 <section class="expedition-head"><div><span class="overline">LIVING WORLDS / GENERATOR 03</span><p>Choose a geography. Survey a new railway. Change the seed to resurvey the terrain, forests and railway. Forests now use layered leaf canopies; towns grow from connected streets and parcels.</p></div><span class="expedition-seed">SEED ${Math.trunc(world.seed)}</span></section>
 <section class="generation-controls" aria-label="Procedural world settings">
  <label class="field"><span>World seed</span><div class="seed-entry"><input id="generation-seed" type="number" min="1" max="2147483647" step="1" value="${Math.trunc(world.seed)}"><button class="secondary" id="generation-random" aria-label="Choose a new random seed">Shuffle</button></div></label>
  ${ui.field('Mountain relief','generation-relief',55,165,5,Math.round(options.relief*100),'%')}
  ${ui.field('Ecological density','generation-vegetation',25,170,5,Math.round(options.vegetation*100),'%')}
  ${ui.field('Erosion strength','generation-erosion',0,100,5,Math.round(options.erosion*100),'%')}
 </section>
 <div class="expedition-stats"><span>${(world.network.totalLength/1000).toFixed(1)} km current route</span><span>${world.features.trees.toLocaleString()} trees</span><span>${world.features.buildings.toLocaleString()} buildings · ${world.features.roadSegments||0} streets · ${world.features.parks||0} parks</span><span>${field?Math.round(field.stats.max-field.stats.min)+' m relief':'Legacy landscape'}</span><span>Seeded · editable · saved locally</span></div>
 <div class="button-row expedition-viewpoints">${world.viewpoints.map((v,i)=>`<button class="secondary" data-viewpoint="${i}">Explore · ${v.name} ↗</button>`).join('')}</div>
 <div class="world-grid expedition-grid">${WORLDS.map(def=>{const profile=REGION_PROFILES[def.theme];return `<button class="world-card ${world.def.id===def.id?'selected':''}" data-world="${def.id}" aria-label="Generate ${def.name}"><canvas class="expedition-preview" data-preview="${def.id}"></canvas><div class="card-text"><span class="overline">${profile.name}</span><h3>${def.name}</h3><p>${profile.geology}</p><small>${profile.species}</small></div><span class="expedition-action">SURVEY & ENTER ↗</span></button>`;}).join('')}</div>
 <div class="panel-notice">Select a region to generate a fresh journey using these settings. Export your current project first to keep edits and train positions. Preview maps show the pre-erosion survey; the final terrain is eroded before rail grading. Legacy saves retain their original railway.</div>`;
 const read=()=>({seed:clamp(Math.trunc(Number($('generation-seed').value))||1,1,2147483647),generationVersion:3,generation:{relief:Number($('generation-relief').value)/100,vegetation:Number($('generation-vegetation').value)/100,erosion:Number($('generation-erosion').value)/100}});
 for(const button of document.querySelectorAll('[data-viewpoint]'))button.onclick=()=>{
  const view=world.viewpoints[Number(button.dataset.viewpoint)];app.camera.position=[...view.position];app.camera.target=[...view.target];app.camera.setMode('free');ui.closePanel();ui.toast(view.name+' · drag to look · WASD and Q/E to fly · C to return to the train.');
 };
 let timer;
 const previews=()=>{if(ui.activePanel!=='worlds')return;const value=read();for(const def of WORLDS){const canvas=document.querySelector(`[data-preview="${def.id}"]`);if(canvas)thumbnail(canvas,def,value.seed,value.generation);}};
 const schedule=()=>{clearTimeout(timer);timer=setTimeout(previews,160);};
 for(const key of ['relief','vegetation','erosion'])ui.bindRange('generation-'+key,schedule,v=>v+'%');
 $('generation-seed').onchange=schedule;
 $('generation-random').onclick=()=>{const value=new Uint32Array(1);crypto.getRandomValues(value);$('generation-seed').value=1+value[0]%2147483646;schedule();};
 for(const button of document.querySelectorAll('[data-world]'))button.onclick=()=>ui.guard(async()=>{
  const settings=read();clearTimeout(timer);ui.closePanel();await app.loadWorld(button.dataset.world,settings);ui.toast(`${app.world.def.name} · seed ${settings.seed} · ${(app.world.network.totalLength/1000).toFixed(1)} km surveyed.`);
 });
 previews();
}

return {expeditionPanel};
})();
// ---- src/persistence.js ----
const __m_src_persistence_js = (() => {
const {postOptions} = __m_src_postprocess_js;
const {cleanJourney} = __m_src_journey_js;
const {generationOptions} = __m_src_generation_js;
const {WORLDS,STOCK,WEATHER,SCENARIOS} = __m_src_data_js;
const {clamp} = __m_src_math_js;





const SAVE_KEY='railbound-adventures-simulation-v2';
function storageGet(key){try{return localStorage.getItem(key);}catch{return null;}}
function storageSet(key,value){try{localStorage.setItem(key,value);return true;}catch{return false;}}
function finite(n,a,b,fallback=0){return Number.isFinite(n)?clamp(n,a,b):fallback;}
function array(v,max){if(v==null)return [];if(!Array.isArray(v)||v.length>max)throw new Error('Project contains too many items or an invalid list.');return v;}
function validateProject(value){if(!value||typeof value!=='object'||value.format!=='railbound-adventures'||value.version!==2)throw new Error('Not a supported Railbound Adventures v2 project.');const world=WORLDS.find(w=>w.id===value.world);if(!world)throw new Error('Unknown world.');if(!value.player||!STOCK.some(s=>s.id===value.player.stock))throw new Error('Invalid player train.');const editor=value.editor||{};const clean={generationVersion:editor.generationVersion===3?3:2,generation:generationOptions(editor.generation),seed:finite(editor.seed,1,2147483647,world.seed),electrified:editor.electrified!==false,objects:array(editor.objects,1500).map(o=>({type:['tree','building','rock'].includes(o.type)?o.type:'tree',x:finite(o.x,-12000,12000),z:finite(o.z,-12000,12000),size:finite(o.size,3,60,18),rotation:finite(o.rotation,-Math.PI*2,Math.PI*2)})),heightEdits:array(editor.heightEdits,250).map(o=>({x:finite(o.x,-12000,12000),z:finite(o.z,-12000,12000),radius:finite(o.radius,10,600,90),delta:finite(o.delta,-200,200,0)})),stations:array(editor.stations,50).map(o=>({edge:['approach','main','branch','return'].includes(o.edge)?o.edge:'approach',s:finite(o.s,0,100000),name:String(o.name||'New station').slice(0,64)})),customTrack:null};
 if(editor.customTrack!=null){clean.customTrack=array(editor.customTrack,150).map(o=>({x:finite(o.x,-6000,6000),y:finite(o.y,0,900,world.railY),z:finite(o.z,-6000,6000)}));const routeLength=clean.customTrack.reduce((sum,p,i)=>{const q=clean.customTrack[(i+1)%clean.customTrack.length];return sum+Math.hypot(p.x-q.x,p.y-q.y,p.z-q.z);},0);if(routeLength>75000)throw new Error('Custom routes are limited to 75 km of control-point length.');if(clean.customTrack.length<4)throw new Error('Custom track requires at least four control points.');for(let i=0;i<clean.customTrack.length;i++){const a=clean.customTrack[i],b=clean.customTrack[(i+1)%clean.customTrack.length];if(Math.hypot(a.x-b.x,a.z-b.z)<25)throw new Error('Adjacent track nodes must be at least 25 metres apart.');}}
 const env=value.env||{};const settings=value.settings||{};const result={...value,world:world.id,editor:clean,ai:array(value.ai,5),env:{hour:finite(env.hour,0,23.999,world.hour),weather:Object.hasOwn(WEATHER,env.weather)?env.weather:'clear',timeRate:finite(env.timeRate,0,240,4),exposure:finite(env.exposure,.5,1.8,1),electrified:clean.electrified},journey:cleanJourney(value.journey),settings:{cinematic:postOptions(settings.cinematic),wildlife:settings.wildlife!==false,ambience:settings.ambience!==false,coach:settings.coach!==false,cameraMotion:settings.cameraMotion!==false,quality:['low','medium','high','ultra'].includes(settings.quality)?settings.quality:'high',resolution:finite(settings.resolution,.5,1,1),shadows:settings.shadows!==false,adaptive:settings.adaptive!==false,safety:settings.safety!==false,units:settings.units==='mph'?'mph':'km/h',volume:finite(settings.volume,0,1,.36),timeScale:finite(settings.timeScale,.25,4,1),gamepad:settings.gamepad!==false},simTime:finite(value.simTime,0,1e10,0),paused:!!value.paused,dispatch:{autopilot:!!value.dispatch?.autopilot,holds:array(value.dispatch?.holds,500).filter(s=>typeof s==='string'&&/^(approach|main|branch|return):[0-9]{1,5}$/.test(s))},cameraState:typeof value.cameraState==='object'&&value.cameraState?value.cameraState:{},scenario:SCENARIOS.some(s=>s.id===value.scenario)?value.scenario:'free'};return result;}
function encodeProject(app){return {format:'railbound-adventures',version:2,savedAt:new Date().toISOString(),world:app.world.def.id,editor:structuredClone(app.world.editor),env:{...app.env},settings:{...app.settings},journey:cleanJourney(app.journey?.stats),scenario:app.mission.mode,mission:{score:app.mission.score,stops:app.mission.stops,boarded:app.mission.boarded,lastId:app.mission.lastId,complete:app.mission.complete,targetId:app.mission.target?.id||null,dwell:app.mission.dwell,penaltyClock:app.mission.penaltyClock,message:app.mission.message,stopLog:app.mission.stopLog},player:app.player.snapshot(),ai:app.trains.filter(t=>t!==app.player).map(t=>t.snapshot()),switchBranch:app.world.network.switchBranch,camera:app.camera.mode,cameraState:{distance:app.camera.distance,azimuth:app.camera.azimuth,elevation:app.camera.elevation,cabYaw:app.camera.cabYaw,cabPitch:app.camera.cabPitch,fov:app.camera.fov},simTime:app.simTime||0,paused:!!app.paused,dispatch:{holds:[...(app.world.traffic?.holds||[])],autopilot:!!app.autopilot}};}

return {SAVE_KEY,storageGet,storageSet,validateProject,encodeProject};
})();
// ---- src/ui.js ----
const __m_src_ui_js = (() => {
const {cinematicPanel,journeyPanel,updateCinematicUI} = __m_src_cinematic_ui_js;
const {expeditionPanel} = __m_src_generation_ui_js;
const {WORLDS,STOCK,WEATHER,SCENARIOS} = __m_src_data_js;
const {clamp,hex,lerp,downloadFile} = __m_src_math_js;
const {CAMERA_MODES} = __m_src_camera_js;
const {storageGet,SAVE_KEY} = __m_src_persistence_js;






const icon=(id,cls='icon')=>`<svg class="${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const escapeHTML=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=id=>document.getElementById(id);
const CAMERA_LABELS={cab:'CAB VIEW',chase:'CHASE CAMERA',orbit:'ORBIT CAMERA',aerial:'AERIAL VIEW',trackside:'TRACKSIDE',free:'FREE CAMERA'};
const toolTip={inspect:'Select a station or inspect the railway.',teleport:'Click near a rail to position your stopped train.',tree:'Click to plant a tree. Apply world changes when finished.',building:'Click to place a house.',rock:'Click to place a boulder.',raise:'Click to raise terrain with the selected brush.',lower:'Click to lower terrain with the selected brush.',station:'Click beside a rail to add a station.',track:'Place at least four nodes, then Build custom track. The route is a closed spline.',erase:'Click a placed object to remove it.'};
class UI {
 constructor(app){this.app=app;this.activePanel=null;this.dialog=$('panel-dialog');this.mapCache=null;this.mapWorld=null;this.editorTool='inspect';this.draft=null;this.editorUndo=[];this.editorRedo=[];this.newTrack=[];this.mapScale=1;this.setup();}
 setup(){document.querySelectorAll('[data-panel]').forEach(b=>b.addEventListener('click',()=>this.openPanel(b.dataset.panel)));$('close-dialog').onclick=()=>this.closePanel();this.dialog.addEventListener('cancel',()=>{this.activePanel=null;this.app.panelPause=false;});this.dialog.addEventListener('click',e=>{if(e.target===this.dialog){const r=this.dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)this.closePanel();}});
  $('throttle').oninput=e=>this.app.player.controls.throttle=Number(e.target.value)/100;$('brake').oninput=e=>this.app.player.controls.brake=Number(e.target.value)/100;
  document.querySelectorAll('[data-direction]').forEach(b=>b.onclick=()=>this.guard(()=>this.app.player.setReverser(Number(b.dataset.direction))));document.querySelectorAll('[data-control]').forEach(b=>b.onclick=()=>this.toggleControl(b.dataset.control));
  $('depart').onclick=()=>this.depart();$('emergency').onclick=()=>this.guard(()=>{const t=this.app.player;if(t.controls.emergency)t.resetEmergency();else t.emergency();});$('pause-toggle').onclick=()=>this.app.togglePause();$('resume').onclick=()=>this.app.togglePause(false);$('camera-cycle').onclick=()=>this.cycleCamera(1);$('previous-camera').onclick=()=>this.cycleCamera(-1);$('photo').onclick=()=>this.app.photo();$('restore-hud').onclick=()=>document.body.classList.remove('hud-hidden');$('audio-toggle').onclick=()=>this.app.audio.toggle();$('fullscreen').onclick=()=>this.guard(async()=>{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else this.toast('Fullscreen is not available here. Use your browser’s home-screen install option.');});
  const horn=$('horn');horn.onpointerdown=e=>{e.preventDefault();horn.setPointerCapture?.(e.pointerId);horn.classList.add('active');this.app.audio.enable().then(()=>{if(horn.classList.contains('active'))this.app.audio.horn(true);}).catch(()=>{});};const off=()=>{this.app.audio.horn(false);horn.classList.remove('active');};horn.onpointerup=off;horn.onpointercancel=off;horn.onlostpointercapture=off;
  $('project-file').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;if(file.size>3e6)return this.toast('Project files must be smaller than 3 MB.',true);try{await this.app.importProject(JSON.parse(await file.text()));this.closePanel();this.toast('Project restored.');}catch(error){this.toast(error.message,true);}};
 }
 guard(fn){try{const result=fn();if(result?.catch)result.catch(e=>this.toast(e.message,true));}catch(e){this.toast(e.message,true);}}
 toast(message,error=false){const el=document.createElement('div');el.className=`toast${error?' error':''}`;el.textContent=message;$('toasts').append(el);setTimeout(()=>el.remove(),error?6500:3600);}
 loading(message,progress){$('loading').classList.remove('hidden','done');$('loading-label').textContent=message;$('loading-progress').style.width=`${Math.round(progress*100)}%`;}
 loaded(){this.mapCache=null;$('loading').classList.add('done');setTimeout(()=>$('loading').classList.add('hidden'),650);$('world-name').textContent=this.app.world.def.name;$('route-length').textContent=(this.app.world.network.totalLength/1000).toFixed(1)+' km';this.update();}
 fatal(message){$('loading').classList.add('hidden');$('fatal').classList.remove('hidden');$('fatal-message').textContent=message;}
 toggleControl(name){this.guard(()=>{const t=this.app.player;if(name==='doors'){const open=t.toggleDoors();this.toast(open?'Doors open. Traction is interlocked.':'Doors closed.');}else{t.controls[name]=!t.controls[name];if(name==='master'&&!t.controls.master)t.controls.throttle=0;}this.update();});}
 depart(){const t=this.app.player;if(t.derailed)return this.toast('Recover the train in Setup before departing.',true);if(t.controls.emergency){if(Math.abs(t.speed)>.2)return this.toast('Stop and reset the emergency brake.',true);t.resetEmergency();}t.controls.doors=false;t.controls.master=true;t.controls.pantograph=true;t.controls.parking=false;if(Math.abs(t.speed)<.2)t.controls.reverser=1;t.controls.brake=0;t.controls.independent=0;t.controls.dynamic=0;t.controls.throttle=.58;this.app.togglePause(false);this.toast('Brake release selected. Air pressure will recharge as traction builds.');this.app.audio.enable().catch(()=>{});}
 cycleCamera(direction){const i=CAMERA_MODES.indexOf(this.app.camera.mode);this.app.camera.setMode(CAMERA_MODES[(i+direction+CAMERA_MODES.length)%CAMERA_MODES.length]);this.update();}
 nextStation(){const a=this.app,t=a.player;if(a.mission.mode!=='free'&&a.mission.target&&!a.mission.complete)return {station:a.mission.target,distance:t.cursor.distanceTo(a.mission.target.edge,a.mission.target.s)};let best=null,dist=Infinity;for(const s of a.world.stations){const d=t.cursor.distanceTo(s.edge,s.s);if(d>35&&d<dist){dist=d;best=s;}}return {station:best,distance:dist};}
 update(){const a=this.app;if(!a.player||!a.world)return;const t=a.player,c=t.controls,pose=t.cursor.pose(),limit=a.currentLimit||120,factor=a.settings.units==='mph'?.621371:1,speed=Math.abs(t.speed)*3.6*factor;
  $('speed').textContent=Math.round(speed);$('speed-unit').textContent=a.settings.units;$('limit').textContent=Math.round(limit*factor);$('speed-arc-fill').style.strokeDasharray=`${clamp(speed/(t.stock.maxSpeed*factor)*100,0,100)} 100`;$('speed-arc-fill').style.stroke=speed>limit*factor+2?'#dfa98c':'#b8d9b1';$('throttle-value').textContent=`${Math.round(c.throttle*100)}%`;$('brake-value').textContent=`${Math.round(c.brake*100)}%`;for(const key of ['throttle','brake'])if(document.activeElement!==$(key))$(key).value=Math.round(c[key]*100);
  $('train-name').textContent=t.stock.name.toUpperCase();$('pipe').textContent=t.pipe.toFixed(1);$('pipe-bar').style.width=`${t.pipe/5*100}%`;$('gradient').textContent=`${t.grade>=0?'+':''}${(t.grade*1000).toFixed(1)} ‰`;$('grade-bar').style.width=`${clamp(50+t.grade*1000,0,100)}%`;$('mass').textContent=`${Math.round(t.mass/1000)} t`;
  $('traction-status').textContent=t.derailed?'TRAIN DISABLED':c.emergency?'EMERGENCY':c.doors?'DOOR INTERLOCK':!c.master?'MASTER OFF':t.electric&&!c.pantograph?'PANTO DOWN':t.electric&&!a.env.electrified?'NO LINE SUPPLY':c.parking?'PARKING BRAKE':t.wheelslip>.01?'WHEEL SLIP':t.protection?'SAFETY BRAKING':t.brakeForce>t.mass*.15?'BRAKE APPLIED':c.throttle>.02?'POWER APPLIED':'COASTING';
  document.querySelectorAll('[data-control]').forEach(b=>b.classList.toggle('active',!!c[b.dataset.control]));document.querySelectorAll('[data-direction]').forEach(b=>b.classList.toggle('active',Number(b.dataset.direction)===c.reverser));$('emergency').classList.toggle('latched',c.emergency);$('emergency').querySelector('span:nth-child(2)').textContent=c.emergency?'RESET EMERGENCY':'EMERGENCY BRAKE';
  $('camera-name').textContent=CAMERA_LABELS[a.camera.mode];$('clock').textContent=`${Math.floor(a.env.hour).toString().padStart(2,'0')}:${Math.floor(a.env.hour%1*60).toString().padStart(2,'0')}`;$('weather-name').textContent=WEATHER[a.env.weather].name;$('backend').textContent=a.renderer.kind.toUpperCase();$('fps').textContent=`${Math.round(a.fps||0)} FPS`;$('render-detail').textContent=`${Math.round(a.renderer.triangles/1000)}k tris`;$('audio-toggle').classList.toggle('active',a.audio.enabled);$('pause-toggle').innerHTML=icon(a.paused?'play':'pause');$('pause-toggle').setAttribute('aria-label',a.paused?'Resume simulation':'Pause simulation');$('paused-badge').classList.toggle('hidden',!a.paused);
  const {station,distance}=this.nextStation();$('next-name').textContent=station?.name||'Open line';const miles=a.settings.units==='mph';const dist=distance*(miles?.000621371:.001);$('next-distance').textContent=Number.isFinite(dist)?dist.toFixed(1):'—';$('next-unit').textContent=miles?'mi':'km';$('next-eta').textContent=t.speed>.6&&Number.isFinite(distance)?`ETA ${Math.floor(distance/t.speed/60)}:${Math.floor(distance/t.speed%60).toString().padStart(2,'0')}`:'DEPART WHEN READY';$('route-progress').style.width=`${clamp(100-distance/40,3,97)}%`;
  const danger=a.world.traffic.dangerDistance(t),dangerous=Number.isFinite(danger);$('signal-status').innerHTML=`<i style="background:${dangerous?'#e6bb79':'#b8d9b1'}"></i>${dangerous?`Stop in ${Math.round(danger)} m`:'Line clear'}`;
  let here=null;for(const s of a.world.stations)if(s.edge===pose.edge&&Math.abs(s.s-pose.s)<190)here=s;$('current-station').textContent=here?.name||a.world.def.name;$('journey-description').textContent=a.mission.mode==='free'?(Math.abs(t.speed)<.25?'A little further from the everyday.':`${a.world.def.tag} · ${pose.edge==='branch'?'Scenic branch':'Main line'}`):a.mission.message;
  $('mission-mode').textContent=(SCENARIOS.find(s=>s.id===a.mission.mode)?.name||'FREE ROAM').toUpperCase();$('depart').classList.toggle('hidden',Math.abs(t.speed)>.5||a.mission.complete);$('journey-hint').textContent=a.mission.mode==='free'?(Math.abs(t.speed)>.5?`${t.cars+1} vehicles · ${Math.round(t.length)} m · Explore without a timetable`:'Release the brake. Find your rhythm.'):`${a.mission.stops} / 3 stops · ${Math.round(a.mission.score)} points`;
  const warning=t.derailed?`${t.failureReason||'Train disabled'} — reposition on clear track if needed, then recover in Setup.`:c.emergency?'EMERGENCY BRAKE · Stop, then tap Reset emergency.':t.protection?'TRAIN PROTECTION · Automatic braking for speed or signal.':t.wheelslip>.05?'WHEEL SLIP · Reduce power or apply sand (X).':null;$('safety-banner').classList.toggle('hidden',!warning);if(warning)$('safety-banner').textContent=warning;
  updateCinematicUI(a);this.drawMap($('minimap'),false);if(['map','dispatch','editor'].includes(this.activePanel))this.drawMap($('large-map'),true);if(this.activePanel==='systems')this.updateSystemValues();
 }
 openPanel(name){this.activePanel=name;this.dialog.dataset.panel=name;this.app.panelPause=true;const titles={cinematic:['THE ART OF THE JOURNEY','Display & immersion'],journey:['DRIVING WITH PURPOSE','Your journey'],worlds:['THE RAILWAY IS YOURS','Find your next horizon'],fleet:['YOUR ROLLING STOCK','Choose your train'],map:['THE ENTIRE RAILWAY','Route map'],environment:['A WORLD IN YOUR HANDS','Weather & time'],dispatch:['RAILWAY OPERATIONS','Dispatcher'],editor:['SHAPE THE JOURNEY','World editor'],settings:['MAKE IT YOURS','Simulation & saves'],systems:['ENGINEERING DESK','Train systems'],missions:['A PURPOSE FOR THE JOURNEY','Services & scenarios'],help:['WELCOME ABOARD','Driving guide']};const [over,title]=titles[name]||titles.settings;$('panel-overline').textContent=over;$('panel-title').textContent=title;this.renderPanel(name);if(!this.dialog.open)this.dialog.showModal();}
 closePanel(){this.dialog.close();this.activePanel=null;this.app.panelPause=false;}
 renderPanel(name){const methods={cinematic:'cinematicPanel',journey:'journeyPanel',worlds:'worldsPanel',fleet:'fleetPanel',map:'mapPanel',environment:'environmentPanel',dispatch:'dispatchPanel',editor:'editorPanel',settings:'settingsPanel',systems:'systemsPanel',missions:'missionsPanel',help:'helpPanel'};this[methods[name]||'settingsPanel']();}
 cinematicPanel(){cinematicPanel(this);}
 journeyPanel(){journeyPanel(this);}
 worldsPanel(){expeditionPanel(this);}
 fleetArt(s){const color=s.color,stripe=s.stripe,steam=s.kind==='steam';return `<svg viewBox="0 0 230 62" aria-hidden="true"><path d="M8 52h213" stroke="#a8ba9a" opacity=".4"/>${steam?`<rect x="39" y="17" width="107" height="25" rx="12" fill="${color}"/><rect x="136" y="10" width="32" height="36" fill="${color}"/><path d="M130 10h44"/><rect x="45" y="5" width="8" height="17" fill="#263b31"/><rect x="178" y="27" width="42" height="21" fill="${color}"/><path d="M44 40h171" stroke="${stripe}"/>`:`<path d="M18 43V21q0-8 9-8h153l29 17v13z" fill="${color}" stroke="#91a18a"/><path d="M18 35h190v6H18z" fill="${stripe}" stroke="none"/><path d="M28 19h119v11H28z" fill="#354e4b" stroke="none"/><path d="M156 18h20l18 12h-38z" fill="#354e4b" stroke="none"/><path d="M28 19v11m17-11v11m17-11v11m17-11v11m17-11v11m17-11v11m17-11v11" stroke="${color}" stroke-width="3"/>${['electric','highspeed','metro'].includes(s.kind)?'<path d="m79 11 17-7-14-3h19" stroke="#9cae91"/>':''}`}<g fill="#1b2a23" stroke="#92a18b">${[42,58,151,169,194,209].slice(0,steam?6:4).map(x=>`<circle cx="${x}" cy="45" r="5.5"/>`).join('')}</g></svg>`;}
 fleetPanel(){const a=this.app;$('panel-content').innerHTML=`<p class="panel-intro">Six original locomotives and trainsets, each with its own power, weight, traction and handling. Stop the train before changing rolling stock.</p><div class="fleet-grid">${STOCK.map(s=>`<div class="fleet-card ${a.player.stock.id===s.id?'selected':''}"><div class="fleet-art">${this.fleetArt(s)}</div><h3>${s.name}</h3><span class="family">${s.family}</span><div class="spec-grid"><div><span>POWER</span><b>${(s.power/1e6).toFixed(1)} MW</b></div><div><span>TOP SPEED</span><b>${s.maxSpeed} km/h</b></div><div><span>LOCOMOTIVE</span><b>${s.mass/1000} t</b></div><div><span>TRACTIVE EFFORT</span><b>${s.tractive/1000} kN</b></div></div><button class="secondary ${a.player.stock.id===s.id?'selected':''}" data-stock="${s.id}">${a.player.stock.id===s.id?'Currently driving':'Take the controls'} ${icon('arrow','icon small')}</button></div>`).join('')}</div><div class="panel-notice">Consist length and load affect acceleration, brake propagation and stopping distance. Configure wagons and advanced controls in Train systems.</div>`;document.querySelectorAll('[data-stock]').forEach(b=>b.onclick=()=>this.guard(()=>{a.player.setStock(STOCK.find(s=>s.id===b.dataset.stock));a.camera.initial=true;this.closePanel();this.toast(`${a.player.stock.name} ready. ${a.player.cars+1} vehicles coupled.`);}));}
 field(label,id,min,max,step,value,suffix=''){return `<label class="field"><span>${label}<b id="${id}-display">${value}${suffix}</b></span><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"></label>`;}
 toggle(label,id,value,desc=''){return `<label class="toggle-row"><span>${label}${desc?`<small>${desc}</small>`:''}</span><input id="${id}" type="checkbox" ${value?'checked':''}></label>`;}
 bindRange(id,fn,format=v=>v){$(id).oninput=e=>{const v=Number(e.target.value);$(id+'-display').textContent=format(v);fn(v);};}
 environmentPanel(){const a=this.app;$('panel-content').innerHTML=`<p class="panel-intro">Change the atmosphere without leaving the track. Rain and snow change adhesion, braking and visibility.</p><div class="panel-two-column"><section class="panel-section"><h3>Weather</h3><div class="weather-grid">${Object.entries(WEATHER).map(([id,w])=>`<button class="weather-choice ${a.env.weather===id?'active':''}" data-weather="${id}">${icon('sun','icon small')}${w.name}</button>`).join('')}</div><div class="panel-notice">Wheel adhesion: dry 0.27 · wet 0.14 · snow 0.12. Sand temporarily improves grip. These are simplified simulation parameters.</div></section><section class="panel-section"><h3>Light & time</h3>${this.field('Time of day','env-hour',0,23.99,.01,a.env.hour.toFixed(2),' h')}${this.field('Clock progression','env-rate',0,120,1,a.env.timeRate,'×')}${this.field('Exposure','env-exposure',.5,1.8,.02,a.env.exposure,'×')}<div class="button-row"><button class="secondary" data-hour="6.3">Dawn</button><button class="secondary" data-hour="12">Noon</button><button class="secondary" data-hour="17.3">Golden hour</button><button class="secondary" data-hour="22">Night</button></div></section></div>`;document.querySelectorAll('[data-weather]').forEach(b=>b.onclick=()=>{a.env.weather=b.dataset.weather;a.player.controls.wipers=['rain','storm'].includes(a.env.weather);this.environmentPanel();});this.bindRange('env-hour',v=>a.env.hour=v,v=>`${Math.floor(v)}:${Math.floor(v%1*60).toString().padStart(2,'0')}`);this.bindRange('env-rate',v=>a.env.timeRate=v,v=>v+'×');this.bindRange('env-exposure',v=>a.env.exposure=v,v=>v.toFixed(2)+'×');document.querySelectorAll('[data-hour]').forEach(b=>b.onclick=()=>{a.env.hour=Number(b.dataset.hour);this.environmentPanel();});}
 systemsPanel(){const a=this.app,t=a.player,c=t.controls;$('panel-content').innerHTML=`<div class="panel-two-column"><section class="panel-section"><h3>${t.stock.name} · ${t.stock.family}</h3>${this.toggle('Master power','sys-master',c.master)}${this.toggle('Pantograph raised','sys-panto',c.pantograph)}${this.toggle('Headlights','sys-lights',c.headlights)}${this.toggle('Windscreen wipers','sys-wipers',c.wipers)}${this.toggle('Apply sand','sys-sand',c.sand,'Higher adhesion in poor rail conditions')}${this.toggle('Parking brake','sys-parking',c.parking)}${this.toggle('Doors open','sys-doors',c.doors,'Interlocked while moving')}${this.field('Dynamic brake','sys-dynamic',0,100,1,Math.round(c.dynamic*100),'%')}${this.field('Independent locomotive brake','sys-independent',0,100,1,Math.round(c.independent*100),'%')}</section><section><div class="panel-section"><h3>Consist workshop</h3>${this.field(t.stock.kind==='diesel'?'Loaded wagons':'Passenger coaches','sys-cars',0,t.stock.maxCars,1,t.cars)}<button id="apply-cars" class="secondary">Apply consist · train must be stopped</button><table class="stats-table" id="system-stats"></table></div>${t.stock.kind==='steam'?`<div class="panel-section"><h3>Steam controls</h3>${this.toggle('Automatic fireman','sys-fireman',c.fireman)}${this.field('Fire intensity','sys-fire',0,100,1,t.fire.toFixed(0),'%')}<button id="add-water" class="secondary">Inject water</button></div>`:`<div class="panel-section"><h3>Servicing</h3><p class="map-note">Refill fuel and reset stored energy at a standstill.</p><button id="service-train" class="secondary">Service locomotive</button></div>`}</section></div>`;for(const [id,name]of [['sys-master','master'],['sys-panto','pantograph'],['sys-lights','headlights'],['sys-wipers','wipers'],['sys-sand','sand'],['sys-parking','parking'],['sys-doors','doors'],['sys-fireman','fireman']])if($(id))$(id).onchange=e=>this.guard(()=>{if(name==='doors'){try{t.toggleDoors();}finally{e.target.checked=t.controls.doors;}}else t.controls[name]=e.target.checked;});this.bindRange('sys-dynamic',v=>c.dynamic=v/100,v=>v+'%');this.bindRange('sys-independent',v=>c.independent=v/100,v=>v+'%');this.bindRange('sys-cars',()=>{});$('apply-cars').onclick=()=>this.guard(()=>{t.setCars(Number($('sys-cars').value));this.toast('Consist updated. Mass and brake propagation recalculated.');this.updateSystemValues();});if($('sys-fire'))this.bindRange('sys-fire',v=>t.fire=v,v=>v+'%');if($('add-water'))$('add-water').onclick=()=>{t.water=clamp(t.water+10,0,100);t.boiler=Math.max(2,t.boiler-.6);this.updateSystemValues();};if($('service-train'))$('service-train').onclick=()=>this.guard(()=>{if(Math.abs(t.speed)>.2)throw new Error('Stop before servicing.');t.fuel=100;t.energy=0;this.updateSystemValues();this.toast('Locomotive serviced.');});this.updateSystemValues();}
 updateSystemValues(){const t=this.app.player;if(!$('system-stats'))return;const rows=[['Consist',`${t.cars+1} vehicles · ${Math.round(t.length)} m`],['Gross mass',`${(t.mass/1000).toFixed(0)} t`],['Tractive effort',`${(Math.abs(t.traction)/1000).toFixed(1)} kN`],['Brake effort',`${(t.brakeForce/1000).toFixed(1)} kN`],['Air brake pipe',`${t.pipe.toFixed(2)} bar`],['Acceleration',`${t.acceleration.toFixed(3)} m/s²`],['Net energy',`${t.energy.toFixed(1)} kWh`],[t.stock.kind==='steam'?'Boiler pressure':'Fuel',t.stock.kind==='steam'?`${t.boiler.toFixed(1)} bar`:`${t.fuel.toFixed(1)}%`]];if(t.stock.kind==='steam')rows.push(['Boiler water',`${t.water.toFixed(1)}%`]);$('system-stats').innerHTML=rows.map(([a,b])=>`<tr><td>${a}</td><td>${b}</td></tr>`).join('');}
 mapPanel(){const a=this.app;$('panel-content').innerHTML=`<p class="panel-intro">A live view of the complete railway. Stations, your train, AI services and both junction routes share the same physical network.</p><div class="map-layout"><div class="large-map-wrap"><canvas id="large-map" class="large-map"></canvas><div class="map-legend"><span style="color:#e6bb79">● Your train</span><span style="color:#92c3c2">● AI services</span><span>○ Station</span><span>— Main line</span><span>╌ Scenic branch</span></div></div><aside><span class="overline">STATIONS</span><div class="station-list">${a.world.stations.map(s=>`<button data-station="${s.id}">${escapeHTML(s.name)}<span>${icon('arrow','icon small')}</span></button>`).join('')}</div><p class="map-note">Select a station to relocate your train while stopped. Teleporting resets the current service.</p><button class="secondary" id="map-switch">${a.world.network.switchBranch?'Scenic branch selected':'Main line selected'}</button><p class="map-note">A turnout is locked while a train occupies its approach or fouling zone.</p></aside></div>`;document.querySelectorAll('[data-station]').forEach(b=>b.onclick=()=>this.guard(()=>{const st=a.world.stations.find(s=>s.id===b.dataset.station);a.teleport(st.edge,st.s);this.toast(`Positioned at ${st.name}.`);}));$('map-switch').onclick=()=>this.guard(()=>{a.toggleSwitch();$('map-switch').textContent=a.world.network.switchBranch?'Scenic branch selected':'Main line selected';});this.bindMap(false);this.drawMap($('large-map'),true);}
 dispatchPanel(){const a=this.app;$('panel-content').innerHTML=`<div class="panel-two-column"><section><div class="panel-section"><h3>Junction control</h3><p class="map-note">Set the next diverging route. The full consist retains its chosen route until it clears the junction.</p><div class="button-row"><button id="dispatch-switch" class="primary">${a.world.network.switchBranch?'Scenic branch':'Main line'} selected</button><button id="hold-signal" class="secondary">Hold next block</button><button id="clear-signals" class="secondary">Release holds</button></div><p id="signal-holds" class="map-note">${a.world.traffic.holds.size} manually held blocks · ${a.world.traffic.occupied.size} occupied blocks</p></div><div class="large-map-wrap"><canvas id="large-map" class="large-map" style="height:240px"></canvas></div></section><section><span class="section-label">Active trains</span>${a.trains.map(t=>`<div class="dispatch-train"><div><b>${t===a.player?'● ':''}${t.stock.name}</b><small>${t.id==='player'?'You':t.id} · ${(Math.abs(t.speed)*3.6).toFixed(0)} km/h · ${t.cars+1} vehicles</small></div>${t!==a.player?`<button class="secondary" data-takeover="${t.id}">Drive</button><button class="bare" data-remove="${t.id}" title="Remove train">×</button>`:'<span class="overline">DRIVING</span>'}</div>`).join('')}<div class="button-row"><button id="add-ai" class="secondary">+ Add AI service</button><button id="auto-drive" class="secondary ${a.autopilot?'active':''}">${a.autopilot?'Disable':'Enable'} autopilot</button></div><div class="panel-notice">AI observes block occupancy, curves and station stops. This is a simplified one-way block system, not a complete railway interlocking implementation.</div></section></div>`;$('dispatch-switch').onclick=()=>this.guard(()=>{a.toggleSwitch();this.dispatchPanel();});$('hold-signal').onclick=()=>{a.world.traffic.holds.add(a.world.traffic.block(a.player.cursor.pose(480)));this.dispatchPanel();this.toast('Next approach block held at danger.');};$('clear-signals').onclick=()=>{a.world.traffic.holds.clear();this.dispatchPanel();};$('add-ai').onclick=()=>this.guard(()=>{a.addAI();this.dispatchPanel();});$('auto-drive').onclick=()=>{a.autopilot=!a.autopilot;this.dispatchPanel();};document.querySelectorAll('[data-takeover]').forEach(b=>b.onclick=()=>{a.takeOver(b.dataset.takeover);this.closePanel();this.toast('You have control of this service.');});document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{a.removeAI(b.dataset.remove);this.dispatchPanel();});this.drawMap($('large-map'),true);}
 missionsPanel(){const a=this.app;$('panel-content').innerHTML=`<p class="panel-intro">Choose a purpose for your run. Passenger services reward precise stops and smooth driving. Free roam leaves every tool open.</p>${SCENARIOS.map(s=>`<div class="mission-card"><div class="mission-icon">${icon('flag')}</div><div><h3>${s.name}</h3><p>${s.description}</p></div><button class="secondary ${a.mission.mode===s.id?'selected':''}" data-mission="${s.id}">${a.mission.mode===s.id?'Restart':'Start'} service</button></div>`).join('')}<div class="panel-section"><h3>Current service</h3><p>${escapeHTML(a.mission.message)}</p><div class="spec-grid"><div><span>SCORE</span><b>${Math.round(a.mission.score)}</b></div><div><span>STATIONS SERVED</span><b>${a.mission.stops}</b></div><div><span>PASSENGERS BOARDED</span><b>${a.mission.boarded}</b></div><div><span>STATUS</span><b>${a.mission.complete?'Complete':a.mission.mode==='free'?'Exploring':'In service'}</b></div></div>${a.mission.stopLog.map(s=>`<p class="map-note">${escapeHTML(s.station)} · ${escapeHTML(s.result)}</p>`).join('')}</div>`;document.querySelectorAll('[data-mission]').forEach(b=>b.onclick=()=>{a.startMission(b.dataset.mission);this.closePanel();this.toast(a.mission.mode==='free'?'Free roam. The railway is yours.':'Service started. Follow the next station marker.');});}
 settingsPanel(){const a=this.app,s=a.settings;$('panel-content').innerHTML=`<div class="panel-two-column"><section><div class="panel-section"><h3>Graphics</h3><button class="secondary" id="cinematic-settings">Display, immersion & photo studio</button><label class="field"><span>Rendering quality</span><select id="set-quality">${['low','medium','high','ultra'].map(q=>`<option value="${q}" ${s.quality===q?'selected':''}>${q[0].toUpperCase()+q.slice(1)}</option>`).join('')}</select></label>${this.field('Render resolution','set-resolution',50,100,5,Math.round(s.resolution*100),'%')}${this.toggle('Directional shadows','set-shadows',s.shadows)}${this.toggle('Adaptive resolution','set-adaptive',s.adaptive,'Reduce resolution when frame time stays high.')}<div class="panel-notice">Active backend: <b>${a.renderer.kind}</b>. WebGPU is preferred; WebGL 2 is the compatibility fallback. No external assets or libraries are downloaded.</div></div><div class="panel-section"><h3>Audio</h3>${this.field('Master volume','set-volume',0,100,1,Math.round(s.volume*100),'%')}<button class="secondary" id="set-audio">${a.audio.enabled?'Mute sound':'Enable sound'}</button></div></section><section><div class="panel-section"><h3>Driving</h3>${this.toggle('Automatic train protection','set-safety',s.safety,'Brakes for excessive speed and occupied blocks.')}${this.toggle('Gamepad input','set-gamepad',s.gamepad)}<label class="field"><span>Speed units</span><select id="set-units"><option value="km/h" ${s.units==='km/h'?'selected':''}>Kilometres per hour</option><option value="mph" ${s.units==='mph'?'selected':''}>Miles per hour</option></select></label>${this.field('Simulation speed','set-time',.25,4,.25,s.timeScale,'×')}<div class="button-row"><button id="recover" class="secondary danger-button">Recover stopped train</button><button id="hide-hud" class="secondary">Hide controls</button></div></div><div class="panel-section"><h3>Keep your railway</h3><div class="button-row"><button id="save-project" class="primary">${icon('save','icon small')} Export project</button><button id="open-project" class="secondary">Open project</button><button id="restore-save" class="secondary" ${storageGet(SAVE_KEY)?'':'disabled'}>Restore autosave</button></div><p class="map-note">Autosaves are local to this browser. Export a JSON project to transfer your world, trains, weather and progress to another device.</p><button id="save-now" class="secondary">Save in this browser</button></div></section></div>`;$('cinematic-settings').onclick=()=>this.openPanel('cinematic');$('set-quality').onchange=e=>{s.quality=e.target.value;a.applySettings();};this.bindRange('set-resolution',v=>{s.resolution=v/100;a.applySettings();},v=>v+'%');for(const id of ['shadows','adaptive','safety','gamepad'])$('set-'+id).onchange=e=>{s[id]=e.target.checked;a.applySettings();};$('set-units').onchange=e=>s.units=e.target.value;this.bindRange('set-volume',v=>{s.volume=v/100;a.audio.volume=s.volume;},v=>v+'%');this.bindRange('set-time',v=>s.timeScale=v,v=>v+'×');$('set-audio').onclick=()=>this.guard(async()=>{await a.audio.toggle();$('set-audio').textContent=a.audio.enabled?'Mute sound':'Enable sound';});$('recover').onclick=()=>{a.recover();this.toast('Train recovered and brakes secured.');};$('hide-hud').onclick=()=>{this.closePanel();document.body.classList.add('hud-hidden');};$('save-project').onclick=()=>a.exportProject();$('open-project').onclick=()=>$('project-file').click();$('restore-save').onclick=()=>this.guard(async()=>{await a.importProject(JSON.parse(storageGet(SAVE_KEY)));this.closePanel();this.toast('Autosave restored.');});$('save-now').onclick=()=>this.toast(a.autosave()?'Saved in this browser.':'Browser storage is unavailable. Export a project instead.',!a.storageAvailable);}
 editorPanel(){const a=this.app;if(!this.draft||this.editorWorld!==a.world){this.draft=structuredClone(a.world.editor);this.editorWorld=a.world;this.editorUndo=[];this.editorRedo=[];this.newTrack=[];this.editorTool='inspect';}$('panel-content').innerHTML=`<p class="panel-intro">Place scenery, shape terrain, add stations, or draw your own closed railway. Edits are staged until you apply them. Applying changes pauses and safely repositions the train.</p><div class="editor-toolbar">${Object.keys(toolTip).map(id=>`<button class="secondary ${this.editorTool===id?'active':''}" data-tool="${id}">${{inspect:'Inspect',teleport:'Position train',tree:'Tree',building:'House',rock:'Rock',raise:'Raise',lower:'Lower',station:'Station',track:'Draw track',erase:'Erase'}[id]}</button>`).join('')}</div><div class="map-layout"><div class="large-map-wrap"><canvas id="large-map" class="large-map"></canvas><div class="map-legend" id="editor-tool-hint">${toolTip[this.editorTool]}</div></div><aside><label class="field"><span>World seed</span><input id="edit-seed" type="number" min="1" max="2147483647" value="${this.draft.seed}"></label>${this.field('Terrain brush radius','edit-radius',20,350,10,this.brushRadius||90,' m')}${this.field('Track node elevation','edit-elevation',5,500,1,this.nodeElevation||a.world.def.railY,' m')}${this.toggle('Overhead electrification','edit-wires',this.draft.electrified)}<button id="build-track" class="secondary">Build custom track (${this.newTrack.length} nodes)</button><p class="map-note">Each new node uses the selected elevation. Keep grades gentle and curves broad. Add four or more nodes at least 25 m apart.</p><button id="reset-track" class="secondary danger-button">Restore original railway</button></aside></div><div class="editor-footer"><button id="edit-undo" class="secondary" ${this.editorUndo.length?'':'disabled'}>Undo</button><button id="edit-redo" class="secondary" ${this.editorRedo.length?'':'disabled'}>Redo</button><button id="mobile-build-track" class="secondary">Build track (${this.newTrack.length})</button><span class="editor-status">${this.draft.objects.length} objects · ${this.draft.heightEdits.length} terrain edits · ${this.draft.stations.length} new stations</span><button id="edit-apply" class="primary">Apply world changes ${icon('arrow','icon small')}</button></div>`;
  document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{this.editorTool=b.dataset.tool;this.editorPanel();});this.bindRange('edit-radius',v=>this.brushRadius=v,v=>v+' m');this.bindRange('edit-elevation',v=>this.nodeElevation=v,v=>v+' m');$('edit-wires').onchange=e=>{this.editorCheckpoint();this.draft.electrified=e.target.checked;};$('edit-seed').onchange=e=>{this.editorCheckpoint();this.draft.seed=clamp(Number(e.target.value)||a.world.def.seed,1,2147483647);};const build=()=>this.guard(()=>{if(this.newTrack.length<4)throw new Error('Place at least four track nodes.');for(let i=0;i<this.newTrack.length;i++){const p=this.newTrack[i],q=this.newTrack[(i+1)%this.newTrack.length];if(Math.hypot(p.x-q.x,p.z-q.z)<25)throw new Error('Track nodes must be at least 25 m apart.');}this.editorCheckpoint();this.draft.customTrack=structuredClone(this.newTrack);this.draft.stations=[];this.newTrack=[];this.editorTool='inspect';this.editorPanel();this.toast('Custom route staged. Apply world changes to construct it.');});$('build-track').onclick=build;$('mobile-build-track').onclick=build;$('reset-track').onclick=()=>{this.editorCheckpoint();this.draft.customTrack=null;this.draft.stations=[];this.newTrack=[];this.editorPanel();};$('edit-undo').onclick=()=>{this.editorRedo.push(structuredClone(this.draft));this.draft=this.editorUndo.pop();this.editorPanel();};$('edit-redo').onclick=()=>{this.editorUndo.push(structuredClone(this.draft));this.draft=this.editorRedo.pop();this.editorPanel();};$('edit-apply').onclick=()=>this.guard(async()=>{const draft=structuredClone(this.draft);this.closePanel();await a.rebuildWorld(draft);this.draft=null;this.toast('Your world is ready.');});this.bindMap(true);this.drawMap($('large-map'),true);
 }
 editorCheckpoint(){this.editorUndo.push(structuredClone(this.draft));if(this.editorUndo.length>30)this.editorUndo.shift();this.editorRedo=[];}
 bindMap(editor){const canvas=$('large-map');if(!canvas)return;canvas.onclick=e=>this.guard(()=>{const r=canvas.getBoundingClientRect(),point=this.mapToWorld(e.clientX-r.left,e.clientY-r.top,r.width,r.height);if(!editor){const near=this.app.world.network.nearest(point.x,point.z);if(near&&near.distance<80)this.toast(`${near.edge==='branch'?'Scenic branch':'Main line'} · ${Math.round(near.s)} m · ${Math.round(this.app.world.network.edges.get(near.edge).speedLimit(near.s))} km/h`);return;}const t=this.editorTool;if(t==='inspect')return;if(t==='teleport'){const near=this.app.world.network.nearest(point.x,point.z);if(near)this.app.teleport(near.edge,near.s);return;}if(t==='track'){if(this.newTrack.length>=150)throw new Error('Maximum 150 control points.');this.newTrack.push({...point,y:this.nodeElevation||this.app.world.def.railY});this.editorPanel();return;}this.editorCheckpoint();if(['tree','building','rock'].includes(t)){if(this.draft.objects.length>=1500)throw new Error('Maximum 1,500 placed objects.');this.draft.objects.push({type:t,...point,size:18,rotation:0});}else if(['raise','lower'].includes(t)){if(this.draft.heightEdits.length>=250)throw new Error('Maximum 250 terrain brushes.');this.draft.heightEdits.push({...point,radius:this.brushRadius||90,delta:t==='raise'?25:-25});}else if(t==='station'){if(this.draft.stations.length>=50)throw new Error('Maximum 50 extra stations.');const p=this.app.world.network.nearest(point.x,point.z);if(p)this.draft.stations.push({edge:p.edge,s:p.s,name:`New station ${this.draft.stations.length+1}`});}else if(t==='erase'){let best=-1,dist=120;this.draft.objects.forEach((o,i)=>{const d=Math.hypot(point.x-o.x,point.z-o.z);if(d<dist){best=i;dist=d;}});if(best>=0)this.draft.objects.splice(best,1);else this.toast('No placed object within 120 m.');}this.editorPanel();});}
 mapToWorld(x,y,width,height){const range=this.mapRange(),scale=Math.min(width,height)/(range*2);return {x:(x-width/2)/scale,z:(y-height/2)/scale};}
 mapRange(){const world=this.app.world,b=world.network.bounds;return world.terrain?Math.max(Math.abs(b.minX),Math.abs(b.maxX),Math.abs(b.minZ),Math.abs(b.maxZ))*1.04:Math.max(world.def.rx,world.def.rz)*1.43;}
 createMapCache(){const world=this.app.world,w=world.def,size=192,range=this.mapRange();const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const ctx=canvas.getContext('2d'),img=ctx.createImageData(size,size);for(let z=0;z<size;z++)for(let x=0;x<size;x++){const wx=(x/size-.5)*range*2,wz=(z/size-.5)*range*2,h=world.baseHeight(wx,wz),i=(z*size+x)*4;const water=h<w.water,contour=Math.abs(h%55)<3,shade=water?0:clamp((h-w.water)/w.mountains,0,1)*.22;img.data[i]=water?23:Math.floor(40+shade*100-(contour?6:0));img.data[i+1]=water?57:Math.floor(65+shade*100-(contour?6:0));img.data[i+2]=water?53:Math.floor(43+shade*80-(contour?4:0));img.data[i+3]=255;}ctx.putImageData(img,0,0);this.mapCache=canvas;this.mapWorld=world;}
 drawMap(canvas,large){if(!canvas||!this.app.world)return;const a=this.app;if(!this.mapCache||this.mapWorld!==a.world)this.createMapCache();const rect=canvas.getBoundingClientRect(),dpr=large?Math.min(devicePixelRatio||1,2):2,width=Math.max(rect.width,10),height=Math.max(rect.height,10);if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);}const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);const range=this.mapRange(),scale=Math.min(width,height)/(2*range);const x0=width/2,z0=height/2,size=range*2*scale;ctx.fillStyle='#182b20';ctx.fillRect(0,0,width,height);ctx.globalAlpha=large?.95:.55;ctx.drawImage(this.mapCache,x0-size/2,z0-size/2,size,size);ctx.globalAlpha=1;const point=p=>[x0+p[0]*scale,z0+p[2]*scale];ctx.strokeStyle='#c4d0b329';ctx.lineWidth=.5;for(let i=-3;i<=3;i++){ctx.beginPath();ctx.moveTo(x0+i*size/6,z0-size/2);ctx.lineTo(x0+i*size/6,z0+size/2);ctx.stroke();ctx.beginPath();ctx.moveTo(x0-size/2,z0+i*size/6);ctx.lineTo(x0+size/2,z0+i*size/6);ctx.stroke();}
  for(const edge of a.world.network.edges.values()){ctx.strokeStyle=edge.id==='branch'?'#d0b688':'#c5d4b7';ctx.lineWidth=large?2:1.2;ctx.setLineDash(edge.id==='branch'?[3,3]:[]);ctx.beginPath();for(let i=0;i<edge.points.length;i+=10){const p=point(edge.points[i]);if(i===0)ctx.moveTo(...p);else ctx.lineTo(...p);}ctx.lineTo(...point(edge.points.at(-1)));ctx.stroke();}ctx.setLineDash([]);
  for(const st of a.world.stations){const p=point(a.world.network.edges.get(st.edge).at(st.s).p);ctx.fillStyle='#1c3026';ctx.strokeStyle='#e2e4c4';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(...p,large?4:2.5,0,Math.PI*2);ctx.fill();ctx.stroke();if(large){ctx.fillStyle='#e0e7d2';ctx.font='9px system-ui';ctx.fillText(st.name,p[0]+7,p[1]-5);}}
  if(this.activePanel==='editor'&&large&&this.draft){for(const o of this.draft.objects){ctx.fillStyle=o.type==='tree'?'#b7cc7d':'#d1b588';ctx.fillRect(x0+o.x*scale-2,z0+o.z*scale-2,4,4);}for(const e of this.draft.heightEdits){ctx.fillStyle=e.delta>0?'#b6c27928':'#78b0c22c';ctx.beginPath();ctx.arc(x0+e.x*scale,z0+e.z*scale,e.radius*scale,0,Math.PI*2);ctx.fill();}const nodes=this.newTrack.length?this.newTrack:this.draft.customTrack;if(nodes?.length){ctx.strokeStyle='#eba06c';ctx.lineWidth=2;ctx.beginPath();nodes.forEach((p,i)=>{const x=x0+p.x*scale,y=z0+p.z*scale;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});if(!this.newTrack.length)ctx.closePath();ctx.stroke();for(const p of nodes){ctx.fillStyle='#f0c58f';ctx.beginPath();ctx.arc(x0+p.x*scale,z0+p.z*scale,3,0,Math.PI*2);ctx.fill();}}}
  for(const t of a.trains){const pose=t.cursor.pose(),p=point(pose.p);ctx.save();ctx.translate(...p);ctx.rotate(-Math.atan2(pose.f[0],pose.f[2]));ctx.fillStyle=t===a.player?'#efbd75':'#88ced0';ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=large?8:4;ctx.beginPath();const n=large?6:4;ctx.moveTo(0,n);ctx.lineTo(-n*.7,-n);ctx.lineTo(0,-n*.5);ctx.lineTo(n*.7,-n);ctx.closePath();ctx.fill();ctx.restore();}if(large){ctx.fillStyle='#b4c2a4';ctx.font='10px system-ui';ctx.fillText('N ↑',13,20);ctx.fillText(`${(a.world.network.totalLength/1000).toFixed(1)} km surveyed main line`,13,height-13);}
 }
 helpPanel(){const rows=[['Power up / down','W / S'],['Brake apply / release','D / A'],['Emergency brake','Space'],['Cycle camera','C'],['Cameras 1–6','1–6'],['Horn (hold)','H'],['Open / close doors','O'],['Headlights','L'],['Raise / lower pantograph','P'],['Wipers','K'],['Apply sand (hold)','X'],['Reverser (stopped)','R'],['Route map','M'],['Pause / resume','Esc'],['Export project','Ctrl / ⌘ + S'],['Free camera move / rise','WASD / E / Q']];$('panel-content').innerHTML=`<div class="panel-two-column"><section class="panel-section"><h3>Your first departure</h3><div class="guide-step"><b>1</b><span><strong>Begin your journey</strong> closes doors, releases brakes, selects forward and applies moderate power. Air brakes take a few seconds to release.</span></div><div class="guide-step"><b>2</b><span>Adjust power and brake with the sliders. For manual driving, keep the master on and raise the pantograph on electric trains.</span></div><div class="guide-step"><b>3</b><span>Plan your stop early. Reduce power, apply the train brake and watch the next-station distance. Brakes apply progressively along the consist.</span></div><div class="guide-step"><b>4</b><span>For passenger services, stop within <strong>18 m</strong> of the marker and open doors for <strong>20 seconds</strong>. Close them before departing.</span></div><div class="guide-step"><b>5</b><span>Drag the world to orbit or look from the cab. Pinch or scroll to zoom. Use the tools on the right to change worlds, trains, traffic and scenery.</span></div><div class="panel-notice">Gamepad: right trigger for power, left trigger for brake; right stick to look; A to change camera; B for emergency; X for doors; Y for horn. In free camera, WASD flies, Q/E change height and Shift accelerates.</div></section><section><div class="key-grid" style="grid-template-columns:1fr">${rows.map(([label,key])=>`<div class="key-row"><span>${label}</span><kbd>${key}</kbd></div>`).join('')}</div></section></div><div class="panel-notice">This is an entertainment simulation, not certified driver training. Train dynamics, signaling, routes and rolling stock are simplified and fictional. Mobile performance varies with device, browser and thermal limits.</div>`;}
}

return {icon,UI};
})();
// ---- src/main.js ----
const __m_src_main_js = (() => {
const {GroundCover} = __m_src_botany_js;
const {postOptions} = __m_src_postprocess_js;
const {JourneyDirector} = __m_src_journey_js;
const {WorldLife} = __m_src_world_life_js;
const {installCinematicUI,togglePhotoMode} = __m_src_cinematic_ui_js;
const {WORLDS,STOCK,WEATHER} = __m_src_data_js;
const {clamp,mod,downloadFile} = __m_src_math_js;
const {Renderer} = __m_src_renderer_js;
const {RailwayWorld} = __m_src_world_js;
const {Train,Traffic,Mission} = __m_src_physics_js;
const {RailCursor} = __m_src_tracks_js;
const {RollingStockRenderer} = __m_src_rolling_stock_js;
const {PRIMITIVES} = __m_src_geometry_js;
const {CameraRig,CAMERA_MODES} = __m_src_camera_js;
const {RailAudio} = __m_src_audio_js;
const {UI} = __m_src_ui_js;
const {SAVE_KEY,storageGet,storageSet,validateProject,encodeProject} = __m_src_persistence_js;


















/** Owns the simulation lifecycle. Physics uses bounded, fixed 1/60-second steps. */
class RailboundApp {
 constructor(){
  const mobile=matchMedia('(max-width: 760px)').matches;
  this.settings={quality:mobile?'medium':'high',resolution:mobile?.8:1,shadows:true,adaptive:true,safety:true,units:'km/h',volume:.36,timeScale:1,gamepad:true,cinematic:postOptions(),wildlife:true,ambience:true,coach:true,cameraMotion:!matchMedia('(prefers-reduced-motion: reduce)').matches};
  this.env={hour:16.4,weather:'clear',timeRate:4,exposure:1,electrified:true};
  this.journey=new JourneyDirector();this.life=new WorldLife();this.groundCover=new GroundCover();this.camera=new CameraRig();this.audio=new RailAudio();this.rolling=new RollingStockRenderer();this.ui=new UI(this);
  this.renderer=new Renderer(document.getElementById('viewport'),message=>this.ui.toast(message,true));
  this.trains=[];this.player=null;this.world=null;this.mission=new Mission();this.keys=new Set();this.ready=false;this.renderEnabled=true;this.loadingWorld=false;this.paused=false;this.panelPause=false;this.autopilot=false;this.hidden=document.hidden;
  this.accumulator=0;this.simTime=0;this.uiClock=0;this.fps=0;this.fpsFrames=0;this.fpsClock=0;this.lastFrame=0;this.currentLimit=120;this.saveClock=0;this.adaptClock=0;this.gamepadButtons=[];this.userActive=false;this.lastSave=null;
  this.storageAvailable=storageSet('railbound-storage-probe','1');this.existingSave=storageGet(SAVE_KEY);
  this.frame=this.frame.bind(this);
 }
 async initialize(){
  await this.renderer.initialize();this.applySettings();this.bindInput();installCinematicUI(this);
  await this.loadWorld('alpine');this.ready=true;requestAnimationFrame(this.frame);
  if(this.existingSave)this.ui.toast('A previous journey is saved. Open Setup → Restore saved journey to continue.');
  if(this.renderer.lastError)this.ui.toast('WebGPU was unavailable. The WebGL 2 renderer is active.');
  if('serviceWorker' in navigator&&isSecureContext&&location.protocol!=='file:'&&!globalThis.RAILBOUND_STANDALONE)navigator.serviceWorker.register('./sw.js').catch(()=>{});
 }
 async loadWorld(id,editor=null,restored=null){
  if(this.loadingWorld)throw new Error('A world is already being constructed.');
  const def=WORLDS.find(w=>w.id===id);if(!def)throw new Error('Unknown world.');
  this.loadingWorld=true;this.accumulator=0;this.audio.stop();this.ui.loading('Surveying the railway',.01);
  let next;
  try{
   next=await RailwayWorld.create(def,editor||{});
   const stock=restored?STOCK.find(s=>s.id===restored.player.stock):(this.player?.stock||STOCK[0]);
   const player=new Train(next.network,stock,'player');
   const traffic=new Traffic(next.network);next.traffic=traffic;
   let trains=[player];
   if(restored){
    player.restore(restored.player);player.id='player';player.ai=false;
    next.network.switchBranch=!!restored.switchBranch;
    for(const [i,data] of restored.ai.entries()){const t=new Train(next.network,STOCK[0],`ai-${i+1}`);t.restore(data);t.id=`ai-${i+1}`;t.ai=true;trains.push(t);}
   }else{
    for(let i=0;i<2;i++){const t=new Train(next.network,STOCK[i===0?4:2],`ai-${i+1}`,'return',next.network.edges.get('return').length*(i===0?.25:.66));t.ai=true;t.speed=i===0?12:9;t.controls.brake=0;t.controls.throttle=.45;t.cylinders.fill(0);trains.push(t);}
   }
   await next.build((label,progress)=>this.ui.loading(label,progress));
   const previous=this.world;
   this.world=next;this.player=player;this.trains=trains;this.life.reset(next);this.groundCover.clear(this.renderer);this.journey.reset(restored?.journey);
   this.env=restored?{...restored.env}:{...this.env,hour:def.hour,weather:def.id==='nordic'?'snow':'clear'};
   this.env.electrified=next.editor.electrified;next.weather=this.env.weather;
   if(restored)this.settings={...this.settings,...restored.settings};
   this.mission=new Mission(restored?.scenario||'free');
   if(restored?.mission){const m=restored.mission;for(const key of ['score','stops','boarded'])if(Number.isFinite(m[key]))this.mission[key]=clamp(m[key],0,1e7);this.mission.complete=!!m.complete;this.mission.lastId=next.stations.some(s=>s.id===m.lastId)?m.lastId:null;this.mission.stopLog=Array.isArray(m.stopLog)?m.stopLog.slice(0,200).filter(s=>s&&typeof s==='object').map(s=>({station:String(s.station).slice(0,64),result:String(s.result).slice(0,128)})):[];}
   if(this.mission.mode!=='free'){this.mission.target=next.stations.find(s=>s.id===restored?.mission?.targetId)||null;if(!this.mission.target)this.mission.chooseTarget(player,next.stations);if(Number.isFinite(restored?.mission?.dwell))this.mission.dwell=clamp(restored.mission.dwell,0,60);if(Number.isFinite(restored?.mission?.penaltyClock))this.mission.penaltyClock=clamp(restored.mission.penaltyClock,0,1);if(typeof restored?.mission?.message==='string')this.mission.message=restored.mission.message.slice(0,200);}
   this.camera.setMode(restored?.camera||'chase');for(const [key,min,max] of [['distance',10,2200],['azimuth',-100,100],['elevation',.055,1.48],['cabYaw',-1.55,1.55],['cabPitch',-.6,.6],['fov',38,90]])if(Number.isFinite(restored?.cameraState?.[key]))this.camera[key]=clamp(restored.cameraState[key],min,max);this.camera.initial=true;this.camera.update(player,next,1/60,this.keys);
   traffic.update(trains);this.currentLimit=this.getSpeedLimit(player);this.autopilot=!!restored?.dispatch?.autopilot;this.paused=!!restored?.paused;this.simTime=restored?.simTime||0;for(const key of restored?.dispatch?.holds||[]){const [edge,index]=key.split(':');if(Number(index)<=Math.ceil(next.network.edges.get(edge).length/400))traffic.holds.add(key);}this.applySettings();this.ui.loaded();
   if(previous)this.renderer.disposeWorld(previous.batches,new Set(Object.values(PRIMITIVES)));
   this.rolling.smoke=[];this.userActive=!!restored;this.lastFrame=0;
  }catch(error){if(next&&next!==this.world)this.renderer.disposeWorld(next.batches,new Set(Object.values(PRIMITIVES)));if(!this.world)this.ui.fatal(error.message);else document.getElementById('loading').classList.add('hidden');throw error;}
  finally{this.loadingWorld=false;}
 }
 async rebuildWorld(editor){
  const project=encodeProject(this),oldPose=this.player.cursor.pose();project.editor=editor;
  // Edits are a new railway topology. Preserve the nearest location, not invalid old edge history.
  const candidate=new RailwayWorld(this.world.def,editor);const near=candidate.network.nearest(oldPose.p[0],oldPose.p[2]);
  project.player.cursor=new RailCursor(candidate.network,near.edge,near.s).snapshot();project.player.speed=0;project.player.controls.throttle=0;project.player.controls.brake=.7;project.player.derailed=false;project.ai=[];project.mission={score:1000,stops:0,boarded:0};
  await this.loadWorld(project.world,editor,validateProject(project));this.userActive=true;
 }
 applySettings(){Object.assign(this.renderer.settings,{quality:this.settings.quality,resolution:this.settings.resolution,shadows:this.settings.shadows});this.audio.volume=this.settings.volume;this.settings.cinematic=postOptions(this.settings.cinematic);this.renderer.post.options=this.settings.cinematic;this.audio.ambience=this.settings.ambience!==false;this.camera.motion=this.settings.cameraMotion!==false;this.adaptClock=0;}
 getSpeedLimit(train){const p=train.cursor.pose(),edge=this.world.network.edges.get(p.edge);return Math.min(train.stock.maxSpeed,edge.speedLimit(p.s));}
 togglePause(value){this.paused=typeof value==='boolean'?value:!this.paused;this.accumulator=0;this.keys.clear();this.audio.horn(false);this.ui.update();}
 teleport(edge,s){if(Math.abs(this.player.speed)>.15)throw new Error('Stop the train before repositioning it.');if(!this.world.network.edges.has(edge))throw new Error('Invalid rail section.');const cursor=new RailCursor(this.world.network,edge,clamp(s,0,this.world.network.edges.get(edge).length));const original=this.player.cursor;this.player.cursor=cursor;this.world.traffic.update(this.trains);if(this.world.traffic.contacts().some(pair=>pair.includes(this.player.id))){this.player.cursor=original;this.world.traffic.update(this.trains);throw new Error('That track is occupied.');}this.player.controls.throttle=0;this.player.controls.brake=.7;this.player.speed=0;this.camera.initial=true;this.userActive=true;this.mission.target=null;this.ui.toast('Train positioned.');}
 toggleSwitch(){if(this.world.traffic.switchLocked(this.trains))throw new Error('Turnout locked: a train is inside the approach or fouling zone.');this.world.network.switchBranch=!this.world.network.switchBranch;this.userActive=true;this.ui.toast(this.world.network.switchBranch?'Turnout set to scenic branch.':'Turnout set to main line.');}
 addAI(){if(this.trains.length>=6)throw new Error('This world supports one player and five AI services.');const traffic=this.world.traffic,edge=this.world.network.edges.get('return');let added=null;for(let s=400;s<edge.length-400;s+=450){const candidate=new Train(this.world.network,STOCK[(this.trains.length+2)%STOCK.length],`ai-${Date.now()}`,'return',s);if(this.trains.every(t=>{const a=t.cursor.pose().p,b=candidate.cursor.pose().p;return Math.hypot(a[0]-b[0],a[2]-b[2])>t.length+candidate.length+500;})){added=candidate;break;}}if(!added)throw new Error('No clear block with enough separation is available.');added.ai=true;added.controls.brake=0;added.cylinders.fill(0);this.trains.push(added);traffic.update(this.trains);this.userActive=true;this.ui.toast(`${added.stock.name} added to the railway.`);}
 removeAI(id){this.trains=this.trains.filter(t=>t===this.player||t.id!==id);this.world.traffic.update(this.trains);this.userActive=true;}
 takeOver(id){const next=this.trains.find(t=>t.id===id);if(!next||next===this.player)return;const old=this.player,oldId=next.id;old.id=oldId;old.ai=true;next.id='player';next.ai=false;next.controls.throttle=0;this.player=next;this.autopilot=false;this.camera.initial=true;this.mission=new Mission();this.world.traffic.update(this.trains);this.userActive=true;this.ui.toast(`You are now driving ${next.stock.name}.`);}
 startMission(id){this.mission=new Mission(id);if(id==='freight')this.mission.target=this.world.stations.at(-1);else if(id!=='free')this.mission.chooseTarget(this.player,this.world.stations);this.userActive=true;this.ui.toast(id==='free'?'Free exploration selected.':'Service started. Follow the station instructions.');}
 recover(){const t=this.player;t.speed=0;t.acceleration=0;t.derailed=false;t.failureReason=null;t.derailTimer=0;t.risk=0;t.controls.emergency=false;t.controls.throttle=0;t.controls.brake=.7;t.controls.doors=false;t.pipe=1.5;t.cylinders.fill(1);this.autopilot=false;this.userActive=true;this.ui.toast('Train recovered at its current rail position.');}
 projectSnapshot(){return encodeProject(this);}
 async importProject(value){const project=validateProject(value);await this.loadWorld(project.world,project.editor,project);this.userActive=true;}
 exportProject(){if(!this.world)return;downloadFile(`Railbound-${this.world.def.id}-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(encodeProject(this),null,2),'application/json');this.userActive=true;}
 autosave(){if(!this.world||this.loadingWorld)return false;const success=storageSet(SAVE_KEY,JSON.stringify(encodeProject(this)));this.storageAvailable=success;if(success)this.lastSave=new Date();return success;}
 photo(){this.photoRequested=true;this.ui.toast('Capturing the 3D view without the interface.');}
 tick(dt){
  if(this.autopilot)this.world.traffic.controlAI(this.player,dt,this.world.stations,this.env);
  this.world.traffic.update(this.trains);
  for(const pair of this.world.traffic.contacts()){for(const id of pair){const t=this.trains.find(t=>t.id===id);if(t&&!t.derailed){t.derailed=true;t.failureReason='Train collision';t.speed=0;t.controls.parking=true;t.emergency();t.events.push('Train collision: both services stopped. Reposition the stopped train on clear track, then recover it in Setup.');}}}
  for(const t of this.trains){if(t.ai)this.world.traffic.controlAI(t,dt,this.world.stations,this.env);const limit=this.getSpeedLimit(t),danger=this.world.traffic.dangerDistance(t);t.step(dt,this.env,{safety:t.ai||this.settings.safety,limit,danger});if(t===this.player)this.currentLimit=limit;if(t.events.length){for(const event of t.events.splice(0))this.ui.toast(event,true);}}
  this.mission.step(dt,this.player,this.world.stations,this.currentLimit);this.journey.step(dt,this.player,this.world,this.env,this.currentLimit,this.mission);this.env.hour=mod(this.env.hour+dt*this.env.timeRate/3600,24);this.simTime+=dt;
 }
 frame(timestamp){
  requestAnimationFrame(this.frame);if(!this.ready||this.loadingWorld||this.renderer.lost){this.lastFrame=timestamp;return;}
  const elapsed=this.lastFrame?Math.max(0,(timestamp-this.lastFrame)/1000):1/60;this.lastFrame=timestamp;const dt=Math.min(.1,elapsed);
  const stopped=this.paused||this.panelPause||this.hidden;
  if(!stopped){this.pollControls(dt);this.accumulator+=Math.min(.25,elapsed*this.settings.timeScale);let steps=0;while(this.accumulator>=1/60&&steps++<16){this.tick(1/60);this.accumulator-=1/60;}if(steps>=16)this.accumulator=0;}else this.accumulator=0;
  this.world.weather=this.env.weather;this.env.electrified=this.world.editor.electrified;this.camera.update(this.player,this.world,dt,this.panelPause?null:this.keys);
  this.audio.update(this.player,this.env.weather,stopped,this.camera.mode,this.env.hour);this.fpsFrames++;this.fpsClock+=elapsed;this.uiClock+=elapsed;this.saveClock+=elapsed;this.adaptClock+=elapsed;
  if(this.fpsClock>=1){this.fps=this.fpsFrames/this.fpsClock;this.fpsClock=0;this.fpsFrames=0;}
  if(this.uiClock>.1){this.ui.update();this.uiClock=0;}
  if(this.saveClock>30){if(this.userActive)this.autosave();this.saveClock=0;}
  if(this.settings.adaptive&&this.adaptClock>6&&this.fps>0){const r=this.renderer.settings.resolution;if(this.fps<25&&r>.55)this.renderer.settings.resolution=Math.max(.55,r-.08);else if(this.fps>55&&r<this.settings.resolution)this.renderer.settings.resolution=Math.min(this.settings.resolution,r+.03);this.adaptClock=0;}
  if(this.hidden||!this.renderEnabled)return;
  try{
   const dynamic=this.rolling.update(this.trains,this.world,this.camera,stopped?0:dt,this.simTime,this.camera.mode);
   const life=this.life.update(this.world,this.camera,this.simTime,this.settings.quality,this.settings.wildlife);const cover=this.groundCover.update(this.world,this.camera,this.renderer,this.settings.quality);this.renderer.render([...this.world.batches,...dynamic,...life,...cover],this.camera,this.world.def,this.env,this.player,this.simTime);
   if(this.photoRequested){this.photoRequested=false;this.renderer.canvas.toBlob(blob=>{if(!blob)return this.ui.toast('Screenshot is unavailable in this browser.',true);downloadFile(`Railbound-${this.world.def.id}.png`,blob,'image/png');});}
  }catch(error){console.error(error);this.renderer.lost=true;this.ui.fatal(`Rendering stopped: ${error.message}`);}
 }
 pollControls(dt){
  const c=this.player.controls;if(this.camera.mode!=='free'&&!this.autopilot){if(this.keys.has('KeyW'))c.throttle=clamp(c.throttle+dt*.3,0,1);if(this.keys.has('KeyS'))c.throttle=clamp(c.throttle-dt*.3,0,1);if(this.keys.has('KeyD'))c.brake=clamp(c.brake+dt*.4,0,1);if(this.keys.has('KeyA'))c.brake=clamp(c.brake-dt*.4,0,1);}
  if(this.settings.gamepad&&navigator.getGamepads){const pad=Array.from(navigator.getGamepads()).find(Boolean);if(pad){const button=i=>pad.buttons[i]?.pressed||false,edge=i=>button(i)&&!this.gamepadButtons[i];if((pad.buttons[7]?.value||0)>.02||(pad.buttons[6]?.value||0)>.02||this.gamepadDriving){this.gamepadDriving=(pad.buttons[7]?.value||0)>.02||(pad.buttons[6]?.value||0)>.02;c.throttle=pad.buttons[7]?.value||0;c.brake=pad.buttons[6]?.value||0;this.userActive=true;}if(edge(0))this.ui.cycleCamera(1);if(edge(1))this.player.emergency();if(edge(2))this.ui.guard(()=>this.player.toggleDoors());if(button(3)!==!!this.gamepadButtons[3]){if(button(3))this.audio.enable().then(()=>this.audio.horn(true));else this.audio.horn(false);}const dead=x=>Math.abs(x)>.12?x:0;this.camera.rotate(dead(pad.axes[2]||0)*dt*380,dead(pad.axes[3]||0)*dt*300);this.gamepadButtons=pad.buttons.map(b=>b.pressed);}}
 }
 bindInput(){
  const typing=()=>['SELECT','TEXTAREA'].includes(document.activeElement?.tagName)||(document.activeElement?.tagName==='INPUT'&&document.activeElement.type!=='range');
  window.addEventListener('keydown',e=>{
   if((e.ctrlKey||e.metaKey)&&e.code==='KeyS'){e.preventDefault();this.exportProject();return;}
   if(e.code==='F2'){e.preventDefault();togglePhotoMode(this);return;}
   if(e.code==='Escape'&&this.photoMode){e.preventDefault();togglePhotoMode(this,false);return;}
   if(e.code==='Escape'){if(!this.ui.dialog.open){e.preventDefault();this.togglePause();}return;}
   if(typing()||this.panelPause||!this.player)return;
   if(['Space','KeyW','KeyS','KeyA','KeyD','KeyQ','KeyE','KeyH','KeyX','KeyC'].includes(e.code))e.preventDefault();
   this.keys.add(e.code);this.userActive=true;if(this.photoMode||e.repeat)return;
   const actions={Space:()=>this.player.emergency(),KeyC:()=>this.ui.cycleCamera(1),KeyM:()=>this.ui.openPanel('map'),KeyO:()=>this.player.toggleDoors(),KeyL:()=>this.ui.toggleControl('headlights'),KeyP:()=>this.ui.toggleControl('pantograph'),KeyK:()=>this.ui.toggleControl('wipers'),KeyX:()=>this.player.controls.sand=true,KeyR:()=>this.player.setReverser(this.player.controls.reverser===1?0:this.player.controls.reverser===0?-1:1),KeyH:()=>this.audio.enable().then(()=>{if(this.keys.has('KeyH'))this.audio.horn(true);})};
   if(/^Digit[1-6]$/.test(e.code))this.camera.setMode(CAMERA_MODES[Number(e.code.at(-1))-1]);
   if(actions[e.code])this.ui.guard(actions[e.code]);
  });
  window.addEventListener('keyup',e=>{this.keys.delete(e.code);if(e.code==='KeyH')this.audio.horn(false);if(e.code==='KeyX'&&this.player)this.player.controls.sand=false;});
  window.addEventListener('blur',()=>{this.keys.clear();this.audio.horn(false);if(this.player)this.player.controls.sand=false;});
  document.addEventListener('visibilitychange',()=>{this.hidden=document.hidden;this.keys.clear();this.audio.stop();this.lastFrame=0;this.accumulator=0;if(this.hidden&&this.userActive)this.autosave();});
  window.addEventListener('beforeunload',()=>{if(this.userActive)this.autosave();});
  document.addEventListener('pointerdown',()=>{this.userActive=true;},{passive:true});
  const canvas=this.renderer.canvas,points=new Map();let pinch=0;
  canvas.addEventListener('pointerdown',e=>{if(e.button>0)return;canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);points.set(e.pointerId,[e.clientX,e.clientY]);if(points.size===2){const p=[...points.values()];pinch=Math.hypot(p[0][0]-p[1][0],p[0][1]-p[1][1]);}});
  canvas.addEventListener('pointermove',e=>{if(!points.has(e.pointerId))return;const old=points.get(e.pointerId);points.set(e.pointerId,[e.clientX,e.clientY]);if(points.size===1)this.camera.rotate(e.clientX-old[0],e.clientY-old[1]);else{const p=[...points.values()],distance=Math.hypot(p[0][0]-p[1][0],p[0][1]-p[1][1]);if(pinch>0&&distance>0)this.camera.zoom(Math.log(pinch/distance)*650);pinch=distance;}});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>{points.delete(e.pointerId);pinch=0;});
  canvas.addEventListener('wheel',e=>{e.preventDefault();this.camera.zoom(e.deltaY);},{passive:false});
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
 }
}
const app=new RailboundApp();globalThis.railbound=app;
app.initialize().catch(error=>{console.error(error);app.ui.fatal(error.message);});

return {RailboundApp};
})();