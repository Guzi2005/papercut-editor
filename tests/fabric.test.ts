import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { FabricAsset, FabricFill, Layer } from '../src/types/papercut';
import { fabricFillMarkup, fitFabricTransform, normalizeFabricAsset, normalizeFabricFill } from '../src/utils/fabric';
import { BASE_BLOCK, projectShadowOptions, renderLayerMarkup } from '../src/utils/layerSvg';
import { normalizeProject, transformBlocks, transformLayer } from '../src/utils/projectOps';
import { createBlankCanvas } from '../src/utils/presetTemplates';
import { applyToPoint, rotateAbout, translate } from '../src/utils/pathTransform';
import { generateSvgMarkup } from '../src/utils/svgExporter';
import { godotMeasurementMarkup, godotPartMarkup } from '../src/utils/godotExport';
import { exportStreet } from '../src/utils/exportStreet';
import { parseProjectFile, serializeProject } from '../src/utils/storage';

const asset: FabricAsset = {
  id: 'cloth', name: '布样', width: 100, height: 50,
  src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6LMYAAAAASUVORK5CYII=',
};
const fill: FabricFill = { assetId: asset.id, transform: [2, 0, 0, 2, 10, 20], repeat: 'single', opacity: .8 };
const layer = (): Layer => ({
  ...createBlankCanvas().layers.layer_base_paper,
  baseShape: { type: 'freeform', d: 'M 10 20 H 210 V 120 H 10 Z' }, fabric: fill,
  cutouts: [{ id: 'hole', name: 'hole', type: 'custom_polygon', d: 'M 40 40 H 70 V 70 H 40 Z', isHole: true, createdAt: 1 }],
});

test('fabric fitting preserves aspect ratio with a centered crop or complete image', () => {
  const bounds = { x: 0, y: 0, width: 100, height: 100 };
  assert.deepEqual(fitFabricTransform(asset, bounds), [2, 0, 0, 2, -50, 0]);
  assert.deepEqual(fitFabricTransform(asset, bounds, 'contain'), [1, 0, 0, 1, 0, 25]);
});

test('fabric follows whole paper and base-block transformations but not independent appliqués', () => {
  const paper = layer(), move = translate(17, -4);
  const moved = transformLayer(paper, move);
  assert.deepEqual(moved.fabric?.transform, [2, 0, 0, 2, 27, 16]);
  assert.deepEqual(paper.fabric?.transform, fill.transform);
  assert.deepEqual(transformBlocks(paper, [BASE_BLOCK], move).fabric, moved.fabric);
  assert.deepEqual(transformBlocks(paper, ['other'], move).fabric, fill);
  const rotated = transformLayer(paper, rotateAbout(Math.PI / 2, 0, 0));
  const corner = applyToPoint(rotated.fabric!.transform, { x: 0, y: 0 });
  assert.ok(Math.abs(corner.x + 20) < 1e-8 && Math.abs(corner.y - 10) < 1e-8);
});

test('single bitmap stays inside paper hole mask and exports embed the source', () => {
  const project = createBlankCanvas();
  project.fabricAssets = { [asset.id]: asset };
  const svg = renderLayerMarkup(layer(), { idPrefix: 'test_', ...projectShadowOptions(project), shadow: 0 });
  assert.ok(svg.includes(`href="${asset.src}"`));
  assert.ok(svg.includes('matrix(2 0 0 2 10 20)'));
  assert.ok(svg.includes('M 40 40 H 70 V 70 H 40 Z" fill="#000"'));
  assert.match(svg, /<g mask="url\(#test_[^\"]+_mask\)" data-element-id="__base__">[\s\S]*<image[\s\S]*?<\/g><\/g>/);
});

test('tile and mirror use image coordinates consistently with a shared transformed pattern', () => {
  const paths = ['M 0 0 H 300 V 300 H 0 Z'];
  const tile = fabricFillMarkup(asset, { ...fill, repeat: 'tile' }, 'pattern', paths);
  assert.match(tile.defs, /width="100" height="50" patternTransform="matrix\(2 0 0 2 10 20\)"/);
  assert.equal(tile.defs.match(/<image /g)?.length, 1);
  assert.ok(tile.body.includes('fill="url(#pattern)" opacity="0.8"'));
  const mirror = fabricFillMarkup(asset, { ...fill, repeat: 'mirror' }, 'pattern', paths);
  assert.match(mirror.defs, /width="200" height="100" patternTransform=/);
  assert.equal(mirror.defs.match(/<image /g)?.length, 4);
  assert.ok(mirror.defs.includes('translate(200 100) scale(-1 -1)'));
});

