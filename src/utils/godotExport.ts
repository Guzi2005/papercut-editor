/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { zipSync, strToU8, Zippable } from 'fflate';
import { PapercutItem, PapercutProject } from '../types/papercut';
import { renderLayerMarkup } from './layerSvg';
import { computeDepthTable, flattenLayerIds, findItemOfLayer } from './projectOps';
import { rasterizeSvg } from './svgExporter';
import { serializeProject, PROJECT_FILE_EXT } from './storage';

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

export function asciiSlug(s: string, fallback: string): string {
  const slug = s
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

const q = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
const num = (n: number) => String(Math.round(n * 1000) / 1000);
const vec2 = (x: number, y: number) => `Vector2(${num(x)}, ${num(y)})`;

function measureLayers(project: PapercutProject, layerIds: string[]): Record<string, DOMRect | null> {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${project.width} ${project.height}`);
  svg.setAttribute('width', String(project.width));
  svg.setAttribute('height', String(project.height));
  svg.style.cssText = 'position:absolute;left:-100000px;top:0;visibility:hidden;';
  svg.innerHTML = layerIds
    .map((id) => renderLayerMarkup(project.layers[id], { idPrefix: 'gm_', grain: false, shadow: 0 }))
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
  const warnings: string[] = [];
  const slug = asciiSlug(project.name, asciiSlug(project.id, 'papercut'));
  const resRoot = options.resRoot.replace(/\/+$/, '');
  if (!resRoot.startsWith('res://')) throw new Error('导出路径必须以 res:// 开头');
  const resBase = `${resRoot}/${slug}`;
  const zipBase = resBase.slice('res://'.length);

  const { slots, zOf } = computeDepthTable(project);
  const order = flattenLayerIds(project);
  const isExported = (id: string) => {
    const l = project.layers[id];
    if (!l) return false;
    if (options.includeHidden) return true;
    const g = project.groups.find((gg) => gg.layerIds.includes(id));
    return l.visible && (g ? g.visible : true);
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
  const pad = options.bakeShadow ? 14 : 2;
  const s = options.textureScale;
  const shadow = options.bakeShadow ? project.shadowStrength ?? 0.5 : 0;

  const files: Zippable = {};
  const usedItemSlugs = new Set<string>();
  const manifestItems: unknown[] = [];
  const allSceneRefs: { itemName: string; scenePath: string; pivot: { x: number; y: number } }[] = [];
  let done = 0;

  for (const item of exportItems) {
    const itemSlug = uniqueName(asciiSlug(item.name, item.id.replace(/[^\w]/g, '_')), usedItemSlugs);
    const usedFiles = new Set<string>();
    const usedNodes = new Set<string>();
    const extRes: string[] = [];
    const nodes: string[] = [];
    const manifestParts: unknown[] = [];
    const rootName = nodeName(item.name, itemSlug);

    for (const [idx, pid] of item.partIds.entries()) {
      const layer = project.layers[pid];
      const b = bounds[pid];
      done++;
      onProgress?.(done, allParts.length);
      if (!b) {
        warnings.push(`「${layer.name}」没有可见形状，已跳过`);
        continue;
      }
      if (layer.blendMode && layer.blendMode !== 'normal') {
        warnings.push(`「${layer.name}」使用了 ${layer.blendMode} 混合模式，PNG 中按普通模式烘焙`);
      }
      const x = Math.floor(b.x - pad);
      const y = Math.floor(b.y - pad);
      const w = Math.ceil(b.width + pad * 2);
      const h = Math.ceil(b.height + pad * 2);
      const markup = renderLayerMarkup(layer, { idPrefix: 'gx_', grain: options.bakeGrain, shadow });
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${w * s}" height="${h * s}">${markup}</svg>`;
      const canvas = await rasterizeSvg(svg, w * s, h * s);
      const png = await canvasToPng(canvas);

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
      });
    }

    item.sockets.forEach((sock) => {
      nodes.push(
        [
          `[node name=${q(uniqueName(nodeName(sock.name, 'socket'), usedNodes))} type="Marker2D" parent="."]`,
          `position = ${vec2(sock.x - item.pivot.x, sock.y - item.pivot.y)}`,
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
      scene: scenePath,
      pivot: item.pivot,
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
    partCount: allParts.length,
    warnings,
  };
}
