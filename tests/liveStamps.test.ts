import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBlankCanvas } from '../src/utils/presetTemplates';
import { BUILTIN_STAMPS, DEFAULT_STAMP_SETTINGS } from '../src/utils/stamps';
import { attachLiveStampStroke, createLiveStampStroke, detachChangedLiveStamps, expandLiveStampStroke, liveStampWorldPoints, normalizeLiveStamps, regenerateLiveStampLayer, transformLiveStrokes, type LiveStampLayer } from '../src/utils/liveStamps';
import { multiply, rotateAbout, scaleAbout, transformPathD, translate } from '../src/utils/pathTransform';
import { paperSequence } from '../src/utils/layerSvg';

function example(kind: 'paper' | 'doodle' = 'paper') {
  const { stroke, paths } = createLiveStampStroke(BUILTIN_STAMPS[0], { ...DEFAULT_STAMP_SETTINGS, size: 40 }, [{ x: 50, y: 50 }, { x: 250, y: 50 }], 73, 'live_1');
  const base = { ...createBlankCanvas().layers.layer_base_paper, kind, baseShape: { type: 'freeform' as const, d: '' }, cutouts: [] };
  const layer: LiveStampLayer = kind === 'doodle'
    ? { ...base, positiveElements: [], drawings: paths.map(p => ({ id: p.id, d: p.d, color: p.fillColor!, fill: true, opacity: 1, strokeWidth: 1, brushType: 'pen' })) }
    : { ...base, positiveElements: paths };
  return { stroke, paths, layer: attachLiveStampStroke(layer, stroke) };
}

test('live motifs snapshot library geometry, settings, and pointer samples', () => {
  const definition = { ...BUILTIN_STAMPS[0], parts: BUILTIN_STAMPS[0].parts.map(p => ({ ...p })) };
  const settings = { ...DEFAULT_STAMP_SETTINGS, recolor: { '#2E58D6': '#FF0000' }, skipColors: ['#111111'] }, points = [{ x: 30, y: 40 }];
  const { stroke } = createLiveStampStroke(definition, settings, points, 1, 'isolated');
  definition.parts[0].d = ''; settings.recolor['#2E58D6'] = '#000000'; settings.skipColors[0] = '#FFFFFF'; points[0].x = 999;
  assert.ok(stroke.definition.parts[0].d);
  assert.equal(stroke.settings.recolor['#2E58D6'], '#FF0000');
  assert.deepEqual(stroke.settings.skipColors, ['#111111']);
  assert.deepEqual(stroke.points, [{ x: 30, y: 40 }]);
});

test('regeneration replaces only owned native geometry in place, retaining IDs and later cuts', () => {
  const { layer, paths, stroke } = example();
  const before = { ...paths[0], id: 'before', createdAt: paths[0].createdAt - 1 }, after = { ...paths[0], id: 'after', createdAt: Math.floor(paths[0].createdAt) + 1 };
  const hole = { ...after, id: 'hole', isHole: true, createdAt: after.createdAt + 1 };
  const input = { ...layer, positiveElements: [before, ...paths, after], cutouts: [hole] };
  const result = regenerateLiveStampLayer(input, stroke.id, { settings: { spacing: 2, ribbonColor: '#112233' } });
  assert.equal(result.positiveElements[0], before);
  assert.equal(result.positiveElements.at(-1), after);
  assert.equal(result.cutouts[0], hole);
  assert.ok(result.positiveElements.length < input.positiveElements.length);
  assert.equal(result.positiveElements[1].id, paths[0].id);
  const seq = paperSequence(result), ids = new Set(result.liveStamps![0].pathIds);
  assert.ok(seq.filter(p => ids.has(p.id)).every(p => p.createdAt < after.createdAt));
  assert.equal(seq.at(-1)?.id, 'hole');
  assert.deepEqual(detachChangedLiveStamps(result), result);
});

