import type { PapercutProject } from '../types/papercut';
import { escapeAttr, renderLayerMarkup } from './layerSvg';
import { flattenLayerIds, isLayerRendered } from './projectOps';

// Plain street layers need no masks: masking a shape by itself doubles edge antialiasing.
// Edited cut-paper layers still use the editor's established mask/texture renderer.
export function exportStreet(p: PapercutProject): string {
  const out=[`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${p.width} ${p.height}" width="${p.width}" height="${p.height}">`];
  if(p.canvasBg?.kind==='solid')out.push(`<rect width="${p.width}" height="${p.height}" fill="${escapeAttr(p.canvasBg.color)}"/>`);
  for(const id of flattenLayerIds(p)) {
    if(!isLayerRendered(p,id))continue;
    const l=p.layers[id];
    if(l.fabric||l.cutouts.length||l.positiveElements.length||l.pattern||l.stroke?.enabled||l.surface||l.blendMode!=='normal'||l.drawings?.some(d=>d.blur)|| (l.drawings?.length&&!l.unclippedDrawings&&l.kind!=='doodle')) {
      out.push(renderLayerMarkup(l,{idPrefix:'game_',paperMode:'vector',grain:false,shadow:0,fabricAssets:p.fabricAssets}));continue;
    }
    out.push(`<g id="${escapeAttr(id)}" opacity="${l.opacity}">`);
    if(l.kind!=='doodle'&&l.baseShape.d)out.push(`<path d="${escapeAttr(l.baseShape.d)}" fill="${escapeAttr(l.color)}"/>`);
    for(const d of l.drawings||[]) out.push(`<path d="${escapeAttr(d.d)}" fill="${d.fill?escapeAttr(d.color):'none'}" stroke="${d.fill?'none':escapeAttr(d.color)}" opacity="${d.opacity}" stroke-width="${d.strokeWidth}" stroke-linecap="${d.strokeLinecap||'round'}" stroke-linejoin="${d.strokeLinejoin||'round'}"/>`);
    out.push('</g>');
  }
  out.push('</svg>');return out.join('\n');
}
