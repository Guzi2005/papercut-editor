/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Point } from '../types/papercut';
import { f } from './bezierMath';
import { smoothStroke } from './knifeBrush';

/**
 * Pulled-string stabilizer: the pen tip trails the pointer on a string of length `radius`
 * and only moves once the string is taut, so tremor inside the radius never reaches the stroke.
 * Returns the new tip, or null when the pointer is still within the slack.
 */
export function pullString(tip: Point, pointer: Point, radius: number): Point | null {
  const dx = pointer.x - tip.x;
  const dy = pointer.y - tip.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= radius || dist === 0) return null;
  const k = (dist - radius) / dist;
  return { x: tip.x + dx * k, y: tip.y + dy * k, pressure: pointer.pressure };
}

/** String length in canvas units for a stabilizer setting of 0..0.9 at the given zoom. */
export function stabilizerRadius(stabilizer: number, zoom: number): number {
  return (Math.max(0, stabilizer) * 28) / Math.max(zoom, 0.05);
}

function openCurve(pts: Point[]): string {
  let d = `M ${f(pts[0].x)} ${f(pts[0].y)}`;
  if (pts.length === 2) return `${d} L ${f(pts[1].x)} ${f(pts[1].y)}`;
  const mid = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const m0 = mid(pts[0], pts[1]);
  d += ` L ${f(m0.x)} ${f(m0.y)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const m = mid(pts[i], pts[i + 1]);
    d += ` Q ${f(pts[i].x)} ${f(pts[i].y)} ${f(m.x)} ${f(m.y)}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L ${f(last.x)} ${f(last.y)}`;
}

/**
 * Willow leaf formed like a freehand lasso selection: the traced path itself is the edge and the
 * chord from the last point back to the first closes it. 'symmetric' mirrors the path across that
 * chord for a full two-sided leaf.
 */
export function generateWillowShape(raw: Point[], mode: 'chord' | 'symmetric' = 'chord'): string {
  if (raw.length < 2) return '';
  const pts = smoothStroke(raw, 2, 2);
  if (pts.length < 2) return '';
  const p0 = pts[0];
  const pn = pts[pts.length - 1];
  const chord = Math.hypot(pn.x - p0.x, pn.y - p0.y);
  if (chord < 2 && pts.length < 4) return '';

  if (mode === 'symmetric' && chord >= 2) {
    const tx = (pn.x - p0.x) / chord;
    const ty = (pn.y - p0.y) / chord;
    const mirrored = pts
      .slice(1, -1)
      .reverse()
      .map((p) => {
        const proj = (p.x - p0.x) * tx + (p.y - p0.y) * ty;
        const fx = p0.x + tx * proj;
        const fy = p0.y + ty * proj;
        return { x: 2 * fx - p.x, y: 2 * fy - p.y };
      });
    const back = openCurve([pn, ...mirrored, p0]).replace(/^M [^LQ]+/, '');
    return `${openCurve(pts)}${back} Z`;
  }
  return `${openCurve(pts)} Z`;
}
