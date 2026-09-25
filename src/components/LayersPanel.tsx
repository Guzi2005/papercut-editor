/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Layer,
  LayerGroup,
  RootItem,
} from '../types/papercut';
import { FOLK_PALETTE } from '../utils/presetTemplates';
import { getPathBoundingBox } from '../utils/bezierMath';
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
} from 'lucide-react';
import { playDiscardSwoosh, playPaperRustle, playCrispClick } from '../utils/soundEffects';

interface LayersPanelProps {
  layers: Record<string, Layer>;
  groups: LayerGroup[];
  rootOrder: RootItem[];
  activeLayerId: string | null;
  canvasWidth?: number;
  canvasHeight?: number;
  colorNotes?: Record<string, string>;
  onUpdateColorNote?: (hex: string, note: string) => void;
  onSelectLayer: (layerId: string) => void;
  onUpdateLayer: (layerId: string, updates: Partial<Layer>) => void;
  onAddLayer: (groupId?: string) => void;
  onDeleteLayer: (layerId: string) => void;
  onDuplicateLayer: (layerId: string) => void;
  onInvertLayerCutouts?: (layerId: string) => void;
  onClearLayerCutouts?: (layerId: string) => void;
  onReorderLayers?: (
    sourceLayerId: string,
    targetLayerId: string,
    position?: 'above' | 'below'
  ) => void;
}

export type ThumbnailMode = 'cropped' | 'canvas';

