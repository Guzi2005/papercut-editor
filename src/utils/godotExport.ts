/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { zipSync, strToU8, Zippable } from 'fflate';
import { PapercutItem, PapercutProject } from '../types/papercut';
import { projectShadowOptions, renderLayerMarkup, shadowFilterMarkup, strokeReach } from './layerSvg';
import { computeDepthTable, flattenLayerIds, findItemOfLayer,isLayerRendered } from './projectOps';
import { rasterizeSvg } from './svgExporter';
import { serializeProject, PROJECT_FILE_EXT } from './storage';
import { assertTextureBudget, checkGodotExport, normalizeResourceRoot } from './godotPreflight';

export interface GodotExportOptions {
  /** Folder inside the Godot project, e.g. res://art/papercut */
  resRoot: string;
  textureScale: 1 | 2 | 4;
  bakeShadow: boolean;
  bakeGrain: boolean;
  includeLooseLayers: boolean;
  includeHidden: boolean;
}

export interface GodotExportResult {
  zip: Uint8Array;
  folder: string;
  itemCount: number;
  partCount: number;
  warnings: string[];
}

export const DEFAULT_GODOT_OPTIONS: GodotExportOptions = {
  resRoot: 'res://art/papercut',
  textureScale: 2,
  bakeShadow: true,
  bakeGrain: true,
  includeLooseLayers: true,
  includeHidden: false,
};

const LOOSE_ITEM_ID = 'item_scene_misc';

let toPinyin: ((text: string) => string[]) | null = null;

/** Loads the pinyin dictionary on demand so it stays out of the editor's startup bundle. */
export async function loadPinyin(): Promise<void> {
  if (toPinyin) return;
  const { pinyin } = await import('pinyin-pro');
  toPinyin = (text) => pinyin(text, { toneType: 'none', type: 'array', v: true });
}

/** ASCII file-system name; Chinese runs become toneless pinyin words (织游角色 → zhiyoujuese). */
export function asciiSlug(s: string, fallback: string): string {
  const romanized = toPinyin
    ? s.replace(/[\u3400-\u9fff\uf900-\ufaff]+/g, (run) => ` ${toPinyin!(run).join('')} `)
    : s;
  const slug = romanized
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
  return slug || fallback;
}

