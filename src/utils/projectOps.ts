import {transformLiveStrokes,normalizeLiveStamps,detachChangedLiveStamps} from './liveStamps';
import {normalizeOutfits,isWardrobeCategory} from './wardrobe';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Layer, PapercutItem, PapercutProject, SymmetrySource } from '../types/papercut';
import { Transform, Matrix, applyTransform, isWarp, linearPart, matrixScale, multiply, transformPathD } from './pathTransform';
import { BASE_BLOCK } from './layerSvg';
import { normalizeFabricAsset, normalizeFabricFill, transformFabric } from './fabric';
import { validateColorSchemes } from './palettes';
import { getLayerEffectiveState, normalizeDrawingGroups } from './drawingGroups';
import { parseVectorPath } from './vectorPath';
import {normalizeSymmetry} from './symmetry';

export { getLayerEffectiveState, findDrawingGroupOfLayer } from './drawingGroups';

/** Damaged optional editing metadata must never block recovery of its already-baked artwork. */
function normalizeSymmetricGeometry<T extends { symmetrySource?: SymmetrySource; points?: unknown; vectorNodeModes?: unknown }>(value: T): T {
  if (value.symmetrySource === undefined) return value;
  const candidate = value.symmetrySource;
  try {
    if (!candidate || typeof candidate.d !== 'string' || !candidate.d || candidate.d.length > 2_000_000 ||
      !Array.isArray(candidate.matrices) || !candidate.matrices.length || candidate.matrices.length > 64 ||
      !candidate.matrices.every(m => Array.isArray(m) && m.length === 6 && m.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1e9) && Math.abs(m[0]*m[3]-m[1]*m[2]) > 1e-12)) throw new Error('Invalid symmetry source');
    if (!parseVectorPath(candidate.d).length) throw new Error('Invalid source path');
    return { ...value, symmetrySource: { d: candidate.d, matrices: candidate.matrices.map(m => [...m] as Matrix) } };
  } catch {
    return { ...value, symmetrySource: undefined, points: undefined, vectorNodeModes: undefined };
  }
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/** Bakes an affine transform or warp into every path of a layer. */
export function transformLayer(layer: Layer, m: Transform): Layer {
  const s = matrixScale(linearPart(m));
  const source = (value?: SymmetrySource): SymmetrySource | undefined => {
    if (!value || isWarp(m)) return undefined;
    const [a,b,c,d,e,f] = m, det = a*d-b*c;
    if (Math.abs(det) < 1e-12) return undefined;
    const inverse: Matrix = [d/det,-b/det,-c/det,a/det,(c*f-d*e)/det,(b*e-a*f)/det];
    return { d: transformPathD(value.d,m), matrices: value.matrices.map(copy => multiply(m,multiply(copy,inverse))) };
  };
  const metadata = <T extends { symmetrySource?: SymmetrySource; vectorNodeModes?: unknown }>(value: T) => {
    const symmetrySource = source(value.symmetrySource);
    return { symmetrySource, ...(value.symmetrySource && !symmetrySource ? { vectorNodeModes: undefined } : {}) };
  };
  const tc = <T extends { d: string; symmetrySource?: SymmetrySource; points?: { x: number; y: number }[]; stroke?: { width: number }; vectorNodeModes?: unknown }>(c: T): T => ({
    ...c,
    ...metadata(c),
    d: transformPathD(c.d, m),
    points: c.symmetrySource && (isWarp(m) || s < 1e-6) ? undefined : c.points?.map((p) => applyTransform(m, p)),
    ...(c.stroke ? { stroke: { ...c.stroke, width: c.stroke.width * s } } : {}),
  });
  return {
    ...layer,
    fabric: layer.fabric ? transformFabric(layer.fabric, m) : undefined,
    liveStamps:transformLiveStrokes(layer,m),
    baseShape: {
      ...layer.baseShape,
      type: layer.baseShape.type === 'full' ? 'freeform' : layer.baseShape.type,
      d: transformPathD(layer.baseShape.d, m),
      ...metadata(layer.baseShape),
    },
    cutouts: layer.cutouts.map(tc),
    positiveElements: layer.positiveElements.map(tc),
    drawings: layer.drawings?.map((drw) => ({
      ...drw,
      d: transformPathD(drw.d, m),
      ...metadata(drw),
      strokeWidth: drw.strokeWidth * s,
      blur: drw.blur ? drw.blur * s : drw.blur,
    })),
  };
}

/** Layer ids in render order, bottom first. Includes hidden layers. */
export function flattenLayerIds(project: PapercutProject): string[] {
  const ids: string[] = [];
  project.rootOrder.forEach((item) => {
    if (item.type === 'group') {
      const grp = project.groups.find((g) => g.id === item.id);
      grp?.layerIds.forEach((lid) => project.layers[lid] && ids.push(lid));
    } else if (project.layers[item.id]) {
      ids.push(item.id);
    }
  });
  return ids;
}

