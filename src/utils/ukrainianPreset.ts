import type { CutoutPath, PapercutProject } from '../types/papercut';
import { UKRAINIAN_TRACE } from './ukrainianTrace';
import { transformPathD, type Matrix } from './pathTransform';
import { applySymmetry } from './symmetry';
import { ukrainianKnifeCut, type UkrainianHoleKind } from './ukrainianKnifeCuts';

const CUT_LABEL: Partial<Record<UkrainianHoleKind, string>> = {
  diamond: '菱形刀口',
  arrowhead: '箭尾刀口',
  opening: '结构开口',
};

/** One folded white sheet, with actual editable holes rather than blue painted marks. */
export function createUkrainianTreePreset(): PapercutProject {
  const width = 848, height = 1124;
  const matrices: Matrix[] = [[1, 0, 0, 1, 0, 0], [-1, 0, 0, 1, width, 0]];
  const edges: string[] = [], cutouts: CutoutPath[] = [];
  for (const path of UKRAINIAN_TRACE) {
    const [tx, ty] = (path.transform.match(/-?\d+(?:\.\d+)?/g) ?? ['0', '0']).map(Number);
    const contours = transformPathD(path.d, [2, 0, 0, 2, tx * 2, ty * 2]).match(/M[^M]+/g) ?? [];
    if (!contours.length) continue;
    edges.push(contours[0]!);
    for (const d of contours.slice(1)) {
      const coords = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
      const y = coords[1] ?? 0;
      const motif = y < 220 ? '花叶镂空' : y < 600 ? '鸟羽与枝叶' : y < 920 ? '人物衣袖刀纹' : '裙边与花纹';
      const cut = ukrainianKnifeCut(d);
      const label = CUT_LABEL[cut.kind];
      const name = `${label ? `${motif}·${label}` : motif} ${cutouts.length + 1}`;
      cutouts.push({ id: `ua_cut_${cutouts.length}`, name,
        type: 'custom_polygon', d: applySymmetry(cut.d, matrices), isHole: true,
        createdAt: cutouts.length, symmetrySource: { d: cut.d, matrices } });
    }
  }
  const d = edges.join(' ');
  return {
    id: 'proj_ukrainian_tree', name: '乌克兰剪纸 · 生命树', width, height,
    canvasBg: { kind: 'solid', color: '#176C9D', texture: 'paper' },
    backgroundColor: '#176C9D', backgroundStyle: 'rice_paper', paperMode: 'vector', shadowStrength: 0,
    symmetry: { kind: 'mirror', count: 1, angle: 90, cx: width / 2, cy: height / 2, visible: false },
    groups: [{ id: 'ua_paper', name: '对折剪纸', visible: true, locked: false, collapsed: false, layerIds: ['ua_tree'] }],
    layers: { ua_tree: {
      id: 'ua_tree', name: '生命树 · 双鸟与人物', color: '#F5F1E5', texture: 'xuan',
      grain: .15, opacity: 1, blendMode: 'normal', visible: true, locked: false,
      baseShape: { type: 'freeform', d: applySymmetry(d, matrices), symmetrySource: { d, matrices } },
      cutouts, positiveElements: [], drawings: [],
    } },
    rootOrder: [{ type: 'group', id: 'ua_paper' }],
  };
}
