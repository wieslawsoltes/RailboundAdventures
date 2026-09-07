#!/usr/bin/env python3
"""Validate actual candidate modules and linear-light presentation in Chromium.
Software adapters prove correctness, not native GPU performance. No app code is
injected: only controls, settings and fixed-step/manual frame calls are exercised.
"""
import io
import json
import os
import sys
from pathlib import Path
from PIL import Image, ImageStat, ImageChops
from playwright.sync_api import sync_playwright

BASE = os.environ.get('PAGE_URL', 'http://127.0.0.1:8000/RailboundAdventures/').rstrip('/') + '/'
BACKEND = os.environ.get('BACKEND', 'webgpu')
if BACKEND not in ('webgpu', 'webgl'):
    raise ValueError('BACKEND must be webgpu or webgl')
OUT = Path('cinematic-results') / BACKEND
OUT.mkdir(parents=True, exist_ok=True)
report = {'url': BASE, 'backend': BACKEND, 'checks': [], 'errors': [], 'warnings': []}


def check(name, result, detail=None):
    item = {'name': name, 'passed': bool(result)}
    if detail is not None:
        item['detail'] = detail
    report['checks'].append(item)
    print(('PASS ' if result else 'FAIL ') + name + (': ' + str(detail) if detail is not None else ''), flush=True)
    if not result:
        raise AssertionError(name + ': ' + str(detail))


def boot(page):
    page.wait_for_function('window.railbound?.ready || !document.getElementById("fatal").classList.contains("hidden")', timeout=120000)
    state = page.evaluate('''() => ({ready:railbound.ready,kind:railbound.renderer.kind,
        hdr:railbound.renderer.post.hdr,error:railbound.renderer.lastError,
        fatal:document.getElementById('fatal-message').textContent})''')
    check('game starts with expected backend', state['ready'] and state['kind'] == ('WebGPU' if BACKEND == 'webgpu' else 'WebGL 2'), state)
    page.evaluate('''() => {const a=railbound;a.renderEnabled=false;a.paused=true;
        a.settings.resolution=.65;a.settings.adaptive=false;a.settings.quality='high';a.applySettings();}''')
    page.wait_for_function('document.getElementById("loading").classList.contains("hidden")')


def render(page, name, capture=True):
    result = page.evaluate('''async () => {
        const a=railbound,r=a.renderer;
        a.camera.initial=true;a.camera.update(a.player,a.world,1/60,new Set());
        const stock=a.rolling.update(a.trains,a.world,a.camera,0,a.simTime,a.camera.mode);
        const life=a.life.update(a.world,a.camera,a.simTime,a.settings.quality,a.settings.wildlife);
        if(r.device)r.device.pushErrorScope('validation');
        r.render([...a.world.batches,...stock,...life],a.camera,a.world.def,a.env,a.player,a.simTime);
        let error=null;
        if(r.device){await r.device.queue.onSubmittedWorkDone();error=(await r.device.popErrorScope())?.message||null;}
        else {const e=r.gl.getError();if(e)error='WebGL '+e;}
        return {error,calls:r.drawCalls,triangles:r.triangles,lost:r.lost,passes:r.post.passCount,
            hdr:r.post.hdr,targets:r.post.resources.length,width:r.width,height:r.height,birds:a.life.visibleBirds};
    }''')
    check(name+' submission', not result['error'] and not result['lost'] and result['calls']>10 and result['triangles']>1000, result)
    if capture:
        page.wait_for_timeout(150)
        png=page.locator('#viewport').screenshot(timeout=90000)
        image=Image.open(io.BytesIO(png)).convert('RGB')
        check(name+' nonblank', max(ImageStat.Stat(image).stddev)>5)
        (OUT/(name+'-scene.png')).write_bytes(png)
        page.screenshot(path=str(OUT/(name+'.png')),timeout=90000)
        return result,image
    return result,None


