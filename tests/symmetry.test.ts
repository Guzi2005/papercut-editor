import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSymmetry,symmetryMatrices,reflectAcross,DEFAULT_SYMMETRY} from '../src/utils/symmetry';
import {applyToPoint} from '../src/utils/pathTransform';
import {createBlankCanvas} from '../src/utils/presetTemplates';
import {serializeProject,parseProjectFile} from '../src/utils/storage';

test('central symmetry maps through a document centre and a tilted mirror is involutive',()=>{
  const matrices=symmetryMatrices({kind:'rotate',count:2,angle:90,cx:70,cy:90},512,512);
  const p=applyToPoint(matrices[1],{x:20,y:30});assert.ok(Math.abs(p.x-120)<1e-8&&Math.abs(p.y-150)<1e-8);
  const reflected=reflectAcross(32,70,90),restored=applyToPoint(reflected,applyToPoint(reflected,{x:15,y:24}));
  assert.ok(Math.abs(restored.x-15)<1e-8&&Math.abs(restored.y-24)<1e-8);
});
test('each document round trips its axis and invalid settings cannot produce runaway copies',()=>{
  const a=createBlankCanvas({width:512,height:512,mode:'create'}),b=createBlankCanvas({width:512,height:512,mode:'create'});
  a.symmetry={...DEFAULT_SYMMETRY,kind:'mirror',cx:100,cy:200,angle:30,visible:false,locked:true};
  const reopened=parseProjectFile(serializeProject(a));assert.deepEqual(reopened.symmetry,a.symmetry);
  assert.equal(b.symmetry,undefined);
  assert.deepEqual(normalizeSymmetry({kind:'rotate',count:Infinity,angle:NaN,cx:NaN,cy:Infinity}),{kind:'rotate',count:2,angle:90,cx:undefined,cy:undefined,visible:true,locked:false});
  assert.equal(normalizeSymmetry({kind:'invalid'}),undefined);
});
