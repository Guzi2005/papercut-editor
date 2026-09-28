/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PapercutProject, Layer, LayerGroup, CanvasBackground } from '../types/papercut';
import { createWeaveCharactersPreset, createPolishAngelPreset, createDoubleFishPreset } from './weavePresets';

/** Weave and Wander 色卡：取样自「针脚与远方」设定图 */
export const FOLK_PALETTE = [
  { name: '织梦靛蓝', hex: '#2E58D6', desc: '贝雷帽与长围巾的主蓝' },
  { name: '深靛', hex: '#16358F', desc: '蓝印花布的沉底蓝' },
  { name: '藏青夜', hex: '#1B2352', desc: '裤装、领带与眼镜' },
  { name: '石灰紫', hex: '#6C73A4', desc: '阴面与次级织物' },
  { name: '紫藤雾', hex: '#A4A9E0', desc: '长袍拼色与布卷' },
  { name: '薄雾蓝', hex: '#C6D6F2', desc: '地毯与远景' },
  { name: '桑葚绛', hex: '#52253A', desc: '柜台、货架与外套' },
  { name: '茜草红', hex: '#BD5A63', desc: '嘴唇与小点缀' },
  { name: '腮红粉', hex: '#E48C8C', desc: '腮红、花朵、布卷' },
  { name: '麦肤', hex: '#F2D2B6', desc: '角色肤色' },
  { name: '米白棉', hex: '#F6EEE2', desc: '长袍与桌布' },
  { name: '纸本白', hex: '#FCFAF6', desc: '纹样与高光' },
  { name: '松石绿', hex: '#2F6E59', desc: '挂布、立柱与凳子' },
  { name: '胡桃木', hex: '#7E5E4F', desc: '木纹与背板' },
  { name: '蜜蜡黄', hex: '#E3A548', desc: '少量暖色点缀' },
  { name: '墨发', hex: '#15161C', desc: '头发与猫' },
];

export type NewCanvasMode = 'cut' | 'create';

export interface BlankCanvasOptions {
  canvasBg?: CanvasBackground;
  width?: number;
  height?: number;
  /** cut = 剪纸模式（一张居中色纸）；create = 创造模式（空组） */
  mode?: NewCanvasMode;
  paperColor?: string;
  name?: string;
}

/**
 * Creates a blank project. 剪纸模式放一张居中方纸；创造模式只有空深度层。
 */
export function createBlankCanvas(opts: BlankCanvasOptions = {}): PapercutProject {
  const width = opts.width ?? 800;
  const height = opts.height ?? 800;
  const mode = opts.mode ?? 'cut';
  const paperColor = opts.paperColor ?? '#D72626';

  const g1: LayerGroup = {
    id: 'grp_main',
    name: mode === 'cut' ? '主剪纸图层组' : '深度层 1',
    collapsed: false,
    visible: true,
    locked: false,
    layerIds: [],
  };

  const layers: Record<string, Layer> = {};

  if (mode === 'cut') {
    const side = Math.min(width, height) * 0.76;
    const x = (width - side) / 2;
    const y = (height - side) / 2;
    const r = Math.min(24, side * 0.04);
    layers['layer_base_paper'] = {
      id: 'layer_base_paper',
      name: '色纸',
      color: paperColor,
      texture: 'xuan',
      opacity: 1,
      blendMode: 'normal',
      visible: true,
      locked: false,
      grain: 0.35,
      baseShape: {
        type: 'rounded_rect',
        d: `M ${x + r} ${y} H ${x + side - r} Q ${x + side} ${y} ${x + side} ${y + r} V ${y + side - r} Q ${x + side} ${y + side} ${x + side - r} ${y + side} H ${x + r} Q ${x} ${y + side} ${x} ${y + side - r} V ${y + r} Q ${x} ${y} ${x + r} ${y} Z`,
      },
      cutouts: [],
      positiveElements: [],
      drawings: [],
    };
    g1.layerIds = ['layer_base_paper'];
  }

  return {
    id: `proj_${Date.now()}`,
    canvasBg: opts.canvasBg,
    name: opts.name ?? (mode === 'cut' ? '未命名剪纸作品' : '未命名创作'),
    width,
    height,
    groups: [g1],
    layers,
    rootOrder: [{ type: 'group', id: 'grp_main' }],
    backgroundColor: '#1E2522',
    backgroundStyle: 'bamboo_mat',
  };
}

export const PRESET_PROJECTS: { id: string; name: string; desc: string; factory: () => PapercutProject }[] = [
  {
    id: 'weave_characters',
    name: '织游角色 · 造型拼装',
    desc: 'Weave and Wander 角色与柜台，已按物件打组',
    factory: createWeaveCharactersPreset,
  },
  {
    id: 'polish_angel',
    name: '波兰剪纸 · 夜骑白马的天使',
    desc: '深蓝夜空、金银箔翅膀与彩条长裙的拼贴剪纸',
    factory: createPolishAngelPreset,
  },
  {
    id: 'double_fish',
    name: '吉庆有余 · 双鱼窗花',
    desc: '对折剪出的双鱼窗花：鳞片、柳叶刀纹、梳齿鳍',
    factory: createDoubleFishPreset,
  },
];
