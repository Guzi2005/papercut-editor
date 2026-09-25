/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PapercutProject, Layer, LayerGroup } from '../types/papercut';
import { createBaseShapePath, generateWillowLeafPath, generateCrescentPath, generateDiamondPath, generateCombRibbonPath, applySymmetryToPath } from './bezierMath';

export const FOLK_PALETTE = [
  { name: '扎染靛蓝', hex: '#2652D0', desc: '蓝印花布核心靛蓝' },
  { name: '青花瓷蓝', hex: '#3B6EF0', desc: '明朗织物宝蓝' },
  { name: '紫藤浅蓝', hex: '#BAC5EB', desc: '柔和薰衣草薄青' },
  { name: '深绛紫茄', hex: '#482A45', desc: '复古桑葚沉稳深绛' },
  { name: '松针墨绿', hex: '#1B523D', desc: '静谧冷杉苍翠' },
  { name: '湖水青绿', hex: '#438B6E', desc: '淡雅竹青与瓷碧' },
  { name: '珊瑚胭脂', hex: '#EB8E88', desc: '初绽山茶温润珊瑚' },
  { name: '麦芒亚麻', hex: '#E8DEC8', desc: '天然棉麻原色' },
  { name: '苍石墨青', hex: '#1E2538', desc: '深郁岩石墨青' },
  { name: '宣纸净白', hex: '#FBFBFC', desc: '纯手工宣纸本白' },
  { name: '蜜蜡明黄', hex: '#E59824', desc: '质朴明朗暖阳' },
  { name: '朱砂印红', hex: '#D23838', desc: '印章吉庆朱红' },
  { name: '丁香粉藕', hex: '#9DAEE3', desc: '温润丁香薄紫' },
  { name: '玄墨沉黑', hex: '#15171F', desc: '高定松烟纯墨' },
  { name: '素练暖白', hex: '#F3EFE6', desc: '手工织匹温润米白' },
];

/**
 * Creates the "民俗工坊·针脚与远方" preset (inspired by User Image 1: modern folk cutouts, characters, diamond patterned fabric)
 */
