/** Track-aware terrain tessellation with conforming transition edges.
 * Numerical cuttings can be much narrower than a regular terrain tile. Only
 * cells near the railway subdivide; adjacent coarse cells share their edge
 * vertices. Camera queries use the SAME triangles that the near mesh renders.
 */
import {Geometry} from './geometry.js';
import {norm,clamp} from './math.js';
export function terrainPatch(world,x0,z0,span,n,refine=false){
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
