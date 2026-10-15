/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Matrix, IDENTITY, rotateAbout, transformPathD, multiply } from './pathTransform';

export type SymmetryKind = 'none' | 'mirror' | 'rotate';

export interface SymmetrySettings {
  kind: SymmetryKind;
  /** Mirror: number of axes (1 = single fold, 2 = four-way...). Rotate: number of copies. */
  count: number;
  /** Direction of the first mirror axis / starting rotation, degrees from +x (90 = vertical). */
  angle: number;
  /** Centre in canvas units; undefined means the canvas centre. */
  cx?: number;
  cy?: number;
  /** Guides remain available across drawing, selecting, and vector tools. */
  visible?: boolean;
  locked?: boolean;
}

export const DEFAULT_SYMMETRY: SymmetrySettings = { kind: 'none', count: 1, angle: 90, visible: true, locked: false };

export function normalizeSymmetry(value:unknown):SymmetrySettings|undefined {
  if(!value||typeof value!=='object')return;
  const s=value as Partial<SymmetrySettings>;
  if(!['none','mirror','rotate'].includes(s.kind??''))return;
  const bounded=(v:unknown,fallback:number,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)?Math.min(max,Math.max(min,v)):fallback;
  return {kind:s.kind!,count:Math.round(bounded(s.count,s.kind==='rotate'?2:1,s.kind==='rotate'?2:1,s.kind==='mirror'?4:12)),
    angle:bounded(s.angle,90,-360,360),cx:typeof s.cx==='number'&&Number.isFinite(s.cx)?Math.min(1e6,Math.max(-1e6,s.cx)):undefined,
    cy:typeof s.cy==='number'&&Number.isFinite(s.cy)?Math.min(1e6,Math.max(-1e6,s.cy)):undefined,visible:s.visible!==false,locked:s.locked===true};
}

/** Reflection across the line through (cx, cy) at `deg` degrees. */
export function reflectAcross(deg: number, cx: number, cy: number): Matrix {
  const t = (2 * deg * Math.PI) / 180;
  const a = Math.cos(t);
  const b = Math.sin(t);
  return [a, b, b, -a, cx - a * cx - b * cy, cy - b * cx + a * cy];
}

export function symmetryCenter(s: SymmetrySettings, width: number, height: number) {
  return { x: s.cx ?? width / 2, y: s.cy ?? height / 2 };
}

/**
 * The copy transforms for a symmetry setting, identity first.
 * Mirror with n axes is the dihedral group: n rotations plus n reflections (2n copies).
 */
export function symmetryMatrices(s: SymmetrySettings, width: number, height: number): Matrix[] {
  if (s.kind === 'none') return [IDENTITY];
  const { x, y } = symmetryCenter(s, width, height);
  const n = Math.max(1, Math.round(s.count));
  const out: Matrix[] = [];
  for (let k = 0; k < n; k++) out.push(k === 0 ? IDENTITY : rotateAbout((2 * Math.PI * k) / n, x, y));
  if (s.kind === 'mirror') {
    for (let k = 0; k < n; k++) out.push(reflectAcross(s.angle + (180 * k) / n, x, y));
  }
  return out;
}

/** Path data replicated through every symmetry copy. */
export function applySymmetry(d: string, matrices: Matrix[]): string {
  if (!d || matrices.length <= 1) return d;
  return matrices.map((m) => (m === IDENTITY ? d : transformPathD(d, m))).join(' ');
}

/** Keep a copy relationship in world coordinates after an affine object transform. */
export function conjugateSymmetry(matrices:Matrix[],transform:Matrix):Matrix[] {
  const [a,b,c,d,e,f]=transform,det=a*d-b*c;
  if(Math.abs(det)<1e-12)return [IDENTITY];
  const inverse:Matrix=[d/det,-b/det,-c/det,a/det,(c*f-d*e)/det,(b*e-a*f)/det];
  return matrices.map(copy=>multiply(transform,multiply(copy,inverse)));
}

/** Axis lines (mirror) or spokes (rotate) for the on-canvas guide, as [x1,y1,x2,y2]. */
export function symmetryGuides(s: SymmetrySettings, width: number, height: number): [number, number, number, number][] {
  if (s.kind === 'none') return [];
  const { x, y } = symmetryCenter(s, width, height);
  const L = Math.hypot(width, height);
  const n = Math.max(1, Math.round(s.count));
  const lines: [number, number, number, number][] = [];
  for (let k = 0; k < n; k++) {
    if (s.kind === 'mirror') {
      const a = ((s.angle + (180 * k) / n) * Math.PI) / 180;
      lines.push([x - Math.cos(a) * L, y - Math.sin(a) * L, x + Math.cos(a) * L, y + Math.sin(a) * L]);
    } else {
      const a = ((s.angle + (360 * k) / n) * Math.PI) / 180;
      lines.push([x, y, x + Math.cos(a) * L, y + Math.sin(a) * L]);
    }
  }
  return lines;
}
