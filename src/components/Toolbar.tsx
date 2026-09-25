/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Feather,
  Shapes,
  PenTool,
  Paintbrush,
  Spline,
  Maximize2,
  MousePointer2,
  Scissors,
  CircleDashed,
  Layers,
  Eraser,
  Keyboard,
  Zap,
} from 'lucide-react';
import { BrushSettings, ToolType } from '../types/papercut';
import { FOLK_PALETTE } from '../utils/presetTemplates';
import { ActionId, Keymap, labelForCombo } from '../utils/keymap';

const TOOL_ACTIONS: Partial<Record<ToolType, ActionId>> = {
  select: 'tool.select',
  willow_leaf: 'tool.cut',
  geom_shape: 'tool.geom',
  pen_knife: 'tool.knife',
  hand_draw: 'tool.draw',
  anchor_edit: 'tool.anchor',
};
const MODE_ACTIONS: Record<string, ActionId> = { cutout: 'mode.cutout', positive: 'mode.positive', erase: 'mode.erase' };

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
  pressure: boolean;
  onTogglePressure: () => void;
  brushColor: string;
  onChangeBrushColor: (hex: string) => void;
  recentBrushColors: string[];
  keymap: Keymap;
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
    description: '移动、缩放、旋转纸片或物件',
    icon: MousePointer2,
  },
  {
    id: 'willow_leaf',
    name: '剪纸',
    shortName: '剪纸',
    hotkey: 'L',
    description: '按运笔弧度实时剪出叶形',
    icon: Scissors,
  },
  {
    id: 'geom_shape',
    name: '几何形',
    shortName: '几何',
    hotkey: 'G',
    description: '矩形、圆、三角、星、菱形、折线',
    icon: Shapes,
  },
  {
    id: 'pen_knife',
    name: '笔刀',
    shortName: '笔刀',
    hotkey: 'K',
    description: '可调刀头与压感的刻刀',
    icon: PenTool,
  },
  {
    id: 'hand_draw',
    name: '手绘',
    shortName: '手绘',
    hotkey: 'B',
    description: '铅笔、钢笔、喷枪，不出纸片边界',
    icon: Paintbrush,
  },
  {
    id: 'anchor_edit',
    name: '锚点微调',
    shortName: '锚点',
    hotkey: 'A',
    description: '拖动切口锚点调整轮廓',
    icon: Spline,
  },
];

