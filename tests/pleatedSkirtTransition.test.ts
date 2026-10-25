import {test} from 'node:test';import assert from 'node:assert/strict';
import {PoseTransition,type TransitionPose} from '../src/pleatedSkirt/poseTransition';
import {rotateY} from '../src/pleatedSkirt/motion';

const LOCAL_POSITIONS=[1,.2,0,0,1.1,1.5,-.7,-.3,.9];
const LOCAL_NORMALS=[0,0,1,1,0,0,0,1,0];
function pose(rootAngle=0,offset=0,normalScale=1):TransitionPose{
 const bodyPositions=new Float32Array(LOCAL_POSITIONS.map((v,i)=>v+(i%3===1?offset*.5:offset)));
 const bodyNormals=new Float32Array(LOCAL_NORMALS.map(v=>v*normalScale));
 const garmentPositions=bodyPositions.slice(),garmentNormals=bodyNormals.slice();
 rotateY(bodyPositions,bodyNormals,rootAngle);rotateY(garmentPositions,garmentNormals,rootAngle);
 return {bodyPositions,bodyNormals,garmentPositions,garmentNormals,rootAngle};
}
function clonePose(p:TransitionPose):TransitionPose{
 return {bodyPositions:p.bodyPositions.slice(),bodyNormals:p.bodyNormals.slice(),garmentPositions:p.garmentPositions.slice(),garmentNormals:p.garmentNormals.slice(),rootAngle:p.rootAngle};
}
function assertClose(actual:Float32Array,expected:Float32Array,label:string,epsilon=1e-6){
 assert.equal(actual.length,expected.length,label);
 for(let i=0;i<actual.length;i++)assert.ok(Math.abs(actual[i]-expected[i])<=epsilon,`${label}[${i}]: ${actual[i]} != ${expected[i]}`);
}
function assertUnitNormals(p:TransitionPose,label:string){
 for(const [name,data] of [['body',p.bodyNormals],['garment',p.garmentNormals]] as const){
  for(let i=0;i<data.length;i+=3)assert.ok(Math.abs(Math.hypot(data[i],data[i+1],data[i+2])-1)<1e-6,`${label} ${name} normal ${i/3}`);
 }
}

test('transition has exact idle, source, and completed endpoints',()=>{
 const source=pose(.37),target=pose(-.81,.3),transition=new PoseTransition(.4);
 assert.equal(transition.active,false);assert.equal(transition.weight,1);
 transition.start(source);
 assert.equal(transition.active,true);assert.equal(transition.weight,0);
 const atStart=clonePose(target),startYaw=transition.apply(atStart);
 assert.equal(startYaw,source.rootAngle);
 assert.deepEqual(atStart.bodyPositions,source.bodyPositions);
 assert.deepEqual(atStart.garmentPositions,source.garmentPositions);
 assertClose(atStart.bodyNormals,source.bodyNormals,'start body normals');
 assertClose(atStart.garmentNormals,source.garmentNormals,'start garment normals');
 transition.advance(.399999);
 const nearEnd=clonePose(target),nearYaw=transition.apply(nearEnd);
 assert.ok(Math.abs(nearYaw-target.rootAngle)<1e-5);
 assertClose(nearEnd.bodyPositions,target.bodyPositions,'near-end body positions',1e-4);
 assertClose(nearEnd.garmentPositions,target.garmentPositions,'near-end garment positions',1e-4);
 transition.advance(.4);
 assert.equal(transition.active,false);assert.equal(transition.weight,1);
 const atEnd=clonePose(target),endYaw=transition.apply(atEnd);
 assert.equal(endYaw,target.rootAngle);
 assert.deepEqual(atEnd,clonePose(target));
});

test('weight follows smoothstep and finite nonnegative deltas only advance time',()=>{
 const transition=new PoseTransition(1);transition.start(pose(.2));
 assert.equal(transition.weight,0);
 transition.advance(.25);assert.equal(transition.weight,.15625);
 transition.advance(.25);assert.equal(transition.weight,.5);
 transition.advance(.25);assert.equal(transition.weight,.84375);
 transition.advance(NaN);transition.advance(-1);transition.advance(Infinity);
 assert.equal(transition.active,true);assert.equal(transition.weight,.84375);
 const target=pose(-.4),yaw=transition.apply(target);
 assert.ok(Math.abs(yaw-(.2+(-.6)*.84375))<1e-9);
 transition.advance(.25);assert.equal(transition.active,false);assert.equal(transition.weight,1);
});

test('starting snapshots data so later source edits cannot leak in and sources are never mutated',()=>{
 const source=pose(.4),original=clonePose(source),target=pose(-.7,.2),transition=new PoseTransition(1);
 transition.start(source);transition.advance(.5);transition.apply(target);
 assert.deepEqual(source,original);
 source.bodyPositions[0]=99;source.bodyNormals[0]=99;source.garmentPositions[1]=-99;source.garmentNormals[2]=99;source.rootAngle=99;
 const fresh=new PoseTransition(1);fresh.start(original);
 const atStart=clonePose(target),yaw=fresh.apply(atStart);
 assert.equal(yaw,original.rootAngle);
 assert.deepEqual(atStart.bodyPositions,original.bodyPositions);
 assert.deepEqual(atStart.garmentPositions,original.garmentPositions);
 assertClose(atStart.bodyNormals,original.bodyNormals,'snapshot body normals');
 assertClose(atStart.garmentNormals,original.garmentNormals,'snapshot garment normals');
});

