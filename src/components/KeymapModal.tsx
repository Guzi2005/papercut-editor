/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { X, Plus, RotateCcw, Keyboard, Mouse } from 'lucide-react';
import {
  ACTIONS,
  ActionId,
  DEFAULT_KEYMAP,
  Keymap,
  comboFromKeyEvent,
  comboFromPointer,
  comboFromWheel,
  conflictFor,
  labelForCombo,
} from '../utils/keymap';

interface KeymapModalProps {
  keymap: Keymap;
  onChange: (map: Keymap) => void;
  onClose: () => void;
}

const GROUPS = Array.from(new Set(ACTIONS.map((a) => a.group)));

const PROMPTS: Record<string, string> = {
  key: '按下新的按键组合…',
  wheel: '按住修饰键并滚动滚轮…',
  drag: '按下中键 / 右键，或按住空格再按左键…',
  click: '按住修饰键并点击…',
};

export const KeymapModal: React.FC<KeymapModalProps> = ({ keymap, onChange, onClose }) => {
  const [recording, setRecording] = useState<ActionId | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const labelOf = (id: ActionId) => ACTIONS.find((a) => a.id === id)!.label;

  const bind = (action: ActionId, combo: string) => {
    const next: Keymap = { ...keymap };
    const clash = conflictFor(keymap, action, combo);
    if (clash) {
      next[clash] = next[clash].filter((b) => b !== combo);
      setNotice(`「${labelForCombo(combo)}」已从「${labelOf(clash)}」移到「${labelOf(action)}」`);
    } else {
      setNotice(null);
    }
    if (!next[action].includes(combo)) next[action] = [...next[action], combo];
    onChange(next);
    setRecording(null);
  };

  // While recording, every input goes to the recorder and never reaches the app shortcuts.
  useEffect(() => {
    if (!recording) return;
    const kind = ACTIONS.find((a) => a.id === recording)!.kind;
    let spaceHeld = false;
    const swallow = (e: Event) => {
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      swallow(e);
      if (e.key === 'Escape' && kind !== 'key') {
        setRecording(null);
        return;
      }
      if (e.code === 'Space') spaceHeld = true;
      if (kind !== 'key') return;
      if (e.key === 'Escape' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        setRecording(null);
        return;
      }
      const combo = comboFromKeyEvent(e);
      if (combo) bind(recording, combo);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceHeld = false;
      swallow(e);
    };
    const onWheel = (e: WheelEvent) => {
      if (kind !== 'wheel') return;
      swallow(e);
      bind(recording, comboFromWheel(e));
    };
    const onPointer = (e: PointerEvent) => {
      if ((e.target as Element).closest?.('[data-keymap-cancel]')) return;
      if (kind !== 'drag' && kind !== 'click') return;
      const combo = comboFromPointer(e, spaceHeld, kind);
      if (!combo) return;
      swallow(e);
      bind(recording, combo);
    };
    const noMenu = (e: MouseEvent) => e.preventDefault();
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('wheel', onWheel, { capture: true, passive: false });
    window.addEventListener('pointerdown', onPointer, true);
    window.addEventListener('contextmenu', noMenu, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('wheel', onWheel, true);
      window.removeEventListener('pointerdown', onPointer, true);
      window.removeEventListener('contextmenu', noMenu, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, keymap]);

  useEffect(() => {
    if (recording) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [recording, onClose]);

  const isDefault = (id: ActionId) => JSON.stringify(keymap[id]) === JSON.stringify(DEFAULT_KEYMAP[id]);

  return (
    <div className="fixed inset-0 z-[900] bg-black/60 flex items-center justify-center p-4" onPointerDown={(e) => e.target === e.currentTarget && !recording && onClose()}>
      <div className="bg-(--ui-panel) border border-(--ui-border-strong) rounded-2xl w-full max-w-3xl max-h-[88dvh] flex flex-col shadow-2xl text-(--ui-text) text-xs">
        <div className="h-12 px-4 flex items-center gap-2 border-b border-(--ui-divider) shrink-0">
          <Keyboard className="w-4 h-4 text-(--ui-accent)" />
          <span className="font-semibold text-(--ui-strong) text-sm">快捷键</span>
          <span className="flex-1" />
          <button
            onClick={() => {
              onChange({ ...DEFAULT_KEYMAP });
              setNotice('已恢复全部默认');
            }}
            data-tip="全部恢复默认"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-(--ui-muted) hover:bg-(--ui-hover) hover:text-(--ui-strong)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-(--ui-muted) hover:bg-(--ui-hover) hover:text-(--ui-strong)">
            <X className="w-4 h-4" />
          </button>
        </div>

        {(notice || recording) && (
          <div className={`px-4 py-2 text-[11px] border-b border-(--ui-divider) ${recording ? 'bg-(--ui-accent)/15 text-(--ui-strong)' : 'text-(--ui-accent-2)'}`}>
            {recording ? (
              <span className="flex items-center gap-2">
                「{labelOf(recording)}」：{PROMPTS[ACTIONS.find((a) => a.id === recording)!.kind]}
                <button data-keymap-cancel onClick={() => setRecording(null)} className="ml-auto underline text-(--ui-muted)">
                  取消
                </button>
              </span>
            ) : (
              notice
            )}
          </div>
        )}

        <div className="overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          {GROUPS.map((g) => (
            <div key={g}>
              <div className="text-[11px] font-semibold text-(--ui-accent-2) mb-1.5 flex items-center gap-1">
                {g === '鼠标' && <Mouse className="w-3 h-3" />}
                {g}
              </div>
              <div className="space-y-1">
                {ACTIONS.filter((a) => a.group === g).map((a) => (
                  <div key={a.id} className={`flex items-center gap-2 rounded-lg px-2 py-1 ${recording === a.id ? 'bg-(--ui-hover)' : ''}`}>
                    <span className="flex-1 text-(--ui-text-2) truncate">{a.label}</span>
                    {keymap[a.id].map((combo) => (
                      <span key={combo} className="group flex items-center gap-1 pl-1.5 pr-0.5 py-0.5 rounded-md bg-(--ui-input) border border-(--ui-border) font-mono text-[10px] text-(--ui-strong)">
                        {labelForCombo(combo)}
                        <button
                          onClick={() => onChange({ ...keymap, [a.id]: keymap[a.id].filter((b) => b !== combo) })}
                          className="w-4 h-4 flex items-center justify-center rounded text-(--ui-faint) hover:text-red-400"
                          data-tip="移除"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                    <button
                      onClick={() => {
                        setNotice(null);
                        setRecording(a.id);
                      }}
                      data-tip="添加绑定"
                      className={`w-6 h-6 flex items-center justify-center rounded-md border ${
                        recording === a.id ? 'border-(--ui-accent) text-(--ui-accent)' : 'border-(--ui-border) text-(--ui-muted) hover:text-(--ui-strong)'
                      }`}
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => onChange({ ...keymap, [a.id]: [...DEFAULT_KEYMAP[a.id]] })}
                      disabled={isDefault(a.id)}
                      data-tip="恢复默认"
                      className="w-6 h-6 flex items-center justify-center rounded-md text-(--ui-faint) hover:text-(--ui-strong) disabled:opacity-0"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
