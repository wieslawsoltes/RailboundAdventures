#!/usr/bin/env python3
"""Living Worlds candidate browser test. Uses the actual module build and worker.
Software GPU validates rendering correctness, not native performance.
"""
import io, json, os, sys
from pathlib import Path
from PIL import Image, ImageStat, ImageChops
from playwright.sync_api import sync_playwright
BASE=os.environ.get('PAGE_URL','http://127.0.0.1:8000/RailboundAdventures/').rstrip('/')+'/'
BACKEND=os.environ.get('BACKEND','webgpu')
OUT=Path('living-results')/BACKEND;OUT.mkdir(parents=True,exist_ok=True)
report={'url':BASE,'backend':BACKEND,'checks':[],'errors':[],'worlds':[]}
def check(name,result,detail=None):
 report['checks'].append({'name':name,'passed':bool(result),'detail':detail});print(('PASS ' if result else 'FAIL ')+name+': '+str(detail),flush=True)
 if not result:raise AssertionError(name)
def boot(page):
 page.wait_for_function('window.railbound?.ready || !document.getElementById("fatal").classList.contains("hidden")',timeout=240000)
 state=page.evaluate('({ready:railbound.ready,kind:railbound.renderer.kind,error:document.getElementById("fatal-message").textContent})')
 check('starts with requested renderer',state['ready'] and state['kind']==('WebGPU' if BACKEND=='webgpu' else 'WebGL 2'),state)
 page.evaluate("railbound.renderEnabled=false;railbound.paused=true;railbound.settings.adaptive=false;railbound.renderer.settings.resolution=.65")
def render(page,name,cover=True):
 stats=page.evaluate('''async (cover)=>{const a=railbound,r=a.renderer;a.camera.update(a.player,a.world,1/60,new Set());
 const stock=a.rolling.update(a.trains,a.world,a.camera,0,a.simTime,a.camera.mode);let ground=[];
 if(cover)for(let i=0;i<20;i++)ground=a.groundCover.update(a.world,a.camera,r,a.settings.quality,20);
 if(r.device)r.device.pushErrorScope('validation');
 r.render([...a.world.batches,...stock,...ground],a.camera,a.world.def,a.env,a.player,a.simTime);
 let error=null;if(r.device){await r.device.queue.onSubmittedWorkDone();error=(await r.device.popErrorScope())?.message||null;}else error=r.gl.getError();
 return {error,calls:r.drawCalls,triangles:r.triangles,cover:a.groundCover.visibleInstances,tiles:a.groundCover.tiles.size,lost:r.lost};}''',cover)
 check(name+' GPU submission',not stats['error'] and not stats['lost'] and stats['calls']>10,stats)
 png=page.locator('#viewport').screenshot(timeout=120000);image=Image.open(io.BytesIO(png)).convert('RGB')
 check(name+' visible scene',max(ImageStat.Stat(image).stddev)>5)
 (OUT/(name+'-scene.png')).write_bytes(png);page.screenshot(path=str(OUT/(name+'.png')),timeout=120000);return image,stats
