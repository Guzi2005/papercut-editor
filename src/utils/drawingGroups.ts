import type { DrawingGroup, Layer, PapercutItem, PapercutProject, Point } from '../types/papercut';
import { flattenLayerIds, newId, transformLayer } from './projectOps';
import { applyTransform, type Transform } from './pathTransform';
import { normalizeOutfits } from './wardrobe';

/** One editing parent per layer. First valid membership wins when recovering older files. */
export function normalizeDrawingGroups(value: unknown, layers: Record<string, Layer>): DrawingGroup[] {
  if (!Array.isArray(value)) return [];
  const usedGroups = new Set<string>(), usedLayers = new Set<string>();
  const result: DrawingGroup[] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== 'object' || typeof candidate.id !== 'string' || !candidate.id || usedGroups.has(candidate.id)) continue;
    const layerIds = Array.isArray(candidate.layerIds)
      ? candidate.layerIds.filter((id: unknown): id is string => typeof id === 'string' && !!layers[id] && !usedLayers.has(id)) : [];
    const uniqueIds = [...new Set<string>(layerIds)];
    if (!uniqueIds.length) continue;
    usedGroups.add(candidate.id);
    uniqueIds.forEach(id => usedLayers.add(id));
    result.push({ id: candidate.id, name: typeof candidate.name === 'string' ? candidate.name.trim() || '绘制组' : '绘制组',
      collapsed: candidate.collapsed === true, visible: candidate.visible !== false, locked: candidate.locked === true, layerIds: uniqueIds });
  }
  return result;
}

export function findDrawingGroupOfLayer(project: PapercutProject, layerId: string): DrawingGroup | null {
  return project.drawingGroups?.find(group => group.layerIds.includes(layerId)) ?? null;
}

/** Shared by rendering, selection, editing and export. Hidden membership never changes z order. */
export function getLayerEffectiveState(project: PapercutProject, layerId: string): { visible: boolean; locked: boolean } {
  const layer = project.layers[layerId];
  if (!layer) return { visible: false, locked: true };
  const groups = [...(project.groups ?? []), ...(project.drawingGroups ?? [])].filter(group => group.layerIds.includes(layerId));
  return { visible: layer.visible && groups.every(group => group.visible), locked: layer.locked || groups.some(group => group.locked) };
}

const existingIds = (project: PapercutProject, selected: readonly string[]) => {
  const wanted = new Set(selected);
  return flattenLayerIds(project).filter(id => wanted.has(id));
};

/** Regrouping a member preserves its old effective state instead of unexpectedly revealing it. */
export function createDrawingGroup(project: PapercutProject, selected: readonly string[], name = '绘制组'): { project: PapercutProject; group: DrawingGroup | null } {
  const layerIds = existingIds(project, selected);
  if (!layerIds.length) return { project, group: null };
  const selectedIds = new Set(layerIds), layers = { ...project.layers };
  for (const id of layerIds) {
    const parent = findDrawingGroupOfLayer(project, id), layer = layers[id];
    if (parent && (!parent.visible || parent.locked)) layers[id] = { ...layer, visible: layer.visible && parent.visible, locked: layer.locked || parent.locked };
  }
  const group: DrawingGroup = { id: newId('drawgroup'), name: name.trim() || '绘制组', collapsed: false, visible: true, locked: false, layerIds };
  const drawingGroups = (project.drawingGroups ?? []).map(parent => ({ ...parent, layerIds: parent.layerIds.filter(id => !selectedIds.has(id)) })).filter(parent => parent.layerIds.length);
  return { project: { ...project, layers, drawingGroups: [...drawingGroups, group] }, group };
}

/** Dissolving the helper group leaves artwork, stacking and item ownership unchanged. */
export function ungroupDrawingGroup(project: PapercutProject, groupId: string): PapercutProject {
  const group = project.drawingGroups?.find(candidate => candidate.id === groupId);
  if (!group) return project;
  const layers = { ...project.layers };
  for (const id of group.layerIds) {
    const layer = layers[id];
    if (layer && (!group.visible || group.locked)) layers[id] = { ...layer, visible: layer.visible && group.visible, locked: layer.locked || group.locked };
  }
  return { ...project, layers, drawingGroups: project.drawingGroups!.filter(candidate => candidate.id !== groupId) };
}

