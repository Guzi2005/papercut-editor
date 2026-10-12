import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BUILTIN_STAMPS,DEFAULT_STAMP_SETTINGS as defaults,stampPlacements,prepareStamp,placedStampPaths,validateStampLibrary,normalizeStampSettings,ribbonBasePaths,stampStrokePaths} from '../src/utils/stamps';
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

test('ribbons produce a continuous editable band behind repeated motifs in a single stroke',()=>{
  const s={...defaults,mode:'ribbon' as const,size:40,ribbonWidth:60,ribbonEdge:2,ribbonColor:'#FFFFFF',ribbonEdgeColor:'#000000'};
  const points=[{x:100,y:100},{x:300,y:100}];
  const paths=stampStrokePaths(BUILTIN_STAMPS[0],s,points,1,'ribbon');
  assert.equal(paths.length,2+6*BUILTIN_STAMPS[0].parts.length);
  assert.equal(paths[0].fillColor,'#000000');assert.equal(paths[1].fillColor,'#FFFFFF');
  const layer={...createBlankCanvas().layers.layer_base_paper,baseShape:{type:'freeform' as const,d:''},cutouts:[],positiveElements:paths.slice(0,2),stroke:undefined};
  const content=layerContent(layer);
  assert.deepEqual(content.bounds,{x:80,y:68,width:240,height:64});
  assert.ok(paths.every(p=>p.isHole===false&&!/NaN|Infinity/.test(p.d)));
  assert.equal(ribbonBasePaths(points,defaults,'stamp').length,0);
  assert.equal(ribbonBasePaths(points,{...s,ribbonFill:false},'transparent').length,0);
  assert.equal(ribbonBasePaths(points,{...s,ribbonEdge:0},'no-edge').length,1);
});

test('ribbon tile spacing remains stable and turns with its path even when stamp rotation is fixed',()=>{
  const s={...defaults,mode:'ribbon' as const,follow:false,size:20};
  const sparse=[{x:0,y:0},{x:0,y:100}],dense=Array.from({length:101},(_,y)=>({x:0,y}));
  assert.deepEqual(stampPlacements(sparse,s,7),stampPlacements(dense,s,7));
  assert.equal(stampPlacements(sparse,s,7)[0].angle,Math.PI/2);
  assert.deepEqual(ribbonBasePaths(sparse,s,'same').map(p=>p.d),ribbonBasePaths(dense,s,'same').map(p=>p.d));
  for(const points of [[{x:30,y:30}],[{x:30,y:30},{x:30,y:30}],[{x:30,y:30},{x:90,y:30},{x:90,y:100}]])assert.ok(ribbonBasePaths(points,s,'test').every(p=>p.d.length>0&&!/NaN|Infinity/.test(p.d)));
});

test('old libraries default to stamp mode while ribbon recipes round-trip all band controls',()=>{
  const legacy=normalizeStampSettings({size:83});assert.equal(legacy.mode,'stamp');assert.equal(legacy.ribbonWidth,80);
  const [recipe]=validateStampLibrary([{...BUILTIN_STAMPS[0],settings:{...defaults,mode:'ribbon',ribbonWidth:92,ribbonFill:false,ribbonColor:'#998877',ribbonEdge:4,ribbonEdgeColor:'#445566'}}]);
  assert.equal(recipe.settings!.mode,'ribbon');assert.equal(recipe.settings!.ribbonWidth,92);assert.equal(recipe.settings!.ribbonFill,false);assert.equal(recipe.settings!.ribbonEdgeColor,'#445566');
  assert.equal(normalizeStampSettings({ribbonWidth:999,ribbonEdge:-5}).ribbonWidth,400);
  assert.equal(normalizeStampSettings({ribbonWidth:999,ribbonEdge:-5}).ribbonEdge,0);
});
