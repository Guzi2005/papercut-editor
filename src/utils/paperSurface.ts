/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Layer, LayerSurface, SurfaceTextureType } from '../types/papercut';

const escapeAttr = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const SURFACE_LABELS: Record<SurfaceTextureType, string> = {
  foil: '金银箔',
  crinkle: '皱纸',
  xuanSheet: '宣纸',
  tape: '胶带纸',
};

export const SURFACE_OPTIONS: { id: SurfaceTextureType | 'none'; label: string }[] = [
  { id: 'none', label: '无' },
  { id: 'foil', label: '金银箔' },
  { id: 'crinkle', label: '皱纸' },
  { id: 'xuanSheet', label: '宣纸' },
  { id: 'tape', label: '胶带纸' },
];

/** Preset tints; first entry is always「继承纸色」(inherit). */
export const SURFACE_PRESETS: Record<SurfaceTextureType, { id: string; label: string; color?: string }[]> = {
  foil: [
    { id: 'inherit', label: '继承纸色' },
    { id: 'gold', label: '金箔', color: '#E8C547' },
    { id: 'silver', label: '银箔', color: '#D5DAE2' },
    { id: 'copper', label: '铜箔', color: '#C47A3A' },
    { id: 'rosegold', label: '玫瑰金', color: '#E0A08A' },
    { id: 'cyan', label: '青箔', color: '#7EB8B2' },
  ],
  crinkle: [
    { id: 'inherit', label: '继承纸色' },
    { id: 'rice', label: '米白', color: '#F3EDE2' },
    { id: 'kraft', label: '牛皮', color: '#C4A574' },
    { id: 'ash', label: '浅灰', color: '#E2E0DC' },
    { id: 'blush', label: '藕粉', color: '#E8D0C8' },
  ],
  xuanSheet: [
    { id: 'inherit', label: '继承纸色' },
    { id: 'xuan', label: '宣白', color: '#F7F4EB' },
    { id: 'aged', label: '仿古', color: '#E8DCC8' },
    { id: 'bamboo', label: '竹青淡', color: '#E5EBE3' },
    { id: 'inkcloud', label: '墨晕灰', color: '#D8D6D2' },
  ],
  tape: [
    { id: 'inherit', label: '继承纸色' },
    { id: 'clear', label: '透明胶带', color: '#F2F0E8' },
    { id: 'yellow', label: '淡黄', color: '#F5E6A8' },
    { id: 'pink', label: '浅粉', color: '#F5C6C6' },
    { id: 'blue', label: '淡蓝', color: '#A8C8E8' },
    { id: 'mint', label: '薄荷绿', color: '#B8E0C8' },
  ],
};

export function defaultSurface(type: SurfaceTextureType, paperColor: string): LayerSurface {
  return {
    type,
    inheritColor: true,
    color: paperColor,
    intensity: type === 'foil' ? 0.85 : type === 'tape' ? 0.7 : 0.75,
    scale: type === 'foil' ? 1 : type === 'crinkle' ? 1.2 : 1,
  };
}

export function surfaceTint(surface: LayerSurface, paperColor: string): string {
  return surface.inheritColor ? paperColor : surface.color;
}

const HUGE = 20000;

