#!/usr/bin/env python3
"""Render the committed game and exercise art, temporal rejection and packaging.
Software-GPU CI checks correctness, not hardware frame rates. Every tested frame
executes the actual renderer, queue completion and browser presentation.
"""
import io
import json
import os
from pathlib import Path
from PIL import Image, ImageStat
from playwright.sync_api import sync_playwright
BASE=os.environ.get('PAGE_URL','http://127.0.0.1:8000/RailboundAdventures/').rstrip('/')+'/'
BACKEND=os.environ.get('BACKEND','webgpu')
if BACKEND not in ('webgpu','webgl'):raise ValueError('Unknown backend')
OUT=Path('authored-results')/BACKEND;OUT.mkdir(parents=True,exist_ok=True)
report={'url':BASE,'backend':BACKEND,'checks':[],'errors':[],'warnings':[]}

def check(name,ok,detail=None):
 report['checks'].append({'name':name,'passed':bool(ok),'detail':detail})
 print(('PASS ' if ok else 'FAIL ')+name+': '+str(detail),flush=True)
 if not ok:raise AssertionError(name)

def context_for(browser,width=960,height=600,**options):
 context=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1,**options)
 context.add_init_script('window.requestAnimationFrame = () => 0;')
 if BACKEND=='webgl':context.add_init_script("Object.defineProperty(Navigator.prototype,'gpu',{get:()=>undefined,configurable:true})")
 context.on('page',lambda page:page.on('pageerror',lambda e:report['errors'].append(str(e))))
 return context

def boot(page,art=True):
 page.set_default_timeout(240000)
 page.wait_for_function("window.railbound?.ready || !document.getElementById('fatal').classList.contains('hidden')",timeout=240000,polling=250)
 state=page.evaluate("""()=>{const a=railbound;a.renderEnabled=false;a.paused=true;a.settings.adaptive=false;
 a.settings.resolution=.75;a.applySettings();return {ready:a.ready,kind:a.renderer.kind,error:a.renderer.lastError,
 fatal:document.getElementById('fatal-message').textContent,art:a.renderer.authored.status,loaded:a.renderer.authored.loaded,
 props:a.world?.features.authoredProps,stations:a.world?.features.authoredStations};}""")
 check('boot on requested renderer',state['ready'] and not state['error'] and state['kind']==('WebGPU' if BACKEND=='webgpu' else 'WebGL 2'),state)
 check('authored art ready' if art else 'procedural art fallback',state['art']==('ready' if art else 'fallback'),state)
 if art:check('real props and station kits instantiated',state['props']>0 and state['stations']>0,state)
 page.wait_for_function("document.getElementById('loading').classList.contains('hidden')",timeout=60000,polling=100)

def capture(page,name):
 hide=page.add_style_tag(content='body > :not(#viewport) {visibility:hidden!important}')
 try:png=page.locator('#viewport').screenshot(timeout=180000)
 finally:hide.evaluate('(e)=>e.remove()')
 image=Image.open(io.BytesIO(png)).convert('RGB');s=ImageStat.Stat(image)
 check(name+' visible pixels',max(s.stddev)>5 and sum(s.mean)>9,{'mean':s.mean,'stddev':s.stddev})
 (OUT/(name+'.png')).write_bytes(png);return image

def render(page,name,shot=False,fixture=False):
 state=page.evaluate("""async fixture=>{const a=railbound,r=a.renderer;
 let batches=a.artFixture?.batches;
 if(!fixture){const stock=a.rolling.update(a.trains,a.world,a.camera,0,a.simTime,a.camera.mode);
 const life=a.life.update(a.world,a.camera,a.simTime,a.settings.quality,a.settings.wildlife);
 let ground=[];for(let i=0;i<4;i++)ground=a.groundCover.update(a.world,a.camera,r,a.settings.quality,24);
 batches=[...a.world.batches,...stock,...life,...ground];}
 if(r.device)r.device.pushErrorScope('validation');
 r.render(batches,a.camera,a.world.def,a.env,fixture?null:a.player,a.simTime);
 let error=null;if(r.device){await r.device.queue.onSubmittedWorkDone();error=(await r.device.popErrorScope())?.message||null;}
 else{r.gl.finish();error=r.gl.getError();}
 const t=r.post.temporal;return {error,lost:r.lost,calls:r.drawCalls,triangles:r.triangles,hdr:r.post.hdr,
 temporal:t.active,history:t.history.length,pass:t.passCount,usedHistory:t.uniformData[42],sample:t.sample,
 resets:t.resetCount,width:r.width,height:r.height,art:r.authored.status,bytes:r.authored.bytes,groups:r.post.groupCache?.size||0};}""",fixture)
 check(name+' valid render',not state['error'] and not state['lost'] and state['calls']>0,state)
 return state,capture(page,name) if shot else None

