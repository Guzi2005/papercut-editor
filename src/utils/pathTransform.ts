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

export function matrixToSvg(m: Matrix): string {
  return `matrix(${m.map((v) => +v.toFixed(5)).join(' ')})`;
}

const ARG_COUNTS: Record<string, number> = {
  M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0,
};

/**
 * Transforms any SVG path (absolute or relative commands, including arcs) by an affine matrix.
 * H/V are promoted to L since they are not preserved under rotation.
 */
export function transformPathD(d: string, m: Matrix): string {
  if (!d) return d;
  const tokens = d.match(/[a-df-z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/gi);
  if (!tokens) return d;

  const tp = (x: number, y: number) => applyToPoint(m, { x, y });
  const s = matrixScale(m);
  const rotDeg = (Math.atan2(m[1], m[0]) * 180) / Math.PI;
  const flipped = m[0] * m[3] - m[1] * m[2] < 0;

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