const CARVE_MODES: { id: BrushSettings['mode']; label: string; hotkey: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'cutout', label: '刻纸', hotkey: 'C', icon: CircleDashed },
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
  pressure,
  onTogglePressure,
  brushColor,
  onChangeBrushColor,
  recentBrushColors,
  keymap,
}) => {
  const keyHint = (action?: ActionId) => {
    const b = action ? keymap[action][0] : undefined;
    return b ? `（${labelForCombo(b)}）` : '';
  };
  const carving = CARVING_TOOLS.includes(currentTool);
  const [showColors, setShowColors] = useState(false);
  const colorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showColors) return;
    const close = (e: PointerEvent) => {
      if (!colorRef.current?.contains(e.target as Node)) setShowColors(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [showColors]);

  return (
    <aside className="relative z-30 w-14 flex flex-col items-center py-2 bg-(--ui-panel) text-(--ui-text) border-r border-(--ui-border) shrink-0 z-20 select-none justify-between">
      <div className="flex flex-col items-center gap-1.5 w-full px-2">
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
              data-tip={`${tool.name}${keyHint(TOOL_ACTIONS[tool.id])} · ${tool.description}`}
              data-tip-side="right"
              className={`relative group w-11 h-10 flex items-center justify-center rounded-xl transition-all ${
                isActive
                  ? 'bg-(--ui-accent) text-white shadow-lg shadow-blue-950/70 border border-(--ui-text-2)/60 font-semibold'
                  : 'bg-(--ui-raised) text-(--ui-text-2) border border-(--ui-border) hover:bg-(--ui-hover) hover:text-(--ui-strong) hover:border-(--ui-border-strong)'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-(--ui-text-2)'}`} />
            </button>
          );
        })}

        {/* 刻纸 / 贴花 / 剪除：决定剪纸、几何、笔刀的落刀效果 */}
        <div className="w-full mt-1 pt-1.5 border-t border-(--ui-divider) flex flex-col items-center gap-1" data-tip="落刀模式">
          {CARVE_MODES.map((mode) => {
            const isActive = carveMode === mode.id;
            const Icon = mode.icon;
            return (
              <button
                key={mode.id}
                onClick={() => onChangeCarveMode(mode.id)}
                data-tip={`${mode.label}${keyHint(MODE_ACTIONS[mode.id])}`}
                data-tip-side="right"
                className={`w-11 h-8 flex items-center justify-center rounded-lg text-[10px] transition-all ${
                  isActive
                    ? carving
                      ? 'bg-(--ui-accent-2) text-[#1B1626] font-semibold'
                      : 'bg-(--ui-accent-2)/25 text-(--ui-accent-2) font-semibold'
                    : 'text-(--ui-muted) hover:bg-(--ui-hover) hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col items-center gap-0.5 w-full px-2 pt-2">
        <div className="relative mb-1" ref={colorRef}>
          <button
            onClick={() => setShowColors((v) => !v)}
            data-tip="画笔颜色：手绘笔触与贴花纸片"
            data-tip-side="right"
            className="w-8 h-8 rounded-full border-2 border-(--ui-strong)/80 shadow-md hover:scale-105 transition-transform"
            style={{ backgroundColor: brushColor }}
          />
          {showColors && (
            <div className="absolute left-full bottom-0 ml-3 z-50 w-48 p-2.5 rounded-xl bg-(--ui-panel) border border-(--ui-border-strong) shadow-2xl">
              {recentBrushColors.length > 0 && (
                <div className="flex gap-1.5 pb-2 mb-2 border-b border-(--ui-divider)" data-tip="最近使用">
                  {recentBrushColors.slice(0, 6).map((hex) => (
                    <button
                      key={hex}
                      onClick={() => {
                        onChangeBrushColor(hex);
                        setShowColors(false);
                      }}
                      className="w-6 h-6 rounded-full border border-white/20 hover:scale-110 transition-transform"
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              )}
              <div className="grid grid-cols-6 gap-1.5">
                {FOLK_PALETTE.map((c) => (
                  <button
                    key={c.hex}
                    onClick={() => {
                      onChangeBrushColor(c.hex);
                      setShowColors(false);
                    }}
                    data-tip={c.name}
                    className={`w-6 h-6 rounded-full border transition-transform hover:scale-110 ${
                      c.hex.toLowerCase() === brushColor.toLowerCase() ? 'border-(--ui-strong) ring-2 ring-(--ui-accent)' : 'border-white/20'
                    }`}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
              <label className="mt-2 flex items-center gap-2 text-[10px] text-(--ui-muted) cursor-pointer">
                <span className="relative w-6 h-6 rounded-full overflow-hidden border border-(--ui-border-strong)" style={{ background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }}>
                  <input
                    type="color"
                    value={brushColor}
                    onChange={(e) => onChangeBrushColor(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </span>
                <span className="ml-auto font-mono text-(--ui-text)">{brushColor.toUpperCase()}</span>
              </label>
            </div>
          )}
        </div>
        <button
          onClick={onTogglePressure}
          data-tip={`压感：${pressure ? '开' : '关'}（笔刀宽度与手绘粗细）`}
          data-tip-side="right"
          className={`w-8 h-8 mb-1 flex items-center justify-center rounded-full transition-colors ${
            pressure ? 'bg-(--ui-accent) text-white' : 'text-(--ui-faint) hover:text-(--ui-strong) hover:bg-(--ui-hover)'
          }`}
        >
          <Zap className="w-4 h-4" />
        </button>
        {onUndo && (
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`w-8 h-8 flex items-center justify-center rounded-full transition-all ${
              canUndo
                ? 'text-(--ui-text-2) hover:text-(--ui-strong) hover:bg-(--ui-hover) cursor-pointer'
                : 'text-(--ui-faint) cursor-not-allowed opacity-40'
            }`}
            data-tip="撤销 (Ctrl+Z)" data-tip-side="right"
          >
            <CuteLinearUndo className="w-4.5 h-4.5" />
          </button>
        )}
        {onRedo && (
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={`w-8 h-8 flex items-center justify-center rounded-full transition-all ${
              canRedo
                ? 'text-(--ui-text-2) hover:text-(--ui-strong) hover:bg-(--ui-hover) cursor-pointer'
                : 'text-(--ui-faint) cursor-not-allowed opacity-40'
            }`}
            data-tip="重做 (Ctrl+Shift+Z)" data-tip-side="right"
          >
            <CuteLinearRedo className="w-4.5 h-4.5" />
          </button>
        )}
        {onFitZoom && (
          <button
            onClick={onFitZoom}
            className="w-8 h-8 flex items-center justify-center rounded-full text-(--ui-muted) hover:text-(--ui-strong) hover:bg-(--ui-hover) transition-all cursor-pointer"
            data-tip="适应画板" data-tip-side="right"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        )}
        {onShowShortcuts && (
          <button
            onClick={onShowShortcuts}
            className="w-8 h-8 flex items-center justify-center rounded-full text-(--ui-muted) hover:text-(--ui-strong) hover:bg-(--ui-hover) transition-all cursor-pointer"
            data-tip="快捷键 (?)" data-tip-side="right"
          >
            <Keyboard className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  );
};
