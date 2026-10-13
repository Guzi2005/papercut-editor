import type { Layer, OutfitDefinition, PapercutItem, PapercutProject } from '../types/papercut';
import { createBlankCanvas } from './presetTemplates';
import { transformPathD } from './pathTransform';
import { isLayerRendered, newId } from './projectOps';

export type { OutfitDefinition } from '../types/papercut';
export type WardrobeCategory = 'clothes' | 'shoes' | 'headwear';
export const WARDROBE_CATEGORIES: { id: WardrobeCategory; name: string }[] = [
  { id: 'clothes', name: '衣服' }, { id: 'shoes', name: '鞋子' }, { id: 'headwear', name: '头饰' },
];
export const WARDROBE_BODY_ID = 'wardrobe_body';
export const WARDROBE_CLOTHES_LAYER_ID = 'wardrobe_clothes';

export function isWardrobeCategory(value: unknown): value is WardrobeCategory {
  return value === 'clothes' || value === 'shoes' || value === 'headwear';
}

const BODY = 'M 256 62 A 56 56 0 1 1 255.99 62 Z '
  + 'M 230 175 L 282 175 L 294 197 C 336 204 350 230 365 275 L 407 408 Q 411 422 399 428 L 389 432 Q 377 436 373 422 L 331 299 L 323 410 L 337 541 L 348 678 Q 351 694 336 696 H 289 Q 277 696 276 684 L 258 528 H 254 L 236 684 Q 235 696 223 696 H 176 Q 161 694 164 678 L 175 541 L 189 410 L 181 299 L 139 422 Q 135 436 123 432 L 113 428 Q 101 422 105 408 L 147 275 C 162 230 176 204 218 197 Z';

/** A normal canvas with a locked neutral silhouette and three empty, editable clothing parts. */
export function createWardrobeTemplate(width = 512, height = 768): PapercutProject {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 64 || height < 64 || width > 4096 || height > 4096) {
    throw new Error('模板尺寸须为 64–4096 之间的整数。');
  }
  const scale = Math.min(width / 512, height / 768);
  const offsetX = (width - 512 * scale) / 2, offsetY = (height - 768 * scale) / 2;
  const paper = (id: string, name: string, color: string, d = ''): Layer => ({
    id, name, color, texture: 'smooth', opacity: 1, blendMode: 'normal', visible: true, locked: false,
    grain: 0, baseShape: { type: 'freeform', d }, cutouts: [], positiveElements: [], drawings: [], unclippedDrawings: true,
  });
  const body = { ...paper(WARDROBE_BODY_ID, '模板素体', '#D8D3CA', transformPathD(BODY, [scale, 0, 0, scale, offsetX, offsetY])), locked: true };
  const parts = [
    paper('wardrobe_shoes', '鞋子 · 原稿', '#1B2352'),
    paper(WARDROBE_CLOTHES_LAYER_ID, '衣服 · 原稿', '#F6EEE2'),
    paper('wardrobe_headwear', '头饰 · 原稿', '#BD5A63'),
  ];
  const layers = [body, ...parts];
  const categories: WardrobeCategory[] = ['shoes', 'clothes', 'headwear'];
  const pivots = [{ x: 256, y: 678 }, { x: 256, y: 350 }, { x: 256, y: 62 }];
  return {
    ...createBlankCanvas({ width, height, mode: 'create', name: '套装模板', canvasBg: { kind: 'transparent', display: 'light' } }),
    id: newId('wardrobe'), groups: [],
    layers: Object.fromEntries(layers.map(layer => [layer.id, layer])),
    rootOrder: layers.map(layer => ({ type: 'layer', id: layer.id })),
    items: parts.map((part, index) => ({
      id: `item_${categories[index]}`, name: WARDROBE_CATEGORIES.find(category => category.id === categories[index])!.name,
      wardrobeCategory: categories[index], partIds: [part.id],
      pivot: { x: pivots[index].x * scale + offsetX, y: pivots[index].y * scale + offsetY }, sockets: [],
    })),
    outfits: [], paperMode: 'vector', shadowStrength: 0,
  };
}

export function wardrobeItemVisible(project: PapercutProject, item: PapercutItem): boolean {
  return item.partIds.some(id => isLayerRendered(project, id) && project.layers[id].opacity > 0);
}

/** Outfit references stay at the item level, so changing a part's artwork does not break its category. */
export function captureOutfit(project: PapercutProject, name: string): OutfitDefinition {
  const outfit: OutfitDefinition = { id: newId('outfit'), name: name.trim().slice(0, 80) || '新套装', clothes: [], shoes: [], headwear: [] };
  for (const item of project.items ?? []) {
    if (isWardrobeCategory(item.wardrobeCategory) && wardrobeItemVisible(project, item)) outfit[item.wardrobeCategory].push(item.id);
  }
  return outfit;
}

