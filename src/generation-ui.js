/** Expedition controls and numerical terrain previews (not stock images). */
import {WORLDS} from './data.js';
import {TerrainField,REGION_PROFILES,generationOptions,surveyRoute} from './generation.js';
import {clamp,hex,lerp} from './math.js';

function thumbnail(canvas,def,seed,options) {
 const field=new TerrainField(def,seed,options),ctx=canvas.getContext('2d'),width=canvas.width=176,height=canvas.height=106;
 const image=ctx.createImageData(width,height),range=Math.max(def.rx,def.rz)*2.05;
 const grass=hex(def.ground),rock=hex(def.rock),water=hex(def.waterColor);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
  const wx=(x/width-.5)*range*2,wz=(y/height-.5)*range*2,h=field.rawHeight(wx,wz),dx=field.rawHeight(wx+26,wz)-h,dz=field.rawHeight(wx,wz+26)-h;
  const slope=clamp(Math.hypot(dx,dz)/45,0,1),shade=clamp(.94+(dx-dz)*.008,.48,1.3),snow=clamp((h-def.snowLine)/100,0,1),i=(y*width+x)*4;
  for(let k=0;k<3;k++)image.data[i+k]=255*(h<def.water?water[k]*.7:lerp(lerp(grass[k],rock[k],slope),.91,snow)*shade);
  image.data[i+3]=255;
 }
 ctx.putImageData(image,0,0);const controls=surveyRoute(def,field);
 const draw=(color,widthValue)=>{ctx.strokeStyle=color;ctx.lineWidth=widthValue;ctx.beginPath();controls.forEach((p,i)=>{const x=(p[0]/(range*2)+.5)*width,y=(p[2]/(range*2)+.5)*height;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();ctx.stroke();};
 draw('#172524',3);draw('#f0d5a5',1.3);
}

export function expeditionPanel(ui) {
 const app=ui.app,world=app.world,field=world.terrain,options=generationOptions(world.editor.generation);
 const $=id=>document.getElementById(id);
 $('panel-content').innerHTML=`
 <section class="expedition-head"><div><span class="overline">EXPEDITION / GENERATOR 03</span><p>Choose a geography. Survey a new railway. Change the seed to resurvey the terrain, forests and railway.</p></div><span class="expedition-seed">SEED ${Math.trunc(world.seed)}</span></section>
 <section class="generation-controls" aria-label="Procedural world settings">
  <label class="field"><span>World seed</span><div class="seed-entry"><input id="generation-seed" type="number" min="1" max="2147483647" step="1" value="${Math.trunc(world.seed)}"><button class="secondary" id="generation-random" aria-label="Choose a new random seed">Shuffle</button></div></label>
  ${ui.field('Mountain relief','generation-relief',55,165,5,Math.round(options.relief*100),'%')}
  ${ui.field('Ecological density','generation-vegetation',25,170,5,Math.round(options.vegetation*100),'%')}
  ${ui.field('Erosion strength','generation-erosion',0,100,5,Math.round(options.erosion*100),'%')}
 </section>
 <div class="expedition-stats"><span>${(world.network.totalLength/1000).toFixed(1)} km current route</span><span>${world.features.trees.toLocaleString()} trees</span><span>${field?Math.round(field.stats.max-field.stats.min)+' m relief':'Legacy landscape'}</span><span>Seeded · editable · saved locally</span></div>
 <div class="button-row expedition-viewpoints">${world.viewpoints.map((v,i)=>`<button class="secondary" data-viewpoint="${i}">Explore · ${v.name} ↗</button>`).join('')}</div>
 <div class="world-grid expedition-grid">${WORLDS.map(def=>{const profile=REGION_PROFILES[def.theme];return `<button class="world-card ${world.def.id===def.id?'selected':''}" data-world="${def.id}" aria-label="Generate ${def.name}"><canvas class="expedition-preview" data-preview="${def.id}"></canvas><div class="card-text"><span class="overline">${profile.name}</span><h3>${def.name}</h3><p>${profile.geology}</p><small>${profile.species}</small></div><span class="expedition-action">SURVEY & ENTER ↗</span></button>`;}).join('')}</div>
 <div class="panel-notice">Select a region to generate a fresh journey using these settings. Export your current project first to keep edits and train positions. Preview maps show the pre-erosion survey; the final terrain is eroded before rail grading. Legacy saves retain their original railway.</div>`;
 const read=()=>({seed:clamp(Math.trunc(Number($('generation-seed').value))||1,1,2147483647),generationVersion:3,generation:{relief:Number($('generation-relief').value)/100,vegetation:Number($('generation-vegetation').value)/100,erosion:Number($('generation-erosion').value)/100}});
 for(const button of document.querySelectorAll('[data-viewpoint]'))button.onclick=()=>{
  const view=world.viewpoints[Number(button.dataset.viewpoint)];app.camera.position=[...view.position];app.camera.target=[...view.target];app.camera.setMode('free');ui.closePanel();ui.toast(view.name+' · drag to look · WASD and Q/E to fly · C to return to the train.');
 };
 let timer;
 const previews=()=>{if(ui.activePanel!=='worlds')return;const value=read();for(const def of WORLDS){const canvas=document.querySelector(`[data-preview="${def.id}"]`);if(canvas)thumbnail(canvas,def,value.seed,value.generation);}};
 const schedule=()=>{clearTimeout(timer);timer=setTimeout(previews,160);};
 for(const key of ['relief','vegetation','erosion'])ui.bindRange('generation-'+key,schedule,v=>v+'%');
 $('generation-seed').onchange=schedule;
 $('generation-random').onclick=()=>{const value=new Uint32Array(1);crypto.getRandomValues(value);$('generation-seed').value=1+value[0]%2147483646;schedule();};
 for(const button of document.querySelectorAll('[data-world]'))button.onclick=()=>ui.guard(async()=>{
  const settings=read();clearTimeout(timer);ui.closePanel();await app.loadWorld(button.dataset.world,settings);ui.toast(`${app.world.def.name} · seed ${settings.seed} · ${(app.world.network.totalLength/1000).toFixed(1)} km surveyed.`);
 });
 previews();
}