export function updateDrawingGroup(project: PapercutProject, groupId: string, updates: Partial<Omit<DrawingGroup, 'id'>>): PapercutProject {
  if (!project.drawingGroups?.some(group => group.id === groupId)) return project;
  const drawingGroups = normalizeDrawingGroups(project.drawingGroups.map(group => group.id === groupId ? { ...group, ...updates, id: groupId } : group), project.layers);
  return { ...project, drawingGroups };
}

export interface GroupItemOptions {
  name?: string;
  pivot?: Point;
  /** Reassigning owned parts is an explicit choice; never silently dismantle an existing item. */
  reassign?: boolean;
}

/** Adds asset identity to the same parts; the editing group is retained and z order is untouched. */
export function convertDrawingGroupToItem(project: PapercutProject, groupId: string, options: GroupItemOptions = {}): { project: PapercutProject; item: PapercutItem | null } {
  const group = project.drawingGroups?.find(candidate => candidate.id === groupId);
  if (!group) return { project, item: null };
  const partIds = existingIds(project, group.layerIds), selected = new Set(partIds);
  if (!partIds.length) return { project, item: null };
  const owners = (project.items ?? []).filter(item => item.partIds.some(id => selected.has(id)));
  if (owners.length === 1 && owners[0].partIds.length === partIds.length && owners[0].partIds.every(id => selected.has(id))) return { project, item: owners[0] };
  if (owners.length && !options.reassign) throw new Error('这些图层已属于物件，请先解除归属或明确重新分配。');
  const item: PapercutItem = { id: newId('item'), name: options.name?.trim() || group.name, partIds,
    pivot: options.pivot ? { ...options.pivot } : { x: project.width / 2, y: project.height / 2 }, sockets: [] };
  const items = [...(project.items ?? []).map(owner => ({ ...owner, partIds: owner.partIds.filter(id => !selected.has(id)) })).filter(owner => owner.partIds.length), item];
  return { project: { ...project, items, outfits: project.outfits ? normalizeOutfits(project.outfits, items) : undefined }, item };
}

/** Delete references together so no empty group, item or wardrobe slot survives a deleted part. */
export function deleteProjectLayers(project: PapercutProject, selected: readonly string[]): PapercutProject {
  const ids = new Set(selected.filter(id => !!project.layers[id]));
  if (!ids.size) return project;
  const layers = Object.fromEntries(Object.entries(project.layers).filter(([id]) => !ids.has(id)));
  const groups = (project.groups ?? []).map(group => ({ ...group, layerIds: group.layerIds.filter(id => !ids.has(id)) })).filter(group => group.layerIds.length);
  const items = (project.items ?? []).map(item => ({ ...item, partIds: item.partIds.filter(id => !ids.has(id)) })).filter(item => item.partIds.length);
  return { ...project, layers, groups, drawingGroups: normalizeDrawingGroups(project.drawingGroups, layers), items,
    rootOrder: project.rootOrder.filter(entry => entry.type === 'layer' ? !ids.has(entry.id) : groups.some(group => group.id === entry.id)),
    outfits: project.outfits ? normalizeOutfits(project.outfits, items) : undefined };
}

export interface DuplicateLayerResult {
  project: PapercutProject;
  layerIds: string[];
  idMap: Record<string, string>;
  groupIds: string[];
  itemIds: string[];
}

