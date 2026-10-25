import {test} from 'node:test';
import assert from 'node:assert/strict';
import {projectEllipsoid,projectCapsule} from '../src/pleatedSkirt/bodySupport';

const near=(actual:number,expected:number,tolerance=1e-6)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} is not near ${expected}`);
const buffer=(...values:number[])=>Float32Array.from(values);
const unchanged=(p:Float32Array,before:number[],at:number)=>{
 for(let i=0;i<p.length;i++)if(i<at||i>at+2)assert.equal(p[i],before[i],`unrelated entry ${i} changed`);
};

test('ellipsoid leaves outside and boundary vertices untouched',()=>{
 const p=buffer(9,9,9,2,0,0,9,9,9),before=Array.from(p);
 assert.equal(projectEllipsoid(p,3,[0,0,0],[1,2,3]),0);
 assert.deepEqual(Array.from(p),before);
 const boundary=buffer(2,0,0);
 assert.equal(projectEllipsoid(boundary,0,[0,0,0],[2,3,4]),0);
 assert.deepEqual(Array.from(boundary),[2,0,0]);
});

test('ellipsoid projects inside vertices radially in normalized coordinates',()=>{
 const p=buffer(9,9,9,.6,1.6,0,9,9,9),before=Array.from(p);
 const moved=projectEllipsoid(p,3,[0,0,0],[2,4,1]);
 near(moved,Math.hypot(1.2-.6,3.2-1.6));
 near(p[3],1.2);near(p[4],3.2);near(p[5],0);
 near(Math.hypot(p[3]/2,p[4]/4,p[5]/1),1);
 unchanged(p,before,3);
});

test('ellipsoid center falls back upwards and stays finite',()=>{
 const p=buffer(7,8,9,1,2,3,7,8,9),before=Array.from(p);
 const moved=projectEllipsoid(p,3,[1,2,3],[1,4,5],.5);
 assert.ok(Number.isFinite(moved));
 near(moved,2);
 assert.deepEqual([p[3],p[4],p[5]],[1,4,3]);
 unchanged(p,before,3);
});

test('ellipsoid strength is clamped and partial movement lands proportionally',()=>{
 const half=buffer(0,.2,0);
 near(projectEllipsoid(half,0,[0,0,0],[1,1,1],.5),.4);near(half[1],.6);
 const full=buffer(0,.2,0);
 near(projectEllipsoid(full,0,[0,0,0],[1,1,1],5),.8);near(full[1],1);
 const none=buffer(0,.2,0),before=Array.from(none);
 assert.equal(projectEllipsoid(none,0,[0,0,0],[1,1,1],-2),0);
 assert.equal(projectEllipsoid(none,0,[0,0,0],[1,1,1],NaN),0);
 assert.deepEqual(Array.from(none),before);
});

test('ellipsoid rejects invalid geometry without touching the buffer',()=>{
 const p=buffer(0,.2,0),before=Array.from(p);
 assert.equal(projectEllipsoid(p,0,[0,0,NaN],[1,1,1]),0);
 assert.equal(projectEllipsoid(p,0,[0,0,0],[1,0,1]),0);
 assert.equal(projectEllipsoid(p,0,[0,0,0],[-1,1,1]),0);
 assert.equal(projectEllipsoid(p,0,[0,0,0],[1,Infinity,1]),0);
 assert.equal(projectEllipsoid(p,0,[0,0],[1,1,1]),0);
 assert.equal(projectEllipsoid(p,1,[0,0,0],[1,1,1]),0);
 assert.equal(projectEllipsoid(p,-3,[0,0,0],[1,1,1]),0);
 assert.deepEqual(Array.from(p),before);
 const bad=buffer(0,NaN,0);
 assert.equal(projectEllipsoid(bad,0,[0,0,0],[1,1,1]),0);
 assert.ok(Number.isNaN(bad[1]));
});

test('capsule leaves outside points untouched',()=>{
 const p=buffer(9,9,9,3,0,0,9,9,9),before=Array.from(p);
 assert.equal(projectCapsule(p,3,[-1,0,0],[1,0,0],.5),0);
 assert.deepEqual(Array.from(p),before);
});

test('capsule pushes an inside point to the segment surface',()=>{
 const p=buffer(9,9,9,0,.2,0,9,9,9),before=Array.from(p);
 near(projectCapsule(p,3,[-2,0,0],[2,0,0],.5),.3);
 assert.deepEqual([p[3],p[4],p[5]],[0,.5,0]);
 unchanged(p,before,3);
});

test('capsule clamps to both endpoints',()=>{
 const right=buffer(1.2,0,0);
 near(projectCapsule(right,0,[-1,0,0],[1,0,0],.5),.3);near(right[0],1.5);
 const left=buffer(-1.2,0,0);
 near(projectCapsule(left,0,[-1,0,0],[1,0,0],.5),.3);near(left[0],-1.5);
});

test('capsule handles a degenerate segment and exact-center fallback',()=>{
 const p=buffer(9,9,9,.2,0,0);
 near(projectCapsule(p,3,[0,0,0],[0,0,0],1),.8);
 assert.deepEqual([p[3],p[4],p[5]],[1,0,0]);
 const center=buffer(-1,0,0);
 const moved=projectCapsule(center,0,[-1,0,0],[1,0,0],.5);
 assert.ok(Number.isFinite(moved));near(moved,.5);
 assert.deepEqual([center[0],center[1],center[2]],[-1,.5,0]);
});

test('capsule partial strength is proportional and clamped',()=>{
 const half=buffer(0,.2,0);
 near(projectCapsule(half,0,[-1,0,0],[1,0,0],.5,.5),.15);near(half[1],.35);
 const full=buffer(0,.2,0);
 near(projectCapsule(full,0,[-1,0,0],[1,0,0],.5,4),.3);near(full[1],.5);
 const none=buffer(0,.2,0),before=Array.from(none);
 assert.equal(projectCapsule(none,0,[-1,0,0],[1,0,0],.5,0),0);
 assert.equal(projectCapsule(none,0,[-1,0,0],[1,0,0],.5,Infinity),0);
 assert.deepEqual(Array.from(none),before);
});

test('capsule rejects invalid geometry without touching the buffer',()=>{
 const p=buffer(0,.2,0),before=Array.from(p);
 assert.equal(projectCapsule(p,0,[0,0,0],[1,NaN,0],.5),0);
 assert.equal(projectCapsule(p,0,[0,0,0],[1,0,0],0),0);
 assert.equal(projectCapsule(p,0,[0,0,0],[1,0,0],-1),0);
 assert.equal(projectCapsule(p,0,[0,0,0],[1,0,0],NaN),0);
 assert.equal(projectCapsule(p,0,[0,0],[1,0,0],.5),0);
 assert.equal(projectCapsule(p,2,[-1,0,0],[1,0,0],.5),0);
 assert.equal(projectCapsule(p,-1,[-1,0,0],[1,0,0],.5),0);
 assert.deepEqual(Array.from(p),before);
 const bad=buffer(Infinity,0,0);
 assert.equal(projectCapsule(bad,0,[-1,0,0],[1,0,0],.5),0);
 assert.equal(bad[0],Infinity);
});

test('body support is deterministic',()=>{
 const run=()=>{
  const e=buffer(9,9,9,.2,.1,0,9,9,9),c=buffer(9,9,9,.1,.2,0,9,9,9);
  return [projectEllipsoid(e,3,[0,0,0],[2,1,1]),projectCapsule(c,3,[-1,0,0],[1,0,0],.5),...e,...c];
 };
 const first=run(),second=run();
 assert.deepEqual(first,second);
 for(const value of first)assert.ok(Number.isFinite(value));
});
