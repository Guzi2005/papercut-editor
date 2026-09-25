/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PapercutProject, Layer, LayerGroup } from '../types/papercut';
import { createWeaveCharactersPreset, createPolishAngelPreset } from './weavePresets';
import { createBaseShapePath, generateWillowLeafPath, generateCrescentPath, generateDiamondPath, generateCombRibbonPath, applySymmetryToPath } from './bezierMath';

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

/**
 * Creates the "吉庆八折团花窗花" preset (Classic 8-fold radial window rosette papercut)
 */
function createRadialRosettePreset(): PapercutProject {
  const width = 800;
  const height = 800;
  const cx = 400;
  const cy = 400;

  const g1: LayerGroup = {
    id: 'grp_rosette',
    name: '八折团花窗棂',
    collapsed: false,
    visible: true,
    locked: false,
    layerIds: ['layer_red_paper', 'layer_gold_backing'],
  };

  const layers: Record<string, Layer> = {};

  // Red Cutout Paper (正红刻纸)
  layers['layer_red_paper'] = {
    id: 'layer_red_paper',
    name: '朱砂八角红纸',
    color: '#D72626',
    texture: 'xuan',
    opacity: 1,
    blendMode: 'normal',
    visible: true,
    locked: false,
    baseShape: {
      type: 'circle',
      d: createBaseShapePath('circle', width, height, 80),
    },
    cutouts: [
      {
        id: 'cut_radial_petals_outer',
        name: '外环柳叶花瓣',
        type: 'willow_leaf',
        d: applySymmetryToPath(
          generateWillowLeafPath({ x: cx, y: cy - 290 }, { x: cx + 45, y: cy - 210 }, 28, 0.2),
          'radial_8',
          cx,
          cy
        ),
        isHole: true,
        createdAt: 1,
      },
      {
        id: 'cut_radial_petals_mid',
        name: '中环月牙浪花',
        type: 'crescent',
        d: applySymmetryToPath(
          generateCrescentPath({ x: cx, y: cy - 190 }, { x: cx + 60, y: cy - 140 }, 18, 0.6),
          'radial_8',
          cx,
          cy
        ),
        isHole: true,
        createdAt: 2,
      },
      {
        id: 'cut_radial_petals_inner',
        name: '内环水滴连心',
        type: 'teardrop',
        d: applySymmetryToPath(
          generateWillowLeafPath({ x: cx, y: cy - 90 }, { x: cx + 25, y: cy - 50 }, 16, 0.1),
          'radial_8',
          cx,
          cy
        ),
        isHole: true,
        createdAt: 3,
      },
      {
        id: 'cut_center_core',
        name: '正中铜钱八宝心',
        type: 'diamond',
        d: applySymmetryToPath(
          generateDiamondPath({ x: cx, y: cy - 35 }, { x: cx + 18, y: cy - 18 }, 14),
          'radial_8',
          cx,
          cy
        ),
        isHole: true,
        createdAt: 4,
      },
    ],
    positiveElements: [],
  };

  // Backing (金色衬底)
  layers['layer_gold_backing'] = {
    id: 'layer_gold_backing',
    name: '宣纸暖金衬底',
    color: '#F7F4EB',
    texture: 'xuan',
    opacity: 0.9,
    blendMode: 'normal',
    visible: true,
    locked: true,
    baseShape: {
      type: 'full',
      d: createBaseShapePath('full', width, height, 0),
    },
    cutouts: [],
    positiveElements: [],
  };

  return {
    id: 'proj_rosette',
    name: '吉庆连年 · 八折团花窗花',
    width,
    height,
    groups: [g1],
    layers,
    rootOrder: [{ type: 'group', id: 'grp_rosette' }],
    backgroundColor: '#1F2024',
    backgroundStyle: 'lattice',
  };
}

/**
 * Creates a clean blank canvas with a single red paper sheet ready to carve
 */
export function createBlankCanvas(): PapercutProject {
  const width = 800;
  const height = 800;

  const g1: LayerGroup = {
    id: 'grp_main',
    name: '主剪纸图层组',
    collapsed: false,
    visible: true,
    locked: false,
    layerIds: ['layer_base_paper'],
  };

  const layers: Record<string, Layer> = {};

  layers['layer_base_paper'] = {
    id: 'layer_base_paper',
    name: '朱红宣纸底片',
    color: '#D72626',
    texture: 'xuan',
    opacity: 1,
    blendMode: 'normal',
    visible: true,
    locked: false,
    baseShape: {
      type: 'rounded_rect',
      d: createBaseShapePath('rounded_rect', width, height, 100),
    },
    cutouts: [],
    positiveElements: [],
  };

  return {
    id: 'proj_blank',
    name: '未命名剪纸作品',
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
    id: 'rosette',
    name: '吉庆连年 · 八折团花窗花',
    desc: '传统八折团花，内圈月牙外圈柳叶',
    factory: createRadialRosettePreset,
  },
];