export function isLayerRendered(project: PapercutProject, layerId: string): boolean {
  return getLayerEffectiveState(project, layerId).visible;
}

export function findGroupOfLayer(project: PapercutProject, layerId: string) {
  return project.groups.find((g) => g.layerIds.includes(layerId)) || null;
}

export function findItemOfLayer(project: PapercutProject, layerId: string): PapercutItem | null {
  return (project.items || []).find((it) => it.partIds.includes(layerId)) || null;
}

export interface DepthSlot {
  id: string; // group id, or layer id for root-level layers
  name: string;
  zBase: number;
  layerIds: string[];
}

/**
 * Depth table used by the Godot exporter. Each root entry (group or loose layer) is a depth slot;
 * layers inside a group get consecutive z values so the in-editor stacking order is preserved.
 */
export function computeDepthTable(project: PapercutProject): {
  slots: DepthSlot[];
  zOf: Record<string, number>;
} {
  const slots: DepthSlot[] = [];
  const zOf: Record<string, number> = {};
  let z = 0;
  for (const entry of project.rootOrder) {
    const group = entry.type === 'group' ? project.groups.find(g => g.id === entry.id) : null;
    const ids = (group ? group.layerIds : entry.type === 'layer' ? [entry.id] : []).filter(id => project.layers[id]);
    slots.push({id:entry.id,name:group?.name || project.layers[entry.id]?.name || entry.id,zBase:z,layerIds:ids});
    for (const id of ids) zOf[id] = z++;
  }
  return { slots, zOf };
}

/** Drops dangling references and fills defaults for projects authored before items existed. */
export function normalizeProject(p: PapercutProject, recoverMetadata = false): PapercutProject {
  let colorSchemes = p.colorSchemes;
  if(colorSchemes!==undefined){
    try{colorSchemes=validateColorSchemes(colorSchemes);}catch(error){
      if(!recoverMetadata)throw error;
      // A damaged optional scheme must not prevent every drawing in the workspace from opening.
      colorSchemes=Array.isArray(colorSchemes)?colorSchemes.slice(0,100).flatMap(scheme=>{try{return validateColorSchemes([scheme]);}catch{return [];}}):[];
    }
  }
  const fabricAssets = Object.fromEntries(Object.entries(p.fabricAssets || {}).flatMap(([id, value]) => {
    const asset = normalizeFabricAsset(value);
    return asset && asset.id === id ? [[id, asset]] : [];
  }));
  const layers = Object.fromEntries(Object.entries(p.layers || {}).map(([id, layer]) => {
    const geometry={...layer,baseShape:normalizeSymmetricGeometry(layer.baseShape),cutouts:layer.cutouts.map(normalizeSymmetricGeometry),positiveElements:layer.positiveElements.map(normalizeSymmetricGeometry),drawings:layer.drawings?.map(normalizeSymmetricGeometry)};
    const next=geometry.liveStamps?detachChangedLiveStamps({...geometry,liveStamps:normalizeLiveStamps(geometry.liveStamps)}):geometry;
    if (!layer.fabric) return [id, next];
    const fabric = normalizeFabricFill(layer.fabric);
    return [id, { ...next, fabric: fabric && fabricAssets[fabric.assetId] ? fabric : undefined }];
  }));
  const groups = (p.groups || []).map((g) => ({
    ...g,
    layerIds: g.layerIds.filter((id) => layers[id]),
  }));
  const rootOrder = (p.rootOrder || []).filter((r) =>
    r.type === 'group' ? groups.some((g) => g.id === r.id) : layers[r.id]
  );
  const items = (p.items || [])
    .map((it) => ({
      ...it,
      partIds: it.partIds.filter((id) => layers[id]),
      sockets: it.sockets || [],
      ...(it.wardrobeCategory!==undefined?{wardrobeCategory:isWardrobeCategory(it.wardrobeCategory)?it.wardrobeCategory:undefined}:{}),
    }))
    .filter((it) => it.partIds.length > 0);
  return {
    ...p,
    layers,
    fabricAssets,
    colorSchemes,
    groups,
    drawingGroups: normalizeDrawingGroups(p.drawingGroups, layers),
    symmetry:normalizeSymmetry(p.symmetry),
    rootOrder,
    items,
    outfits:p.outfits?normalizeOutfits(p.outfits,items):undefined,
    shadowStrength: p.shadowStrength ?? 0.5,
  };
}

/** Selected colour blocks per layer: element ids, or BASE_BLOCK for the base sheet. */
export type BlockSelection = Record<string, string[]>;

export function blockColor(layer: Layer, id: string): string | null {
  if (id === BASE_BLOCK) return layer.color;
  const el = [...layer.positiveElements, ...layer.cutouts].find((c) => c.id === id);
  if (el) return el.isHole ? null : el.fillColor || layer.color;
  return layer.drawings?.find((d) => d.id === id)?.color ?? null;
}