test('doodle strokes regenerate within drawings and keep other marks in their original order', () => {
  const { layer, stroke } = example('doodle');
  const original = layer.drawings![0], other = { ...original, id: 'pencil' };
  const result = regenerateLiveStampLayer({ ...layer, drawings: [other, ...layer.drawings!] }, stroke.id, { settings: { spacing: 2 } });
  assert.equal(result.drawings![0], other);
  assert.ok(result.drawings!.length < layer.drawings!.length + 1);
  assert.equal(result.drawings![1].id, original.id);
  assert.deepEqual(detachChangedLiveStamps(result), result);
});

test('expanding or manually editing one cached path preserves its visible artwork', () => {
  const { layer, stroke } = example();
  const expanded = expandLiveStampStroke(layer, stroke.id);
  assert.deepEqual(expanded.liveStamps, []);
  assert.equal(expanded.positiveElements, layer.positiveElements);
  const edited = { ...layer, positiveElements: layer.positiveElements.map((p, i) => i ? p : { ...p, d: 'M 0 0 H 10 V 10 Z' }) };
  const detached = detachChangedLiveStamps(edited);
  assert.deepEqual(detached.liveStamps, []);
  assert.equal(detached.positiveElements, edited.positiveElements);
  assert.deepEqual(regenerateLiveStampLayer(edited, stroke.id, { settings: { size: 100 } }).positiveElements, edited.positiveElements);
  assert.deepEqual(detachChangedLiveStamps({ ...layer, positiveElements: layer.positiveElements.slice(1) }).liveStamps, []);
});

test('object translation rotation scale and reflection preserve a recipe without changing source size', () => {
  const { layer, stroke } = example();
  const transforms = [translate(30, -10), rotateAbout(Math.PI / 2, 0, 0), scaleAbout(.05, 0, 0), [-1, 0, 0, 1, 300, 0] as const];
  for (const matrix of transforms) {
    const m = [...matrix] as [number, number, number, number, number, number];
    const moved = { ...layer, positiveElements: layer.positiveElements.map(p => ({ ...p, d: transformPathD(p.d, m) })), liveStamps: transformLiveStrokes(layer, m) };
    assert.equal(moved.liveStamps![0].settings.size, stroke.settings.size);
    assert.equal(detachChangedLiveStamps(moved), moved);
    const regenerated = regenerateLiveStampLayer(moved, stroke.id, {});
    assert.deepEqual(regenerated.positiveElements.map(p => p.d), moved.positiveElements.map(p => p.d));
  }
  assert.deepEqual(liveStampWorldPoints({ ...stroke, transform: translate(30, -10) }), [{ x: 80, y: 40 }, { x: 280, y: 40 }]);
  const first = translate(30, -10), second = rotateAbout(Math.PI / 2, 0, 0);
  const once = { ...layer, positiveElements: layer.positiveElements.map(p => ({ ...p, d: transformPathD(p.d, first) })), liveStamps: transformLiveStrokes(layer, first) };
  assert.deepEqual(transformLiveStrokes(once, second)![0].transform, multiply(second, first));
  assert.deepEqual(transformLiveStrokes(layer, { map: (p:{x:number;y:number}) => p, approx: first }), []);
});

test('live stroke metadata round-trips and malformed recipes never discard cached artwork', () => {
  const { layer, stroke } = example();
  const restored = normalizeLiveStamps(JSON.parse(JSON.stringify(layer.liveStamps)));
  assert.equal(restored.length, 1);
  assert.deepEqual(restored[0].settings, stroke.settings);
  assert.deepEqual(restored[0].points, stroke.points);
  assert.deepEqual(restored[0].pathIds, stroke.pathIds);
  assert.deepEqual(detachChangedLiveStamps({ ...layer, liveStamps: restored }).liveStamps?.length, 1);
  assert.deepEqual(normalizeLiveStamps([{ ...stroke, points: [{ x: Infinity, y: 0 }] }, { ...stroke, transform: [1, 0, 0, 0, 0, 0] }]), []);
  assert.equal(normalizeLiveStamps([stroke, stroke]).length, 1);
});
