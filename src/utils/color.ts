/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Layer, PapercutProject } from '../types/papercut';
import { flattenLayerIds } from './projectOps';

export interface RGB { r: number; g: number; b: number }
export interface HSV { h: number; s: number; v: number }

/** `#rgb`, `rgb`, `#rrggbb` or `rrggbb` → `#RRGGBB`; null when not a colour. */
export function normalizeHex(input: string): string | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(input.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  return `#${h.toUpperCase()}`;
}

export function hexToRgb(hex: string): RGB {
  const h = normalizeHex(hex) ?? '#000000';
  const n = parseInt(h.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: RGB): string {
  const c = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

/** h 0–360, s and v 0–100. */
export function rgbToHsv({ r, g, b }: RGB): HSV {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B), d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === R) h = ((G - B) / d) % 6;
    else if (max === G) h = (B - R) / d + 2;
    else h = (R - G) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : (d / max) * 100, v: max * 100 };
}

export function hsvToRgb({ h, s, v }: HSV): RGB {
  const S = s / 100, V = v / 100;
  const c = V * S, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = V - c;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

export const hsvToHex = (hsv: HSV) => rgbToHex(hsvToRgb(hsv));
export const hexToHsv = (hex: string) => rgbToHsv(hexToRgb(hex));

export function mixHex(a: string, b: string, t: number): string {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex({ r: A.r + (B.r - A.r) * t, g: A.g + (B.g - A.g) * t, b: A.b + (B.b - A.b) * t });
}

export function isLight(hex: string): boolean {
  const { r, g, b } = hexToRgb(hex);
  return r * 0.3 + g * 0.59 + b * 0.11 > 170;
}

/** Every colour a layer paints with: paper, pattern, appliqués and brush strokes, in that order. */
export function layerColors(layer: Layer): string[] {
  const out: string[] = [];
  const add = (c?: string) => {
    const h = c && normalizeHex(c);
    if (h && !out.includes(h)) out.push(h);
  };
  if (layer.kind !== 'doodle' && layer.baseShape?.d) add(layer.color);
  if (layer.pattern) add(layer.pattern.color);
  if (layer.surface && !layer.surface.inheritColor) add(layer.surface.color);
  [...layer.positiveElements, ...layer.cutouts].forEach((c) => !c.isHole && add(c.fillColor || layer.color));
  (layer.drawings || []).forEach((d) => add(d.color));
  if (out.length === 0) add(layer.color);
  return out;
}

export function projectColors(project: PapercutProject): string[] {
  const out: string[] = [];
  flattenLayerIds(project).forEach((id) => {
    const l = project.layers[id];
    if (l) layerColors(l).forEach((c) => !out.includes(c) && out.push(c));
  });
  return out;
}
