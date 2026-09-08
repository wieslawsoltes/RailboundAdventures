/** Smooth, manufactured cross-sections rather than flat eight-sided car bodies. */
import {MeshBuilder,PRIMITIVES} from './geometry.js';
import {norm,TAU} from './math.js';
export function coachShellGeometry(){
 const b=new MeshBuilder(),ring=[];
 // Rounded rectangle: vertical window-bearing side walls remain truly planar.
 const corners=[[.39,.34,0],[ -.39,.34,Math.PI/2],[-.39,-.37,Math.PI],[.39,-.37,Math.PI*1.5]];
 for(const [x,y,a]of corners)for(let j=0;j<=7;j++){
  const t=a+j/7*Math.PI/2;
  ring.push({p:[x+Math.cos(t)*.11,y+Math.sin(t)*(y>0?.16:.13)],n:norm([Math.cos(t)/.11,Math.sin(t)/(y>0?.16:.13),0])});
 }
 for(let i=0;i<ring.length;i++){
  const a=ring[i],c=ring[(i+1)%ring.length],start=b.v.length/8;
  for(const [point,z,u]of[[a,-.5,0],[a,.5,1],[c,.5,1],[c,-.5,0]])b.vertex([point.p[0],point.p[1],z],point.n,[u,point.p[1]+.5]);
  b.i.push(start,start+2,start+1,start,start+3,start+2);
  b.tri([0,0,.5],[a.p[0],a.p[1],.5],[c.p[0],c.p[1],.5],[0,0,1]);
  b.tri([0,0,-.5],[c.p[0],c.p[1],-.5],[a.p[0],a.p[1],-.5],[0,0,-1]);
 }return b.geometry();
}
export function roundedGlazingGeometry(){
 const b=new MeshBuilder(),ring=[];
 for(const [y,z,a]of[[.39,.40,0],[-.39,.40,Math.PI/2],[-.39,-.40,Math.PI],[.39,-.40,Math.PI*1.5]])for(let j=0;j<=5;j++){
  const t=a+j/5*Math.PI/2;ring.push([y+Math.cos(t)*.11,z+Math.sin(t)*.1]);
 }
 for(let i=0;i<ring.length;i++){
  const a=ring[i],c=ring[(i+1)%ring.length];
  b.tri([.5,0,0],[.5,a[0],a[1]],[.5,c[0],c[1]],[1,0,0]);
  b.tri([-.5,0,0],[-.5,c[0],c[1]],[-.5,a[0],a[1]],[-1,0,0]);
  b.quad([-.5,a[0],a[1]],[-.5,c[0],c[1]],[.5,c[0],c[1]],[.5,a[0],a[1]]);
 }return b.geometry();
}
export function installRollingArt(){
 PRIMITIVES['coach-shell-smooth']??=coachShellGeometry();
 PRIMITIVES['glazing-rounded']??=roundedGlazingGeometry();
}
