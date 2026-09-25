/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';

export type ActionId =
  | 'tool.select'
  | 'tool.cut'
  | 'tool.geom'
  | 'tool.knife'
  | 'tool.draw'
  | 'tool.anchor'
  | 'mode.cutout'
  | 'mode.positive'
  | 'mode.erase'
  | 'brush.smaller'
  | 'brush.bigger'
  | 'edit.undo'
  | 'edit.redo'
  | 'edit.delete'
  | 'select.scope'
  | 'select.cancel'
  | 'file.save'
  | 'file.open'
  | 'file.new'
  | 'view.zoomIn'
  | 'view.zoomOut'
  | 'view.zoom100'
  | 'view.fit'
  | 'view.panHold'
  | 'view.zoomWheel'
  | 'view.panWheel'
  | 'view.panDrag'
  | 'layer.pick'
  | 'help.keymap';

export type Keymap = Record<ActionId, string[]>;

export type InputKind = 'key' | 'wheel' | 'drag' | 'click';

export interface ActionMeta {
  id: ActionId;
  label: string;
  group: string;
  kind: InputKind;
}

export const ACTIONS: ActionMeta[] = [
  { id: 'tool.select', label: '选择', group: '工具', kind: 'key' },
  { id: 'tool.cut', label: '剪纸', group: '工具', kind: 'key' },
  { id: 'tool.geom', label: '几何形', group: '工具', kind: 'key' },
  { id: 'tool.knife', label: '笔刀', group: '工具', kind: 'key' },
  { id: 'tool.draw', label: '手绘', group: '工具', kind: 'key' },
  { id: 'tool.anchor', label: '锚点微调', group: '工具', kind: 'key' },
  { id: 'mode.cutout', label: '刻纸', group: '落刀', kind: 'key' },
  { id: 'mode.positive', label: '贴花', group: '落刀', kind: 'key' },
  { id: 'mode.erase', label: '剪除', group: '落刀', kind: 'key' },
  { id: 'brush.smaller', label: '画笔变小', group: '画笔', kind: 'key' },
  { id: 'brush.bigger', label: '画笔变大', group: '画笔', kind: 'key' },
  { id: 'edit.undo', label: '撤销', group: '编辑', kind: 'key' },
  { id: 'edit.redo', label: '重做', group: '编辑', kind: 'key' },
  { id: 'edit.delete', label: '删除选中', group: '编辑', kind: 'key' },
  { id: 'select.scope', label: '切换整物件 / 单部件', group: '编辑', kind: 'key' },
  { id: 'select.cancel', label: '取消选择', group: '编辑', kind: 'key' },
  { id: 'file.save', label: '保存项目', group: '文件', kind: 'key' },
  { id: 'file.open', label: '打开项目', group: '文件', kind: 'key' },
  { id: 'file.new', label: '新建画布', group: '文件', kind: 'key' },
  { id: 'view.zoomIn', label: '放大', group: '视图', kind: 'key' },
  { id: 'view.zoomOut', label: '缩小', group: '视图', kind: 'key' },
  { id: 'view.zoom100', label: '缩放到 100%', group: '视图', kind: 'key' },
  { id: 'view.fit', label: '适应画板', group: '视图', kind: 'key' },
  { id: 'view.panHold', label: '按住平移', group: '视图', kind: 'key' },
  { id: 'view.zoomWheel', label: '滚轮缩放', group: '鼠标', kind: 'wheel' },
  { id: 'view.panWheel', label: '滚轮平移', group: '鼠标', kind: 'wheel' },
  { id: 'view.panDrag', label: '拖动平移', group: '鼠标', kind: 'drag' },
  { id: 'layer.pick', label: '拾取图层', group: '鼠标', kind: 'click' },
  { id: 'help.keymap', label: '快捷键设置', group: '视图', kind: 'key' },
];

