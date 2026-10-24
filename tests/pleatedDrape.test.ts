import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GarmentBinding,type AvatarManifest} from '../src/pleatedSkirt/avatar';
import {DrapeConstraint} from '../src/pleatedSkirt/drapeConstraint';
import {defaultDrape,effectiveDrape} from '../src/pleatedSkirt/drape';
import {buildMesh} from '../src/pleatedSkirt/geometry';
import {createDesign,parseDesign} from '../src/pleatedSkirt/model';
const asset=(n:string)=>new URL('../public/pleated-avatar/'+n,import.meta.url);
const m=JSON.parse(readFileSync(asset('manifest.json'),'utf8')) as AvatarManifest;
const bytes=readFileSync(asset('frames.bin')),data=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4);
test('drape keeps material columns at their fitted rest length across actions and size extremes',()=>{
 for(const [length,hem] of [[40,100],[88,230],[120,360]]){
  const d=createDesign();Object.assign(d.parameters,{length_cm:length,hem_cm:hem,pleat_count:16});
  const mesh=buildMesh(d.parameters),binding=new GarmentBinding(mesh,m.cage,length);
  binding.deform(new Float32Array(m.cage.restPositions));const constraint=new DrapeConstraint(mesh,binding.positions);
  for(const [action,clip] of Object.entries(m.actions))for(const progress of [.25,.5,1]){
   const frame=clip.frames[Math.round((clip.frames.length-1)*progress)],off=frame.offset+m.vertexCount*6;
   binding.deform(data.subarray(off,off+m.cage.vertexCount*3));const waist=binding.positions.slice(0,(16*8+1)*3);
   constraint.apply(binding.positions,binding.normals,effectiveDrape(d),progress,action);
   assert.ok(constraint.maxWarpError(binding.positions)<1e-4,`${length}/${hem} ${action} ${progress}`);
   assert.ok(waist.every((v,i)=>Math.abs(v-binding.positions[i])<1e-6),'waist remains attached');
   assert.ok(binding.positions.every(Number.isFinite));assert.ok(binding.normals.every(Number.isFinite));
   const width=129,shell=width*25;
   for(let row=0;row<=24;row++)for(let k=0;k<3;k++)assert.ok(Math.abs(binding.positions[(row*width)*3+k]-binding.positions[(row*width+128)*3+k])<1e-6,'closed seam');
   for(let col=0;col<width;col++)assert.deepEqual(binding.positions.slice((shell*2+col*2)*3,(shell*2+col*2)*3+3),binding.positions.slice(col*3,col*3+3),'waist rim follows surface');
  }
 }
});
test('manual drape survives JSON roundtrip while automatic defaults respond to material and dimensions',()=>{
 const d=createDesign(),base=defaultDrape(d.parameters);
 assert.notDeepEqual(defaultDrape({...d.parameters,fabric:'silk'}),base);
 assert.notDeepEqual(defaultDrape({...d.parameters,length_cm:120,thickness_mm:3}),base);
 d.drape={mode:'manual',weight:.8,bending:.2,opening:.6};
 assert.deepEqual(parseDesign(JSON.parse(JSON.stringify(d))).drape,d.drape);
 assert.equal(effectiveDrape(d).weight,.8);d.parameters.fabric='linen';assert.equal(effectiveDrape(d).weight,.8);
 for(const value of [null,{mode:'manual',weight:2,bending:.1,opening:.5},{mode:'unknown',weight:.5,bending:.5,opening:.5}])assert.throws(()=>parseDesign({...d,drape:value}));
 delete d.drape;assert.deepEqual(effectiveDrape(d),defaultDrape(d.parameters));
});
test('bench binary contains actual game component geometry and valid indices',()=>{
 const manifest=JSON.parse(readFileSync(asset('bench.json'),'utf8')),buffer=readFileSync(asset('bench.bin'));
 assert.equal(manifest.source,'components/rest_bench.gd');assert.ok(manifest.parts.includes('StripedLinenSeat')||manifest.parts.length===85);
 const n=manifest.vertexCount*3;assert.equal(buffer.length,(n*3+manifest.indexCount)*4);
 const floats=new Float32Array(buffer.buffer,buffer.byteOffset,n*3);assert.ok(floats.every(Number.isFinite));
 const indices=new Uint32Array(buffer.buffer,buffer.byteOffset+n*12,manifest.indexCount);assert.ok(indices.every(i=>i<manifest.vertexCount));
});
