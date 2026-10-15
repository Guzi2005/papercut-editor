import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Layer, PapercutProject, Point } from '../src/types/papercut';
import { createDrawingGroup, convertDrawingGroupToItem, deleteProjectLayers, duplicateProjectLayers, getLayerEffectiveState, normalizeDrawingGroups, pasteProjectLayers, transformProjectLayers, ungroupDrawingGroup } from '../src/utils/drawingGroups';
import { computeDepthTable, flattenLayerIds, isLayerRendered, normalizeProject, transformLayer } from '../src/utils/projectOps';
import { flatStack, reorderStack } from '../src/utils/layerStack';
import { applySymmetry, symmetryMatrices } from '../src/utils/symmetry';
import { translate, transformPathD } from '../src/utils/pathTransform';
import { attachLiveStampStroke, createLiveStampStroke, detachChangedLiveStamps, regenerateLiveStampLayer } from '../src/utils/liveStamps';
import { BUILTIN_STAMPS, DEFAULT_STAMP_SETTINGS } from '../src/utils/stamps';
import { applySchemeColors } from '../src/utils/schemeApply';
import {generateSvgMarkup} from '../src/utils/svgExporter';
import {exportStreet} from '../src/utils/exportStreet';
import {checkGodotExport} from '../src/utils/godotPreflight';
import {DEFAULT_GODOT_OPTIONS} from '../src/utils/godotExport';

function fixture(): PapercutProject {
  const layer = (id: string): Layer => ({ id, name: id, color: '#123456', texture: 'smooth', opacity: 1, blendMode: 'normal', visible: true, locked: false,
    baseShape: { type: 'freeform', d: 'M 0 0 L 10 0 L 10 10 Z' }, cutouts: [], positiveElements: [] });
  return { id: 'test', name: 'test', width: 100, height: 100, layers: Object.fromEntries(['a','b','c'].map(id => [id, layer(id)])),
    groups: [], rootOrder: ['a','b','c'].map(id => ({ type: 'layer', id })), backgroundColor: '#ffffff', backgroundStyle: 'clean_white',
    items: [{ id: 'clothes', name: '衣服', wardrobeCategory: 'clothes', partIds: ['a','c'], pivot: { x: 5, y: 5 }, sockets: [{ id: 'socket', name: '袖口', x: 10, y: 5 }] }],
    outfits: [{ id: 'outfit', name: '套装', clothes: ['clothes'], shoes: [], headwear: [] }] };
}

test('hidden logical groups agree across SVG, game export and Godot while leaving global depth unchanged',()=>{
  const {project,group}=createDrawingGroup(fixture(),['a','c']);assert.ok(group);group.visible=false;
  const svg=generateSvgMarkup(project),game=exportStreet(project);
  for(const output of [svg,game]){
    assert.match(output,/id="b"/);assert.doesNotMatch(output,/id="a"|id="c"/);
  }
  assert.equal(checkGodotExport(project,DEFAULT_GODOT_OPTIONS).partCount,1);
  assert.equal(checkGodotExport(project,{...DEFAULT_GODOT_OPTIONS,includeHidden:true}).partCount,3);
  assert.deepEqual(computeDepthTable(project).zOf,{a:0,b:1,c:2});
});

test('drawing groups never change interleaved render depth or Item ownership', () => {
  const p = fixture(), { project, group } = createDrawingGroup(p, ['c','a','a','missing'], '衣袖');
  assert.ok(group); assert.deepEqual(group.layerIds, ['a','c']);
  assert.deepEqual(flattenLayerIds(project), ['a','b','c']);
  assert.deepEqual(computeDepthTable(project), computeDepthTable(p));
  assert.deepEqual(project.items, p.items);
  const moved = reorderStack(project, 'a', 'c', 'above');
  assert.deepEqual(moved.drawingGroups, project.drawingGroups);
  assert.deepEqual(flattenLayerIds(moved), ['b','c','a']);
  assert.deepEqual(ungroupDrawingGroup(project, group.id).rootOrder, p.rootOrder);
  assert.equal(p.drawingGroups, undefined);
});

test('group hiding and locking are shared by render, recolor and ungrouping', () => {
  const created = createDrawingGroup(fixture(), ['a','c']), group = created.group!;
  const p = { ...created.project, drawingGroups: [{ ...group, visible: false, locked: true }] };
  assert.deepEqual(getLayerEffectiveState(p, 'a'), { visible: false, locked: true });
  assert.equal(isLayerRendered(p, 'a'), false); assert.equal(isLayerRendered(p, 'b'), true);
  assert.equal(applySchemeColors(p, { '#123456': '#ffffff' }, ['a']).layers.a.color, '#123456');
  assert.equal(p.layers.a.visible, true); assert.equal(p.layers.a.locked, false);
  const next = ungroupDrawingGroup(p, group.id);
  assert.equal(next.layers.a.visible, false); assert.equal(next.layers.a.locked, true);
  assert.deepEqual(next.items, p.items); assert.deepEqual(next.rootOrder, p.rootOrder);
});

