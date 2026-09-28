import type { CanvasTexture } from '../types/papercut';

/** Small deterministic SVG tiles, shared by canvas preview and flattened exports. */
export function canvasTextureMarkup(texture: CanvasTexture | undefined, width: number, height: number, id: string): string {
  if (!texture || texture === 'none') return '';
  const tile = texture === 'grid'
    ? '<path d="M 24 0 H 0 V 24" fill="none" stroke="#64748b" stroke-width="0.6" opacity="0.22"/>'
    : texture === 'linen'
    ? '<path d="M 0 1 H 8 M 0 5 H 8 M 1 0 V 8 M 5 0 V 8" stroke="#6b5845" stroke-width="0.5" opacity="0.16"/>'
    : '<g fill="#786651" opacity="0.16"><circle cx="3" cy="9" r="0.6"/><circle cx="17" cy="4" r="0.4"/><circle cx="29" cy="23" r="0.7"/><circle cx="12" cy="30" r="0.5"/></g><path d="m 6 20 5 -1 m 13 -8 4 1 m -14 14 2 3" stroke="#8e7d66" stroke-width="0.5" opacity="0.18"/>';
  const size = texture === 'grid' ? 24 : texture === 'linen' ? 8 : 32;
  return `<defs><pattern id="${id}" width="${size}" height="${size}" patternUnits="userSpaceOnUse">${tile}</pattern></defs><rect width="${width}" height="${height}" fill="url(#${id})"/>`;
}
