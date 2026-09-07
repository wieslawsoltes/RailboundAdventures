#!/usr/bin/env python3
"""Candidate-artifact browser tests. Software GPU runs do not benchmark hardware.

PAGE_URL must serve the built application under its eventual project subdirectory.
BACKEND=webgpu|webgl selects an independently validated renderer. On Linux use
xvfb-run for WebGPU presentation; GPU API validation remains enabled.
"""
from __future__ import annotations
import io
import json
import os
from pathlib import Path
import sys
from PIL import Image, ImageStat
from playwright.sync_api import sync_playwright

BASE = os.environ.get('PAGE_URL', 'http://127.0.0.1:8000/RailboundAdventures/').rstrip('/') + '/'
BACKEND = os.environ.get('BACKEND', 'webgpu')
if BACKEND not in ('webgpu', 'webgl'):
    raise ValueError('BACKEND must be webgpu or webgl')
OUT = Path('expedition-results') / BACKEND
OUT.mkdir(parents=True, exist_ok=True)
REPORT = {'url': BASE, 'backend': BACKEND, 'checks': [], 'errors': [], 'warnings': [], 'worlds': [], 'trains': []}


def check(name: str, value: bool, detail=None) -> None:
    REPORT['checks'].append({'name': name, 'passed': bool(value), 'detail': detail})
    print(('PASS ' if value else 'FAIL ') + name + (': ' + str(detail) if detail is not None else ''), flush=True)
    if not value:
        raise AssertionError(name)


def boot(page) -> None:
    page.wait_for_function('window.railbound?.ready || !document.getElementById("fatal").classList.contains("hidden")', timeout=120000)
    state = page.evaluate('''() => ({ready:railbound.ready, kind:railbound.renderer.kind,
        worker:railbound.world?.terrain?.execution, fatal:document.getElementById('fatal-message').textContent})''')
    check('game ready with requested backend', state['ready'] and state['kind'] == ('WebGPU' if BACKEND == 'webgpu' else 'WebGL 2'), state)
    check('terrain prepared by module worker', state['worker'] == 'worker', state)
    page.evaluate('''() => {const a=railbound;a.renderEnabled=false;a.paused=true;a.settings.adaptive=false;
        a.renderer.settings.resolution=.55;a.renderer.settings.quality='high';
        if(a.renderer.device)a.renderer.device.lost.then(info=>window.testDeviceLoss={reason:info.reason,message:info.message});}''')


def render(page, name: str) -> None:
    stats = page.evaluate('''async () => {
        const a=railbound,r=a.renderer;a.camera.initial=true;a.camera.update(a.player,a.world,1/60,new Set());
        const dynamic=a.rolling.update(a.trains,a.world,a.camera,0,a.simTime,a.camera.mode);
        if(r.device)r.device.pushErrorScope('validation');
        r.render([...a.world.batches,...dynamic],a.camera,a.world.def,a.env,a.player,a.simTime);
        let error=null;
        if(r.device){try{await r.device.queue.onSubmittedWorkDone();error=(await r.device.popErrorScope())?.message||null;}catch(e){error=e.message;}}
        else{const code=r.gl.getError();if(code)error='GL error '+code;}
        return {calls:r.drawCalls,triangles:r.triangles,lost:r.lost,error,deviceLoss:window.testDeviceLoss||null};
    }''')
    check(name + ' GPU commands validated', stats['calls'] > 10 and stats['triangles'] > 1000 and not stats['lost'] and not stats['error'] and not stats['deviceLoss'], stats)
    page.wait_for_timeout(150)
    png = page.locator('#viewport').screenshot(timeout=90000)
    deviation = max(ImageStat.Stat(Image.open(io.BytesIO(png)).convert('RGB')).stddev)
    check(name + ' visible canvas', deviation > 5, round(deviation, 2))
    page.screenshot(path=str(OUT / (name + '.png')), timeout=90000)


def viewpoint(page, index=0) -> None:
    page.evaluate('''index => {const a=railbound,v=a.world.viewpoints[index];
        a.camera.position=[...v.position];a.camera.target=[...v.target];a.camera.setMode('free');}''', index)