with sync_playwright() as p:
    args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-gpu-watchdog','--enable-logging=stderr']
    if BACKEND=='webgpu':
        args+=['--enable-unsafe-webgpu','--use-webgpu-adapter=swiftshader','--enable-gpu']
        if sys.platform.startswith('linux'):
            if not os.environ.get('DISPLAY'):
                raise RuntimeError('Use xvfb-run for Linux WebGPU presentation tests')
            args+=['--enable-features=Vulkan','--use-vulkan=swiftshader']
    browser=p.chromium.launch(channel='chromium',headless=not bool(os.environ.get('DISPLAY')),args=args)
    report['browser']=browser.version
    context=browser.new_context(viewport={'width':1440,'height':900},device_scale_factor=1,has_touch=True,accept_downloads=True)
    if BACKEND=='webgl':
        context.add_init_script("Object.defineProperty(Navigator.prototype,'gpu',{get:()=>undefined,configurable:true});")
    page=context.new_page();page.set_default_timeout(90000)
    page.on('pageerror',lambda e:report['errors'].append(str(e)))
    page.on('console',lambda m:report['errors'].append(m.text) if m.type=='error' else report['warnings'].append(m.text) if m.type=='warning' else None)
    try:
        response=page.goto(BASE,wait_until='domcontentloaded',timeout=90000)
        check('HTTP 200 secure candidate',response.status==200 and page.evaluate('isSecureContext'))
        boot(page)
        result,natural=render(page,'alpine-hdr')
        check('linear HDR and four display passes',result['hdr'] and result['passes']==4,result)
        count=result['targets']
        for look in ['cinema','vintage','alpine']:
            page.evaluate('(look)=>{railbound.settings.cinematic.look=look;railbound.applySettings();}',look)
            _,image=render(page,'grade-'+look)
            difference=sum(ImageStat.Stat(ImageChops.difference(natural,image)).mean)
            check('grade '+look+' changes pixels',difference>2,round(difference,3))
        page.evaluate("railbound.settings.cinematic.look='natural';railbound.settings.cinematic.bloom=0;railbound.applySettings()")
        result,_=render(page,'bloom-disabled',False)
        check('bloom disabled skips bloom passes',result['passes']==1)
        page.evaluate("railbound.settings.cinematic.bloom=.24;railbound.settings.quality='low';railbound.applySettings()")
        result,_=render(page,'low-budget',False)
        check('low preset skips bloom',result['passes']==1)
        page.evaluate("railbound.settings.quality='high';railbound.applySettings()")
        for width,height in [(390,844),(844,390),(1280,800),(1440,900)]:
            page.set_viewport_size({'width':width,'height':height})
            result,_=render(page,'resize-'+str(width),False)
            check('bounded targets after resize '+str(width),result['targets']==count)
        for name in ['journey','cinematic']:
            page.evaluate('(n)=>railbound.ui.openPanel(n)',name)
            check(name+' panel accessible',page.locator('#panel-dialog').is_visible() and len(page.locator('#panel-content').inner_text())>100)
            page.screenshot(path=str(OUT/(name+'-panel.png')))
            if name=='cinematic':
                page.locator('#cin-motion').uncheck()
                check('reduced motion disables suspension camera',page.evaluate('railbound.camera.motion===false'))
                page.locator('#cin-wildlife').uncheck()
            page.locator('#close-dialog').click()
        result,_=render(page,'wildlife-off',False)
        check('wildlife toggle empties live buffers',result['birds']==0)
        page.evaluate('railbound.settings.wildlife=true;railbound.applySettings()')
        page.locator('#depart').click()
        motion=page.evaluate('''()=>{railbound.paused=true;for(let i=0;i<60*35;i++)railbound.tick(1/60);
            return {speed:railbound.player.speed,stats:railbound.journey.stats,profile:railbound.journey.profile.length};}''')
        check('driving produces route telemetry',motion['speed']>3 and motion['stats']['distance']>20 and motion['profile']>10,motion)
        page.locator('#emergency').click()
        page.evaluate('for(let i=0;i<60*50;i++)railbound.tick(1/60)')
        check('emergency still stops train',page.evaluate('Math.abs(railbound.player.speed)<.05'))
        page.evaluate('railbound.recover();railbound.paused=true')
        saved=page.evaluate('railbound.projectSnapshot()')
        page.evaluate('(s)=>railbound.importProject(s)',saved)
        page.evaluate('railbound.paused=true;railbound.renderEnabled=false')
        check('journey and settings survive save',page.evaluate('railbound.journey.stats.distance')==saved['journey']['distance'] and page.evaluate('railbound.settings.cameraMotion')==False)
        page.evaluate("async()=>{const {STOCK}=await import('./src/data.js');railbound.player.setStock(STOCK.find(s=>s.id==='velocity'));railbound.camera.setMode('orbit');railbound.camera.distance=36;railbound.camera.azimuth=.62;railbound.camera.elevation=.13;}")
        render(page,'velocity-loft')
        check('orbit camera clears rendered cutting',page.evaluate('''()=>{const a=railbound,c=a.camera;return c.position[1]>=a.world.surfaceHeight(c.position[0],c.position[2])+2.4&&Math.hypot(c.position[0]-c.target[0],c.position[2]-c.target[2])>25;}'''))
        check('terrain triangles clear train loading gauge',page.evaluate('''()=>{const a=railbound;for(let d=-60;d<=120;d+=5){const p=a.player.cursor.pose(d);for(const side of [-1.6,0,1.6]){const x=p.p[0]+side*p.right[0],z=p.p[2]+side*p.right[2];if(a.world.surfaceHeight(x,z)>p.p[1]+.35)return false;}}return true;}'''))
        page.evaluate("railbound.camera.setMode('cab')")
        render(page,'velocity-cab')
        page.evaluate("railbound.camera.setMode('chase');railbound.paused=false")
        # Native keyboard handlers are used, including control isolation in photo mode.
        controls=page.evaluate('JSON.stringify(railbound.player.controls)')
        previous=page.evaluate('({mode:railbound.camera.mode,fov:railbound.camera.fov,paused:railbound.paused})')
        page.keyboard.press('F2')
        check('photo mode pauses and frees camera',page.evaluate('railbound.photoMode&&railbound.paused&&railbound.camera.mode==="free"') and page.locator('#photo-studio').is_visible())
        page.keyboard.press('o');page.keyboard.press('Space');page.keyboard.press('3')
        check('photo keyboard never changes driving controls',page.evaluate('JSON.stringify(railbound.player.controls)')==controls)
        page.locator('#photo-fov').fill('32');page.locator('#photo-fov').dispatch_event('input')
        page.locator('#photo-look').select_option('cinema')
        check('photo lens and grade are wired',page.evaluate('railbound.camera.fov===32&&railbound.renderer.post.options.look==="cinema"'))
        render(page,'photo-studio')
        with page.expect_download(timeout=90000) as download:
            page.locator('#photo-capture').click()
            page.evaluate('railbound.renderEnabled=true')
        downloaded=download.value;downloaded.save_as(str(OUT/'photo-capture.png'))
        page.evaluate('railbound.renderEnabled=false')
        check('PNG capture has real pixels',(OUT/'photo-capture.png').stat().st_size>10000)
        page.keyboard.press('Escape')
        check('photo exit restores camera and pause state',page.evaluate('({mode:railbound.camera.mode,fov:railbound.camera.fov,paused:railbound.paused})')==previous)
        page.evaluate('railbound.paused=true')
        # Audio is started by an actual user action and has a bounded persistent graph.
        page.locator('#audio-toggle').click();page.locator('#audio-toggle').click()
        state=page.evaluate('''async()=>{await railbound.audio.enable();const a=railbound.audio,n=a.nodes.length;
            for(let i=0;i<100;i++)a.update(railbound.player,'rain',false,'cab',12);
            return {state:a.context.state,count:a.nodes.length,stable:n===a.nodes.length,compressor:!!a.compressor};}''')
        check('audio graph is bounded and running',state['state']=='running' and state['stable'] and state['count']<60 and state['compressor'],state)
        page.evaluate("()=>{railbound.audio.stop();railbound.settings.wildlife=true;}")
        for region,hour,weather in [('coast',17.8,'clear'),('nordic',23.5,'clear'),('metro',22,'rain')]:
            page.evaluate('(id)=>railbound.loadWorld(id)',region)
            page.evaluate('''([hour,weather])=>{const a=railbound;a.paused=true;a.renderEnabled=false;
                a.env.hour=hour;a.env.weather=weather;a.env.exposure=1.15;
                a.camera.setMode('chase');a.settings.cinematic.look='cinema';a.applySettings();}''',[hour,weather])
            _,scene=render(page,region+'-atmosphere')
            if region=='nordic':
                check('night grading retains visible shadow detail',sum(ImageStat.Stat(scene).mean)/3>5,ImageStat.Stat(scene).mean)
            check(region+' civil structures rebuilt',page.evaluate('railbound.world.viaductSpans.length>0&&railbound.world.features.foundations>0'))
        for width,height in [(390,844),(844,390)]:
            page.set_viewport_size({'width':width,'height':height})
            page.evaluate('railbound.ui.update()')
            check('mobile '+str(width)+' no page overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
            check('mobile studio button in viewport '+str(width),page.locator('#photo-mode').evaluate('(e)=>{let r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight}'))
            page.locator('#photo-mode').click()
            check('mobile photo studio opens '+str(width),page.locator('#photo-studio').is_visible())
            render(page,'mobile-studio-'+str(width))
            page.locator('#photo-exit').click()
        page.wait_for_function('navigator.serviceWorker.controller!==null')
        context.set_offline(True)
        page.reload(wait_until='domcontentloaded',timeout=90000);boot(page)
        render(page,'offline-hdr')
        check('offline terrain worker and new modules available',page.evaluate("railbound.world.terrain.execution==='worker'&&!!railbound.journey&&!!railbound.renderer.post"))
        context.set_offline(False)
        if BACKEND=='webgl':
            # Explicitly exercise the documented no-float extension fallback.
            context2=browser.new_context(viewport={'width':900,'height':600})
            context2.add_init_script("""Object.defineProperty(Navigator.prototype,'gpu',{get:()=>undefined});
                const get=WebGL2RenderingContext.prototype.getExtension;
                WebGL2RenderingContext.prototype.getExtension=function(name){return name==='EXT_color_buffer_float'?null:get.call(this,name)};""")
            fallback=context2.new_page();fallback.on('pageerror',lambda e:report['errors'].append(str(e)))
            fallback.on('console',lambda m:report['errors'].append(m.text) if m.type=='error' else None)
            fallback.goto(BASE,wait_until='domcontentloaded');boot(fallback)
            result,_=render(fallback,'ldr-fallback')
            check('LDR compatibility omits bloom without errors',not result['hdr'] and result['passes']==1)
            context2.close()
        check('no JavaScript or GPU errors',not report['errors'],report['errors'][:10])
    except Exception as error:
        report['failure']=str(error)
        print('FAILURE',str(error),flush=True)
        print('ERRORS',json.dumps(report['errors']),flush=True)
        try:page.screenshot(path=str(OUT/'failure.png'),timeout=30000)
        except Exception:pass
        raise
    finally:
        (OUT/'report.json').write_text(json.dumps(report,indent=2))
        print(json.dumps({'backend':BACKEND,'passed':sum(c['passed'] for c in report['checks']),'failed':sum(not c['passed'] for c in report['checks']),'errors':report['errors'],'failure':report.get('failure')}),flush=True)
        context.close();browser.close()