/** Drop missing or miscategorised item references when importing an older or edited project. */
export function normalizeOutfits(value: unknown, items: readonly PapercutItem[]): OutfitDefinition[] {
  if (!Array.isArray(value)) return [];
  const categories = new Map(items.filter(item => isWardrobeCategory(item.wardrobeCategory)).map(item => [item.id, item.wardrobeCategory]));
  const seen = new Set<string>();
  const result: OutfitDefinition[] = [];
  for (const [index, candidate] of value.slice(0, 100).entries()) {
    if (!candidate || typeof candidate !== 'object') continue;
    const entry = candidate as Partial<OutfitDefinition>;
    const id = typeof entry.id === 'string' && entry.id ? entry.id.slice(0, 160) : `outfit_${index}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const outfit: OutfitDefinition = { id, name: typeof entry.name === 'string' ? entry.name.trim().slice(0, 80) || '新套装' : '新套装', clothes: [], shoes: [], headwear: [] };
    for (const category of WARDROBE_CATEGORIES) {
      const selected = entry[category.id];
      if (Array.isArray(selected)) outfit[category.id] = [...new Set(selected.slice(0, 1000).filter(itemId => typeof itemId === 'string' && categories.get(itemId) === category.id))];
    }
    result.push(outfit);
  }
  return result;
}

function protectedLayerIds(project: PapercutProject): Set<string> {
  const ordinary = (project.items ?? []).filter(item => !isWardrobeCategory(item.wardrobeCategory)).flatMap(item => item.partIds);
  if (project.layers[WARDROBE_BODY_ID]?.locked) ordinary.push(WARDROBE_BODY_ID);
  return new Set(ordinary);
}

/** One project update switches the complete outfit; ordinary scene objects and the template stay intact. */
export function applyOutfit(project: PapercutProject, outfit: OutfitDefinition): PapercutProject {
  const protectedIds = protectedLayerIds(project);
  const desired = new Map<string, boolean>();
  for (const item of project.items ?? []) {
    if (!isWardrobeCategory(item.wardrobeCategory)) continue;
    const visible = outfit[item.wardrobeCategory]?.includes(item.id) ?? false;
    for (const id of item.partIds) {
      if (project.layers[id] && !protectedIds.has(id)) desired.set(id, (desired.get(id) ?? false) || visible);
    }
  }
  const layers = { ...project.layers };
  let changed = false;
  for (const [id, visible] of desired) {
    if (layers[id].visible !== visible) { layers[id] = { ...layers[id], visible }; changed = true; }
  }
  return changed ? { ...project, layers } : project;
}

export function setWardrobeItemVisible(project: PapercutProject, itemId: string, visible: boolean): PapercutProject {
  const item = project.items?.find(candidate => candidate.id === itemId);
  if (!item || !isWardrobeCategory(item.wardrobeCategory)) return project;
  const protectedIds = protectedLayerIds(project);
  if (item.partIds.some(id => protectedIds.has(id))) throw new Error('该服装包含素体或普通物件的图层，请先将部件分开归类。');
  if (!visible && (project.items ?? []).some(other => other.id !== item.id && wardrobeItemVisible(project, other) && other.partIds.some(id => item.partIds.includes(id)))) {
    throw new Error('该服装与其他可见物件共用图层，无法单独隐藏。');
  }
  const layers = { ...project.layers };
  let changed = false;
  for (const id of item.partIds) {
    if (layers[id] && layers[id].visible !== visible) { layers[id] = { ...layers[id], visible }; changed = true; }
  }
  return changed ? { ...project, layers } : project;
}

export function assignWardrobeCategory(project: PapercutProject, itemId: string, category: WardrobeCategory | undefined): PapercutProject {
  const item = project.items?.find(candidate => candidate.id === itemId);
  if (!item) return project;
  if (category && item.partIds.includes(WARDROBE_BODY_ID) && project.layers[WARDROBE_BODY_ID]?.locked) throw new Error('模板素体保持独立，请只归类衣服、鞋子或头饰部件。');
  if (category && (project.items ?? []).some(other => other.id !== item.id && other.partIds.some(id => item.partIds.includes(id)))) throw new Error('这个物件与其他物件共用图层，请先分开部件再归类。');
  if (item.wardrobeCategory === category) return project;
  const items = project.items!.map(candidate => candidate.id === itemId ? { ...candidate, wardrobeCategory: category } : candidate);
  return { ...project, items, outfits: normalizeOutfits(project.outfits, items) };
}
