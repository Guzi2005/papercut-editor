import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Layer, PapercutProject } from '../src/types/papercut';
import { createBlankCanvas } from '../src/utils/presetTemplates';
import { captureSelectedStamp, stampCaptureOmissions } from '../src/utils/materialCapture';
import { createStampDocument } from '../src/utils/stampDocument';
import { layerContent } from '../src/utils/layerContent';
import { BASE_BLOCK } from '../src/utils/layerSvg';
import { shapeOf } from '../src/utils/pathfinder';

const rect = (x: number, y: number, width: number, height: number) => `M ${x} ${y} h ${width} v ${height} h ${-width} Z`;
function layer(id: string, d: string, color: string): Layer {
  return { ...createBlankCanvas().layers.layer_base_paper, id, name: id, baseShape: { type: 'freeform', d }, color, stroke: undefined };
}
function project(layers: Layer[]): PapercutProject {
  return { ...createBlankCanvas(), layers: Object.fromEntries(layers.map(layer => [layer.id, layer])), groups: [], rootOrder: layers.map(layer => ({ type: 'layer', id: layer.id })) };
}

test('capture includes only selected visible layers in render order, regardless of selection order', () => {
  const p = project([layer('bottom', rect(0, 0, 100, 100), '#f00'), layer('top', rect(25, 25, 50, 50), '#00f'), { ...layer('hidden', rect(400, 400, 100, 100), '#0f0'), visible: false }]);
  assert.deepEqual(captureSelectedStamp(p, ['top', 'hidden', 'bottom'], '图章').parts.map(part => part.color), ['#FF0000', '#0000FF']);
  assert.deepEqual(captureSelectedStamp(p, ['top'], '图章').parts.map(part => part.color), ['#0000FF']);
  assert.throws(() => captureSelectedStamp(p, [], '图章'), /先选中/);
  assert.throws(() => captureSelectedStamp(p, ['hidden'], '图章'), /没有可见/);
});

test('capture keeps aspect ratio and shared layout while centering a displaced selection', () => {
  const p = project([layer('a', rect(200, 300, 100, 50), '#f00'), layer('b', rect(300, 300, 100, 50), '#00f')]);
  const def = captureSelectedStamp(p, ['a', 'b'], '布边');
  const result = layerContent(createStampDocument(def).layers.layer_base_paper).bounds!;
  assert.ok(Math.abs(result.width / result.height - 4) < 1e-6);
  assert.ok(Math.abs(result.x - 12.8) < 1e-6);
  assert.ok(Math.abs(result.y - 99.2) < 1e-6);
  assert.equal(def.name, '布边');
});

test('capture observes chronological holes and later applique without altering the source', () => {
  const source = layer('cut', rect(0, 0, 100, 100), '#f00');
  source.cutouts = [{ id: 'hole', name: 'hole', d: rect(50, -10, 60, 120), type: 'custom_polygon', isHole: true, createdAt: 1 }];
  source.positiveElements = [{ id: 'patch', name: 'patch', d: rect(80, 20, 20, 20), type: 'custom_polygon', isHole: false, fillColor: '#00f', createdAt: 2 }];
  const p = project([source]);
  const before = JSON.stringify(p);
  const result = captureSelectedStamp(p, ['cut'], 'cut');
  assert.equal(result.parts.length, 2);
  assert.ok(Math.abs(layerContent(createStampDocument(result).layers.layer_base_paper).bounds!.width - 230.4) < 1e-6);
  assert.equal(JSON.stringify(p), before);
});

test('brush-only geometry can become a stamp and lossy effects are reported', () => {
  const l = layer('brush', '', '#f00');
  l.kind = 'doodle'; l.opacity = .5;
  l.drawings = [{ id: 'drawing', brushType: 'airbrush', d: 'M 20 20 L 100 20', color: '#03a', opacity: .7, blur: 3, strokeWidth: 10 }];
  const p = project([l]);
  assert.equal(captureSelectedStamp(p, ['brush'], '描线').parts[0].color, '#0033AA');
  assert.deepEqual(stampCaptureOmissions(p, ['brush']), ['半透明', '喷枪模糊']);
});

