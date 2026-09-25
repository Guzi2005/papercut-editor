/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PapercutProject, Layer, LayerGroup } from '../types/papercut';
import { createWeaveCharactersPreset, createPolishAngelPreset, createDoubleFishPreset } from './weavePresets';
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
    id: 'double_fish',
    name: '吉庆有余 · 双鱼窗花',
    desc: '对折剪出的双鱼窗花：鳞片、柳叶刀纹、梳齿鳍',
    factory: createDoubleFishPreset,
  },
];
