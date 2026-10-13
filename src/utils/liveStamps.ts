import type { CutoutPath, Layer, LayerDrawStroke, Point } from '../types/papercut';
import { applyToPoint, isWarp, multiply, transformPathD, type Matrix, type Transform } from './pathTransform';
import { normalizeStampSettings, stampStrokePaths, validateStampLibrary, type StampDefinition, type StampSettings } from './stamps';
import {normalizeHex} from './color';

/** An immutable motif version and local brush recipe, plus placement and editable native cache. */
export interface LiveStampStroke {
  id: string;
  definition: StampDefinition;
  settings: StampSettings;
  points: Point[];
  seed: number;
  pathIds: string[];
  /** Object placement is separate from recipe size, preserving exact affine edits on regeneration. */
  transform?: Matrix;
  /** Detect native geometry edited after generation, without duplicating its path strings. */
  cacheHashes?: Record<string, string>;
  colorMap?:Record<string,string>;
}

export type LiveStampLayer = Layer & { liveStamps?: LiveStampStroke[] };
export interface LiveStampPatch {
  definition?: StampDefinition;
  settings?: Partial<StampSettings>;
  points?: Point[];
  seed?: number;
}

const copyDefinition = (definition: StampDefinition): StampDefinition => ({
  ...definition,
  parts: definition.parts.map(part => ({ ...part })),
  settings: definition.settings ? normalizeStampSettings(definition.settings) : undefined,
});
const clonePoints = (points: Point[]): Point[] => points.map(({ x, y, pressure }) => ({ x, y, ...(pressure === undefined ? {} : { pressure }) }));
const validPoints = (points: unknown): points is Point[] => Array.isArray(points) && points.length > 0 && points.length <= 4096 &&
  points.every(p => p && typeof p.x === 'number' && typeof p.y === 'number' && Number.isFinite(p.x) && Number.isFinite(p.y) && Math.abs(p.x) <= 1e7 && Math.abs(p.y) <= 1e7);
const validId = (id: unknown): id is string => typeof id === 'string' && /^[a-z0-9_-]{1,160}$/i.test(id);
const seedOf = (seed: number) => Number.isFinite(seed) ? Math.floor(seed) >>> 0 : 0;

function hash(text: string): string {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619);
  return `${text.length}:${(value >>> 0).toString(36)}`;
}
function fingerprint(path: CutoutPath | LayerDrawStroke): string {
  return 'isHole' in path
    ? hash(`${path.d}\0${path.fillColor || ''}\0${path.isHole}`)
    : hash(`${path.d}\0${path.color}\0${path.fill}\0${path.opacity}\0${path.strokeWidth}`);
}
const nativePaths = (layer: LiveStampLayer): (CutoutPath | LayerDrawStroke)[] => layer.kind === 'doodle'
  ? layer.drawings ?? [] : [...layer.positiveElements, ...layer.cutouts];
const asDrawing = (path: CutoutPath): LayerDrawStroke => ({
  id: path.id, d: path.d, color: path.fillColor || '#000000', opacity: 1, strokeWidth: 1, brushType: 'pen', fill: true,
});
const hashesOf = (paths: (CutoutPath | LayerDrawStroke)[]) => Object.fromEntries(paths.map(path => [path.id, fingerprint(path)]));

function generate(stroke: LiveStampStroke): CutoutPath[] {
  const paths = stampStrokePaths(stroke.definition, stroke.settings, stroke.points, stroke.seed, stroke.id).map(path=>({...path,fillColor:stroke.colorMap?.[normalizeHex(path.fillColor??'')??'']??path.fillColor}));
  return stroke.transform ? paths.map(path => ({ ...path, d: transformPathD(path.d, stroke.transform!) })) : paths;
}

export function createLiveStampStroke(definition: StampDefinition, settings: StampSettings, points: Point[], seed: number, id: string): { stroke: LiveStampStroke; paths: CutoutPath[] } {
  if (!validId(id) || !validPoints(points)) throw new Error('纹样笔画路径无效');
  const stroke: LiveStampStroke = {
    id, definition: copyDefinition(definition), settings: normalizeStampSettings(settings),
    points: clonePoints(points), seed: seedOf(seed), pathIds: [],
  };
  const generated = generate(stroke), time = Date.now();
  // All native pieces belong to one operation, before a subsequent cut or appliqué.
  const paths = generated.map((path, index) => ({ ...path, createdAt: time + index / (generated.length + 1) }));
  stroke.pathIds = paths.map(path => path.id);
  stroke.cacheHashes = hashesOf(paths);
  return { stroke, paths };
}

