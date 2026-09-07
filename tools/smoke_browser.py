from playwright.sync_api import sync_playwright
from pathlib import Path
import json,time,os
os.environ['DISPLAY']=':99'
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/lib/chromium/chromium',headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':1440,'height':900},device_scale_factor=1)
    messages=[]
    page.on('console',lambda m: (messages.append({'type':m.type,'text':m.text}),print('console',m.type,m.text[:250],flush=True)))
    page.on('pageerror',lambda e: (messages.append({'type':'pageerror','text':str(e)}),print('PAGEERROR',e,flush=True)))
    t=time.time()
    page.set_content((root/'dist/index.html').read_text(),wait_until='domcontentloaded',timeout=120000)
    try:
        page.wait_for_function('window.railbound?.ready || !document.getElementById("fatal").classList.contains("hidden")',timeout=180000)
        print('INIT',time.time()-t,page.evaluate('({ready:railbound.ready,backend:railbound.renderer.kind,fatal:document.getElementById("fatal-message").textContent, features:railbound.world?.features, batches:railbound.world?.batches.length})'),flush=True)
        page.wait_for_timeout(1500)
        page.screenshot(path=str(root.parent/'Railbound-Desktop.png'),timeout=120000)
        print('STATE',page.evaluate('({fps:railbound.fps,drawCalls:railbound.renderer.drawCalls,triangles:railbound.renderer.triangles,cam:railbound.camera.position,pose:railbound.player?.cursor.pose().p})'),flush=True)
        page.evaluate('railbound.togglePause(true)')
    finally:
        (root/'tests/browser-smoke-log.json').write_text(json.dumps(messages,indent=2))
        browser.close()
