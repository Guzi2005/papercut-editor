/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { KnifeTipShape, Point } from '../types/papercut';
import { f } from './bezierMath';

/** Evenly spaced samples along the raw pointer path, then a light moving-average pass. */
export function smoothStroke(raw: Point[], spacing = 2.5, window = 3): Point[] {
  if (raw.length < 2) return raw.slice();
  const out: Point[] = [raw[0]];
  let carry = 0;
  for (let i = 1; i < raw.length; i++) {
    const a = raw[i - 1];
    const b = raw[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (seg === 0) continue;
    let t = spacing - carry;
    while (t <= seg) {
      const k = t / seg;
      out.push({
        x: a.x + (b.x - a.x) * k,
        y: a.y + (b.y - a.y) * k,
        pressure: (a.pressure ?? 0.5) + ((b.pressure ?? 0.5) - (a.pressure ?? 0.5)) * k,
      });
      t += spacing;
    }
    carry = seg - (t - spacing);
  }
  const last = raw[raw.length - 1];
  if (Math.hypot(last.x - out[out.length - 1].x, last.y - out[out.length - 1].y) > 0.5) out.push(last);
  if (out.length < 3 || window < 1) return out;

  const smoothed = out.map((p, i) => {
    if (i === 0 || i === out.length - 1) return p;
    let sx = 0, sy = 0, sp = 0, n = 0;
    for (let j = Math.max(0, i - window); j <= Math.min(out.length - 1, i + window); j++) {
      sx += out[j].x;
      sy += out[j].y;
      sp += out[j].pressure ?? 0.5;
      n++;
    }
    return { x: sx / n, y: sy / n, pressure: sp / n };
  });
  return smoothed;
}

/** Smooth closed outline through polygon vertices using midpoint quadratic curves. */
function smoothClosed(pts: Point[]): string {
  const n = pts.length;
  if (n < 3) return '';
  const mid = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const start = mid(pts[n - 1], pts[0]);
  let d = `M ${f(start.x)} ${f(start.y)}`;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const m = mid(p, pts[(i + 1) % n]);
    d += ` Q ${f(p.x)} ${f(p.y)} ${f(m.x)} ${f(m.y)}`;
  }
  return `${d} Z`;
}

function normals(pts: Point[]): Point[] {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: -(b.y - a.y) / len, y: (b.x - a.x) / len };
  });
}

function pressureScale(p: Point, usePressure: boolean): number {
  return usePressure ? 0.35 + (p.pressure ?? 0.5) * 1.3 : 1;
}

/** Round nib: constant width ribbon with semicircular caps. */
function roundNib(pts: Point[], radius: number, usePressure: boolean): string {
  const ns = normals(pts);
  const left: Point[] = [];
  const right: Point[] = [];
  pts.forEach((p, i) => {
    const r = radius * pressureScale(p, usePressure);
    left.push({ x: p.x + ns[i].x * r, y: p.y + ns[i].y * r });
    right.push({ x: p.x - ns[i].x * r, y: p.y - ns[i].y * r });
  });
  const cap = (center: Point, from: Point, r: number, dirSign: number) => {
    const out: Point[] = [];
    const a0 = Math.atan2(from.y - center.y, from.x - center.x);
    for (let k = 1; k < 8; k++) {
      const a = a0 + dirSign * (Math.PI * k) / 8;
      out.push({ x: center.x + Math.cos(a) * r, y: center.y + Math.sin(a) * r });
    }
    return out;
  };
  const last = pts[pts.length - 1];
  const first = pts[0];
  const rl = radius * pressureScale(last, usePressure);
  const rf = radius * pressureScale(first, usePressure);
  const ring = [
    ...left,
    ...cap(last, left[left.length - 1], rl, -1),
    ...right.reverse(),
    ...cap(first, right[right.length - 1], rf, -1),
  ];
  return smoothClosed(ring);
}

/**
 * Broad nib swept along the stroke, like a flat or chisel blade. `angleAt` gives the blade
 * direction at each sample: constant for a fixed nib, following the tangent for a turning one.
 */
function broadNib(pts: Point[], length: number, thickness: number, angleAt: (i: number) => number, usePressure: boolean): string {
  const corners = (p: Point, i: number) => {
    const angle = angleAt(i);
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    const vx = -uy;
    const vy = ux;
    const s = pressureScale(p, usePressure);
    const hl = (length / 2) * s;
    const ht = Math.max(0.8, (thickness / 2) * s);
    return [
      { x: p.x + ux * hl + vx * ht, y: p.y + uy * hl + vy * ht },
      { x: p.x - ux * hl + vx * ht, y: p.y - uy * hl + vy * ht },
      { x: p.x - ux * hl - vx * ht, y: p.y - uy * hl - vy * ht },
      { x: p.x + ux * hl - vx * ht, y: p.y + uy * hl - vy * ht },
    ];
  };
  const hull = (ps: Point[]): Point[] => {
    const sorted = ps.slice().sort((a, b) => a.x - b.x || a.y - b.y);
    const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lower: Point[] = [];
    for (const p of sorted) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
      lower.push(p);
    }
    const upper: Point[] = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
      const p = sorted[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
      upper.push(p);
    }
    return lower.slice(0, -1).concat(upper.slice(0, -1));
  };
  // Each step sweeps the nib rectangle between consecutive samples; the convex hull of the two
  // stamps is exact for a straight step and every hull is emitted with the same winding.
  const parts: string[] = [];
  for (let i = 1; i < pts.length; i++) {
    const h = hull([...corners(pts[i - 1], i - 1), ...corners(pts[i], i)]);
    parts.push(`M ${h.map((p) => `${f(p.x)} ${f(p.y)}`).join(' L ')} Z`);
  }
  return parts.join(' ');
}

