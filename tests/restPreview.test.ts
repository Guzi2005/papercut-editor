import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {restFrame,transformRestCloth,settleRecliningCloth} from '../src/pleatedSkirt/restFrame';
import {GarmentBinding,type AvatarManifest} from '../src/pleatedSkirt/avatar';
import {buildMesh} from '../src/pleatedSkirt/geometry';
import {createDesign} from '../src/pleatedSkirt/model';
import {DrapeConstraint} from '../src/pleatedSkirt/drapeConstraint';
import {effectiveDrape} from '../src/pleatedSkirt/drape';

const m=JSON.parse(readFileSync(new URL('../public/pleated-avatar/manifest.json',import.meta.url),'utf8')) as AvatarManifest;
test('pelvis-space seated support keeps waist attached and cloth length through recline',()=>{
 const bytes=readFileSync(new URL('../public/pleated-avatar/frames.bin',import.meta.url));
 const data=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4);
 for(const length of [40,88,120]){
  const design=createDesign();Object.assign(design.parameters,{length_cm:length,pleat_count:16});
  const mesh=buildMesh(design.parameters),binding=new GarmentBinding(mesh,m.cage,length);
  binding.deform(new Float32Array(m.cage.restPositions));const rest=binding.positions.slice(),constraint=new DrapeConstraint(mesh,rest);
  for(const action of ['sit','lie'] as const)for(const progress of [.25,.5,.75,1]){
   const clip=m.actions[action],i=Math.round(progress*(clip.frames.length-1)),frame=clip.frames[i],t=i/(clip.frames.length-1);
   const start=frame.offset+m.vertexCount*6;
   binding.deform(data.subarray(start,start+m.cage.vertexCount*3));const waist=binding.positions.slice(0,129*3),support=restFrame(clip,t);
   transformRestCloth(binding.positions,support,true);
   constraint.apply(binding.positions,binding.normals,effectiveDrape(design),action==='lie'?Math.min(1,t/.4):t,'sit',rest,.2*Math.cos(support.angle));
   transformRestCloth(binding.positions,support);
   const before=binding.positions.slice();
   settleRecliningCloth(binding.positions,129,24,support.angle,effectiveDrape(design).weight,()=>constraint.projectLengths(binding.positions));
   if(action==='lie'&&progress===1){
    let oldY=0,newY=0;for(let col=0;col<128;col++){const at=(24*129+col)*3+1;oldY+=before[at];newY+=binding.positions[at];}
    assert.ok(newY<oldY,'reclining hem settles under world gravity');
   }
   assert.ok(constraint.maxWarpError(binding.positions)<1e-4);
   waist.forEach((v,j)=>assert.ok(Math.abs(v-binding.positions[j])<1e-5));
   assert.ok(binding.positions.every(Number.isFinite));
  }
 }
});
test('rest support transform preserves distances and round trips throughout both clips',()=>{
 for(const action of ['sit','lie'] as const)for(let i=0;i<=40;i++){
  const frame=restFrame(m.actions[action],i/40),p=new Float32Array([.2,1.31,.05,-.3,.7,.4]),original=p.slice();
  const distance=(v:Float32Array)=>Math.hypot(v[0]-v[3],v[1]-v[4],v[2]-v[5]);
  transformRestCloth(p,frame);assert.ok(Math.abs(distance(p)-distance(original))<1e-6);
  transformRestCloth(p,frame,true);
  p.forEach((v,j)=>assert.ok(Math.abs(v-original[j])<1e-6));
 }
});
test('seated pelvis lowers onto fixed bench and both feet remain grounded',()=>{
 const frames=m.actions.sit.frames;
 assert.ok(frames.length>=48);
 const end=frames.at(-1)!.joints!;
 assert.ok(Math.abs(end.hip[1]-.82)<.01);
 for(const f of frames)for(const key of ['footL','footR'])assert.ok(Math.abs(f.joints![key][1]-.15)<.025,`${key}: ${f.joints![key]}`);
});
test('lying begins standing, settles sitting and pivots at supported pelvis',()=>{
 const clip=m.actions.lie,first=clip.frames[0].joints!,last=clip.frames.at(-1)!.joints!;
 assert.ok(Math.abs(first.hip[1]-1.14)<.01);
 assert.ok(Math.abs(last.hip[0])<.01);
 assert.ok(Math.abs(last.hip[1]-.98)<.01);
 assert.ok(last.head[0]<last.hip[0]-.65);
 for(let i=1;i<clip.frames.length;i++){
  const a=clip.frames[i-1].joints!,b=clip.frames[i].joints!;
  assert.ok(Math.hypot(...b.hip.map((v,j)=>v-a.hip[j]))<.05,'pelvis trajectory must stay continuous');
  if(i/(clip.frames.length-1)>=.4)assert.ok(b.hip[1]>=.819,'pelvis must not fall through bench during recline');
 }
});