export const LayersPanel: React.FC<LayersPanelProps> = ({
  layers,
  groups,
  rootOrder,
  activeLayerId,
  canvasWidth = 800,
  canvasHeight = 800,
  colorNotes = {},
  onUpdateColorNote,
  onSelectLayer,
  onUpdateLayer,
  onAddLayer,
  onDeleteLayer,
  onDuplicateLayer,
  onReorderLayers,
}) => {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // Collapsed groups state (图层组可以收起)
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Record<string, boolean>>({});

  // Drag and drop state for layer reordering (支持拖拽排序图层，支持上下精准插入线)
  const [draggedLayerId, setDraggedLayerId] = useState<string | null>(null);
  const [dragOverInfo, setDragOverInfo] = useState<{
    layerId: string;
    position: 'above' | 'below';
  } | null>(null);

  // Editing color note state (双击色卡编辑备注)
  const [editingColorHex, setEditingColorHex] = useState<string | null>(null);
  const [editingColorNote, setEditingColorNote] = useState('');

  // Thumbnail display mode: 'cropped' (default: auto crop transparent, borderless) vs 'canvas' (full canvas, with border)
  const [thumbnailMode, setThumbnailMode] = useState<ThumbnailMode>('cropped');
  const [layerThumbnailModes, setLayerThumbnailModes] = useState<Record<string, ThumbnailMode>>({});

  // Context menu position for right-click thumbnail mode switch
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    layerId: string;
  } | null>(null);

  const activeLayer = activeLayerId ? layers[activeLayerId] : null;

  const startRename = (id: string, currentName: string) => {
    setEditingItemId(id);
    setEditingName(currentName);
  };

  const commitRename = (id: string) => {
    if (!editingName.trim()) {
      setEditingItemId(null);
      return;
    }
    onUpdateLayer(id, { name: editingName.trim() });
    setEditingItemId(null);
  };

  const handleStartEditColorNote = (hex: string, defaultNote: string) => {
    setEditingColorHex(hex);
    setEditingColorNote(colorNotes[hex.toLowerCase()] || defaultNote);
  };

  const handleSaveColorNote = (hex: string) => {
    if (editingColorNote.trim() && onUpdateColorNote) {
      onUpdateColorNote(hex.toLowerCase(), editingColorNote.trim());
    }
    setEditingColorHex(null);
  };

  return (
    <aside className="w-72 lg:w-80 flex flex-col bg-[#161B29] border-l border-[#263147] text-[#BAC5EB] text-xs shrink-0 select-none z-20 relative">
      {/* 1. Header with Add Layer Action */}
      <div className="h-12 px-4 border-b border-[#263147] flex items-center justify-between font-semibold text-[#FBFBFC]">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-[#2652D0] flex items-center justify-center text-white text-[10px]">
            ❖
          </div>
          <span className="tracking-wide">图层管理</span>
          <span className="text-[10px] text-[#7E8FB8] font-normal hidden sm:inline">
            (可拖拽排序)
          </span>
        </div>

        <button
          onClick={() => onAddLayer()}
          className="flex items-center gap-1 px-3 py-1 rounded-xl bg-[#2652D0] hover:bg-[#1E43B8] text-white font-medium text-[11px] shadow-md shadow-blue-950/60 border border-[#BAC5EB]/40 transition-colors cursor-pointer"
          title="新建纸张图层"
        >
          <Plus className="w-3 h-3" />
          <span>新建图层</span>
        </button>
      </div>

      {/* 2. 民俗经典色卡 (支持双击编辑备注) */}
      <div className="p-3 border-b border-[#263147] bg-[#121622] relative">
        <div className="flex items-center justify-between text-[11px] text-[#8E9FCA] mb-2">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[#FBFBFC]">针脚色卡</span>
            <span className="text-[10px] text-[#7E8FB8]">(双击色卡编辑备注)</span>
          </div>
          {activeLayer && (
            <div className="flex items-center gap-1">
              <span className="text-[10px]">当前图层:</span>
              <span
                className="w-2.5 h-2.5 rounded-full inline-block border border-white/50"
                style={{ backgroundColor: activeLayer.color }}
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          {FOLK_PALETTE.map((c) => {
            const isCurrent =
              activeLayer?.color.toLowerCase() === c.hex.toLowerCase();
            const note = colorNotes[c.hex.toLowerCase()] || c.desc || c.name;
            const displayName = colorNotes[c.hex.toLowerCase()] || c.name;

            return (
              <div key={c.hex} className="relative">
                <button
                  onClick={() => {
                    if (activeLayer) {
                      onUpdateLayer(activeLayer.id, { color: c.hex });
                    }
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    handleStartEditColorNote(c.hex, c.desc || c.name);
                  }}
                  title={`${displayName} - 备注: ${note} (双击编辑备注)`}
                  className={`group relative w-full h-6 rounded-md flex items-center justify-center transition-all cursor-pointer ${
                    isCurrent
                      ? 'ring-2 ring-white scale-105 shadow-md z-10'
                      : 'hover:scale-105 opacity-90 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c.hex }}
                >
                  <span
                    className="text-[9px] font-medium tracking-tight px-0.5 truncate drop-shadow-sm"
                    style={{
                      color:
                        c.hex === '#FBFBFC' ||
                        c.hex === '#F3EFE6' ||
                        c.hex === '#E8DEC8' ||
                        c.hex === '#BAC5EB'
                          ? '#161B29'
                          : '#ffffff',
                    }}
                  >
                    {displayName}
                  </span>
                </button>

                {/* Inline Editing Popover for Color Note */}
                {editingColorHex === c.hex && (
                  <div
                    className="absolute -top-11 left-1/2 -translate-x-1/2 z-50 bg-[#161B29] border border-[#2652D0] rounded-xl p-1 shadow-2xl flex items-center gap-1 min-w-[130px] animate-in fade-in zoom-in-95 duration-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="text"
                      value={editingColorNote}
                      autoFocus
                      onChange={(e) => setEditingColorNote(e.target.value)}
                      onBlur={() => handleSaveColorNote(c.hex)}
                      onKeyDown={(e) =>
                        e.key === 'Enter' && handleSaveColorNote(c.hex)
                      }
                      className="px-2 py-0.5 bg-[#0F131D] text-white text-[10px] rounded-lg outline-none w-full border border-[#2F3A54]"
                      placeholder="修改备注/名称..."
                    />
                    <button
                      onClick={() => handleSaveColorNote(c.hex)}
                      className="p-1 rounded-lg bg-[#2652D0] text-white hover:bg-[#1E43B8]"
                      title="保存备注"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Layer Tree List with Drag and Drop Reordering (支持拖拽排序图层) */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {rootOrder
          .slice()
          .reverse()
          .map((item) => {
            if (item.type === 'group') {
              const group = groups.find((g) => g.id === item.id);
              if (!group) return null;
              const isCollapsed = !!collapsedGroupIds[group.id];
              return (
                <div
                  key={group.id}
                  className="rounded-xl bg-[#1C2335] border border-[#2B364D] overflow-hidden mb-1 transition-all"
                >
                  <div
                    onClick={() =>
                      setCollapsedGroupIds((prev) => ({
                        ...prev,
                        [group.id]: !prev[group.id],
                      }))
                    }
                    className="flex items-center justify-between px-3 py-1.5 bg-[#232D42] text-[#BAC5EB] hover:bg-[#2A364E] cursor-pointer transition-colors select-none"
                    title={isCollapsed ? '点击展开图层组' : '点击收起图层组'}
                  >
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      {isCollapsed ? (
                        <ChevronRight className="w-3.5 h-3.5 text-[#8E9FCA] shrink-0" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-[#8E9FCA] shrink-0" />
                      )}
                      <Folder className="w-3.5 h-3.5 text-[#EB8E88] shrink-0" />
                      <span className="font-medium truncate text-[11px]">
                        {group.name}
                      </span>
                    </div>
                    <span className="text-[10px] text-[#7E8FB8] font-mono px-1.5 py-0.5 rounded bg-[#161B29]/60 shrink-0">
                      {group.layerIds.length} 图层
                    </span>
                  </div>
                  {!isCollapsed && (
                    <div className="py-1 px-1 space-y-1 animate-in fade-in duration-100">
                      {group.layerIds
                        .slice()
                        .reverse()
                        .map((layerId) => {
                          const layer = layers[layerId];
                          if (!layer) return null;
                          return renderLayerRow(layer);
                        })}
                    </div>
                  )}
                </div>
              );
            } else {
              const layer = layers[item.id];
              if (!layer) return null;
              return renderLayerRow(layer);
            }
          })}
      </div>

      {/* 4. Active Layer Quick Controls (Bottom Dock) */}
      {activeLayer && (
        <div className="p-3 border-t border-[#263147] bg-[#121622] space-y-2.5 shrink-0">
          {/* Layer Opacity Slider (使用滑杆调节，每10度有吸附) */}
          <div>
            <div className="flex items-center justify-between text-[10px] text-[#8E9FCA] mb-1">
              <span>纸张不透明度</span>
              <span className="font-mono text-[#FBFBFC] font-semibold">
                {Math.round(activeLayer.opacity * 100)}%
              </span>
            </div>
            <div className="flex items-center gap-2 bg-[#1C2335] rounded-xl px-3 py-1.5 border border-[#2B364D]">
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={Math.round(activeLayer.opacity * 10) / 10}
                onChange={(e) =>
                  onUpdateLayer(activeLayer.id, {
                    opacity: parseFloat(e.target.value),
                  })
                }
                className="w-full h-1.5 bg-[#2B364D] rounded-lg appearance-none cursor-pointer accent-[#2652D0]"
                title="纸张不透明度 (每10%吸附)"
              />
            </div>
          </div>

          {/* Quick Actions: Only Duplicate and Delete */}
          <div className="flex items-center gap-2 pt-1 border-t border-[#202738]">
            <button
              onClick={() => onDuplicateLayer(activeLayer.id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-[#1C2335] hover:bg-[#28324A] text-[#BAC5EB] hover:text-white transition-colors border border-[#2B364D] text-[11px]"
              title="复制当前图层"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>复制图层</span>
            </button>
            <button
              onClick={() => onDeleteLayer(activeLayer.id)}
              className="flex items-center justify-center gap-1 py-1.5 px-3 rounded-xl bg-[#1C2335] hover:bg-red-950/60 text-red-400 hover:text-red-300 transition-colors border border-[#2B364D] text-[11px]"
              title="删除图层"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>删除</span>
            </button>
          </div>
        </div>
      )}

      {/* Right-click context menu for thumbnail mode */}
      {contextMenu && (
        <div
          className="fixed inset-0 z-50 select-none"
          onClick={() => setContextMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu(null);
          }}
        >
          <div
            className="absolute bg-[#181E2E]/95 border border-[#3A4766] text-[#CAD0DB] rounded-2xl shadow-2xl py-1.5 w-68 z-50 text-xs backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
            style={{
              left: Math.min(contextMenu.x, window.innerWidth - 280),
              top: Math.min(contextMenu.y, window.innerHeight - 200),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3.5 py-1.5 text-[11px] font-semibold text-[#8E9FCA] border-b border-[#2B364D] flex items-center justify-between">
              <span>缩略图显示模式</span>
              <span className="text-[#2652D0] font-mono">❖ 右键选项</span>
            </div>

            {/* Layer Actions (图层右键菜单：可删除、复制、重命名等) */}
            {(() => {
              const targetLayer = layers[contextMenu.layerId];
              if (!targetLayer) return null;
              return (
                <div className="py-1 border-b border-[#2B364D] space-y-0.5">
                  {/* Delete Layer Action (丢弃操作 xiu 的一声) */}
                  <button
                    onClick={() => {
                      playDiscardSwoosh();
                      onDeleteLayer(targetLayer.id);
                      setContextMenu(null);
                    }}
                    className="w-full px-3.5 py-1.5 text-left hover:bg-red-950/60 text-red-400 hover:text-red-300 flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="font-medium">删除图层</span>
                  </button>

                  {/* Duplicate Layer */}
                  <button
                    onClick={() => {
                      playPaperRustle();
                      onDuplicateLayer(targetLayer.id);
                      setContextMenu(null);
                    }}
                    className="w-full px-3.5 py-1.5 text-left hover:bg-[#232D42] text-[#CAD0DB] hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>复制图层</span>
                  </button>

                  {/* Rename Layer */}
                  <button
                    onClick={() => {
                      startRename(targetLayer.id, targetLayer.name);
                      setContextMenu(null);
                    }}
                    className="w-full px-3.5 py-1.5 text-left hover:bg-[#232D42] text-[#CAD0DB] hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>重命名</span>
                  </button>

                  {/* Toggle Visibility */}
                  <button
                    onClick={() => {
                      onUpdateLayer(targetLayer.id, { visible: !targetLayer.visible });
                      setContextMenu(null);
                    }}
                    className="w-full px-3.5 py-1.5 text-left hover:bg-[#232D42] text-[#CAD0DB] hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    {targetLayer.visible ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>隐藏图层</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>显示图层</span>
                      </>
                    )}
                  </button>

                  {/* Toggle Lock */}
                  <button
                    onClick={() => {
                      onUpdateLayer(targetLayer.id, { locked: !targetLayer.locked });
                      setContextMenu(null);
                    }}
                    className="w-full px-3.5 py-1.5 text-left hover:bg-[#232D42] text-[#CAD0DB] hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    {targetLayer.locked ? (
                      <>
                        <Unlock className="w-3.5 h-3.5" />
                        <span>解锁图层</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span>锁定图层</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })()}

            {/* Option 1: Cropped (borderless, default) */}
            <button
              onClick={() => {
                setLayerThumbnailModes((prev) => ({
                  ...prev,
                  [contextMenu.layerId]: 'cropped',
                }));
                setContextMenu(null);
              }}
              className="w-full px-3.5 py-2 text-left hover:bg-[#232D42] flex items-center justify-between transition-colors group"
            >
              <div className="flex-1 pr-2">
                <div className="font-medium text-[#FBFBFC] text-[11px] flex items-center gap-1.5">
                  <span>自动剪裁透明区域 (无边框)</span>
                  <span className="text-[9px] bg-[#2652D0]/30 text-[#BAC5EB] font-semibold px-1 rounded">
                    默认
                  </span>
                </div>
                <div className="text-[10px] text-[#8E9FCA] mt-0.5">
                  剔除透明空白，主体图案充满缩略图，无外部边框
                </div>
              </div>
              {(layerThumbnailModes[contextMenu.layerId] || thumbnailMode) ===
                'cropped' && (
                <Check className="w-4 h-4 text-[#2652D0] shrink-0" />
              )}
            </button>

            {/* Option 2: Canvas (bordered, previous mode) */}
            <button
              onClick={() => {
                setLayerThumbnailModes((prev) => ({
                  ...prev,
                  [contextMenu.layerId]: 'canvas',
                }));
                setContextMenu(null);
              }}
              className="w-full px-3.5 py-2 text-left hover:bg-[#232D42] flex items-center justify-between transition-colors group"
            >
              <div className="flex-1 pr-2">
                <div className="font-medium text-[#FBFBFC] text-[11px]">
                  完整画布全景 (带边框)
                </div>
                <div className="text-[10px] text-[#8E9FCA] mt-0.5">
                  显示画板全局对应坐标与外轮廓边框
                </div>
              </div>
              {(layerThumbnailModes[contextMenu.layerId] || thumbnailMode) ===
                'canvas' && (
                <Check className="w-4 h-4 text-[#2652D0] shrink-0" />
              )}
            </button>

            {/* Batch Action: Apply to all */}
            <div className="border-t border-[#2B364D] mt-1 pt-1 px-1">
              <button
                onClick={() => {
                  const currentSelectedMode =
                    layerThumbnailModes[contextMenu.layerId] || thumbnailMode;
                  setThumbnailMode(currentSelectedMode);
                  setLayerThumbnailModes({});
                  setContextMenu(null);
                }}
                className="w-full px-2.5 py-1 text-left rounded-lg hover:bg-[#232D42] text-[10px] text-[#8E9FCA] hover:text-[#BAC5EB] transition-colors"
              >
                应用此模式至全部图层
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );

  /**
   * Renders a single layer row with live SVG thumbnail preview and drag-and-drop reordering
   */
  function renderLayerRow(layer: Layer) {
    const isActive = activeLayerId === layer.id;
    const isDragged = draggedLayerId === layer.id;
    const isDragTarget = dragOverInfo?.layerId === layer.id;
    const dropPos = isDragTarget ? dragOverInfo?.position : null;

    const holePaths = layer.cutouts.filter((c) => c.isHole).map((c) => c.d);
    const positiveElements = layer.positiveElements.concat(
      layer.cutouts.filter((c) => !c.isHole)
    );
    const compoundD = [layer.baseShape.d, ...holePaths].join(' ');

    const mode = layerThumbnailModes[layer.id] || thumbnailMode;

    let viewBox = `0 0 ${canvasWidth} ${canvasHeight}`;
    if (mode === 'cropped') {
      const allPaths = [
        layer.baseShape.d,
        ...positiveElements.map((e) => e.d),
        ...holePaths,
      ].filter(Boolean);
      const bbox = getPathBoundingBox(allPaths, canvasWidth, canvasHeight);
      viewBox = `${bbox.minX} ${bbox.minY} ${bbox.width} ${bbox.height}`;
    }

    return (
      <div
        key={layer.id}
        draggable={true}
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', layer.id);
          e.dataTransfer.effectAllowed = 'move';
          setDraggedLayerId(layer.id);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          const rect = e.currentTarget.getBoundingClientRect();
          const isAbove = e.clientY < rect.top + rect.height / 2;
          const pos = isAbove ? 'above' : 'below';
          if (dragOverInfo?.layerId !== layer.id || dragOverInfo?.position !== pos) {
            setDragOverInfo({ layerId: layer.id, position: pos });
          }
        }}
        onDragLeave={(e) => {
          // Check if relatedTarget is not within current element
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            if (dragOverInfo?.layerId === layer.id) {
              setDragOverInfo(null);
            }
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          const sourceId = e.dataTransfer.getData('text/plain') || draggedLayerId;
          if (sourceId && sourceId !== layer.id) {
            onReorderLayers?.(sourceId, layer.id, dragOverInfo?.position || 'above');
          }
          setDraggedLayerId(null);
          setDragOverInfo(null);
        }}
        onDragEnd={() => {
          setDraggedLayerId(null);
          setDragOverInfo(null);
        }}
        onClick={() => onSelectLayer(layer.id)}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setContextMenu({
            x: e.clientX,
            y: e.clientY,
            layerId: layer.id,
          });
        }}
        className={`relative flex items-center justify-between px-2.5 py-2 rounded-xl cursor-pointer transition-all ${
          isDragged
            ? 'opacity-40 scale-98 bg-[#182030] border border-dashed border-[#2652D0]'
            : isActive
            ? 'bg-[#20293D] border border-[#2652D0] text-[#FBFBFC] font-medium shadow-md shadow-blue-950/40'
            : 'hover:bg-[#1C2335] text-[#BAC5EB] border border-transparent'
        }`}
      >
        {/* Drop Insertion Line Indicator (明确提示拖拽插入位置) */}
        {isDragTarget && (
          <div
            className={`absolute left-1 right-1 h-1 bg-[#3A6DF0] rounded-full shadow-[0_0_10px_#3A6DF0] z-30 pointer-events-none transition-all ${
              dropPos === 'above' ? '-top-0.5' : '-bottom-0.5'
            }`}
          >
            <div className="absolute -left-1 -top-1 w-3 h-3 rounded-full bg-[#3A6DF0] shadow-sm" />
            <div className="absolute -right-1 -top-1 w-3 h-3 rounded-full bg-[#3A6DF0] shadow-sm" />
          </div>
        )}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Grip handle for drag-and-drop reordering */}
          <div
            className="cursor-grab active:cursor-grabbing text-[#4E5F85] hover:text-[#BAC5EB] shrink-0 p-0.5"
            title="按住拖拽排序图层"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-3.5 h-3.5" />
          </div>

          {/* Real-time Layer Vector Thumbnail Preview */}
          {mode === 'cropped' ? (
            <div
              title="缩略图（已自动裁剪透明区域，右键展开菜单）"
              className="w-10 h-10 shrink-0 overflow-hidden flex items-center justify-center p-0.5 rounded-lg hover:bg-white/5 transition-colors"
            >
              <svg
                viewBox={viewBox}
                className="w-full h-full pointer-events-none drop-shadow-sm"
                preserveAspectRatio="xMidYMid meet"
              >
                {layer.baseShape.d && (
                  <path
                    d={compoundD}
                    fill={layer.color}
                    fillRule="evenodd"
                  />
                )}
                {positiveElements.map((elem) => (
                  <path
                    key={elem.id}
                    d={elem.d}
                    fill={elem.fillColor || layer.color}
                  />
                ))}
              </svg>
            </div>
          ) : (
            <div
              title="缩略图（带边框全景，右键展开菜单）"
              className="w-10 h-10 rounded-lg bg-[#0F131D] border border-[#2B364D] shrink-0 overflow-hidden flex items-center justify-center shadow-inner"
            >
              <svg
                viewBox={viewBox}
                className="w-full h-full pointer-events-none"
              >
                {layer.baseShape.d && (
                  <path
                    d={compoundD}
                    fill={layer.color}
                    fillRule="evenodd"
                  />
                )}
                {positiveElements.map((elem) => (
                  <path
                    key={elem.id}
                    d={elem.d}
                    fill={elem.fillColor || layer.color}
                  />
                ))}
              </svg>
            </div>
          )}

          {/* Name & Layer Colors List (无需写出色号，名字下方用圆点列举出所包括的色彩) */}
          <div className="flex flex-col min-w-0 flex-1">
            {editingItemId === layer.id ? (
              <input
                type="text"
                value={editingName}
                autoFocus
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={() => commitRename(layer.id)}
                onKeyDown={(e) => e.key === 'Enter' && commitRename(layer.id)}
                onClick={(e) => e.stopPropagation()}
                className="px-1.5 py-0.5 bg-[#0F131D] text-white text-xs rounded border border-[#2652D0] outline-none"
              />
            ) : (
              <div
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  startRename(layer.id, layer.name);
                }}
                className="truncate text-[11px] font-medium leading-tight flex items-center gap-1.5"
                title={`${layer.name} (右键菜单，双击重命名)`}
              >
                <span className="truncate">{layer.name}</span>
                {layer.drawings && layer.drawings.length > 0 && (
                  <span
                    className="text-[9px] px-1 py-0.2 rounded bg-[#2652D0]/40 text-[#BAC5EB] font-mono shrink-0"
                    title={`含 ${layer.drawings.length} 条手绘笔迹 (蒙版限制)`}
                  >
                    笔迹
                  </span>
                )}
              </div>
            )}

            {/* 图层的名字下方用圆点列举出所包括的色彩 (无需写出色号) */}
            {(() => {
              const seen = new Set<string>();
              const cols: string[] = [];
              if (layer.color) {
                const c = layer.color.toLowerCase();
                seen.add(c);
                cols.push(layer.color);
              }
              layer.positiveElements.forEach((e) => {
                if (e.fillColor && !seen.has(e.fillColor.toLowerCase())) {
                  seen.add(e.fillColor.toLowerCase());
                  cols.push(e.fillColor);
                }
              });
              layer.cutouts.forEach((c) => {
                if (!c.isHole && c.fillColor && !seen.has(c.fillColor.toLowerCase())) {
                  seen.add(c.fillColor.toLowerCase());
                  cols.push(c.fillColor);
                }
              });
              layer.drawings?.forEach((d) => {
                if (d.color && !seen.has(d.color.toLowerCase())) {
                  seen.add(d.color.toLowerCase());
                  cols.push(d.color);
                }
              });

              return (
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="flex items-center gap-1">
                    {cols.map((hex, ci) => (
                      <span
                        key={`c_${layer.id}_${ci}`}
                        className="w-2.5 h-2.5 rounded-full inline-block border border-white/40 shadow-xs transition-transform hover:scale-130"
                        style={{ backgroundColor: hex }}
                        title={colorNotes[hex.toLowerCase()] || '图层所含颜色'}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-[#7E8FB8] font-mono ml-auto">
                    {Math.round(layer.opacity * 100)}%
                  </span>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Layer Visibility & Lock Toggles */}
        <div
          className="flex items-center gap-1 shrink-0 ml-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => onUpdateLayer(layer.id, { visible: !layer.visible })}
            className={`p-1 rounded-lg hover:bg-[#28324A] transition-colors ${
              layer.visible ? 'text-[#BAC5EB]' : 'text-[#4B5A80]'
            }`}
            title={layer.visible ? '隐藏图层' : '显示图层'}
          >
            {layer.visible ? (
              <Eye className="w-3.5 h-3.5" />
            ) : (
              <EyeOff className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            onClick={() => onUpdateLayer(layer.id, { locked: !layer.locked })}
            className={`p-1 rounded-lg hover:bg-[#28324A] transition-colors ${
              layer.locked ? 'text-[#EB8E88]' : 'text-[#4B5A80]'
            }`}
            title={layer.locked ? '解锁图层' : '锁定图层'}
          >
            {layer.locked ? (
              <Lock className="w-3.5 h-3.5" />
            ) : (
              <Unlock className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>
    );
  }
};
