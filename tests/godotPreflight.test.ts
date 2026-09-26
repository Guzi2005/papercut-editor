import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeResourceRoot, assertTextureBudget, checkGodotExport } from '../src/utils/godotPreflight';
import { DEFAULT_GODOT_OPTIONS } from '../src/utils/godotExport';
import { createWeaveCharactersPreset, createPolishAngelPreset, createDoubleFishPreset } from '../src/utils/weavePresets';

test('portable resource paths and project root', () => {
  assert.equal(normalizeResourceRoot(' res://art/paper/ '), 'res://art/paper');
  assert.equal(normalizeResourceRoot('res://'), 'res://');
  for(const path of ['res:', 'res:/', 'art/paper', 'res://../other', 'res://art/../../other', 'res://art\\other', 'res://art//other', 'res://con', 'res://bad\nfolder', 'res://trailing.'])
    assert.throws(()=>normalizeResourceRoot(path), Error, path);
});
test('all original presets pass export validation', () => {
  for(const factory of [createWeaveCharactersPreset, createPolishAngelPreset, createDoubleFishPreset]) {
    const project=factory();
    const result=checkGodotExport(project,DEFAULT_GODOT_OPTIONS);
    assert.deepEqual(result.errors,[],project.name);
    assert.ok(result.partCount>0);
  }
});
test('hidden and loose exclusions match exported selection', () => {
  const project=createWeaveCharactersPreset();
  const all=checkGodotExport(project,DEFAULT_GODOT_OPTIONS);
  project.groups[0].visible=false;
  const filtered=checkGodotExport(project,{...DEFAULT_GODOT_OPTIONS,includeLooseLayers:false});
  assert.ok(filtered.partCount<all.partCount);
  assert.deepEqual(filtered.errors,[]);
  const hidden=checkGodotExport(project,{...DEFAULT_GODOT_OPTIONS,includeHidden:true});
  assert.equal(hidden.partCount,all.partCount);
});
test('invalid ownership and transforms cannot silently corrupt scenes', () => {
  const project=createWeaveCharactersPreset();
  project.items![1].partIds.push(project.items![0].partIds[0]);
  project.items![0].pivot.x=NaN;
  project.items![0].sockets[0].y=Infinity;
  const errors=checkGodotExport(project,DEFAULT_GODOT_OPTIONS).errors.join(' ');
  assert.match(errors,/重复归属/); assert.match(errors,/原点坐标/); assert.match(errors,/挂点/);
});
test('invalid texture dimensions are rejected before canvas allocation', () => {
  assert.doesNotThrow(()=>assertTextureBudget(1000,1000,4,'衣袖'));
  for(const [w,h,s] of [[3000,3000,4],[8193,1,1],[NaN,30,1],[10,Infinity,1]])
    assert.throws(()=>assertTextureBudget(w,h,s,'衣袖'),/衣袖.*贴图过大/);
});