/** Every block of a layer painted in the given colour. */
export function blocksOfColor(layer: Layer, color: string): string[] {
  const c = color.toLowerCase();
  const ids: string[] = [];
  if (layer.kind !== 'doodle' && layer.baseShape?.d && layer.color.toLowerCase() === c) ids.push(BASE_BLOCK);
  [...layer.positiveElements, ...layer.cutouts].forEach((e) => !e.isHole && (e.fillColor || layer.color).toLowerCase() === c && ids.push(e.id));
  (layer.drawings || []).forEach((d) => d.color.toLowerCase() === c && ids.push(d.id));
  return ids;
}

/**
 * Transforms only the chosen blocks of a layer. The base sheet carries its holes with it, the way
 * moving a cut sheet moves its cut-outs; appliqués and strokes move on their own.
 */
export function transformBlocks(layer: Layer, ids: string[], m: Transform): Layer {
  const set = new Set(ids);
  const moved = transformLayer(layer, m);
  const base = set.has(BASE_BLOCK);
  const pick = <T extends { id: string; isHole?: boolean }>(orig: T[], next: T[]) =>
    orig.map((c, i) => (set.has(c.id) || (base && c.isHole) ? next[i] : c));
  return {
    ...layer,
    baseShape: base ? moved.baseShape : layer.baseShape,
    fabric: base ? moved.fabric : layer.fabric,
    cutouts: pick(layer.cutouts, moved.cutouts),
    positiveElements: pick(layer.positiveElements, moved.positiveElements),
    drawings: layer.drawings && moved.drawings ? pick(layer.drawings, moved.drawings) : layer.drawings,
  };
}

/** Removes appliqués and strokes; the base sheet cannot be removed this way. */
export function removeBlocks(layer: Layer, ids: string[]): Layer {
  const set = new Set(ids);
  return {
    ...layer,
    cutouts: layer.cutouts.filter((c) => !set.has(c.id)),
    positiveElements: layer.positiveElements.filter((c) => !set.has(c.id)),
    drawings: layer.drawings?.filter((d) => !set.has(d.id)),
  };
}

/** Repaints everything in a layer drawn with `from`: paper, pattern, appliqués and strokes. */
export function recolorLayer(layer: Layer, from: string, to: string): Layer {
  const f = from.toLowerCase();
  const is = (c?: string) => !!c && c.toLowerCase() === f;
  const baseIs = is(layer.color);
  const piece = <T extends { isHole: boolean; fillColor?: string }>(c: T): T =>
    c.isHole ? c : is(c.fillColor) || (!c.fillColor && baseIs) ? { ...c, fillColor: to } : c;
  return {
    ...layer,
    color: baseIs ? to : layer.color,
    pattern: layer.pattern && is(layer.pattern.color) ? { ...layer.pattern, color: to } : layer.pattern,
    surface:
      layer.surface && !layer.surface.inheritColor && is(layer.surface.color)
        ? { ...layer.surface, color: to }
        : layer.surface && layer.surface.inheritColor && baseIs
          ? { ...layer.surface, color: to }
          : layer.surface,
    cutouts: layer.cutouts.map(piece),
    positiveElements: layer.positiveElements.map(piece),
    drawings: layer.drawings?.map((d) => (is(d.color) ? { ...d, color: to } : d)),
  };
}

/** Removes the appliqués and strokes painted in a colour; the base sheet stays. */
export function removeColorBlocks(layer: Layer, color: string): Layer {
  return removeBlocks(layer, blocksOfColor(layer, color).filter((id) => id !== BASE_BLOCK));
}

export const NAME_SEP = '·';

/** First segment of a part layer's name: the item's short name, falling back to its full name. */
export const itemPrefix = (item: Pick<PapercutItem, 'name' | 'shortName'>) => item.shortName?.trim() || item.name.trim();

/** A part's name with its first segment set to `prefix`; a bare name gains the prefix. */
export function prefixedName(name: string, prefix: string, oldPrefixes: string[] = []): string {
  if (!prefix) return name;
  const i = name.indexOf(NAME_SEP);
  if (i >= 0) return `${prefix}${NAME_SEP}${name.slice(i + 1)}`;
  if (name === prefix || oldPrefixes.includes(name)) return prefix;
  return `${prefix}${NAME_SEP}${name}`;
}

/** Renames every part of an item so its first segment follows the item's current prefix. */
export function renameItemParts(layers: Record<string, Layer>, item: PapercutItem, oldPrefixes: string[] = []): Record<string, Layer> {
  const prefix = itemPrefix(item);
  const next = { ...layers };
  item.partIds.forEach((id) => {
    const l = next[id];
    if (!l) return;
    const name = prefixedName(l.name, prefix, oldPrefixes);
    if (name !== l.name) next[id] = { ...l, name };
  });
  return next;
}
