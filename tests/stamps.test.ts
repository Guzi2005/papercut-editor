import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BUILTIN_STAMPS,DEFAULT_STAMP_SETTINGS as defaults,stampPlacements,prepareStamp,placedStampPaths,validateStampLibrary,normalizeStampSettings} from '../src/utils/stamps';
import {createBlankCanvas} from '../src/utils/presetTemplates';
import {layerContent} from '../src/utils/layerContent';

test('click creates one stamp and distance spacing is independent of event frequency',()=>{
  const s={...defaults,size:20,spacing:1};
  assert.equal(stampPlacements([{x:10,y:20}],s,1).length,1);
  const sparse=[{x:0,y:0},{x:100,y:0}],dense=Array.from({length:101},(_,x)=>({x,y:0}));
  assert.deepEqual(stampPlacements(sparse,s,1),stampPlacements(dense,s,1));
  assert.deepEqual(stampPlacements(sparse,s,1).map(p=>p.x),[0,20,40,60,80,100]);
  assert.equal(stampPlacements([{x:0,y:0},{x:1e6,y:0}],s,1).length,300);
});
test('rotation follows path, fixed angle works, randomness is stable per stroke',()=>{
  const points=[{x:0,y:0},{x:0,y:200}];
  assert.equal(stampPlacements(points,defaults,1)[0].angle,Math.PI/2);
  assert.equal(stampPlacements(points,{...defaults,follow:false,angle:45},1)[0].angle,Math.PI/4);
  const s={...defaults,scatter:.2,sizeJitter:.1,angleJitter:10};
  assert.deepEqual(stampPlacements(points,s,7),stampPlacements(points,s,7));
  assert.notDeepEqual(stampPlacements(points,s,7),stampPlacements(points,s,8));
});
test('all motifs and outlines produce finite editable geometry',()=>{
  for(const d of BUILTIN_STAMPS){
    const prepared=prepareStamp(d,{...defaults,outline:2,motifScale:1.2});
    assert.ok(prepared.length>d.parts.length);
    const paths=placedStampPaths(prepared,[{x:50,y:50,scale:1,angle:0}],d.name,'test');
    assert.equal(new Set(paths.map(p=>p.id)).size,paths.length);
    for(const p of paths){assert.ok(!/NaN|Infinity/.test(p.d));assert.equal(p.isHole,false);}
    assert.ok(layerContent({...createBlankCanvas().layers.layer_base_paper,baseShape:{type:'freeform',d:''},positiveElements:paths,cutouts:[],stroke:undefined}).bounds);
  }
});
test('library round-trip preserves editable motifs and parameters; invalid input is rejected',()=>{
  const d={...BUILTIN_STAMPS[0],settings:{...defaults,size:83,follow:false,recolor:{'#2E58D6':'#FF0000'}}};
  const [restored]=validateStampLibrary(JSON.parse(JSON.stringify([d])));
  assert.deepEqual(restored.settings,d.settings);
  assert.deepEqual(restored.parts.map(p=>p.d),d.parts.map(p=>p.d));
  assert.throws(()=>validateStampLibrary([{name:'bad',parts:[{d:'<script>',color:'#ffffff'}]}]));
  assert.throws(()=>validateStampLibrary(Array(101).fill(d)));
  const s=normalizeStampSettings({size:Infinity,spacing:-1,angle:999});
  assert.equal(s.size,64);assert.equal(s.spacing,.15);assert.equal(s.angle,180);
});
test('long patterned strips retain bounds and colours after deletion',()=>{
  const d=BUILTIN_STAMPS[0],parts=prepareStamp(d,defaults);
  const paths=placedStampPaths(parts,stampPlacements([{x:50,y:50},{x:19000,y:50}],defaults,1),d.name,'long');
  const layer={...createBlankCanvas().layers.layer_base_paper,baseShape:{type:'freeform' as const,d:''},positiveElements:paths,cutouts:[],stroke:undefined};
  const result=layerContent(layer);assert.equal(result.colors.length,3);assert.ok(result.bounds!.width>18000);
  const reduced=layerContent({...layer,positiveElements:paths.slice(0,6)});
  assert.ok(reduced.bounds!.width<100);
  assert.equal(layerContent({...layer,positiveElements:[]}).bounds,null);
});
