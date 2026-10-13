import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createColorScheme, exportGpl, mapSchemeRoles, nearestPaletteMapping, paletteDraftSnapshot, parsePaletteDrafts, parsePaletteFile, quantizePalette, replaceExtractedColors, schemeColorMapping, validateColorSchemes } from '../src/utils/palettes';
import { createBlankCanvas } from '../src/utils/presetTemplates';
import { parseProjectFile, serializeProject } from '../src/utils/storage';
import { normalizeProject } from '../src/utils/projectOps';

test('palette extraction is deterministic, respects crop, alpha and image proportions', () => {
  const pixels = Uint8ClampedArray.from([
    220, 30, 40, 255, 220, 30, 40, 255, 220, 30, 40, 255, 40, 70, 180, 255,
    0, 255, 0, 0, 40, 70, 180, 255, 240, 230, 200, 255, 240, 230, 200, 255,
  ]);
  const colors = quantizePalette(pixels, 4, 2, 3);
  assert.deepEqual(colors, quantizePalette(pixels, 4, 2, 3));
  assert.equal(colors[0].hex, '#DC1E28');
  assert.equal(colors[0].weight, 3 / 7);
  assert.equal(colors.length, 3);
  assert.ok(Math.abs(colors.reduce((sum, c) => sum + c.weight, 0) - 1) < 1e-9);
  assert.deepEqual(quantizePalette(pixels, 4, 2, 4, { x: 2, y: 1, width: 2, height: 1 }).map(c => c.hex), ['#F0E6C8']);
  assert.equal(quantizePalette(pixels, 4, 2, 3, undefined, { excludedColors: ['#DC1E28'] }).length, 2);
  assert.deepEqual(quantizePalette(pixels, 4, 2, 8, { x: 99, y: 99, width: 2, height: 1 }), []);
  assert.throws(() => quantizePalette(pixels, 4, 20));
});

test('excluded background cannot erase a tiny accent manually kept as locked colour', () => {
  const rgba = new Uint8ClampedArray(400);
  for (let i = 0; i < 100; i++) rgba.set(i === 99 ? [240, 185, 40, 255] : [220, 220, 210, 255], i * 4);
  const extracted = quantizePalette(rgba, 10, 10, 8, undefined, { excludedColors: ['#DDDCD3'], exclusionDistance: 14 });
  assert.deepEqual(extracted.map(c => c.hex), ['#F0B928']);
  assert.equal(extracted[0].weight, 1);
  const manuallyPicked = createColorScheme(['#F0B928']); manuallyPicked.swatches[0].locked = true;
  const kept = replaceExtractedColors(manuallyPicked, [{ hex: '#DFDFD2', weight: 1, x: 0, y: 0 }]);
  assert.equal(kept.swatches[0].hex, '#F0B928');
  assert.equal(kept.swatches[0].weight, 0);
  assert.equal(kept.swatches[0].sample, undefined);
});

test('bounded recovery and project transport retain roles, source colours and all schemes', () => {
  const recent = Array.from({ length: 20 }, (_, i) => createColorScheme(['#285B70'], `草稿 ${i}`));
  const active = createColorScheme(['#fff', '#d22'], '衣袖色卡', '参考照片');
  active.swatches[0].hex = '#F4E6CC'; active.swatches[0].role = 'thread'; active.swatches[0].locked = true;
  const snapshot = paletteDraftSnapshot(active, recent);
  assert.equal(snapshot.drafts.length, 12);
  const recovered = parsePaletteDrafts(JSON.stringify(snapshot));
  assert.equal(recovered.activeId, active.id);
  assert.deepEqual(recovered.drafts.at(-1), active);
  assert.throws(() => parsePaletteDrafts(JSON.stringify({ version: 1, drafts: recent })));
  const project = { ...createBlankCanvas(), colorSchemes: [active, ...recent] };
  const roundTrip = parseProjectFile(serializeProject(project));
  assert.deepEqual(roundTrip.colorSchemes, project.colorSchemes);
  assert.throws(() => parseProjectFile(serializeProject({ ...project, colorSchemes: [{ ...active, swatches: [{ ...active.swatches[0], hex: 'bogus' }] }] })));
});

