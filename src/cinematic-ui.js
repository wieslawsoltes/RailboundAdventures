import {postOptions,LOOKS} from './postprocess.js';
import {cleanJourney} from './journey.js';
const $=id=>document.getElementById(id);
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function installCinematicUI(app){
 const photo=document.createElement('button');photo.id='photo-mode';photo.textContent='Studio';photo.title='Photo studio (F2)';photo.onclick=()=>togglePhotoMode(app);$('photo').after(photo);
 const journey=document.createElement('button');journey.id='journey-open';journey.textContent='Journey';journey.onclick=()=>app.ui.openPanel('journey');photo.after(journey);
 const coach=document.createElement('button');coach.id='driver-coach';coach.className='driver-coach';coach.setAttribute('aria-label','Open route guidance and journey telemetry');coach.innerHTML='<span id="coach-message">Route guidance</span><span class="coach-metrics"><b id="coach-stop">0 m</b> service stop <b id="coach-score">100</b> driving score</span>';coach.onclick=()=>app.ui.openPanel('journey');document.querySelector('.journey-card').append(coach);
 const studio=document.createElement('section');studio.id='photo-studio';studio.className='photo-studio glass hidden';studio.setAttribute('aria-label','Photo studio');
 studio.innerHTML=`<div class="studio-title"><span>PHOTO STUDIO <small>WASD · drag to look</small></span><button id="photo-exit" class="secondary">Exit · Esc</button></div><div class="studio-fields"><label>Lens <input id="photo-fov" type="range" min="24" max="90" step="1" value="56"></label><label>Exposure <input id="photo-exposure" type="range" min="0.5" max="1.8" step="0.01" value="1"></label><label>Look <select id="photo-look">${Object.keys(LOOKS).map(l=>`<option>${l}</option>`).join('')}</select></label><button class="primary" id="photo-capture">Capture PNG</button></div>`;
 document.body.append(studio);$('photo-exit').onclick=()=>togglePhotoMode(app,false);$('photo-capture').onclick=()=>app.photo();
 $('photo-fov').oninput=e=>app.camera.fov=Number(e.target.value);$('photo-exposure').oninput=e=>app.env.exposure=Number(e.target.value);
 $('photo-look').onchange=e=>{app.settings.cinematic.look=e.target.value;app.applySettings();};
}
/** Capture owned camera state without aliasing mutable vectors. */
export function snapshotPhotoCamera(camera){
 const state={};
 for(const key of ['mode','fov','distance','azimuth','elevation','cabYaw','cabPitch','freeYaw','freePitch','photoOrbit'])state[key]=camera[key];
 for(const key of ['position','target','trackAnchor'])state[key]=camera[key]?camera[key].slice():null;
 return state;
}
export function restorePhotoCamera(camera,state){
 camera.setMode(state.mode);
 for(const [key,value] of Object.entries(state))camera[key]=Array.isArray(value)?value.slice():value;
 camera.initial=true;
}
export function togglePhotoMode(app,on=!app.photoMode){
 if(!app.ready||on===!!app.photoMode)return;
 if(on){
  if(app.ui.dialog.open)app.ui.closePanel();
  app.photoState={paused:app.paused,camera:snapshotPhotoCamera(app.camera)};app.paused=true;app.keys.clear();app.camera.setMode('free');app.photoMode=true;
  $('photo-fov').value=app.camera.fov;$('photo-exposure').value=app.env.exposure;$('photo-look').value=app.settings.cinematic.look;
 }else{
  app.photoMode=false;app.paused=app.photoState.paused;restorePhotoCamera(app.camera,app.photoState.camera);app.photoState=null;app.keys.clear();
 }
 document.body.classList.toggle('photo-mode',app.photoMode);$('photo-studio').classList.toggle('hidden',!app.photoMode);
 app.accumulator=0;app.ui.update();
}
export function cinematicPanel(ui){
 const a=ui.app,s=a.settings,o=postOptions(s.cinematic);
 $('panel-content').innerHTML=`<div class="panel-two-column"><section class="panel-section"><h3>Lighting & display</h3><p class="map-note">Linear-light scene, multisample antialiasing, soft bloom and a single filmic display transform. The low quality preset omits bloom.</p><label class="field"><span>Color grade</span><select id="cin-look">${Object.keys(LOOKS).map(l=>`<option value="${l}" ${l===o.look?'selected':''}>${l}</option>`).join('')}</select></label>${ui.field('Contact occlusion','cin-occlusion',0,100,1,Math.round(o.occlusion*100),'%')}${ui.toggle('Texture-backed materials','cin-surfaces',o.surfaces,'Locally bundled CC0 color, normal, roughness and occlusion maps.')}${ui.toggle('Normal mapping','cin-normal-mapping',o.normalMapping,'World-scale surface microstructure.')}<p class="map-note">Material library: ${a.renderer.materials.loaded}/8 · ${(a.renderer.materials.bytes/1048576).toFixed(1)} MiB · ${a.renderer.materials.status}. Shadows: three stabilized ranges; low quality uses one.</p>${ui.field('Bloom','cin-bloom',0,100,1,Math.round(o.bloom*100),'%')}${ui.field('Vignette','cin-vignette',0,60,1,Math.round(o.vignette*100),'%')}${ui.field('Film grain','cin-grain',0,15,1,Math.round(o.grain*100),'%')}<div class="panel-notice">Scene: <b>${a.renderer.post.hdr?'16-bit floating-point HDR':'LDR compatibility'}</b> · post passes: ${a.renderer.post.passCount} · renderer: ${a.renderer.kind}</div></section><section class="panel-section"><h3>Immersion & comfort</h3>${ui.toggle('Scenic wildlife','cin-wildlife',s.wildlife,'Deterministic flocks; no effect on train physics.')}${ui.toggle('Environmental audio','cin-ambience',s.ambience,'Weather and occasional birds. Train sounds remain independent.')}${ui.toggle('Camera motion','cin-motion',s.cameraMotion,'Subtle cab suspension. Disable for reduced motion.')}${ui.toggle('Driving coach','cin-coach',s.coach,'Read-only stopping guidance and route profile.')}<div class="button-row"><button class="primary" id="cin-studio">Open photo studio</button><button class="secondary" id="cin-journey">Journey telemetry</button></div><p class="map-note">F2 enters photo mode; Escape exits. Photo mode pauses the simulation and restores your previous camera and pause state. Color grade and exposure adjustments remain selected.</p></section></div>`;
 $('cin-surfaces').onchange=e=>{s.cinematic.surfaces=e.target.checked;a.applySettings();};$('cin-normal-mapping').onchange=e=>{s.cinematic.normalMapping=e.target.checked;a.applySettings();};
 $('cin-look').onchange=e=>{s.cinematic.look=e.target.value;a.applySettings();};
 for(const key of ['bloom','vignette','grain','occlusion'])ui.bindRange('cin-'+key,v=>{s.cinematic[key]=v/100;a.applySettings();},v=>v+'%');
 for(const [id,key] of [['wildlife','wildlife'],['ambience','ambience'],['motion','cameraMotion'],['coach','coach']])$('cin-'+id).onchange=e=>{s[key]=e.target.checked;a.applySettings();};
 $('cin-studio').onclick=()=>{ui.closePanel();togglePhotoMode(a,true);};$('cin-journey').onclick=()=>ui.openPanel('journey');
}
export function journeyPanel(ui){
 const a=ui.app,j=a.journey;
 j.survey(a.player,a.world,a.env,a.currentLimit,a.mission);
 $('panel-content').innerHTML=`<section class="panel-section"><h3>Reading the railway</h3><p id="journey-guidance">${escape(j.guidance.message)}</p><canvas id="route-profile" width="1000" height="230" aria-label="Elevation and speed limits ahead"></canvas><p class="map-note">Solid line: terrain elevation along the railway. Dashed line: posted speed. Amber area: estimated service stopping distance. Distances are measured along your selected route, including the turnout.</p></section><div class="journey-stats"><div><b>${(j.stats.distance/1000).toFixed(2)}</b><span>km driven</span></div><div><b>${j.score}</b><span>driving score / 100</span></div><div><b>${Math.floor(j.stats.seconds/60)}</b><span>minutes driven</span></div><div><b>${j.stats.energy.toFixed(1)}</b><span>traction kWh</span></div><div><b>${j.stats.stops}</b><span>station door openings</span></div></div><div class="panel-notice">Advisory only. The stopping estimate includes train-length brake propagation, gradient and wet adhesion; it is not a guarantee. Automatic train protection remains independent. Score measures time spent overspeeding or driving harshly.</div><div class="button-row"><button class="primary" id="journey-continue">Return to cab</button><button class="secondary" id="journey-reset">Reset journey statistics</button><button class="secondary" id="journey-look">Display & immersion</button></div>`;
 drawProfile(a);$('journey-continue').onclick=()=>ui.closePanel();$('journey-look').onclick=()=>ui.openPanel('cinematic');
 $('journey-reset').onclick=()=>{a.journey.reset(cleanJourney());journeyPanel(ui);};
}
export function drawProfile(app){
 const canvas=$('route-profile'),points=app.journey.profile;if(!canvas||!points.length)return;
 const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height,pad=38,range=points.at(-1).distance;
 const min=Math.min(...points.map(p=>p.height)),max=Math.max(...points.map(p=>p.height));c.clearRect(0,0,w,h);c.fillStyle='#152820';c.fillRect(0,0,w,h);
 const x=d=>pad+d/range*(w-pad*2),y=v=>h-pad-(v-min)/Math.max(15,max-min)*(h-pad*2);
 c.fillStyle='#d3ad6130';c.fillRect(pad,pad,Math.min(w-pad*2,app.journey.guidance.stoppingDistance/range*(w-pad*2)),h-pad*2);
 c.strokeStyle='#a6be9633';c.lineWidth=1;c.fillStyle='#b7c5ad';c.font='13px system-ui';
 for(let i=0;i<=4;i++){const xx=x(i*range/4);c.beginPath();c.moveTo(xx,pad);c.lineTo(xx,h-pad);c.stroke();c.fillText(Math.round(i*range/4)+' m',xx-15,h-12);}
 c.strokeStyle='#c9dcba';c.lineWidth=2.5;c.beginPath();points.forEach((p,i)=>i?c.lineTo(x(p.distance),y(p.height)):c.moveTo(x(p.distance),y(p.height)));c.stroke();
 c.setLineDash([7,5]);c.strokeStyle='#d1b080';c.lineWidth=1.5;c.beginPath();points.forEach((p,i)=>{const yy=h-pad-p.limit/app.player.stock.maxSpeed*(h-pad*2);i?c.lineTo(x(p.distance),yy):c.moveTo(x(p.distance),yy);});c.stroke();c.setLineDash([]);
 c.fillText(`${Math.round(max)} m elevation`,pad+8,22);
}
export function updateCinematicUI(app){
 if(!$('driver-coach'))return;const j=app.journey,g=j.guidance;
 $('driver-coach').hidden=app.settings.coach===false;
 $('coach-message').textContent=g.brake?'Brake early · '+g.message:g.message;
 $('coach-stop').textContent=Math.round(g.stoppingDistance||0)+' m';$('coach-score').textContent=j.score;
 $('driver-coach').classList.toggle('braking-advice',!!g.brake);
}
