/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Feather,
  Shapes,
  PenTool,
  Paintbrush,
  Spline,
  Maximize2,
  MousePointer2,
  Scissors,
  Layers,
  Eraser,
  Keyboard,
} from 'lucide-react';
import { BrushSettings, ToolType } from '../types/papercut';

/**
 * Cute, artisanal linear undo icon with rounded loop
 */
export const CuteLinearUndo: React.FC<{ className?: string }> = ({
  className = 'w-4 h-4',
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M7 10.5L3 6.5l4-4" />
    <path d="M3 6.5h11a6 6 0 0 1 6 6v0a6 6 0 0 1-6 6H8" />
  </svg>
);

/**
 * Cute, artisanal linear redo icon with rounded loop
 */
export const CuteLinearRedo: React.FC<{ className?: string }> = ({
  className = 'w-4 h-4',
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M17 10.5l4-4-4-4" />
    <path d="M21 6.5H10a6 6 0 0 0-6 6v0a6 6 0 0 0 6 6h6" />
  </svg>
);

interface ToolbarProps {
  currentTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  carveMode: BrushSettings['mode'];
  onChangeCarveMode: (mode: BrushSettings['mode']) => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onFitZoom?: () => void;
  onShowShortcuts?: () => void;
}

interface ToolDefinition {
  id: ToolType;
  name: string;
  shortName: string;
  hotkey: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TOOLS: ToolDefinition[] = [
  {
    id: 'select',
    name: '选择',
    shortName: '选择',
    hotkey: 'V',
    description: '点选纸片或整个物件，拖动移动，角点等比缩放，顶部圆点旋转 (Shift 约束)',
    icon: MousePointer2,
  },
  {
    id: 'willow_leaf',
    name: '柳叶笔',
    shortName: '柳叶',
    hotkey: 'L',
    description: '核心笔刷：两端极锐，零预设直径，由运笔弧度实时闭合成叶',
    icon: Feather,
  },
  {
    id: 'geom_shape',
    name: '几何形',
    shortName: '几何',
    hotkey: 'G',
    description: '基础几何：矩形、圆形、正三角、五角星、菱形与折线',
    icon: Shapes,
  },
  {
    id: 'pen_knife',
    name: '笔刀',
    shortName: '笔刀',
    hotkey: 'K',
    description: '雕刻笔刀：支持压感动态切口宽度、不同刀头笔尖选择',
    icon: PenTool,
  },
  {
    id: 'hand_draw',
    name: '手绘',
    shortName: '手绘',
    hotkey: 'B',
    description: '附属于纸片蒙版的手绘：铅笔(五档软硬)、钢笔、喷枪晕染',
    icon: Paintbrush,
  },
  {
    id: 'anchor_edit',
    name: '锚点微调',
    shortName: '锚点',
    hotkey: 'A',
    description: '点击并拖动切口控制锚点，自由调整曲线轮廓',
    icon: Spline,
  },
];

const CARVE_MODES: { id: BrushSettings['mode']; label: string; hotkey: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'cutout', label: '刻纸', hotkey: 'C', icon: Scissors },
  { id: 'positive', label: '贴花', hotkey: 'P', icon: Layers },
  { id: 'erase', label: '剪除', hotkey: 'E', icon: Eraser },
];

const CARVING_TOOLS: ToolType[] = ['willow_leaf', 'geom_shape', 'pen_knife', 'freehand'];

export const Toolbar: React.FC<ToolbarProps> = ({
  currentTool,
  onSelectTool,
  carveMode,
  onChangeCarveMode,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  onFitZoom,
  onShowShortcuts,
}) => {
  const carving = CARVING_TOOLS.includes(currentTool);

  return (
    <aside className="w-16 flex flex-col items-center py-3 bg-[#161B29] text-[#CAD0DB] border-r border-[#2B364D] shrink-0 z-20 select-none justify-between overflow-y-auto">
      <div className="flex flex-col items-center gap-2 w-full px-2">
        {TOOLS.map((tool) => {
          const isActive =
            currentTool === tool.id || (tool.id === 'pen_knife' && currentTool === 'freehand');
          const Icon = tool.icon;

          return (
            <button
              key={tool.id}
              onClick={() => {
                if (isActive && tool.id === 'anchor_edit') onSelectTool('select');
                else onSelectTool(tool.id);
              }}
              title={`${tool.name} (${tool.hotkey})：${tool.description}`}
              className={`relative group w-12 h-12 flex flex-col items-center justify-center rounded-xl transition-all ${
                isActive
                  ? 'bg-[#2652D0] text-white shadow-lg shadow-blue-950/70 border border-[#BAC5EB]/60 font-semibold'
                  : 'bg-[#1E2538] text-[#BAC5EB] border border-[#2F3A54] hover:bg-[#28324A] hover:text-[#FBFBFC] hover:border-[#4B5A82]'
              }`}
            >
              <Icon className={`w-4.5 h-4.5 mb-0.5 ${isActive ? 'text-white' : 'text-[#BAC5EB]'}`} />
              <span className={`text-[10px] leading-none tracking-tight font-medium ${isActive ? 'text-white' : 'text-[#9DAED6]'}`}>
                {tool.shortName}
              </span>
              <span className={`absolute top-0.5 right-1 text-[8px] font-mono ${isActive ? 'text-white/70' : 'text-[#56658A]'}`}>
                {tool.hotkey}
              </span>
            </button>
          );
        })}

        {/* 刻纸 / 贴花 / 剪除：决定柳叶、几何、笔刀的落刀效果 */}
        <div className="w-full mt-1 pt-2 border-t border-[#263147] flex flex-col items-center gap-1">
          <span className="text-[9px] text-[#5E6E94]">落刀</span>
          {CARVE_MODES.map((mode) => {
            const isActive = carveMode === mode.id;
            const Icon = mode.icon;
            return (
              <button
                key={mode.id}
                onClick={() => onChangeCarveMode(mode.id)}
                title={`${mode.label}模式 (${mode.hotkey})`}
                className={`w-12 h-8 flex items-center justify-center gap-1 rounded-lg text-[10px] transition-all ${
                  isActive
                    ? carving
                      ? 'bg-[#EB8E88] text-[#1B1626] font-semibold'
                      : 'bg-[#EB8E88]/25 text-[#EB8E88] font-semibold'
                    : 'text-[#8E9FCA] hover:bg-[#232D42] hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col items-center gap-1.5 w-full px-2 pt-2">
        {onUndo && (
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`w-9 h-9 flex items-center justify-center rounded-full transition-all ${
              canUndo
                ? 'text-[#BAC5EB] hover:text-[#FBFBFC] hover:bg-[#232D42] cursor-pointer'
                : 'text-[#3E4A66] cursor-not-allowed opacity-40'
            }`}
            title="撤销 (Ctrl+Z)"
          >
            <CuteLinearUndo className="w-4.5 h-4.5" />
          </button>
        )}
        {onRedo && (
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={`w-9 h-9 flex items-center justify-center rounded-full transition-all ${
              canRedo
                ? 'text-[#BAC5EB] hover:text-[#FBFBFC] hover:bg-[#232D42] cursor-pointer'
                : 'text-[#3E4A66] cursor-not-allowed opacity-40'
            }`}
            title="重做 (Ctrl+Shift+Z)"
          >
            <CuteLinearRedo className="w-4.5 h-4.5" />
          </button>
        )}
        {onFitZoom && (
          <button
            onClick={onFitZoom}
            className="w-9 h-9 flex items-center justify-center rounded-full text-[#8E9FCA] hover:text-[#FBFBFC] hover:bg-[#232D42] transition-all cursor-pointer"
            title="适应画板"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        )}
        {onShowShortcuts && (
          <button
            onClick={onShowShortcuts}
            className="w-9 h-9 flex items-center justify-center rounded-full text-[#8E9FCA] hover:text-[#FBFBFC] hover:bg-[#232D42] transition-all cursor-pointer"
            title="快捷键 (?)"
          >
            <Keyboard className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  );
};
