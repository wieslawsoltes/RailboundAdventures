#!/usr/bin/env python3
"""Exercise texture-backed materials, contact shading and display fallbacks.

Runs the actual candidate at a project-scoped HTTP origin. Software adapters
validate APIs and pixels, not native-GPU or physical-phone performance.
"""
import io
import json
import os
from pathlib import Path
from PIL import Image, ImageChops, ImageStat
from playwright.sync_api import sync_playwright

BASE=os.environ.get('PAGE_URL','http://127.0.0.1:8000/RailboundAdventures/').rstrip('/')+'/'
BACKEND=os.environ.get('BACKEND','webgpu')
if BACKEND not in ('webgpu','webgl'):raise ValueError('Invalid backend')
OUT=Path('fidelity-results')/BACKEND;OUT.mkdir(parents=True,exist_ok=True)
report={'url':BASE,'backend':BACKEND,'checks':[],'errors':[],'warnings':[]}

def check(name,value,detail=None):
 report['checks'].append({'name':name,'passed':bool(value),'detail':detail})
 print(('PASS ' if value else 'FAIL ')+name+': '+str(detail),flush=True)
 if not value:raise AssertionError(name)

def boot(page,expect_material=True):
 page.wait_for_function('window.railbound?.ready || !document.getElementById("fatal").classList.contains("hidden")',timeout=240000)
 state=page.evaluate('''()=>({ready:railbound.ready,backend:railbound.renderer.kind,error:railbound.renderer.lastError,fatal:document.getElementById('fatal-message').textContent,materials:railbound.renderer.materials.status,loaded:railbound.renderer.materials.loaded})''')
 check('game starts on requested backend',state['ready'] and state['backend']==('WebGPU' if BACKEND=='webgpu' else 'WebGL 2'),state)
 check('material library ready' if expect_material else 'procedural fallback active',state['materials']==('ready' if expect_material else 'fallback'),state)
 page.evaluate('''()=>{const a=railbound;a.renderEnabled=false;a.paused=true;a.settings.adaptive=false;a.renderer.settings.resolution=1;a.env.hour=13.5;a.env.weather='clear';a.env.exposure=1;}''')

def render(page,name,cover=True):
 state=page.evaluate('''async cover=>{const a=railbound,r=a.renderer;a.camera.update(a.player,a.world,0,new Set());
 const stock=a.rolling.update(a.trains,a.world,a.camera,0,a.simTime,a.camera.mode);let ground=[];
 if(cover)for(let i=0;i<12;i++)ground=a.groundCover.update(a.world,a.camera,r,a.settings.quality,20);
 if(r.device)r.device.pushErrorScope('validation');
 r.render([...a.world.batches,...stock,...ground],a.camera,a.world.def,a.env,a.player,a.simTime);
 let error=null;if(r.device){await r.device.queue.onSubmittedWorkDone();error=(await r.device.popErrorScope())?.message||null;}else error=r.gl.getError();
 return {error,lost:r.lost,calls:r.drawCalls,shadows:r.shadowDrawCalls,triangles:r.triangles,ao:r.post.occlusion.active,aoPasses:r.post.occlusion.passCount,levels:r.materials.levels,bytes:r.materials.bytes,loaded:r.materials.loaded,hdr:r.post.hdr,frame:Array.from(r.frame.slice(120))};}''',cover)
 check(name+' valid GPU submission',not state['error'] and not state['lost'] and state['calls']>10,state)
 hide=page.add_style_tag(content='body > :not(#viewport) {visibility:hidden!important}')
 try:png=page.locator('#viewport').screenshot(timeout=180000)
 finally:hide.evaluate('(e)=>e.remove()')
 image=Image.open(io.BytesIO(png)).convert('RGB');stat=ImageStat.Stat(image)
 check(name+' nonblank scene',max(stat.stddev)>5 and sum(stat.mean)>9,{'mean':stat.mean,'stddev':stat.stddev})
 (OUT/(name+'.png')).write_bytes(png)
 return image,state

def changed(name,a,b,minimum=.02):
 values=ImageStat.Stat(ImageChops.difference(a,b)).mean
 check(name,max(values)>minimum,{'mean_absolute_difference':values})