with sync_playwright() as p:
 args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-gpu-watchdog']
 if BACKEND=='webgpu':args+=['--enable-unsafe-webgpu','--use-webgpu-adapter=swiftshader','--enable-gpu','--enable-features=Vulkan','--use-vulkan=swiftshader']
 launch={'channel':'chromium','headless':not bool(os.environ.get('DISPLAY')),'args':args}
 if os.environ.get('CHROMIUM_EXECUTABLE'):launch['executable_path']=os.environ['CHROMIUM_EXECUTABLE'];launch.pop('channel',None)
 browser=p.chromium.launch(**launch);report['browser']=browser.version
 ctx=context_for(browser,has_touch=True);page=ctx.new_page()
 page.on('console',lambda m:report['errors'].append(m.text) if m.type=='error' else report['warnings'].append(m.text) if m.type=='warning' else None)
 try:
  response=page.goto(BASE,wait_until='domcontentloaded',timeout=120000);check('candidate HTTP 200',response.status==200);boot(page)
  page.evaluate("railbound.env.hour=13.5;railbound.env.weather='clear';railbound.camera.update(railbound.player,railbound.world,0,new Set())")
  initial,_=render(page,'alpine-station',True)
  check('high quality accumulates in HDR targets',initial['hdr'] and initial['temporal'] and initial['history']==2 and initial['pass']==1,initial)
  check('first frame rejects undefined history',initial['usedHistory']==0,initial)
  next_frame,_=render(page,'continuous-frame')
  check('second frame reuses valid history',next_frame['usedHistory']==1,next_frame)
  page.evaluate("""async()=>{const a=railbound,{SceneBuilder}=await import('./src/geometry.js'),{AUTHORED_MODELS}=await import('./src/authored-assets.js');
   const b=new SceneBuilder();b.instance('box',[0,-.2,0],[30,.4,30],[.55,.57,.48,1],[6,.9,0,0]);
   let i=0;for(const model of AUTHORED_MODELS.values()){
    const batch=b.instance('authored-'+model.name+'-0',[(i%6)*3-7,0,Math.floor(i/6)*4],[1,1,1],[1,1,1,1],[model.cutout?18:17,.9,model.layer,0]);
    batch.cutout=model.cutout;i++;}a.artFixture={batches:b.finish()};a.renderer.settings.shadows=false;
   a.camera.setMode('free');a.camera.position=[9,6,16];a.camera.target=[0,1,2];a.camera.fov=54;}""")
  render(page,'natural-asset-gallery',True,True)
  page.evaluate("""async()=>{const a=railbound,{SceneBuilder}=await import('./src/geometry.js');const b=new SceneBuilder();
   b.instance('box',[0,-.2,0],[30,.4,30],[.34,.38,.3,1],[6,.9,0,0]);
   for(let i=0;i<22;i++)b.instance('box',[i*.24-2.6,1.5,-1],[.06,3,.14],[.8,.78,.7,1],[0,.4,.2,0]);
   const moving=b.instance('box',[-2,1,1],[1.1,2,1],[.8,.14,.1,-1],[0,.4,.1,0]);
   a.artFixture={batches:b.finish(),moving};a.camera.setMode('free');a.camera.position=[6,4,13];a.camera.target=[0,1,0];a.camera.fov=56;
   a.env.weather='clear';a.env.hour=13.5;}""")
  first,_=render(page,'temporal-reset',False,True);check('new scene rejects history',first['usedHistory']==0,first)
  for i in range(10):state,_=render(page,'static-convergence-'+str(i),i==9,True)
  check('static history advances through jitter cycle',state['usedHistory']==1 and state['sample']>=8,state)
  page.evaluate('railbound.camera.position[0]+=.075;railbound.camera.target[0]+=.075')
  state,_=render(page,'subpixel-camera-motion',True,True);check('small camera move keeps history',state['usedHistory']==1,state)
  page.evaluate('railbound.artFixture.moving.data[12]+=3;railbound.artFixture.moving.dirty=true')
  render(page,'moving-reactive-object',True,True)
  probe=page.evaluate((Path(__file__).parent/'temporal_probe.js').read_text())
  check('moving object bypasses accumulated history',probe['reactive']>50 and probe['negativeHistory']==probe['reactive'] and probe['maxReactiveError']<.003,probe)
  check('vacated silhouette rejects stale history',probe['disoccluded']>20 and probe['maxDisocclusionError']<.003,probe)
  page.evaluate('railbound.camera.position[0]+=40;railbound.camera.target[0]+=40')
  state,_=render(page,'camera-cut',False,True);check('camera cut rejects old image',state['usedHistory']==0,state)
  page.evaluate('railbound.camera.position[0]-=40;railbound.camera.target[0]-=40')
  render(page,'motion-return',False,True)
  for i in range(4):
   page.evaluate('railbound.renderer.post.options.temporal=false')
   off,_=render(page,'taa-off-'+str(i),False,True);check('TAA off releases targets '+str(i),off['history']==0 and off['pass']==0,off)
   page.evaluate('railbound.renderer.post.options.temporal=true')
   on,_=render(page,'taa-on-'+str(i),False,True);check('TAA reenable has fresh history '+str(i),on['history']==2 and on['usedHistory']==0 and on['groups']<=2,on)
  for width,height in [(390,844),(844,390),(960,600)]:
   page.set_viewport_size({'width':width,'height':height});s,_=render(page,'resize-'+str(width),False,True)
   check('resize invalidates temporal history '+str(width),s['usedHistory']==0 and s['history']==2,s)
   check('viewport stays inside page '+str(width),page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
  page.evaluate("railbound.renderer.settings.quality='low'")
  s,_=render(page,'low-tier',False,True);check('low tier retains spatial rendering without histories',not s['temporal'] and s['history']==0,s)
  page.evaluate("railbound.renderer.settings.quality='high';railbound.renderer.settings.shadows=true")
  page.evaluate("railbound.loadWorld('pine')")
  view=page.evaluate("""async()=>{const a=railbound,w=a.world,{stationLandUse}=await import('./src/land-use.js');
   const samples=w.authoredSamples.filter(s=>!stationLandUse(w,s.position[0],s.position[2],24));
   const p=samples.find(s=>s.name.startsWith('tree_stump'))||samples[0];
   if(!p)throw new Error('Missing natural prop ensemble');const q=p.position;
   a.camera.setMode('free');a.camera.position=[q[0]+8,Math.max(q[1]+3.4,w.surfaceHeight(q[0]+8,q[2]+10)+2),q[2]+10];a.camera.target=[q[0],q[1]+2,q[2]];a.camera.fov=60;
   let intrusions=0;for(const b of w.batches)if(b.detailClass==='authored'&&b.lodNear===75)for(let i=0;i<b.count;i++)if(stationLandUse(w,b.data[i*24+12],b.data[i*24+14]))intrusions++;
   return {props:w.features.authoredProps,stations:w.features.authoredStations,canopies:w.features.stationCanopies,intrusions};}""")
  render(page,'pine-authored-nature',True);check('pine props and station kit populated',view['props']>20 and view['stations']>0,view)
  check('generated art respects every station footprint',view['intrusions']==0,view)
  page.evaluate("railbound.loadWorld('metro')")
  page.evaluate("""()=>{const a=railbound,w=a.world,s=w.stations[0],p=w.network.edges.get(s.edge).at(s.s-92),q=w.railCross(p,17,0);
   a.camera.setMode('free');a.camera.position=[q[0]-p.right[0]*26+p.f[0]*30,q[1]+12,q[2]-p.right[2]*26+p.f[2]*30];a.camera.target=[q[0],q[1]+4,q[2]];a.camera.fov=55;a.env.hour=16.5;}""")
  render(page,'metro-concourse',True)
  page.evaluate("async()=>{const {STOCK}=await import('./src/data.js');railbound.player.setStock(STOCK.find(s=>s.id==='velocity'));}")
  page.evaluate("railbound.camera.setMode('orbit');railbound.camera.distance=42;railbound.camera.update(railbound.player,railbound.world,0,new Set())")
  render(page,'velocity-manufactured-shell',True)
  page.evaluate("railbound.ui.openPanel('cinematic')")
  check('temporal setting exposed in UI',page.locator('#cin-temporal').count()==1)
  page.locator('#cin-temporal').uncheck();check('UI toggle updates renderer',page.evaluate('railbound.renderer.post.options.temporal===false'))
  page.locator('#close-dialog').click()
  saved=page.evaluate('railbound.projectSnapshot()');page.evaluate('(s)=>railbound.importProject(s)',saved)
  check('temporal preference survives project restore',page.evaluate('railbound.settings.cinematic.temporal===false'))
  page.evaluate('railbound.recover()');page.locator('#depart').click()
  motion=page.evaluate('''()=>{const a=railbound;a.paused=true;const before=a.player.cursor.odometer;for(let i=0;i<2100;i++)a.tick(1/60);return a.player.cursor.odometer-before;}''')
  check('train still accelerates and follows track',motion>20,motion)
  page.locator('#emergency').click();page.evaluate('for(let i=0;i<3000;i++)railbound.tick(1/60)')
  check('emergency brake remains operational',page.evaluate('Math.abs(railbound.player.speed)<.05'))
  page.wait_for_function('navigator.serviceWorker.controller!==null',timeout=60000,polling=250)
  check('authored mesh pack and maps precached',page.evaluate("""async()=>{const m=await(await fetch('assets/authored/manifest.json')).json();const paths=['assets/authored/hero-meshes.bin'];for(const l of m.layers)for(const k of ['albedo','surface'])paths.push('assets/authored/'+l[k]);for(const p of paths)if(!await caches.match(new URL(p,location.href)))return false;return true;}"""))
  ctx.set_offline(True);page.reload(wait_until='domcontentloaded');boot(page);render(page,'offline-authored',True);ctx.set_offline(False)
  mobile=context_for(browser,390,844,has_touch=True);mp=mobile.new_page();mp.goto(BASE,wait_until='domcontentloaded');boot(mp)
  tier=mp.evaluate('({size:railbound.renderer.authored.size,bytes:railbound.renderer.authored.bytes,quality:railbound.settings.quality})')
  check('mobile cold-start art memory tier',tier['size']==256 and tier['bytes']<3_000_000,tier);render(mp,'mobile-authored',True);mobile.close()
  fallback=context_for(browser,800,600,service_workers='block');fallback.route('**/assets/authored/**',lambda route:route.fulfill(status=503,body='unavailable'))
  fp=fallback.new_page();fp.goto(BASE,wait_until='domcontentloaded');boot(fp,False);render(fp,'missing-art-fallback',True);fallback.close()
  standalone=context_for(browser,800,600,service_workers='block')
  standalone.route('**/*',lambda route:route.continue_() if route.request.is_navigation_request() and route.request.url==BASE+'downloads/Railbound-Adventures.html' else route.abort())
  sp=standalone.new_page();sp.goto(BASE+'downloads/Railbound-Adventures.html',wait_until='domcontentloaded',timeout=120000);boot(sp);render(sp,'standalone-authored',True);standalone.close()
  check('no JavaScript or GPU errors',not report['errors'],report['errors'])
 except Exception as error:
  report['failure']=str(error);print('FAILURE',error,flush=True)
  try:page.screenshot(path=str(OUT/'failure.png'),timeout=30000)
  except Exception:pass
  raise
 finally:
  (OUT/'report.json').write_text(json.dumps(report,indent=2)+'\n')
  print(json.dumps({'passed':sum(c['passed'] for c in report['checks']),'checks':len(report['checks']),'failure':report.get('failure'),'errors':report['errors']}),flush=True)
  ctx.close();browser.close()
