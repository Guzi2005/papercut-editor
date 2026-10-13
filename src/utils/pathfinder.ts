/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { type MultiPolygon, type Ring } from 'polygon-clipping';
import { CutoutPath, Layer, PapercutProject, Point } from '../types/papercut';
import { f } from './bezierMath';
import { BASE_BLOCK, paperSequence, splitSubpaths } from './layerSvg';
import { IDENTITY, transformPathD } from './pathTransform';
import { BlockSelection, flattenLayerIds } from './projectOps';
import {polygonOperation} from './polygonOps';

export type PathfinderOp = 'unite' | 'minusFront' | 'intersect' | 'exclude' | 'trim' | 'divide';

type Pt = [number, number];

/** Samples an absolute path (M L C Q S T Z, as produced by transformPathD) into polylines. */
function flatten(d: string): Ring[] {
  const abs = transformPathD(d, { map: (p: Point) => p, approx: IDENTITY });
  const tokens = abs.match(/[a-z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/gi) || [];
  const rings: Ring[] = [];
  let ring: Pt[] = [];
  let i = 0, cmd = '';
  let cx = 0, cy = 0, sx = 0, sy = 0, lcx = 0, lcy = 0;
  const num = () => parseFloat(tokens[i++]);
  const close = () => {
    if (ring.length >= 3) rings.push(ring);
    ring = [];
  };
  const cubic = (x1: number, y1: number, x2: number, y2: number, x: number, y: number) => {
    const n = Math.max(4, Math.min(48, Math.ceil((Math.hypot(x1 - cx, y1 - cy) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x - x2, y - y2)) / 3)));
    for (let k = 1; k <= n; k++) {
      const t = k / n, u = 1 - t;
      ring.push([u * u * u * cx + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x, u * u * u * cy + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y]);
    }
    lcx = x2; lcy = y2; cx = x; cy = y;
  };
  const quad = (x1: number, y1: number, x: number, y: number) => {
    const n = Math.max(4, Math.min(32, Math.ceil((Math.hypot(x1 - cx, y1 - cy) + Math.hypot(x - x1, y - y1)) / 3)));
    for (let k = 1; k <= n; k++) {
      const t = k / n, u = 1 - t;
      ring.push([u * u * cx + 2 * u * t * x1 + t * t * x, u * u * cy + 2 * u * t * y1 + t * t * y]);
    }
    lcx = x1; lcy = y1; cx = x; cy = y;
  };
  while (i < tokens.length) {
    if (/[a-z]/i.test(tokens[i])) cmd = tokens[i++];
    switch (cmd) {
      case 'M':
      case 'm': {
        close();
        const x = num(), y = num();
        if (cmd === 'm') { cx += x; cy += y; } else { cx = x; cy = y; }
        sx = cx; sy = cy;
        ring.push([cx, cy]);
        cmd = 'L';
        break;
      }
      case 'L': cx = num(); cy = num(); ring.push([cx, cy]); lcx = cx; lcy = cy; break;
      case 'C': cubic(num(), num(), num(), num(), num(), num()); break;
      case 'S': { const x2 = num(), y2 = num(), x = num(), y = num(); cubic(2 * cx - lcx, 2 * cy - lcy, x2, y2, x, y); break; }
      case 'Q': quad(num(), num(), num(), num()); break;
      case 'T': { const x = num(), y = num(); quad(2 * cx - lcx, 2 * cy - lcy, x, y); break; }
      case 'Z':
      case 'z': close(); cx = sx; cy = sy; break;
      default: i++;
    }
  }
  close();
  return rings;
}

const EMPTY: MultiPolygon = [];

/** A path as the renderer paints it: each absolute subpath filled on its own, then unioned. */
export function shapeOf(d: string): MultiPolygon {
  const parts = splitSubpaths(d)
    .map((piece) => {
      const rings = flatten(piece);
      return rings.length ? polygonOperation('union',[rings]) : EMPTY;
    })
    .filter((m) => m.length);
  return parts.length ? polygonOperation('union',EMPTY, ...parts) : EMPTY;
}