test('image fabric is rejected rather than silently captured as a solid silhouette', () => {
  const l: Layer = { ...layer('fabric', rect(0, 0, 100, 100), '#f00'), fabric: { assetId: 'image', transform: [1, 0, 0, 1, 0, 0], repeat: 'single', opacity: 1 } };
  assert.throws(() => captureSelectedStamp(project([l]), ['fabric'], '布料'), /图片布料不能/);
});

test('capture rejects over-complex selections with an actionable message', () => {
  const layers = Array.from({ length: 201 }, (_, index) => layer(String(index), rect(index * 20, 0, 10, 10), '#f00'));
  assert.throws(() => captureSelectedStamp(project(layers), layers.map(layer => layer.id), 'large'), /200 个色块/);
});

test('color-block capture excludes unselected paper and preserves the selected cut contour', () => {
  const source = layer('colors', rect(0, 0, 100, 100), '#f00');
  source.positiveElements = [
    { id: 'blue', name: 'blue', d: rect(20, 20, 40, 40), type: 'custom_polygon', isHole: false, fillColor: '#00f', createdAt: 1 },
    { id: 'green', name: 'green', d: rect(80, 80, 20, 20), type: 'custom_polygon', isHole: false, fillColor: '#0f0', createdAt: 2 },
  ];
  source.cutouts = [{ id: 'hole', name: 'hole', d: rect(30, 30, 10, 10), type: 'custom_polygon', isHole: true, createdAt: 3 }];
  const p = project([source]);
  const def = captureSelectedStamp(p, ['colors'], '花瓣', { colors: ['blue'] });
  assert.deepEqual(def.parts.map(part => part.color), ['#0000FF']);
  assert.equal(shapeOf(def.parts[0].d)[0].length, 2, 'the selected applique keeps its interior hole');
  assert.equal(captureSelectedStamp(p, ['colors'], '底纸', { colors: [BASE_BLOCK] }).parts.length, 1);
  assert.throws(() => captureSelectedStamp(p, ['colors'], 'empty', {}), /先选中/);
  assert.throws(() => captureSelectedStamp(p, ['colors'], 'stale', { colors: ['removed'] }), /没有可见/);
});

test('selected drawing on a fabric layer is captured without including the underlying image', () => {
  const l = layer('fabric', rect(0, 0, 100, 100), '#f00');
  l.fabric = { assetId: 'image', transform: [1, 0, 0, 1, 0, 0], repeat: 'single', opacity: 1 };
  l.drawings = [{ id: 'drawing', brushType: 'pen', d: 'M 20 20 L 80 20', color: '#0033AA', opacity: 1, strokeWidth: 10 }];
  const p = project([l]);
  assert.equal(captureSelectedStamp(p, ['fabric'], 'drawing', { fabric: ['drawing'] }).parts[0].color, '#0033AA');
  assert.throws(() => captureSelectedStamp(p, ['fabric'], 'cloth', { fabric: [BASE_BLOCK] }), /图片布料不能/);
});

test('appearance warnings only include effects on selected blocks', () => {
  const l = layer('colors', rect(0, 0, 100, 100), '#f00');
  l.pattern = { type: 'dots', color: '#0f0', scale: 20, angle: 0, opacity: 1 };
  l.drawings = [
    { id: 'plain', brushType: 'pen', d: 'M 20 20 L 80 20', color: '#0033AA', opacity: 1, strokeWidth: 10 },
    { id: 'blurred', brushType: 'airbrush', d: 'M 20 40 L 80 40', color: '#0033AA', opacity: .5, strokeWidth: 10, blur: 3 },
  ];
  const p = project([l]);
  assert.deepEqual(stampCaptureOmissions(p, ['colors'], { colors: ['plain'] }), []);
  assert.deepEqual(stampCaptureOmissions(p, ['colors'], { colors: ['blurred'] }), ['半透明', '喷枪模糊']);
  assert.deepEqual(stampCaptureOmissions(p, ['colors'], { colors: [BASE_BLOCK] }), ['图层纹样']);
});
