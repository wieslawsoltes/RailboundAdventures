"""Verify and restore original source, then instrument CI startup failures."""
from pathlib import Path, PurePosixPath
import hashlib
import io
import tarfile

parts = sorted(Path('.bootstrap').glob('part-*.xzpart'))
assert len(parts) == 10, 'Expected ten source archive chunks'
data = b''.join(p.read_bytes() for p in parts)
expected = '4aa677419465b51fd91403e7c21e1ff9f20f6d9efad9c1bf15f25e1d79d86e11'
assert hashlib.sha256(data).hexdigest() == expected, 'Source archive checksum mismatch'
with tarfile.open(fileobj=io.BytesIO(data), mode='r:xz') as archive:
    for member in archive.getmembers():
        path = PurePosixPath(member.name)
        assert not path.is_absolute() and '..' not in path.parts
        assert path.parts and path.parts[0] not in ('.git', '.github', '.bootstrap')
        assert member.isfile() or member.isdir(), 'Only regular files and directories are permitted'
    archive.extractall('.', filter='data')
print('Verified source archive:', expected, flush=True)

test = Path('tools/integration_browser.py')
source = test.read_text()
replacements = [
    ("executable_path=os.environ.get('CHROMIUM_EXECUTABLE')", "executable_path=os.environ.get('CHROMIUM_EXECUTABLE') or p.chromium.executable_path"),
    ("page.on('pageerror',lambda e: errors.append(str(e)))", "page.on('pageerror',lambda e: (errors.append(str(e)),print('PAGE ERROR:',str(e),flush=True)))"),
    ("page.on('console',lambda m: errors.append(m.text) if m.type=='error' else None)", "page.on('console',lambda m: (errors.append(m.text),print('CONSOLE ERROR:',m.text,flush=True)) if m.type=='error' else None)"),
    ("page.wait_for_function('railbound?.ready',timeout=90000)", "page.wait_for_function('globalThis.railbound?.ready || document.getElementById(\\\"fatal-message\\\")?.textContent',timeout=90000)\n        startup=page.evaluate('({ready:globalThis.railbound?.ready,renderer:globalThis.railbound?.renderer.kind,fatal:document.getElementById(\\\"fatal-message\\\")?.textContent,secure:isSecureContext,gpu:!!navigator.gpu})')\n        print('STARTUP:',startup,flush=True)\n        if not startup.get('ready'): raise RuntimeError(startup)"),
    ("print('FAILED',e,flush=True)", "print('FAILED',e,'CAPTURED ERRORS:',errors,flush=True)\n        print('STARTUP DIAGNOSTICS:',page.evaluate('({ready:globalThis.railbound?.ready,renderer:globalThis.railbound?.renderer.kind,fatal:document.getElementById(\\\"fatal-message\\\")?.textContent})'),flush=True)"),
]
for old,new in replacements:
    assert old in source, 'Missing patch target: '+old
    source=source.replace(old,new)
test.write_text(source)
