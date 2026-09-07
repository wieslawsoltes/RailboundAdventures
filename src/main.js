import {postOptions} from './postprocess.js';
import {JourneyDirector} from './journey.js';
import {WorldLife} from './world-life.js';
import {installCinematicUI,togglePhotoMode} from './cinematic-ui.js';
import {WORLDS,STOCK,WEATHER} from './data.js';
import {clamp,mod,downloadFile} from './math.js';
import {Renderer} from './renderer.js';
import {RailwayWorld} from './world.js';
import {Train,Traffic,Mission} from './physics.js';
import {RailCursor} from './tracks.js';
import {RollingStockRenderer} from './rolling-stock.js';
import {PRIMITIVES} from './geometry.js';
import {CameraRig,CAMERA_MODES} from './camera.js';
import {RailAudio} from './audio.js';
import {UI} from './ui.js';
import {SAVE_KEY,storageGet,storageSet,validateProject,encodeProject} from './persistence.js';

/** Owns the simulation lifecycle. Physics uses bounded, fixed 1/60-second steps. */
export class RailboundApp {
 constructor(){
  const mobile=matchMedia('(max-width: 760px)').matches;
  this.settings={quality:mobile?'medium':'high',resolution:mobile?.8:1,shadows:true,adaptive:true,safety:true,units:'km/h',volume:.36,timeScale:1,gamepad:true,cinematic:postOptions(),wildlife:true,ambience:true,coach:true,cameraMotion:!matchMedia('(prefers-reduced-motion: reduce)').matches};
  this.env={hour:16.4,weather:'clear',timeRate:4,exposure:1,electrified:true};
  this.journey=new JourneyDirector();this.life=new WorldLife();this.camera=new CameraRig();this.audio=new RailAudio();this.rolling=new RollingStockRenderer();this.ui=new UI(this);
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
   this.world=next;this.player=player;this.trains=trains;this.life.reset(next);this.journey.reset(restored?.journey);
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
   const life=this.life.update(this.world,this.camera,this.simTime,this.settings.quality,this.settings.wildlife);this.renderer.render([...this.world.batches,...dynamic,...life],this.camera,this.world.def,this.env,this.player,this.simTime);
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
