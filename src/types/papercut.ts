/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SymmetrySettings } from '../utils/symmetry';

export interface Point {
  x: number;
  y: number;
  pressure?: number;
}

export type CutoutType =
  | 'willow_leaf'
  | 'crescent'
  | 'comb_ribbon'
  | 'teardrop'
  | 'diamond'
  | 'freehand'
  | 'pen_knife'
  | 'geom_shape'
  | 'stamp'
  | 'custom_polygon';

export interface CutoutPath {
  id: string;
  name: string;
  type: CutoutType;
  d: string; // SVG path data (e.g. M ... C ... Z)
  isHole: boolean; // true = 镂空 (cut hole in paper), false = 贴纸 (additive paper applique)
  strokeWidth?: number;
  fillColor?: string; // used if positive element
  createdAt: number;
  points?: Point[]; // Anchor / vertex points for editing
  geomType?: GeomShapeType; // If geom_shape: rect, circle, triangle, star, diamond
}

export type BaseShapeType =
  | 'full'
  | 'rect'
  | 'rounded_rect'
  | 'circle'
  | 'arch'
  | 'polygon'
  | 'freeform';

export interface BaseShape {
  type: BaseShapeType;
  d: string; // SVG path for outer paper boundary
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  radius?: number;
}

/** soft 柔和投影 · vector 无影平面矢量 · hard 硬边加深色投影 */
export type PaperMode = 'soft' | 'vector' | 'hard';

/** 投影合成模式（CSS mix-blend-mode） */
export type ShadowBlend = 'normal' | 'multiply' | 'color-burn' | 'darken' | 'overlay' | 'soft-light';

export type PaperTextureType = 'xuan' | 'rough' | 'smooth' | 'speckle';

export type KnifeTipShape = 'round' | 'flat' | 'chisel' | 'slash';
export type DrawBrushType = 'pencil' | 'pen' | 'airbrush' | 'willow';
export type PencilHardness = 1 | 2 | 3 | 4 | 5;

export interface LayerDrawStroke {
  id: string;
  brushType: DrawBrushType;
  d: string;
  color: string;
  opacity: number;
  strokeWidth: number;
  strokeLinecap?: 'round' | 'square' | 'butt';
  strokeLinejoin?: 'round' | 'miter' | 'bevel';
  pencilHardness?: PencilHardness;
  blur?: number; // for airbrush
  fill?: boolean; // 柳叶笔：闭合填色的叶形，而非描边
}

export interface Layer {
  id: string;
  name: string;
  /** doodle 涂鸦图层：没有纸，只承载手绘笔迹，笔迹不受纸片边界裁切 */
  kind?: 'paper' | 'doodle';
  color: string; // Hex color code
  texture: PaperTextureType;
  opacity: number; // 0 to 1
  blendMode: 'normal' | 'multiply' | 'screen' | 'overlay';
  visible: boolean;
  locked: boolean;
  baseShape: BaseShape;
  cutouts: CutoutPath[];
  positiveElements: CutoutPath[];
  drawings?: LayerDrawStroke[]; // 手绘线条笔迹 (附属于此剪纸图层蒙版)
  pattern?: LayerPattern; // 纹样填充 (蓝印菱花、条纹、格纹、圆点)
  grain?: number; // 水粉颗粒质感强度 0 ~ 1
}

export type PatternType = 'diamond' | 'stripes' | 'checks' | 'dots' | 'argyle';

export interface LayerPattern {
  type: PatternType;
  color: string;
  scale: number; // 纹样单元尺寸 (px)
  angle: number; // 旋转角度 (deg)
  opacity: number;
}

export interface ItemSocket {
  id: string;
  name: string;
  x: number;
  y: number;
}

/**
 * 物件：同一个游戏对象的视觉部件集合。部件即图层，可分布在不同深度组里
 * (例如柜台后板在家具层、柜台前挡在前景层)，导出到 Godot 时成为一个场景。
 */
export interface PapercutItem {
  id: string;
  name: string;
  partIds: string[];
  pivot: Point;
  sockets: ItemSocket[];
}

