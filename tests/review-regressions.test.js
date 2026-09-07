import test from 'node:test';
import assert from 'node:assert/strict';
import {JourneyDirector} from '../src/journey.js';
import {snapshotPhotoCamera,restorePhotoCamera} from '../src/cinematic-ui.js';
import {CameraRig} from '../src/camera.js';
import {buildCivilEngineering} from '../src/world-detail.js';
import {SceneBuilder} from '../src/geometry.js';
import {readFileSync} from 'node:fs';
test('reverse descent uses travel-relative profile grades and earlier braking',()=>{
 const make=grade=>{
  const train={speed:-20,grade:0,cars:4,acceleration:0,stock:{maxSpeed:140},controls:{reverser:-1},cursor:{pose:d=>({edge:'e',s:d,p:[0,10+d*grade,d],grade})}};
  const world={network:{edges:new Map([['e',{speedLimit:s=>s<=-360?40:120}]])}};
  const j=new JourneyDirector();j.survey(train,world,{weather:'clear'},120,null);return j;
 };
 const down=make(.04),up=make(-.04);
 assert.ok(down.profile.every(p=>p.grade===-.04));assert.ok(up.profile.every(p=>p.grade===.04));assert.ok(down.guidance.target<up.guidance.target);
});
test('cutting-only engineering preserves walls without duplicating viaducts',()=>{
 const make=ground=>({builder:new SceneBuilder(),features:{cuttings:0,landmarks:0},def:{theme:'alpine'},baseHeight:()=>ground,railCross:(p,x,y)=>[x,p.p[1]+y,p.p[2]],network:{edges:new Map([['e',{length:200,at:s=>({p:[0,30,s],f:[0,0,1],right:[1,0,0]})}]])}});
 const cut=make(70);buildCivilEngineering(cut,false);assert.ok(cut.features.cuttings>0);assert.ok(cut.builder.finish().length>0);
 const bridge=make(0);buildCivilEngineering(bridge,false);assert.equal(bridge.features.landmarks,0);assert.equal(bridge.builder.finish().length,0);
 assert.ok(readFileSync(new URL('../src/world.js',import.meta.url),'utf8').includes('buildCivilEngineering(this,false)'));
});
for(const mode of ['chase','orbit','aerial','free'])test(mode+' photo round trip preserves zoom and complete camera framing',()=>{
 const camera=new CameraRig();camera.setMode(mode);camera.distance=237;camera.fov=47;camera.azimuth=.75;camera.elevation=.41;camera.position=[10,30,50];camera.target=[1,4,9];camera.trackAnchor=[4,5,6];
 const state=snapshotPhotoCamera(camera);camera.setMode('free');camera.distance=900;camera.position[0]=500;camera.target[1]=-50;camera.trackAnchor=null;
 restorePhotoCamera(camera,state);assert.deepEqual(snapshotPhotoCamera(camera),state);assert.notEqual(camera.position,state.position);assert.equal(camera.distance,237);
});