const union = (...g: MultiPolygon[]) => (g.length ? polygonOperation('union',EMPTY, ...g) : EMPTY);
const minus = (a: MultiPolygon, ...b: MultiPolygon[]) => (a.length && b.length ? polygonOperation('difference',a, ...b) : a);
const area = (m: MultiPolygon) =>
  m.reduce((s, poly) => s + poly.reduce((t, ring, k) => {
    let a = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
    return t + (k === 0 ? 1 : -1) * Math.abs(a / 2);
  }, 0), 0);

/** One path per polygon: the outer ring absolute, inner rings as relative movetos so they stay holes. */
function polygonD(poly: MultiPolygon[number]): string {
  let d = '';
  let start: Pt = [0, 0];
  poly.forEach((ring, k) => {
    const pts = ring.slice(0, -1);
    if (pts.length < 3) return;
    const [x0, y0] = pts[0];
    d += k === 0 ? `M ${f(x0)} ${f(y0)}` : ` m ${f(x0 - start[0])} ${f(y0 - start[1])}`;
    for (let i = 1; i < pts.length; i++) d += ` L ${f(pts[i][0])} ${f(pts[i][1])}`;
    d += ' Z';
    start = [x0, y0];
  });
  return d;
}

export const multiD = (m: MultiPolygon) => m.map(polygonD).filter(Boolean).join(' ');

interface Block {
  layerId: string;
  id: string;
  /** Stacking position across the whole document, bottom first. */
  order: number;
  shape: MultiPolygon;
}

/** The visible shape of each selected block, with later holes in its layer already cut out. */
function collect(project: PapercutProject, sel: BlockSelection): Block[] {
  const layerOrder = flattenLayerIds(project);
  const blocks: Block[] = [];
  Object.entries(sel).forEach(([lid, ids]) => {
    const layer = project.layers[lid];
    if (!layer) return;
    const seq = paperSequence(layer);
    const li = layerOrder.indexOf(lid);
    ids.forEach((id) => {
      if (id === BASE_BLOCK) {
        const holes = seq.filter((c) => c.isHole).map((c) => shapeOf(c.d));
        blocks.push({ layerId: lid, id, order: li * 10000, shape: minus(shapeOf(layer.baseShape.d), ...holes) });
        return;
      }
      const k = seq.findIndex((c) => c.id === id);
      if (k === -1 || seq[k].isHole) return;
      const later = seq.slice(k + 1).filter((c) => c.isHole).map((c) => shapeOf(c.d));
      blocks.push({ layerId: lid, id, order: li * 10000 + k + 1, shape: minus(shapeOf(seq[k].d), ...later) });
    });
  });
  return blocks.sort((a, b) => a.order - b.order);
}

/** Pieces of a shape that don't touch each other, largest first. */
const pieces = (m: MultiPolygon): MultiPolygon[] => m.map((p) => [p] as MultiPolygon).sort((a, b) => area(b) - area(a));

export const PATHFINDER_OPS: { id: PathfinderOp; label: string; tip: string }[] = [
  { id: 'unite', label: '联集', tip: '合成一块，用最上层色块的颜色' },
  { id: 'minusFront', label: '减去顶层', tip: '最底下的色块减去上面所有色块' },
  { id: 'intersect', label: '交集', tip: '只留下全部重叠的部分' },
  { id: 'exclude', label: '差集', tip: '挖掉重叠的部分' },
  { id: 'trim', label: '修边', tip: '每块只留露在外面的部分' },
  { id: 'divide', label: '拆分', tip: '沿所有轮廓切成碎片，每片保留看得见的颜色，可分别移动' },
];

