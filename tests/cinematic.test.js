import test from 'node:test';
import assert from 'node:assert/strict';
import {postOptions,targetSize,LOOKS,POST_WGSL} from '../src/postprocess.js';
import {foundation,buildingFoundation,buildViaducts,highSpeedNose,noseSurface} from '../src/cinematic-models.js';
import {serviceStoppingDistance,speedEnvelope,cleanJourney,JourneyDirector} from '../src/journey.js';
import {flockPose,WorldLife,shoreSegments} from '../src/world-life.js';
import {audioMix,RailAudio} from '../src/audio.js';
import {RailNetwork} from '../src/tracks.js';
import {Train,Traffic,Mission,makeStations} from '../src/physics.js';
import {WORLDS,STOCK} from '../src/data.js';
import {PRIMITIVES,SceneBuilder} from '../src/geometry.js';
import {RollingStockRenderer} from '../src/rolling-stock.js';
import {validateProject,encodeProject} from '../src/persistence.js';
import {CameraRig} from '../src/camera.js';
import {readFileSync} from 'node:fs';
function fixture(){const network=new RailNetwork(WORLDS[0],null,{generationVersion:2}),train=new Train(network),traffic=new Traffic(network),world={network,traffic,stations:makeStations(network,WORLDS[0]),def:WORLDS[0],seed:8472,height:()=>0};traffic.update([train]);return {train,world,env:{weather:'clear',hour:12},mission:new Mission()};}

test('display options sanitize untrusted values without mutating presets',()=>{assert.deepEqual(postOptions(null),postOptions());assert.equal(postOptions({look:'__proto__',bloom:999,grain:NaN}).look,'natural');assert.equal(postOptions({bloom:999}).bloom,1);assert.equal(postOptions({vignette:-1}).vignette,0);assert.equal(Object.keys(LOOKS).length,4);});
test('all look presets have bounded finite filmic parameters',()=>{for(const p of Object.values(LOOKS)){assert.ok(p.contrast>0&&p.contrast<2);assert.ok(p.saturation>0&&p.saturation<2);assert.ok(Math.abs(p.temperature)<1);}});
test('render size preserves aspect at texture limits',()=>{assert.deepEqual(targetSize(10000,5000,2,4096),[4096,2048]);assert.deepEqual(targetSize(390,844,.8,4096),[312,675]);});
test('render size stays legal for zero and nonfinite viewport measurements',()=>{for(const v of [0,NaN,Infinity,-10])assert.ok(targetSize(v,v).every(n=>Number.isInteger(n)&&n>=1));});
test('HDR post shaders expose distinct extraction, blur and composite stages',()=>{for(const name of ['extract','blurH','blurV','composite'])assert.match(POST_WGSL,new RegExp('fn '+name+'\\('));assert.doesNotMatch(POST_WGSL,/\{KNEE\}/);});

