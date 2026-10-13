import type { Layer, PapercutProject } from '../types/papercut';
import { normalizeHex } from './color';
import { layerContent } from './layerContent';
import { flattenLayerIds, isLayerRendered, newId } from './projectOps';
import type { BlockSelection } from './projectOps';
import { BASE_BLOCK } from './layerSvg';
import { shapeOf } from './pathfinder';
import { transformPathD } from './pathTransform';
import type { StampDefinition } from './stamps';

function selectedLayers(project: PapercutProject, ids: readonly string[], blockSelection?: BlockSelection): Layer[] {
  const selected = new Set(ids);
  return flattenLayerIds(project)
    .filter(id => selected.has(id) && isLayerRendered(project, id) && project.layers[id].opacity > 0 && (blockSelection === undefined || blockSelection[id]?.length > 0))
    .map(id => project.layers[id]);
}

/** Effects that a solid vector stamp cannot preserve; the save dialog asks before flattening them. */
export function stampCaptureOmissions(project: PapercutProject, ids: readonly string[], blockSelection?: BlockSelection): string[] {
  const layers = selectedLayers(project, ids, blockSelection);
  const drawings = layers.flatMap(layer => (layer.drawings ?? []).filter(drawing => blockSelection === undefined || blockSelection[layer.id]?.includes(drawing.id)));
  const baseLayers = layers.filter(layer => blockSelection === undefined || blockSelection[layer.id]?.includes(BASE_BLOCK));
  const omissions: string[] = [];
  if (layers.some(layer => layer.opacity < 1) || drawings.some(drawing => drawing.opacity > 0 && drawing.opacity < 1)) omissions.push('半透明');
  if (drawings.some(drawing => drawing.opacity > 0 && (drawing.blur ?? 0) > 0)) omissions.push('喷枪模糊');
  if (layers.some(layer => layer.blendMode !== 'normal')) omissions.push('混合模式');
  if (baseLayers.some(layer => layer.pattern && (layer.pattern.opacity ?? 1) > 0)) omissions.push('图层纹样');
  if (layers.some(layer => layer.stroke?.enabled && layer.stroke.width > 0 && layer.stroke.opacity > 0)) omissions.push('图层描边');
  return omissions;
}

/** Capture only the chosen layers, bottom first. Cuts and clipped strokes use the visible geometry. */
export function captureSelectedStamp(project: PapercutProject, ids: readonly string[], name: string, blockSelection?: BlockSelection): StampDefinition {
  if (!ids.length || (blockSelection !== undefined && !ids.some(id => blockSelection[id]?.length))) throw new Error('请先选中要保存的图形。');
  const layers = selectedLayers(project, ids, blockSelection);
  if (layers.some(layer => layer.fabric && (blockSelection === undefined || blockSelection[layer.id]?.includes(BASE_BLOCK)))) {
    throw new Error('图片布料不能转成矢量图章。请保留为布料素材，或选中描摹后的图形。');
  }
  const pieces = layers.flatMap(layer => layerContent(layer).pieces.filter(piece => blockSelection === undefined || blockSelection[layer.id]?.includes(piece.id)));
  if (!pieces.length) throw new Error('选中图层内没有可见的图形。');
  if (pieces.length > 200) throw new Error('选中图形超过 200 个色块，请合并或精简后再保存。');

  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const piece of pieces) {
    for (const [x, y] of shapeOf(piece.d).flat(2)) {
      left = Math.min(left, x); top = Math.min(top, y);
      right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
  }
  const extent = Math.max(right - left, bottom - top);
  if (!Number.isFinite(extent) || extent <= 0) throw new Error('选中图形没有可用的面积。');
  const scale = 90 / extent;
  const offsetX = 50 - (left + right) / 2 * scale;
  const offsetY = 50 - (top + bottom) / 2 * scale;
  return {
    id: newId('stamp'),
    name: name.trim().slice(0, 80) || '新图章',
    parts: pieces.map((piece, index) => ({
      id: `part_${index}`,
      d: transformPathD(piece.d, [scale, 0, 0, scale, offsetX, offsetY]),
      color: normalizeHex(piece.color) ?? '#000000',
    })),
  };
}