test('legacy depth migration retains named editing membership and bakes old state exactly once', () => {
  const p = fixture(); p.groups = [{ id: 'old', name: '旧组', collapsed: true, visible: false, locked: true, layerIds: ['a','c'] }];
  p.rootOrder = [{ type: 'group', id: 'old' }, { type: 'layer', id: 'b' }];
  const next = flatStack(p);
  assert.deepEqual(flattenLayerIds(next), ['a','c','b']); assert.equal(next.groups.length, 0);
  assert.deepEqual(next.drawingGroups, [{ ...p.groups[0], visible: true, locked: false }]);
  assert.deepEqual(getLayerEffectiveState(next, 'c'), { visible: false, locked: true });
  assert.equal(flatStack(next), next);
});

test('group normalization drops dangling/duplicate identities and conflicting membership', () => {
  const p = fixture(), base = { name: '组', collapsed: false, visible: true, locked: false };
  const normalized = normalizeDrawingGroups([{ ...base, id: 'g', layerIds: ['a','a','missing'] }, { ...base, id: 'g', layerIds: ['b'] },
    { ...base, id: 'h', layerIds: ['a','c'] }, { ...base, id: 'empty', layerIds: ['missing'] }], p.layers);
  assert.deepEqual(normalized.map(group => [group.id,group.layerIds]), [['g',['a']],['h',['c']]]);
  assert.deepEqual(normalizeProject({ ...p, drawingGroups: normalized }).drawingGroups, normalized);
});

test('group conversion adds Item semantics to the same ids and requires explicit ownership reassignment', () => {
  const p = fixture(), created = createDrawingGroup(p, ['a','b']);
  assert.throws(() => convertDrawingGroupToItem(created.project, created.group!.id), /已属于物件/);
  const converted = convertDrawingGroupToItem(created.project, created.group!.id, { reassign: true, pivot: { x: 2, y: 3 } });
  assert.deepEqual(converted.item!.partIds, ['a','b']); assert.deepEqual(converted.item!.pivot, { x: 2, y: 3 });
  assert.deepEqual(converted.project.rootOrder, p.rootOrder); assert.deepEqual(converted.project.drawingGroups, created.project.drawingGroups);
  assert.deepEqual(converted.project.items![0].partIds, ['c']);
});

test('deleting all members repairs group, Item and outfit references atomically', () => {
  const p = createDrawingGroup(fixture(), ['a','c']).project, next = deleteProjectLayers(p, ['a','c']);
  assert.deepEqual(Object.keys(next.layers), ['b']); assert.deepEqual(next.drawingGroups, []); assert.deepEqual(next.items, []);
  assert.deepEqual(next.outfits![0].clothes, []); assert.deepEqual(flattenLayerIds(next), ['b']);
  assert.deepEqual(p.items![0].partIds, ['a','c']);
});

test('partial duplicate joins drawing group/Item while whole membership gets independent identities', () => {
  const p = createDrawingGroup(fixture(), ['a','c']).project;
  const partial = duplicateProjectLayers(p, ['a']);
  assert.deepEqual(partial.project.drawingGroups![0].layerIds, ['a',partial.idMap.a,'c']);
  assert.deepEqual(partial.project.items![0].partIds, ['a',partial.idMap.a,'c']);
  assert.equal(partial.groupIds.length, 0); assert.equal(partial.itemIds.length, 0);
  const all = duplicateProjectLayers(p, ['a','c']);
  assert.equal(all.groupIds.length, 1); assert.equal(all.itemIds.length, 1);
  assert.deepEqual(all.project.drawingGroups![1].layerIds, all.layerIds);
  assert.deepEqual(all.project.items![1].partIds, all.layerIds);
  assert.notEqual(all.project.items![1].sockets[0].id, 'socket');
  all.project.items![1].pivot.x = 999; assert.equal(p.items![0].pivot.x, 5);
});

test('duplicated live stamps keep recipes editable with remapped cache ids', () => {
  const p = fixture(), live = createLiveStampStroke(BUILTIN_STAMPS[0], DEFAULT_STAMP_SETTINGS, [{ x: 10, y: 10 }], 10, 'source_stamp');
  p.layers.a = attachLiveStampStroke({ ...p.layers.a, positiveElements: live.paths }, live.stroke);
  const result = duplicateProjectLayers(p, ['a']), copied = result.project.layers[result.layerIds[0]], stroke = copied.liveStamps![0];
  assert.notEqual(stroke.id, live.stroke.id); assert.equal(detachChangedLiveStamps(copied).liveStamps!.length, 1);
  assert.equal(new Set([...live.stroke.pathIds,...stroke.pathIds]).size, live.stroke.pathIds.length + stroke.pathIds.length);
  const regenerated = regenerateLiveStampLayer(copied, stroke.id, { settings: { size: 70 } });
  assert.equal(regenerated.liveStamps!.length, 1); assert.notDeepEqual(regenerated.positiveElements, copied.positiveElements);
  copied.liveStamps![0].definition.parts[0].color = '#ffffff'; assert.notEqual(p.layers.a.liveStamps![0].definition.parts[0].color, '#ffffff');
});

