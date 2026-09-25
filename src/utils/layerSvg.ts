/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Layer, LayerPattern, PaperMode } from '../types/papercut';

export interface LayerRenderOptions {
  /** Prefix for def ids so several renders can share one DOM without collisions. */
  idPrefix: string;
  /** Paper drop shadow strength 0..1 (0 disables). */
  shadow?: number;
  /** How the shadow is drawn; 'vector' disables shadow and grain entirely. */
  paperMode?: PaperMode;
  /** Whether to apply the layer's gouache grain filter. */
  grain?: boolean;
  /** Omit the element id (the canvas wraps each layer in its own hit-test group). */
  interactive?: boolean;
}

export const escapeAttr = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const HUGE = 20000;

export function patternTileMarkup(p: LayerPattern): string {
  const s = Math.max(4, p.scale);
  const h = s / 2;
  const c = escapeAttr(p.color);
  switch (p.type) {
    case 'diamond': {
      const r = s * 0.22;
      const t = s * 0.07;
      return (
        `<path d="M ${h} ${h - r} L ${h + r} ${h} L ${h} ${h + r} L ${h - r} ${h} Z" fill="${c}"/>` +
        [0, s].flatMap((x) => [0, s].map((y) =>
          `<path d="M ${x} ${y - t} L ${x + t} ${y} L ${x} ${y + t} L ${x - t} ${y} Z" fill="${c}"/>`
        )).join('')
      );
    }
    case 'stripes':
      return `<rect x="0" y="0" width="${s * 0.42}" height="${s}" fill="${c}"/>`;
    case 'checks':
      return `<rect x="0" y="0" width="${h}" height="${h}" fill="${c}"/><rect x="${h}" y="${h}" width="${h}" height="${h}" fill="${c}"/><rect x="${h}" y="0" width="${h}" height="${h}" fill="${c}" opacity="0.35"/><rect x="0" y="${h}" width="${h}" height="${h}" fill="${c}" opacity="0.35"/>`;
    case 'dots':
      return `<circle cx="${h}" cy="${h}" r="${s * 0.17}" fill="${c}"/>`;
    case 'argyle':
      return `<path d="M ${h} 0 L ${s} ${h} L ${h} ${s} L 0 ${h} Z" fill="${c}" opacity="0.55"/><path d="M 0 0 L ${s} ${s} M ${s} 0 L 0 ${s}" stroke="${c}" stroke-width="${Math.max(0.6, s * 0.03)}" fill="none"/>`;
  }
}

