/** Detailed rolling-stock assemblies, baked by material and independently LOD'd.
 * No imported model or texture: every wheel flange, coil, pipe and grille is geometry.
 */
import {PRIMITIVES,Geometry,MeshBuilder} from './geometry.js';
import {hex,transform,mat4Mul,frameMatrix,pointTransform,add,sub,mul,norm,TAU} from './math.js';
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

export function vehicleDetails(stock,index,last) {
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
   for(let z=-L*.31;z<L*.28;z+=1.65) {
    for(const side of [-1,1]){part('spring',[side*.74,5.20,z],[.21,.42,.21],hex('#77745d'),PAINT,[0,0,0],'roof',2);pipe([side*.74,5.43,z],[side*.74,5.43,Math.min(z+1.65,L*.28)],.055,hex('#a88756'),'roof');}
   }
   box([0,5.19,-L*.34],[1.5,.25,.66],dark,STEEL,'roof');
   for(const side of [-1,1])part('cone',[side*.58,5.27,L*.26],[.24,.6,.24],silver,STEEL,[0,Math.PI/2,0],'roof');
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

export function bogieDetails(heavy=false) {
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
export function bakeAssemblies(parts,prefix) {
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