/** Visible paper patches of a layer (base and appliqués with later holes already cut). */
export function visiblePaperPieces(layer: Layer): { d: string; color: string }[] {
  if (layer.kind === 'doodle' || !layer.baseShape?.d) return [];
  const seq = paperSequence(layer);
  const out: { d: string; color: string }[] = [];
  const baseHoles = seq.filter((c) => c.isHole).map((c) => shapeOf(c.d));
  const base = minus(shapeOf(layer.baseShape.d), ...baseHoles);
  if (area(base) > 0.5) out.push({ d: multiD(base), color: layer.color });
  seq.forEach((elem, i) => {
    if (elem.isHole) return;
    const later = seq.slice(i + 1).filter((c) => c.isHole).map((c) => shapeOf(c.d));
    const g = minus(shapeOf(elem.d), ...later);
    if (area(g) > 0.5) out.push({ d: multiD(g), color: elem.fillColor || layer.color });
  });
  return out;
}

/**
 * Applies a pathfinder operation to selected colour blocks. Results are written back into the
 * blocks they belong to (a base sheet takes its result as its new outline, an appliqué is
 * reshaped in place or split into siblings); consumed blocks are removed. Returns the new project
 * and the blocks that hold the result.
 */
export function applyPathfinder(project: PapercutProject, sel: BlockSelection, op: PathfinderOp): { project: PapercutProject; selection: BlockSelection } | null {
  const blocks = collect(project, sel);
  if (blocks.length < 2) return null;
  const top = blocks[blocks.length - 1];
  const back = blocks[0];
  const results = new Map<Block, MultiPolygon[]>();

  if (op === 'unite') results.set(top, [union(...blocks.map((b) => b.shape))]);
  else if (op === 'intersect') results.set(top, [blocks.slice(1).reduce((acc, b) => (acc.length ? polygonOperation('intersection',acc, b.shape) : acc), back.shape)]);
  else if (op === 'exclude') results.set(top, [polygonOperation('xor',EMPTY, ...blocks.map((b) => b.shape))]);
  else if (op === 'minusFront') results.set(back, [minus(back.shape, ...blocks.slice(1).map((b) => b.shape))]);
  else {
    blocks.forEach((b, i) => {
      const visible = minus(b.shape, ...blocks.slice(i + 1).map((o) => o.shape));
      if (op === 'trim') {
        results.set(b, [visible]);
        return;
      }
      let frags: MultiPolygon[] = [visible];
      blocks.slice(0, i).forEach((lower) => {
        frags = frags.flatMap((fr) => [polygonOperation('intersection',fr, lower.shape), minus(fr, lower.shape)]);
      });
      results.set(b, frags.flatMap(pieces));
    });
  }

  const now = Date.now();
  const layers = { ...project.layers };
  const selection: BlockSelection = {};
  const addSel = (lid: string, id: string) => (selection[lid] = [...(selection[lid] || []), id]);

  blocks.forEach((b) => {
    const layer: Layer = layers[b.layerId];
    const geoms = (results.get(b) || []).filter((g) => g.length && area(g) > 0.5);
    if (b.id === BASE_BLOCK) {
      const d = geoms.length ? multiD(union(...geoms)) : '';
      layers[b.layerId] = { ...layer, baseShape: { ...layer.baseShape, type: 'freeform', d } };
      if (d) addSel(b.layerId, BASE_BLOCK);
      return;
    }
    const inCutouts = layer.cutouts.some((c) => c.id === b.id);
    const list = inCutouts ? layer.cutouts : layer.positiveElements;
    const idx = list.findIndex((c) => c.id === b.id);
    const orig = list[idx];
    const reshaped: CutoutPath[] = geoms.map((g, k) => ({
      ...orig,
      id: k === 0 ? orig.id : `${orig.id}_${now.toString(36)}_${k}`,
      name: geoms.length > 1 ? `${orig.name} ${k + 1}` : orig.name,
      type: 'custom_polygon',
      d: multiD(g),
      points: undefined,
      stroke: undefined,
    }));
    reshaped.forEach((c) => addSel(b.layerId, c.id));
    const next = [...list.slice(0, idx), ...reshaped, ...list.slice(idx + 1)];
    layers[b.layerId] = inCutouts ? { ...layer, cutouts: next } : { ...layer, positiveElements: next };
  });

  return { project: { ...project, layers }, selection };
}
