import {test} from 'node:test';import assert from 'node:assert/strict';
import {defaultStance,limitStance,stanceLeg,stanceDrop,poseStance} from '../src/pleatedSkirt/stance';
import {readFileSync} from 'node:fs';
test('foot layout keeps anatomical sides and finite limits',()=>{
 const s=limitStance({left:{x:1,z:-5,arm:200},right:{x:-1,z:NaN,arm:Infinity}});
 assert.equal(s.left.x,-.055);assert.equal(s.right.x,.055);assert.equal(s.left.z,-.25);assert.equal(s.left.arm,110);assert.equal(s.right.arm,0);
});
test('standing leg IK preserves both segments and keeps feet on the ground',()=>{
 for(const x of [.055,.15,.42])for(const z of [-.25,.045,.32]){
  const s=defaultStance();s.left.x=-x;s.left.z=z;s.right.x=.42;
  for(const side of [-1,1]){const {hip,knee,ankle}=stanceLeg(s,side),distance=(a:number[],b:number[])=>Math.hypot(...a.map((v,k)=>v-b[k]));assert.ok(Math.abs(distance(hip,knee)-.5)<1e-8);assert.ok(Math.abs(distance(knee,ankle)-.5)<1e-8);assert.equal(ankle[1],.16);}
  assert.ok(stanceDrop(s)>=0);
 }
});
test('standing preview keeps default pose unchanged and moves shoes without scaling',()=>{
 const m=JSON.parse(readFileSync('public/pleated-avatar/manifest.json','utf8')),bytes=readFileSync('public/pleated-avatar/frames.bin'),data=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4),offset=m.actions.stand.frames[0].offset,n=m.vertexCount*3,p=data.slice(offset,offset+n),normals=data.slice(offset+n,offset+n*2),initial=p.slice();
 poseStance(p,normals,m.parts,defaultStance());for(let i=0;i<n;i++)assert.ok(Math.abs(p[i]-initial[i])<1e-5);
 const s=defaultStance();s.left.x=-.38;s.left.z=.2;s.right.arm=85;poseStance(p,normals,m.parts,s);
 const sole=m.parts.find((x:{name:string;vertexOffset:number})=>x.name==='FlatSole'&&initial[x.vertexOffset*3]<0),at=sole.vertexOffset*3;
 assert.ok(Math.abs(p[at]-initial[at]+.23)<1e-5);assert.ok(Math.abs(p[at+2]-initial[at+2]-.155)<1e-5);assert.ok(Math.abs(p[at+1]-initial[at+1])<1e-5);assert.ok(p.every(Number.isFinite));
});
