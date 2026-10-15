import { isVectorTool } from './VectorModes';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { Box, Lasso, PaintBucket, Pipette, RotateCw, CircleDashed, Eraser, Group, Layers, Link2, MousePointerClick, Slice, Unlink2 } from 'lucide-react';
import { BrushSettings, ToolType } from '../types/papercut';
import { DRAW_BRUSHES, GEOM_SHAPES, Glyph, KNIFE_TIPS } from './ToolOptions';
import { TOOLS } from './Toolbar';
import type { PointInfo } from './Canvas';
import { playCrispClick } from '../utils/soundEffects';

interface Entry {
  key: string;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  run: () => void;
  /** Keep the menu open after choosing (toggles). */
  stay?: boolean;
}

interface ToolQuickMenuProps {
  x: number;
  y: number;
  currentTool: ToolType;
  brushSettings: BrushSettings;
  onChangeBrushSettings: (patch: Partial<BrushSettings>) => void;
  onSelectTool: (tool: ToolType) => void;
  selectionScope: 'part' | 'item' | 'color' | 'group';
  onChangeSelectionScope: (scope: 'part' | 'item' | 'color' | 'group') => void;
  selectedCount: number;
  onCreateItemFromSelection: () => void;
  onCaptureStamp?:()=>void;
  canCaptureStamp?:boolean;
  onClose: () => void;
  /** Present when summoned on the canvas: pick the colour there or a layer covering the point. */
  here?: PointInfo;
  onPickColor?: (hex: string) => void;
  onPickLayer?: (layerId: string) => void;
  activeLayerId?: string | null;
}

const shortLabel = (tip: string) => tip.split(/[：·]/)[0].trim();
const icon = (C: React.ComponentType<{ className?: string }>) => <C className="w-3.5 h-3.5" />;