test('stopping distance scales quadratically with speed and includes propagation',()=>{assert.equal(serviceStoppingDistance(0),0);assert.ok(serviceStoppingDistance(40)>serviceStoppingDistance(20)*3);assert.ok(serviceStoppingDistance(20,0,18)>serviceStoppingDistance(20,0,0));});
test('wet rails and downhill extend the coach braking distance',()=>{const flat=serviceStoppingDistance(30);assert.ok(serviceStoppingDistance(30,-.04)>flat);assert.ok(serviceStoppingDistance(30,.04)<flat);assert.ok(serviceStoppingDistance(30,0,0,1)>flat);});
test('braking envelope respects target speed at zero lookahead',()=>{assert.equal(speedEnvelope(15,0),15);assert.ok(speedEnvelope(15,500)>15);assert.equal(speedEnvelope(0,-100),0);});
test('journal rejects negative, infinite and malformed counters',()=>{assert.deepEqual(cleanJourney(null),cleanJourney());assert.equal(cleanJourney({distance:-20,seconds:Infinity}).distance,0);assert.equal(cleanJourney({seconds:Infinity}).seconds,0);});
test('coach samples the connected selected route without changing its switch',()=>{const {train,world,env,mission}=fixture(),j=new JourneyDirector(),before=world.network.switchBranch;j.survey(train,world,env,120,mission);assert.ok(j.profile.length>=20);assert.equal(world.network.switchBranch,before);assert.ok(j.profile.every(p=>Object.values(p).every(Number.isFinite)));});
test('coach advises braking for a held block without touching train controls',()=>{const {train,world,env,mission}=fixture(),j=new JourneyDirector();train.speed=30;world.traffic.dangerDistance=()=>90;const before=structuredClone(train.controls);j.survey(train,world,env,120,mission);assert.equal(j.guidance.kind,'signal');assert.ok(j.guidance.brake);assert.deepEqual(train.controls,before);});
test('coach tracks movement but rejects teleport distance',()=>{const {train,world,env,mission}=fixture(),j=new JourneyDirector();train.speed=10;j.step(.05,train,world,env,120,mission);train.cursor.advance(.5);j.step(.05,train,world,env,120,mission);assert.ok(Math.abs(j.stats.distance-.5)<1e-6);train.cursor.advance(2000);j.step(.05,train,world,env,120,mission);assert.ok(j.stats.distance<1);});
test('journal score reflects actual overspeed seconds',()=>{const {train,world,env,mission}=fixture(),j=new JourneyDirector();train.speed=50;for(let i=0;i<600;i++)j.step(.05,train,world,env,100,mission);assert.ok(j.stats.overspeed>29);assert.ok(j.score<30);});
test('station door events are counted once per continuous stop',()=>{const {train,world,env,mission}=fixture(),j=new JourneyDirector();train.controls.doors=true;for(let i=0;i<100;i++)j.step(.05,train,world,env,120,mission);assert.equal(j.stats.stops,1);});

test('high-speed loft stays within the loading gauge and tapers smoothly',()=>{let last=Infinity;for(let j=0;j<=100;j++){const t=j/100,p=noseSurface(27,t,0);assert.ok(p[0]<=last+1e-8);last=p[0];assert.ok(p[0]>0&&p[0]<=1.586);for(let k=0;k<32;k++)assert.ok(noseSurface(27,t,k*Math.PI/16).every(Number.isFinite));}assert.equal(noseSurface(27,1,0)[2],13.5);});
test('high-speed glazing is actual loft geometry with outward offset',()=>{const p=highSpeedNose(STOCK[1]);assert.ok(p.find(p=>p.role==='glass'));for(const a of p){const g=PRIMITIVES[a.g];assert.ok(g.vertices.every(Number.isFinite));assert.ok(g.indices.every(i=>i<g.vertices.length/8));assert.ok(g.indices.length>30);}});
test('high-speed nose geometry is cached across model rebuilds',()=>{const a=highSpeedNose(STOCK[1]),g=PRIMITIVES[a[0].g];assert.equal(PRIMITIVES[highSpeedNose(STOCK[1])[0].g],g);});
test('interior cab assemblies are assigned explicit cab roles',()=>{const r=new RollingStockRenderer(),p=r.model(STOCK[1],0,false);assert.ok(p.some(p=>p.role==='cab'));assert.ok(p.some(p=>p.role==='shell'));});
test('building foundation samples the complete rotated footprint',()=>{const w={height:(x,z)=>x*.2+z*.4},p=[0,0,0];const a=foundation(w,p,[10,5,20],0),b=foundation(w,p,[10,5,20],Math.PI/2);assert.ok(a.spread>b.spread);assert.ok(a.low<0);});
test('building podium reaches its lowest footprint and does not mutate input',()=>{const world={builder:new SceneBuilder(),features:{},height:(x,z)=>10+x*.1+z*.2},p=[0,10,0];const q=buildingFoundation(world,p,[12,8,16],0);assert.deepEqual(p,[0,10,0]);assert.ok(q[1]>10);assert.equal(world.features.foundations,1);assert.ok(world.builder.finish().length>0);});
test('viaduct spans share one spacing and have vertical positive piers',()=>{const edge={id:'test',length:200,at:s=>({p:[0,80+s*.02,s],f:[0,.02,1],right:[1,0,0]})};const w={network:{edges:new Map([['test',edge]])},builder:new SceneBuilder(),features:{bridges:0},def:{water:10,theme:'alpine'},baseHeight:()=>0,railCross:(p,x,y)=>[p.p[0]+x,p.p[1]+y,p.p[2]]};const spans=buildViaducts(w);assert.equal(spans.length,8);for(let i=0;i<spans.length;i++){assert.ok(spans[i].pierTop>spans[i].pierBottom);if(i)assert.equal(spans[i].s0,spans[i-1].s1);}for(const b of w.builder.finish())assert.ok(b.data.every(Number.isFinite));});

