/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Layer, PapercutItem, PapercutProject } from '../types/papercut';
import { Transform, applyTransform, linearPart, matrixScale, transformPathD } from './pathTransform';

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/** Bakes an affine transform or warp into every path of a layer. */
export function transformLayer(layer: Layer, m: Transform): Layer {
  const s = matrixScale(linearPart(m));
  const tc = <T extends { d: string; points?: { x: number; y: number }[] }>(c: T): T => ({
    ...c,
    d: transformPathD(c.d, m),
    points: c.points?.map((p) => applyTransform(m, p)),
  });
  return {
    ...layer,
    baseShape: {
      ...layer.baseShape,
      type: layer.baseShape.type === 'full' ? 'freeform' : layer.baseShape.type,
      d: transformPathD(layer.baseShape.d, m),
    },
    cutouts: layer.cutouts.map(tc),
    positiveElements: layer.positiveElements.map(tc),
    drawings: layer.drawings?.map((drw) => ({
      ...drw,
      d: transformPathD(drw.d, m),
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
  const layer = project.layers[layerId];
  if (!layer || !layer.visible) return false;
  const grp = project.groups.find((g) => g.layerIds.includes(layerId));
  return grp ? grp.visible : true;
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
  const maxGroup = Math.max(1, ...project.groups.map((g) => g.layerIds.length));
  const stride = Math.max(10, Math.ceil((maxGroup + 1) / 10) * 10);
  const slots: DepthSlot[] = [];
  const zOf: Record<string, number> = {};
  project.rootOrder.forEach((entry, idx) => {
    const zBase = idx * stride;
    if (entry.type === 'group') {
      const grp = project.groups.find((g) => g.id === entry.id);
      if (!grp) return;
      grp.layerIds.forEach((lid, j) => (zOf[lid] = zBase + j));
      slots.push({ id: grp.id, name: grp.name, zBase, layerIds: [...grp.layerIds] });
    } else if (project.layers[entry.id]) {
      zOf[entry.id] = zBase;
      slots.push({ id: entry.id, name: project.layers[entry.id].name, zBase, layerIds: [entry.id] });
    }
  });
  return { slots, zOf };
}

/** Drops dangling references and fills defaults for projects authored before items existed. */
export function normalizeProject(p: PapercutProject): PapercutProject {
  const layers = p.layers || {};
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
    }))
    .filter((it) => it.partIds.length > 0);
  return {
    ...p,
    layers,
    groups,
    rootOrder,
    items,
    shadowStrength: p.shadowStrength ?? 0.5,
  };
}
