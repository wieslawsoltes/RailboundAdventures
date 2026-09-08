/** Offline attribute-aware simplification. meshoptimizer is not a game dependency. */
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const [work,library]=process.argv.slice(2);
if(!work||!library)throw new Error('Usage: node simplify_authored.mjs WORK_DIRECTORY MESHOPTIMIZER_PACKAGE_DIRECTORY');
const pkg=JSON.parse(fs.readFileSync(path.join(library,'package.json'),'utf8'));
if(pkg.version!=='1.2.0')throw new Error('Expected audited meshoptimizer 1.2.0');
const {MeshoptSimplifier:S}=await import(pathToFileURL(path.resolve(library,'meshopt_simplifier.js')).href);
await S.ready;
const doc=JSON.parse(fs.readFileSync(path.join(work,'source-manifest.json'),'utf8')),result={};
for(const m of doc.meshes){
 const raw=fs.readFileSync(path.join(work,m.file));const buffer=raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.length);
 const head=new DataView(buffer),count=head.getUint32(0,true),ic=head.getUint32(4,true);
 if(raw.length!==8+count*32+ic*4)throw new Error('Bad source mesh');
 const vertices=new Float32Array(buffer,8,count*8),indices=new Uint32Array(buffer,8+count*32,ic),attributes=new Float32Array(count*5);
 for(let v=0;v<count;v++)attributes.set(vertices.subarray(v*8+3,v*8+8),v*5);
 result[m.name]=[];
 for(const [lod,ratio] of [1,.42,.15].entries()){
  const cap=m.layer===1?12000:16000,target=Math.max(6,Math.floor(Math.min(ic/3,cap)*ratio)*3);
  let selected=indices.slice(),error=0;
  if(target<ic)[selected,error]=S.simplifyWithAttributes(indices,vertices,8,attributes,5,[.12,.12,.12,.9,.9],null,target,lod===0?.006:lod===1?.035:.10,['LockBorder']);
  // Compact without changing metre scale, topology or original vertex attributes.
  const [remap,size]=S.compactMesh(selected),vout=new Float32Array(size*8);
  for(let v=0;v<count;v++)if(remap[v]!==0xffffffff&&remap[v]<size)vout.set(vertices.subarray(v*8,v*8+8),remap[v]*8);
  const out=Buffer.alloc(8+vout.byteLength+selected.byteLength);out.writeUInt32LE(size,0);out.writeUInt32LE(selected.length,4);
  Buffer.from(vout.buffer).copy(out,8);Buffer.from(selected.buffer,selected.byteOffset,selected.byteLength).copy(out,8+vout.byteLength);
  const file=m.name+'.lod'+lod+'.bin';fs.writeFileSync(path.join(work,file),out);result[m.name].push({file,error});
  console.log(m.name,lod,size,selected.length/3,'triangles',error);
 }
}
fs.writeFileSync(path.join(work,'lods.json'),JSON.stringify(result,null,2)+'\n');