/** The current tool's second-level options, summoned at the pointer with a right click. */
export const ToolQuickMenu: React.FC<ToolQuickMenuProps> = ({
  x,
  y,
  currentTool,
  brushSettings: bs,
  onChangeBrushSettings: set,
  onSelectTool,
  selectionScope,
  onChangeSelectionScope,
  selectedCount,
  onCreateItemFromSelection,
  onClose, onCaptureStamp, canCaptureStamp,
  here,
  onPickColor,
  onPickLayer,
  activeLayerId,
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.left = `${Math.max(8, Math.min(x, window.innerWidth - el.offsetWidth - 8))}px`;
    el.style.top = `${Math.max(8, Math.min(y, window.innerHeight - el.offsetHeight - 8))}px`;
  }, [x, y, currentTool]);

  useEffect(() => {
    const down = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && onClose();
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const t = setTimeout(() => window.addEventListener('pointerdown', down), 0);
    window.addEventListener('keydown', key);
    window.addEventListener('blur', onClose);
    return () => {
      clearTimeout(t);
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('keydown', key);
      window.removeEventListener('blur', onClose);
    };
  }, [onClose]);

  const tool = currentTool === 'freehand' ? 'pen_knife' : currentTool;
  const lock = bs.lockAspect ?? true;
  const sections: { title?: string; entries: Entry[] }[] = [];

  if (isVectorTool(tool)) sections.push({ title: '矢量绘图', entries: [
    { key: 'vector-simple', label: '极简模式 · 锚点微调', icon: icon(MousePointerClick), active: tool === 'anchor_edit', run: () => onSelectTool('anchor_edit') },
    { key: 'vector-precise', label: '精细模式 · 贝塞尔节点', icon: icon(Link2), active: tool === 'vector_edit', run: () => onSelectTool('vector_edit') },
  ] });

  if (tool === 'select') {
    sections.push({
      entries: [
        { key: 'item', label: '整物件选取', icon: icon(Box), active: selectionScope === 'item', run: () => onChangeSelectionScope('item') },
        { key: 'part', label: '单部件选取', icon: icon(MousePointerClick), active: selectionScope === 'part', run: () => onChangeSelectionScope('part') },
        { key: 'group', label: '绘制组选取', icon: icon(Box), active: selectionScope === 'group', run: () => onChangeSelectionScope('group') },
        { key: 'color', label: '色块选取', icon: icon(PaintBucket), active: selectionScope === 'color', run: () => onChangeSelectionScope('color') },
      ],
    });
    sections.push({
      entries: [
        { key: 'lasso', label: '圈选', icon: icon(Lasso), active: !!bs.selectLasso, stay: true, run: () => set({ selectLasso: !bs.selectLasso }) },
        { key: 'lock', label: lock ? '锁定长宽比' : '自由长宽比', icon: icon(lock ? Link2 : Unlink2), active: lock, stay: true, run: () => set({ lockAspect: !lock }) },
        { key: 'capture', label:'收为图章…', icon:icon(Box), disabled:!canCaptureStamp, run:()=>onCaptureStamp?.() },
        { key: 'group', label: '打组为物件', icon: icon(Group), disabled: selectedCount === 0, run: onCreateItemFromSelection },
      ],
    });
  } else if (tool === 'willow_leaf') {
    const wipe = bs.eraseMode === 'wipe';
    sections.push({
      title: '落刀',
      entries: [
        { key: 'cutout', label: '刻纸', icon: icon(CircleDashed), active: bs.mode === 'cutout', run: () => set({ mode: 'cutout' }) },
        { key: 'positive', label: '贴花', icon: icon(Layers), active: bs.mode === 'positive', run: () => set({ mode: 'positive' }) },
        { key: 'hole', label: '剪除 · 镂空', icon: icon(Slice), active: bs.mode === 'erase' && !wipe, run: () => set({ mode: 'erase', eraseMode: 'hole' }) },
        { key: 'wipe', label: '剪除 · 一笔擦除', icon: icon(Eraser), active: bs.mode === 'erase' && wipe, run: () => set({ mode: 'erase', eraseMode: 'wipe' }) },
      ],
    });
    sections.push({
      title: '成型',
      entries: [
        { key: 'chord', label: '单弧成叶', icon: <Glyph d="M2 12Q8 1 14 12z" />, active: (bs.willowMode || 'chord') === 'chord', run: () => set({ willowMode: 'chord' }) },
        { key: 'sym', label: '对称双弧', icon: <Glyph d="M2 8Q8 1 14 8Q8 15 2 8z" />, active: bs.willowMode === 'symmetric', run: () => set({ willowMode: 'symmetric' }) },
      ],
    });
  } else if (tool === 'geom_shape') {
    sections.push({
      entries: GEOM_SHAPES.map((g) => ({
        key: g.id,
        label: shortLabel(g.tip),
        icon: icon(g.icon),
        active: (bs.geomShapeType || 'rect') === g.id,
        run: () => set({ geomShapeType: g.id }),
      })),
    });
  } else if (tool === 'pen_knife') {
    sections.push({
      entries: KNIFE_TIPS.map((t) => ({
        key: t.id,
        label: shortLabel(t.tip),
        icon: t.icon,
        active: (bs.knifeTipShape || 'round') === t.id,
        run: () => set({ knifeTipShape: t.id }),
      })),
    });
    if (['flat', 'chisel'].includes(bs.knifeTipShape || 'round')) {
      sections.push({
        title: '刀头角度',
        entries: [
          { key: 'fixed', label: `固定 ${bs.knifeAngle ?? 0}°`, icon: <Glyph d="M3 8h10" />, active: !bs.knifeFollow, run: () => set({ knifeFollow: false }) },
          { key: 'follow', label: '随笔画旋转', icon: icon(RotateCw), active: !!bs.knifeFollow, run: () => set({ knifeFollow: true }) },
        ],
      });
    }
  } else if (tool === 'hand_draw') {
    sections.push({
      entries: DRAW_BRUSHES.map((b) => ({
        key: b.id,
        label: shortLabel(b.tip),
        icon: icon(b.icon),
        active: (bs.drawBrushType || 'pencil') === b.id,
        run: () => set({ drawBrushType: b.id }),
      })),
    });
  }

  const choose = (e: Entry) => {
    if (e.disabled) return;
    playCrispClick();
    e.run();
    if (!e.stay) onClose();
  };

  return (
    <div
      ref={ref}
      onContextMenu={(e) => e.preventDefault()}
      className="fixed z-[60] min-w-[168px] py-1 rounded-xl bg-(--ui-panel)/97 border border-(--ui-border-strong) shadow-2xl backdrop-blur-md text-xs text-(--ui-text-2) select-none"
      style={{ left: x, top: y }}
    >
      {/* 一级工具：随手切换 */}
      <div className="flex items-center gap-0.5 px-1 pb-1 mb-1 border-b border-(--ui-divider)">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            aria-label={t.name}
            onClick={() => {
              playCrispClick();
              onSelectTool(t.id);
            }}
            data-tip={t.name}
            className={`flex-1 h-7 flex items-center justify-center rounded-lg transition-colors ${
              t.id === tool || (t.id === 'vector_edit' && tool === 'anchor_edit') ? 'bg-(--ui-accent) text-white' : 'text-(--ui-muted) hover:bg-(--ui-hover) hover:text-(--ui-strong)'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
          </button>
        ))}
      </div>
      {here && (here.color || here.layers.length > 0) && (
        <div className="mb-1 pb-1 border-b border-(--ui-divider)">
          {here.color && (
            <button
              onClick={() => {
                playCrispClick();
                onPickColor?.(here.color!);
                onClose();
              }}
              className="w-full px-3 h-7 flex items-center gap-2 text-left hover:bg-(--ui-hover) hover:text-(--ui-strong)"
            >
              <Pipette className="w-3.5 h-3.5 text-(--ui-muted)" />
              <span className="flex-1">取色</span>
              <span className="w-3.5 h-3.5 rounded-[4px] border border-white/30" style={{ backgroundColor: here.color }} />
              <span className="font-mono text-[10px] text-(--ui-muted)">{here.color.toUpperCase()}</span>
            </button>
          )}
          {here.layers.length > 0 && <div className="px-3 pt-0.5 pb-0.5 text-[10px] text-(--ui-faint)">此处的图层</div>}
          <div className="max-h-44 overflow-y-auto">
            {here.layers.map((l) => (
              <button
                key={l.id}
                onClick={() => {
                  playCrispClick();
                  onPickLayer?.(l.id);
                  onClose();
                }}
                className={`w-full px-3 h-7 flex items-center gap-2 text-left transition-colors ${
                  l.id === activeLayerId ? 'text-(--ui-strong) bg-(--ui-accent)/20' : 'hover:bg-(--ui-hover) hover:text-(--ui-strong)'
                }`}
              >
                <span className="w-3 h-3 rounded-[3px] border border-white/30 shrink-0" style={{ backgroundColor: l.color }} />
                <span className="flex-1 truncate">{l.name}</span>
                {l.id === activeLayerId && <span className="w-1.5 h-1.5 rounded-full bg-(--ui-accent-2)" />}
              </button>
            ))}
          </div>
        </div>
      )}
      {sections.length === 0 && <div className="px-3 py-1.5 text-[11px] text-(--ui-faint)">这个工具没有可切换的选项</div>}
      {sections.map((sec, i) => (
        <div key={i} className={i > 0 ? 'mt-1 pt-1 border-t border-(--ui-divider)' : ''}>
          {sec.title && <div className="px-3 pt-0.5 pb-0.5 text-[10px] text-(--ui-faint)">{sec.title}</div>}
          {sec.entries.map((e) => (
            <button
              key={e.key}
              onClick={() => choose(e)}
              disabled={e.disabled}
              className={`w-full px-3 h-7 flex items-center gap-2 text-left transition-colors disabled:opacity-35 ${
                e.active ? 'text-(--ui-strong) bg-(--ui-accent)/20' : 'hover:bg-(--ui-hover) hover:text-(--ui-strong)'
              }`}
            >
              <span className={`w-4 flex justify-center ${e.active ? 'text-(--ui-accent-2)' : 'text-(--ui-muted)'}`}>{e.icon}</span>
              <span className="flex-1">{e.label}</span>
              {e.active && <span className="w-1.5 h-1.5 rounded-full bg-(--ui-accent-2)" />}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
};
