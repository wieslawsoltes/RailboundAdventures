/**
 * Expedition terrain generator, revision 3.
 * Pure, deterministic CPU field: no DOM, renderer, wall clock or Math.random.
 * Domain-warped macro geology -> thermal/hydraulic erosion -> climate/drainage.
 * The renderer, railway survey, vegetation and map all sample this same field.
 */
import {clamp, lerp, smooth, noise2, fbm, rng, hash2} from './math.js';

export const GENERATOR_VERSION = 3;
export const REGION_PROFILES = {
 alpine: {name:'Glacial watershed', geology:'Folded ridges · braided meltwater · hanging valleys', species:'Fir / larch / alpine meadow', relief:1, forest:.76, grade:.028, spacing:34},
 coast: {name:'Pacific headlands', geology:'Scalloped cliffs · sea stacks · sheltered coves', species:'Coastal pine / oak / dune grass', relief:.7, forest:.56, grade:.023, spacing:38},
 nordic: {name:'Dendritic fjord', geology:'Branching sea inlets · granite walls · snowfields', species:'Spruce / birch / tundra', relief:1.2, forest:.53, grade:.028, spacing:39},
 canyon: {name:'Mesa country', geology:'Terraced sandstone · incised river · hoodoo fields', species:'Saguaro / juniper / desert scrub', relief:.9, forest:.15, grade:.026, spacing:55},
 sakura: {name:'Volcanic lowlands', geology:'Volcanic cone · alluvial plain · rice terraces', species:'Cherry / bamboo / cedar', relief:.65, forest:.70, grade:.020, spacing:35},
 highland: {name:'Lochs & moorland', geology:'Glacial troughs · drumlins · exposed tors', species:'Scots pine / heather / birch', relief:.85, forest:.38, grade:.027, spacing:44},
 pine: {name:'Forest watershed', geology:'Meandering river · wooded ridges · wetlands', species:'Oak / beech / spruce / fern', relief:.55, forest:.92, grade:.024, spacing:29},
 metro: {name:'Estuary metropolis', geology:'Tidal channels · docklands · urban terraces', species:'Plane tree / riparian reeds / parks', relief:.18, forest:.24, grade:.020, spacing:50}
};

export function generationOptions(value = {}) {
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

export class TerrainField {
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
export function surveyRoute(def, terrain) {
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