function createFolkWorkshopPreset(): PapercutProject {
  const width = 1000;
  const height = 800;

  // Group 1: 场景与货架 (Background & Shelves)
  const g1: LayerGroup = {
    id: 'grp_scene',
    name: '工坊场景与展架',
    collapsed: false,
    visible: true,
    locked: false,
    layerIds: ['layer_shelf', 'layer_table', 'layer_rug'],
  };

  // Group 2: 蓝印花布与织物 (Patterned Fabrics)
  const g2: LayerGroup = {
    id: 'grp_fabrics',
    name: '印花布匹与挂饰',
    collapsed: false,
    visible: true,
    locked: false,
    layerIds: ['layer_blue_cloth', 'layer_fabrics_roll', 'layer_banner'],
  };

  // Group 3: 人物造型 (Characters)
  const g3: LayerGroup = {
    id: 'grp_characters',
    name: '剪纸人物造型',
    collapsed: false,
    visible: true,
    locked: false,
    layerIds: ['layer_char_clothes', 'layer_char_face', 'layer_char_hair', 'layer_char_hat'],
  };

  const layers: Record<string, Layer> = {};

  // Rug (地毯)
  layers['layer_rug'] = {
    id: 'layer_rug',
    name: '条纹地毯',
    color: '#77AEE0',
    texture: 'xuan',
    opacity: 0.95,
    blendMode: 'normal',
    visible: true,
    locked: false,
    baseShape: {
      type: 'rect',
      d: 'M 220 540 H 520 V 710 H 220 Z',
    },
    cutouts: [
      {
        id: 'cut_rug_fringe',
        name: '地毯流苏',
        type: 'comb_ribbon',
        d: generateCombRibbonPath({ x: 220, y: 550 }, { x: 220, y: 700 }, 18, 12, 180),
        isHole: true,
        createdAt: 1,
      },
      {
        id: 'cut_rug_stripe1',
        name: '条纹镂空',
        type: 'willow_leaf',
        d: 'M 260 550 H 275 V 700 H 260 Z M 320 550 H 335 V 700 H 320 Z M 380 550 H 395 V 700 H 380 Z M 440 550 H 455 V 700 H 440 Z M 500 550 H 515 V 700 H 500 Z',
        isHole: true,
        createdAt: 2,
      },
    ],
    positiveElements: [],
  };

  // Shelf (大木柜)
  layers['layer_shelf'] = {
    id: 'layer_shelf',
    name: '实木布料货架',
    color: '#4C2F4D',
    texture: 'rough',
    opacity: 1,
    blendMode: 'normal',
    visible: true,
    locked: false,
    baseShape: {
      type: 'polygon',
      d: 'M 80 120 H 220 V 670 H 80 Z',
    },
    cutouts: [
      {
        id: 'cut_shelf_slot1',
        name: '层板镂空1',
        type: 'custom_polygon',
        d: 'M 95 180 H 205 V 290 H 95 Z',
        isHole: true,
        createdAt: 3,
      },
      {
        id: 'cut_shelf_slot2',
        name: '层板镂空2',
        type: 'custom_polygon',
        d: 'M 95 320 H 205 V 430 H 95 Z',
        isHole: true,
        createdAt: 4,
      },
      {
        id: 'cut_shelf_slot3',
        name: '层板镂空3',
        type: 'custom_polygon',
        d: 'M 95 460 H 205 V 570 H 95 Z',
        isHole: true,
        createdAt: 5,
      },
    ],
    positiveElements: [],
  };

  // Table (缝纫案板)
  layers['layer_table'] = {
    id: 'layer_table',
    name: '剪裁长桌',
    color: '#783A20',
    texture: 'rough',
    opacity: 1,
    blendMode: 'normal',
    visible: true,
    locked: false,
    baseShape: {
      type: 'polygon',
      d: 'M 280 570 H 520 V 610 H 500 V 710 H 480 V 610 H 320 V 710 H 300 V 610 H 280 Z',
    },
    cutouts: [],
    positiveElements: [],
  };

  // Blue Cloth with Folk Diamond Cutouts (经典菱形镂空扎染蓝布)
  layers['layer_blue_cloth'] = {
    id: 'layer_blue_cloth',
    name: '蓝染菱纹挂布',
    color: '#1C3D6E',
    texture: 'xuan',
    opacity: 1,
    blendMode: 'normal',
    visible: true,
    locked: false,
    baseShape: {
      type: 'rect',
      d: 'M 350 540 H 410 V 740 H 350 Z',
    },
    cutouts: [
      {
        id: 'cut_diamond_row1',
        name: '经典菱花镂空',
        type: 'diamond',
        d: [
          generateDiamondPath({ x: 380, y: 560 }, { x: 380, y: 590 }, 28),
          generateDiamondPath({ x: 380, y: 610 }, { x: 380, y: 640 }, 28),
          generateDiamondPath({ x: 380, y: 660 }, { x: 380, y: 690 }, 28),
          generateDiamondPath({ x: 380, y: 710 }, { x: 380, y: 740 }, 28),
        ].join(' '),
        isHole: true,
        createdAt: 6,
      },
      {
        id: 'cut_small_diamonds',
        name: '侧翼辅助菱纹',
        type: 'diamond',
        d: [
          generateDiamondPath({ x: 362, y: 575 }, { x: 362, y: 590 }, 14),
          generateDiamondPath({ x: 398, y: 575 }, { x: 398, y: 590 }, 14),
          generateDiamondPath({ x: 362, y: 625 }, { x: 362, y: 640 }, 14),
          generateDiamondPath({ x: 398, y: 625 }, { x: 398, y: 640 }, 14),
          generateDiamondPath({ x: 362, y: 675 }, { x: 362, y: 690 }, 14),
          generateDiamondPath({ x: 398, y: 675 }, { x: 398, y: 690 }, 14),
        ].join(' '),
        isHole: true,
        createdAt: 7,
      },
    ],
    positiveElements: [],
  };

  // Fabric Rolls (彩色卷轴)
  layers['layer_fabrics_roll'] = {
    id: 'layer_fabrics_roll',
    name: '多色布卷',
    color: '#DE4572',
    texture: 'xuan',
    opacity: 1,
    blendMode: 'normal',
    visible: true,
    locked: false,
    baseShape: {
      type: 'rect',
      d: 'M 100 230 H 200 V 270 H 100 Z',
    },
    cutouts: [],
    positiveElements: [],
  };

  // Hanging Banner (挂旗)
  layers['layer_banner'] = {
    id: 'layer_banner',
    name: '印花挂旗',
    color: '#3B7FC4',
    texture: 'smooth',
    opacity: 1,
    blendMode: 'normal',
    visible: true,
    locked: false,
    baseShape: {
      type: 'rect',
      d: 'M 380 150 H 450 V 220 H 380 Z',
    },
    cutouts: [
      {
        id: 'cut_banner_diamonds',
        name: '挂旗菱花',
        type: 'diamond',
        d: [
          generateDiamondPath({ x: 400, y: 175 }, { x: 400, y: 195 }, 16),
          generateDiamondPath({ x: 415, y: 175 }, { x: 415, y: 195 }, 16),
          generateDiamondPath({ x: 430, y: 175 }, { x: 430, y: 195 }, 16),
        ].join(' '),
        isHole: true,
        createdAt: 8,
      },
    ],
    positiveElements: [],
  };

  // Character Clothes (长袍服饰 - 叠色与下摆)
  layers['layer_char_clothes'] = {
    id: 'layer_char_clothes',
    name: '人物长袍与衣褶',
    color: '#F7F4EB',
    texture: 'xuan',
    opacity: 1,
    blendMode: 'normal',
    visible: true,
    locked: false,
    baseShape: {
      type: 'polygon',
      d: 'M 600 370 L 660 370 L 690 670 L 580 670 Z',
    },
    cutouts: [
      {
        id: 'cut_clothes_pleat',
        name: '柳叶衣纹镂空',
        type: 'willow_leaf',
        d: [
          generateWillowLeafPath({ x: 620, y: 440 }, { x: 615, y: 640 }, 14, -0.2),
          generateWillowLeafPath({ x: 650, y: 440 }, { x: 655, y: 640 }, 14, 0.2),
        ].join(' '),
        isHole: true,
        createdAt: 9,
      },
    ],
    positiveElements: [
      {
        id: 'pos_inner_robe',
        name: '内衬黛青布',
        type: 'custom_polygon',
        d: 'M 625 390 H 650 V 670 H 625 Z',
        isHole: false,
        fillColor: '#1C3D6E',
        createdAt: 10,
      },
    ],
  };

  // Character Face (面庞)
  layers['layer_char_face'] = {
    id: 'layer_char_face',
    name: '人物脸庞与五官',
    color: '#F3CE72',
    texture: 'smooth',
    opacity: 1,
    blendMode: 'normal',
    visible: true,
    locked: false,
    baseShape: {
      type: 'polygon',
      d: 'M 605 300 Q 635 290, 665 300 Q 670 355, 635 365 Q 600 355, 605 300 Z',
    },
    cutouts: [
      {
        id: 'cut_eyes',
        name: '柳叶秀眼',
        type: 'willow_leaf',
        d: [
          generateWillowLeafPath({ x: 615, y: 325 }, { x: 630, y: 328 }, 6, 0.4),
          generateWillowLeafPath({ x: 642, y: 328 }, { x: 657, y: 325 }, 6, -0.4),
        ].join(' '),
        isHole: true,
        createdAt: 11,
      },
      {
        id: 'cut_mouth',
        name: '月牙笑唇',
        type: 'crescent',
        d: generateCrescentPath({ x: 630, y: 345 }, { x: 642, y: 345 }, 5, 0.8),
        isHole: true,
        createdAt: 12,
      },
    ],
    positiveElements: [],
  };

  // Character Hair with Willow Leaf Bangs (黑发与柳叶齐刘海)
  layers['layer_char_hair'] = {
    id: 'layer_char_hair',
    name: '发髻与柳叶刘海',
    color: '#1F2024',
    texture: 'rough',
    opacity: 1,
    blendMode: 'normal',
    visible: true,
    locked: false,
    baseShape: {
      type: 'polygon',
      d: 'M 590 280 Q 635 240, 680 280 Q 695 340, 680 375 L 665 320 Q 635 325, 605 320 L 590 375 Z',
    },
    cutouts: [
      {
        id: 'cut_bangs_leaves',
        name: '齐刘海柳叶纹',
        type: 'willow_leaf',
        d: [
          generateWillowLeafPath({ x: 612, y: 280 }, { x: 618, y: 315 }, 8, -0.1),
          generateWillowLeafPath({ x: 624, y: 275 }, { x: 628, y: 318 }, 8, 0),
          generateWillowLeafPath({ x: 634, y: 275 }, { x: 636, y: 318 }, 8, 0),
          generateWillowLeafPath({ x: 642, y: 275 }, { x: 646, y: 318 }, 8, 0),
          generateWillowLeafPath({ x: 652, y: 280 }, { x: 658, y: 315 }, 8, 0.1),
        ].join(' '),
        isHole: true,
        createdAt: 13,
      },
    ],
    positiveElements: [],
  };

  // Hat (贝雷帽 / 民俗头饰)
  layers['layer_char_hat'] = {
    id: 'layer_char_hat',
    name: '贝雷帽饰',
    color: '#3B7FC4',
    texture: 'xuan',
    opacity: 1,
    blendMode: 'normal',
    visible: true,
    locked: false,
    baseShape: {
      type: 'polygon',
      d: 'M 590 270 Q 635 200, 690 250 Q 670 285, 600 280 Z',
    },
    cutouts: [
      {
        id: 'cut_hat_willow',
        name: '帽饰柳叶刀痕',
        type: 'willow_leaf',
        d: generateWillowLeafPath({ x: 615, y: 250 }, { x: 660, y: 245 }, 12, 0.3),
        isHole: true,
        createdAt: 14,
      },
    ],
    positiveElements: [],
  };

  return {
    id: 'proj_folk_workshop',
    name: '针脚与远方 · 民俗工坊',
    width,
    height,
    groups: [g1, g2, g3],
    layers,
    rootOrder: [
      { type: 'group', id: 'grp_scene' },
      { type: 'group', id: 'grp_fabrics' },
      { type: 'group', id: 'grp_characters' },
    ],
    backgroundColor: '#FAF7F0',
    backgroundStyle: 'bamboo_mat',
  };
}

