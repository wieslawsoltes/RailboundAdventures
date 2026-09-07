#!/usr/bin/env python3
"""Test the published ES-module game using Chromium's actual renderers.

PAGE_URL selects the deployment; BACKEND is webgpu or webgl. On Linux, run
under xvfb-run so WebGPU canvas presentation reaches a real compositor.
SwiftShader validates API/shader correctness, not hardware performance.
"""
import io
import json
import os
import sys
from pathlib import Path

from PIL import Image, ImageStat
from playwright.sync_api import sync_playwright

BASE = os.environ.get('PAGE_URL', 'https://wieslawsoltes.github.io/RailboundAdventures/').rstrip('/') + '/'
BACKEND = os.environ.get('BACKEND', 'webgpu')
if BACKEND not in ('webgpu', 'webgl'):
    raise ValueError('BACKEND must be webgpu or webgl')
OUT = Path('browser-results') / BACKEND
OUT.mkdir(parents=True, exist_ok=True)
report = {'url': BASE, 'backend': BACKEND, 'checks': [], 'errors': [], 'warnings': []}
os.environ.setdefault('DEBUG', 'pw:browser')


def check(name, value, detail=None):
    entry = {'name': name, 'passed': bool(value)}
    if detail is not None:
        entry['detail'] = detail
    report['checks'].append(entry)
    print(('PASS ' if value else 'FAIL ') + name + (': ' + str(detail) if detail is not None else ''), flush=True)
    if not value:
        raise AssertionError(name + ': ' + str(detail))


def boot(page):
    page.wait_for_function('window.railbound?.ready || !document.getElementById("fatal").classList.contains("hidden")', timeout=120000)
    state = page.evaluate('''() => ({ready: railbound.ready, backend: railbound.renderer.kind,
        adapter: railbound.renderer.adapterInfo, error: railbound.renderer.lastError,
        fatal: document.getElementById('fatal-message').textContent})''')
    check('game startup', state['ready'], state)
    check('requested renderer active', state['backend'] == ('WebGPU' if BACKEND == 'webgpu' else 'WebGL 2'), state)
    page.evaluate('''() => { const a = railbound; a.renderEnabled = false; a.paused = true;
        a.renderer.settings.resolution = .5; a.settings.adaptive = false;
        if (a.renderer.device) a.renderer.device.lost.then(info => {
            window.testDeviceLoss = {reason: info.reason, message: info.message};
        }); }''')


def render(page, name):
    result = page.evaluate('''async () => {
        const a = railbound, r = a.renderer;
        a.camera.initial = true; a.camera.update(a.player, a.world, 1/60, new Set());
        const dynamic = a.rolling.update(a.trains, a.world, a.camera, 0, a.simTime, a.camera.mode);
        if (r.device) r.device.pushErrorScope('validation');
        r.render([...a.world.batches, ...dynamic], a.camera, a.world.def, a.env, a.player, a.simTime);
        let error = null;
        if (r.device) {
            try { await r.device.queue.onSubmittedWorkDone(); }
            catch (failure) { error = failure.message; }
            try { error = (await r.device.popErrorScope())?.message || error; }
            catch (failure) { error = error || failure.message; }
        } else { const code = r.gl.getError(); if (code) error = 'WebGL error ' + code; }
        return {calls:r.drawCalls, triangles:r.triangles, lost:r.lost,
            deviceLoss: window.testDeviceLoss || null, error};
    }''')
    check(name + ' GPU submission', result['calls'] > 10 and result['triangles'] > 1000 and not result['lost'] and not result['error'], result)
    page.wait_for_timeout(400)
    png = page.locator('#viewport').screenshot(timeout=60000)
    image = Image.open(io.BytesIO(png)).convert('RGB')
    deviation = max(ImageStat.Stat(image).stddev)
    check(name + ' nonblank canvas', deviation > 5, round(deviation, 2))
    page.screenshot(path=str(OUT / (name + '.png')), timeout=60000)