/** Registers a stroke after insertion, capturing either paper cache or doodle cache fingerprints. */
export function attachLiveStampStroke(layer: LiveStampLayer, stroke: LiveStampStroke): LiveStampLayer {
  const ids = new Set(stroke.pathIds), paths = nativePaths(layer).filter(path => ids.has(path.id));
  if (paths.length !== ids.size) return layer;
  const registered = { ...stroke, cacheHashes: hashesOf(paths) };
  return { ...layer, liveStamps: [...(layer.liveStamps ?? []).filter(s => s.id !== stroke.id), registered] };
}

function ownsIntactCache(layer: LiveStampLayer, stroke: LiveStampStroke): boolean {
  const byId = new Map(nativePaths(layer).map(path => [path.id, path]));
  return stroke.pathIds.length > 0 && stroke.pathIds.every(id => {
    const path = byId.get(id);
    return path && (!stroke.cacheHashes?.[id] || stroke.cacheHashes[id] === fingerprint(path));
  });
}

/** Manual colour/node edits and deletions turn just the affected stroke into ordinary graphics. */
export function detachChangedLiveStamps(layer: LiveStampLayer): LiveStampLayer {
  if (!layer.liveStamps?.length) return layer;
  const liveStamps = layer.liveStamps.filter(stroke => ownsIntactCache(layer, stroke));
  return liveStamps.length === layer.liveStamps.length ? layer : { ...layer, liveStamps };
}

export function expandLiveStampStroke(layer: LiveStampLayer, strokeId: string): LiveStampLayer {
  if (!layer.liveStamps?.some(stroke => stroke.id === strokeId)) return layer;
  return { ...layer, liveStamps: layer.liveStamps.filter(stroke => stroke.id !== strokeId) };
}

/** Palette swaps are a separate appearance mapping, leaving the motif and editable recipe intact. */
export function recolorLiveStampLayer(original:LiveStampLayer,recolored:LiveStampLayer,mapping:Record<string,string>):LiveStampLayer {
  let result={...recolored,liveStamps:[] as LiveStampStroke[]};
  for(const stroke of detachChangedLiveStamps(original).liveStamps??[]){
    const inks=new Set(stampStrokePaths(stroke.definition,stroke.settings,stroke.points,stroke.seed,stroke.id).map(p=>normalizeHex(p.fillColor??'')).filter((c):c is string=>!!c));
    const colorMap={...stroke.colorMap};
    for(const ink of inks){const current=colorMap[ink]??ink,target=normalizeHex(mapping[current]??mapping[current.toLowerCase()]??current);if(target)colorMap[ink]=target;}
    result=attachLiveStampStroke(result,{...stroke,colorMap}) as typeof result;
  }
  return original.liveStamps?result:recolored;
}

/** A changed repeat count still occupies the original chronological slot, before later cuts. */
function preserveChronology(layer: LiveStampLayer, previous: CutoutPath[], paths: CutoutPath[], ids: Set<string>): CutoutPath[] {
  if (!previous.length || !paths.length) return paths;
  const start = Math.min(...previous.map(path => path.createdAt ?? 0));
  const end = Math.max(...previous.map(path => path.createdAt ?? 0));
  const later = [...layer.positiveElements, ...layer.cutouts]
    .filter(path => !ids.has(path.id) && (path.createdAt ?? 0) > end)
    .map(path => path.createdAt ?? 0);
  const next = later.length ? Math.min(...later) : Math.max(end + .001, Math.floor(start) + 1);
  const step = Math.max(0, next - start) / (paths.length + 1);
  return paths.map((path, index) => ({ ...path, createdAt: start + index * step }));
}

function replaceAtFirst<T extends { id: string }>(original: T[], ids: Set<string>, replacement: T[]): T[] {
  const result: T[] = []; let inserted = false;
  for (const path of original) {
    if (ids.has(path.id)) {
      if (!inserted) { result.push(...replacement); inserted = true; }
    } else result.push(path);
  }
  return result;
}

