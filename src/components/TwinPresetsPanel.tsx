/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { TwinPreset, TwinPart, DEFAULT_TWIN_PRESETS } from '../utils/twinPresets';
import { newId } from '../utils/projectOps';

const blankPart = (): TwinPart => ({ suffix: '片', place: 'above' });

/** Settings flyout: edit twin-layer presets (name, parts, above/below). */
export const TwinPresetsPanel: React.FC<{
  value: TwinPreset[];
  onChange: (next: TwinPreset[]) => void;
}> = ({ value, onChange }) => {
  const update = (id: string, patch: Partial<TwinPreset>) =>
    onChange(value.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const updatePart = (id: string, index: number, patch: Partial<TwinPart>) =>
    onChange(
      value.map((p) => {
        if (p.id !== id) return p;
        const parts = p.parts.map((part, i) => (i === index ? { ...part, ...patch } : part));
        return { ...p, parts };
      })
    );

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="absolute left-full top-0 ml-1 w-64 bg-(--ui-panel) border border-(--ui-border-strong) rounded-xl shadow-2xl p-2.5 space-y-2 max-h-[70vh] overflow-y-auto"
    >
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[10px] text-(--ui-muted)">孪生图层预设</span>
        <button
          onClick={() => onChange(DEFAULT_TWIN_PRESETS)}
          className="text-[10px] text-(--ui-faint) hover:text-(--ui-accent-2)"
          data-tip="恢复默认：头发、帽子"
        >
          恢复默认
        </button>
      </div>
      {value.map((preset) => (
        <div key={preset.id} className="rounded-lg border border-(--ui-border) bg-(--ui-raised) p-2 space-y-1.5">
          <div className="flex items-center gap-1">
            <input
              value={preset.name}
              onChange={(e) => update(preset.id, { name: e.target.value })}
              className="flex-1 h-6 px-1.5 rounded-md bg-(--ui-input) border border-(--ui-border) text-[11px] text-(--ui-strong) outline-none focus:border-(--ui-accent)"
              data-tip="预设名称"
            />
            <button
              onClick={() => onChange(value.filter((p) => p.id !== preset.id))}
              className="p-1 rounded-md text-(--ui-faint) hover:text-red-400 hover:bg-red-950/40"
              data-tip="删除此预设"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
          {preset.parts.map((part, i) => (
            <div key={i} className="flex items-center gap-1">
              <input
                value={part.suffix}
                onChange={(e) => updatePart(preset.id, i, { suffix: e.target.value })}
                className="flex-1 h-6 px-1.5 rounded-md bg-(--ui-input) border border-(--ui-border) text-[11px] text-(--ui-strong) outline-none focus:border-(--ui-accent)"
                data-tip="图层名后缀"
              />
              <button
                onClick={() => updatePart(preset.id, i, { place: part.place === 'above' ? 'below' : 'above' })}
                className={`h-6 px-1.5 rounded-md border text-[10px] flex items-center gap-0.5 ${
                  part.place === 'above'
                    ? 'border-(--ui-accent)/50 text-(--ui-accent-2) bg-(--ui-accent)/10'
                    : 'border-(--ui-border) text-(--ui-muted)'
                }`}
                data-tip={part.place === 'above' ? '插在当前层上方' : '插在当前层下方'}
              >
                {part.place === 'above' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                {part.place === 'above' ? '上' : '下'}
              </button>
              <button
                onClick={() =>
                  update(
                    preset.id,
                    { parts: preset.parts.filter((_, j) => j !== i) }
                  )
                }
                disabled={preset.parts.length <= 1}
                className="p-1 rounded-md text-(--ui-faint) hover:text-red-400 disabled:opacity-30"
                data-tip="删除此片"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
          <button
            onClick={() => update(preset.id, { parts: [...preset.parts, blankPart()] })}
            className="w-full h-6 rounded-md text-[10px] text-(--ui-muted) hover:bg-(--ui-hover) hover:text-(--ui-strong) flex items-center justify-center gap-1"
          >
            <Plus className="w-3 h-3" />
            添加片
          </button>
        </div>
      ))}
      <button
        onClick={() =>
          onChange([
            ...value,
            { id: newId('twin'), name: '新预设', parts: [blankPart(), { suffix: '后', place: 'below' }] },
          ])
        }
        className="w-full h-7 rounded-lg border border-dashed border-(--ui-border) text-[11px] text-(--ui-muted) hover:border-(--ui-accent) hover:text-(--ui-strong) flex items-center justify-center gap-1"
      >
        <Plus className="w-3.5 h-3.5" />
        新建预设
      </button>
    </div>
  );
};