with sync_playwright() as p:
 args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-gpu-watchdog']
 if BACKEND=='webgpu':args+=['--enable-unsafe-webgpu','--use-webgpu-adapter=swiftshader','--enable-gpu','--enable-features=Vulkan','--use-vulkan=swiftshader']
 launch={'channel':'chromium','headless':not bool(os.environ.get('DISPLAY')),'args':args}
 if os.environ.get('CHROMIUM_EXECUTABLE'):launch={'executable_path':os.environ['CHROMIUM_EXECUTABLE'],**{k:v for k,v in launch.items() if k!='channel'}}
 browser=p.chromium.launch(**launch);report['browser']=browser.version
 context=browser.new_context(viewport={'width':1280,'height':800},device_scale_factor=1,has_touch=True)
 if BACKEND=='webgl':context.add_init_script("Object.defineProperty(Navigator.prototype,'gpu',{get:()=>undefined,configurable:true})")
 page=context.new_page();page.set_default_timeout(240000)
 page.on('pageerror',lambda e:report['errors'].append(str(e)))
 page.on('console',lambda m:report['errors'].append(m.text) if m.type=='error' else report['warnings'].append(m.text) if m.type=='warning' else None)
 try:
  response=page.goto(BASE,wait_until='domcontentloaded',timeout=90000);check('candidate HTTP 200',response.status==200);boot(page)
  first,state=render(page,'alpine-materials')
  check('all eight material layers uploaded',state['loaded']==8 and state['levels']==10,state)
  check('three stabilized shadow ranges selected',state['frame'][3]==3 and state['shadows']>10,state)
  check('ambient pass active in HDR',state['hdr'] and state['ao'] and state['aoPasses']==1,state)
  if os.environ.get('SMOKE')=='1':
   check('no startup errors',not report['errors'],report['errors'])
  else:
   page.evaluate("railbound.loadWorld('metro')")
   page.evaluate('''()=>{const a=railbound,d=a.world.districts.slice().sort((x,y)=>y.buildings.length-x.buildings.length)[0],b=d.buildings[0],p=b.position;
    a.renderEnabled=false;a.paused=true;a.camera.position=[p[0]+d.right[0]*23+d.forward[0]*28,p[1]+5,p[2]+d.right[2]*23+d.forward[2]*28];a.camera.target=[p[0],p[1]+5,p[2]];a.camera.setMode('free');a.camera.fov=62;a.env.hour=14;}''')
   on,state=render(page,'city-materials',False)
   page.evaluate('railbound.renderer.settings.surfaces=false');off,_=render(page,'city-procedural-reference',False)
   changed('texture-backed surfaces change actual scene',on,off)
   page.evaluate('railbound.renderer.settings.surfaces=true;railbound.renderer.settings.normalMapping=false');flat,_=render(page,'city-normal-disabled',False)
   changed('normal mapping changes surface lighting',on,flat,.005)
   page.evaluate('railbound.renderer.settings.normalMapping=true;railbound.renderer.post.options.occlusion=0');unoccluded,s=render(page,'city-contact-disabled',False)
   check('AO disabled removes pass',not s['ao'] and s['aoPasses']==0,s)
   changed('contact occlusion changes shaded pixels',on,unoccluded,.001)
   page.evaluate("railbound.renderer.post.options.occlusion=.85;railbound.env.weather='rain'");rain,_=render(page,'city-rain',False)
   changed('wet material response differs from dry',on,rain)
   page.evaluate("railbound.env.weather='clear';railbound.env.hour=21.5");night,_=render(page,'city-night',False)
   changed('window interiors and lighting respond to night',on,night)
   page.evaluate("railbound.env.hour=14;railbound.renderer.settings.quality='low'");_,low=render(page,'low-quality',False)
   check('low quality disables AO and reduces cascades',not low['ao'] and low['frame'][3]==1 and low['shadows']<state['shadows'],low)
   page.evaluate("railbound.renderer.settings.quality='high';railbound.ui.openPanel('cinematic')")
   check('fidelity settings exposed',page.locator('#cin-surfaces').count()==1 and page.locator('#cin-normal-mapping').count()==1)
   page.locator('#close-dialog').click()
   for w,h in [(844,390),(390,844),(1280,800)]:
    page.set_viewport_size({'width':w,'height':h});page.evaluate('railbound.ui.update()');_,s=render(page,'resize-'+str(w),False)
    check('resize '+str(w)+' half-resolution AO matches',page.evaluate('railbound.renderer.post.occlusion.width===Math.ceil(railbound.renderer.width/2)'))
    check('resize '+str(w)+' no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
   page.evaluate("railbound.camera.setMode('chase');railbound.recover()")
   page.locator('#depart').click();motion=page.evaluate('''()=>{railbound.paused=true;for(let i=0;i<2100;i++)railbound.tick(1/60);return railbound.player.cursor.odometer;}''')
   check('train still drives',motion>20,motion)
   page.locator('#emergency').click();page.evaluate('for(let i=0;i<3000;i++)railbound.tick(1/60)');check('emergency stops train',page.evaluate('Math.abs(railbound.player.speed)<.05'))
   page.evaluate('railbound.settings.cinematic.occlusion=.42;railbound.applySettings()')
   saved=page.evaluate('railbound.projectSnapshot()');page.evaluate('(data)=>railbound.importProject(data)',saved)
   check('material and contact settings survive save',page.evaluate('Math.abs(railbound.settings.cinematic.occlusion-.42)<.001'))
   page.wait_for_function('navigator.serviceWorker.controller!==null',timeout=60000)
   check('all texture maps and modules cached',page.evaluate('''async()=>{const m=await(await fetch('assets/materials/manifest.json')).json();const paths=['src/materials.js','src/fidelity-shaders.js','src/contact-occlusion.js','src/shadow-cascades.js'];for(const l of m.layers)paths.push('assets/materials/'+l.albedo,'assets/materials/'+l.surface);for(const p of paths)if(!await caches.match(new URL(p,location.href)))return false;return true;}'''))
   context.set_offline(True);page.reload(wait_until='domcontentloaded');boot(page);render(page,'offline-materials')
   context.set_offline(False)
   check('no JS or GPU validation errors',not report['errors'],report['errors'])
 except Exception as error:
  report['failure']=str(error);print('FAILURE',error,flush=True);print('ERRORS',json.dumps(report['errors']),flush=True)
  try:page.screenshot(path=str(OUT/'failure.png'),timeout=30000)
  except Exception:pass
  raise
 finally:
  (OUT/'report.json').write_text(json.dumps(report,indent=2))
  print(json.dumps({'checks':len(report['checks']),'passed':sum(x['passed'] for x in report['checks']),'errors':report['errors'],'failure':report.get('failure')}),flush=True)
  context.close();browser.close()
