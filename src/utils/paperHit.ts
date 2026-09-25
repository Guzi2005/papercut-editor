/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Layer, Point } from '../types/papercut';
import { BASE_BLOCK, paperSequence, splitSubpaths } from './layerSvg';

interface Piece {
  path: Path2D;
  box: [number, number, number, number] | null;
}

let ctx: CanvasRenderingContext2D | null = null;
const cache = new Map<string, Piece[]>();

function context(): CanvasRenderingContext2D {
  if (!ctx) ctx = document.createElement('canvas').getContext('2d')!;
  return ctx;
}

/**
 * Bounds from the coordinate pairs of an absolute path (Bézier curves stay inside their control
 * points); null when relative commands or arcs make that unsafe.
 */
function roughBox(d: string): [number, number, number, number] | null {
  if (/[a-df-zAHV]/.test(d)) return null;
  const nums = d.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi);
  if (!nums || nums.length < 2) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = +nums[i], y = +nums[i + 1];
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return [x0, y0, x1, y1];
}

function pieces(d: string): Piece[] {
  let p = cache.get(d);
  if (!p) {
    // Each subpath is filled on its own when rendered, so containment is tested per subpath too.
    p = splitSubpaths(d).map((s) => ({ path: new Path2D(s), box: roughBox(s) }));
    if (cache.size >= 1500) {
      // Maps iterate in insertion order: drop the oldest third rather than everything.
      let n = 500;
      for (const k of cache.keys()) {
        cache.delete(k);
        if (--n === 0) break;
      }
    }
    cache.set(d, p);
  }
  return p;
}

export function pathContains(d: string, x: number, y: number): boolean {
  if (!d) return false;
  const c = context();
  return pieces(d).some(
    ({ path, box }) =>
      (!box || (x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3])) && c.isPointInPath(path, x, y)
  );
}

/** Whether the layer has paper at a point, following the same stacking the renderer uses. */
export function paperAt(layer: Layer, x: number, y: number): boolean {
  if (layer.kind === 'doodle') return false;
  let on = pathContains(layer.baseShape?.d || '', x, y);
  for (const c of paperSequence(layer)) {
    if (pathContains(c.d, x, y)) on = !c.isHole;
  }
  return on;
}

let probe: SVGPathElement | null = null;

function exactBox(d: string): [number, number, number, number] | null {
  if (!probe) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('style', 'position:absolute;left:-10000px;top:0;width:1px;height:1px;visibility:hidden');
    probe = document.createElementNS(ns, 'path');
    svg.appendChild(probe);
    document.body.appendChild(svg);
  }
  try {
    probe.setAttribute('d', d);
    const b = probe.getBBox();
    return b.width > 0 || b.height > 0 ? [b.x, b.y, b.x + b.width, b.y + b.height] : null;
  } catch {
    return null;
  }
}

/** Sample points covering the inside of a shape, falling back to the given points for slivers. */
function interiorSamples(d: string, fallback: Point[]): Point[] {
  const box = exactBox(d) ?? roughBox(d);
  const out: Point[] = [];
  if (box) {
    const n = 22;
    const w = box[2] - box[0], h = box[3] - box[1];
    for (let i = 0; i <= n; i++) {
      for (let j = 0; j <= n; j++) {
        const p = { x: box[0] + (w * i) / n, y: box[1] + (h * j) / n };
        if (pathContains(d, p.x, p.y)) out.push(p);
      }
    }
  }
  return out.length >= 4 ? out : out.concat(fallback);
}

/**
 * 刻纸 decides for itself whether a new shape removes or adds paper: wholly on paper it is a hole,
 * wholly off paper it is an appliqué. A shape straddling the edge follows where the stroke began —
 * starting on paper extends it (appliqué), starting off paper cuts into it (hole).
 */
export function classifyCarve(layer: Layer, shapeD: string, strokePts: Point[], start: Point): 'hole' | 'applique' {
  const samples = interiorSamples(shapeD, strokePts);
  let on = 0, off = 0;
  for (const p of samples) {
    if (paperAt(layer, p.x, p.y)) on++;
    else off++;
    if (on > 0 && off > 0) break;
  }
  if (off === 0) return 'hole';
  if (on === 0) return 'applique';
  return paperAt(layer, start.x, start.y) ? 'applique' : 'hole';
}

function strokeContains(d: string, width: number, x: number, y: number): boolean {
  const c = context();
  c.lineWidth = Math.max(1, width);
  c.lineCap = 'round';
  c.lineJoin = 'round';
  return pieces(d).some(({ path }) => c.isPointInStroke(path, x, y));
}

/**
 * The block of a layer that shows at a point: brush strokes on top, then the most recent paper
 * piece covering it (a hole there means the layer shows nothing), then the base sheet.
 */
export function topBlockAt(layer: Layer, x: number, y: number): string | null {
  const drawings = layer.drawings || [];
  for (let i = drawings.length - 1; i >= 0; i--) {
    const d = drawings[i];
    const hit = d.fill ? pathContains(d.d, x, y) : strokeContains(d.d, d.strokeWidth, x, y);
    if (hit && (layer.kind === 'doodle' || paperAt(layer, x, y))) return d.id;
  }
  if (layer.kind === 'doodle') return null;
  const seq = paperSequence(layer);
  for (let i = seq.length - 1; i >= 0; i--) {
    if (pathContains(seq[i].d, x, y)) return seq[i].isHole ? null : seq[i].id;
  }
  return pathContains(layer.baseShape?.d || '', x, y) ? BASE_BLOCK : null;
}