test('clipboard paste imports groups, Item outfits and shared fabric without overwriting target assets', () => {
  const source = createDrawingGroup(fixture(), ['a','c']).project, target = fixture();
  source.fabricAssets = { cloth: { id: 'cloth', name: '源布料', src: 'data:image/png;base64,AA', width: 10, height: 10 } };
  target.fabricAssets = { cloth: { id: 'cloth', name: '目标布料', src: 'data:image/png;base64,BB', width: 10, height: 10 } };
  source.layers.a.fabric = { assetId: 'cloth', transform: [1,0,0,1,0,0], opacity: 1, repeat: 'tile' }; source.layers.c.fabric = structuredClone(source.layers.a.fabric);
  const pasted = pasteProjectLayers(target, source, ['a','c']), next = pasted.project;
  const assetId = next.layers[pasted.idMap.a].fabric!.assetId;
  assert.notEqual(assetId, 'cloth'); assert.equal(next.layers[pasted.idMap.c].fabric!.assetId, assetId);
  assert.equal(next.fabricAssets!.cloth.name, '目标布料'); assert.equal(next.fabricAssets![assetId].name, '源布料');
  assert.deepEqual(flattenLayerIds(next), ['a','b','c',...pasted.layerIds]); assert.equal(pasted.groupIds.length, 1); assert.equal(pasted.itemIds.length, 1);
  assert.deepEqual(next.outfits!.at(-1)!.clothes, pasted.itemIds);
  assert.equal(target.drawingGroups, undefined); assert.equal(Object.keys(target.layers).length, 3);
});

test('whole-Item transforms move pivot/socket while a partial edit leaves metadata fixed', () => {
  const p = fixture(), m = translate(20,30), all = transformProjectLayers(p, ['a','c'], m), partial = transformProjectLayers(p, ['a'], m);
  assert.deepEqual(all.items![0].pivot, { x: 25, y: 35 }); assert.deepEqual(all.items![0].sockets[0], { id: 'socket', name: '袖口', x: 30, y: 35 });
  assert.deepEqual(partial.items, p.items); assert.equal(all.layers.b, p.layers.b);
});

test('moving a symmetric source conjugates instances and warp expands it safely', () => {
  const p = fixture(), d = 'M 1 1 L 2 1 L 2 2 Z', matrices = symmetryMatrices({ kind: 'mirror', count: 1, angle: 90, cx: 50, cy: 50 },100,100);
  p.layers.a.positiveElements = [{ id: 'path', name: '对称', type: 'custom_polygon', isHole: false, createdAt: 1,
    d: applySymmetry(d,matrices), symmetrySource: { d, matrices }, points: [{ x: 1, y: 1 }, { x: 2, y: 1 }], vectorNodeModes: [['corner','corner']] }];
  const moved = transformLayer(p.layers.a,translate(10,20)).positiveElements[0];
  assert.equal(moved.symmetrySource!.d, transformPathD(d,translate(10,20)));
  assert.equal(applySymmetry(moved.symmetrySource!.d,moved.symmetrySource!.matrices), moved.d);
  assert.deepEqual(moved.points, [{ x: 11, y: 21 }, { x: 12, y: 21 }]);
  const warped = transformLayer(p.layers.a,{ approx: [1,0,0,1,0,0], map: (p: Point) => ({ x: p.x, y: p.y + p.x*.1 }) }).positiveElements[0];
  assert.equal(warped.symmetrySource, undefined); assert.equal(warped.points, undefined); assert.equal(warped.vectorNodeModes, undefined); assert.ok(warped.d);
});

test('malformed symmetry metadata drops source handles while retaining baked render geometry', () => {
  const p = fixture();
  p.layers.a.positiveElements = [{ id: 'bad', name: 'bad', type: 'custom_polygon', isHole: false, createdAt: 1,
    d: 'M 1 1 L 2 1 L 2 2 Z', points: [{ x: 1, y: 1 }], symmetrySource: { d: 'M 1 1 L 2 2', matrices: [[1,0,0,1,NaN,0]] } }];
  const next = normalizeProject(p).layers.a.positiveElements[0];
  assert.equal(next.symmetrySource, undefined); assert.equal(next.points, undefined); assert.equal(next.d, p.layers.a.positiveElements[0].d);
});
