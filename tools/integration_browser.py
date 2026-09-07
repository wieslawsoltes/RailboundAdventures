#!/usr/bin/env python3
"""Offline browser integration tests. No navigation or external requests required.
Real rendering is enabled for screenshot cases; continuous rendering is suppressed
between those cases so software rasterization cannot starve the UI test runner.
"""
from playwright.sync_api import sync_playwright
from pathlib import Path
import json, os, re, time
ROOT=Path(__file__).resolve().parents[1]
os.environ.setdefault('DISPLAY', ':99')
html=(ROOT/'dist/index.html').read_text()
html=re.sub(r'const app\s*=\s*new RailboundApp\(\);',r'\g<0> app.renderEnabled=false;',html)
results=[]; errors=[]
def check(name, predicate):
    if not predicate: raise AssertionError(name)
    results.append({'test':name,'passed':True}); print('PASS',name,flush=True)
def render(page, name):
    page.wait_for_timeout(800)  # Let the loading-overlay exit transition finish.
    page.evaluate('''() => { const a=railbound; a.renderer.settings.resolution=.7; a.renderer.settings.shadows=true; a.camera.initial=true;a.camera.update(a.player,a.world,1/60,new Set());const d=a.rolling.update(a.trains,a.world,a.camera,0,a.simTime,a.camera.mode);a.renderer.render([...a.world.batches,...d],a.camera,a.world.def,a.env,a.player,a.simTime);}''')
    page.screenshot(path=str(ROOT.parent/name),timeout=120000)
    check(name+' has a rendered scene',page.evaluate('railbound.renderer.drawCalls > 0 && !railbound.renderer.lost'))
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE') or p.chromium.executable_path,headless=os.environ.get('RAILBOUND_HEADFUL') != '1',args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader'])
    gpu=b.new_browser_cdp_session().send('SystemInfo.getInfo').get('gpu',{})
    print('GPU FEATURE STATUS:',gpu.get('featureStatus'),flush=True)
    context=b.new_context(viewport={'width':1440,'height':900},has_touch=True)
    page=context.new_page()
    page.on('pageerror',lambda e: (errors.append(str(e)),print('PAGE ERROR:',str(e),flush=True)))
    page.on('console',lambda m: (errors.append(m.text),print('CONSOLE ERROR:',m.text,flush=True)) if m.type=='error' else None)
    try:
        page.set_content(html,wait_until='domcontentloaded',timeout=120000)
        page.wait_for_function('globalThis.railbound?.ready || document.getElementById(\"fatal-message\")?.textContent',timeout=90000)
        startup=page.evaluate('({ready:globalThis.railbound?.ready,renderer:globalThis.railbound?.renderer.kind,fatal:document.getElementById(\"fatal-message\")?.textContent,secure:isSecureContext,gpu:!!navigator.gpu})')
        print('STARTUP:',startup,flush=True)
        if not startup.get('ready'): raise RuntimeError(startup)
        check('WebGL2 fallback boot',page.evaluate('railbound.renderer.kind === "WebGL 2"'))
        check('initial route and three trains',page.evaluate('railbound.world.def.id==="alpine" && railbound.trains.length===3'))
        page.evaluate('railbound.togglePause(true)')
        for panel in ['worlds','fleet','map','environment','dispatch','editor','settings','systems','missions','help']:
            page.evaluate('(name)=>railbound.ui.openPanel(name)',panel)
            check('open '+panel, page.locator('#panel-dialog').is_visible())
            check(panel+' content populated',len(page.locator('#panel-content').inner_text())>80)
            page.locator('#close-dialog').click()
        page.locator('#depart').click()
        state=page.evaluate('''()=>{railbound.paused=true;for(let i=0;i<60*35;i++)railbound.tick(1/60);return {speed:railbound.player.speed,odometer:railbound.player.cursor.odometer,disabled:railbound.player.derailed};}''')
        check('departure causes actual powered motion',state['speed']>3 and state['odometer']>20 and not state['disabled'])
        page.locator('#emergency').click()
        check('emergency brake latched',page.evaluate('railbound.player.controls.emergency'))
        page.evaluate('for(let i=0;i<60*50;i++)railbound.tick(1/60)')
        check('emergency braking stops train',page.evaluate('Math.abs(railbound.player.speed)<.05'))
        page.evaluate('railbound.recover();railbound.togglePause(true)')
        page.evaluate('railbound.ui.openPanel("fleet")')
        page.locator('[data-stock="heritage"]').click()
        check('switch to steam locomotive',page.evaluate('railbound.player.stock.kind==="steam"'))
        page.evaluate('railbound.ui.openPanel("systems")')
        page.locator('#sys-cars').fill('5');page.locator('#sys-cars').dispatch_event('input');page.locator('#apply-cars').click()
        check('consist configuration changes physical mass',page.evaluate('railbound.player.cars===5 && railbound.player.mass===307000'))
        page.locator('#close-dialog').click()
        page.evaluate('railbound.ui.openPanel("environment")')
        page.locator('[data-weather="rain"]').click()
        check('weather and wipers updated',page.evaluate('railbound.env.weather==="rain" && railbound.player.controls.wipers'))
        page.locator('#close-dialog').click()
        page.evaluate('''()=>{railbound.camera.distance=123;railbound.camera.azimuth=.45;railbound.simTime=4321;railbound.autopilot=true;railbound.world.traffic.holds.add('main:2');railbound.player.reservoir=8.2;railbound.player.throttleLag=.17;}''')
        saved=page.evaluate('railbound.projectSnapshot()')
        saved['settings']['quality']='medium'; saved['settings']['resolution']=.7
        page.evaluate('(project)=>railbound.importProject(project)',saved)
        page.evaluate('railbound.togglePause(true)')
        check('project restores camera, dispatch, and simulation clock',page.evaluate('railbound.camera.distance===123 && railbound.camera.azimuth===.45 && railbound.simTime===4321 && railbound.autopilot && railbound.world.traffic.holds.has(\'main:2\')'))
        check('project restores transient locomotive state',page.evaluate('railbound.player.reservoir===8.2 && railbound.player.throttleLag===.17'))
        page.evaluate('railbound.autopilot=false;railbound.world.traffic.holds.clear()')
        check('project imports train, consist, and weather',page.evaluate('railbound.player.stock.id==="heritage" && railbound.player.cars===5 && railbound.env.weather==="rain"'))
        before=page.evaluate('railbound.world.def.id')
        rejected=page.evaluate('''async()=>{try{await railbound.importProject({format:'wrong'});return false;}catch{return true;}}''')
        check('invalid import leaves current world intact',rejected and page.evaluate('railbound.world.def.id')==before)
        page.evaluate('railbound.ui.openPanel("dispatch")')
        old_count=page.evaluate('railbound.trains.length')
        page.locator('#add-ai').click()
        check('dispatcher adds a real AI train',page.evaluate('railbound.trains.length')==old_count+1)
        page.locator('#close-dialog').click()
        page.evaluate('railbound.ui.openPanel("editor")')
        page.locator('[data-tool="tree"]').click(); page.locator('#large-map').click(position={'x':220,'y':190})
        check('editor stages scenery',page.evaluate('railbound.ui.draft.objects.length===1'))
        page.locator('#edit-undo').click();check('editor undo',page.evaluate('railbound.ui.draft.objects.length===0'))
        page.locator('#edit-redo').click();check('editor redo',page.evaluate('railbound.ui.draft.objects.length===1'))
        page.locator('#edit-apply').click();page.wait_for_function('!railbound.loadingWorld',timeout=90000)
        check('editor applies scene and persists object',page.evaluate('railbound.world.editor.objects.length===1'))
        page.evaluate('railbound.togglePause(true)')
        # Build every world, while checking model and renderer resource lifecycle.
        for world in ['coast','nordic','canyon','sakura','highland','pine','metro','alpine']:
            page.evaluate('(id)=>railbound.loadWorld(id)',world)
            page.evaluate('railbound.togglePause(true)')
            check('construct world '+world,page.evaluate('(id)=>railbound.world.def.id===id && railbound.world.batches.length>100',world))
            if world=='metro':
                page.evaluate('railbound.env.hour=22;railbound.camera.setMode("chase")')
                render(page,'Railbound-Metropolis.png')
        page.evaluate('railbound.player.setStock(railbound.trains[1].stock);railbound.player.controls.doors=false;railbound.ui.update()')
        # Restore the original demonstration rolling stock via a valid saved project.
        normal=page.evaluate('railbound.projectSnapshot()');normal['player']['stock']='aurora';normal['player']['cars']=3;normal['player']['cylinders']=[.5]*4;normal['env']['weather']='clear';normal['env']['hour']=16.4;normal['cameraState']={'distance':90,'azimuth':-.87,'elevation':.28,'fov':56}
        page.evaluate('(data)=>railbound.importProject(data)',normal);page.evaluate('railbound.togglePause(true)')
        render(page,'Railbound-Desktop.png')
        page.evaluate('railbound.camera.setMode("cab")')
        render(page,'Railbound-Cab.png')
        for camera in ['chase','orbit','aerial','trackside','free']:
            page.evaluate('(mode)=>{railbound.camera.setMode(mode);railbound.camera.update(railbound.player,railbound.world,1/60,new Set());}',camera)
            check('camera '+camera+' finite',page.evaluate('railbound.camera.position.every(Number.isFinite)&&railbound.camera.target.every(Number.isFinite)'))
        page.set_viewport_size({'width':390,'height':844})
        page.evaluate('railbound.camera.setMode("chase");railbound.renderer.settings.quality="medium";railbound.ui.update()')
        check('mobile page has no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        check('mobile throttle and brake visible',page.locator('#throttle').is_visible() and page.locator('#brake').is_visible())
        page.locator('#throttle').fill('37');page.locator('#throttle').dispatch_event('input')
        check('mobile slider controls train',page.evaluate('Math.abs(railbound.player.controls.throttle-.37)<.001'))
        page.evaluate('railbound.player.controls.throttle=0;railbound.ui.update()')
        render(page,'Railbound-Mobile.png')
        page.evaluate('railbound.ui.openPanel("editor")')
        check('mobile world controls accessible',page.locator('#edit-seed').is_visible() and page.locator('#edit-wires').is_visible())
        page.locator('#close-dialog').click()
        page.set_viewport_size({'width':844,'height':390})
        page.evaluate('railbound.ui.update()')
        check('landscape page has no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        render(page,'Railbound-Mobile-Landscape.png')
        check('no browser JavaScript or console errors',not errors)
    except Exception as e:
        results.append({'test':'execution','passed':False,'error':str(e)})
        print('FAILED',e,'CAPTURED ERRORS:',errors,flush=True)
        print('STARTUP DIAGNOSTICS:',page.evaluate('({ready:globalThis.railbound?.ready,renderer:globalThis.railbound?.renderer.kind,fatal:document.getElementById(\"fatal-message\")?.textContent})'),flush=True)
        page.screenshot(path=str(ROOT.parent/'Railbound-Test-Failure.png'),timeout=120000)
        raise
    finally:
        (ROOT/'tests/browser-integration-report.json').write_text(json.dumps({'browser':'Chromium, ANGLE SwiftShader WebGL2','results':results,'errors':errors},indent=2))
        b.close()
