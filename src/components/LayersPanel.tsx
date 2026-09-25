/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Layer,
  LayerGroup,
  LayerPattern,
  PapercutItem,
  PapercutProject,
  PatternType,
  ToolType,
  BrushSettings,
} from '../types/papercut';
import { getPathBoundingBox } from '../utils/bezierMath';
import { renderLayerMarkup } from '../utils/layerSvg';
import { computeDepthTable, findGroupOfLayer, findItemOfLayer } from '../utils/projectOps';
import {
  Plus,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  Copy,
  Folder,
  Check,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Edit2,
  Box,
  Layers as LayersIcon,
  Palette,
  Image as ImageIcon,
  Anchor,
  X,
  MousePointer2,
  FolderPlus,
  Droplet,
  Blend,
  Sparkles,
  Grid3x3,
  RotateCw,
  Maximize,
  ArrowUpDown,
  MoreHorizontal,
  ArrowUp,
  ArrowDown,
  Brush,
} from 'lucide-react';
import { playDiscardSwoosh, playPaperRustle } from '../utils/soundEffects';
import { WheelNumber } from './WheelNumber';
import { ColorStudio } from './ColorStudio';
import { WorkStatus } from './WorkStatus';
import { isLight, layerColors, normalizeHex, projectColors } from '../utils/color';

interface LayersPanelProps {
  project: PapercutProject;
  activeLayerId: string | null;
  selectedLayerIds: string[];
  colorNotes?: Record<string, string>;
  onUpdateColorNote?: (hex: string, note: string) => void;
  onSelectLayer: (layerId: string) => void;
  onUpdateLayer: (layerId: string, updates: Partial<Layer>) => void;
  onAddLayer: (groupId?: string, kind?: 'paper' | 'doodle') => void;
  onDeleteLayer: (layerId: string) => void;
  onDuplicateLayer: (layerId: string) => void;
  onInvertLayerCutouts?: (layerId: string) => void;
  onClearLayerCutouts?: (layerId: string) => void;
  onReorderLayers: (sourceLayerId: string, targetLayerId: string, position?: 'above' | 'below') => void;
  onReorderRoot: (sourceRootId: string, targetRootId: string, position: 'above' | 'below') => void;
  onMoveLayerToGroup: (layerId: string, groupId: string) => void;
  onAddGroup: () => void;
  onUpdateGroup: (groupId: string, updates: Partial<LayerGroup>) => void;
  onDeleteGroup: (groupId: string) => void;
  onCreateItem: () => void;
  onSelectItem: (itemId: string) => void;
  onUpdateItem: (itemId: string, updates: Partial<PapercutItem>) => void;
  onDeleteItem: (itemId: string) => void;
  onAddPartToItem: (itemId: string, layerId: string) => void;
  onRemovePartFromItem: (itemId: string, layerId: string) => void;
  onAddSocket: (itemId: string) => void;
  onUpdateProject: (updates: Partial<PapercutProject>) => void;
  onImportReference: () => void;
  brushColor: string;
  recentColors: string[];
  currentTool: ToolType;
  brushSettings: BrushSettings;
  selectedItem: PapercutItem | null;
  onChangeBrushColor: (hex: string, commit?: boolean) => void;
}

const WIDTH_KEY = 'weave.panelWidth';
const MIN_W = 240;
const maxWidth = () => Math.max(MIN_W, Math.min(640, Math.round(window.innerWidth * 0.5)));

type PanelTab = 'depth' | 'items' | 'style';

const PATTERN_OPTIONS: { id: PatternType | 'none'; label: string }[] = [
  { id: 'none', label: '无' },
  { id: 'diamond', label: '蓝印菱花' },
  { id: 'stripes', label: '条纹' },
  { id: 'checks', label: '格纹' },
  { id: 'dots', label: '圆点' },
  { id: 'argyle', label: '菱格' },
];

const LayerThumb = React.memo(function LayerThumb({ layer, w, h }: { layer: Layer; w: number; h: number }) {
  const { html, viewBox } = useMemo(() => {
    const holes = layer.cutouts.filter((c) => c.isHole).map((c) => c.d);
    const bbox = getPathBoundingBox(
      [
        layer.baseShape.d,
        ...layer.positiveElements.map((e) => e.d),
        ...layer.cutouts.filter((c) => !c.isHole).map((c) => c.d),
        ...holes,
        ...(layer.kind === 'doodle' ? (layer.drawings || []).map((d) => d.d) : []),
      ].filter(Boolean),
      w,
      h
    );
    return {
      html: renderLayerMarkup(layer, { idPrefix: 'th_', shadow: 0, grain: false }),
      viewBox: `${bbox.minX} ${bbox.minY} ${bbox.width} ${bbox.height}`,
    };
  }, [layer, w, h]);
  return (
    <svg viewBox={viewBox} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      <g dangerouslySetInnerHTML={{ __html: html }} />
    </svg>
  );
});

