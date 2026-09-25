/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Point } from '../types/papercut';
import { f } from './bezierMath';

export type PathCap = 'butt' | 'round' | 'square' | 'taper';

/** An open path cut or pasted as a band of paper, like SAI2's pen-layer strokes. */
export interface StrokeStyle {
  width: number;
  /** Corner rounding 0 (sharp) – 1 (as round as the shorter neighbouring segment allows). */
  round: number;
  cap: PathCap;
  /** Per anchor: true passes through it on a smooth curve, false makes a corner. */
  smooth: boolean[];
}

type V = { x: number; y: number };
type Cubic = [V, V, V, V];

const sub = (a: V, b: V): V => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: V, b: V): V => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a: V, k: number): V => ({ x: a.x * k, y: a.y * k });
const len = (a: V) => Math.hypot(a.x, a.y);
const lerp = (a: V, b: V, t: number): V => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const norm = (a: V): V => {
  const l = len(a);
  return l > 1e-9 ? { x: a.x / l, y: a.y / l } : { x: 0, y: 0 };
};

function cubicAt([p0, p1, p2, p3]: Cubic, t: number): V {
  const a = lerp(p0, p1, t), b = lerp(p1, p2, t), c = lerp(p2, p3, t);
  return lerp(lerp(a, b, t), lerp(b, c, t), t);
}

/** The part of a cubic between parameters u0 and u1. */
function subCubic(c: Cubic, u0: number, u1: number): Cubic {
  const split = ([p0, p1, p2, p3]: Cubic, t: number): [Cubic, Cubic] => {
    const a = lerp(p0, p1, t), b = lerp(p1, p2, t), cc = lerp(p2, p3, t);
    const d = lerp(a, b, t), e = lerp(b, cc, t), m = lerp(d, e, t);
    return [[p0, a, d, m], [m, e, cc, p3]];
  };
  const right = u0 > 0 ? split(c, u0)[1] : c;
  const t = u0 < 1 ? (u1 - u0) / (1 - u0) : 1;
  return t < 1 ? split(right, t)[0] : right;
}

/** Centerline as cubic pieces: Catmull-Rom through smooth anchors, filleted corners elsewhere. */
function centerline(pts: V[], style: StrokeStyle): Cubic[] {
  const n = pts.length;
  const tan = pts.map((p, i) =>
    style.smooth[i] && i > 0 && i < n - 1 ? mul(sub(pts[i + 1], pts[i - 1]), 0.5) : { x: 0, y: 0 }
  );
  const segs: Cubic[] = [];
  for (let i = 0; i < n - 1; i++) {
    segs.push([pts[i], add(pts[i], mul(tan[i], 1 / 3)), sub(pts[i + 1], mul(tan[i + 1], 1 / 3)), pts[i + 1]]);
  }
  if (style.round <= 0) return segs;

  // Trim each segment back from its corner ends and bridge the gap with a quadratic at the corner.
  const trim = segs.map(() => ({ u0: 0, u1: 1 }));
  const corners: { i: number; t: number }[] = [];
  for (let i = 1; i < n - 1; i++) {
    if (style.smooth[i]) continue;
    const la = len(sub(pts[i], pts[i - 1])), lb = len(sub(pts[i + 1], pts[i]));
    const t = Math.min(style.round, 1) * 0.5 * Math.min(la, lb);
    if (t < 0.5) continue;
    trim[i - 1].u1 = Math.min(trim[i - 1].u1, 1 - t / la);
    trim[i].u0 = Math.max(trim[i].u0, t / lb);
    corners.push({ i, t });
  }
  const out: Cubic[] = [];
  segs.forEach((s, i) => {
    const piece = subCubic(s, trim[i].u0, trim[i].u1);
    out.push(piece);
    const corner = corners.find((c) => c.i === i + 1);
    if (corner) {
      const a = piece[3];
      const b = cubicAt(segs[i + 1], trim[i + 1].u0);
      const p = pts[i + 1];
      out.push([a, lerp(a, p, 2 / 3), lerp(b, p, 2 / 3), b]);
    }
  });
  return out;
}

