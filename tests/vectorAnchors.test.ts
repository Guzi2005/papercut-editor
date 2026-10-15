import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {CutoutPath} from '../src/types/papercut';
import {cutoutAnchors,reviseCutoutAnchors} from '../src/utils/vectorAnchors';
import {parseVectorPath,segmentPoint} from '../src/utils/vectorPath';
import {applySymmetry,symmetryMatrices} from '../src/utils/symmetry';
import {strokeOutline} from '../src/utils/strokePath';

const cut=(d:string):CutoutPath=>({id:'curve',name:'curve',type:'custom_polygon',d,isHole:true,createdAt:0});

test('entering simple mode is read-only and moving one anchor carries cubic handles without sharp conversion',()=>{
  const original=cut('M 0 0 C 10 -20 90 -20 100 0 C 90 40 10 40 0 0 Z'),before=JSON.stringify(original),anchors=cutoutAnchors(original);
  assert.equal(JSON.stringify(original),before);
  anchors[1]={x:110,y:15};
  const result={...original,...reviseCutoutAnchors(original,anchors)},nodes=parseVectorPath(result.d)[0].nodes;
  assert.match(result.d,/C/);assert.deepEqual(nodes[1].incoming,{x:100,y:-5});assert.deepEqual(nodes[1].outgoing,{x:100,y:55});
  assert.deepEqual(nodes[0].outgoing,{x:10,y:-20});
});

test('simple anchor edits retain the captured mirror or central copies after global axes move',()=>{
  for(const kind of ['mirror','rotate']as const){
    const d='M 10 10 C 15 0 40 0 45 10 L 45 50 Z',matrices=symmetryMatrices({kind,count:kind==='rotate'?2:1,angle:90,cx:100,cy:100},200,200);
    const original={...cut(applySymmetry(d,matrices)),symmetrySource:{d,matrices}},anchors=cutoutAnchors(original);anchors[1].x+=10;
    const result={...original,...reviseCutoutAnchors(original,anchors)};
    assert.equal(parseVectorPath(result.d).length,2);assert.equal(result.d,applySymmetry(result.symmetrySource!.d,matrices));
    assert.equal(result.symmetrySource!.matrices,matrices);
  }
});

test('simple stroke anchors preserve per-anchor smoothing and both mirrored bands',()=>{
  const points=[{x:0,y:0},{x:40,y:50},{x:80,y:0}],stroke={width:12,round:0,cap:'round' as const,smooth:[false,true,false]};
  const d=strokeOutline(points,stroke),matrices=symmetryMatrices({kind:'mirror',count:1,angle:90,cx:100},200,200);
  const original={...cut(applySymmetry(d,matrices)),points,stroke,symmetrySource:{d,matrices}},anchors=cutoutAnchors(original);anchors[1].y=70;
  const updates=reviseCutoutAnchors(original,anchors);
  assert.deepEqual(original.stroke.smooth,[false,true,false]);assert.deepEqual(updates.points,anchors);
  assert.equal(updates.d,applySymmetry(strokeOutline(anchors,stroke),matrices));
});
