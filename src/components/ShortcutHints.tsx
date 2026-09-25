/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { ToolType } from '../types/papercut';
import { ACTIONS, Keymap } from '../utils/keymap';

type Mod = 'Ctrl' | 'Shift' | 'Alt' | 'Space';
const MODS: Mod[] = ['Ctrl', 'Shift', 'Alt', 'Space'];

const TOKEN_LABEL: Record<string, string> = {
  Space: '空格',
  Wheel: '滚轮',
  Click: '点击',
  Drag: '拖动',
  MiddleDrag: '中键拖动',
  RightDrag: '右键拖动',
  Escape: 'Esc',
  Backspace: '⌫',
};

interface Hint {
  tokens: string[];
  label: string;
}

/** Gestures the canvas understands that are not remappable key bindings. */
const TOOL_HINTS: Partial<Record<ToolType, Hint[]>> = {
  select: [
    { tokens: ['Shift', '拖动'], label: '水平 / 垂直移动' },
    { tokens: ['Shift', '旋转'], label: '15° 吸附' },
    { tokens: ['Shift', '拖角/边'], label: '临时切换长宽比锁定' },
    { tokens: ['Ctrl', '拖角'], label: '自由变形' },
    { tokens: ['Ctrl', '拖边'], label: '整条边平移' },
    { tokens: ['Shift', '点击'], label: '加选 / 减选' },
    { tokens: ['Shift', '方向键'], label: '微移 10px' },
  ],
};

/**
 * A quiet line under the canvas completing whatever modifier is held: the held keys are drawn
 * solid, the rest of each combination faint.
 */
export const ShortcutHints: React.FC<{ keymap: Keymap; currentTool: ToolType; spaceHeld: boolean }> = ({ keymap, currentTool, spaceHeld }) => {
  const [mods, setMods] = useState<Set<Mod>>(new Set());

  useEffect(() => {
    const sync = (e: KeyboardEvent) => {
      const next = new Set<Mod>();
      if (e.ctrlKey || e.metaKey) next.add('Ctrl');
      if (e.shiftKey) next.add('Shift');
      if (e.altKey) next.add('Alt');
      setMods((prev) => (prev.size === next.size && [...next].every((m) => prev.has(m)) ? prev : next));
    };
    const clear = () => setMods(new Set());
    window.addEventListener('keydown', sync);
    window.addEventListener('keyup', sync);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keydown', sync);
      window.removeEventListener('keyup', sync);
      window.removeEventListener('blur', clear);
    };
  }, []);

  const held = useMemo(() => {
    const h = new Set(mods);
    if (spaceHeld) h.add('Space');
    return h;
  }, [mods, spaceHeld]);

  const hints = useMemo(() => {
    if (held.size === 0) return [];
    const all: Hint[] = [
      ...ACTIONS.flatMap((a) => keymap[a.id].map((b) => ({ tokens: b.split('+'), label: a.label }))),
      ...(TOOL_HINTS[currentTool] ?? []),
    ];
    const seen = new Set<string>();
    return all
      .filter((h) => [...held].every((m) => h.tokens.includes(m)) && h.tokens.length > held.size)
      .filter((h) => {
        const k = h.tokens.join('+') + h.label;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .sort((a, b) => a.tokens.length - b.tokens.length)
      .slice(0, 10);
  }, [held, keymap, currentTool]);

  return (
    <div className="absolute bottom-2 inset-x-0 z-20 flex justify-center pointer-events-none select-none">
      <div className="max-w-[92%] flex items-center gap-x-3.5 gap-y-0.5 flex-wrap justify-center px-2.5 py-1 rounded-lg bg-(--ui-panel)/75 backdrop-blur-sm text-[10px] text-(--ui-text-2)">
        {held.size === 0 ? (
          <span className="opacity-45">
            按住{' '}
            {MODS.map((m, i) => (
              <React.Fragment key={m}>
                {i > 0 && ' · '}
                <span className="font-medium">{TOKEN_LABEL[m] ?? m}</span>
              </React.Fragment>
            ))}{' '}
            查看组合键
          </span>
        ) : hints.length === 0 ? (
          <span className="opacity-60">
            <span className="font-semibold text-(--ui-strong)">{[...held].map((m) => TOKEN_LABEL[m] ?? m).join(' + ')}</span> 没有组合操作
          </span>
        ) : (
          hints.map((h) => (
            <span key={h.tokens.join('+') + h.label} className="whitespace-nowrap">
              {h.tokens.map((t, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <span className="opacity-35">+</span>}
                  <span className={held.has(t as Mod) ? 'font-semibold text-(--ui-strong)' : 'opacity-45'}>{TOKEN_LABEL[t] ?? t}</span>
                </React.Fragment>
              ))}
              <span className="ml-1 opacity-70">{h.label}</span>
            </span>
          ))
        )}
      </div>
    </div>
  );
};