test('fabric rejects external or executable sources and invalid transforms', () => {
  assert.equal(normalizeFabricAsset({ ...asset, src: 'https://example.com/cloth.png' }), undefined);
  assert.equal(normalizeFabricAsset({ ...asset, src: 'data:image/svg+xml;base64,PHN2Zz4=' }), undefined);
  assert.equal(normalizeFabricAsset({ ...asset, width: Infinity }), undefined);
  assert.equal(normalizeFabricFill({ ...fill, transform: [1, 0, 0, 0, 0, 0] }), undefined);
  assert.equal(normalizeFabricFill({ ...fill, transform: [1, 0, 0, 1, NaN, 0] }), undefined);
  assert.equal(normalizeFabricFill({ ...fill, opacity: 4 })?.opacity, 1);
  assert.deepEqual(fabricFillMarkup({ ...asset, src: 'javascript:alert(1)' }, fill, 'p', []), { defs: '', body: '' });
});

test('project round trip keeps cloth source once, transform, and unrelated item metadata', () => {
  const project = createBlankCanvas(), paper = layer();
  project.layers[paper.id] = paper;
  project.fabricAssets = { [asset.id]: asset };
  project.items = [{ id: 'dress', name: '衣服', partIds: [paper.id], pivot: { x: 20, y: 30 }, sockets: [{ id: 's', name: 'neck', x: 1, y: 2 }] }];
  const text = serializeProject(project), result = parseProjectFile(text);
  assert.equal(text.split(asset.src).length - 1, 1);
  assert.deepEqual(result.fabricAssets, project.fabricAssets);
  assert.deepEqual(result.layers[paper.id].fabric, fill);
  assert.deepEqual(result.items, project.items);
  project.fabricAssets[asset.id] = { ...asset, src: 'data:image/svg+xml;base64,PHN2Zz4=' };
  assert.doesNotThrow(() => normalizeProject(project));
  const cleaned = normalizeProject(project);
  assert.deepEqual(cleaned.fabricAssets, {});
  assert.equal(cleaned.layers[paper.id].fabric, undefined);
  assert.deepEqual(cleaned.layers[paper.id].baseShape, paper.baseShape);
  assert.deepEqual(cleaned.items, project.items);
});

test('SVG, game bridge, and Godot PNG input embed cloth for plain and blended exports', () => {
  const project = createBlankCanvas(), paper = layer();
  project.layers[paper.id] = paper;
  project.fabricAssets = { [asset.id]: asset };
  assert.ok(generateSvgMarkup(project).includes(`href="${asset.src}"`));
  assert.ok(exportStreet(project).includes(`href="${asset.src}"`));
  assert.ok(godotPartMarkup(project, paper.id, [], false, 0).includes(`href="${asset.src}"`));
  const overlay = { ...paper, id: 'overlay', fabric: undefined, blendMode: 'multiply' as const, color: '#654321' };
  project.layers[overlay.id] = overlay;
  // Cloth on an underlying part must survive the blend bake, not fall back to its paper colour.
  const blended = godotPartMarkup(project, overlay.id, [paper.id], false, 0);
  assert.ok(blended.includes(`href="${asset.src}"`));
  assert.ok(blended.includes('mix-blend-mode:multiply'));
  // The blended part's own cloth also participates in the bake.
  project.layers[overlay.id] = { ...overlay, fabric: fill };
  assert.ok(godotPartMarkup(project, overlay.id, [paper.id], false, .4).split(asset.src).length > 2);
});

test('Godot measures paper geometry independently of a displaced oversized fabric image', () => {
  const project = createBlankCanvas(), paper = layer();
  project.fabricAssets = { [asset.id]: asset };
  project.layers[paper.id] = { ...paper, fabric: { ...fill, transform: [50, 0, 0, 50, -8000, 9000] } };
  const measurement = godotMeasurementMarkup(project, paper.id);
  assert.equal(measurement.includes('<image'), false);
  assert.equal(measurement.includes(asset.src), false);
  assert.ok(measurement.includes(paper.baseShape.d));
  assert.ok(measurement.includes(paper.cutouts[0].d));
  // Measuring never mutates the project or strips the raster from its final PNG input.
  assert.deepEqual(project.layers[paper.id].fabric?.transform, [50, 0, 0, 50, -8000, 9000]);
  assert.ok(godotPartMarkup(project, paper.id, [], false, 0).includes(asset.src));
  assert.ok(godotPartMarkup(project, paper.id, [], false, 0).includes('matrix(50 0 0 50 -8000 9000)'));
});
