#!/usr/bin/env python3
"""Convert a curated Poly Haven CC0 glTF source snapshot into runtime data.
Run: python tools/prepare_authored.py SOURCE_DIRECTORY WORK_DIRECTORY
Then: node tools/simplify_authored.mjs WORK_DIRECTORY MESHOPTIMIZER_DIRECTORY
Finally: python tools/prepare_authored.py --pack WORK_DIRECTORY assets/authored
The runtime never downloads assets from a third party. No Blender/runtime glTF dependency.
"""
import argparse, hashlib, json, struct
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

ASSETS = ['rock_moss_set_01','tree_stump_02','fern_02','pine_tree_01']
SIZE = 512

def sha(data): return hashlib.sha256(data).hexdigest()
def read_accessor(doc, buffers, index):
    a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']]
    if 'sparse' in a or a.get('normalized',False):raise ValueError('Unsupported sparse/normalized accessor')
    types={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}
    widths={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}
    dt=np.dtype(types[a['componentType']]);width=widths[a['type']];count=a['count']
    stride=v.get('byteStride',dt.itemsize*width);vo=v.get('byteOffset',0);ao=a.get('byteOffset',0)
    buffer=buffers[v['buffer']]
    if not isinstance(count,int) or count<1 or count>2_000_000:raise ValueError('Accessor count outside budget')
    if min(vo,ao)<0 or stride<dt.itemsize*width or stride%dt.itemsize or ao%dt.itemsize:raise ValueError('Accessor alignment')
    end=ao+(count-1)*stride+dt.itemsize*width
    if end>v['byteLength'] or vo+v['byteLength']>len(buffer):raise ValueError('Accessor exceeds buffer view')
    return np.ndarray((count,width),dtype=dt,buffer=buffer,offset=vo+ao,
        strides=(stride,dt.itemsize)).copy()

def source_path(root,uri):
    p=(root/uri).resolve();assert p.is_relative_to(root.resolve());return p

def image_at(root,doc,texture):
    image=doc['images'][doc['textures'][texture['index']]['source']]
    return Image.open(source_path(root,image['uri']))

def transform_node(n):
    if 'matrix' in n:return np.array(n['matrix'],dtype=np.float64).reshape(4,4).T
    x,y,z,w=n.get('rotation',[0,0,0,1]);m=np.eye(4)
    m[:3,:3]=np.array([[1-2*y*y-2*z*z,2*x*y-2*z*w,2*x*z+2*y*w],
        [2*x*y+2*z*w,1-2*x*x-2*z*z,2*y*z-2*x*w],
        [2*x*z-2*y*w,2*y*z+2*x*w,1-2*x*x-2*y*y]])@np.diag(n.get('scale',[1,1,1]))
    m[:3,3]=n.get('translation',[0,0,0]);return m

