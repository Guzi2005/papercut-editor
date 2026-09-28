import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseVectorPath, serializeVectorPath, splitSegment, setNodeMode, moveHandle } from '../src/utils/vectorPath';

test('relative compound rings and closing curves survive round trip', () => {
  const d='M 10 10 C 20 0 30 0 40 10 L 40 40 C 20 50 0 20 10 10 Z m 5 5 l 5 0 l 0 5 z';
  const p=parseVectorPath(d), round=parseVectorPath(serializeVectorPath(p));
  assert.equal(p.length,2);
  assert.equal(p[0].nodes.length,3);
  assert.equal(p[1].relative,true);
  assert.deepEqual(round,p);
  assert.deepEqual(p[0].nodes[0].incoming,{x:0,y:20});
});

test('quadratic and smooth shorthand keep their reflected controls', () => {
  const p=parseVectorPath('M 0 0 Q 30 60 60 0 T 120 0 C 140 20 150 30 160 0 S 180 -30 200 0')[0];
  assert.deepEqual(p.nodes[1].outgoing,{x:80,y:-40});
  assert.deepEqual(p.nodes[3].outgoing,{x:170,y:-30});
  assert.equal(p.nodes.length,5);
});

test('elliptical arcs become editable cubics with correct endpoints', () => {
  const p=parseVectorPath('M 10 0 A 10 10 0 0 1 -10 0');
  assert.equal(p[0].nodes.length,3);
  assert.equal(p[0].nodes.at(-1)!.x,-10);
  assert.equal(p[0].nodes.at(-1)!.y,0);
  assert.match(serializeVectorPath(p),/C/);
});

test('de Casteljau insertion preserves cubic shape at every sampled position', () => {
  const p=parseVectorPath('M 0 0 C 0 100 100 100 100 0');
  const original=structuredClone(p[0].nodes);
  splitSegment(p[0],0);
  const at=(a:any,b:any,t:number) => {
    const c=a.outgoing ?? a,d=b.incoming ?? b,u=1-t;
    return {x:u*u*u*a.x+3*u*u*t*c.x+3*u*t*t*d.x+t*t*t*b.x,y:u*u*u*a.y+3*u*u*t*c.y+3*u*t*t*d.y+t*t*t*b.y};
  };
  for(let i=0;i<=100;i++) {
    const t=i/100, expected=at(original[0],original[1],t);
    const actual=t<=.5?at(p[0].nodes[0],p[0].nodes[1],t*2):at(p[0].nodes[1],p[0].nodes[2],(t-.5)*2);
    assert.ok(Math.hypot(expected.x-actual.x,expected.y-actual.y)<1e-8);
  }
});

test('closed last segment insertion and open endpoints are handled separately', () => {
  const closed=parseVectorPath('M 0 0 L 100 0 L 100 100 Z')[0];
  splitSegment(closed,2);
  assert.equal(closed.nodes.length,4);
  assert.deepEqual(closed.nodes[3],{x:50,y:50});
  const open=parseVectorPath('M 0 0 L 100 0')[0];
  splitSegment(open,1);
  assert.equal(open.nodes.length,2);
});

test('symmetric, smooth, and independent control handles obey constraints', () => {
  const c=parseVectorPath('M 0 0 L 50 50 L 100 0')[0];
  setNodeMode(c,1,'symmetric');
  const n=c.nodes[1];
  moveHandle(n,'outgoing',{x:80,y:60});
  assert.deepEqual(n.incoming,{x:20,y:40});
  const before={...n.incoming};
  moveHandle(n,'outgoing',{x:90,y:90},true);
  assert.deepEqual(n.incoming,before);
  setNodeMode(c,1,'corner');
  moveHandle(n,'outgoing',{x:100,y:50});
  assert.deepEqual(n.incoming,before);
});
