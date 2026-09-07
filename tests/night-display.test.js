import test from 'node:test';
import assert from 'node:assert/strict';
import {POST_WGSL,LOOKS} from '../src/postprocess.js';
import {readFileSync} from 'node:fs';
test('cinematic contrast preserves positive night radiance',()=>{for(const look of Object.values(LOOKS))for(const x of [.0001,.001,.005,.01,.1,1]){const y=Math.pow(x,look.contrast);assert.ok(y>0&&y<=1);}assert.ok(POST_WGSL.includes('pow(clamp(c,vec3f(0),vec3f(1)),vec3f(u.look.z))'));const code=readFileSync(new URL('../src/postprocess.js',import.meta.url),'utf8');assert.ok(code.includes('pow(clamp(c,vec3(0),vec3(1)),vec3(look.z))'));});