/** Godot node names cannot contain . : @ / " % and must be non-empty. */
function nodeName(s: string, fallback: string): string {
  const cleaned = s.replace(/[.:@/"%\\]/g, '_').trim();
  return cleaned || fallback;
}

function uniqueName(name: string, used: Set<string>): string {
  let n = name;
  let i = 2;
  while (used.has(n)) n = `${name}_${i++}`;
  used.add(n);
  return n;
}

const q = (s: string) => JSON.stringify(s);
const num = (n: number) => String(Math.round(n * 1000) / 1000);
const vec2 = (x: number, y: number) => `Vector2(${num(x)}, ${num(y)})`;

/** SVG getBBox ignores masks, so fabric pixels must not contribute to the paper's extent. */
export function godotMeasurementMarkup(project: PapercutProject, layerId: string): string {
  return renderLayerMarkup({ ...project.layers[layerId], fabric: undefined }, { idPrefix: 'gm_', grain: false, shadow: 0 });
}

function measureLayers(project: PapercutProject, layerIds: string[]): Record<string, DOMRect | null> {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${project.width} ${project.height}`);
  svg.setAttribute('width', String(project.width));
  svg.setAttribute('height', String(project.height));
  svg.style.cssText = 'position:absolute;left:-100000px;top:0;visibility:hidden;';
  svg.innerHTML = layerIds
    .map((id) => godotMeasurementMarkup(project, id))
    .join('');
  document.body.appendChild(svg);
  const out: Record<string, DOMRect | null> = {};
  layerIds.forEach((id) => {
    const el = svg.querySelector(`g[id="${CSS.escape(id)}"]`) as SVGGElement | null;
    try {
      const b = el?.getBBox();
      out[id] = b && b.width > 0 && b.height > 0 ? b : null;
    } catch {
      out[id] = null;
    }
  });
  svg.remove();
  return out;
}

const BLEND_LABELS: Record<string, string> = { multiply: '正片叠底', screen: '滤色', overlay: '叠加' };

/**
 * A non-normal blend layer composited over the item parts beneath it, then clipped to the layer's
 * own silhouette. The resulting PNG looks right when stacked with plain alpha blending in Godot.
 * The layer's paper shadow is drawn separately underneath since the clip would otherwise remove it.
 */
function blendBakedMarkup(
  project: PapercutProject,
  layerId: string,
  belowIds: string[],
  grain: boolean,
  shadow: number
): string {
  const layer = project.layers[layerId];
  const solid = { ...layer, opacity: 1, blendMode: 'normal' as const };
  const clipId = `bk_${layerId}_clip`;
  const shadowId = `bk_${layerId}_shadowonly`;
  const parts: string[] = [];
  parts.push('<defs>');
  parts.push(
    `<mask id="${clipId}" mask-type="alpha" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="-20000" y="-20000" width="40000" height="40000">` +
      renderLayerMarkup(solid, { idPrefix: 'bkm_', grain: false, shadow: 0, fabricAssets: project.fabricAssets }) +
      `</mask>`
  );
  const shadowOpts = projectShadowOptions(project, shadow);
  if (shadow > 0) {
    parts.push(shadowFilterMarkup(shadowId, shadow, shadowOpts.shadowSoftness, shadowOpts.paperMode, layer.color));
  }
  parts.push('</defs>');
  if (shadow > 0) {
    parts.push(`<g filter="url(#${shadowId})">${renderLayerMarkup(solid, { idPrefix: 'bks_', grain: false, shadow: 0, fabricAssets: project.fabricAssets })}</g>`);
  }
  parts.push(`<g mask="url(#${clipId})"><g style="isolation:isolate">`);
  belowIds.forEach((bid, i) => {
    parts.push(renderLayerMarkup(project.layers[bid], { idPrefix: `bkb${i}_`, grain, ...shadowOpts }));
  });
  parts.push(renderLayerMarkup(layer, { idPrefix: 'gx_', grain, shadow: 0, fabricAssets: project.fabricAssets }));
  parts.push('</g></g>');
  return parts.join('');
}

/** Exact markup passed to PNG rasterization, including shared fabric in plain and blended parts. */
export function godotPartMarkup(project: PapercutProject, layerId: string, belowIds: string[], grain: boolean, shadow: number): string {
  const layer = project.layers[layerId];
  return !!layer.blendMode && layer.blendMode !== 'normal' && belowIds.length > 0
    ? blendBakedMarkup(project, layerId, belowIds, grain, shadow)
    : renderLayerMarkup(layer, { idPrefix: 'gx_', grain, ...projectShadowOptions(project, shadow) });
}

async function canvasToPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encode failed'))), 'image/png')
  );
  return new Uint8Array(await blob.arrayBuffer());
}

export async function buildGodotExport(
  project: PapercutProject,
  options: GodotExportOptions,
  onProgress?: (done: number, total: number) => void
): Promise<GodotExportResult> {
  const preflight = checkGodotExport(project, options);
  if (preflight.errors.length) throw new Error(preflight.errors.join('；'));
  await loadPinyin();
  const warnings: string[] = [...preflight.warnings];
  const slug = asciiSlug(project.name, asciiSlug(project.id, 'papercut'));
  const resRoot = normalizeResourceRoot(options.resRoot);
  const resBase = `${resRoot}${resRoot.endsWith('/') ? '' : '/'}${slug}`;
  const zipBase = resBase.slice('res://'.length);

  const { slots, zOf } = computeDepthTable(project);
  const order = flattenLayerIds(project);
  const isExported = (id: string) => {
    const l = project.layers[id];
    if (!l) return false;
    if (options.includeHidden) return true;
    return isLayerRendered(project,id);
  };

  const exportItems: PapercutItem[] = (project.items || [])
    .map((it) => ({ ...it, partIds: order.filter((id) => it.partIds.includes(id) && isExported(id)) }))
    .filter((it) => it.partIds.length > 0);

  if (options.includeLooseLayers) {
    const loose = order.filter((id) => !findItemOfLayer(project, id) && isExported(id));
    if (loose.length > 0) {
      exportItems.push({ id: LOOSE_ITEM_ID, name: '场景杂项', partIds: loose, pivot: { x: 0, y: 0 }, sockets: [] });
    }
  }
  if (exportItems.length === 0) throw new Error('没有可导出的物件或可见纸片');

  const allParts = exportItems.flatMap((it) => it.partIds);
  const bounds = measureLayers(project, allParts);
  const pad = options.bakeShadow ? 22 : 2;
  const s = options.textureScale;
  const shadow = options.bakeShadow && project.paperMode !== 'vector' ? project.shadowStrength ?? 0.5 : 0;

  const files: Zippable = {};
  const usedItemSlugs = new Set<string>();
  const manifestItems: unknown[] = [];
  const allSceneRefs: { itemName: string; scenePath: string; pivot: { x: number; y: number } }[] = [];
  let done = 0;
  let exportedParts = 0;

  for (const item of exportItems) {
    const english = item.englishName?.trim();
    const itemSlug = uniqueName(asciiSlug(english || item.name, item.id.replace(/[^\w]/g, '_')), usedItemSlugs);
    const usedFiles = new Set<string>();
    const usedNodes = new Set<string>();
    const extRes: string[] = [];
    const nodes: string[] = [];
    const manifestParts: unknown[] = [];
    const rootName = nodeName(english || item.name, itemSlug);

    for (const [idx, pid] of item.partIds.entries()) {
      const layer = project.layers[pid];
      const b = bounds[pid];
      done++;
      onProgress?.(done, allParts.length);
      if (!b) {
        warnings.push(`「${layer.name}」没有可见形状，已跳过`);
        continue;
      }
      const blended = !!layer.blendMode && layer.blendMode !== 'normal';
      const below = item.partIds.slice(0, idx).filter((bid) => bounds[bid]);
      if (blended) {
        warnings.push(
          below.length > 0
            ? `「${layer.name}」的${BLEND_LABELS[layer.blendMode] || layer.blendMode}已与同物件下方 ${below.length} 个部件合成烘焙；在 Godot 里单独移动这些下方部件时，叠色不会跟着变`
            : `「${layer.name}」使用${BLEND_LABELS[layer.blendMode] || layer.blendMode}，但同物件里没有位于它下方的部件，按普通模式烘焙`
        );
      }
      const lpad = pad + strokeReach(layer);
      const x = Math.floor(b.x - lpad);
      const y = Math.floor(b.y - lpad);
      const w = Math.ceil(b.width + lpad * 2);
      const h = Math.ceil(b.height + lpad * 2);
      assertTextureBudget(w, h, s, layer.name);
      const markup = godotPartMarkup(project, pid, below, options.bakeGrain, shadow);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${w * s}" height="${h * s}">${markup}</svg>`;
      const canvas = await rasterizeSvg(svg, w * s, h * s);
      const png = await canvasToPng(canvas);
      canvas.width = 0;
      canvas.height = 0;
      exportedParts++;

      const fileBase = uniqueName(asciiSlug(layer.name, pid.replace(/[^\w]/g, '_')), usedFiles);
      const fileRel = `items/${itemSlug}/${fileBase}.png`;
      files[`${zipBase}/${fileRel}`] = [png, { level: 0 }];

      const resId = `${idx + 1}_${fileBase.slice(0, 12)}`;
      extRes.push(`[ext_resource type="Texture2D" path=${q(`${resBase}/${fileRel}`)} id=${q(resId)}]`);
      const z = zOf[pid] ?? 0;
      const px = x - item.pivot.x;
      const py = y - item.pivot.y;
      nodes.push(
        [
          `[node name=${q(uniqueName(nodeName(layer.name, fileBase), usedNodes))} type="Sprite2D" parent="."]`,
          `z_index = ${z}`,
          'z_as_relative = false',
          `position = ${vec2(px, py)}`,
          s !== 1 ? `scale = ${vec2(1 / s, 1 / s)}` : '',
          `texture = ExtResource(${q(resId)})`,
          `centered = false`,
          `metadata/weave_layer_id = ${q(pid)}`,
        ]
          .filter(Boolean)
          .join('\n')
      );
      manifestParts.push({
        layerId: pid,
        name: layer.name,
        texture: fileRel,
        zIndex: z,
        depthSlot: slots.find((sl) => sl.layerIds.includes(pid))?.name ?? null,
        offset: { x: px, y: py },
        size: { w, h },
        textureScale: s,
        blendMode: layer.blendMode || 'normal',
        blendBakedOver: blended ? below : [],
      });
    }

    item.sockets.forEach((sock) => {
      nodes.push(
        [
          `[node name=${q(uniqueName(nodeName(sock.name, 'socket'), usedNodes))} type="Marker2D" parent="."]`,
          `position = ${vec2(sock.x - item.pivot.x, sock.y - item.pivot.y)}`,
          `metadata/weave_socket_id = ${q(sock.id)}`,
        ].join('\n')
      );
    });

    const scenePath = `items/${itemSlug}.tscn`;
    const tscn = [
      `[gd_scene load_steps=${extRes.length + 1} format=3]`,
      '',
      ...extRes,
      '',
      `[node name=${q(rootName)} type="Node2D"]`,
      `metadata/weave_item_id = ${q(item.id)}`,
      `metadata/weave_source = ${q(`${slug}${PROJECT_FILE_EXT}`)}`,
      '',
      nodes.join('\n\n'),
      '',
    ].join('\n');
    files[`${zipBase}/${scenePath}`] = strToU8(tscn);
    allSceneRefs.push({ itemName: rootName, scenePath, pivot: item.pivot });

    manifestItems.push({
      id: item.id,
      name: item.name,
      short_name: item.shortName || undefined,
      english_name: english || undefined,
      scene: scenePath,
      pivot: item.pivot,
      wardrobeCategory:item.wardrobeCategory,
      sockets: item.sockets.map((so) => ({ name: so.name, x: so.x - item.pivot.x, y: so.y - item.pivot.y })),
      parts: manifestParts,
    });
  }

  // Overview scene that rebuilds the whole canvas from item instances
  const usedTop = new Set<string>();
  const overview = [
    `[gd_scene load_steps=${allSceneRefs.length + 1} format=3]`,
    '',
    ...allSceneRefs.map((r, i) => `[ext_resource type="PackedScene" path=${q(`${resBase}/${r.scenePath}`)} id=${q(`${i + 1}_scene`)}]`),
    '',
    `[node name=${q(nodeName(project.name, slug))} type="Node2D"]`,
    '',
    ...allSceneRefs.map((r, i) =>
      [
        `[node name=${q(uniqueName(r.itemName, usedTop))} parent="." instance=ExtResource(${q(`${i + 1}_scene`)})]`,
        `position = ${vec2(r.pivot.x, r.pivot.y)}`,
        '',
      ].join('\n')
    ),
  ].join('\n');
  files[`${zipBase}/${slug}_overview.tscn`] = strToU8(overview);

  const depthScript = [
    '# Auto-generated by Weave 剪纸工坊. Re-exporting overwrites this file.',
    '# z_index base of each depth slot, in editor stacking order (bottom first).',
    'extends RefCounted',
    '',
    'const DEPTH := {',
    ...slots.map((sl) => `\t${q(sl.name)}: ${sl.zBase},`),
    '}',
    '',
  ].join('\n');
  files[`${zipBase}/${slug}_depth.gd`] = strToU8(depthScript);

  const manifest = {
    format: 'weave-papercut-godot',
    version: 1,
    project: { id: project.id, name: project.name, width: project.width, height: project.height },
    resBase,
    textureScale: s,
    depthSlots: slots.map((sl) => ({ id: sl.id, name: sl.name, zBase: sl.zBase })),
    items: manifestItems,
    colorSchemes:project.colorSchemes??[],
    outfits:(project.outfits??[]).map(o=>({...o,...Object.fromEntries((['clothes','shoes','headwear'] as const).map(category=>[category,o[category].filter(id=>exportItems.some(i=>i.id===id))]))})),
    exportedAt: new Date().toISOString(),
  };
  files[`${zipBase}/manifest.json`] = strToU8(JSON.stringify(manifest, null, 2));
  files[`${zipBase}/${slug}${PROJECT_FILE_EXT}`] = strToU8(serializeProject(project));
  files[`${zipBase}/README.txt`] = strToU8(
    [
      `Weave 剪纸工坊 → Godot 4 导出包：${project.name}`,
      '',
      '使用方法：把压缩包解压到 Godot 项目根目录（与 project.godot 同级），',
      `文件会落在 ${resBase}/ 下，Godot 会自动导入 PNG。`,
      '',
      `- items/*.tscn     每个物件一个场景，根节点原点 = 编辑器里的锚点`,
      `- ${slug}_overview.tscn  按画布原位摆好全部物件，用来核对`,
      `- ${slug}_depth.gd  深度层 → z_index 常量表`,
      `- manifest.json    部件、偏移、z_index、挂点的机器可读描述`,
      '',
      '要给物件加脚本或碰撞体，请对 items/xxx.tscn 使用「新建继承场景」，',
      '在继承场景里修改；以后重新导出覆盖 items/ 时，你的改动不会丢。',
      '',
    ].join('\n')
  );

  return {
    zip: zipSync(files),
    folder: resBase,
    itemCount: exportItems.length,
    partCount: exportedParts,
    warnings,
  };
}
