// Internal decorative holes of the Ukrainian preset are four straight knife cuts
// (convex diamonds, concave arrowheads), not noisy traced curves. This helper fits a
// clean four-vertex polygon to a traced hole by sampling its actual curve, keeping the
// hole's centre, span, and axis angle. Large structural openings between limbs and
// branches are returned untouched.
import type { Point } from '../types/papercut';
import { f } from './bezierMath';

export type UkrainianHoleKind = 'diamond' | 'arrowhead' | 'opening' | 'trace';

export interface UkrainianKnifeCut {
  kind: UkrainianHoleKind;
  /** Four-vertex polygon for diamond/arrowhead; the original contour for opening/trace. */
  d: string;
}

/** Openings larger than this (in doubled canvas units) are structural, not decoration. */
const OPENING_AREA = 900;
const OPENING_SPAN = 40;
/** Polygon area vs convex hull area below this marks a genuinely concave hole. */
const CONCAVE_RATIO = 0.78;

/** Flattens one closed M/L/C/H/V contour into dense on-curve samples. Null on anything else. */
function flattenContour(d: string): Point[] | null {
  const tokens = d.match(/[a-df-z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/gi);
  if (!tokens) return null;
  const pts: Point[] = [];
  let cx = 0, cy = 0, sx = 0, sy = 0, i = 0, cmd = '';
  const num = () => parseFloat(tokens[i++]);
  while (i < tokens.length) {
    if (/[a-df-z]/i.test(tokens[i])) cmd = tokens[i++];
    const upper = cmd.toUpperCase();
    const rel = cmd !== upper;
    if (upper === 'Z') { cx = sx; cy = sy; cmd = ''; continue; }
    if (upper === 'M' || upper === 'L' || upper === 'T') {
      let x = num(), y = num();
      if (rel) { x += cx; y += cy; }
      pts.push({ x, y });
      cx = x; cy = y;
      if (upper === 'M') { sx = x; sy = y; cmd = rel ? 'l' : 'L'; }
    } else if (upper === 'H' || upper === 'V') {
      const v = num();
      if (upper === 'H') cx = rel ? cx + v : v; else cy = rel ? cy + v : v;
      pts.push({ x: cx, y: cy });
    } else if (upper === 'C') {
      const v = [num(), num(), num(), num(), num(), num()];
      if (rel) for (let k = 0; k < 6; k += 2) { v[k] += cx; v[k + 1] += cy; }
      const p0 = { x: cx, y: cy };
      for (let k = 1; k <= 12; k++) {
        const t = k / 12, u = 1 - t;
        pts.push({
          x: u * u * u * p0.x + 3 * u * u * t * v[0] + 3 * u * t * t * v[2] + t * t * t * v[4],
          y: u * u * u * p0.y + 3 * u * u * t * v[1] + 3 * u * t * t * v[3] + t * t * t * v[5],
        });
      }
      cx = v[4]; cy = v[5];
    } else {
      return null;
    }
  }
  return pts;
}

function polygonArea(pts: Point[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

/** Andrew monotone chain; input is small so the simple version suffices. */
function convexHull(pts: Point[]): Point[] {
  const p = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Point[] = [], upper: Point[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  for (const q of [...p].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

const toPath = (verts: Point[]): string =>
  `M ${verts.map((p) => `${f(p.x)} ${f(p.y)}`).join(' L ')} Z`;

/**
 * Fits a traced interior hole to a four-cut polygon in the same coordinate space.
 * Returns the original contour unchanged for structural openings or unsupported paths.
 */
export function ukrainianKnifeCut(contourD: string): UkrainianKnifeCut {
  const trace: UkrainianKnifeCut = { kind: 'trace', d: contourD };
  const pts = flattenContour(contourD);
  if (!pts || pts.length < 8) return trace;
  const area = Math.abs(polygonArea(pts));
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  if (area > OPENING_AREA || span > OPENING_SPAN) return { kind: 'opening', d: contourD };
  if (area < 8) {
    const x=(Math.min(...xs)+Math.max(...xs))/2,y=(Math.min(...ys)+Math.max(...ys))/2;
    const rx=Math.max(1,(Math.max(...xs)-Math.min(...xs))/2),ry=Math.max(2,(Math.max(...ys)-Math.min(...ys))/2);
    return {kind:'diamond',d:toPath([{x,y:y-ry},{x:x+rx,y},{x,y:y+ry},{x:x-rx,y}])};
  }

  // Principal-axis frame so the cut keeps the hole's original angle.
  const gx = xs.reduce((s, v) => s + v, 0) / pts.length;
  const gy = ys.reduce((s, v) => s + v, 0) / pts.length;
  let sxx = 0, sxy = 0, syy = 0;
  for (const p of pts) {
    const dx = p.x - gx, dy = p.y - gy;
    sxx += dx * dx; sxy += dx * dy; syy += dy * dy;
  }
  const theta = Math.atan2(2 * sxy, sxx - syy) / 2;
  const cos = Math.cos(theta), sin = Math.sin(theta);
  const uv = pts.map((p) => ({ u: (p.x - gx) * cos + (p.y - gy) * sin, v: -(p.x - gx) * sin + (p.y - gy) * cos }));
  const us = uv.map((p) => p.u), vs = uv.map((p) => p.v);
  const uMin = Math.min(...us), uMax = Math.max(...us);
  const vLo = Math.min(...vs), vHi = Math.max(...vs);
  const len = uMax - uMin, mid = (vLo + vHi) / 2;
  if (len < 1) return trace;
  const toXY = (u: number, v: number): Point => ({ x: gx + u * cos - v * sin, y: gy + u * sin + v * cos });

  const hullArea = Math.abs(polygonArea(convexHull(pts)));
  if (hullArea > 0 && area / hullArea < CONCAVE_RATIO) {
    // Concave hole: arrowhead dart. The narrow end of the trace is the tip.
    const inBin = (from: number, to: number) => uv.filter((p) => p.u >= from && p.u <= to);
    const first = inBin(uMin, uMin + len * 0.18), last = inBin(uMax - len * 0.18, uMax);
    const spread = (bin: typeof uv) =>
      bin.length ? Math.max(...bin.map((p) => p.v)) - Math.min(...bin.map((p) => p.v)) : Infinity;
    const tipAtMin = spread(first) <= spread(last);
    const tipBin = tipAtMin ? first : last;
    const uTip = tipAtMin ? uMin : uMax;
    const vTip = tipBin.reduce((s, p) => s + p.v, 0) / Math.max(1, tipBin.length);
    // Notch: the on-curve sample nearest the centroid, clamped well inside the wing triangle.
    let notch = uv
      .filter((p) => p.u > uMin + len * 0.15 && p.u < uMax - len * 0.15)
      .sort((a, b) => Math.hypot(a.u, a.v) - Math.hypot(b.u, b.v))[0];
    const uNotch = tipAtMin
      ? Math.min(Math.max(notch?.u ?? uMin + len * 0.45, uMin + len * 0.3), uMax - len * 0.3)
      : Math.max(Math.min(notch?.u ?? uMax - len * 0.45, uMax - len * 0.3), uMin + len * 0.3);
    const pad = (vHi - vLo) * 0.2;
    const vNotch = Math.min(Math.max(notch?.v ?? mid, vLo + pad), vHi - pad);
    const tip = toXY(uTip, vTip);
    const wingA = toXY(tipAtMin ? uMax : uMin, vHi);
    const wingB = toXY(tipAtMin ? uMax : uMin, vLo);
    return { kind: 'arrowhead', d: toPath([tip, wingA, toXY(uNotch, vNotch), wingB]) };
  }

  // Convex hole: diamond spanning the full length and height of the trace.
  const cu = (uMin + uMax) / 2;
  return {
    kind: 'diamond',
    d: toPath([toXY(uMin, mid), toXY(cu, vHi), toXY(uMax, mid), toXY(cu, vLo)]),
  };
}