export const DEFAULT_KEYMAP: Keymap = {
  'tool.select': ['V'],
  'tool.cut': ['L', '1'],
  'tool.geom': ['G', '2'],
  'tool.knife': ['K', '3'],
  'tool.draw': ['B', '4'],
  'tool.anchor': ['A', '5'],
  'mode.cutout': ['C'],
  'mode.positive': ['P'],
  'mode.erase': ['E'],
  'brush.smaller': ['['],
  'brush.bigger': [']'],
  'edit.undo': ['Ctrl+Z'],
  'edit.redo': ['Ctrl+Shift+Z', 'Ctrl+Y'],
  'edit.delete': ['Delete', 'Backspace'],
  'select.scope': ['Tab'],
  'select.cancel': ['Escape'],
  'file.save': ['Ctrl+S'],
  'file.open': ['Ctrl+O'],
  'file.new': ['Alt+N'],
  'view.zoomIn': ['=', '+'],
  'view.zoomOut': ['-'],
  'view.zoom100': ['0'],
  'view.fit': ['Shift+1', 'Ctrl+0'],
  'view.panHold': ['Space'],
  'view.zoomWheel': ['Ctrl+Wheel'],
  'view.panWheel': ['Wheel'],
  'view.panDrag': ['MiddleDrag', 'Space+Drag'],
  'layer.pick': ['Alt+Click'],
  'help.keymap': ['?'],
};

const STORAGE_KEY = 'weave-keymap';

export function loadKeymap(): Keymap {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Partial<Keymap>;
    return { ...DEFAULT_KEYMAP, ...saved };
  } catch {
    return { ...DEFAULT_KEYMAP };
  }
}

export function saveKeymap(map: Keymap) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

const NAMED: Record<string, string> = {
  ' ': 'Space',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Esc: 'Escape',
};

function modifierPrefix(e: { ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }, withShift: boolean) {
  const mods: string[] = [];
  if (e.ctrlKey || e.metaKey) mods.push('Ctrl');
  if (e.altKey) mods.push('Alt');
  if (withShift && e.shiftKey) mods.push('Shift');
  return mods;
}

/**
 * Canonical combo for a key event. Letters and digits use their physical key so Shift/Alt stay
 * explicit ("Shift+1"); other printable characters use the typed symbol ("?", "+") and treat
 * Shift as part of the symbol.
 */
export function comboFromKeyEvent(e: KeyboardEvent): string | null {
  if (['Control', 'Meta', 'Alt', 'Shift'].includes(e.key)) return null;
  let key: string;
  let withShift = true;
  const code = e.code || '';
  if (/^Key[A-Z]$/.test(code)) key = code.slice(3);
  else if (/^Digit[0-9]$/.test(code)) key = code.slice(5);
  else if (e.key.length === 1) {
    key = e.key === ' ' ? 'Space' : e.key.toUpperCase();
    withShift = e.key === ' ';
  } else key = NAMED[e.key] || e.key;
  return [...modifierPrefix(e, withShift), key].join('+');
}

export function comboFromWheel(e: WheelEvent | React.WheelEvent): string {
  return [...modifierPrefix(e, true), 'Wheel'].join('+');
}

export function comboFromPointer(e: PointerEvent | React.PointerEvent | MouseEvent, spaceHeld: boolean, kind: 'drag' | 'click'): string | null {
  if (kind === 'drag') {
    if (e.button === 1) return 'MiddleDrag';
    if (e.button === 2) return 'RightDrag';
    if (e.button === 0 && spaceHeld) return 'Space+Drag';
    return null;
  }
  if (e.button !== 0) return null;
  const mods = modifierPrefix(e, true);
  return mods.length ? [...mods, 'Click'].join('+') : null;
}

export function actionForKey(map: Keymap, combo: string): ActionId | null {
  for (const a of ACTIONS) {
    if (a.kind === 'key' && map[a.id].includes(combo)) return a.id;
  }
  return null;
}

export function bindingHas(map: Keymap, action: ActionId, combo: string | null): boolean {
  return !!combo && map[action].includes(combo);
}

/** Main key of a hold binding such as "Space". */
export function holdKeys(map: Keymap, action: ActionId): string[] {
  return map[action].map((b) => b.split('+').pop() || b);
}

export function labelForCombo(combo: string): string {
  return combo
    .replace('MiddleDrag', '中键拖动')
    .replace('RightDrag', '右键拖动')
    .replace('Space+Drag', '空格 + 拖动')
    .replace('Wheel', '滚轮')
    .replace('Click', '点击')
    .replace('Space', '空格');
}

/** Which other action already uses this combo (same input kind only). */
export function conflictFor(map: Keymap, action: ActionId, combo: string): ActionId | null {
  const kind = ACTIONS.find((a) => a.id === action)!.kind;
  for (const a of ACTIONS) {
    if (a.id !== action && a.kind === kind && map[a.id].includes(combo)) return a.id;
  }
  return null;
}
