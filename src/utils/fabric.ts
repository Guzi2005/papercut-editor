/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { FabricAsset, FabricFill } from '../types/papercut';
import { linearPart, matrixToSvg, multiply, type Matrix, type Transform } from './pathTransform';

/** Keep projects and exports self-contained; fabric is always a decoded raster import. */
export const MAX_FABRIC_SOURCE_LENGTH = 24 * 1024 * 1024;
const RASTER_DATA_URL = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
const MAX_DIMENSION = 32768;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export function normalizeFabricAsset(value: unknown): FabricAsset | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const v = value as Partial<FabricAsset>;
  if (typeof v.id !== 'string' || !v.id || v.id.length > 160 ||
      typeof v.name !== 'string' || typeof v.src !== 'string' ||
      v.src.length > MAX_FABRIC_SOURCE_LENGTH || !RASTER_DATA_URL.test(v.src) ||
      !finite(v.width) || !finite(v.height) ||
      v.width < 1 || v.height < 1 || v.width > MAX_DIMENSION || v.height > MAX_DIMENSION) return undefined;
  return { id: v.id, name: v.name.trim().slice(0, 120) || '布料', src: v.src, width: v.width, height: v.height };
}

export function normalizeFabricFill(value: unknown): FabricFill | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const v = value as Partial<FabricFill>;
  if (typeof v.assetId !== 'string' || !v.assetId || !Array.isArray(v.transform) ||
      v.transform.length !== 6 || !v.transform.every(n => finite(n) && Math.abs(n) <= 1e7)) return undefined;
  const [a, b, c, d] = v.transform;
  if (Math.abs(a * d - b * c) < 1e-10) return undefined;
  return {
    assetId: v.assetId,
    transform: [...v.transform] as Matrix,
    repeat: v.repeat === 'tile' || v.repeat === 'mirror' ? v.repeat : 'single',
    opacity: finite(v.opacity) ? Math.max(0, Math.min(1, v.opacity)) : 1,
  };
}

export interface FabricBounds { x: number; y: number; width: number; height: number }

/** Image coordinates map to canvas coordinates; fitting preserves the image's proportions. */
export function fitFabricTransform(
  asset: Pick<FabricAsset, 'width' | 'height'>,
  bounds: FabricBounds,
  fit: 'cover' | 'contain' = 'cover',
): Matrix {
  const pick = fit === 'contain' ? Math.min : Math.max;
  const scale = pick(Math.max(1, bounds.width) / Math.max(1, asset.width), Math.max(1, bounds.height) / Math.max(1, asset.height));
  return [scale, 0, 0, scale,
    bounds.x + (bounds.width - asset.width * scale) / 2,
    bounds.y + (bounds.height - asset.height * scale) / 2];
}

/** Moving a paper carries its cloth. Adjusting cloth alone uses this same matrix composition. */
export function transformFabric(fill: FabricFill, transform: Transform): FabricFill {
  return { ...fill, transform: multiply(linearPart(transform), fill.transform) };
}

const attr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Assets are immutable project records. Avoid rescanning a large data URL on every drag frame.
const validatedAssets = new WeakMap<FabricAsset, FabricAsset | undefined>();

/** The caller supplies the paper mask, including its cuts; appliqués remain separate pieces. */
export function fabricFillMarkup(asset: FabricAsset, fill: FabricFill, id: string, paths: string[]): { defs: string; body: string } {
  if (!validatedAssets.has(asset)) validatedAssets.set(asset, normalizeFabricAsset(asset));
  const validAsset = validatedAssets.get(asset), validFill = normalizeFabricFill(fill);
  if (!validAsset || !validFill || validAsset.id !== validFill.assetId) return { defs: '', body: '' };
  const src = attr(validAsset.src), w = validAsset.width, h = validAsset.height;
  const image = (transform = '') => `<image href="${src}" width="${w}" height="${h}" preserveAspectRatio="none"${transform ? ` transform="${transform}"` : ''}/>`;
  if (validFill.repeat === 'single') {
    return { defs: '', body: `<g transform="${matrixToSvg(validFill.transform)}" opacity="${validFill.opacity}" pointer-events="none">${image()}</g>` };
  }
  const mirror = validFill.repeat === 'mirror';
  const content = image() + (mirror ?
    image(`translate(${w * 2} 0) scale(-1 1)`) +
    image(`translate(0 ${h * 2}) scale(1 -1)`) +
    image(`translate(${w * 2} ${h * 2}) scale(-1 -1)`) : '');
  return {
    defs: `<pattern id="${attr(id)}" patternUnits="userSpaceOnUse" patternContentUnits="userSpaceOnUse" width="${w * (mirror ? 2 : 1)}" height="${h * (mirror ? 2 : 1)}" patternTransform="${matrixToSvg(validFill.transform)}">${content}</pattern>`,
    body: paths.map(d => `<path d="${attr(d)}" fill="url(#${attr(id)})" opacity="${validFill.opacity}"/>`).join(''),
  };
}
