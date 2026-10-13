/** Portable palettes: source colours remain separate from editable production colours. */
export interface PaletteSwatch {
  id: string;
  name: string;
  role: string;
  hex: string;
  sourceHex: string;
  locked: boolean;
  weight: number;
  sample?: { x: number; y: number };
}
export interface ColorScheme {
  schema: 1;
  id: string;
  name: string;
  source?: string;
  swatches: PaletteSwatch[];
}
export interface ImageRegion { x: number; y: number; width: number; height: number }
export interface ExtractedColor { hex: string; weight: number; x: number; y: number }
export const PALETTE_ROLES = [
  { id: 'base', name: '底布' }, { id: 'main', name: '主体' }, { id: 'secondary', name: '辅色' },
  { id: 'thread', name: '绣线' }, { id: 'edge', name: '滚边' }, { id: 'accent', name: '强调' },
  { id: 'other', name: '其他' },
] as const;
export const PALETTE_STORAGE_KEY = 'papercut.colorSchemes.v1';
export const PALETTE_DRAFT_PREFIX = 'papercut.paletteDrafts.v1:';
export interface PaletteDraftState { version: 1; activeId: string; drafts: ColorScheme[] }
export function normalizeColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^#?([a-f\d]{3}|[a-f\d]{6})$/i.exec(value.trim());
  if (!match) return null;
  const hex = match[1].length === 3 ? [...match[1]].map(c => c + c).join('') : match[1];
  return `#${hex.toUpperCase()}`;
}
const rgb = (hex: string): number[] => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const hex = (values: number[]): string => '#' + values.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();
function lab(values: number[]): number[] {
  const [r, g, b] = values.map(v => { const c = v / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; });
  const f = (v: number) => v > .008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116;
  const x = f((r * .4124564 + g * .3575761 + b * .1804375) / .95047), y = f(r * .2126729 + g * .7151522 + b * .072175), z = f((r * .0193339 + g * .119192 + b * .9503041) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const distance = (a: number[], b: number[]): number => a.reduce((sum, v, i) => sum + (v - b[i]) ** 2, 0);
export const colorLightness = (color: string): number => lab(rgb(normalizeColor(color) ?? '#000000'))[0];
export function colorDistance(a: string, b: string): number { return Math.sqrt(distance(lab(rgb(a)), lab(rgb(b)))); }

/** Weighted, deterministic Lab clustering. Pixel sampling is bounded and transparent pixels are excluded. */
export function quantizePalette(
  pixels: ArrayLike<number>, width: number, height: number, count = 8,
  region: ImageRegion = { x: 0, y: 0, width, height },
  options: { excludedColors?: string[]; exclusionDistance?: number; mergeDistance?: number } = {},
): ExtractedColor[] {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 || width * height > 64_000_000 || pixels.length < width * height * 4) throw new Error('图片像素数据无效');
  if (![region.x, region.y, region.width, region.height].every(Number.isFinite)) throw new Error('取色区域无效');
  const x0 = Math.min(width, Math.max(0, Math.floor(region.x))), y0 = Math.min(height, Math.max(0, Math.floor(region.y)));
  const x1 = Math.min(width, Math.max(x0, Math.ceil(region.x + region.width))), y1 = Math.min(height, Math.max(y0, Math.ceil(region.y + region.height)));
  if (x0 === x1 || y0 === y1) return [];
  const amount = Math.max(1, Math.min(32, Math.round(Number.isFinite(count) ? count : 8)));
  const step = Math.max(1, Math.ceil(Math.sqrt((x1 - x0) * (y1 - y0) / 65_536)));
  const ignored = (options.excludedColors ?? []).map(normalizeColor).filter((v): v is string => !!v).map(c => lab(rgb(c)));
  interface Bin { values: number[]; lab: number[]; weight: number; x: number; y: number }
  const bins = new Map<number, Bin>();
  for (let y = y0; y < y1; y += step) for (let x = x0; x < x1; x += step) {
    const i = (y * width + x) * 4, alpha = pixels[i + 3] / 255;
    if (alpha < .125) continue;
    const values = [pixels[i], pixels[i + 1], pixels[i + 2]];
    const key = ((values[0] >> 3) << 10) | ((values[1] >> 3) << 5) | (values[2] >> 3);
    const bin = bins.get(key);
    if (bin) { for (let j = 0; j < 3; j++) bin.values[j] += values[j] * alpha; bin.weight += alpha; }
    else bins.set(key, { values: values.map(v => v * alpha), lab: [], weight: alpha, x, y });
  }
  const list = [...bins.values()].map(b => ({ ...b, values: b.values.map(v => v / b.weight), lab: lab(b.values.map(v => v / b.weight)) }))
    .filter(b => !ignored.some(c => distance(c, b.lab) < (options.exclusionDistance ?? 14) ** 2))
    .sort((a, b) => b.weight - a.weight || hex(a.values).localeCompare(hex(b.values)));
  if (!list.length) return [];
  const centers: number[][] = [list[0].lab.slice()];
  while (centers.length < Math.min(amount, list.length)) {
    let best = -1, chosen = list[0];
    for (const bin of list) { const score = Math.min(...centers.map(c => distance(bin.lab, c))) * Math.sqrt(bin.weight); if (score > best) { best = score; chosen = bin; } }
    if (best < .01) break;
    centers.push(chosen.lab.slice());
  }
  const assignments = new Int32Array(list.length);
  for (let iteration = 0; iteration < 16; iteration++) {
    const sums = centers.map(() => [0, 0, 0]), weights = centers.map(() => 0);
    for (let i = 0; i < list.length; i++) {
      let best = 0, d = Infinity;
      centers.forEach((center, j) => { const next = distance(list[i].lab, center); if (next < d) { d = next; best = j; } });
      assignments[i] = best; weights[best] += list[i].weight;
      list[i].lab.forEach((v, c) => { sums[best][c] += v * list[i].weight; });
    }
    centers.forEach((center, j) => { if (weights[j]) sums[j].forEach((v, c) => { center[c] = v / weights[j]; }); });
  }
  const groups = centers.map(() => ({ values: [0, 0, 0], weight: 0, representative: list[0], d: Infinity }));
  list.forEach((bin, i) => {
    const group = groups[assignments[i]], d = distance(bin.lab, centers[assignments[i]]);
    group.weight += bin.weight; bin.values.forEach((v, c) => { group.values[c] += v * bin.weight; });
    if (d < group.d) { group.representative = bin; group.d = d; }
  });
  const results = groups.filter(g => g.weight).map(g => ({ hex: hex(g.values.map(v => v / g.weight)), weight: g.weight, x: g.representative.x, y: g.representative.y })).sort((a, b) => b.weight - a.weight);
  const merged: ExtractedColor[] = [];
  for (const result of results) {
    const same = merged.find(c => colorDistance(c.hex, result.hex) < Math.max(0, options.mergeDistance ?? 5));
    if (same) { const w = same.weight + result.weight; same.hex = hex(rgb(same.hex).map((v, i) => (v * same.weight + rgb(result.hex)[i] * result.weight) / w)); same.weight = w; }
    else merged.push({ ...result });
  }
  const total = merged.reduce((sum, c) => sum + c.weight, 0);
  return merged.sort((a, b) => b.weight - a.weight).map(c => ({ ...c, weight: c.weight / total }));
}

export function createColorScheme(colors: (string | ExtractedColor)[], name = '新色彩方案', source?: string): ColorScheme {
  const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return { schema: 1, id: `scheme-${stamp}`, name, source, swatches: colors.slice(0, 64).map((color, i) => {
    const extracted = typeof color === 'string' ? undefined : color, value = normalizeColor(typeof color === 'string' ? color : color.hex) ?? '#000000';
    return { id: `${stamp}-${i}`, name: `颜色 ${i + 1}`, role: PALETTE_ROLES[Math.min(i, PALETTE_ROLES.length - 1)].id, hex: value, sourceHex: value, locked: false, weight: extracted?.weight ?? 0, ...(extracted ? { sample: { x: extracted.x, y: extracted.y } } : {}) };
  }) };
}
export function validateColorSchemes(input: unknown): ColorScheme[] {
  const data = Array.isArray(input) ? input : input && typeof input === 'object' && 'schemes' in input ? (input as { schemes: unknown }).schemes : [input];
  if (!Array.isArray(data) || data.length > 100) throw new Error('色彩方案最多 100 组');
  const seen = new Set<string>();
  return data.map((raw, index) => {
    if (!raw || typeof raw !== 'object') throw new Error('色彩方案格式无效');
    const value = raw as Record<string, unknown>;
    if (!Array.isArray(value.swatches) || value.swatches.length < 1 || value.swatches.length > 64) throw new Error('每组方案需要 1–64 个颜色');
    const str = (v: unknown, max: number, fallback: string) => typeof v === 'string' ? v.trim().slice(0, max) || fallback : fallback;
    let id = str(value.id, 120, `import-${index}`); if (seen.has(id)) id += `-${index}`; seen.add(id);
    const ids = new Set<string>();
    return { schema: 1, id, name: str(value.name, 120, '导入的色彩方案'), source: str(value.source, 400, '') || undefined, swatches: value.swatches.map((rawSwatch, i) => {
      if (!rawSwatch || typeof rawSwatch !== 'object') throw new Error('色块格式无效');
      const s = rawSwatch as Record<string, unknown>, color = normalizeColor(s.hex), source = normalizeColor(s.sourceHex ?? s.hex);
      if (!color || !source) throw new Error('色块需要有效的十六进制颜色');
      let swatchId = str(s.id, 120, `${id}-${i}`); if (ids.has(swatchId)) swatchId += `-${i}`; ids.add(swatchId);
      const point = s.sample as { x?: unknown; y?: unknown } | undefined;
      return { id: swatchId, name: str(s.name, 80, `颜色 ${i + 1}`), role: str(s.role, 60, 'other'), hex: color, sourceHex: source, locked: s.locked === true, weight: typeof s.weight === 'number' && Number.isFinite(s.weight) ? Math.max(0, Math.min(1, s.weight)) : 0,
        ...(point && typeof point.x === 'number' && typeof point.y === 'number' && Number.isFinite(point.x) && Number.isFinite(point.y) ? { sample: { x: Math.max(0, Math.min(65535, point.x)), y: Math.max(0, Math.min(65535, point.y)) } } : {}) };
    }) };
  });
}
export function parsePaletteFile(text: string, fileName = ''): ColorScheme[] {
  if (text.length > 1_000_000) throw new Error('色卡文件不能超过 1 MB');
  if (!text.trim().startsWith('GIMP Palette')) return validateColorSchemes(JSON.parse(text));
  let name = fileName.replace(/\.gpl$/i, '') || '导入色卡';
  const colors: { hex: string; name: string }[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('Name:')) name = line.slice(5).trim();
    const match = /^\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})(?:\s+(.*))?$/.exec(line);
    if (match) { const values = match.slice(1, 4).map(Number); if (values.some(v => v > 255)) throw new Error('GPL 颜色通道超出范围'); colors.push({ hex: hex(values), name: match[4]?.trim() ?? '' }); }
  }
  if (!colors.length || colors.length > 64) throw new Error('GPL 色卡需要 1–64 个颜色');
  const scheme = createColorScheme(colors.map(c => c.hex), name.slice(0, 120));
  scheme.swatches.forEach((s, i) => { if (colors[i].name) s.name = colors[i].name.slice(0, 80); });
  return [scheme];
}
/** A small recovery journal; editable drafts are never applied to the document automatically. */
export function paletteDraftSnapshot(active: ColorScheme, recent: ColorScheme[]): PaletteDraftState {
  const drafts = [...recent.filter(s => s.id !== active.id), active].slice(-12);
  return { version: 1, activeId: active.id, drafts };
}
export function parsePaletteDrafts(text: string): PaletteDraftState {
  if (text.length > 1_000_000) throw new Error('色卡草稿过大');
  const value = JSON.parse(text) as Record<string, unknown>;
  if (!value || value.version !== 1 || !Array.isArray(value.drafts) || value.drafts.length > 12) throw new Error('色卡草稿格式无效');
  const drafts = validateColorSchemes(value.drafts);
  const activeId = typeof value.activeId === 'string' && drafts.some(s => s.id === value.activeId) ? value.activeId : drafts.at(-1)?.id ?? '';
  return { version: 1, activeId, drafts };
}
export function exportGpl(scheme: ColorScheme): string {
  return `GIMP Palette\nName: ${scheme.name.replace(/[\r\n]/g, ' ')}\nColumns: 8\n#\n${scheme.swatches.map(s => `${rgb(s.hex).map(v => v.toString().padStart(3)).join(' ')}\t${s.name.replace(/[\r\n]/g, ' ')}`).join('\n')}\n`;
}
/** Only explicit source → production replacements; locks protect colours during automatic extraction, not deliberate edits. */
export function schemeColorMapping(scheme: ColorScheme): Record<string, string> {
  return Object.fromEntries(scheme.swatches.filter(s => s.sourceHex !== s.hex).map(s => [s.sourceHex, s.hex]));
}
export function nearestPaletteMapping(colors: string[], scheme: ColorScheme): Record<string, string> {
  if (!scheme.swatches.length) return {};
  const result: Record<string, string> = {};
  for (const value of colors) {
    const color = normalizeColor(value); if (!color) continue;
    const target = scheme.swatches.reduce((best, s) => colorDistance(color, s.hex) < colorDistance(color, best.hex) ? s : best);
    result[color] = target.hex;
  }
  return result;
}
export function mapSchemeRoles(source: ColorScheme, target: ColorScheme): Record<string, string> {
  const result: Record<string, string> = {};
  const roleIndex = new Map<string, number>();
  for (const s of source.swatches) {
    const index = roleIndex.get(s.role) ?? 0, candidates = target.swatches.filter(t => t.role === s.role);
    // Multiple embroidery/accent colours keep their relative place in a variant.
    const named = candidates.filter(t => t.name === s.name);
    const replacement = named.length === 1 ? named[0] : candidates[index];
    if (replacement) result[s.hex] = replacement.hex;
    roleIndex.set(s.role, index + 1);
  }
  return result;
}
/** Preserve locked production colours when updating an extraction. */
export function replaceExtractedColors(current: ColorScheme, colors: ExtractedColor[]): ColorScheme {
  const locked = current.swatches.filter(s => s.locked).map(s => {
    const matched = colors.find(c => colorDistance(s.sourceHex, c.hex) < 5);
    // A locked ink survives a new crop, but its old area percentage/sample does not.
    return { ...s, weight: matched?.weight ?? 0, sample: matched ? { x: matched.x, y: matched.y } : undefined };
  });
  const fresh = createColorScheme(colors.filter(c => !locked.some(s => colorDistance(s.sourceHex, c.hex) < 5)), current.name, current.source);
  return { ...current, swatches: [...locked, ...fresh.swatches].slice(0, 64) };
}
