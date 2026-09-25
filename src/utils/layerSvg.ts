/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CutoutPath, Layer, LayerPattern, PaperMode, PapercutProject, ShadowBlend } from '../types/papercut';

export interface LayerRenderOptions {
  /** Prefix for def ids so several renders can share one DOM without collisions. */
  idPrefix: string;
  /** Paper drop shadow strength 0..1 (0 disables). */
  shadow?: number;
  /** 0 hard edge .. 1 soft blur. */
  shadowSoftness?: number;
  /** How the shadow composites onto the paper beneath it. */
  shadowBlend?: ShadowBlend;
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

/** Block id for a layer's base sheet (with its holes) in colour-block selection. */
export const BASE_BLOCK = '__base__';

export const SHADOW_BLENDS: { id: ShadowBlend; label: string }[] = [
  { id: 'multiply', label: '正片叠底' },
  { id: 'color-burn', label: '颜色加深' },
  { id: 'darken', label: '变暗' },
  { id: 'soft-light', label: '柔光' },
  { id: 'overlay', label: '叠加' },
  { id: 'normal', label: '正常' },
];

export function projectShadowOptions(project: PapercutProject, strength = project.shadowStrength ?? 0.5) {
  const mode = project.paperMode ?? 'soft';
  return {
    shadow: strength,
    paperMode: mode,
    shadowSoftness: project.shadowSoftness ?? (mode === 'hard' ? 0 : 0.5),
    shadowBlend: project.shadowBlend ?? 'multiply',
  };
}

/**
 * Appliqués and holes in the order they were made: a hole cuts every piece of paper beneath it,
 * a later appliqué covers earlier holes. Preset pieces carry small sequence numbers, so they
 * sort ahead of anything drawn by hand.
 */
export function paperSequence(layer: Layer): CutoutPath[] {
  return [...layer.positiveElements, ...layer.cutouts]
    .filter((c) => c.d)
    .map((c, i) => ({ c, i }))
    .sort((a, b) => (a.c.createdAt ?? 0) - (b.c.createdAt ?? 0) || a.i - b.i)
    .map(({ c }) => c);
}

/**
 * Splits a compound path at each absolute moveto. Mirrored copies wind the opposite way, so
 * overlapping pieces inside one path would cancel under nonzero fill; drawing each piece as its
 * own element makes overlaps always union, like stacked paper.
 */
export function splitSubpaths(d: string): string[] {
  return d.split(/(?=M)/).map((p) => p.trim()).filter(Boolean);
}

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

/**
 * The shadow silhouette alone. It is drawn as its own element beneath the paper so it can use a
 * blend mode against the layers underneath. Soft mode casts a neutral ink shadow; hard mode tints
 * it with a darker shade of the paper, like the edge of thick card.
 */
export function shadowFilterMarkup(id: string, strength: number, softness: number, mode: PaperMode, color: string): string {
  const hard = mode === 'hard';
  const dx = hard ? 2 + strength * 4 : 1.2;
  const dy = hard ? dx : 2.4;
  const blur = softness * (hard ? 6 : 2 * (1.4 + strength * 1.8));
  const flood = hard ? darken(color, 0.55) : '#1B1626';
  const alpha = hard ? 0.55 + strength * 0.4 : strength * 0.42;
  return (
    `<filter id="${id}" x="-20%" y="-20%" width="140%" height="145%">` +
    (blur > 0.05 ? `<feGaussianBlur in="SourceAlpha" stdDeviation="${blur.toFixed(2)}" result="b"/>` : '') +
    `<feOffset in="${blur > 0.05 ? 'b' : 'SourceAlpha'}" dx="${dx.toFixed(1)}" dy="${dy.toFixed(1)}" result="off"/>` +
    `<feFlood flood-color="${flood}" flood-opacity="${Math.min(1, alpha).toFixed(3)}"/>` +
    `<feComposite in2="off" operator="in"/>` +
    `</filter>`
  );
}

const fillPaths = (d: string, fill: string) =>
  splitSubpaths(d).map((p) => `<path d="${p}" fill="${fill}"/>`).join('');

const maskOpen = (id: string) =>
  `<mask id="${id}" maskUnits="userSpaceOnUse" x="${-HUGE}" y="${-HUGE}" width="${HUGE * 2}" height="${HUGE * 2}">`;

/** Self-contained SVG markup (defs + content) for one paper or doodle layer. */
export function renderLayerMarkup(layer: Layer, opts: LayerRenderOptions): string {
  const pid = `${opts.idPrefix}${layer.id}`;
  const maskId = `${pid}_mask`;
  const paperMaskId = `${pid}_paper`;
  const bodyId = `${pid}_body`;
  const patId = `${pid}_pat`;
  const grainId = `${pid}_grain`;
  const shadowId = `${pid}_shadow`;

  const doodle = layer.kind === 'doodle';
  const seq = doodle ? [] : paperSequence(layer);
  const holes = seq.filter((c) => c.isHole);
  const mode = opts.paperMode ?? 'soft';
  const useGrain = !!opts.grain && mode !== 'vector' && (layer.grain ?? 0) > 0;
  const shadow = mode === 'vector' || doodle ? 0 : opts.shadow ?? 0;
  const base = doodle ? '' : layer.baseShape?.d || '';
  const drawings = layer.drawings || [];

  const defs: string[] = [];
  defs.push(maskOpen(maskId) + fillPaths(base, '#fff') + holes.map((h) => fillPaths(h.d, '#000')).join('') + `</mask>`);
  // Brush strokes stay inside the paper as it currently stands: base and appliqués, minus holes.
  if (!doodle && (drawings.length > 0 || opts.interactive)) {
    defs.push(
      maskOpen(paperMaskId) +
        fillPaths(base, '#fff') +
        seq.map((c) => fillPaths(c.d, c.isHole ? '#000' : '#fff')).join('') +
        `</mask>`
    );
  }
  if (layer.pattern) {
    const p = layer.pattern;
    defs.push(
      `<pattern id="${patId}" patternUnits="userSpaceOnUse" width="${Math.max(4, p.scale)}" height="${Math.max(4, p.scale)}" patternTransform="rotate(${p.angle || 0})">${patternTileMarkup(p)}</pattern>`
    );
  }
  if (useGrain) defs.push(grainFilterMarkup(grainId, layer.grain ?? 0));
  if (shadow > 0) defs.push(shadowFilterMarkup(shadowId, shadow, opts.shadowSoftness ?? 0.5, mode, layer.color));

  const body: string[] = [];
  if (base) {
    body.push(`<g mask="url(#${maskId})" data-element-id="${BASE_BLOCK}">`);
    body.push(fillPaths(base, escapeAttr(layer.color)));
    if (layer.pattern) {
      splitSubpaths(base).forEach((d) => body.push(`<path d="${d}" fill="url(#${patId})" opacity="${layer.pattern!.opacity}"/>`));
    }
    body.push(`</g>`);
  }
  seq.forEach((elem, i) => {
    if (elem.isHole) return;
    const later = seq.slice(i + 1).filter((c) => c.isHole);
    let mask = '';
    if (later.length > 0) {
      const id = `${pid}_pm${i}`;
      defs.push(
        maskOpen(id) +
          `<rect x="${-HUGE}" y="${-HUGE}" width="${HUGE * 2}" height="${HUGE * 2}" fill="#fff"/>` +
          later.map((h) => fillPaths(h.d, '#000')).join('') +
          `</mask>`
      );
      mask = ` mask="url(#${id})"`;
    }
    body.push(`<g data-element-id="${elem.id}"${mask}>${fillPaths(elem.d, escapeAttr(elem.fillColor || layer.color))}</g>`);
  });

  const strokes = drawings
    .map((drw) => {
      if (drw.fill) return `<g opacity="${drw.opacity}" data-element-id="${drw.id}">${fillPaths(drw.d, escapeAttr(drw.color))}</g>`;
      const blur = drw.blur ? ` style="filter: blur(${drw.blur}px)"` : '';
      return `<path data-element-id="${drw.id}" d="${drw.d}" fill="none" stroke="${escapeAttr(drw.color)}" stroke-width="${drw.strokeWidth}" stroke-opacity="${drw.opacity}" stroke-linecap="${drw.strokeLinecap || 'round'}" stroke-linejoin="${drw.strokeLinejoin || 'round'}"${blur}/>`;
    })
    .join('');
  if (strokes) body.push(doodle ? strokes : `<g mask="url(#${paperMaskId})">${strokes}</g>`);

  const outer = [opts.interactive ? '' : `id="${layer.id}"`, `data-name="${escapeAttr(layer.name)}"`].filter(Boolean).join(' ');
  const blend = layer.blendMode && layer.blendMode !== 'normal' ? ` style="mix-blend-mode:${layer.blendMode}"` : '';
  const shadowBlend = opts.shadowBlend ?? 'multiply';
  // The shadow is a clone of the finished paper, so it follows every cut and appliqué.
  const shadowEl =
    shadow > 0
      ? `<use href="#${bodyId}" filter="url(#${shadowId})"${shadowBlend !== 'normal' ? ` style="mix-blend-mode:${shadowBlend}"` : ''}/>`
      : '';
  const inner = useGrain ? `<g filter="url(#${grainId})">${body.join('')}</g>` : body.join('');
  return `<defs>${defs.join('')}</defs><g ${outer}>${shadowEl}<g id="${bodyId}" opacity="${layer.opacity}"${blend}>${inner}</g></g>`;
}