export const LayersPanel: React.FC<LayersPanelProps> = ({
  project,
  activeLayerId,
  selectedLayerIds,
  colorNotes = {},
  onUpdateColorNote,
  onSelectLayer,
  onUpdateLayer,
  onAddLayer,
  onDeleteLayer,
  onDuplicateLayer,
  onInvertLayerCutouts,
  onClearLayerCutouts,
  onReorderLayers,
  onReorderRoot,
  onMoveLayerToGroup,
  onAddGroup,
  onUpdateGroup,
  onDeleteGroup,
  onCreateItem,
  onSelectItem,
  onUpdateItem,
  onDeleteItem,
  onAddPartToItem,
  onRemovePartFromItem,
  onAddSocket,
  onUpdateProject,
  onImportReference,
  brushColor,
  recentColors,
  onChangeBrushColor,
  currentTool,
  brushSettings,
  selectedItem,
}) => {
  const [width, setWidth] = useState(() => {
    const saved = Number(localStorage.getItem(WIDTH_KEY));
    return saved ? Math.min(maxWidth(), Math.max(MIN_W, saved)) : 288;
  });
  const [resizing, setResizing] = useState(false);
  const startResize = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const x0 = e.clientX;
    const w0 = width;
    setResizing(true);
    let w = w0;
    const move = (ev: PointerEvent) => {
      w = Math.min(maxWidth(), Math.max(MIN_W, w0 + (x0 - ev.clientX)));
      setWidth(w);
    };
    const up = () => {
      setResizing(false);
      localStorage.setItem(WIDTH_KEY, String(w));
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };
  const { layers, groups, rootOrder } = project;
  const items = project.items || [];
  const [tab, setTab] = useState<PanelTab>('depth');
  const [editing, setEditing] = useState<{ kind: 'layer' | 'group' | 'item' | 'socket'; id: string; parent?: string } | null>(null);
  const [editingName, setEditingName] = useState('');
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Record<string, boolean>>({});
  const [expandedItemIds, setExpandedItemIds] = useState<Record<string, boolean>>({});
  const [dragging, setDragging] = useState<{ kind: 'layer' | 'root'; id: string } | null>(null);
  const [dropHint, setDropHint] = useState<{ id: string; position: 'above' | 'below' | 'into' } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; layerId: string } | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const listRef = useRef<HTMLDivElement>(null);

  const activeLayer = activeLayerId ? layers[activeLayerId] : null;
  const { zOf, slots } = useMemo(() => computeDepthTable(project), [project]);
  const selectedSet = new Set(selectedLayerIds);

  // Keep the active layer visible in the list: expand its group and scroll to it.
  useEffect(() => {
    if (!activeLayerId) return;
    const grp = findGroupOfLayer(project, activeLayerId);
    if (grp && collapsedGroupIds[grp.id]) {
      setCollapsedGroupIds((prev) => ({ ...prev, [grp.id]: false }));
    }
    const item = findItemOfLayer(project, activeLayerId);
    if (item && tab === 'items') setExpandedItemIds((prev) => ({ ...prev, [item.id]: true }));
    // Scroll only the list: scrollIntoView would also scroll overflow-hidden ancestors and could
    // drag an off-screen drawer into view.
    requestAnimationFrame(() => {
      const row = rowRefs.current[`${tab}:${activeLayerId}`];
      const list = listRef.current;
      if (!row || !list) return;
      const r = row.getBoundingClientRect();
      const l = list.getBoundingClientRect();
      if (r.top < l.top) list.scrollBy({ top: r.top - l.top - 8, behavior: 'smooth' });
      else if (r.bottom > l.bottom) list.scrollBy({ top: r.bottom - l.bottom + 8, behavior: 'smooth' });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLayerId, tab]);

  const startRename = (kind: 'layer' | 'group' | 'item' | 'socket', id: string, current: string, parent?: string) => {
    setEditing({ kind, id, parent });
    setEditingName(current);
  };

  const commitRename = () => {
    if (!editing) return;
    const name = editingName.trim();
    if (name) {
      if (editing.kind === 'layer') onUpdateLayer(editing.id, { name });
      else if (editing.kind === 'group') onUpdateGroup(editing.id, { name });
      else if (editing.kind === 'item') onUpdateItem(editing.id, { name });
      else if (editing.kind === 'socket' && editing.parent) {
        const item = items.find((it) => it.id === editing.parent);
        if (item) {
          onUpdateItem(item.id, {
            sockets: item.sockets.map((s) => (s.id === editing.id ? { ...s, name: name.replace(/\s+/g, '_') } : s)),
          });
        }
      }
    }
    setEditing(null);
  };

  const renameInput = (
    <input
      type="text"
      value={editingName}
      autoFocus
      onChange={(e) => setEditingName(e.target.value)}
      onBlur={commitRename}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commitRename();
        if (e.key === 'Escape') setEditing(null);
      }}
      onClick={(e) => e.stopPropagation()}
      className="px-1.5 py-0.5 bg-(--ui-input) text-(--ui-strong) text-[11px] rounded-md outline-none w-full border border-(--ui-accent)"
    />
  );

  const isEditing = (kind: string, id: string) => editing?.kind === kind && editing.id === id;

  // ---------- Depth tab ----------
  const clearDrag = () => {
    setDragging(null);
    setDropHint(null);
  };

  const renderLayerRow = (layer: Layer, scope: PanelTab, extra?: React.ReactNode) => {
    const isActive = activeLayerId === layer.id;
    const isSelected = selectedSet.has(layer.id);
    const item = findItemOfLayer(project, layer.id);
    const hint = dropHint?.id === layer.id ? dropHint.position : null;
    const draggable = scope === 'depth';

    return (
      <div
        key={`${scope}:${layer.id}`}
        ref={(el) => {
          rowRefs.current[`${scope}:${layer.id}`] = el;
        }}
        draggable={draggable}
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', layer.id);
          e.dataTransfer.effectAllowed = 'move';
          setDragging({ kind: 'layer', id: layer.id });
        }}
        onDragOver={(e) => {
          if (dragging?.kind !== 'layer') return;
          e.preventDefault();
          const rect = e.currentTarget.getBoundingClientRect();
          const position = e.clientY < rect.top + rect.height / 2 ? 'above' : 'below';
          if (dropHint?.id !== layer.id || dropHint.position !== position) setDropHint({ id: layer.id, position });
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (dragging?.kind === 'layer' && dragging.id !== layer.id && hint && hint !== 'into') {
            onReorderLayers(dragging.id, layer.id, hint);
          }
          clearDrag();
        }}
        onDragEnd={clearDrag}
        onClick={() => onSelectLayer(layer.id)}
        onContextMenu={(e) => {
          e.preventDefault();
          setContextMenu({ x: e.clientX, y: e.clientY, layerId: layer.id });
        }}
        className={`relative flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors border ${
          dragging?.id === layer.id
            ? 'opacity-40 border-dashed border-(--ui-accent)'
            : isActive
            ? 'bg-(--ui-hover) border-(--ui-accent) text-(--ui-strong)'
            : isSelected
            ? 'bg-(--ui-raised) border-(--ui-accent)/40 text-(--ui-strong)'
            : 'hover:bg-(--ui-raised) text-(--ui-text-2) border-transparent'
        }`}
      >
        {hint && hint !== 'into' && (
          <div
            className={`absolute left-1 right-1 h-0.5 bg-(--ui-accent-glow) rounded-full shadow-[0_0_8px_#3A6DF0] z-30 pointer-events-none ${
              hint === 'above' ? '-top-px' : '-bottom-px'
            }`}
          />
        )}
        {draggable && <GripVertical className="w-3 h-3 text-(--ui-faint) shrink-0 cursor-grab pointer-coarse:hidden" />}
        <div className="w-8 h-8 rounded-md bg-[#FAF8F2]/95 p-0.5 shrink-0 overflow-hidden">
          <LayerThumb layer={layer} w={project.width} h={project.height} />
        </div>
        <div className="flex-1 min-w-0">
          {isEditing('layer', layer.id) ? (
            renameInput
          ) : (
            <div
              className="truncate text-[11px] font-medium"
              onDoubleClick={(e) => {
                e.stopPropagation();
                startRename('layer', layer.id, layer.name);
              }}
              data-tip="双击重命名"
            >
              {layer.name}
            </div>
          )}
          <div className="flex flex-wrap gap-[3px] mt-1">
            {layerColors(layer).map((c) => (
              <button
                key={c}
                onClick={(e) => {
                  e.stopPropagation();
                  onChangeBrushColor(c);
                }}
                data-tip={`${c} · 单击拾色`}
                className={`w-2.5 h-2.5 rounded-[2px] border hover:scale-125 transition-transform ${isLight(c) ? 'border-black/20' : 'border-white/25'} ${
                  c === normalizeHex(brushColor) ? 'ring-1 ring-(--ui-accent) ring-offset-1 ring-offset-(--ui-panel)' : ''
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex items-center gap-1.5 text-[9px] text-(--ui-faint) mt-0.5 whitespace-nowrap overflow-hidden">
            <span className="font-mono">z {zOf[layer.id] ?? '-'}</span>
            {scope === 'depth' && item && (
              <span className="flex items-center gap-0.5 text-(--ui-accent-2) truncate">
                <Box className="w-2.5 h-2.5" />
                {item.name}
              </span>
            )}
            {scope === 'items' && (
              <span className="truncate">{findGroupOfLayer(project, layer.id)?.name || '根层级'}</span>
            )}
          </div>
        </div>
        {extra}
        <button
          onClick={(e) => {
            e.stopPropagation();
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setContextMenu({ x: r.left - 180, y: r.bottom + 4, layerId: layer.id });
          }}
          className="hidden pointer-coarse:flex p-1.5 rounded hover:bg-(--ui-hover) text-(--ui-muted)"
          data-tip="更多"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onUpdateLayer(layer.id, { visible: !layer.visible });
          }}
          className={`p-1 rounded hover:bg-(--ui-hover) ${layer.visible ? 'text-(--ui-muted)' : 'text-[#D23838]'}`}
          data-tip={layer.visible ? '隐藏' : '显示'}
        >
          {layer.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onUpdateLayer(layer.id, { locked: !layer.locked });
          }}
          className={`p-1 rounded hover:bg-(--ui-hover) ${layer.locked ? 'text-(--ui-accent-2)' : 'text-(--ui-faint)'}`}
          data-tip={layer.locked ? '解锁' : '锁定'}
        >
          {layer.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
        </button>
      </div>
    );
  };

  const renderGroup = (group: LayerGroup) => {
    const isCollapsed = !!collapsedGroupIds[group.id];
    const slot = slots.find((s) => s.id === group.id);
    const hint = dropHint?.id === group.id ? dropHint.position : null;
    return (
      <div
        key={group.id}
        className={`rounded-xl bg-(--ui-raised) border overflow-hidden ${
          hint === 'into' ? 'border-(--ui-accent-glow)' : 'border-(--ui-border)'
        } ${dragging?.id === group.id ? 'opacity-40' : ''}`}
      >
        <div
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('text/plain', group.id);
            setDragging({ kind: 'root', id: group.id });
          }}
          onDragOver={(e) => {
            if (!dragging) return;
            e.preventDefault();
            if (dragging.kind === 'layer') {
              if (dropHint?.id !== group.id || dropHint.position !== 'into') setDropHint({ id: group.id, position: 'into' });
            } else {
              const rect = e.currentTarget.getBoundingClientRect();
              const position = e.clientY < rect.top + rect.height / 2 ? 'above' : 'below';
              if (dropHint?.id !== group.id || dropHint.position !== position) setDropHint({ id: group.id, position });
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (dragging?.kind === 'layer') onMoveLayerToGroup(dragging.id, group.id);
            else if (dragging?.kind === 'root' && hint && hint !== 'into') onReorderRoot(dragging.id, group.id, hint);
            clearDrag();
          }}
          onDragEnd={clearDrag}
          onClick={() => setCollapsedGroupIds((prev) => ({ ...prev, [group.id]: !prev[group.id] }))}
          className="relative flex items-center gap-1.5 px-2 py-1.5 bg-(--ui-hover) text-(--ui-text-2) hover:bg-(--ui-hover) cursor-pointer select-none"
        >
          {hint && hint !== 'into' && (
            <div className={`absolute left-1 right-1 h-0.5 bg-(--ui-accent-glow) z-30 ${hint === 'above' ? '-top-px' : '-bottom-px'}`} />
          )}
          {isCollapsed ? (
            <ChevronRight className="w-3.5 h-3.5 text-(--ui-muted) shrink-0" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-(--ui-muted) shrink-0" />
          )}
          <Folder className="w-3.5 h-3.5 text-(--ui-accent-2) shrink-0" />
          <div className="flex-1 min-w-0">
            {isEditing('group', group.id) ? (
              renameInput
            ) : (
              <span
                className="font-medium truncate text-[11px] block"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  startRename('group', group.id, group.name);
                }}
                data-tip="双击重命名深度层"
              >
                {group.name}
              </span>
            )}
          </div>
          <span className="text-[9px] text-(--ui-muted) font-mono px-1 rounded bg-(--ui-panel)/60 shrink-0" data-tip="导出到 Godot 的 z_index 起点">
            z{slot?.zBase ?? 0}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddLayer(group.id);
            }}
            className="p-0.5 rounded hover:bg-(--ui-panel) text-(--ui-muted) hover:text-(--ui-strong)"
            data-tip="在此深度层新建纸片"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUpdateGroup(group.id, { visible: !group.visible });
            }}
            className={`p-0.5 rounded hover:bg-(--ui-panel) ${group.visible ? 'text-(--ui-muted)' : 'text-[#D23838]'}`}
            data-tip={group.visible ? '隐藏深度层' : '显示深度层'}
          >
            {group.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUpdateGroup(group.id, { locked: !group.locked });
            }}
            className={`p-0.5 rounded hover:bg-(--ui-panel) ${group.locked ? 'text-(--ui-accent-2)' : 'text-(--ui-faint)'}`}
            data-tip={group.locked ? '解锁深度层' : '锁定深度层'}
          >
            {group.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteGroup(group.id);
            }}
            className="p-0.5 rounded hover:bg-red-950/60 text-(--ui-faint) hover:text-red-300"
            data-tip="解散深度层 (纸片保留)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        {!isCollapsed && (
          <div className="p-1 space-y-0.5">
            {group.layerIds.length === 0 && (
              <div className="text-[10px] text-(--ui-faint) px-2 py-1.5">拖入纸片</div>
            )}
            {group.layerIds
              .slice()
              .reverse()
              .map((lid) => layers[lid] && renderLayerRow(layers[lid], 'depth'))}
          </div>
        )}
      </div>
    );
  };

  const depthTab = (
    <div className="space-y-1.5">
      {rootOrder
        .slice()
        .reverse()
        .map((entry) => {
          if (entry.type === 'group') {
            const g = groups.find((gg) => gg.id === entry.id);
            return g ? renderGroup(g) : null;
          }
          const l = layers[entry.id];
          return l ? renderLayerRow(l, 'depth') : null;
        })}
    </div>
  );

  // ---------- Items tab ----------
  const unassigned = Object.keys(layers).filter((id) => !findItemOfLayer(project, id));

  const itemsTab = (
    <div className="space-y-2">
      <div>
        <button
          onClick={onCreateItem}
          disabled={selectedLayerIds.length === 0 && !activeLayerId}
          data-tip="物件是游戏里的一个对象，部件可分布在不同深度层；导出时每个物件生成一个 Godot 场景"
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-(--ui-accent) hover:bg-(--ui-accent-hover) disabled:opacity-40 text-white font-medium text-[11px]"
        >
          <Plus className="w-3 h-3" />
          {selectedLayerIds.length > 1 ? `新建物件（${selectedLayerIds.length} 个部件）` : '新建物件'}
        </button>
      </div>

      {items.map((item) => {
        const expanded = expandedItemIds[item.id] ?? true;
        const isSelectedItem =
          item.partIds.length === selectedLayerIds.length && item.partIds.every((p) => selectedSet.has(p));
        const partsByDepth = item.partIds
          .filter((p) => layers[p])
          .sort((a, b) => (zOf[b] ?? 0) - (zOf[a] ?? 0));
        return (
          <div
            key={item.id}
            className={`rounded-xl border overflow-hidden ${isSelectedItem ? 'border-(--ui-accent-2)' : 'border-(--ui-border)'} bg-(--ui-raised)`}
          >
            <div className="flex items-center gap-1.5 px-2 py-1.5 bg-(--ui-hover)">
              <button
                onClick={() => setExpandedItemIds((prev) => ({ ...prev, [item.id]: !expanded }))}
                className="text-(--ui-muted)"
              >
                {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
              <Box className="w-3.5 h-3.5 text-(--ui-accent-2) shrink-0" />
              <div className="flex-1 min-w-0">
                {isEditing('item', item.id) ? (
                  renameInput
                ) : (
                  <span
                    className="text-[11px] font-semibold text-(--ui-strong) truncate block"
                    onDoubleClick={() => startRename('item', item.id, item.name)}
                    data-tip="双击重命名 (即 Godot 场景根节点名)"
                  >
                    {item.name}
                  </span>
                )}
              </div>
              <span className="text-[9px] text-(--ui-muted)">{item.partIds.length} 部件</span>
              <button
                onClick={() => onSelectItem(item.id)}
                className="p-0.5 rounded hover:bg-(--ui-panel) text-(--ui-muted) hover:text-(--ui-strong)"
                data-tip="在画布上选中整个物件"
              >
                <MousePointer2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onDeleteItem(item.id)}
                className="p-0.5 rounded hover:bg-red-950/60 text-(--ui-faint) hover:text-red-300"
                data-tip="解散物件 (纸片保留)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {expanded && (
              <div className="p-1.5 space-y-1">
                {partsByDepth.map((pid) =>
                  renderLayerRow(
                    layers[pid],
                    'items',
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemovePartFromItem(item.id, pid);
                      }}
                      className="p-1 rounded hover:bg-(--ui-hover) text-(--ui-faint) hover:text-(--ui-accent-2)"
                      data-tip="移出物件"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )
                )}
                {activeLayerId && !item.partIds.includes(activeLayerId) && layers[activeLayerId] && (
                  <button
                    onClick={() => onAddPartToItem(item.id, activeLayerId)}
                    className="w-full text-left px-2 py-1 rounded-lg text-[10px] text-(--ui-muted) hover:bg-(--ui-hover) hover:text-(--ui-strong)"
                  >
                    + 加入「{layers[activeLayerId].name}」
                  </button>
                )}

                <div className="mt-1 pt-1.5 border-t border-(--ui-divider) space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] text-(--ui-muted)">
                    <Anchor className="w-3 h-3 text-[#D23838]" />
                    <span className="flex-1" data-tip="场景原点，Godot 中物件的位置基准">锚点</span>
                    {(['x', 'y'] as const).map((axis) => (
                      <input
                        key={axis}
                        type="number"
                        value={Math.round(item.pivot[axis])}
                        onChange={(e) => onUpdateItem(item.id, { pivot: { ...item.pivot, [axis]: Number(e.target.value) } })}
                        className="w-14 bg-(--ui-input) border border-(--ui-border) rounded px-1 py-0.5 text-[10px] text-(--ui-strong) font-mono"
                        data-tip={axis}
                      />
                    ))}
                  </div>
                  {item.sockets.map((s) => (
                    <div key={s.id} className="flex items-center gap-1.5 text-[10px] text-(--ui-muted)">
                      <span className="w-2 h-2 rotate-45 bg-(--ui-accent-2) shrink-0 ml-0.5" />
                      <div className="flex-1 min-w-0">
                        {isEditing('socket', s.id) ? (
                          renameInput
                        ) : (
                          <span
                            className="font-mono text-(--ui-strong) truncate block"
                            onDoubleClick={() => startRename('socket', s.id, s.name, item.id)}
                            data-tip="双击重命名 (Godot Marker2D 名)"
                          >
                            {s.name}
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[9px]">
                        {Math.round(s.x - item.pivot.x)}, {Math.round(s.y - item.pivot.y)}
                      </span>
                      <button
                        onClick={() => onUpdateItem(item.id, { sockets: item.sockets.filter((x) => x.id !== s.id) })}
                        className="p-0.5 text-(--ui-faint) hover:text-(--ui-accent-2)"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => onAddSocket(item.id)}
                    className="w-full text-left px-2 py-1 rounded-lg text-[10px] text-(--ui-muted) hover:bg-(--ui-hover) hover:text-(--ui-strong)"
                    data-tip="挂点：手部、帽子、特效位置等，导出为 Marker2D；选中物件后可在画布上拖动"
                  >
                    + 挂点
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {unassigned.length > 0 && (
        <div className="text-[10px] text-(--ui-faint) px-1" data-tip="未归组的纸片导出时合并为「场景杂项」">
          {unassigned.length} 张纸片未归组
        </div>
      )}
    </div>
  );

  // ---------- Style tab ----------
  const ref = project.reference;
  const documentColors = useMemo(() => (tab === 'style' ? projectColors(project) : []), [project, tab]);
  const styleTab = (
    <div className="space-y-3">
      <ColorStudio
        color={brushColor}
        onChange={onChangeBrushColor}
        recent={recentColors}
        documentColors={documentColors}
        paperColor={activeLayer?.color}
        onApplyToPaper={activeLayer && activeLayer.kind !== 'doodle' ? (hex) => onUpdateLayer(activeLayer.id, { color: hex }) : undefined}
        colorNotes={colorNotes}
        onUpdateColorNote={onUpdateColorNote}
        width={width}
      />

      <div className="pt-2 border-t border-(--ui-divider) text-[10px] text-(--ui-muted)">颗粒与参考图</div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => {
            const g = activeLayer?.grain ?? 0.35;
            onUpdateProject({
              layers: Object.fromEntries(
                Object.entries(layers).map(([id, l]) => [id, l.grain === undefined ? { ...l, grain: g } : l])
              ),
            });
          }}
          className="h-7 w-7 flex items-center justify-center rounded-lg bg-(--ui-raised) border border-(--ui-border) text-(--ui-muted) hover:text-(--ui-strong)"
          data-tip="把当前纸片的颗粒应用到未设置的纸片"
        >
          <Sparkles className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={onImportReference}
          data-tip={ref ? '更换临摹参考图' : '导入临摹参考图（不参与导出）'}
          className="h-7 w-7 flex items-center justify-center rounded-lg bg-(--ui-raised) border border-(--ui-border) text-(--ui-muted) hover:text-(--ui-strong)"
        >
          <ImageIcon className="w-3.5 h-3.5" />
        </button>
        {ref && (
          <>
            <WheelNumber
              tip="参考图透明度"
              icon={<Droplet className="w-3 h-3" />}
              value={Math.round(ref.opacity * 100)}
              min={5}
              max={100}
              step={5}
              format={(v) => `${v}%`}
              onChange={(v) => onUpdateProject({ reference: { ...ref, opacity: v / 100 } })}
            />
            <button
              onClick={() => onUpdateProject({ reference: { ...ref, visible: !ref.visible } })}
              data-tip={ref.visible ? '隐藏参考图' : '显示参考图'}
              className="h-7 w-7 flex items-center justify-center rounded-lg bg-(--ui-raised) border border-(--ui-border) text-(--ui-muted) hover:text-(--ui-strong)"
            >
              {ref.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => onUpdateProject({ reference: { ...ref, onTop: !ref.onTop } })}
              data-tip={ref.onTop ? '参考图置于纸片下方' : '参考图置于纸片上方'}
              className="h-7 w-7 flex items-center justify-center rounded-lg bg-(--ui-raised) border border-(--ui-border) text-(--ui-muted) hover:text-(--ui-strong)"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onUpdateProject({ reference: undefined })}
              data-tip="移除参考图"
              className="h-7 w-7 flex items-center justify-center rounded-lg bg-(--ui-raised) border border-(--ui-border) text-red-400 hover:text-red-300"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );

  // ---------- Active layer dock ----------
  const pattern = activeLayer?.pattern;
  const setPattern = (updates: Partial<LayerPattern> | null) => {
    if (!activeLayer) return;
    if (updates === null) {
      onUpdateLayer(activeLayer.id, { pattern: undefined });
      return;
    }
    const base: LayerPattern = pattern || {
      type: 'diamond',
      color: activeLayer.color.toLowerCase() === '#fbfbfc' ? '#2652D0' : '#FBFBFC',
      scale: 28,
      angle: 0,
      opacity: 0.9,
    };
    onUpdateLayer(activeLayer.id, { pattern: { ...base, ...updates } });
  };

  const dock = activeLayer && tab !== 'style' && (
    <div className="p-2.5 border-t border-(--ui-divider) bg-(--ui-panel-2) space-y-1.5 shrink-0">
      <div className="flex items-center gap-2">
        <label className="relative w-6 h-6 rounded-md border border-white/30 shrink-0 cursor-pointer overflow-hidden" style={{ backgroundColor: activeLayer.color }} data-tip="纸色">
          <input
            type="color"
            value={activeLayer.color}
            onChange={(e) => onUpdateLayer(activeLayer.id, { color: e.target.value })}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </label>
        <span className="flex-1 text-[11px] font-semibold text-(--ui-strong) truncate">{activeLayer.name}</span>
        <button
          onClick={() => {
            playPaperRustle();
            onDuplicateLayer(activeLayer.id);
          }}
          className="p-1 rounded-md bg-(--ui-raised) border border-(--ui-border) text-(--ui-text-2) hover:text-(--ui-strong)"
          data-tip="复制纸片"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => {
            playDiscardSwoosh();
            onDeleteLayer(activeLayer.id);
          }}
          className="p-1 rounded-md bg-(--ui-raised) border border-(--ui-border) text-red-400 hover:text-red-300"
          data-tip="删除纸片"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <WheelNumber
          tip="纸片不透明度"
          icon={<Droplet className="w-3 h-3" />}
          value={Math.round(activeLayer.opacity * 100)}
          min={0}
          max={100}
          step={5}
          format={(v) => `${v}%`}
          onChange={(v) => onUpdateLayer(activeLayer.id, { opacity: v / 100 })}
        />
        <WheelNumber
          tip="颗粒质感"
          icon={<Sparkles className="w-3 h-3" />}
          value={Math.round((activeLayer.grain ?? 0) * 100)}
          min={0}
          max={100}
          step={5}
          format={(v) => `${v}%`}
          onChange={(v) => onUpdateLayer(activeLayer.id, { grain: v / 100 })}
        />
        <label className="h-7 flex items-center gap-1 px-1.5 rounded-lg bg-(--ui-raised) border border-(--ui-border) text-(--ui-muted)" data-tip="混合模式（导出 Godot 时与同物件下方部件合成烘焙）">
          <Blend className="w-3 h-3" />
          <select
            value={activeLayer.blendMode || 'normal'}
            onChange={(e) => onUpdateLayer(activeLayer.id, { blendMode: e.target.value as Layer['blendMode'] })}
            className="bg-transparent text-[11px] text-(--ui-strong) outline-none"
          >
            <option value="normal">正常</option>
            <option value="multiply">正片叠底</option>
            <option value="screen">滤色</option>
            <option value="overlay">叠加</option>
          </select>
        </label>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <label className="h-7 flex items-center gap-1 px-1.5 rounded-lg bg-(--ui-raised) border border-(--ui-border) text-(--ui-muted)" data-tip="纹样">
          <Grid3x3 className="w-3 h-3" />
          <select
            value={pattern?.type || 'none'}
            onChange={(e) => (e.target.value === 'none' ? setPattern(null) : setPattern({ type: e.target.value as PatternType }))}
            className="bg-transparent text-[11px] text-(--ui-strong) outline-none"
          >
            {PATTERN_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {pattern && (
          <>
            <label className="relative w-7 h-7 rounded-full border border-white/30 cursor-pointer overflow-hidden" style={{ backgroundColor: pattern.color }} data-tip="纹样颜色">
              <input type="color" value={pattern.color} onChange={(e) => setPattern({ color: e.target.value })} className="absolute inset-0 opacity-0 cursor-pointer" />
            </label>
            <WheelNumber tip="纹样尺寸" icon={<Maximize className="w-3 h-3" />} value={pattern.scale} min={8} max={120} onChange={(v) => setPattern({ scale: v })} />
            <WheelNumber tip="纹样角度" icon={<RotateCw className="w-3 h-3" />} value={pattern.angle} min={-90} max={90} step={5} format={(v) => `${v}°`} onChange={(v) => setPattern({ angle: v })} />
          </>
        )}
      </div>
    </div>
  );

  const ctxLayer = contextMenu ? layers[contextMenu.layerId] : null;

  /** Neighbour in the same stack (group or root), so touch users can reorder without drag and drop. */
  const neighbour = (layerId: string, dir: 1 | -1): string | null => {
    const grp = groups.find((g) => g.layerIds.includes(layerId));
    const ids = grp ? grp.layerIds : rootOrder.filter((r) => r.type === 'layer').map((r) => r.id);
    const i = ids.indexOf(layerId);
    return ids[i + dir] ?? null;
  };

  return (
    <aside
      style={{ width }}
      className="h-full flex flex-col bg-(--ui-panel) border-l border-(--ui-divider) text-(--ui-text-2) text-xs shrink-0 select-none z-20 relative"
    >
      <div
        onPointerDown={startResize}
        onDoubleClick={() => {
          setWidth(288);
          localStorage.setItem(WIDTH_KEY, '288');
        }}
        data-tip="拖动调节宽度 · 双击复原"
        data-tip-side="left"
        className={`absolute -left-1 top-0 bottom-0 w-2 z-30 cursor-col-resize touch-none transition-colors ${
          resizing ? 'bg-(--ui-accent)/60' : 'hover:bg-(--ui-accent)/35'
        }`}
      />
      <div className="h-11 px-2 border-b border-(--ui-divider) flex items-center gap-1">
        {([
          { id: 'depth', label: '深度', icon: LayersIcon },
          { id: 'items', label: `物件（${items.length}）`, icon: Box },
          { id: 'style', label: '风格', icon: Palette },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            data-tip={t.label}
            className={`relative w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
              tab === t.id ? 'bg-(--ui-accent) text-white' : 'text-(--ui-muted) hover:bg-(--ui-raised) hover:text-(--ui-strong)'
            }`}
          >
            <t.icon className="w-4 h-4" />
          </button>
        ))}
        <div className="flex-1" />
        {tab === 'depth' && (
          <>
            <button
              onClick={onAddGroup}
              className="p-1.5 rounded-lg text-(--ui-muted) hover:bg-(--ui-raised) hover:text-(--ui-strong)"
              data-tip="新建深度层 (图层组)"
            >
              <FolderPlus className="w-4 h-4" />
            </button>
            <button
              onClick={() => onAddLayer(undefined, 'doodle')}
              className="p-1.5 rounded-lg text-(--ui-muted) hover:bg-(--ui-raised) hover:text-(--ui-strong)"
              data-tip="新建涂鸦图层：手绘不受纸片边界裁切"
            >
              <Brush className="w-4 h-4" />
            </button>
            <button
              onClick={() => onAddLayer()}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-(--ui-accent) hover:bg-(--ui-accent-hover) text-white"
              data-tip="新建纸片"
            >
              <Plus className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto p-2">
        {tab === 'depth' ? depthTab : tab === 'items' ? itemsTab : styleTab}
      </div>

      {dock}

      <WorkStatus
        project={project}
        activeLayerId={activeLayerId}
        currentTool={currentTool}
        brushSettings={brushSettings}
        selectedLayerIds={selectedLayerIds}
        selectedItem={selectedItem}
      />

      {contextMenu && ctxLayer && (
        <div
          className="fixed inset-0 z-50"
          onClick={() => setContextMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu(null);
          }}
        >
          <div
            ref={(el) => {
              if (el) el.style.top = `${Math.max(8, Math.min(contextMenu.y, window.innerHeight - el.offsetHeight - 8))}px`;
            }}
            className="absolute bg-(--ui-raised)/98 border border-(--ui-border-strong) text-(--ui-text) rounded-xl shadow-2xl py-1 w-52 text-xs backdrop-blur-md"
            style={{
              left: Math.max(8, Math.min(contextMenu.x, window.innerWidth - 220)),
              top: contextMenu.y,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex gap-0.5 px-1.5 pt-0.5 pb-1.5 mb-1 border-b border-(--ui-border)">
              {layerColors(ctxLayer).map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    onChangeBrushColor(c);
                    setContextMenu(null);
                  }}
                  data-tip={`${c} · 拾色`}
                  className={`flex-1 min-w-0 h-6 first:rounded-l-md last:rounded-r-md border ${isLight(c) ? 'border-black/15' : 'border-white/10'} hover:scale-y-125 transition-transform`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            {[
              { label: '重命名', icon: Edit2, run: () => startRename('layer', ctxLayer.id, ctxLayer.name) },
              { label: '复制纸片', icon: Copy, run: () => onDuplicateLayer(ctxLayer.id) },
              ...(neighbour(ctxLayer.id, 1)
                ? [{ label: '上移一层', icon: ArrowUp, run: () => onReorderLayers(ctxLayer.id, neighbour(ctxLayer.id, 1)!, 'above') }]
                : []),
              ...(neighbour(ctxLayer.id, -1)
                ? [{ label: '下移一层', icon: ArrowDown, run: () => onReorderLayers(ctxLayer.id, neighbour(ctxLayer.id, -1)!, 'below') }]
                : []),
              { label: ctxLayer.visible ? '隐藏' : '显示', icon: ctxLayer.visible ? EyeOff : Eye, run: () => onUpdateLayer(ctxLayer.id, { visible: !ctxLayer.visible }) },
              { label: ctxLayer.locked ? '解锁' : '锁定', icon: ctxLayer.locked ? Unlock : Lock, run: () => onUpdateLayer(ctxLayer.id, { locked: !ctxLayer.locked }) },
              ...(onInvertLayerCutouts ? [{ label: '镂空 / 贴花 互换', icon: LayersIcon, run: () => onInvertLayerCutouts(ctxLayer.id) }] : []),
              ...(onClearLayerCutouts ? [{ label: '清空切口', icon: X, run: () => onClearLayerCutouts(ctxLayer.id) }] : []),
            ].map((a) => (
              <button
                key={a.label}
                onClick={() => {
                  a.run();
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-(--ui-hover) flex items-center gap-2"
              >
                <a.icon className="w-3.5 h-3.5 text-(--ui-muted)" />
                {a.label}
              </button>
            ))}
            {items.length > 0 && (
              <>
                <div className="px-3 pt-1.5 pb-0.5 text-[10px] text-(--ui-muted) border-t border-(--ui-border) mt-1">加入物件</div>
                {items.map((it) => (
                  <button
                    key={it.id}
                    onClick={() => {
                      onAddPartToItem(it.id, ctxLayer.id);
                      setContextMenu(null);
                    }}
                    className="w-full px-3 py-1 text-left hover:bg-(--ui-hover) flex items-center gap-2"
                  >
                    <Box className="w-3 h-3 text-(--ui-accent-2)" />
                    <span className="truncate">{it.name}</span>
                    {it.partIds.includes(ctxLayer.id) && <Check className="w-3 h-3 ml-auto text-(--ui-accent)" />}
                  </button>
                ))}
              </>
            )}
            <button
              onClick={() => {
                playDiscardSwoosh();
                onDeleteLayer(ctxLayer.id);
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 text-left hover:bg-red-950/60 text-red-400 flex items-center gap-2 border-t border-(--ui-border) mt-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              删除纸片
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};
