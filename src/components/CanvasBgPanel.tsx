/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Check } from 'lucide-react';
import { CanvasBackground } from '../types/papercut';
import {
  DEFAULT_CANVAS_BG,
  DEFAULT_GRID_COLOR,
  DEFAULT_GRID_LINE,
  DEFAULT_GRID_SIZE,
} from './CanvasBackdrop';
import { WheelNumber } from './WheelNumber';

type Display = Extract<CanvasBackground, { kind: 'transparent' }>['display'];

const TRANSPARENT: { id: Display; label: string; swatch: string }[] = [
  {
    id: 'none',
    label: '无背景',
    swatch: 'linear-gradient(135deg, #2a3144 25%, transparent 25%) 0 0 / 8px 8px, linear-gradient(135deg, transparent 75%, #2a3144 75%) 0 0 / 8px 8px, #1a2030',
  },
  {
    id: 'grid',
    label: '方格纸',
    swatch:
      'linear-gradient(#E2E7F3 1px, transparent 1px) 0 0 / 6px 6px, linear-gradient(90deg, #E2E7F3 1px, #FAF8F2 1px) 0 0 / 6px 6px',
  },
  { id: 'light', label: '浅色格', swatch: 'repeating-conic-gradient(#E3E3E3 0 25%, #FFFFFF 0 50%) 0 0 / 8px 8px' },
  { id: 'dark', label: '深色格', swatch: 'repeating-conic-gradient(#3A3A3F 0 25%, #4A4A4F 0 50%) 0 0 / 8px 8px' },
  { id: 'white', label: '白色', swatch: '#FFFFFF' },
  { id: 'black', label: '黑色', swatch: '#000000' },
];

const Tile: React.FC<{ active: boolean; label: string; swatch: string; tip: string; onClick: () => void }> = ({
  active,
  label,
  swatch,
  tip,
  onClick,
}) => (
  <button onClick={onClick} data-tip={tip} className="flex flex-col items-center gap-1 group">
    <span
      className={`relative w-8 h-8 rounded-lg border-2 transition-colors ${active ? 'border-(--ui-accent)' : 'border-(--ui-border) group-hover:border-(--ui-border-strong)'}`}
      style={{ background: swatch }}
    >
      {active && (
        <span className="absolute -right-1 -top-1 w-3.5 h-3.5 rounded-full bg-(--ui-accent) flex items-center justify-center">
          <Check className="w-2.5 h-2.5 text-white" />
        </span>
      )}
    </span>
    <span className={`text-[10px] ${active ? 'text-(--ui-strong)' : 'text-(--ui-muted)'}`}>{label}</span>
  </button>
);

/** Canvas background choices in the manner of SAI2's canvas menu. */
export const CanvasBgPanel: React.FC<{ value?: CanvasBackground; onChange: (bg: CanvasBackground) => void }> = ({
  value = DEFAULT_CANVAS_BG,
  onChange: commitChange,
}) => {
  const onChange = (bg: CanvasBackground) => commitChange({...bg,texture:value.texture});
  const solidColor = value.kind === 'solid' ? value.color : '#F7F4EB';
  const isSolid = (c: string) => value.kind === 'solid' && value.color.toUpperCase() === c;
  const custom = value.kind === 'solid' && !isSolid('#FFFFFF') && !isSolid('#000000');
  const isGrid = value.kind === 'transparent' && value.display === 'grid';
  const gridColor = isGrid ? value.gridColor ?? DEFAULT_GRID_COLOR : DEFAULT_GRID_COLOR;
  const gridLine = isGrid ? value.gridLine ?? DEFAULT_GRID_LINE : DEFAULT_GRID_LINE;
  const gridSize = isGrid ? value.gridSize ?? DEFAULT_GRID_SIZE : DEFAULT_GRID_SIZE;

  const setGrid = (patch: Partial<{ gridColor: string; gridLine: number; gridSize: number }>) => {
    onChange({
      kind: 'transparent',
      display: 'grid',
      gridColor: patch.gridColor ?? gridColor,
      gridLine: patch.gridLine ?? gridLine,
      gridSize: patch.gridSize ?? gridSize,
    });
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="absolute left-full top-0 ml-1 w-[280px] bg-(--ui-panel) border border-(--ui-border-strong) rounded-xl shadow-2xl p-2.5 space-y-2.5"
    >
      <div>
        <div className="text-[10px] text-(--ui-muted) mb-1.5">透明底 · 仅显示，导出透明</div>
        <div className="grid grid-cols-6 gap-1">
          {TRANSPARENT.map((t) => (
            <Tile
              key={t.id}
              active={value.kind === 'transparent' && value.display === t.id}
              label={t.label}
              swatch={t.swatch}
              tip={t.id === 'none' ? '无背景，露出工作区底色' : `透明底，以${t.label}显示`}
              onClick={() => {
                if (t.id === 'grid') {
                  setGrid({});
                } else {
                  onChange({ kind: 'transparent', display: t.id });
                }
              }}
            />
          ))}
        </div>
        {isGrid && (
          <div className="mt-2 p-2 rounded-lg bg-(--ui-raised) border border-(--ui-border) space-y-1.5">
            <div className="text-[10px] text-(--ui-muted)">方格纸参数</div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <label
                className="relative w-7 h-7 rounded-md border border-(--ui-border) overflow-hidden shrink-0 cursor-pointer"
                data-tip="格线颜色"
                style={{ background: gridColor }}
              >
                <input
                  type="color"
                  value={gridColor}
                  onChange={(e) => setGrid({ gridColor: e.target.value.toUpperCase() })}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </label>
              <WheelNumber
                tip="线粗"
                value={Math.round(gridLine * 10) / 10}
                min={0.3}
                max={3}
                step={0.1}
                format={(v) => `${v}`}
                onChange={(v) => setGrid({ gridLine: v })}
              />
              <WheelNumber
                tip="格子大小"
                value={gridSize}
                min={8}
                max={64}
                step={2}
                format={(v) => `${v}`}
                onChange={(v) => setGrid({ gridSize: v })}
              />
            </div>
          </div>
        )}
      </div>
      <div className="h-px bg-(--ui-divider)" />
      <div>
        <div className="text-[10px] text-(--ui-muted) mb-1.5">背景色 · 随作品导出</div>
        <div className="flex gap-3">
          <Tile active={isSolid('#FFFFFF')} label="白色" swatch="#FFFFFF" tip="白色背景" onClick={() => onChange({ kind: 'solid', color: '#FFFFFF' })} />
          <Tile active={isSolid('#000000')} label="黑色" swatch="#000000" tip="黑色背景" onClick={() => onChange({ kind: 'solid', color: '#000000' })} />
          <label className="flex flex-col items-center gap-1 cursor-pointer group" data-tip="指定颜色的背景">
            <span
              className={`relative w-8 h-8 rounded-lg border-2 overflow-hidden transition-colors ${custom ? 'border-(--ui-accent)' : 'border-(--ui-border) group-hover:border-(--ui-border-strong)'}`}
              style={{
                background: custom
                  ? solidColor
                  : 'conic-gradient(#D8342A, #F2C14E, #2F9E6A, #2E58D6, #8A62D6, #D8342A)',
              }}
            >
              <input
                type="color"
                value={solidColor}
                onChange={(e) => onChange({ kind: 'solid', color: e.target.value.toUpperCase() })}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </span>
            <span className={`text-[10px] ${custom ? 'text-(--ui-strong)' : 'text-(--ui-muted)'}`}>
              {custom ? solidColor : '指定色'}
            </span>
          </label>
        </div>
      </div>
    </div>
  );
};
