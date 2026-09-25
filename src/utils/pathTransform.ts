/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Point } from '../types/papercut';
import { f } from './bezierMath';

/** 2D affine matrix [a, b, c, d, e, f]: x' = a*x + c*y + e, y' = b*x + d*y + f */
export type Matrix = [number, number, number, number, number, number];

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

export function multiply(m1: Matrix, m2: Matrix): Matrix {
  const [a1, b1, c1, d1, e1, f1] = m1;
  const [a2, b2, c2, d2, e2, f2] = m2;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ];
}

export const translate = (tx: number, ty: number): Matrix => [1, 0, 0, 1, tx, ty];

export function scaleAbout(s: number, cx: number, cy: number): Matrix {
  return [s, 0, 0, s, cx - s * cx, cy - s * cy];
}

export function rotateAbout(rad: number, cx: number, cy: number): Matrix {
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [cos, sin, -sin, cos, cx - cos * cx + sin * cy, cy - sin * cx - cos * cy];
}

export function applyToPoint(m: Matrix, p: Point): Point {
  return { ...p, x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] };
}

/** Uniform scale factor of the matrix (paths are only ever scaled uniformly). */
export function matrixScale(m: Matrix): number {
  return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
}

/** A non-affine point mapping, with the affine that best approximates it for arc radii and stroke widths. */
export interface Warp {
  map: (p: Point) => Point;
  approx: Matrix;
}

export type Transform = Matrix | Warp;

export const isWarp = (t: Transform): t is Warp => !Array.isArray(t);

export const applyTransform = (t: Transform, p: Point): Point => (isWarp(t) ? { ...p, ...t.map(p) } : applyToPoint(t, p));

export const linearPart = (t: Transform): Matrix => (isWarp(t) ? t.approx : t);

/** Solves the n×n system A·x = b in place by Gaussian elimination with partial pivoting. */
function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    if (Math.abs(A[piv][c]) < 1e-12) return null;
    [A[c], A[piv]] = [A[piv], A[c]];
    [b[c], b[piv]] = [b[piv], b[c]];
    for (let r = c + 1; r < n; r++) {
      const k = A[r][c] / A[c][c];
      for (let j = c; j < n; j++) A[r][j] -= k * A[c][j];
      b[r] -= k * b[c];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let v = b[r];
    for (let j = r + 1; j < n; j++) v -= A[r][j] * x[j];
    x[r] = v / A[r][r];
  }
  return x;
}

/**
 * The transform taking four source corners onto four destination corners: an affine matrix when
 * the result is still a parallelogram, otherwise a projective warp.
 */
export function cornersTransform(src: Point[], dst: Point[]): Transform | null {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  const h = solve(A, b);
  if (!h) return null;
  const [a, bb, c, d, e, ff, g, k] = h;
  const scale = Math.max(1, ...src.map((p) => Math.abs(p.x) + Math.abs(p.y)));
  if (Math.abs(g) * scale < 1e-6 && Math.abs(k) * scale < 1e-6) return [a, d, bb, e, c, ff];
  const map = (p: Point): Point => {
    const w = g * p.x + k * p.y + 1;
    return { x: (a * p.x + bb * p.y + c) / w, y: (d * p.x + e * p.y + ff) / w };
  };
  const cx = (src[0].x + src[2].x) / 2, cy = (src[0].y + src[2].y) / 2, eps = 1;
  const o = map({ x: cx, y: cy }), px = map({ x: cx + eps, y: cy }), py = map({ x: cx, y: cy + eps });
  return {
    map,
    approx: [px.x - o.x, px.y - o.y, py.x - o.x, py.y - o.y, o.x - (px.x - o.x) * cx - (py.x - o.x) * cy, o.y - (px.y - o.y) * cx - (py.y - o.y) * cy],
  };
}

export function matrixToSvg(m: Matrix): string {
  return `matrix(${m.map((v) => +v.toFixed(5)).join(' ')})`;
}

/** Whether a linear map keeps circles circular (rotation, uniform scale, reflection). */
function isConformal(m: Matrix): boolean {
  const [a, b, c, d] = m;
  const tol = 1e-6 * Math.max(1, Math.abs(a), Math.abs(b), Math.abs(c), Math.abs(d));
  return (Math.abs(a - d) < tol && Math.abs(b + c) < tol) || (Math.abs(a + d) < tol && Math.abs(b - c) < tol);
}

/** SVG elliptical arc as cubic Bézier segments of at most 90° each: [c1x, c1y, c2x, c2y, x, y][]. */
function arcToCubics(x1: number, y1: number, rx: number, ry: number, rotDeg: number, large: number, sweep: number, x2: number, y2: number): number[][] {
  if (rx === 0 || ry === 0 || (x1 === x2 && y1 === y2)) return [[x1, y1, x2, y2, x2, y2]];
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const phi = (rotDeg * Math.PI) / 180, cos = Math.cos(phi), sin = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const xp = cos * dx + sin * dy, yp = -sin * dx + cos * dy;
  const lam = (xp * xp) / (rx * rx) + (yp * yp) / (ry * ry);
  if (lam > 1) {
    rx *= Math.sqrt(lam);
    ry *= Math.sqrt(lam);
  }
  const num = rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp;
  const den = rx * rx * yp * yp + ry * ry * xp * xp;
  const k = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cxp = (k * rx * yp) / ry, cyp = (-k * ry * xp) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2, cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const t1 = ang(1, 0, (xp - cxp) / rx, (yp - cyp) / ry);
  let dt = ang((xp - cxp) / rx, (yp - cyp) / ry, (-xp - cxp) / rx, (-yp - cyp) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  if (sweep && dt < 0) dt += 2 * Math.PI;
  const n = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2)));
  const seg = dt / n, alpha = (4 / 3) * Math.tan(seg / 4);
  const pt = (t: number) => {
    const ex = rx * Math.cos(t), ey = ry * Math.sin(t);
    return [cos * ex - sin * ey + cx, sin * ex + cos * ey + cy];
  };
  const dpt = (t: number) => {
    const ex = -rx * Math.sin(t), ey = ry * Math.cos(t);
    return [cos * ex - sin * ey, sin * ex + cos * ey];
  };
  const out: number[][] = [];
  for (let i = 0; i < n; i++) {
    const a = t1 + i * seg, b = a + seg;
    const [ax, ay] = pt(a), [bx, by] = pt(b), [dax, day] = dpt(a), [dbx, dby] = dpt(b);
    out.push([ax + alpha * dax, ay + alpha * day, bx - alpha * dbx, by - alpha * dby, bx, by]);
  }
  out[n - 1][4] = x2;
  out[n - 1][5] = y2;
  return out;
}

