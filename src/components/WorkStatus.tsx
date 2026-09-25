/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Box, EyeOff, Lock } from 'lucide-react';
import { BrushSettings, PapercutItem, PapercutProject, ToolType } from '../types/papercut';
import { findGroupOfLayer, findItemOfLayer, isLayerRendered } from '../utils/projectOps';
import { TOOLS } from './Toolbar';
import { DRAW_BRUSHES, GEOM_SHAPES, KNIFE_TIPS } from './ToolOptions';
import { isLight } from '../utils/color';

const MODE_LABELS: Record<string, string> = { cutout: '刻纸', positive: '贴花', erase: '剪除' };
const short = (tip: string) => tip.split(/[：·]/)[0].trim();

function toolDetail(tool: ToolType, bs: BrushSettings, doodle: boolean): string[] {
  switch (tool) {
    case 'willow_leaf':
      return [
        bs.mode === 'erase' ? `剪除 · ${bs.eraseMode === 'wipe' ? '一笔擦除' : '镂空'}` : MODE_LABELS[bs.mode],
        bs.willowMode === 'symmetric' ? '双弧' : '单弧',
      ];
    case 'geom_shape':
      return [short(GEOM_SHAPES.find((g) => g.id === (bs.geomShapeType || 'rect'))?.tip ?? '')];
    case 'pen_knife':
    case 'freehand':
      return [short(KNIFE_TIPS.find((k) => k.id === (bs.knifeTipShape || 'round'))?.tip ?? ''), `${bs.stampSize || 26}px`];
    case 'hand_draw': {
      const brush = short(DRAW_BRUSHES.find((b) => b.id === (bs.drawBrushType || 'pencil'))?.tip ?? '');
      return [brush, ...(bs.drawBrushType === 'willow' ? [] : [`${bs.drawSize ?? 6}px`]), ...(doodle ? ['涂鸦'] : [])];
    }
    default:
      return [];
  }
}

/** Where the next stroke lands: the tool in hand and the layer it will act on. */
export const WorkStatus: React.FC<{
  project: PapercutProject;
  activeLayerId: string | null;
  currentTool: ToolType;
  brushSettings: BrushSettings;
  selectedLayerIds: string[];
  selectedItem: PapercutItem | null;
  brushColor: string;
}> = ({ project, activeLayerId, currentTool, brushSettings, selectedLayerIds, selectedItem, brushColor }) => {
  const tool = TOOLS.find((t) => t.id === (currentTool === 'freehand' ? 'pen_knife' : currentTool));
  const layer = activeLayerId ? project.layers[activeLayerId] : null;
  const group = layer ? findGroupOfLayer(project, layer.id) : null;
  const item = layer ? findItemOfLayer(project, layer.id) : null;
  const locked = !!layer && (layer.locked || !!group?.locked);
  const hidden = !!layer && !isLayerRendered(project, layer.id);
  const doodle = layer?.kind === 'doodle';
  const carving = ['willow_leaf', 'geom_shape', 'pen_knife', 'freehand'].includes(currentTool);
  const blocked = !!layer && (locked || hidden || (doodle && carving));
  const detail = toolDetail(currentTool, brushSettings, doodle);

  const dark = !isLight(brushColor);
  const summary =
    currentTool === 'select'
      ? selectedItem
        ? `${selectedItem.name} · ${selectedItem.partIds.length} 部件`
        : selectedLayerIds.length > 0
        ? `${selectedLayerIds.length} 部件`
        : '未选中'
      : detail.join(' · ');
  const layerTip = layer
    ? [layer.name, group?.name, item ? `物件：${item.name}` : null, locked ? '已锁定' : null, hidden ? '已隐藏' : null, doodle && carving ? '涂鸦图层只能手绘' : null]
        .filter(Boolean)
        .join(' · ')
    : '未选中纸片 · Alt+点击拾取';

  return (
    <div
      className={`h-8 px-2.5 flex items-center gap-1.5 border-t border-(--ui-divider) shrink-0 text-[11px] whitespace-nowrap overflow-hidden transition-colors ${
        dark ? 'text-white/90' : 'text-[#1B1626]/90'
      }`}
      style={{ backgroundColor: brushColor }}
      data-tip={`当前颜色 ${brushColor.toUpperCase()}`}
    >
      {tool && <tool.icon className="w-3.5 h-3.5 shrink-0" />}
      <span className="font-semibold shrink-0">{tool?.name}</span>
      <span className="truncate opacity-75 min-w-0">{summary}</span>
      <span className="flex-1" />
      <span
        className={`flex items-center gap-1 min-w-0 max-w-[55%] px-1.5 h-5 rounded-md ${
          blocked || !layer ? 'bg-[#D23838] text-white' : dark ? 'bg-black/25' : 'bg-white/45'
        }`}
        data-tip={layerTip}
      >
        {layer ? (
          <>
            <span className="w-2.5 h-2.5 rounded-[3px] border border-white/60 shrink-0" style={{ backgroundColor: layer.color }} />
            <span className="truncate font-medium">{layer.name}</span>
            {item && <Box className="w-3 h-3 shrink-0 opacity-80" />}
            {locked && <Lock className="w-3 h-3 shrink-0" />}
            {hidden && <EyeOff className="w-3 h-3 shrink-0" />}
          </>
        ) : (
          <span className="truncate">未选中纸片</span>
        )}
      </span>
    </div>
  );
};