with sync_playwright() as p:
    # Software frames can exceed hardware watchdog deadlines. Disable that
    # deadline only for this test process; never disable API validation.
    args = ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
            '--disable-gpu-watchdog', '--enable-logging=stderr']
    if BACKEND == 'webgpu':
        args += ['--enable-unsafe-webgpu', '--use-webgpu-adapter=swiftshader', '--enable-gpu']
        if sys.platform.startswith('linux'):
            if not os.environ.get('DISPLAY'):
                raise RuntimeError('Linux WebGPU canvas verification requires xvfb-run -a python tools/verify_browser.py')
            args += ['--enable-features=Vulkan', '--use-vulkan=swiftshader']
    browser = p.chromium.launch(channel='chromium', headless=not bool(os.environ.get('DISPLAY')), args=args)
    report['browser'] = browser.version
    context = browser.new_context(viewport={'width': 1280, 'height': 800}, device_scale_factor=1, has_touch=True)
    if BACKEND == 'webgl':
        context.add_init_script("Object.defineProperty(Navigator.prototype, 'gpu', {get: () => undefined, configurable: true});")
    page = context.new_page()
    page.set_default_timeout(60000)
    page.on('pageerror', lambda error: report['errors'].append(str(error)))
    page.on('console', lambda msg: report['errors'].append(msg.text) if msg.type == 'error' else report['warnings'].append(msg.text) if msg.type == 'warning' else None)
    try:
        response = page.goto(BASE, wait_until='domcontentloaded', timeout=90000)
        check('public page HTTP 200', response is not None and response.status == 200)
        check('secure origin', page.evaluate('isSecureContext'))
        boot(page)
        render(page, 'desktop')
        check('no renderer startup errors', not report['errors'], report['errors'][:5])
        for panel in ['worlds', 'fleet', 'map', 'environment', 'dispatch', 'editor', 'settings', 'systems', 'missions', 'help']:
            page.evaluate('(name) => railbound.ui.openPanel(name)', panel)
            check('panel ' + panel, page.locator('#panel-dialog').is_visible() and len(page.locator('#panel-content').inner_text()) > 80)
            page.locator('#close-dialog').click()
        page.locator('#depart').click()
        motion = page.evaluate('''() => { railbound.paused = true;
            for (let i=0;i<60*35;i++) railbound.tick(1/60);
            return {speed:railbound.player.speed, distance:railbound.player.cursor.odometer}; }''')
        check('powered motion', motion['speed'] > 3 and motion['distance'] > 20, motion)
        page.locator('#emergency').click()
        page.evaluate('for(let i=0;i<60*50;i++)railbound.tick(1/60)')
        check('emergency stop', page.evaluate('Math.abs(railbound.player.speed)<.05'))
        page.evaluate('railbound.recover();railbound.togglePause(true)')
        saved = page.evaluate('railbound.projectSnapshot()')
        page.evaluate('(value) => railbound.importProject(value)', saved)
        page.evaluate('railbound.paused=true')
        check('project restoration', page.evaluate('railbound.player.stock.id') == saved['player']['stock'])
        for world in ['coast', 'nordic', 'canyon', 'sakura', 'highland', 'pine', 'metro', 'alpine']:
            page.evaluate('(id) => railbound.loadWorld(id)', world)
            page.evaluate('railbound.paused=true')
            render(page, world)
        page.set_viewport_size({'width':390, 'height':844})
        page.evaluate('railbound.ui.update()')
        check('portrait has no horizontal overflow', page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        check('touch controls visible', page.locator('#throttle').is_visible() and page.locator('#brake').is_visible())
        page.locator('#throttle').fill('37')
        page.locator('#throttle').dispatch_event('input')
        check('touch throttle changes train control', page.evaluate('Math.abs(railbound.player.controls.throttle-.37)<.001'))
        render(page, 'mobile-portrait')
        page.set_viewport_size({'width':844, 'height':390})
        page.evaluate('railbound.ui.update()')
        check('landscape has no horizontal overflow', page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        render(page, 'mobile-landscape')
        page.wait_for_function('navigator.serviceWorker.controller !== null', timeout=60000)
        shell = page.evaluate('''async () => { const r=await navigator.serviceWorker.ready;
            return {scope:r.scope, controlled:!!navigator.serviceWorker.controller}; }''')
        check('service worker scoped to game', shell['controlled'] and shell['scope'] == BASE, shell)
        check('no online JavaScript or GPU errors', not report['errors'], report['errors'][:10])
        context.set_offline(True)
        page.reload(wait_until='domcontentloaded', timeout=60000)
        boot(page)
        render(page, 'offline')
        check('no offline JavaScript or GPU errors', not report['errors'], report['errors'][:10])
    except Exception as error:
        report['failure'] = str(error)
        print('FAILURE', str(error), flush=True)
        print('BROWSER ERRORS', json.dumps(report['errors']), flush=True)
        print('BROWSER WARNINGS', json.dumps(report['warnings'][:10]), flush=True)
        try:
            report['diagnostics'] = page.evaluate('''() => ({deviceLoss:window.testDeviceLoss,
                lost:window.railbound?.renderer.lost, adapter:window.railbound?.renderer.adapterInfo})''')
            print('GPU DIAGNOSTICS', json.dumps(report['diagnostics']), flush=True)
            page.screenshot(path=str(OUT / 'failure.png'), timeout=20000)
        except Exception:
            pass
        raise
    finally:
        (OUT / 'report.json').write_text(json.dumps(report, indent=2))
        print(json.dumps({'backend':BACKEND, 'passed':sum(c['passed'] for c in report['checks']), 'failed':sum(not c['passed'] for c in report['checks']), 'errors':report['errors'], 'failure':report.get('failure')}), flush=True)
        context.close()
        browser.close()