const ARG_COUNTS: Record<string, number> = {
  M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0,
};

/**
 * Transforms any SVG path (absolute or relative commands, including arcs) by an affine matrix or
 * a warp. H/V are promoted to L since they are not preserved under rotation.
 */
export function transformPathD(d: string, t: Transform): string {
  const m = linearPart(t);
  if (!d) return d;
  const tokens = d.match(/[a-df-z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/gi);
  if (!tokens) return d;

  const tp = (x: number, y: number) => applyTransform(t, { x, y });
  const s = matrixScale(m);
  const rotDeg = (Math.atan2(m[1], m[0]) * 180) / Math.PI;
  const flipped = m[0] * m[3] - m[1] * m[2] < 0;
  const arcsAsCurves = isWarp(t) || !isConformal(m);

  const out: string[] = [];
  let cx = 0, cy = 0, sx = 0, sy = 0;
  let i = 0;
  let cmd = '';

  const num = () => parseFloat(tokens[i++]);

  while (i < tokens.length) {
    if (/[a-df-z]/i.test(tokens[i])) {
      cmd = tokens[i++];
    } else if (!cmd) {
      i++;
      continue;
    }
    const upper = cmd.toUpperCase();
    const rel = cmd !== upper;

    if (upper === 'Z') {
      out.push('Z');
      cx = sx;
      cy = sy;
      continue;
    }

    const n = ARG_COUNTS[upper];
    if (n === undefined || i + n > tokens.length) break;
    if (tokens.slice(i, i + n).some((t) => /[a-df-z]/i.test(t))) break;

    switch (upper) {
      case 'M':
      case 'L':
      case 'T': {
        let x = num(), y = num();
        if (rel) { x += cx; y += cy; }
        const p = tp(x, y);
        out.push(`${upper} ${f(p.x)} ${f(p.y)}`);
        cx = x; cy = y;
        if (upper === 'M') {
          sx = x; sy = y;
          cmd = rel ? 'l' : 'L';
        }
        break;
      }
      case 'H': {
        let x = num();
        if (rel) x += cx;
        const p = tp(x, cy);
        out.push(`L ${f(p.x)} ${f(p.y)}`);
        cx = x;
        break;
      }
      case 'V': {
        let y = num();
        if (rel) y += cy;
        const p = tp(cx, y);
        out.push(`L ${f(p.x)} ${f(p.y)}`);
        cy = y;
        break;
      }
      case 'C': {
        const v = [num(), num(), num(), num(), num(), num()];
        if (rel) for (let k = 0; k < 6; k += 2) { v[k] += cx; v[k + 1] += cy; }
        const a = tp(v[0], v[1]), b = tp(v[2], v[3]), c = tp(v[4], v[5]);
        out.push(`C ${f(a.x)} ${f(a.y)}, ${f(b.x)} ${f(b.y)}, ${f(c.x)} ${f(c.y)}`);
        cx = v[4]; cy = v[5];
        break;
      }
      case 'S':
      case 'Q': {
        const v = [num(), num(), num(), num()];
        if (rel) for (let k = 0; k < 4; k += 2) { v[k] += cx; v[k + 1] += cy; }
        const a = tp(v[0], v[1]), b = tp(v[2], v[3]);
        out.push(`${upper} ${f(a.x)} ${f(a.y)}, ${f(b.x)} ${f(b.y)}`);
        cx = v[2]; cy = v[3];
        break;
      }
      case 'A': {
        const rx = num(), ry = num(), xrot = num(), large = num();
        let sweep = num();
        let x = num(), y = num();
        if (rel) { x += cx; y += cy; }
        if (arcsAsCurves) {
          arcToCubics(cx, cy, rx, ry, xrot, large, sweep, x, y).forEach((v) => {
            const a = tp(v[0], v[1]), b = tp(v[2], v[3]), c = tp(v[4], v[5]);
            out.push(`C ${f(a.x)} ${f(a.y)}, ${f(b.x)} ${f(b.y)}, ${f(c.x)} ${f(c.y)}`);
          });
          cx = x; cy = y;
          break;
        }
        const p = tp(x, y);
        if (flipped) sweep = sweep ? 0 : 1;
        const newRot = flipped ? -xrot + rotDeg : xrot + rotDeg;
        out.push(`A ${f(rx * s)} ${f(ry * s)} ${f(newRot)} ${large ? 1 : 0} ${sweep ? 1 : 0} ${f(p.x)} ${f(p.y)}`);
        cx = x; cy = y;
        break;
      }
    }
  }
  return out.join(' ');
}
