/** Geometric corrections: continuous train noses and terrain-grounded construction. */
import {Geometry,MeshBuilder,PRIMITIVES} from './geometry.js';
import {add,sub,mul,norm,cross,hex,transform,frameMatrix,mat4Mul,pointTransform,clamp,TAU} from './math.js';

// The high-speed shell uses the same octagonal cross-section as the coach body.
// All dimensions are in metres. Windscreens sit on the actual loft, not in front of it.
export function noseSurface(length,t,angle){
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
export function highSpeedNose(stock){
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
export function foundation(world,p,size,yaw=0){
 const [sx,,sz]=size,c=Math.cos(yaw),s=Math.sin(yaw),heights=[];
 for(const x of [-sx*.52,0,sx*.52])for(const z of [-sz*.52,0,sz*.52])
  heights.push(world.height(p[0]+x*c+z*s,p[2]-x*s+z*c));
 return {low:Math.min(...heights)-1.1,high:Math.max(...heights),spread:Math.max(...heights)-Math.min(...heights)};
}
export function buildingFoundation(world,p,size,yaw,station=false){
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
export function buildViaducts(world){
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