/** Rebuild only this stroke; its motif snapshot never follows edits to the shared material library. */
export function regenerateLiveStampLayer(layer: LiveStampLayer, strokeId: string, patch: LiveStampPatch): LiveStampLayer {
  const original = layer.liveStamps?.find(stroke => stroke.id === strokeId);
  if (!original) return layer;
  if (!ownsIntactCache(layer, original)) return expandLiveStampStroke(layer, strokeId);
  const points = patch.points ?? original.points;
  if (!validPoints(points)) throw new Error('纹样笔画路径无效');
  const stroke: LiveStampStroke = {
    ...original, definition: copyDefinition(patch.definition ?? original.definition),
    settings: normalizeStampSettings({ ...original.settings, ...patch.settings }),
    points: clonePoints(points), seed: seedOf(patch.seed ?? original.seed),
  };
  const ids = new Set(original.pathIds);
  let paths = generate(stroke);
  const drawings = paths.map(asDrawing);
  if (layer.kind !== 'doodle') {
    const previous = [...layer.positiveElements, ...layer.cutouts].filter(path => ids.has(path.id));
    paths = preserveChronology(layer, previous, paths, ids);
  }
  stroke.pathIds = paths.map(path => path.id);
  stroke.cacheHashes = hashesOf(layer.kind === 'doodle' ? drawings : paths);
  const list = layer.liveStamps!.map(value => value.id === strokeId ? stroke : value);
  if (layer.kind === 'doodle') return { ...layer, drawings: replaceAtFirst(layer.drawings ?? [], ids, drawings), liveStamps: list };
  // A stroke is normally in positiveElements; support older callers that stored all motifs in cutouts.
  const inPositive = layer.positiveElements.some(path => ids.has(path.id));
  return {
    ...layer,
    positiveElements: inPositive ? replaceAtFirst(layer.positiveElements, ids, paths) : layer.positiveElements.filter(path => !ids.has(path.id)),
    cutouts: inPositive ? layer.cutouts.filter(path => !ids.has(path.id)) : replaceAtFirst(layer.cutouts, ids, paths),
    liveStamps: list,
  };
}

export function liveStampWorldPoints(stroke: LiveStampStroke): Point[] {
  return stroke.transform ? stroke.points.map(point => applyToPoint(stroke.transform!, point)) : clonePoints(stroke.points);
}

/** Called with the original layer, alongside its native path transformation. Warps expand recipes. */
export function transformLiveStrokes(layer: LiveStampLayer, transform: Transform): LiveStampStroke[] | undefined {
  if (!layer.liveStamps) return undefined;
  if (isWarp(transform)) return [];
  const intact = detachChangedLiveStamps(layer).liveStamps ?? [];
  const paths = nativePaths(layer);
  return intact.map(stroke => {
    const ids = new Set(stroke.pathIds);
    const moved = paths.filter(path => ids.has(path.id)).map(path => ({ ...path, d: transformPathD(path.d, transform) }));
    return { ...stroke, transform: stroke.transform ? multiply(transform, stroke.transform) : [...transform] as Matrix, cacheHashes: hashesOf(moved) };
  });
}

/** Optional metadata may be discarded without losing the native artwork already stored in the layer. */
export function normalizeLiveStamps(value: unknown): LiveStampStroke[] {
  if (!Array.isArray(value)) return [];
  const result: LiveStampStroke[] = [], usedIds = new Set<string>();
  for (const input of value.slice(0, 500)) {
    try {
      if (!input || !validId(input.id) || usedIds.has(input.id) || !validPoints(input.points) ||
          !Array.isArray(input.pathIds) || !input.pathIds.length || input.pathIds.length > 65000 || !input.pathIds.every(validId)) continue;
      const [definition] = validateStampLibrary([input.definition]);
      let transform: Matrix | undefined;
      if (input.transform !== undefined) {
        if (!Array.isArray(input.transform) || input.transform.length !== 6 || !input.transform.every((n: unknown) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1e7)) continue;
        transform = [...input.transform] as Matrix;
        if (Math.abs(transform[0] * transform[3] - transform[1] * transform[2]) < 1e-10) continue;
      }
      const cacheHashes = input.cacheHashes && typeof input.cacheHashes === 'object'
        ? Object.fromEntries(Object.entries(input.cacheHashes).filter(([id, hash]) => input.pathIds.includes(id) && typeof hash === 'string' && /^[0-9]+:[a-z0-9]+$/.test(hash))) as Record<string, string> : undefined;
      const colorMap=input.colorMap&&typeof input.colorMap==='object'?Object.fromEntries(Object.entries(input.colorMap).flatMap(([from,to])=>{const f=normalizeHex(from),t=typeof to==='string'?normalizeHex(to):null;return f&&t?[[f,t]]:[];})):undefined;
      result.push({ id: input.id, definition, settings: normalizeStampSettings(input.settings ?? {}), points: clonePoints(input.points), seed: seedOf(input.seed), pathIds: [...input.pathIds], transform, cacheHashes,colorMap });
      usedIds.add(input.id);
    } catch { /* A malformed recipe never prevents its cached native shapes from opening. */ }
  }
  return result;
}