test('flock animation is deterministic and moves without allocating geometry',()=>{const f={x:0,y:80,z:0,phase:1,radius:60,speed:.1},a=flockPose(f,5,2);assert.deepEqual(a,flockPose(f,5,2));assert.notDeepEqual(a.position,flockPose(f,6,2).position);});
test('scenic wildlife can be disabled and is budgeted by graphics quality',()=>{const {world}=fixture(),life=new WorldLife();life.reset(world);const f=life.flocks[0],camera={position:[f.x,f.y,f.z]};life.update(world,camera,0,'low');assert.ok(life.visibleBirds<=12);assert.ok(life.update(world,camera,0,'high',false).every(b=>b.count===0));});
test('shoreline contour interpolates the real water crossing',()=>{const f={size:2,step:10,half:5,heights:new Float32Array([-1,1,-1,1])};const seg=shoreSegments(f,0);assert.equal(seg.length,1);assert.ok(seg[0].every(p=>Math.abs(p[0])<1e-6));});
test('shoreline avoids generating foam on fully dry or submerged cells',()=>{for(const h of [-10,10])assert.equal(shoreSegments({size:2,step:10,half:5,heights:new Float32Array(4).fill(h)},0).length,0);});
test('shoreline saddle generates finite separate contour segments',()=>{const s=shoreSegments({size:2,step:10,half:5,heights:new Float32Array([-1,1,1,-1])},0);assert.equal(s.length,2);assert.ok(s.flat(2).every(Number.isFinite));});

test('audio channels reflect speed, load, braking, rain and cab isolation',()=>{const {train}=fixture();train.speed=20;train.controls.throttle=.8;const a=audioMix(train,'clear'),b=audioMix(train,'rain','cab');assert.ok(a.motor>0&&a.rail>0);assert.ok(b.rain>0);assert.ok(b.wind<a.wind);train.controls.brake=1;assert.ok(audioMix(train,'rain').brake>0);});
test('audio disable/disposal is safe before first user gesture',async()=>{const audio=new RailAudio();audio.stop();await audio.dispose();assert.equal(audio.context,null);assert.equal(audio.enabled,false);});
test('camera suspension has a reduced-motion switch',()=>{const {train,world}=fixture(),c=new CameraRig();c.setMode('cab');c.motion=false;train.speed=30;c.update(train,world,1/60,new Set());assert.ok(c.position.every(Number.isFinite));});
test('camera sightline collision remains above terrain',()=>{const {train,world}=fixture(),c=new CameraRig();c.setMode('chase');world.height=()=>100;c.update(train,world,1/60,new Set());assert.ok(c.position[1]>=100);});
test('cinematic settings and journey counters round-trip in existing save format',()=>{const {train,world,env,mission}=fixture(),j=new JourneyDirector();j.stats.distance=1234;const app={player:train,trains:[train],world:{...world,editor:{generationVersion:2}},env,mission,camera:new CameraRig(),settings:{cinematic:{look:'cinema',bloom:.42},wildlife:false},journey:j};const result=validateProject(encodeProject(app));assert.equal(result.version,2);assert.equal(result.journey.distance,1234);assert.equal(result.settings.cinematic.look,'cinema');assert.equal(result.settings.wildlife,false);});
test('all new runtime modules participate in the offline app shell',()=>{const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');for(const name of ['postprocess','cinematic-models','world-life','journey','cinematic-ui'])assert.ok(sw.includes(`src/${name}.js`));});
