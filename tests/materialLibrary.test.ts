import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BUILTIN_STAMPS,DEFAULT_STAMP_SETTINGS,validateStampLibrary} from '../src/utils/stamps';
import {definitionForMode,libraryForMode,motifMode,ribbonTileSettings} from '../src/utils/materialLibrary';

test('stamp and ribbon tabs partition saved recipes without duplicate or missing entries',()=>{
  const stamps=libraryForMode(BUILTIN_STAMPS,'stamp'),ribbons=libraryForMode(BUILTIN_STAMPS,'ribbon');
  assert.equal(stamps.length,24);assert.equal(ribbons.length,4);
  assert.deepEqual(new Set([...stamps,...ribbons].map(d=>d.id)),new Set(BUILTIN_STAMPS.map(d=>d.id)));
  assert.ok(stamps.every(d=>motifMode(d)==='stamp'));
});
test('using a stamp for ribbon production preserves source and snapshots independent recipe colors',()=>{
  const source=structuredClone(BUILTIN_STAMPS[0]),before=structuredClone(source),current={...DEFAULT_STAMP_SETTINGS,ribbonRows:3,selvage:'cross' as const};
  const ribbon=definitionForMode(source,'ribbon',current);
  assert.equal(ribbon.settings!.mode,'ribbon');assert.equal(ribbon.settings!.ribbonRows,3);
  ribbon.settings!.skipColors.push('#000000');ribbon.settings!.recolor['#FF0000']='#FFFFFF';
  assert.deepEqual(source,before);assert.equal(current.skipColors.length,3);
  assert.equal(validateStampLibrary([ribbon])[0].settings!.mode,'ribbon');
});
test('selected library recipe wins over prior brush settings and preview retains proportions',()=>{
  const recipe=BUILTIN_STAMPS.find(d=>motifMode(d)==='ribbon')!,before=structuredClone(recipe);
  const converted=definitionForMode(recipe,'stamp',{...DEFAULT_STAMP_SETTINGS,size:200});
  assert.equal(converted.settings!.size,recipe.settings!.size);assert.equal(converted.settings!.mode,'stamp');
  const preview=ribbonTileSettings(recipe);
  assert.ok(preview.ribbonWidth<=42);assert.ok(Math.abs(preview.ribbonWidth/preview.size-recipe.settings!.ribbonWidth/recipe.settings!.size)<1e-12);
  assert.deepEqual(recipe,before);
});