test('portable JSON/GPL round trips source colours, roles and deliberate replacements', () => {
  const scheme = createColorScheme(['#abc', '#D4262F'], '蓝印方案', '衣袖参考');
  scheme.swatches[0].hex = '#295F74'; scheme.swatches[0].locked = true;
  const restored = parsePaletteFile(JSON.stringify({ version: 1, schemes: [scheme] }))[0];
  assert.deepEqual(restored, scheme);
  assert.deepEqual(schemeColorMapping(restored), { '#AABBCC': '#295F74' });
  const gpl = parsePaletteFile(exportGpl(scheme))[0];
  assert.equal(gpl.name, scheme.name);
  assert.deepEqual(gpl.swatches.map(s => s.hex), scheme.swatches.map(s => s.hex));
  assert.deepEqual(gpl.swatches.map(s => s.name), scheme.swatches.map(s => s.name));
  assert.throws(() => parsePaletteFile('GIMP Palette\n999 0 0 bad'));
  assert.throws(() => parsePaletteFile('a'.repeat(1_000_001)));
  assert.throws(() => validateColorSchemes([{ swatches: [{ hex: 'javascript:' }] }]));
  assert.throws(() => validateColorSchemes(Array(101).fill(scheme)));
});

test('workspace recovery retains drawings and valid schemes when optional palette metadata is damaged',()=>{
  const valid=createColorScheme(['#285B70'],'保留方案'),p=createBlankCanvas();
  p.colorSchemes=[valid,{...valid,id:'broken',swatches:[{...valid.swatches[0],hex:'invalid'}]}];
  assert.throws(()=>normalizeProject(p));
  const recovered=normalizeProject(p,true);
  assert.deepEqual(recovered.layers,p.layers);
  assert.deepEqual(recovered.colorSchemes,[valid]);
});

test('colour mapping matches palette roles, nearest colours and locked extraction without cascading', () => {
  const old = createColorScheme(['#FF0000', '#0000FF']), next = createColorScheme(['#B42030', '#203090']);
  next.swatches[0].role = old.swatches[1].role; next.swatches[1].role = old.swatches[0].role;
  assert.deepEqual(mapSchemeRoles(old, next), { '#FF0000': '#203090', '#0000FF': '#B42030' });
  assert.deepEqual(nearestPaletteMapping(['#EE1111', '#0011CC'], next), { '#EE1111': '#B42030', '#0011CC': '#203090' });
  old.swatches[0].locked = true; old.swatches[0].hex = '#B42030';
  const updated = replaceExtractedColors(old, [{ hex: '#FF0000', weight: .6, x: 4, y: 5 }, { hex: '#FFF5DF', weight: .4, x: 8, y: 1 }]);
  assert.equal(updated.id, old.id);
  assert.equal(updated.swatches[0].hex, old.swatches[0].hex);
  assert.equal(updated.swatches[0].sourceHex, old.swatches[0].sourceHex);
  assert.equal(updated.swatches[0].locked, true);
  assert.equal(updated.swatches[0].weight, .6);
  assert.deepEqual(updated.swatches[0].sample, { x: 4, y: 5 });
  assert.deepEqual(updated.swatches.map(s => s.hex), ['#B42030', '#FFF5DF']);
  assert.deepEqual(old.swatches.map(s => s.hex), ['#B42030', '#0000FF']);
  const embroidery = createColorScheme(['#FF0000', '#0000FF', '#FFFF00']);
  embroidery.swatches.forEach(s => { s.role = 'thread'; });
  const variant = structuredClone(embroidery); variant.swatches[0].hex = '#00FF00'; variant.swatches[1].hex = '#FF00FF'; variant.swatches[2].hex = '#00FFFF';
  assert.deepEqual(mapSchemeRoles(embroidery, variant), { '#FF0000': '#00FF00', '#0000FF': '#FF00FF', '#FFFF00': '#00FFFF' });
});