/** Willow blade: pointed at both ends, fullest in the middle. */
function willowNib(pts: Point[], radius: number, usePressure: boolean): string {
  const ns = normals(pts);
  const n = pts.length;
  const left: Point[] = [];
  const right: Point[] = [];
  pts.forEach((p, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const r = radius * Math.pow(Math.sin(t * Math.PI), 0.7) * pressureScale(p, usePressure);
    left.push({ x: p.x + ns[i].x * r, y: p.y + ns[i].y * r });
    right.push({ x: p.x - ns[i].x * r, y: p.y - ns[i].y * r });
  });
  const ring = [...left, ...right.reverse()];
  const first = ring[0];
  const tip = ring[left.length - 1];
  let d = `M ${f(first.x)} ${f(first.y)}`;
  for (let i = 1; i < ring.length - 1; i++) {
    const m = { x: (ring[i].x + ring[i + 1].x) / 2, y: (ring[i].y + ring[i + 1].y) / 2 };
    d += i === left.length - 1 ? ` L ${f(tip.x)} ${f(tip.y)}` : ` Q ${f(ring[i].x)} ${f(ring[i].y)} ${f(m.x)} ${f(m.y)}`;
  }
  return `${d} Z`;
}

export const FLAT_NIB_ANGLE = 0;
export const CHISEL_NIB_ANGLE = -Math.PI / 4;
export const NIB_THICKNESS_RATIO = 0.16;

export interface NibAngle {
  /** Degrees. Fixed: blade direction from horizontal. Follow: offset from the stroke's normal. */
  angle: number;
  follow: boolean;
}

/** Blade direction of a broad nib when it does not turn with the stroke (radians). */
export function fixedNibAngle(tip: KnifeTipShape, nib?: NibAngle): number {
  const base = tip === 'chisel' ? CHISEL_NIB_ANGLE : FLAT_NIB_ANGLE;
  return base + ((nib?.angle ?? 0) * Math.PI) / 180;
}

export function generateKnifeCut(raw: Point[], size: number, tip: KnifeTipShape, usePressure: boolean, nib?: NibAngle): string {
  if (raw.length < 2) return '';
  const pts = smoothStroke(raw);
  if (pts.length < 2) return '';
  switch (tip) {
    case 'flat':
    case 'chisel': {
      let angleAt: (i: number) => number;
      if (nib?.follow) {
        // Blade across the stroke by default, so a turning flat nib cuts an even ribbon.
        const ns = normals(pts);
        const offset = fixedNibAngle(tip, nib);
        angleAt = (i) => Math.atan2(ns[i].y, ns[i].x) + offset;
      } else {
        const a = fixedNibAngle(tip, nib);
        angleAt = () => a;
      }
      return broadNib(pts, size, size * NIB_THICKNESS_RATIO, angleAt, usePressure);
    }
    case 'slash':
      return willowNib(pts, size / 2, usePressure);
    default:
      return roundNib(pts, size / 2, usePressure);
  }
}

/** Cursor outline (centered at the origin) that previews exactly what the nib will cut. */
export function knifeCursorPath(size: number, tip: KnifeTipShape, angle = fixedNibAngle(tip)): string {
  const r = size / 2;
  if (tip === 'flat' || tip === 'chisel') {
    const ht = Math.max(0.8, (size * NIB_THICKNESS_RATIO) / 2);
    const ux = Math.cos(angle), uy = Math.sin(angle), vx = -uy, vy = ux;
    const c = [
      [ux * r + vx * ht, uy * r + vy * ht],
      [-ux * r + vx * ht, -uy * r + vy * ht],
      [-ux * r - vx * ht, -uy * r - vy * ht],
      [ux * r - vx * ht, uy * r - vy * ht],
    ];
    return `M ${c.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L ')} Z`;
  }
  if (tip === 'slash') {
    const w = r * 0.45;
    return `M ${f(-r * 0.7)} ${f(r * 0.7)} Q ${f(-w)} ${f(-w)} ${f(r * 0.7)} ${f(-r * 0.7)} Q ${f(w)} ${f(w)} ${f(-r * 0.7)} ${f(r * 0.7)} Z`;
  }
  return `M ${-r} 0 A ${r} ${r} 0 1 1 ${r} 0 A ${r} ${r} 0 1 1 ${-r} 0 Z`;
}
