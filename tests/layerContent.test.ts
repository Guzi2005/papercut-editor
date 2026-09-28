import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBlankCanvas,PRESET_PROJECTS} from '../src/utils/presetTemplates';
import {layerContent} from '../src/utils/layerContent';
import {layerColors} from '../src/utils/color';
import type {CutoutPath,Layer} from '../src/types/papercut';
const rect=(x:number,y:number,w:number,h:number)=>`M ${x} ${y} h ${w} v ${h} h ${-w} Z`;
const piece=(id:string,d:string,isHole:boolean,color='#0000ff',createdAt=1):CutoutPath=>({id,name:id,type:'custom_polygon',d,isHole,fillColor:color,createdAt});
const base=():Layer=>({...createBlankCanvas().layers.layer_base_paper,color:'#ff0000',baseShape:{type:'freeform',d:rect(0,0,100,100)},stroke:undefined});
test('edge cuts shrink bounds; complete cuts remove colors and bounds',()=>{
  const l=base();assert.equal(layerContent(l).bounds?.width,100);
  const cut={...l,cutouts:[piece('hole',rect(50,-10,60,120),true)]};
  assert.deepEqual(layerContent(cut).bounds,{x:0,y:0,width:50,height:100});
  const empty={...cut,cutouts:[piece('hole',rect(-10,-10,120,120),true)]};
  assert.deepEqual(layerColors(empty),[]);assert.equal(layerContent(empty).bounds,null);
});
test('covered colors disappear and return after deletion or undo',()=>{
  const l=base(),p=piece('blue',rect(0,0,100,100),false);
  const covered={...l,positiveElements:[p]};
  assert.deepEqual(layerColors(covered),['#0000FF']);
  assert.deepEqual(layerColors({...covered,positiveElements:[]}),['#FF0000']);
  assert.deepEqual(layerColors(covered),['#0000FF']);
});
test('later applique can restore cut paper; empty base still allows applique',()=>{
  const l={...base(),baseShape:{type:'freeform' as const,d:''},cutouts:[piece('hole',rect(-10,-10,120,120),true,'#fff',1)],positiveElements:[piece('blue',rect(20,20,10,10),false,'#00f',2)]};
  assert.deepEqual(layerContent(l).bounds,{x:20,y:20,width:10,height:10});
  assert.deepEqual(layerColors(l),['#0000FF']);
});
test('clipped drawings and zero opacity strokes do not leave phantom colours',()=>{
  const l={...base(),drawings:[{id:'d',brushType:'pen' as const,d:rect(200,200,20,20),fill:true,color:'#00ff00',opacity:1,strokeWidth:2}]};
  assert.deepEqual(layerColors(l),['#FF0000']);
  assert.equal(layerContent(l).bounds?.width,100);
  const blank={...l,kind:'doodle' as const,drawings:[{...l.drawings[0],opacity:0}]};
  assert.deepEqual(layerColors(blank),[]);
});
test('all bundled artwork can be analyzed',()=>{
  for(const preset of PRESET_PROJECTS)for(const layer of Object.values(preset.factory().layers))assert.doesNotThrow(()=>layerContent(layer));
});
