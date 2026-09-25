/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CutoutPath, Layer } from '../types/papercut';
import { newId } from './projectOps';
import { visiblePaperPieces } from './pathfinder';

/**
 * Folds the upper layer into the lower one (Photoshop-style merge down).
 * Upper paper is baked into coloured appliqués so its holes only affect its own sheets,
 * not the layer beneath. Drawings are appended. Lower layer id / opacity / blend / stroke
 * / pattern / texture are kept; if a doodle receives paper, it is promoted to paper.
 */
export function mergeLayerOnto(upper: Layer, lower: Layer): Layer {
  const now = Date.now();
  const pieces = visiblePaperPieces(upper);
  const appliques: CutoutPath[] = pieces.map((p, i) => ({
    id: newId('cut'),
    name: pieces.length > 1 ? `${upper.name} ${i + 1}` : upper.name,
    type: 'custom_polygon',
    d: p.d,
    isHole: false,
    fillColor: p.color,
    createdAt: now + i,
  }));

  // Empty-base paper (e.g. twin blanks): keep cutouts / appliqués as-is with remapped ids.
  const passthrough =
    upper.kind !== 'doodle' && !upper.baseShape?.d
      ? [...upper.positiveElements, ...upper.cutouts].map((c, i) => ({
          ...c,
          id: newId('cut'),
          createdAt: (c.createdAt ?? now) + 1000 + i,
          fillColor: c.isHole ? undefined : c.fillColor || upper.color,
        }))
      : [];

  const drawings = [
    ...(lower.drawings || []),
    ...(upper.drawings || []).map((d) => ({ ...d, id: newId('drw') })),
  ];

  const promote = lower.kind === 'doodle' && (appliques.length > 0 || passthrough.length > 0);
  return {
    ...lower,
    kind: promote ? 'paper' : lower.kind,
    color: promote ? upper.color : lower.color,
    texture: promote ? upper.texture : lower.texture,
    grain: promote ? upper.grain : lower.grain,
    baseShape: promote && !lower.baseShape?.d ? { type: 'freeform', d: '' } : lower.baseShape,
    positiveElements: [
      ...lower.positiveElements,
      ...appliques,
      ...passthrough.filter((c) => !c.isHole),
    ],
    cutouts: [...lower.cutouts, ...passthrough.filter((c) => c.isHole)],
    drawings,
  };
}
