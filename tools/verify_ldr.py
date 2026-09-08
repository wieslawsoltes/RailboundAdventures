#!/usr/bin/env python3
"""Exercise the no-float compatibility path independently of the long scene tour."""
import io
import json
import os
from pathlib import Path
from PIL import Image, ImageStat
from playwright.sync_api import sync_playwright

out = Path('ldr-results')
out.mkdir(exist_ok=True)
report = {'checks': [], 'errors': []}
def check(name, ok, detail=None):
    report['checks'].append({'name': name, 'passed': bool(ok), 'detail': detail})
    print(('PASS ' if ok else 'FAIL ') + name, flush=True)
    if not ok:
        raise AssertionError(name + ': ' + str(detail))

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chromium', headless=not bool(os.environ.get('DISPLAY')),
        args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-gpu-watchdog'])
    context = browser.new_context(viewport={'width':900,'height':600})
    context.set_default_timeout(120000)
    context.add_init_script("""Object.defineProperty(Navigator.prototype,'gpu',{get:()=>undefined});
        const original=WebGL2RenderingContext.prototype.getExtension;
        WebGL2RenderingContext.prototype.getExtension=function(name){
            return name==='EXT_color_buffer_float'?null:original.call(this,name);
        };""")
    page = context.new_page()
    page.on('pageerror', lambda e: report['errors'].append(str(e)))
    page.on('console', lambda m: report['errors'].append(m.text) if m.type=='error' else None)
    try:
        response=page.goto(os.environ.get('PAGE_URL','http://127.0.0.1:8000/'),wait_until='domcontentloaded')
        check('HTTP 200',response.status==200)
        page.wait_for_function('window.railbound?.ready',timeout=120000,polling=100)
        page.evaluate('railbound.renderEnabled=false;railbound.paused=true')
        page.wait_for_function('document.getElementById("loading").classList.contains("hidden")',timeout=120000,polling=100)
        check('loading overlay dismissed',True)
        state=page.evaluate('''() => {const a=railbound,r=a.renderer,g=r.gl;
            a.settings.resolution=.65;a.settings.adaptive=false;a.applySettings();
            a.camera.update(a.player,a.world,1/60,new Set());
            const b=a.rolling.update(a.trains,a.world,a.camera,0,a.simTime,a.camera.mode);
            r.render([...a.world.batches,...b],a.camera,a.world.def,a.env,a.player,a.simTime);
            g.finish();return {kind:r.kind,hdr:r.post.hdr,passes:r.post.passCount,
                error:g.getError(),lost:g.isContextLost(),calls:r.drawCalls,
                materialState:r.materials?.status};}''')
        check('WebGL LDR framebuffer executes',state['kind']=='WebGL 2' and not state['hdr'] and not state['lost'] and state['error']==0,state)
        check('display compatibility omits bloom',state['passes']==1,state)
        check('scene geometry submitted',state['calls']>10,state)
        png=page.locator('#viewport').screenshot(timeout=120000)
        (out/'ldr.png').write_bytes(png)
        deviation=ImageStat.Stat(Image.open(io.BytesIO(png)).convert('RGB')).stddev
        check('presented scene is not blank',max(deviation)>5,deviation)
        check('no console or JavaScript errors',not report['errors'],report['errors'])
    except Exception as e:
        report['failure']=str(e)
        raise
    finally:
        (out/'report.json').write_text(json.dumps(report,indent=2))
        context.close()
        browser.close()