with sync_playwright() as p:
    args = ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-watchdog']
    if BACKEND == 'webgpu':
        args += ['--enable-unsafe-webgpu', '--use-webgpu-adapter=swiftshader', '--enable-gpu']
        if sys.platform.startswith('linux'):
            if not os.environ.get('DISPLAY'):
                raise RuntimeError('Use xvfb-run -a python tools/verify_expedition.py on Linux')
            args += ['--enable-features=Vulkan', '--use-vulkan=swiftshader']
    browser = p.chromium.launch(channel='chromium', headless=not bool(os.environ.get('DISPLAY')), args=args)
    REPORT['browser'] = browser.version
    context = browser.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=1, has_touch=True)
    if BACKEND == 'webgl':
        context.add_init_script("Object.defineProperty(Navigator.prototype,'gpu',{get:()=>undefined,configurable:true});")
    page = context.new_page()
    page.set_default_timeout(90000)
    page.on('pageerror', lambda error: REPORT['errors'].append(str(error)))
    page.on('console', lambda msg: REPORT['errors'].append(msg.text) if msg.type == 'error' else REPORT['warnings'].append(msg.text) if msg.type == 'warning' else None)
    try:
        response = page.goto(BASE, wait_until='domcontentloaded', timeout=90000)
        check('candidate artifact HTTP 200', response is not None and response.status == 200)
        check('secure browser context', page.evaluate('isSecureContext'))
        boot(page)
        render(page, 'alpine-driving')
        # The first departure still uses the UI command and fixed-step simulation.
        page.locator('#depart').click()
        motion = page.evaluate('''() => {railbound.paused=true;for(let i=0;i<60*35;i++)railbound.tick(1/60);
            return {speed:railbound.player.speed,odometer:railbound.player.cursor.odometer,derailed:railbound.player.derailed};}''')
        check('powered driving on the surveyed route', motion['speed'] > 3 and motion['odometer'] > 20 and not motion['derailed'], motion)
        page.locator('#emergency').click()
        page.evaluate('for(let i=0;i<60*50;i++)railbound.tick(1/60)')
        check('emergency brake still stops consist', page.evaluate('Math.abs(railbound.player.speed)<.05'))
        page.evaluate('railbound.recover();railbound.paused=true')
        for panel in ['fleet','map','environment','dispatch','editor','settings','systems','missions','help','worlds']:
            page.evaluate('(name)=>railbound.ui.openPanel(name)', panel)
            check(panel + ' panel opens', page.locator('#panel-dialog').is_visible() and len(page.locator('#panel-content').inner_text()) > 80)
            if panel == 'worlds':
                check('eight numerical geography previews', page.locator('[data-preview]').count() == 8)
                page.screenshot(path=str(OUT / 'expedition-browser.png'))
            page.locator('#close-dialog').click()
        # Real UI generation input, not a direct state-only assertion.
        original = page.evaluate('railbound.world.network.totalLength')
        page.evaluate("railbound.ui.openPanel('worlds')")
        page.locator('#generation-seed').fill('720251')
        page.locator('#generation-relief').fill('125')
        page.locator('#generation-relief').dispatch_event('input')
        page.locator('[data-world="alpine"]').click()
        page.wait_for_function('!railbound.loadingWorld && railbound.world.seed===720251', timeout=120000)
        check('seed and relief controls rebuild actual geometry', page.evaluate('railbound.world.editor.generation.relief===1.25 && railbound.world.terrain.execution==="worker"') and abs(page.evaluate('railbound.world.network.totalLength') - original) > 50)
        saved = page.evaluate('railbound.projectSnapshot()')
        page.evaluate('(value)=>railbound.importProject(value)', saved)
        check('new generation settings restore', page.evaluate('railbound.world.seed===720251 && railbound.world.editor.generationVersion===3'))
        # Every regional generator must produce and render a distinct scene.
        signatures = set()
        for region in ['alpine','coast','nordic','canyon','sakura','highland','pine','metro']:
            page.evaluate('(id)=>railbound.loadWorld(id)', region)
            page.evaluate('railbound.paused=true;railbound.renderEnabled=false')
            stats = page.evaluate('''() => {const w=railbound.world;return {id:w.def.id,seed:w.seed,length:w.network.totalLength,
                worker:w.terrain.execution,features:w.features,terrain:w.terrain.stats,batches:w.batches.length,
                signature:Array.from(w.terrain.heights.filter((_,i)=>i%503===0)).join(',')};}''')
            signatures.add(stats.pop('signature'))
            REPORT['worlds'].append(stats)
            check(region + ' generated field and ecological scene', stats['worker'] == 'worker' and stats['features']['trees'] > 0 and stats['features']['terrainTiles'] > 200 and stats['length'] > 12000)
            viewpoint(page, 1)
            render(page, region + '-watershed')
            if region in ('coast','canyon','sakura','highland','metro'):
                viewpoint(page, 0)
                render(page, region + '-landmark')
        check('all eight worlds have different heightfields', len(signatures) == 8)
        # Test the assemblies in normal driving frames; close camera reveals fine tier.
        page.evaluate("railbound.loadWorld('alpine')")
        page.evaluate('railbound.paused=true;railbound.renderEnabled=false')
        for stock in ['aurora','velocity','atlas','heritage','metro','ranger']:
            page.evaluate('''async id => {const {STOCK}=await import('./src/data.js');const a=railbound;
                const stock=STOCK.find(s=>s.id===id);if(!stock)throw Error('Unknown test stock '+id);
                a.player.setStock(stock);a.player.setCars(2);const p=a.player.cursor.pose(),f=p.f,r=p.right;
                a.camera.position=[p.p[0]+f[0]*26-r[0]*19,p.p[1]+8,p.p[2]+f[2]*26-r[2]*19];
                a.camera.target=[p.p[0],p.p[1]+2.7,p.p[2]];a.camera.setMode('free');}''', stock)
            render(page, 'train-' + stock)
            stats = page.evaluate('Object.values(railbound.rolling.detailCounts).filter(s=>s.parts>200)')
            REPORT['trains'].append({'id': stock, 'assemblies': stats})
            check(stock + ' detailed assemblies available', len(stats) > 0)
        page.evaluate("railbound.camera.setMode('cab')")
        render(page, 'cab-detail')
        page.set_viewport_size({'width': 390, 'height': 844})
        page.evaluate("railbound.camera.setMode('chase');railbound.ui.update();railbound.ui.openPanel('worlds')")
        check('mobile generation controls do not overflow', page.evaluate("document.getElementById('panel-content').scrollWidth<=document.getElementById('panel-content').clientWidth+2"))
        page.screenshot(path=str(OUT / 'mobile-expeditions.png'))
        page.locator('#close-dialog').click()
        check('portrait viewport does not overflow', page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        page.locator('#throttle').fill('37');page.locator('#throttle').dispatch_event('input')
        check('touch throttle still controls traction', page.evaluate('Math.abs(railbound.player.controls.throttle-.37)<.001'))
        render(page, 'mobile-portrait')
        page.set_viewport_size({'width': 844, 'height': 390})
        page.evaluate('railbound.ui.update()')
        check('landscape viewport does not overflow', page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        render(page, 'mobile-landscape')
        page.wait_for_function('navigator.serviceWorker.controller!==null', timeout=60000)
        check('service worker has the project scope', page.evaluate('(async()=> (await navigator.serviceWorker.ready).scope)()') == BASE)
        check('no online JavaScript or GPU errors', not REPORT['errors'], REPORT['errors'][:10])
        context.set_offline(True)
        page.reload(wait_until='domcontentloaded', timeout=90000)
        boot(page)
        render(page, 'offline-worker-startup')
        check('no offline JavaScript or GPU errors', not REPORT['errors'], REPORT['errors'][:10])
    except Exception as error:
        REPORT['failure'] = str(error)
        print('FAILURE', str(error), flush=True)
        print('BROWSER ERRORS', json.dumps(REPORT['errors']), flush=True)
        try:
            page.screenshot(path=str(OUT / 'failure.png'), timeout=20000)
        except Exception:
            pass
        raise
    finally:
        (OUT / 'report.json').write_text(json.dumps(REPORT, indent=2))
        print(json.dumps({'backend': BACKEND, 'passed': sum(c['passed'] for c in REPORT['checks']), 'failed': sum(not c['passed'] for c in REPORT['checks']), 'failure': REPORT.get('failure')}), flush=True)
        context.close();browser.close()
