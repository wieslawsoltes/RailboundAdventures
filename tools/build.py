#!/usr/bin/env python3
"""Dependency-free bundler for this project's explicit, named ES-module imports.
Modules retain lexical isolation. The bundle is deliberately readable and auditable.
"""
from pathlib import Path
import re, json, base64
ROOT = Path(__file__).resolve().parents[1]
IMPORT = re.compile(r"import\s*\{([^}]+)\}\s*from\s*['\"]([^'\"]+)['\"]\s*;")
EXPORT = re.compile(r'\bexport\s+(?:async\s+)?(?:class|function|const|let|var)\s+(\w+)')

def bundle(entry='src/main.js'):
    seen, output = set(), []
    def visit(path):
        path = path.resolve()
        key = '__m_' + re.sub(r'\W', '_', str(path.relative_to(ROOT)))
        if path in seen:
            return key
        seen.add(path)
        text = path.read_text()
        imports = []
        for m in IMPORT.finditer(text):
            dep = visit(path.parent / m.group(2))
            names = re.sub(r'\bas\b', ':', m.group(1))
            imports.append(f'const {{{names}}} = {dep};')
        names = EXPORT.findall(text)
        text = IMPORT.sub('', text)
        text = re.sub(r'\bexport\s+(?=(?:async\s+)?(?:class|function|const|let|var)\b)', '', text)
        output.append(f'// ---- {path.relative_to(ROOT)} ----\nconst {key} = (() => {{\n' + '\n'.join(imports) + '\n' + text + '\nreturn {' + ','.join(names) + '};\n})();')
        return key
    visit(ROOT / entry)
    return "'use strict';\n" + '\n'.join(output)

def embedded_materials():
    directory = ROOT / 'assets/materials'
    manifest = json.loads((directory / 'manifest.json').read_text())
    data = {'manifest': manifest}
    for layer in manifest['layers']:
        for kind in ('albedo', 'surface'):
            name = layer[kind]
            if not re.fullmatch(r'[A-Za-z0-9-]+\.(jpg|png)', name):
                raise ValueError('Invalid material path')
            raw = (directory / name).read_bytes()
            import hashlib
            if hashlib.sha256(raw).hexdigest() != layer['sha256'][kind]:
                raise ValueError('Material checksum mismatch: ' + name)
            mime = 'image/jpeg' if name.endswith('.jpg') else 'image/png'
            data[name] = 'data:' + mime + ';base64,' + base64.b64encode(raw).decode('ascii')
    return 'globalThis.RAILBOUND_MATERIAL_ASSETS=' + json.dumps(data, separators=(',', ':')).replace('<', '\\u003c') + ';\n'

if __name__ == '__main__':
    script = bundle()
    html = (ROOT / 'index.html').read_text()
    css = (ROOT / 'styles/app.css').read_text()
    html = re.sub(r'<link[^>]+href="styles/app.css"[^>]*>', lambda _: '<style>' + css + '</style>', html)
    html = re.sub(r'<link[^>]+rel="manifest"[^>]*>', '', html)
    icon = ROOT / 'assets/icon.svg'
    if icon.exists():
        html = html.replace('assets/icon.svg', 'data:image/svg+xml;base64,' + base64.b64encode(icon.read_bytes()).decode())
    html = html.replace('<script type="module" src="src/main.js"></script>', '<script>globalThis.RAILBOUND_STANDALONE=true;\n' + embedded_materials() + script.replace('</script', '<\\/script') + '\n</script>')
    out = ROOT.parent / 'Railbound-Adventures.html'
    out.write_text(html)
    (ROOT / 'dist').mkdir(exist_ok=True)
    (ROOT / 'dist/index.html').write_text(html)
    (ROOT / 'dist/app.bundle.js').write_text(script)
    print(f'Built {out} ({out.stat().st_size:,} bytes)')