/** Deep clone recipe snapshots and remap both cached native geometry and their live ownership ids. */
function cloneLayer(layer: Layer, nameSuffix: string): Layer {
  const result = structuredClone(layer), pathIds = new Map<string, string>();
  result.id = newId('layer'); result.name += nameSuffix;
  for (const path of [...result.cutouts, ...result.positiveElements, ...(result.drawings ?? [])]) pathIds.set(path.id, newId('path'));
  for (const stroke of result.liveStamps ?? []) {
    const oldId = stroke.id, nextId = newId('stamp');
    for (const id of stroke.pathIds) if (pathIds.has(id)) pathIds.set(id, id.includes(oldId) ? id.replace(oldId, nextId) : newId('path'));
    stroke.id = nextId;
    stroke.pathIds = stroke.pathIds.map(id => pathIds.get(id) ?? id);
    if (stroke.cacheHashes) stroke.cacheHashes = Object.fromEntries(Object.entries(stroke.cacheHashes).map(([id, hash]) => [pathIds.get(id) ?? id, hash]));
  }
  for (const path of [...result.cutouts, ...result.positiveElements, ...(result.drawings ?? [])]) path.id = pathIds.get(path.id)!;
  return result;
}

/** Copy each selected layer immediately above its source, preserving relative depth. */
export function duplicateProjectLayers(project: PapercutProject, selected: readonly string[], options: { nameSuffix?: string } = {}): DuplicateLayerResult {
  const sourceIds = existingIds(project, selected), idMap: Record<string, string> = {}, groupIds: string[] = [], itemIds: string[] = [];
  if (!sourceIds.length) return { project, layerIds: [], idMap, groupIds, itemIds };
  const layers = { ...project.layers }, wanted = new Set(sourceIds);
  for (const id of sourceIds) { const copy = cloneLayer(layers[id], options.nameSuffix ?? ' 副本'); idMap[id] = copy.id; layers[copy.id] = copy; }
  const layerIds = sourceIds.map(id => idMap[id]);
  // Legacy depth containers remain supported when this command is used before flatStack migration.
  const groups = project.groups.map(group => ({ ...group, layerIds: group.layerIds.flatMap(id => idMap[id] ? [id, idMap[id]] : [id]) }));
  const grouped = new Set(groups.flatMap(group => group.layerIds));
  const rootOrder = project.rootOrder.flatMap(entry => entry.type === 'layer' && idMap[entry.id] && !grouped.has(idMap[entry.id]) ? [entry, { type: 'layer' as const, id: idMap[entry.id] }] : [entry]);
  const drawingGroups: DrawingGroup[] = [];
  for (const group of project.drawingGroups ?? []) {
    if (group.layerIds.length && group.layerIds.every(id => wanted.has(id))) {
      const copy = { ...group, id: newId('drawgroup'), name: group.name + (options.nameSuffix ?? ' 副本'), layerIds: group.layerIds.map(id => idMap[id]) };
      drawingGroups.push(group, copy); groupIds.push(copy.id);
    } else drawingGroups.push({ ...group, layerIds: group.layerIds.flatMap(id => idMap[id] ? [id, idMap[id]] : [id]) });
  }
  const items: PapercutItem[] = [];
  for (const item of project.items ?? []) {
    if (item.partIds.length && item.partIds.every(id => wanted.has(id))) {
      const copy = structuredClone(item); copy.id = newId('item'); copy.name += options.nameSuffix ?? ' 副本'; copy.partIds = item.partIds.map(id => idMap[id]);
      copy.sockets = copy.sockets.map(socket => ({ ...socket, id: newId('socket') }));
      items.push(item, copy); itemIds.push(copy.id);
    } else items.push({ ...item, partIds: item.partIds.flatMap(id => idMap[id] ? [id, idMap[id]] : [id]) });
  }
  return { project: { ...project, layers, groups, rootOrder, drawingGroups, items }, layerIds, idMap, groupIds, itemIds };
}

