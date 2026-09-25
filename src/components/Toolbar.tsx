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
} from 'lucide-react';
import { ToolType } from '../types/papercut';

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
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onFitZoom?: () => void;
}

interface ToolDefinition {
  id: ToolType;
  name: string;
  shortName: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TOOLS: ToolDefinition[] = [
  {
    id: 'willow_leaf',
    name: '柳叶笔',
    shortName: '柳叶',
    description: '核心笔刷：两端极锐，零预设直径，由运笔弧度实时闭合成叶 (画世界/HiPaint)',
    icon: Feather,
  },
  {
    id: 'geom_shape',
    name: '几何形',
    shortName: '几何',
    description: '基础几何：矩形、圆形、正三角、五角星与菱形切口',
    icon: Shapes,
  },
  {
    id: 'pen_knife',
    name: '笔刀',
    shortName: '笔刀',
    description: '工坊雕刻笔刀：支持压感动态切口宽度、不同刀头笔尖选择',
    icon: PenTool,
  },
  {
    id: 'hand_draw',
    name: '手绘',
    shortName: '手绘',
    description: '附属于剪纸图层的图层蒙版手绘：铅笔(SAI五档软硬)、钢笔、喷枪晕染',
    icon: Paintbrush,
  },
  {
    id: 'anchor_edit',
    name: '锚点微调',
    shortName: '锚点',
    description: '点击并拖动切口控制锚点，自由调整微调曲线轮廓',
    icon: Spline,
  },
];

export const Toolbar: React.FC<ToolbarProps> = ({
  currentTool,
  onSelectTool,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  onFitZoom,
}) => {
  return (
    <aside className="w-16 sm:w-18 flex flex-col items-center py-3 bg-[#161B29] text-[#CAD0DB] border-r border-[#2B364D] shrink-0 z-20 select-none justify-between">
      {/* Top: Folk Banner Emblem */}
      <div className="flex flex-col items-center gap-1.5 w-full px-2">
        <div
          className="flex items-center gap-0.5 text-[#2652D0] py-0.5 select-none"
          title="针脚与远方 · 蓝印花布三菱纹"
        >
          <span className="text-[9px] text-[#2652D0] font-black">❖</span>
          <span className="text-[10px] text-[#BAC5EB] font-black">❖</span>
          <span className="text-[9px] text-[#2652D0] font-black">❖</span>
        </div>

        {/* Vertical Stamp Icons Column */}
        <div className="flex flex-col items-center gap-2.5 w-full">
          {TOOLS.map((tool) => {
            const isActive =
              currentTool === tool.id ||
              (tool.id === 'pen_knife' && currentTool === 'freehand');
            const Icon = tool.icon;

            return (
              <button
                key={tool.id}
                onClick={() => {
                  if (isActive && tool.id === 'anchor_edit') {
                    onSelectTool('geom_shape');
                  } else {
                    onSelectTool(tool.id);
                  }
                }}
                title={`${tool.name}：${tool.description}${isActive && tool.id === 'anchor_edit' ? ' (点击退出)' : ''}`}
                className={`relative group w-12 h-12 sm:w-13 sm:h-13 flex flex-col items-center justify-center rounded-xl transition-all ${
                  isActive
                    ? 'bg-[#2652D0] text-white shadow-lg shadow-blue-950/70 border border-[#BAC5EB]/60 font-semibold scale-102'
                    : 'bg-[#1E2538] text-[#BAC5EB] border border-[#2F3A54] hover:bg-[#28324A] hover:text-[#FBFBFC] hover:border-[#4B5A82]'
                }`}
              >
                {/* Traditional Stamp Corner Notches */}
                <div
                  className={`absolute inset-0.5 rounded-[10px] pointer-events-none border ${
                    isActive ? 'border-[#BAC5EB]/40' : 'border-transparent group-hover:border-[#3E4D70]/40'
                  }`}
                />

                <Icon className={`w-4 h-4 sm:w-5 sm:h-5 mb-0.5 ${isActive ? 'text-white' : 'text-[#BAC5EB]'}`} />
                <span className={`text-[10px] leading-none tracking-tight font-medium ${isActive ? 'text-white' : 'text-[#9DAED6]'}`}>
                  {tool.shortName}
                </span>

                {/* Tooltip on hover */}
                <div className="hidden sm:block absolute left-full ml-3 px-3 py-2 bg-[#121622]/95 backdrop-blur-md text-[#FBFBFC] text-xs rounded-xl shadow-2xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap border border-[#3A4766]">
                  <div className="font-semibold text-[#BAC5EB] flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2652D0]" />
                    <span>{tool.name}</span>
                  </div>
                  <div className="text-[11px] text-[#8E9FCA] mt-0.5 max-w-xs whitespace-normal">
                    {tool.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Center Divider: 3-diamond pattern */}
      <div className="my-1.5 flex items-center gap-1 text-[#2B3852]">
        <span className="text-[8px]">❖</span>
      </div>

      {/* Bottom: Cute Linear Undo / Redo (无描边、可爱线性、只在左下角) */}
      <div className="flex flex-col items-center gap-2 w-full px-2">
        {onUndo && (
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`w-9 h-9 flex items-center justify-center rounded-full transition-all border-none ${
              canUndo
                ? 'text-[#BAC5EB] hover:text-[#FBFBFC] hover:bg-[#232D42] hover:scale-115 active:scale-90 cursor-pointer'
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
            className={`w-9 h-9 flex items-center justify-center rounded-full transition-all border-none ${
              canRedo
                ? 'text-[#BAC5EB] hover:text-[#FBFBFC] hover:bg-[#232D42] hover:scale-115 active:scale-90 cursor-pointer'
                : 'text-[#3E4A66] cursor-not-allowed opacity-40'
            }`}
            title="重做 (Ctrl+Y)"
          >
            <CuteLinearRedo className="w-4.5 h-4.5" />
          </button>
        )}

        {onFitZoom && (
          <button
            onClick={onFitZoom}
            className="w-9 h-9 flex items-center justify-center rounded-full text-[#8E9FCA] hover:text-[#FBFBFC] hover:bg-[#232D42] hover:scale-110 transition-all border-none mt-0.5 cursor-pointer"
            title="自适应画板全屏"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Bottom Decorative Motif */}
        <div className="pt-0.5 text-[#2652D0] select-none text-[10px]">
          ❖
        </div>
      </div>
    </aside>
  );
};