/** SVG filter + overlay fragments for a surface texture, clipped by the caller. */
export function surfaceOverlayMarkup(
  surface: LayerSurface,
  pid: string,
  paperColor: string,
  defs: string[]
): string {
  const tint = escapeAttr(surfaceTint(surface, paperColor));
  const k = Math.max(0.05, Math.min(1, surface.intensity));
  const sc = Math.max(0.35, Math.min(3, surface.scale || 1));
  const fid = `${pid}_surf`;
  const gid = `${pid}_surfg`;

  if (surface.type === 'foil') {
    // Metallic flake + specular wash. Soft-light keeps the paper hue when inheriting.
    defs.push(
      `<filter id="${fid}" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">` +
        `<feTurbulence type="fractalNoise" baseFrequency="${(0.55 / sc).toFixed(3)}" numOctaves="2" seed="7" result="n"/>` +
        `<feSpecularLighting in="n" surfaceScale="${(2.4 * k).toFixed(2)}" specularConstant="${(1.1 * k).toFixed(2)}" specularExponent="18" lighting-color="#ffffff" result="spec">` +
        `<feDistantLight azimuth="40" elevation="48"/>` +
        `</feSpecularLighting>` +
        `<feComposite in="spec" in2="SourceGraphic" operator="in" result="cut"/>` +
        `<feBlend in="SourceGraphic" in2="cut" mode="screen"/>` +
        `</filter>`
    );
    defs.push(
      `<linearGradient id="${gid}" x1="0%" y1="0%" x2="100%" y2="100%">` +
        `<stop offset="0%" stop-color="#ffffff" stop-opacity="${(0.55 * k).toFixed(2)}"/>` +
        `<stop offset="45%" stop-color="${tint}" stop-opacity="${(0.35 * k).toFixed(2)}"/>` +
        `<stop offset="100%" stop-color="#1a1208" stop-opacity="${(0.25 * k).toFixed(2)}"/>` +
        `</linearGradient>`
    );
    return (
      `<rect x="${-HUGE}" y="${-HUGE}" width="${HUGE * 2}" height="${HUGE * 2}" fill="${tint}" opacity="${(0.55 * k).toFixed(2)}" style="mix-blend-mode:soft-light"/>` +
      `<rect x="${-HUGE}" y="${-HUGE}" width="${HUGE * 2}" height="${HUGE * 2}" fill="url(#${gid})" filter="url(#${fid})" style="mix-blend-mode:overlay"/>`
    );
  }

  if (surface.type === 'crinkle') {
    defs.push(
      `<filter id="${fid}" x="-8%" y="-8%" width="116%" height="116%" color-interpolation-filters="sRGB">` +
        `<feTurbulence type="fractalNoise" baseFrequency="${(0.018 / sc).toFixed(4)} ${(0.028 / sc).toFixed(4)}" numOctaves="3" seed="3" result="n"/>` +
        `<feColorMatrix in="n" type="matrix" values="0 0 0 0 0.15  0 0 0 0 0.12  0 0 0 0 0.1  0 0 0 ${ (0.55 * k).toFixed(2) } 0" result="shade"/>` +
        `<feBlend in="SourceGraphic" in2="shade" mode="multiply" result="mul"/>` +
        `<feTurbulence type="turbulence" baseFrequency="${(0.04 / sc).toFixed(3)}" numOctaves="2" seed="11" result="c"/>` +
        `<feColorMatrix in="c" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 ${ (0.22 * k).toFixed(2) } 0" result="ridge"/>` +
        `<feBlend in="mul" in2="ridge" mode="soft-light"/>` +
        `</filter>`
    );
    return (
      `<rect x="${-HUGE}" y="${-HUGE}" width="${HUGE * 2}" height="${HUGE * 2}" fill="${tint}" opacity="${(0.25 * k).toFixed(2)}" style="mix-blend-mode:color"/>` +
      `<rect x="${-HUGE}" y="${-HUGE}" width="${HUGE * 2}" height="${HUGE * 2}" fill="${tint}" filter="url(#${fid})" opacity="${(0.9 * k).toFixed(2)}"/>`
    );
  }

  if (surface.type === 'xuanSheet') {
    defs.push(
      `<filter id="${fid}" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">` +
        `<feTurbulence type="fractalNoise" baseFrequency="${(0.7 / sc).toFixed(3)}" numOctaves="4" seed="5" result="fiber"/>` +
        `<feColorMatrix in="fiber" type="matrix" values="0 0 0 0 0.92  0 0 0 0 0.9  0 0 0 0 0.86  0 0 0 ${ (0.35 * k).toFixed(2) } 0" result="fleck"/>` +
        `<feBlend in="SourceGraphic" in2="fleck" mode="multiply" result="m"/>` +
        `<feTurbulence type="fractalNoise" baseFrequency="${(0.03 / sc).toFixed(3)}" numOctaves="2" seed="19" result="cloud"/>` +
        `<feColorMatrix in="cloud" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 ${ (0.18 * k).toFixed(2) } 0" result="haze"/>` +
        `<feBlend in="m" in2="haze" mode="soft-light"/>` +
        `</filter>`
    );
    return (
      `<rect x="${-HUGE}" y="${-HUGE}" width="${HUGE * 2}" height="${HUGE * 2}" fill="${tint}" opacity="${(0.2 * k).toFixed(2)}" style="mix-blend-mode:color"/>` +
      `<rect x="${-HUGE}" y="${-HUGE}" width="${HUGE * 2}" height="${HUGE * 2}" fill="#F7F4EB" filter="url(#${fid})" opacity="${(0.85 * k).toFixed(2)}" style="mix-blend-mode:soft-light"/>`
    );
  }

  // tape: translucent strip sheen + faint edge banding
  const band = Math.max(6, 14 * sc);
  defs.push(
    `<pattern id="${gid}" patternUnits="userSpaceOnUse" width="${band.toFixed(1)}" height="${(band * 2).toFixed(1)}" patternTransform="rotate(-8)">` +
      `<rect width="${band.toFixed(1)}" height="${(band * 2).toFixed(1)}" fill="${tint}" opacity="0.15"/>` +
      `<rect y="${(band * 0.15).toFixed(1)}" width="${band.toFixed(1)}" height="${(band * 0.08).toFixed(1)}" fill="#ffffff" opacity="0.35"/>` +
      `<rect y="${(band * 1.05).toFixed(1)}" width="${band.toFixed(1)}" height="${(band * 0.05).toFixed(1)}" fill="#000000" opacity="0.06"/>` +
      `</pattern>`
  );
  defs.push(
    `<filter id="${fid}" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">` +
      `<feGaussianBlur stdDeviation="${(0.4 * sc).toFixed(2)}"/>` +
      `<feComponentTransfer><feFuncA type="linear" slope="${(0.85 * k).toFixed(2)}"/></feComponentTransfer>` +
      `</filter>`
  );
  return (
    `<rect x="${-HUGE}" y="${-HUGE}" width="${HUGE * 2}" height="${HUGE * 2}" fill="${tint}" opacity="${(0.45 * k).toFixed(2)}" style="mix-blend-mode:soft-light"/>` +
    `<rect x="${-HUGE}" y="${-HUGE}" width="${HUGE * 2}" height="${HUGE * 2}" fill="url(#${gid})" filter="url(#${fid})" style="mix-blend-mode:overlay" opacity="${(0.9 * k).toFixed(2)}"/>`
  );
}

/** Resolve active surface on a layer (undefined / none → null). */
export function layerSurface(layer: Layer): LayerSurface | null {
  return layer.surface ?? null;
}