/** Paste an independent clipboard snapshot; all pasted parts become new document identities. */
export function pasteProjectLayers(target: PapercutProject, source: PapercutProject, selected: readonly string[]): DuplicateLayerResult {
  const ids = existingIds(source, selected), selectedIds = new Set(ids);
  if (!ids.length) return { project: target, layerIds: [], idMap: {}, groupIds: [], itemIds: [] };
  const layers = Object.fromEntries(ids.map(id => {
    const layer = source.layers[id], legacy = source.groups.filter(group => group.layerIds.includes(id));
    return [id, legacy.length ? { ...layer, visible: layer.visible && legacy.every(group => group.visible), locked: layer.locked || legacy.some(group => group.locked) } : layer];
  }));
  const items = (source.items ?? []).map(item => ({ ...item, partIds: item.partIds.filter(id => selectedIds.has(id)) })).filter(item => item.partIds.length);
  const subset: PapercutProject = { ...source, layers, groups: [], rootOrder: ids.map(id => ({ type: 'layer', id })),
    drawingGroups: normalizeDrawingGroups(source.drawingGroups, layers), items };
  const result = duplicateProjectLayers(subset, ids, { nameSuffix: '' });
  const pastedLayers = Object.fromEntries(result.layerIds.map(id => [id, result.project.layers[id]]));
  const fabricAssets = { ...target.fabricAssets };
  const assetIds = new Map<string, string>();
  for (const layer of Object.values(pastedLayers)) {
    if (!layer.fabric) continue;
    const sourceAsset = source.fabricAssets?.[layer.fabric.assetId];
    if (!sourceAsset) { layer.fabric = undefined; continue; }
    const mapped = assetIds.get(sourceAsset.id);
    if (mapped) { layer.fabric = { ...layer.fabric, assetId: mapped }; continue; }
    const conflict = fabricAssets[sourceAsset.id];
    if (conflict && JSON.stringify(conflict) !== JSON.stringify(sourceAsset)) {
      const id = newId('fabric'); fabricAssets[id] = { ...sourceAsset, id }; layer.fabric = { ...layer.fabric, assetId: id }; assetIds.set(sourceAsset.id, id);
    } else { fabricAssets[sourceAsset.id] = { ...sourceAsset }; assetIds.set(sourceAsset.id, sourceAsset.id); }
  }
  const pastedItems = (result.project.items ?? []).filter(item => result.itemIds.includes(item.id));
  const itemMap = new Map(items.map((item, index) => [item.id, pastedItems[index]?.id]));
  const pastedOutfits = (source.outfits ?? []).flatMap(outfit => {
    const refs = [...outfit.clothes, ...outfit.shoes, ...outfit.headwear];
    if (!refs.length || !refs.every(id => itemMap.get(id) && source.items?.find(item => item.id === id)?.partIds.every(partId => selectedIds.has(partId)))) return [];
    return [{ ...outfit, id: newId('outfit'), clothes: outfit.clothes.map(id => itemMap.get(id)!), shoes: outfit.shoes.map(id => itemMap.get(id)!), headwear: outfit.headwear.map(id => itemMap.get(id)!) }];
  });
  const mergedItems = [...(target.items ?? []), ...pastedItems];
  return { ...result, project: { ...target, layers: { ...target.layers, ...pastedLayers }, fabricAssets,
    rootOrder: [...target.rootOrder, ...result.layerIds.map(id => ({ type: 'layer' as const, id }))],
    drawingGroups: [...(target.drawingGroups ?? []), ...(result.project.drawingGroups ?? []).filter(group => result.groupIds.includes(group.id))],
    items: mergedItems, outfits: target.outfits || pastedOutfits.length ? normalizeOutfits([...(target.outfits ?? []), ...pastedOutfits], mergedItems) : undefined } };
}

/** Whole-item edits move its exported origin and sockets; partial part edits leave them fixed. */
export function transformProjectLayers(project: PapercutProject, selected: readonly string[], transform: Transform): PapercutProject {
  const ids = existingIds(project, selected), wanted = new Set(ids);
  if (!ids.length) return project;
  const layers = { ...project.layers };
  ids.forEach(id => { layers[id] = transformLayer(layers[id], transform); });
  const items = project.items?.map(item => item.partIds.length && item.partIds.every(id => wanted.has(id)) ? {
    ...item, pivot: applyTransform(transform, item.pivot), sockets: item.sockets.map(socket => ({ ...socket, ...applyTransform(transform, socket) })),
  } : item);
  return { ...project, layers, items };
}