/**
 * Creates the "波兰维辛奇民俗马车花鸟" preset (inspired by User Image 2: Wycinanki folk papercut, symmetrical rooster trees, saw-tooth comb leaves)
 */
function createWycinankiPreset(): PapercutProject {
  const width = 1000;
  const height = 800;
  const cx = width / 2;

  const gTree: LayerGroup = {
    id: 'grp_tree',
    name: '对称神树与梳齿叶',
    collapsed: false,
    visible: true,
    locked: false,
    layerIds: ['layer_tree_stem', 'layer_tree_crown'],
  };

  const gFloral: LayerGroup = {
    id: 'grp_floral',
    name: '五彩公鸡冠花',
    collapsed: false,
    visible: true,
    locked: false,
    layerIds: ['layer_crest_outer', 'layer_crest_heart'],
  };

  const layers: Record<string, Layer> = {};

  // Symmetrical Tree Crown with Sawtooth Comb Cuts
  layers['layer_tree_crown'] = {
    id: 'layer_tree_crown',
    name: '翠绿梳齿华盖',
    color: '#2A7A4C',
    texture: 'xuan',
    opacity: 1,
    blendMode: 'normal',
    visible: true,
    locked: false,
    baseShape: {
      type: 'polygon',
      d: applySymmetryToPath(
        'M 500 200 Q 640 220, 650 480 Q 560 480, 500 480 Z',
        'mirror_v',
        cx,
        400
      ),
    },
    cutouts: [
      {
        id: 'cut_tree_comb_left',
        name: '左翼排刀锯齿',
        type: 'comb_ribbon',
        d: applySymmetryToPath(
          generateCombRibbonPath({ x: 500, y: 220 }, { x: 630, y: 440 }, 45, 18, 90),
          'mirror_v',
          cx,
          400
        ),
        isHole: true,
        createdAt: 1,
      },
      {
        id: 'cut_tree_inner_willows',
        name: '内环柳叶瓣',
        type: 'willow_leaf',
        d: applySymmetryToPath(
          [
            generateWillowLeafPath({ x: 500, y: 280 }, { x: 580, y: 350 }, 22, 0.2),
            generateWillowLeafPath({ x: 500, y: 340 }, { x: 570, y: 410 }, 20, 0.2),
            generateWillowLeafPath({ x: 500, y: 400 }, { x: 550, y: 460 }, 18, 0.2),
          ].join(' '),
          'mirror_v',
          cx,
          400
        ),
        isHole: true,
        createdAt: 2,
      },
    ],
    positiveElements: [],
  };

  // Tree Stem
  layers['layer_tree_stem'] = {
    id: 'layer_tree_stem',
    name: '古树主干',
    color: '#783A20',
    texture: 'rough',
    opacity: 1,
    blendMode: 'normal',
    visible: true,
    locked: false,
    baseShape: {
      type: 'polygon',
      d: 'M 480 460 H 520 V 700 H 480 Z',
    },
    cutouts: [
      {
        id: 'cut_stem_stripes',
        name: '树皮纹理',
        type: 'willow_leaf',
        d: [
          generateWillowLeafPath({ x: 500, y: 490 }, { x: 500, y: 550 }, 10),
          generateWillowLeafPath({ x: 500, y: 580 }, { x: 500, y: 650 }, 10),
        ].join(' '),
        isHole: true,
        createdAt: 3,
      },
    ],
    positiveElements: [],
  };

  // Crest Outer (艳丽红花冠)
  layers['layer_crest_outer'] = {
    id: 'layer_crest_outer',
    name: '胭脂红外瓣',
    color: '#D72626',
    texture: 'xuan',
    opacity: 1,
    blendMode: 'normal',
    visible: true,
    locked: false,
    baseShape: {
      type: 'polygon',
      d: applySymmetryToPath(
        'M 500 80 Q 580 80, 570 180 Q 520 180, 500 180 Z',
        'mirror_v',
        cx,
        400
      ),
    },
    cutouts: [
      {
        id: 'cut_crest_willows',
        name: '花冠柳叶透光',
        type: 'willow_leaf',
        d: applySymmetryToPath(
          [
            generateWillowLeafPath({ x: 500, y: 100 }, { x: 540, y: 150 }, 14, 0.3),
            generateWillowLeafPath({ x: 500, y: 130 }, { x: 550, y: 165 }, 12, 0.2),
          ].join(' '),
          'mirror_v',
          cx,
          400
        ),
        isHole: true,
        createdAt: 4,
      },
    ],
    positiveElements: [],
  };

  // Crest Heart (姜黄花蕊)
  layers['layer_crest_heart'] = {
    id: 'layer_crest_heart',
    name: '明黄内芯',
    color: '#EAA12B',
    texture: 'smooth',
    opacity: 1,
    blendMode: 'normal',
    visible: true,
    locked: false,
    baseShape: {
      type: 'polygon',
      d: applySymmetryToPath(
        'M 500 120 Q 535 120, 530 170 Q 515 170, 500 170 Z',
        'mirror_v',
        cx,
        400
      ),
    },
    cutouts: [
      {
        id: 'cut_heart_moon',
        name: '花芯月牙镂空',
        type: 'crescent',
        d: applySymmetryToPath(
          generateCrescentPath({ x: 500, y: 135 }, { x: 520, y: 160 }, 6, 0.7),
          'mirror_v',
          cx,
          400
        ),
        isHole: true,
        createdAt: 5,
      },
    ],
    positiveElements: [],
  };

  return {
    id: 'proj_wycinanki',
    name: '维辛奇 · 民俗神树与华冠',
    width,
    height,
    groups: [gTree, gFloral],
    layers,
    rootOrder: [
      { type: 'group', id: 'grp_tree' },
      { type: 'group', id: 'grp_floral' },
    ],
    backgroundColor: '#FFFFFF',
    backgroundStyle: 'clean_white',
  };
}

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
function createBlankCanvas(): PapercutProject {
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
    id: 'folk_workshop',
    name: '针脚与远方 · 民俗工坊',
    desc: '现代民俗剪纸场景，多图层色块、几何扎染布与柳叶刘海人物',
    factory: createFolkWorkshopPreset,
  },
  {
    id: 'wycinanki',
    name: '维辛奇 · 梳齿神树与花鸟',
    desc: '中欧/波兰民俗剪纸，排刀梳齿树冠与高饱和度叠层花冠',
    factory: createWycinankiPreset,
  },
  {
    id: 'rosette',
    name: '吉庆连年 · 八折团花窗花',
    desc: '传统八折团花剪纸，内圈月牙外圈柳叶，透光窗棂意境',
    factory: createRadialRosettePreset,
  },
  {
    id: 'blank',
    name: '新建空白宣纸画布',
    desc: '空白朱红剪纸，支持自由使用柳叶笔与各色图层挥洒创意',
    factory: createBlankCanvas,
  },
];
