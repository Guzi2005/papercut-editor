import {test} from 'node:test';import assert from 'node:assert/strict';
import {TransientCue} from '../src/pleatedSkirt/transientCue';
import {DrapeConstraint} from '../src/pleatedSkirt/drapeConstraint';
import {buildMesh} from '../src/pleatedSkirt/geometry';
import {createDesign} from '../src/pleatedSkirt/model';
import {GarmentBinding} from '../src/pleatedSkirt/avatar';
import {readFileSync} from 'node:fs';
test('view cues expire without repeated rendering extending the deadline',()=>{const cue=new TransientCue();cue.update('front',0);cue.update('front',2000);assert.equal(cue.alpha(2200),1);assert.equal(cue.alpha(2425),.5);assert.equal(cue.alpha(2650),0);assert.equal(cue.nextDelay(3000),undefined);cue.update('back',3000);assert.equal(cue.alpha(3000),1);});
test('seated gathers preserve pinned waist and material length, are deterministic, and respond to fabric',()=>{
 const manifest=JSON.parse(readFileSync('public/pleated-avatar/manifest.json','utf8'));
 const bytes=readFileSync('public/pleated-avatar/frames.bin'),data=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4);
 for(const length_cm of [40,88,120])for(const hem_cm of [100,230,360]){
  const mesh=buildMesh({...createDesign().parameters,length_cm,hem_cm}),binding=new GarmentBinding(mesh,manifest.cage,length_cm);
  binding.deform(new Float32Array(manifest.cage.restPositions));const solver=new DrapeConstraint(mesh,binding.positions);
  const frame=manifest.actions.sit.frames.at(-1),offset=frame.offset+manifest.vertexCount*6;
  binding.deform(data.subarray(offset,offset+manifest.cage.vertexCount*3));
  const source=binding.positions.slice(),normals=binding.normals.slice(),width=64*8+1;
  const soft=source.slice(),stiff=source.slice();
  solver.apply(soft,normals,{weight:.6,bending:.1,opening:.7},1,'sit');solver.apply(stiff,normals,{weight:.6,bending:.9,opening:.7},1,'sit');
  assert.ok(solver.maxWarpError(soft)<1e-4);assert.ok(solver.maxWarpError(stiff)<1e-4);assert.deepEqual(soft.slice(0,(width-1)*3),source.slice(0,(width-1)*3));assert.ok(soft.every(Number.isFinite));assert.notDeepEqual(soft,stiff);
  const repeat=source.slice();solver.apply(repeat,normals,{weight:.6,bending:.1,opening:.7},1,'sit');assert.deepEqual(repeat,soft);
 }
});
