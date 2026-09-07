import {clamp,lerp} from './math.js';
import {STOCK,WEATHER} from './data.js';
import {RailCursor} from './tracks.js';
const G=9.80665;
export class Train {
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
export class Traffic {
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
export function makeStations(network,world,extra=[]){const defs=[['approach',220],['approach',network.edges.get('approach').length*.73],['main',network.edges.get('main').length*.64],['return',network.edges.get('return').length*.3],['return',network.edges.get('return').length*.75]];return defs.map(([edge,s],i)=>({id:`station-${i}`,name:world.stations[i],edge,s,platform:180,dwell:20})).concat(extra.filter(s=>network.edges.has(s.edge)).map((s,i)=>({id:`custom-${i}`,name:s.name||`New station ${i+1}`,edge:s.edge,s:clamp(s.s,10,network.edges.get(s.edge).length-10),platform:150,dwell:20})));}
export class Mission {
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
