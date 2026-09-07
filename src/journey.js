/** Read-only driving coach. SI internally; never substitutes for train protection. */
import {clamp} from './math.js';
import {WEATHER} from './data.js';
export function serviceStoppingDistance(speed,grade=0,cars=0,wet=0){
 const v=Math.abs(Number.isFinite(speed)?speed:0),slope=Number.isFinite(grade)?clamp(grade,-.12,.12):0;
 const decel=Math.max(.20,.78-clamp(wet,0,1)*.16+9.80665*slope),delay=2+clamp(cars,0,18)*.12;
 return v*delay+v*v/(2*decel);
}
export function speedEnvelope(target,distance,grade=0,wet=0){
 const a=Math.max(.20,.78-clamp(wet,0,1)*.16+9.80665*clamp(grade,-.12,.12));
 return Math.sqrt(Math.max(0,target*target+2*a*Math.max(0,distance)));
}
export function cleanJourney(value={}){
 const v=value&&typeof value==='object'?value:{},result={};
 for(const key of ['distance','seconds','overspeed','harsh','energy','stops'])result[key]=Number.isFinite(v[key])?clamp(v[key],0,1e9):0;
 return result;
}
export class JourneyDirector {
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
  this.profile=[];let target=limit/3.6,constraint={distance:range,kind:'clear',message:'Line clear — enjoy the journey'};
  for(let d=0;d<=range;d+=60){
   const p=train.cursor.pose(direction*d),edge=world.network.edges.get(p.edge),speed=Math.min(train.stock.maxSpeed,edge.speedLimit(p.s));
   this.profile.push({distance:d,height:p.p[1],limit:speed,grade:p.grade});
   const permitted=speedEnvelope(speed/3.6,Math.max(0,d-v*(2+train.cars*.12)),grade,wet);
   if(permitted<target){target=permitted;constraint={distance:d,kind:'limit',message:`Curve / limit ahead · ${Math.round(speed)} km/h`};}
  }
  const danger=world.traffic?.dangerDistance(train,Math.min(4000,range))??Infinity;
  if(Number.isFinite(danger)){
   const safe=speedEnvelope(0,Math.max(0,danger-30-v*2),grade,wet);
   if(safe<target){target=safe;constraint={distance:danger,kind:'signal',message:'Occupied block — prepare to stop'};}
  }
  if(mission?.target&&!mission.complete&&direction>0){
   const d=train.cursor.distanceTo(mission.target.edge,mission.target.s);
   const safe=speedEnvelope(0,Math.max(0,d-10-v*(2+train.cars*.12)),grade,wet);
   if(d<range&&safe<target){target=safe;constraint={distance:d,kind:'station',message:`Approaching ${mission.target.name}`};}
  }
  this.guidance={...constraint,target:target*3.6,stoppingDistance:stop,brake:v>target+.6,comfort:Math.max(0,100-Math.abs(this.jerk)*22-Math.max(0,Math.abs(train.acceleration)-.65)*30)};
  if(train.derailed)this.guidance={...this.guidance,kind:'disabled',message:'Recover the train in Setup',brake:false};
 }
 get score(){return Math.round(clamp(100-(this.stats.overspeed*80+this.stats.harsh*30)/Math.max(30,this.stats.seconds),0,100));}
}