with sync_playwright() as p:
 args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-gpu-watchdog']
 if BACKEND=='webgpu':args+=['--enable-unsafe-webgpu','--use-webgpu-adapter=swiftshader','--enable-gpu','--enable-features=Vulkan','--use-vulkan=swiftshader']
 browser=p.chromium.launch(channel='chromium',headless=not bool(os.environ.get('DISPLAY')),args=args)
 context=browser.new_context(viewport={'width':1280,'height':800},has_touch=True,device_scale_factor=1)
 if BACKEND=='webgl':context.add_init_script("Object.defineProperty(Navigator.prototype,'gpu',{get:()=>undefined,configurable:true})")
 page=context.new_page();page.set_default_timeout(180000)
 page.on('pageerror',lambda error:report['errors'].append(str(error)))
 page.on('console',lambda m:report['errors'].append(m.text) if m.type=='error' else None)
 try:
  response=page.goto(BASE,wait_until='domcontentloaded',timeout=90000);check('candidate served',response.status==200);boot(page)
  for region in ['alpine','pine','metro','coast','sakura','nordic','highland','canyon']:
   if region!='alpine':page.evaluate('(id)=>railbound.loadWorld(id)',region)
   page.evaluate('railbound.paused=true;railbound.renderEnabled=false;railbound.env.hour=13.5;railbound.env.weather="clear"')
   features=page.evaluate('railbound.world.features');report['worlds'].append({'region':region,**features})
   check(region+' uses new botany',features.get('botanyRevision')==1 and features.get('trees',0)>0,features)
   check(region+' has validated street component',features.get('roadSegments',0)>0)
   # Capture each region in normal driving view, not just a numerical preview.
   page.evaluate("railbound.camera.setMode('chase');railbound.camera.initial=true")
   render(page,region+'-driving')
   if region=='pine':
    woodland=page.evaluate('''()=>{const a=railbound,w=a.world,candidates=w.batches.filter(b=>b.cutout&&b.lodNear>0&&b.lodNear<400&&b.count>8);let best=null;
     for(const b of candidates)for(let i=0;i<b.count;i+=Math.max(1,Math.floor(b.count/12))){const x=b.data[i*24+12],z=b.data[i*24+14],h=w.surfaceHeight(x,z);
      const terrain=[w.surfaceHeight(x+18,z+24),w.surfaceHeight(x+9,z+12),w.surfaceHeight(x-10,z-10)];
      const relief=Math.max(h,...terrain)-Math.min(h,...terrain);if(relief>7||h<w.def.water+5)continue;
      const rank=b.count-relief*12;if(!best||rank>best.rank)best={x,z,h,terrain,rank};}
     if(!best)throw new Error('No safe woodland photo site');const {x,z,h,terrain}=best;
     a.camera.position=[x+18,Math.max(h+6.5,terrain[0]+5),z+24];a.camera.target=[x,h+8,z];a.camera.setMode('free');a.camera.fov=62;
     return {clearance:a.camera.position[1]-w.surfaceHeight(a.camera.position[0],a.camera.position[2]),rank:best.rank};}''')
    check('woodland review camera above rendered terrain',woodland['clearance']>=4.9,woodland)
    first,stats=render(page,'pine-woodland');check('camera-local understory is populated',stats['cover']>100,stats)
    page.evaluate('railbound.simTime+=3.5');second,_=render(page,'pine-wind');check('wind changes foliage pixels',ImageChops.difference(first,second).getbbox() is not None)
    counts=page.evaluate('''()=>{const a=railbound;const high=a.groundCover.visibleInstances;
     for(let i=0;i<20;i++)a.groundCover.update(a.world,a.camera,a.renderer,'low',20);
     return {high,low:a.groundCover.visibleInstances,tiles:a.groundCover.tiles.size};}''')
    check('low quality reduces ground cover budget',counts['low']<counts['high'] and counts['tiles']<50,counts)
   if region=='metro':
    check('city contains substantial buildings and parks',features.get('buildings',0)>150 and features.get('parks',0)>2,features)
    page.evaluate('''()=>{const a=railbound,d=a.world.districts.slice().sort((x,y)=>y.buildings.length-x.buildings.length)[0];
     const p=d.buildings[Math.floor(d.buildings.length*.5)].position;
     a.camera.position=[p[0]+140,p[1]+110,p[2]+165];a.camera.target=[p[0],p[1]+20,p[2]];a.camera.setMode('free');a.camera.fov=60;
     window.cityView={position:[...a.camera.position],target:[...a.camera.target]};}''')
    day,_=render(page,'city-district-day',False);page.evaluate('railbound.env.hour=21.5');night,_=render(page,'city-district-night',False)
    check('room lighting and sky respond to night',ImageChops.difference(day,night).getbbox() is not None)
    page.evaluate('''()=>{const a=railbound,d=a.world.districts.slice().sort((x,y)=>y.buildings.length-x.buildings.length)[0];const b=d.buildings[0],p=b.position;
     a.camera.position=[p[0]+d.right[0]*23+d.forward[0]*28,p[1]+6,p[2]+d.right[2]*23+d.forward[2]*28];a.camera.target=[p[0],p[1]+7,p[2]];a.camera.setMode('free');a.env.hour=13.5;}''')
    render(page,'city-street-level',False)
  # Real controls, not injected replacement implementations.
  page.evaluate("railbound.camera.setMode('chase');railbound.recover();railbound.env.weather='clear'")
  page.locator('#depart').click();motion=page.evaluate('''()=>{railbound.paused=true;for(let i=0;i<2100;i++)railbound.tick(1/60);return {speed:railbound.player.speed,distance:railbound.player.cursor.odometer};}''');check('driving still moves train',motion['distance']>20,motion)
  page.locator('#emergency').click();page.evaluate('for(let i=0;i<3000;i++)railbound.tick(1/60)');check('emergency brakes stop train',page.evaluate('Math.abs(railbound.player.speed)<.05'))
  saved=page.evaluate('railbound.projectSnapshot()');page.evaluate('(data)=>railbound.importProject(data)',saved);check('project restore keeps region',page.evaluate('railbound.world.def.id')==saved['world'])
  page.set_viewport_size({'width':390,'height':844});page.evaluate("railbound.paused=true;railbound.renderEnabled=false;railbound.settings.quality='medium';railbound.renderer.settings.quality='medium';railbound.ui.update()")
  check('mobile controls visible',page.locator('#throttle').is_visible() and page.locator('#brake').is_visible());check('mobile no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
  page.locator('#throttle').fill('41');page.locator('#throttle').dispatch_event('input');check('touch input updates throttle',page.evaluate('Math.abs(railbound.player.controls.throttle-.41)<.001'))
  render(page,'mobile-living-worlds')
  page.wait_for_function('navigator.serviceWorker.controller!==null',timeout=60000)
  check('new modules available offline',page.evaluate('''async()=>{for(const p of ['src/botany.js','src/settlements.js','src/living-shaders.js'])if(!await caches.match(new URL(p,location.href)))return false;return true;}'''))
  context.set_offline(True);page.reload(wait_until='domcontentloaded');boot(page);render(page,'offline-living-worlds');check('no JS or GPU errors',not report['errors'],report['errors'])
 except Exception as error:
  report['failure']=str(error);print('FAILURE',error,flush=True)
  try:page.screenshot(path=str(OUT/'failure.png'),timeout=30000)
  except Exception:pass
  raise
 finally:
  (OUT/'report.json').write_text(json.dumps(report,indent=2));print(json.dumps({'passed':sum(c['passed'] for c in report['checks']),'errors':report['errors'],'failure':report.get('failure')}),flush=True)
  browser.close()
