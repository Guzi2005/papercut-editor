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

const MODE_LABELS: Record<string, string> = { cutout: '刻纸', positive: '贴花', erase: '剪除' };
const short = (tip: string) => tip.split(/[：·]/)[0].trim();

function toolDetail(tool: ToolType, bs: BrushSettings, doodle: boolean): string[] {
  switch (tool) {
    case 'willow_leaf':
      return [
        bs.mode === 'erase' ? `剪除 · ${bs.eraseMode === 'wipe' ? '一笔擦除' : '镂空'}` : MODE_LABELS[bs.mode],
        bs.willowMode === 'symmetric' ? '对称双弧' : '单弧成叶',
      ];
    case 'geom_shape':
      return ['刻纸', short(GEOM_SHAPES.find((g) => g.id === (bs.geomShapeType || 'rect'))?.tip ?? '')];
    case 'pen_knife':
    case 'freehand':
      return ['刻纸', short(KNIFE_TIPS.find((k) => k.id === (bs.knifeTipShape || 'round'))?.tip ?? ''), `${bs.stampSize || 26}px`];
    case 'hand_draw': {
      const brush = short(DRAW_BRUSHES.find((b) => b.id === (bs.drawBrushType || 'pencil'))?.tip ?? '');
      return [brush, ...(bs.drawBrushType === 'willow' ? [] : [`${bs.drawSize ?? 6}px`]), doodle ? '涂鸦图层' : '不出纸片边界'];
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
}> = ({ project, activeLayerId, currentTool, brushSettings, selectedLayerIds, selectedItem }) => {
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

  return (
    <div className="px-2.5 py-2 border-t border-(--ui-divider) bg-(--ui-panel) space-y-1.5 shrink-0 text-[11px]">
      <div className="flex items-center gap-1.5 min-w-0">
        {tool && <tool.icon className="w-3.5 h-3.5 shrink-0 text-(--ui-accent)" />}
        <span className="font-medium text-(--ui-strong) shrink-0">{tool?.name}</span>
        {currentTool === 'select' ? (
          <span className="text-(--ui-muted) truncate">
            {selectedItem
              ? `${selectedItem.name} · ${selectedItem.partIds.length} 个部件`
              : selectedLayerIds.length > 0
              ? `${selectedLayerIds.length} 个部件`
              : '未选中'}
          </span>
        ) : (
          detail.map((d) => (
            <span key={d} className="px-1.5 py-0.5 rounded-md bg-(--ui-accent)/20 text-(--ui-text-2) whitespace-nowrap">
              {d}
            </span>
          ))
        )}
      </div>
      {layer ? (
        <div className={`flex items-center gap-1.5 min-w-0 ${blocked ? 'text-(--ui-accent-2)' : 'text-(--ui-text-2)'}`}>
          <span className="w-3 h-3 rounded-sm border border-white/40 shrink-0" style={{ backgroundColor: layer.color }} />
          <span className="font-medium text-(--ui-strong) truncate">{layer.name}</span>
          {group && <span className="text-(--ui-muted) truncate">· {group.name}</span>}
          {item && (
            <span className="flex items-center gap-0.5 text-(--ui-accent-2) truncate">
              <Box className="w-3 h-3 shrink-0" />
              {item.name}
            </span>
          )}
          <span className="flex-1" />
          {doodle && carving && <span className="shrink-0">只能手绘</span>}
          {locked && (
            <span className="flex items-center gap-0.5 shrink-0">
              <Lock className="w-3 h-3" />已锁定
            </span>
          )}
          {hidden && (
            <span className="flex items-center gap-0.5 shrink-0">
              <EyeOff className="w-3 h-3" />已隐藏
            </span>
          )}
        </div>
      ) : (
        <div className="text-(--ui-accent-2)">未选中纸片 · Alt+点击拾取</div>
      )}
    </div>
  );
};