export interface ReferenceImage {
  src: string; // data URL
  opacity: number;
  visible: boolean;
  onTop: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayerGroup {
  id: string;
  name: string;
  collapsed: boolean;
  visible: boolean;
  locked: boolean;
  layerIds: string[];
}

export type RootItem =
  | { type: 'group'; id: string }
  | { type: 'layer'; id: string };

export type GeomShapeType =
  | 'rect'
  | 'circle'
  | 'triangle'
  | 'star'
  | 'diamond'
  | 'polyline';

export type ToolType =
  | 'select' // 选择/移动/缩放/旋转 (V)
  | 'willow_leaf' // 柳叶笔 (零直径实时流线，HiPaint/画世界)
  | 'geom_shape' // 基本几何形 (矩形/圆/三角/五角星/菱形)
  | 'pen_knife' // 笔刀 (原自由手绘刻刀，支持压感、不同笔尖形状选择)
  | 'freehand' // 别名兼容
  | 'hand_draw' // 手绘 (铅笔/钢笔/喷枪，附属于剪纸图层蒙版)
  | 'anchor_edit'; // 锚点调整 (自由拖动顶点变形)

export type SymmetryMode =
  | 'none'
  | 'mirror_v' // 左右对折
  | 'mirror_h' // 上下对折
  | 'quad' // 四方对折
  | 'radial_6' // 六折团花
  | 'radial_8'; // 八折团花

export type ViewMode =
  | 'realistic' // 赛博剪纸物理质感 (纸层落影、刀痕浮雕、宣纸纹理)
  | 'vector' // 纯净矢量 (精准1:1平面无光影)
  | 'backlit'; // 窗花夜透光 (明亮背光透出镂空图案)

export type BackgroundStyle =
  | 'ebony' // 乌木刻台
  | 'bamboo_mat' // 传统墨绿刻垫
  | 'lattice' // 冰裂纹木窗
  | 'clean_white' // 纯白极简
  | 'rice_paper'; // 宣纸衬底

export interface BrushSettings {
  willowMode: 'chord' | 'symmetric'; // 剪纸/柳叶笔成型：单弧连弦成叶 (画世界/HiPaint) vs 对称双弧
  stabilizer: number; // 平滑防抖 (0, 0.55, 0.8)
  simplifyTolerance: number; // 道格拉斯-普克曲线净化 (0, 2.5, 4.5, 7.5)
  curvature: number; // 弯曲偏度
  geomShapeType: GeomShapeType; // 选中的基本几何形
  combSpacing: number; // 梳齿间距 (10, 16, 24)
  combToothAngle: number; // 齿角偏度
  stampSize: number; // 笔刀尺寸预设 (16, 26, 40)
  mode: 'cutout' | 'positive' | 'erase'; // 刻纸(按落笔处自动镂空/贴花) vs 贴花 vs 剪除，仅剪纸工具
  eraseMode?: 'hole' | 'wipe'; // 剪除子模式：镂空 vs 一笔擦除

  // 星型可调属性 (Star Shape Settings)
  starPoints?: number; // 角的个数 (3 ~ 16)
  starRoundness?: number; // 圆角程度 (0 ~ 25)
  starIrregularity?: number; // 不规则程度 (0 ~ 100)

  symmetry?: SymmetrySettings; // 对称：轴对称 / 中心对称
  pressure: boolean; // 全局压感：笔刀切口宽度与手绘笔触粗细
  brushColor: string; // 全局画笔颜色：手绘笔触与贴花纸片

  // 笔刀 (Pen knife)
  knifeTipShape: KnifeTipShape; // 笔尖形状选择: 'round' | 'flat' | 'chisel' | 'slash'

  // 手绘 (Hand draw)
  drawBrushType: DrawBrushType; // 'pencil' | 'pen' | 'airbrush'
  drawOpacity: number; // 不透明度 (0.1 ~ 1.0)
  drawSize: number; // 笔尖粗细大小
  pencilHardness: PencilHardness; // 参考 SAI 铅笔软硬五档: 1 极软, 2 软, 3 中, 4 硬, 5 极硬
  airbrushSoftness: number; // 喷枪晕染度 (5 ~ 30)
}

export interface PapercutProject {
  id: string;
  name: string;
  width: number;
  height: number;
  groups: LayerGroup[];
  layers: Record<string, Layer>;
  rootOrder: RootItem[];
  backgroundColor: string;
  backgroundStyle: BackgroundStyle;
  items?: PapercutItem[];
  reference?: ReferenceImage;
  shadowStrength?: number; // 投影强度 0 ~ 1
  shadowSoftness?: number; // 投影软硬 0 硬边 ~ 1 柔和
  shadowBlend?: ShadowBlend; // 投影合成模式
  paperMode?: PaperMode; // 剪贴模式
}