def prepare(src,work):
    work.mkdir(parents=True,exist_ok=True);meshes=[];layers=[]
    provenance=json.loads((src/'provenance.json').read_text())
    extra=src/'extras'
    for layer,asset in enumerate(ASSETS):
        root=src/asset
        if layer<3:
            doc=json.loads((root/(asset+'.gltf')).read_text())
            buffers=[source_path(root,b['uri']).read_bytes() for b in doc['buffers']]
            mat=doc['materials'][0];pbr=mat['pbrMetallicRoughness']
            albedo=image_at(root,doc,pbr['baseColorTexture']).convert('RGBA')
            normal=image_at(root,doc,mat['normalTexture']).convert('RGB')
            arm=image_at(root,doc,pbr['metallicRoughnessTexture']).convert('RGB')
            if layer==2:albedo.putalpha(Image.open(extra/'fern-alpha.png').convert('L'))
            def visit(i,parent):
                node=doc['nodes'][i];world=parent@transform_node(node)
                if 'mesh' in node:
                    for pi,primitive in enumerate(doc['meshes'][node['mesh']]['primitives']):
                        assert primitive.get('mode',4)==4 and primitive.get('material',0)==0
                        attr=primitive['attributes'];p=read_accessor(doc,buffers,attr['POSITION']).astype(np.float64)
                        p=(p@world[:3,:3].T)+world[:3,3]
                        n=read_accessor(doc,buffers,attr['NORMAL']).astype(np.float64)@np.linalg.inv(world[:3,:3])
                        n/=np.maximum(np.linalg.norm(n,axis=1,keepdims=True),1e-12)
                        uv=read_accessor(doc,buffers,attr['TEXCOORD_0'])
                        indices=read_accessor(doc,buffers,primitive['indices']).astype('<u4').reshape(-1)
                        if np.linalg.det(world[:3,:3])<0:indices=indices.reshape(-1,3)[:,[0,2,1]].reshape(-1)
                        low,high=p.min(0),p.max(0);origin=(low+high)*.5;origin[1]=low[1];p-=origin
                        vertices=np.concatenate([p,n,uv],axis=1).astype('<f4')
                        assert np.isfinite(vertices).all() and indices.max()<len(vertices)
                        name=node.get('name',asset+'-'+str(i))+('-'+str(pi) if pi else '')
                        data=struct.pack('<II',len(vertices),len(indices))+vertices.tobytes()+indices.tobytes()
                        filename=name+'.source.bin';(work/filename).write_bytes(data)
                        meshes.append({'name':name,'source':asset,'file':filename,'layer':layer,'cutout':layer==2,
                            'bounds':[p.min(0).tolist(),p.max(0).tolist()], 'sourceTriangles':len(indices)//3})
                for c in node.get('children',[]):visit(c,world)
            for i in doc['scenes'][doc.get('scene',0)]['nodes']:visit(i,np.eye(4))
        else:
            def find(name):return next(root.glob(name+'.*'))
            albedo=Image.open(find('twig_diff')).convert('RGBA');albedo.putalpha(Image.open(find('twig_alpha')).convert('L'))
            normal=Image.open(find('twig_nor_gl')).convert('RGB');arm=Image.open(find('twig_arm')).convert('RGB')
            # Select one complete needle twig, excluding cones and unrelated atlas islands.
            crop=(0,0,256,460);albedo=albedo.crop(crop);normal=normal.crop(crop);arm=arm.crop(crop)
        # Preserve hidden RGB around cutouts before filtering (alpha stays unchanged).
        alpha=np.array(albedo.getchannel('A'));rgb=np.array(albedo.convert('RGB'))
        known=alpha>12
        for _ in range(8):
            accum=np.zeros(rgb.shape,dtype=np.float32);count=np.zeros(known.shape,dtype=np.float32)
            for dx,dy in [(1,0),(-1,0),(0,1),(0,-1)]:
                mask=np.roll(np.roll(known,dx,0),dy,1)
                accum+=np.roll(np.roll(rgb,dx,0),dy,1)*mask[...,None];count+=mask
            fill=(~known)&(count>0)
            rgb[fill]=(accum[fill]/count[fill,None]).astype(np.uint8);known|=fill
        albedo=Image.fromarray(np.dstack([rgb,alpha]),'RGBA').resize((SIZE,SIZE),Image.Resampling.LANCZOS)
        # Packed data is LINEAR: normal XY, roughness, AO. Roughness-only rock source
        # has no occlusion map, so it must not be mistaken for an ARM red channel.
        n=np.array(normal.resize((SIZE,SIZE),Image.Resampling.LANCZOS)).astype(np.float32)/255*2-1
        n/=np.maximum(np.linalg.norm(n,axis=2,keepdims=True),1e-7)
        a=np.array(arm.resize((SIZE,SIZE),Image.Resampling.LANCZOS))
        surface=np.empty((SIZE,SIZE,4),dtype=np.uint8);surface[:,:,:2]=np.clip(np.rint((n[:,:,:2]+1)*127.5),0,255).astype(np.uint8)
        surface[:,:,2]=a[:,:,1];surface[:,:,3]=255 if layer==0 else a[:,:,0]
        stem=asset.replace('_','-');colorName=stem+'-color.png';surfaceName=stem+'-surface.png'
        albedo.save(work/colorName);Image.fromarray(surface,'RGBA').save(work/surfaceName)
        info=json.loads((extra/(asset+'-info.json')).read_text())
        layers.append({'id':asset,'license':'CC0-1.0','sourceURL':'https://polyhaven.com/a/'+asset,
            'authors':info['authors'],'albedo':colorName,'surface':surfaceName,
            'sha256':{'albedo':sha((work/colorName).read_bytes()),'surface':sha((work/surfaceName).read_bytes())}})
    # Include explicitly acquired alpha and metadata hashes, not only the original glTF.
    known={r['sha256'] for r in provenance['files']}
    alphaRecord=json.loads((extra/'fern-alpha-source.json').read_text())
    if alphaRecord['sha256'] not in known:
        provenance['files'].append({**alphaRecord,'bytes':(extra/'fern-alpha.png').stat().st_size})
    for asset in ASSETS:
        raw=(extra/(asset+'-info.json')).read_bytes();h=sha(raw)
        if h not in known:provenance['files'].append({'url':'https://api.polyhaven.com/info/'+asset,'bytes':len(raw),'sha256':h})
    doc={'version':1,'size':SIZE,'meshes':meshes,'layers':layers,'provenance':provenance,
        'conversion':{'layout':'position3 normal3 uv2 float32 LE','maps':'sRGB color/opacity, linear normalXY roughness AO',
            'pineCrop':[0,0,256,460],'hiddenColorDilation':8,'lodTool':'meshoptimizer 1.2.0'}}
    (work/'source-manifest.json').write_text(json.dumps(doc,indent=2)+'\n')
    print('Prepared',len(meshes),'models and',len(layers),'material pairs')

def pack(work,destination):
    destination.mkdir(parents=True,exist_ok=True)
    doc=json.loads((work/'source-manifest.json').read_text())
    lods=json.loads((work/'lods.json').read_text());packed=bytearray(struct.pack('<4I',0x31414252,1,32,0))
    for m in doc['meshes']:
        m.pop('file',None);m['lods']=[]
        for entry in lods[m['name']]:
            data=(work/entry['file']).read_bytes();vc,ic=struct.unpack_from('<II',data)
            if len(data)!=8+vc*32+ic*4:raise ValueError('Invalid converted mesh length')
            vo=len(packed);packed.extend(data[8:8+vc*32]);io=len(packed);packed.extend(data[8+vc*32:])
            m['lods'].append({'vertexCount':vc,'indexCount':ic,'vertexOffset':vo,'indexOffset':io,'error':entry['error']})
    doc.update(meshFile='hero-meshes.bin',meshBytes=len(packed),meshHash=sha(packed))
    (destination/doc['meshFile']).write_bytes(packed)
    for layer in doc['layers']:
        for key in ['albedo','surface']:(destination/layer[key]).write_bytes((work/layer[key]).read_bytes())
    (destination/'manifest.json').write_text(json.dumps(doc,indent=2)+'\n')
    print('Packed',len(packed),'bytes with 3 detail levels per model')

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--pack',action='store_true');parser.add_argument('source',type=Path);parser.add_argument('destination',type=Path)
    args=parser.parse_args()
    (pack if args.pack else prepare)(args.source,args.destination)
