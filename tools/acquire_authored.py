#!/usr/bin/env python3
"""Acquire a bounded, curated CC0 source selection via Poly Haven's public API.
Normal game builds use checked-in assets and do not execute this acquisition step.
"""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
from urllib.request import Request, urlopen
from urllib.parse import urljoin, urlparse
ASSETS=('rock_moss_set_01','tree_stump_02','fern_02','pine_tree_01')
HOSTS={'api.polyhaven.com','dl.polyhaven.org','cdn.polyhaven.com'}
HEADERS={'User-Agent':'RailboundAdventures-AuthoredAssets/1.0','Referer':'https://github.com/wieslawsoltes/RailboundAdventures'}

def acquire(root,expected=None):
    root.mkdir(parents=True,exist_ok=True);records=[];total=0
    expected_hashes={r['url']:r['sha256'] for r in (expected or {}).get('provenance',{}).get('files',[])}
    def get(url,limit=80_000_000,record=None):
        nonlocal total
        parsed=urlparse(url)
        if parsed.scheme!='https' or parsed.hostname not in HOSTS:raise ValueError('Asset URL is not allowed')
        with urlopen(Request(url,headers=HEADERS),timeout=90) as response:
            if urlparse(response.url).hostname not in HOSTS:raise ValueError('Unexpected redirect')
            data=response.read(limit+1)
        total+=len(data)
        if len(data)>limit or total>200_000_000:raise ValueError('Acquisition exceeds source budget')
        if record and record.get('md5') and hashlib.md5(data).hexdigest()!=record['md5']:raise ValueError('Source checksum mismatch')
        digest=hashlib.sha256(data).hexdigest()
        if url in expected_hashes and expected_hashes[url]!=digest:raise ValueError('Source revision changed: '+url)
        records.append({'url':url,'bytes':len(data),'sha256':digest});return data
    for asset in ASSETS[:3]:
        d=root/asset;d.mkdir(exist_ok=True)
        meta=json.loads(get('https://api.polyhaven.com/files/'+asset,2_000_000));(d/'files.json').write_text(json.dumps(meta,indent=2))
        descriptor=meta['gltf']['1k']['gltf'];raw=get(descriptor['url'],2_000_000,descriptor);(d/(asset+'.gltf')).write_bytes(raw);model=json.loads(raw);include=descriptor.get('include',{})
        for uri in dict.fromkeys(x['uri'] for x in model.get('buffers',[])+model.get('images',[]) if 'uri' in x):
            path=PurePosixPath(uri)
            if path.is_absolute() or '..' in path.parts:raise ValueError('Escaping source URI')
            record=include.get(uri) or next((v for k,v in include.items() if k.endswith('/'+uri) or PurePosixPath(k).name==path.name),None)
            target=d/path;target.parent.mkdir(parents=True,exist_ok=True)
            target.write_bytes(get(record['url'] if record else urljoin(descriptor['url'],uri),record=record))
    asset=ASSETS[3];d=root/asset;d.mkdir(exist_ok=True);meta=json.loads(get('https://api.polyhaven.com/files/'+asset,2_000_000));(d/'files.json').write_text(json.dumps(meta,indent=2))
    for name in ['twig_diff','twig_alpha','twig_nor_gl','twig_arm']:
        variants=meta[name]['1k'];kind='png' if 'png' in variants else 'jpg';record=variants[kind];(d/(name+'.'+kind)).write_bytes(get(record['url'],12_000_000,record))
    extra=root/'extras';extra.mkdir(exist_ok=True);meta=json.loads((root/'fern_02/files.json').read_text());record=meta['Alpha']['1k']['png'];raw=get(record['url'],12_000_000,record);(extra/'fern-alpha.png').write_bytes(raw);(extra/'fern-alpha-source.json').write_text(json.dumps({'url':record['url'],'sha256':hashlib.sha256(raw).hexdigest()}))
    for asset in ASSETS:(extra/(asset+'-info.json')).write_bytes(get('https://api.polyhaven.com/info/'+asset,2_000_000))
    (root/'provenance.json').write_text(json.dumps({'license':'CC0-1.0','licenseURL':'https://polyhaven.com/license','source':'Poly Haven','files':records},indent=2))
    print('Acquired',total,'bytes with',len(records),'recorded hashes')
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('directory',type=Path);parser.add_argument('--expected',type=Path);args=parser.parse_args();acquire(args.directory,json.loads(args.expected.read_text()) if args.expected else None)
