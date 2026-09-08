#!/usr/bin/env python3
"""Explicit asset acquisition, never run by the normal/offline build.

Download selected ambientCG CC0 1K source packages; retain 512px base color
and linear normal-X/normal-Y/roughness/AO maps. Record original and derived
SHA-256 hashes. No executable/archive paths from a remote ZIP are extracted.
Requires Pillow. Original licenses: https://docs.ambientcg.com/license/
"""
from pathlib import Path
import hashlib
import io
import json
import time
import urllib.request
import zipfile
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/materials'
SOURCES = [('Ground037', 2.1), ('Ground048', 1.4), ('Rock030', 3.0),
           ('Asphalt012', 3.0), ('PavingStones036', 2.0), ('Bark006', 1.0),
           ('Gravel023', 1.5), ('Concrete034', 1.1)]


def download(url):
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'RailboundAdventures/3.3 CC0 asset preparation'})
            with urllib.request.urlopen(req, timeout=120) as response:
                data = response.read(40_000_001)
                if len(data) > 40_000_000:
                    raise ValueError('Source package exceeds download budget')
                return data
        except Exception:
            if attempt == 3:
                raise
            time.sleep(3 * (attempt + 1))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {'version': 1, 'size': 512, 'license': 'CC0-1.0',
                'licenseURL': 'https://docs.ambientcg.com/license/',
                'surfaceChannels': 'R=normalX,G=normalY(OpenGL),B=roughness,A=occlusion', 'layers': []}
    for asset, meters in SOURCES:
        url = 'https://ambientcg.com/get?file=' + asset + '_1K-JPG.zip'
        raw = download(url)
        archive = zipfile.ZipFile(io.BytesIO(raw))
        names = archive.namelist()
        def image(kind, required=True):
            matching = [n for n in names if n.endswith('_' + kind + '.jpg')]
            if not matching:
                if required:
                    raise ValueError(asset + ': missing ' + kind)
                return Image.new('RGB', (512, 512), (255, 255, 255))
            info = archive.getinfo(matching[0])
            if info.file_size > 20_000_000:
                raise ValueError('Map exceeds decode budget')
            with Image.open(io.BytesIO(archive.read(matching[0]))) as source:
                if source.width > 2048 or source.height > 2048:
                    raise ValueError('Unexpected texture dimensions')
                return source.convert('RGB').resize((512, 512), Image.Resampling.LANCZOS)
        albedo = image('Color')
        normal = image('NormalGL')
        rough = image('Roughness').convert('L')
        ao = image('AmbientOcclusion', required=False).convert('L')
        surface = Image.merge('RGBA', (*normal.split()[:2], rough, ao))
        files = {'albedo': asset + '-albedo.jpg', 'surface': asset + '-surface.png'}
        albedo.save(OUT / files['albedo'], quality=92, subsampling=0, optimize=True)
        surface.save(OUT / files['surface'], optimize=True)
        manifest['layers'].append({'id': asset, 'meters': meters,
            'source': 'https://ambientcg.com/a/' + asset, 'download': url,
            'sourceSHA256': hashlib.sha256(raw).hexdigest(), **files,
            'sha256': {k: hashlib.sha256((OUT / v).read_bytes()).hexdigest() for k, v in files.items()}})
        print(asset, sum((OUT / f).stat().st_size for f in files.values()), flush=True)
    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    (OUT / 'LICENSE.txt').write_text('Selected materials by ambientCG / Lennart Demes.\nCreative Commons CC0 1.0 Universal.\nhttps://docs.ambientcg.com/license/\nhttps://creativecommons.org/publicdomain/zero/1.0/\n\nSee manifest.json for original asset pages, source package hashes and derived map hashes.\nGround037, Ground048 and PavingStones036 are surface photogrammetry.\nOther selected materials are procedural or approximated; this pack is not entirely photoscanned.\nNormalGL maps are packed without color transfer; base color retains sRGB encoding.\nTile sizes without published dimensions are artistic scale choices, not survey measurements.\n')


if __name__ == '__main__':
    main()