function sample(cubics: Cubic[]): V[] {
  const out: V[] = [];
  cubics.forEach((c, k) => {
    const chord = len(sub(c[1], c[0])) + len(sub(c[2], c[1])) + len(sub(c[3], c[2]));
    const steps = Math.max(1, Math.min(64, Math.ceil(chord / 3)));
    for (let s = k === 0 ? 0 : 1; s <= steps; s++) {
      const p = cubicAt(c, s / steps);
      const last = out[out.length - 1];
      if (!last || len(sub(p, last)) > 0.05) out.push(p);
    }
  });
  return out;
}

/** Filled outline of an open path with the given width, corner rounding and end caps. */
export function strokeOutline(points: Point[], style: StrokeStyle): string {
  const pts: V[] = points.map((p) => ({ x: p.x, y: p.y }));
  if (pts.length < 2) return '';
  let c = sample(centerline(pts, style));
  if (c.length < 2) return '';
  const hw = Math.max(0.25, style.width / 2);

  if (style.cap === 'square') {
    c = [...c];
    c[0] = add(c[0], mul(norm(sub(c[0], c[1])), hw));
    c[c.length - 1] = add(c[c.length - 1], mul(norm(sub(c[c.length - 1], c[c.length - 2])), hw));
  }

  const acc = [0];
  for (let i = 1; i < c.length; i++) acc.push(acc[i - 1] + len(sub(c[i], c[i - 1])));
  const total = acc[acc.length - 1];
  const taperLen = Math.min(total * 0.35, style.width * 4);
  const half = (i: number) => {
    if (style.cap !== 'taper' || taperLen <= 0) return hw;
    const k = Math.min(1, acc[i] / taperLen, (total - acc[i]) / taperLen);
    return hw * Math.sin((Math.max(0, k) * Math.PI) / 2);
  };

  const left: V[] = [];
  const right: V[] = [];
  for (let i = 0; i < c.length; i++) {
    const dPrev = i > 0 ? norm(sub(c[i], c[i - 1])) : null;
    const dNext = i < c.length - 1 ? norm(sub(c[i + 1], c[i])) : null;
    const h = half(i);
    const nOf = (d: V): V => ({ x: -d.y, y: d.x });
    if (dPrev && dNext) {
      const n1 = nOf(dPrev), n2 = nOf(dNext);
      const m = norm(add(n1, n2));
      const cos = m.x * n1.x + m.y * n1.y;
      if (cos > 0.3) {
        const k = h / cos;
        left.push(add(c[i], mul(m, k)));
        right.push(sub(c[i], mul(m, k)));
      } else {
        // Too sharp for a miter: bevel both sides.
        left.push(add(c[i], mul(n1, h)), add(c[i], mul(n2, h)));
        right.push(sub(c[i], mul(n1, h)), sub(c[i], mul(n2, h)));
      }
    } else {
      const n = nOf((dPrev || dNext)!);
      left.push(add(c[i], mul(n, h)));
      right.push(sub(c[i], mul(n, h)));
    }
  }

  const ring: V[] = [...left];
  const arc = (center: V, from: V, dir: V) => {
    // Half circle from `from` around `center`, bulging towards `dir`.
    const r = len(sub(from, center));
    const a0 = Math.atan2(from.y - center.y, from.x - center.x);
    const aDir = Math.atan2(dir.y, dir.x);
    const delta = ((aDir - a0 + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
    const sweep = delta >= 0 ? Math.PI : -Math.PI;
    const steps = Math.max(6, Math.ceil(r / 1.5));
    const out: V[] = [];
    for (let s = 1; s < steps; s++) {
      const a = a0 + (sweep * s) / steps;
      out.push({ x: center.x + Math.cos(a) * r, y: center.y + Math.sin(a) * r });
    }
    return out;
  };
  const end = c[c.length - 1], start = c[0];
  if (style.cap === 'round') ring.push(...arc(end, left[left.length - 1], norm(sub(end, c[c.length - 2]))));
  ring.push(...right.reverse());
  if (style.cap === 'round') ring.push(...arc(start, right[right.length - 1], norm(sub(start, c[1]))));
  return `M ${ring.map((p) => `${f(p.x)} ${f(p.y)}`).join(' L ')} Z`;
}

export const DEFAULT_STROKE: Omit<StrokeStyle, 'smooth'> = { width: 12, round: 0.4, cap: 'round' };
