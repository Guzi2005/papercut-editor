import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBlankCanvas} from '../src/utils/presetTemplates';
import {applySchemeColors,mapLayerColors} from '../src/utils/schemeApply';
import {createLiveStampStroke,attachLiveStampStroke,regenerateLiveStampLayer,detachChangedLiveStamps} from '../src/utils/liveStamps';
import {BUILTIN_STAMPS,DEFAULT_STAMP_SETTINGS} from '../src/utils/stamps';
test('scheme swaps read original inks once and preserve holes geometry and raster fills',()=>{
  const layer={...createBlankCanvas().layers.layer_base_paper,color:'#FF0000',positiveElements:[{id:'blue',name:'b',type:'custom_polygon' as const,d:'M0 0H10V10Z',isHole:false,fillColor:'#0000FF',createdAt:1}],fabric:{assetId:'fabric',repeat:'single' as const,opacity:1,transform:[1,0,0,1,0,0] as [number,number,number,number,number,number]}};
  const next=mapLayerColors(layer,{'#FF0000':'#0000FF','#0000FF':'#FF0000'});
  assert.equal(next.color,'#0000FF');assert.equal(next.positiveElements[0].fillColor,'#FF0000');assert.deepEqual(next.fabric,layer.fabric);assert.equal(next.baseShape.d,layer.baseShape.d);
});
test('palette changes retain editable repeat recipes and survive spacing regeneration',()=>{
  const base=createBlankCanvas().layers.layer_base_paper,{stroke,paths}=createLiveStampStroke(BUILTIN_STAMPS[0],DEFAULT_STAMP_SETTINGS,[{x:50,y:50},{x:300,y:50}],1,'scheme_live');
  const layer=attachLiveStampStroke({...base,positiveElements:paths},stroke),red=mapLayerColors(layer,{'#2E58D6':'#FF0000'});
  assert.equal(detachChangedLiveStamps(red).liveStamps?.length,1);
  const rebuilt=regenerateLiveStampLayer(red,stroke.id,{settings:{spacing:2}});
  assert.ok(rebuilt.positiveElements.some(p=>p.fillColor==='#FF0000'));
  assert.ok(!rebuilt.positiveElements.some(p=>p.fillColor==='#2E58D6'));
  const green=mapLayerColors(red,{'#FF0000':'#00FF00'}),again=regenerateLiveStampLayer(green,stroke.id,{});
  assert.ok(again.positiveElements.some(p=>p.fillColor==='#00FF00'));
});
test('scheme selection excludes other layers and locked layers',()=>{
  const p=createBlankCanvas(),base=p.layers.layer_base_paper;
  p.layers={a:{...base,id:'a'},b:{...base,id:'b',locked:true},c:{...base,id:'c'}};
  const next=applySchemeColors(p,{[base.color]:'#123456'},['a','b']);
  assert.equal(next.layers.a.color,'#123456');assert.equal(next.layers.b.color,base.color);assert.equal(next.layers.c.color,base.color);
});