test('shortest yaw interpolation crosses the pi seam without collapsing geometry',()=>{
 const forward=new PoseTransition(1);forward.start(pose(Math.PI/2));forward.advance(.5);
 const forwardTarget=clonePose(pose(-Math.PI/2)),forwardYaw=forward.apply(forwardTarget);
 assert.ok(Math.abs(forwardYaw)<1e-9,`midpoint yaw ${forwardYaw}`);
 assert.ok(Math.abs(Math.hypot(forwardTarget.bodyPositions[0],forwardTarget.bodyPositions[2])-1)<1e-6);
 assert.ok(Math.abs(forwardTarget.bodyPositions[0]-1)<1e-6,`body x ${forwardTarget.bodyPositions[0]}`);

 const backward=new PoseTransition(1);backward.start(pose(-Math.PI+.1));backward.advance(.5);
 const backwardTarget=clonePose(pose(Math.PI-.1)),backwardYaw=backward.apply(backwardTarget);
 assert.ok(Math.abs(Math.abs(backwardYaw)-Math.PI)<1e-6,`seam yaw ${backwardYaw}`);
 assert.ok(Math.abs(Math.hypot(backwardTarget.bodyPositions[0],backwardTarget.bodyPositions[2])-1)<1e-6);
});

test('interrupted transitions restart from displayed world buffers without a jump',()=>{
 const first=new PoseTransition(.6);first.start(pose(.3));first.advance(.3);
 const displayed=clonePose(pose(-.7,.25)),shownYaw=first.apply(displayed);
 assert.equal(first.active,true);
 const resumed=new PoseTransition(.5);resumed.start({...clonePose(displayed),rootAngle:shownYaw});
 assert.equal(resumed.weight,0);
 const next=clonePose(pose(1.1,-.15)),resumedYaw=resumed.apply(next);
 assert.equal(resumedYaw,shownYaw);
 assert.deepEqual(next.bodyPositions,displayed.bodyPositions);
 assert.deepEqual(next.garmentPositions,displayed.garmentPositions);
 assertClose(next.bodyNormals,displayed.bodyNormals,'resume body normals');
 assertClose(next.garmentNormals,displayed.garmentNormals,'resume garment normals');
 resumed.advance(.25);
 const midpoint=clonePose(pose(1.1,-.15)),midYaw=resumed.apply(midpoint);
 assert.ok(midYaw>=Math.min(shownYaw,1.1)&&midYaw<=Math.max(shownYaw,1.1));
 assertUnitNormals(midpoint,'resumed midpoint');
});

test('blended normals are renormalized after local interpolation and rotation',()=>{
 const transition=new PoseTransition(1);transition.start(pose(.55,0,5));
 const target=pose(-.35,.2,2);
 const atStart=clonePose(target);transition.apply(atStart);assertUnitNormals(atStart,'start');
 transition.advance(.5);
 const atMiddle=clonePose(target);transition.apply(atMiddle);assertUnitNormals(atMiddle,'middle');
 transition.advance(.499999);
 const nearEnd=clonePose(target);transition.apply(nearEnd);assertUnitNormals(nearEnd,'near end');
 transition.advance(.5);
 const atEnd=clonePose(target),yaw=transition.apply(atEnd);
 assert.equal(yaw,target.rootAngle);assert.deepEqual(atEnd,clonePose(target));
});

test('topology mismatches cancel atomically for every buffer without touching the target',()=>{
 const keys=['bodyPositions','bodyNormals','garmentPositions','garmentNormals'] as const;
 for(const key of keys){
  const transition=new PoseTransition(1);transition.start(pose(.2));
  const target=pose(-.4,.2),original=clonePose(target),replacement=new Float32Array(target[key].length+3);
  replacement.set(target[key]);target[key]=replacement;
  const yaw=transition.apply(target);
  assert.equal(yaw,target.rootAngle,key);
  assert.equal(transition.active,false,key);assert.equal(transition.weight,1,key);
  for(const other of keys){
   if(other===key)assert.deepEqual(target[other],replacement,`${key} ${other}`);
   else assert.deepEqual(target[other],original[other],`${key} ${other}`);
  }
  const after=clonePose(target);assert.equal(transition.apply(target),target.rootAngle);
  assert.deepEqual(target,after);
 }
});

test('a moving target keeps its winding when crossing the opposite heading',()=>{
 const transition=new PoseTransition(1);transition.start(pose(0));
 transition.apply(pose(0));let previous=0;
 for(let i=1;i<=9;i++){
  transition.advance(.1);const yaw=transition.apply(pose(i*.5));
  assert.ok(yaw>=previous,'forward spin never reverses direction at pi');
  assert.ok(yaw-previous<1,'crossing pi does not jump');previous=yaw;
 }
});

test('cancel clears an active snapshot and leaves later targets untouched',()=>{
 const transition=new PoseTransition(1);transition.start(pose(.2));transition.advance(.25);transition.cancel();
 assert.equal(transition.active,false);assert.equal(transition.weight,1);
 const target=pose(.9,.4),original=clonePose(target);
 assert.equal(transition.apply(target),target.rootAngle);
 assert.deepEqual(target,original);
 transition.advance(.5);assert.equal(transition.active,false);assert.equal(transition.weight,1);
});