function grainFilterMarkup(id: string, amount: number): string {
  const k = (0.06 + amount * 0.3).toFixed(3);
  const b = (1 - Number(k) * 0.8).toFixed(3);
  return (
    `<filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="fine"/>` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="11" result="blot"/>` +
    `<feBlend in="fine" in2="blot" mode="screen" result="noise"/>` +
    `<feColorMatrix in="noise" type="saturate" values="0" result="gray"/>` +
    `<feComponentTransfer in="gray" result="tone">` +
    `<feFuncR type="linear" slope="${k}" intercept="${b}"/>` +
    `<feFuncG type="linear" slope="${k}" intercept="${b}"/>` +
    `<feFuncB type="linear" slope="${k}" intercept="${b}"/>` +
    `<feFuncA type="linear" slope="0" intercept="1"/>` +
    `</feComponentTransfer>` +
    `<feBlend in="SourceGraphic" in2="tone" mode="multiply" result="tinted"/>` +
    `<feComposite in="tinted" in2="SourceGraphic" operator="in"/>` +
    `</filter>`
  );
}

function darken(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '#1B1626';
  const n = parseInt(m[1], 16);
  const ch = (shift: number) => Math.round(((n >> shift) & 255) * (1 - amount));
  return `#${[16, 8, 0].map((sh) => ch(sh).toString(16).padStart(2, '0')).join('')}`;
}

/** Hard-edged offset shadow tinted with a darker shade of the paper itself, like a thick card edge. */
export function hardShadowFilterMarkup(id: string, strength: number, color: string): string {
  const d = (2 + strength * 4).toFixed(1);
  return (
    `<filter id="${id}" x="-10%" y="-10%" width="125%" height="125%">` +
    `<feOffset in="SourceAlpha" dx="${d}" dy="${d}" result="off"/>` +
    `<feFlood flood-color="${darken(color, 0.55)}" flood-opacity="${(0.55 + strength * 0.4).toFixed(2)}"/>` +
    `<feComposite in2="off" operator="in" result="edge"/>` +
    `<feMerge><feMergeNode in="edge"/><feMergeNode in="SourceGraphic"/></feMerge>` +
    `</filter>`
  );
}

export function shadowFilterMarkup(id: string, strength: number): string {
  return (
    `<filter id="${id}" x="-15%" y="-15%" width="130%" height="135%">` +
    `<feDropShadow dx="1.2" dy="2.4" stdDeviation="${(1.4 + strength * 1.8).toFixed(2)}" flood-color="#1B1626" flood-opacity="${(strength * 0.42).toFixed(3)}"/>` +
    `</filter>`
  );
}

/** Self-contained SVG markup (defs + content) for one paper layer. */
export function renderLayerMarkup(layer: Layer, opts: LayerRenderOptions): string {
  const pid = `${opts.idPrefix}${layer.id}`;
  const maskId = `${pid}_mask`;
  const patId = `${pid}_pat`;
  const grainId = `${pid}_grain`;
  const shadowId = `${pid}_shadow`;

  const holes = layer.cutouts.filter((c) => c.isHole && c.d);
  const positives = layer.positiveElements.concat(layer.cutouts.filter((c) => !c.isHole));
  const mode = opts.paperMode ?? 'soft';
  const useGrain = !!opts.grain && mode !== 'vector' && (layer.grain ?? 0) > 0;
  const shadow = mode === 'vector' ? 0 : opts.shadow ?? 0;
  const base = layer.baseShape?.d || '';

  const defs: string[] = [];
  defs.push(
    `<mask id="${maskId}" maskUnits="userSpaceOnUse" x="${-HUGE}" y="${-HUGE}" width="${HUGE * 2}" height="${HUGE * 2}">` +
      (base ? `<path d="${base}" fill="#fff"/>` : '') +
      holes.map((h) => `<path d="${h.d}" fill="#000"/>`).join('') +
      `</mask>`
  );
  if (layer.pattern) {
    const p = layer.pattern;
    defs.push(
      `<pattern id="${patId}" patternUnits="userSpaceOnUse" width="${Math.max(4, p.scale)}" height="${Math.max(4, p.scale)}" patternTransform="rotate(${p.angle || 0})">${patternTileMarkup(p)}</pattern>`
    );
  }
  if (useGrain) defs.push(grainFilterMarkup(grainId, layer.grain ?? 0));
  if (shadow > 0) {
    defs.push(mode === 'hard' ? hardShadowFilterMarkup(shadowId, shadow, layer.color) : shadowFilterMarkup(shadowId, shadow));
  }

  const body: string[] = [];
  if (base) {
    body.push(`<g mask="url(#${maskId})">`);
    body.push(`<path d="${base}" fill="${escapeAttr(layer.color)}"/>`);
    if (layer.pattern) {
      body.push(`<path d="${base}" fill="url(#${patId})" opacity="${layer.pattern.opacity}"/>`);
    }
    (layer.drawings || []).forEach((drw) => {
      if (drw.fill) {
        body.push(`<path d="${drw.d}" fill="${escapeAttr(drw.color)}" fill-opacity="${drw.opacity}"/>`);
        return;
      }
      const blur = drw.blur ? ` style="filter: blur(${drw.blur}px)"` : '';
      body.push(
        `<path d="${drw.d}" fill="none" stroke="${escapeAttr(drw.color)}" stroke-width="${drw.strokeWidth}" stroke-opacity="${drw.opacity}" stroke-linecap="${drw.strokeLinecap || 'round'}" stroke-linejoin="${drw.strokeLinejoin || 'round'}"${blur}/>`
      );
    });
    body.push(`</g>`);
  }
  positives.forEach((elem) => {
    body.push(`<path d="${elem.d}" fill="${escapeAttr(elem.fillColor || layer.color)}" data-element-id="${elem.id}"/>`);
  });

  const attrs = [
    opts.interactive ? '' : `id="${layer.id}"`,
    `data-name="${escapeAttr(layer.name)}"`,
    `opacity="${layer.opacity}"`,
    layer.blendMode && layer.blendMode !== 'normal' ? `style="mix-blend-mode:${layer.blendMode}"` : '',
    shadow > 0 ? `filter="url(#${shadowId})"` : '',
  ].filter(Boolean).join(' ');

  const inner = useGrain ? `<g filter="url(#${grainId})">${body.join('')}</g>` : body.join('');
  return `<defs>${defs.join('')}</defs><g ${attrs}>${inner}</g>`;
}
