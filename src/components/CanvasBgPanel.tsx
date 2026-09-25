/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Check } from 'lucide-react';
import { CanvasBackground } from '../types/papercut';
import { DEFAULT_CANVAS_BG } from './CanvasBackdrop';

type Display = Extract<CanvasBackground, { kind: 'transparent' }>['display'];

const TRANSPARENT: { id: Display; label: string; swatch: string }[] = [
  { id: 'grid', label: '方格纸', swatch: 'linear-gradient(#E2E7F3 1px, transparent 1px) 0 0 / 6px 6px, linear-gradient(90deg, #E2E7F3 1px, #FAF8F2 1px) 0 0 / 6px 6px' },
  { id: 'light', label: '浅色格', swatch: 'repeating-conic-gradient(#E3E3E3 0 25%, #FFFFFF 0 50%) 0 0 / 8px 8px' },
  { id: 'dark', label: '深色格', swatch: 'repeating-conic-gradient(#3A3A3F 0 25%, #4A4A4F 0 50%) 0 0 / 8px 8px' },
  { id: 'white', label: '白色', swatch: '#FFFFFF' },
  { id: 'black', label: '黑色', swatch: '#000000' },
];

const Tile: React.FC<{ active: boolean; label: string; swatch: string; tip: string; onClick: () => void }> = ({ active, label, swatch, tip, onClick }) => (
  <button onClick={onClick} data-tip={tip} className="flex flex-col items-center gap-1 group">
    <span
      className={`relative w-9 h-9 rounded-lg border-2 transition-colors ${active ? 'border-(--ui-accent)' : 'border-(--ui-border) group-hover:border-(--ui-border-strong)'}`}
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
export const CanvasBgPanel: React.FC<{ value?: CanvasBackground; onChange: (bg: CanvasBackground) => void }> = ({ value = DEFAULT_CANVAS_BG, onChange }) => {
  const solidColor = value.kind === 'solid' ? value.color : '#F7F4EB';
  const isSolid = (c: string) => value.kind === 'solid' && value.color.toUpperCase() === c;
  const custom = value.kind === 'solid' && !isSolid('#FFFFFF') && !isSolid('#000000');
  return (
    <div onClick={(e) => e.stopPropagation()} className="absolute left-full top-0 ml-1 w-[248px] bg-(--ui-panel) border border-(--ui-border-strong) rounded-xl shadow-2xl p-2.5 space-y-2.5">
      <div>
        <div className="text-[10px] text-(--ui-muted) mb-1.5">透明底 · 仅显示，导出透明</div>
        <div className="flex justify-between">
          {TRANSPARENT.map((t) => (
            <Tile
              key={t.id}
              active={value.kind === 'transparent' && value.display === t.id}
              label={t.label}
              swatch={t.swatch}
              tip={`透明底，以${t.label}显示`}
              onClick={() => onChange({ kind: 'transparent', display: t.id })}
            />
          ))}
        </div>
      </div>
      <div className="h-px bg-(--ui-divider)" />
      <div>
        <div className="text-[10px] text-(--ui-muted) mb-1.5">背景色 · 随作品导出</div>
        <div className="flex gap-3">
          <Tile active={isSolid('#FFFFFF')} label="白色" swatch="#FFFFFF" tip="白色背景" onClick={() => onChange({ kind: 'solid', color: '#FFFFFF' })} />
          <Tile active={isSolid('#000000')} label="黑色" swatch="#000000" tip="黑色背景" onClick={() => onChange({ kind: 'solid', color: '#000000' })} />
          <label className="flex flex-col items-center gap-1 cursor-pointer group" data-tip="指定颜色的背景">
            <span
              className={`relative w-9 h-9 rounded-lg border-2 overflow-hidden transition-colors ${custom ? 'border-(--ui-accent)' : 'border-(--ui-border) group-hover:border-(--ui-border-strong)'}`}
              style={{ background: custom ? solidColor : 'conic-gradient(#D8342A, #F2C14E, #2F9E6A, #2E58D6, #8A62D6, #D8342A)' }}
            >
              <input
                type="color"
                value={solidColor}
                onChange={(e) => onChange({ kind: 'solid', color: e.target.value.toUpperCase() })}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </span>
            <span className={`text-[10px] ${custom ? 'text-(--ui-strong)' : 'text-(--ui-muted)'}`}>{custom ? solidColor : '指定色'}</span>
          </label>
        </div>
      </div>
    </div>
  );
};
