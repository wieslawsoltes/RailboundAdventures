/** Expedition scene construction. All placement consumes named, deterministic streams. */
import {Geometry, MeshBuilder, PRIMITIVES, Batch, sphereGeometry} from './geometry.js';
import {rng, hash2, noise2, fbm, hex, clamp, smooth, lerp, norm, add, sub, mul, transform, frameMatrix, mat4Mul, TAU} from './math.js';

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

function terrainTile(world,x0,z0,span,n) {
 const vertices=[],indices=[],field=world.terrain,step=span/n;
 let lo=Infinity,hi=-Infinity;
 for(let z=0;z<=n;z++) for(let x=0;x<=n;x++) {
  const wx=x0+x*step,wz=z0+z*step,y=world.height(wx,wz),e=Math.max(4,step*.22);
  const normal=norm([world.height(wx-e,wz)-world.height(wx+e,wz),2*e,world.height(wx,wz-e)-world.height(wx,wz+e)]);
  const climate=field.climate(wx,wz,y);vertices.push(wx,y,wz,...normal,climate.moisture,climate.drainage);lo=Math.min(lo,y);hi=Math.max(hi,y);
 }
 for(let z=0;z<n;z++) for(let x=0;x<n;x++) {const i=z*(n+1)+x;indices.push(i,i+n+1,i+1,i+1,i+n+1,i+n+2);}
 // Skirts conceal T-junction cracks where coarse and fine tiles meet.
 const perimeter=[];for(let x=0;x<=n;x++)perimeter.push(x);for(let z=1;z<=n;z++)perimeter.push(z*(n+1)+n);
 for(let x=n-1;x>=0;x--)perimeter.push(n*(n+1)+x);for(let z=n-1;z>0;z--)perimeter.push(z*(n+1));
 for(let j=0;j<perimeter.length;j++) {
  const a=perimeter[j],b=perimeter[(j+1)%perimeter.length],i=vertices.length/8;
  const av=vertices.slice(a*8,a*8+8),bv=vertices.slice(b*8,b*8+8);av[1]-=32;bv[1]-=32;
  vertices.push(...av,...bv);indices.push(a,b,i,i,b,i+1);
 }
 const batch=world.builder.mesh(new Geometry(vertices,indices),[x0+span/2,(lo+hi)/2,z0+span/2],Math.hypot(span*.71,(hi-lo)*.5)+40,[1,.95,0,0]);
 batch.maxDistance=15000;return batch;
}

export async function buildExpeditionTerrain(world,onProgress=()=>{}) {
 const f=world.terrain,tile=640,count=f.half/tile;let done=0;
 for(let z=-count;z<count;z++) {
  for(let x=-count;x<count;x++) {
   const cx=x*tile+tile*.5,cz=z*tile+tile*.5;
   const near=world.network.nearest(cx,cz,850),fine=!!near;
   const batch=terrainTile(world,x*tile,z*tile,tile,fine?32:12);
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

export async function buildEcosystem(world,onProgress=()=>{}) {
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
export function buildCivilEngineering(world) {
 const b=world.builder,theme=world.def.theme;
 for(const edge of world.network.edges.values()) {
  let inBridge=false;
  for(let s=18;s<edge.length-30;s+=24) {
   const p=edge.at(s),height=world.baseHeight(p.p[0],p.p[2]),gap=p.p[1]-height;
   if(gap>14) {
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
export function buildLandmarks(world) {
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
