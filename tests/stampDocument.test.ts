import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStampDocument,stampFromDocument} from '../src/utils/stampDocument';
import {BUILTIN_STAMPS} from '../src/utils/stamps';
import {layerContent} from '../src/utils/layerContent';
import {renderLayerMarkup} from '../src/utils/layerSvg';

test('motif canvas uses ordinary editable paths and preserves tile margins',()=>{
  const def={id:'test',name:'test',parts:[{id:'p',d:'M 20 20 H 80 V 80 H 20 Z',color:'#D90B20'}]};
  const p=createStampDocument(def),l=p.layers.layer_base_paper;
  assert.equal(l.cutouts.length,1);assert.equal(p.width,256);
  const result=stampFromDocument(p,def),again=createStampDocument(result);
  assert.deepEqual(layerContent(again.layers.layer_base_paper).bounds,layerContent(l).bounds);
});
test('brush marks outside existing motif remain visible and become stamp geometry',()=>{
  const p=createStampDocument({id:'empty',name:'empty',parts:[]}),l=p.layers.layer_base_paper;
  l.drawings=[{id:'brush',d:'M 30 30 L 200 30',color:'#000000',opacity:1,strokeWidth:10,brushType:'pen'}];
  assert.ok(layerContent(l).bounds!.width>=170);
  assert.ok(renderLayerMarkup(l,{idPrefix:'test_'}).includes('M 30 30 L 200 30'));
  assert.equal(stampFromDocument(p,{id:'brush',name:'brush',parts:[]}).parts.length,1);
});
test('all sixteen classic examples survive shared-canvas editing round trip',()=>{
  const examples=BUILTIN_STAMPS.filter(d=>d.group==='白俄罗斯几何纹样');assert.equal(examples.length,16);
  for(const def of examples){const result=stampFromDocument(createStampDocument(def),def);assert.ok(result.parts.length);assert.ok(result.parts.every(p=>!p.d.includes('NaN')));}
});
