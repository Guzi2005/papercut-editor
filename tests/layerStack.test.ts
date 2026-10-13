import {test} from 'node:test';
import assert from 'node:assert/strict';
import {flatStack,reorderStack} from '../src/utils/layerStack';
import {flattenLayerIds,computeDepthTable} from '../src/utils/projectOps';
import {createWeaveCharactersPreset} from '../src/utils/weavePresets';
import {exportStreet} from '../src/utils/exportStreet';

test('legacy depth conversion preserves order, effective visibility and item identity',()=>{
  const p=createWeaveCharactersPreset();p.groups[0].visible=false;p.groups[0].locked=true;
  const next=flatStack(p);
  assert.deepEqual(flattenLayerIds(next),flattenLayerIds(p));assert.equal(next.groups.length,0);
  assert.deepEqual(next.items,p.items);
  for(const id of p.groups[0].layerIds){assert.equal(next.layers[id].visible,false);assert.equal(next.layers[id].locked,true);}
  assert.notEqual(next,p);assert.ok(p.groups.length>0);
});

test('SVG order and Godot z agree across interleaved item parts',()=>{
  const p=flatStack(createWeaveCharactersPreset()),ids=flattenLayerIds(p);
  const source=ids[0],target=ids.at(-1)!;
  const next=reorderStack(p,source,target,'above'),order=flattenLayerIds(next);
  // Isolate the ordering contract from paper masks / decorative cutouts.
  for(const id of order)next.layers[id]={...next.layers[id],visible:true,cutouts:[],positiveElements:[],drawings:[],pattern:undefined,stroke:undefined,surface:undefined,blendMode:'normal'};
  const svg=exportStreet(next),{zOf}=computeDepthTable(next);
  const rendered=Array.from(svg.matchAll(/<g id="([^"]+)" opacity=/g),m=>m[1]);
  assert.deepEqual(rendered,order);
  assert.deepEqual(order.map(id=>zOf[id]),order.map((_,i)=>i));
  assert.deepEqual(next.items,p.items);
});
test('cross-item and cross-group reorder affects one global stack and preserves membership',()=>{
  const p=createWeaveCharactersPreset(),ids=flattenLayerIds(p),source=ids[0],target=ids.at(-1)!;
  p.groups[0].visible=false;
  const next=reorderStack(p,source,target,'above');
  assert.deepEqual(flattenLayerIds(next),[...ids.slice(1),source]);assert.equal(next.layers[source].visible,false);
  assert.deepEqual(next.items,p.items);
  assert.equal(reorderStack(p,'missing',target,'above'),p);
  const {zOf}=computeDepthTable(p);assert.deepEqual(ids.map(id=>zOf[id]),ids.map((_,i)=>i));
});
