/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  Copy,
  Check,
  FileCode,
  Image as ImageIcon,
  Sliders,
  Plus,
  X,
  FilePlus,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Palette,
  FolderOpen,
  Save,
  Gamepad2,
  CloudCheck,
} from 'lucide-react';
import { PRESET_PROJECTS } from '../utils/presetTemplates';
import { SKINS, WorkbenchSkin } from '../utils/skins';

export interface DocumentTabItem {
  id: string;
  name: string;
  width: number;
  height: number;
}

interface TopBarProps {
  documents: DocumentTabItem[];
  activeDocId: string;
  onSelectDocument: (docId: string) => void;
  onNewDocument: (name?: string, width?: number, height?: number) => void;
  onCloseDocument: (docId: string) => void;
  onRenameDocument: (docId: string, newName: string) => void;
  onOpenPreset: (presetId: string) => void;
  onOpenProjectFile: () => void;
  onSaveProjectFile: () => void;
  saveStatus: 'idle' | 'saving' | 'saved';
  onOpenGodotExport: () => void;
  currentWidth: number;
  currentHeight: number;
  onUpdateCanvasSize: (w: number, h: number) => void;
  currentSkin?: WorkbenchSkin;
  onSelectSkin?: (skin: WorkbenchSkin) => void;
  zoom: number;
  onZoomChange: (z: number) => void;
  onResetZoom: () => void;
  onFitZoom?: () => void;
  onOpenExportModal: () => void;
  onQuickCopySvg: () => void;
  onQuickDownloadSvg?: () => void;
  onQuickDownloadPng?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  documents,
  activeDocId,
  onSelectDocument,
  onNewDocument,
  onCloseDocument,
  onRenameDocument,
  onOpenPreset,
  onOpenProjectFile,
  onSaveProjectFile,
  saveStatus,
  onOpenGodotExport,
  currentWidth,
  currentHeight,
  onUpdateCanvasSize,
  currentSkin = 'indigo',
  onSelectSkin,
  zoom,
  onZoomChange,
  onResetZoom,
  onFitZoom,
  onOpenExportModal,
  onQuickCopySvg,
  onQuickDownloadSvg,
  onQuickDownloadPng,
}) => {
  const [copiedToast, setCopiedToast] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [showCanvasSubmenu, setShowCanvasSubmenu] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showNewDocDialog, setShowNewDocDialog] = useState(false);

  // New Doc Dialog fields
  const [newDocName, setNewDocName] = useState('新建剪纸');
  const [newDocWidth, setNewDocWidth] = useState(800);
  const [newDocHeight, setNewDocHeight] = useState(800);

  // Settings menu fields (canvas size)
  const [customWidth, setCustomWidth] = useState(currentWidth);
  const [customHeight, setCustomHeight] = useState(currentHeight);

  // Inline rename document tab
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editingDocName, setEditingDocName] = useState('');

  const exportMenuRef = useRef<HTMLDivElement>(null);
  const fileMenuRef = useRef<HTMLDivElement>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);

  // Keep settings dimensions in sync with current project
  useEffect(() => {
    setCustomWidth(currentWidth);
    setCustomHeight(currentHeight);
  }, [currentWidth, currentHeight]);

  const handleCopy = () => {
    onQuickCopySvg();
    setCopiedToast(true);
    setTimeout(() => {
      setCopiedToast(false);
      setShowExportMenu(false);
    }, 1500);
  };

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (exportMenuRef.current && !exportMenuRef.current.contains(target)) {
        setShowExportMenu(false);
      }
      if (fileMenuRef.current && !fileMenuRef.current.contains(target)) {
        setShowFileMenu(false);
        setShowCanvasSubmenu(false);
      }
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(target)) {
        setShowSettingsMenu(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleApplyCanvasSize = () => {
    const w = Math.max(200, Math.min(customWidth, 4000));
    const h = Math.max(200, Math.min(customHeight, 4000));
    onUpdateCanvasSize(w, h);
    setShowCanvasSubmenu(false);
    setShowFileMenu(false);
  };

  const handleCreateDocument = () => {
    onNewDocument(
      newDocName.trim() || `新建剪纸 ${documents.length + 1}`,
      newDocWidth,
      newDocHeight
    );
    setShowNewDocDialog(false);
  };

  return (
    <header className="relative h-13 bg-(--ui-panel) border-b border-(--ui-divider) flex items-center justify-between text-(--ui-text) select-none z-40 shrink-0 px-2 sm:px-4 gap-2">
      {/* 1. Left: Brand Icon + 文件 / 设置 (皮肤选择) Menu Tabs */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Brand Seal */}
        <div className="flex items-center gap-2 pr-2 border-r border-(--ui-divider)">
          <div className="w-6 h-6 rounded-lg bg-(--ui-accent) flex items-center justify-center text-white text-[12px] font-bold shadow-md shadow-blue-950/60 border border-(--ui-text-2)/40">
            ❖
          </div>
          <span className="text-sm font-bold tracking-tight text-(--ui-strong) hidden md:inline">
            Weave 剪纸工坊
          </span>
          <span
            className={`hidden lg:flex items-center gap-1 text-[10px] ${saveStatus === 'saving' ? 'text-(--ui-muted)' : 'text-[#438B6E]'}`}
            data-tip="作品自动保存在本浏览器中；Ctrl+S 另存为 .weave.json 文件"
          >
            <CloudCheck className="w-3 h-3" />
            {saveStatus === 'saving' ? '保存中' : '已保存'}
          </span>
        </div>

        {/* Menu Tab 1: 文件 (File Menu) */}
        <div className="relative" ref={fileMenuRef}>
          <button
            onClick={() => {
              setShowFileMenu(!showFileMenu);
              setShowCanvasSubmenu(false);
              setShowSettingsMenu(false);
            }}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              showFileMenu
                ? 'bg-(--ui-hover) text-(--ui-strong)'
                : 'text-(--ui-text-2) hover:bg-(--ui-raised) hover:text-(--ui-strong)'
            }`}
          >
            <span>文件</span>
            <ChevronDown className="w-3 h-3 text-(--ui-muted)" />
          </button>

          {/* File Dropdown */}
          {showFileMenu && (
            <div className="absolute left-0 top-full mt-1 w-56 bg-(--ui-panel) border border-(--ui-border-strong) rounded-xl shadow-2xl py-1 z-50 text-xs backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100">
              <button
                onClick={() => {
                  setShowFileMenu(false);
                  setShowCanvasSubmenu(false);
                  setShowNewDocDialog(true);
                }}
                className="w-full px-3 py-2 text-left hover:bg-(--ui-hover) text-(--ui-strong) flex items-center gap-2 transition-colors"
              >
                <FilePlus className="w-3.5 h-3.5 text-(--ui-accent)" />
                <div className="flex-1 flex items-center justify-between">
                  <span className="font-medium">新建画布…</span>
                  <span className="text-[10px] text-(--ui-muted)">Alt+N</span>
                </div>
              </button>

              <button
                onClick={() => {
                  setShowFileMenu(false);
                  onOpenProjectFile();
                }}
                className="w-full px-3 py-2 text-left hover:bg-(--ui-hover) text-(--ui-strong) flex items-center gap-2 transition-colors"
              >
                <FolderOpen className="w-3.5 h-3.5 text-(--ui-muted)" />
                <div className="flex-1 flex items-center justify-between">
                  <span>打开项目…</span>
                  <span className="text-[10px] text-(--ui-muted)">Ctrl+O</span>
                </div>
              </button>

              <button
                onClick={() => {
                  setShowFileMenu(false);
                  onSaveProjectFile();
                }}
                className="w-full px-3 py-2 text-left hover:bg-(--ui-hover) text-(--ui-strong) flex items-center gap-2 transition-colors"
              >
                <Save className="w-3.5 h-3.5 text-(--ui-muted)" />
                <div className="flex-1 flex items-center justify-between">
                  <span>保存项目</span>
                  <span className="text-[10px] text-(--ui-muted)">Ctrl+S</span>
                </div>
              </button>

              <button
                onClick={() => {
                  setShowFileMenu(false);
                  onOpenGodotExport();
                }}
                className="w-full px-3 py-2 text-left hover:bg-(--ui-hover) text-(--ui-strong) flex items-center gap-2 transition-colors"
              >
                <Gamepad2 className="w-3.5 h-3.5 text-[#438B6E]" />
                <span>导出到 Godot…</span>
              </button>

              <div className="border-t border-(--ui-divider) my-1" />
              <div className="px-3 py-1 text-[10px] font-semibold text-(--ui-muted)">
                预设
              </div>

              {PRESET_PROJECTS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => {
                    onOpenPreset(preset.id);
                    setShowFileMenu(false);
                    setShowCanvasSubmenu(false);
                  }}
                  className="w-full px-3 py-1.5 text-left hover:bg-(--ui-hover) text-(--ui-text-2) hover:text-(--ui-strong) flex items-center gap-2 transition-colors text-[11px]"
                >
                  <Sparkles className="w-3 h-3 text-(--ui-accent-2)" />
                  <span className="truncate">{preset.name}</span>
                </button>
              ))}

              <div className="border-t border-(--ui-divider) my-1" />

              {/* “画布大小与设置”点击后展开二级菜单，而不是跳转到“设置”tab！ */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCanvasSubmenu(!showCanvasSubmenu);
                  }}
                  className={`w-full px-3 py-2 text-left flex items-center justify-between transition-colors ${
                    showCanvasSubmenu
                      ? 'bg-(--ui-hover) text-(--ui-strong)'
                      : 'hover:bg-(--ui-hover) text-(--ui-text-2) hover:text-(--ui-strong)'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Sliders className="w-3.5 h-3.5 text-(--ui-muted)" />
                    <span>画布尺寸</span>
                  </div>
                  <ChevronRight
                    className={`w-3.5 h-3.5 text-(--ui-muted) transition-transform ${
                      showCanvasSubmenu ? 'rotate-90 sm:rotate-0' : ''
                    }`}
                  />
                </button>

                {/* 二级菜单 (Flyout Submenu for Canvas Dimensions) */}
                {showCanvasSubmenu && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="sm:absolute sm:left-full sm:top-0 sm:ml-1 mt-1 sm:mt-0 w-68 bg-(--ui-panel) border border-(--ui-border-strong) rounded-xl shadow-2xl p-3 z-50 text-xs backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-(--ui-divider) font-semibold text-(--ui-strong)">
                      <div className="flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5 text-(--ui-accent)" />
                        <span>画板尺寸 (宽 × 高)</span>
                      </div>
                      <span className="text-[10px] text-(--ui-muted) font-mono">
                        {currentWidth} × {currentHeight}
                      </span>
                    </div>

                    {/* Width & Height inputs */}
                    <div className="grid grid-cols-2 gap-2 py-2">
                      <div>
                        <label className="text-[10px] text-(--ui-muted) block mb-1">
                          宽度 (px):
                        </label>
                        <input
                          type="number"
                          min={200}
                          max={4000}
                          step={50}
                          value={customWidth}
                          onChange={(e) => setCustomWidth(Number(e.target.value))}
                          className="w-full bg-(--ui-input) border border-(--ui-border) rounded-lg px-2 py-1 text-(--ui-strong) text-xs outline-none focus:border-(--ui-accent)"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-(--ui-muted) block mb-1">
                          高度 (px):
                        </label>
                        <input
                          type="number"
                          min={200}
                          max={4000}
                          step={50}
                          value={customHeight}
                          onChange={(e) => setCustomHeight(Number(e.target.value))}
                          className="w-full bg-(--ui-input) border border-(--ui-border) rounded-lg px-2 py-1 text-(--ui-strong) text-xs outline-none focus:border-(--ui-accent)"
                        />
                      </div>
                    </div>

                    {/* Quick Presets */}
                    <div className="space-y-1 pt-1 border-t border-(--ui-divider)">
                      <div className="text-[10px] text-(--ui-muted) mb-1">常用画板规格:</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { label: '800 × 800 (方幅)', w: 800, h: 800 },
                          { label: '1000 × 800 (横展)', w: 1000, h: 800 },
                          { label: '750 × 1000 (立轴)', w: 750, h: 1000 },
                          { label: '1200 × 675 (宽幅)', w: 1200, h: 675 },
                        ].map((p) => (
                          <button
                            key={p.label}
                            onClick={() => {
                              setCustomWidth(p.w);
                              setCustomHeight(p.h);
                              onUpdateCanvasSize(p.w, p.h);
                              setShowCanvasSubmenu(false);
                              setShowFileMenu(false);
                            }}
                            className="px-2 py-1 rounded bg-(--ui-raised) hover:bg-(--ui-hover) text-(--ui-text-2) hover:text-(--ui-strong) text-[10px] text-left transition-colors border border-(--ui-border)"
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Apply button */}
                    <button
                      onClick={handleApplyCanvasSize}
                      className="w-full mt-2.5 py-1.5 bg-(--ui-accent) hover:bg-(--ui-accent-hover) text-white rounded-lg font-medium text-xs shadow-md transition-colors"
                    >
                      应用新画板尺寸
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Menu Tab 2: 设置 (设置tab应当是有关编辑器皮肤选择的！) */}
        <div className="relative" ref={settingsMenuRef}>
          <button
            onClick={() => {
              setShowSettingsMenu(!showSettingsMenu);
              setShowFileMenu(false);
              setShowCanvasSubmenu(false);
            }}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              showSettingsMenu
                ? 'bg-(--ui-hover) text-(--ui-strong)'
                : 'text-(--ui-text-2) hover:bg-(--ui-raised) hover:text-(--ui-strong)'
            }`}
          >
            <Palette className="w-3.5 h-3.5 text-(--ui-accent-2)" />
            <span>皮肤</span>
            <ChevronDown className="w-3 h-3 text-(--ui-muted)" />
          </button>

          {showSettingsMenu && (
            <div className="absolute left-0 top-full mt-1 w-[380px] bg-(--ui-panel) border border-(--ui-border-strong) rounded-xl shadow-2xl p-3 z-50 text-xs">
              <div className="text-[11px] font-semibold text-(--ui-strong) mb-2">编辑器皮肤</div>
              {(['dark', 'light'] as const).map((tone) => (
                <div key={tone} className="mb-2 last:mb-0">
                  <div className="text-[10px] text-(--ui-muted) mb-1">{tone === 'dark' ? '深色' : '浅色'}</div>
                  <div className="grid grid-cols-3 gap-2">
                    {SKINS.filter((sk) => sk.tone === tone).map((sk) => {
                      const c = sk.colors;
                      const isActive = currentSkin === sk.id;
                      return (
                        <button
                          key={sk.id}
                          onClick={() => onSelectSkin?.(sk.id)}
                          data-tip={sk.desc}
                          className={`rounded-lg p-1 border-2 text-left transition-colors ${
                            isActive ? 'border-(--ui-accent)' : 'border-transparent hover:border-(--ui-border-strong)'
                          }`}
                        >
                          <div className="h-14 rounded-md overflow-hidden flex border" style={{ background: c.app, borderColor: c.border }}>
                            <div className="w-3 flex flex-col items-center gap-0.5 pt-1" style={{ background: c.panel }}>
                              <span className="w-1.5 h-1.5 rounded-sm" style={{ background: c.accent }} />
                              <span className="w-1.5 h-1.5 rounded-sm" style={{ background: c.raised }} />
                              <span className="w-1.5 h-1.5 rounded-sm" style={{ background: c.accent2 }} />
                            </div>
                            <div className="flex-1 flex items-center justify-center">
                              <span className="w-6 h-7 rounded-sm" style={{ background: '#FAF8F2' }} />
                            </div>
                            <div className="w-7 p-1 space-y-0.5" style={{ background: c.panel }}>
                              <span className="block h-1 rounded-sm" style={{ background: c.accent }} />
                              <span className="block h-1 rounded-sm" style={{ background: c.muted }} />
                              <span className="block h-1 rounded-sm" style={{ background: c.faint }} />
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-1 px-0.5">
                            <span className="text-[11px] text-(--ui-strong)">{sk.name}</span>
                            {isActive && <Check className="w-3 h-3 text-(--ui-accent)" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 2. Center: SAI-Style Document Tabs (多文件选项卡栏，点击切换) */}
      <div className="flex-1 flex items-center overflow-x-auto no-scrollbar gap-1 px-2 border-x border-(--ui-divider) h-full">
        {documents.map((doc) => {
          const isActive = doc.id === activeDocId;
          const isEditing = editingDocId === doc.id;

          return (
            <div
              key={doc.id}
              onClick={() => onSelectDocument(doc.id)}
              className={`h-8.5 px-3 flex items-center gap-1.5 rounded-t-lg cursor-pointer transition-all border-t border-x text-xs shrink-0 select-none group relative ${
                isActive
                  ? 'bg-(--ui-raised) border-(--ui-accent) text-(--ui-strong) font-medium shadow-md'
                  : 'bg-(--ui-panel-2) border-transparent text-(--ui-muted) hover:bg-(--ui-raised) hover:text-(--ui-text-2)'
              }`}
            >
              {/* Tab Diamond Motif */}
              <span
                className={`text-[9px] font-bold ${
                  isActive ? 'text-(--ui-accent)' : 'text-(--ui-faint)'
                }`}
              >
                ❖
              </span>

              {/* Title / Inline Edit */}
              {isEditing ? (
                <input
                  type="text"
                  value={editingDocName}
                  autoFocus
                  onChange={(e) => setEditingDocName(e.target.value)}
                  onBlur={() => {
                    if (editingDocName.trim()) {
                      onRenameDocument(doc.id, editingDocName.trim());
                    }
                    setEditingDocId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (editingDocName.trim()) {
                        onRenameDocument(doc.id, editingDocName.trim());
                      }
                      setEditingDocId(null);
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="px-1 py-0.5 bg-(--ui-input) text-(--ui-strong) text-xs outline-none rounded border border-(--ui-accent) w-24"
                />
              ) : (
                <span
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setEditingDocId(doc.id);
                    setEditingDocName(doc.name);
                  }}
                  className="truncate max-w-[120px] text-[11px]"
                  data-tip={`${doc.name} (${doc.width}×${doc.height}) - 双击重命名`}
                >
                  {doc.name}
                </span>
              )}

              {/* Close Tab Button (X) */}
              {documents.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseDocument(doc.id);
                  }}
                  className="p-0.5 rounded hover:bg-(--ui-hover) text-(--ui-muted) hover:text-(--ui-strong) transition-colors"
                  data-tip="关闭标签页"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}

        {/* Plus Button to Quick Create New Document Tab */}
        <button
          onClick={() => onNewDocument()}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-(--ui-raised) text-(--ui-muted) hover:text-(--ui-strong) transition-colors shrink-0"
          data-tip="新建空白画布标签页"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 3. Right: Zoom (放缩) + Unified Export Square Button */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Zoom Controls */}
        <div className="flex items-center bg-(--ui-raised) rounded-xl p-0.5 border border-(--ui-border) text-(--ui-text-2)">
          <button
            onClick={() => onZoomChange(Math.max(zoom - 0.15, 0.25))}
            className="p-1.5 rounded-lg hover:bg-(--ui-hover) hover:text-(--ui-strong) transition-colors"
            data-tip="缩小画布"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onResetZoom}
            className="px-2 py-0.5 font-mono text-[11px] text-(--ui-strong) hover:bg-(--ui-hover) rounded-md transition-colors"
            data-tip="重置缩放至100%"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={() => onZoomChange(Math.min(zoom + 0.15, 3.5))}
            className="p-1.5 rounded-lg hover:bg-(--ui-hover) hover:text-(--ui-strong) transition-colors"
            data-tip="放大画布"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          {onFitZoom && (
            <button
              onClick={onFitZoom}
              className="p-1.5 rounded-lg hover:bg-(--ui-hover) hover:text-(--ui-strong) transition-colors border-l border-(--ui-border) ml-0.5"
              data-tip="适应画板全屏"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* 统一整合到一个方块内的导出按钮，点击展开下拉菜单 */}
        <div className="relative" ref={exportMenuRef}>
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all shadow-md cursor-pointer ${
              showExportMenu
                ? 'bg-(--ui-accent-hover) text-white ring-2 ring-(--ui-text-2)/60 scale-105'
                : 'bg-(--ui-accent) hover:bg-(--ui-accent-hover) text-white shadow-blue-950/60 border border-(--ui-text-2)/40 hover:scale-105'
            }`}
            data-tip="导出菜单（点击展开）"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Dropdown Menu (展开下拉菜单) */}
          {showExportMenu && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-(--ui-panel)/98 border border-(--ui-border-strong) rounded-2xl shadow-2xl py-1.5 z-50 text-xs backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-1.5 text-[10px] font-semibold text-(--ui-muted) border-b border-(--ui-border) flex items-center justify-between">
                <span>导出</span>
              </div>

              {/* Option 1: 复制 SVG 源码 */}
              <button data-tip="直接贴入矢量编辑器或代码"
                onClick={handleCopy}
                className="w-full px-3.5 py-2.5 text-left hover:bg-(--ui-hover) text-(--ui-text-2) hover:text-(--ui-strong) flex items-center justify-between transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <Copy className="w-4 h-4 text-(--ui-muted) group-hover:text-(--ui-text-2)" />
                  <div>
                    <div className="font-medium text-(--ui-strong) text-[11px]">复制 SVG 源码</div>
                  </div>
                </div>
                {copiedToast && <Check className="w-4 h-4 text-[#438B6E]" />}
              </button>

              {/* Option 2: 下载 .SVG 矢量文件 */}
              {onQuickDownloadSvg && (
                <button data-tip="纯净矢量路径 · 无损缩放"
                  onClick={() => {
                    onQuickDownloadSvg();
                    setShowExportMenu(false);
                  }}
                  className="w-full px-3.5 py-2.5 text-left hover:bg-(--ui-hover) text-(--ui-text-2) hover:text-(--ui-strong) flex items-center gap-2.5 transition-colors group"
                >
                  <FileCode className="w-4 h-4 text-(--ui-accent) group-hover:scale-110 transition-transform" />
                  <div>
                    <div className="font-medium text-(--ui-strong) text-[11px]">下载 .SVG 矢量图</div>
                  </div>
                </button>
              )}

              {/* Option 3: 下载 .PNG 高清图片 */}
              {onQuickDownloadPng && (
                <button data-tip="2x 高分辨率透明底图"
                  onClick={() => {
                    onQuickDownloadPng();
                    setShowExportMenu(false);
                  }}
                  className="w-full px-3.5 py-2.5 text-left hover:bg-(--ui-hover) text-(--ui-text-2) hover:text-(--ui-strong) flex items-center gap-2.5 transition-colors group"
                >
                  <ImageIcon className="w-4 h-4 text-(--ui-accent-2) group-hover:scale-110 transition-transform" />
                  <div>
                    <div className="font-medium text-(--ui-strong) text-[11px]">下载 .PNG 高清图</div>
                  </div>
                </button>
              )}

              <button data-tip="每个物件一个 .tscn · 部件 PNG · 深度 z_index"
                onClick={() => {
                  onOpenGodotExport();
                  setShowExportMenu(false);
                }}
                className="w-full px-3.5 py-2.5 text-left hover:bg-(--ui-hover) text-(--ui-text-2) hover:text-(--ui-strong) flex items-center gap-2.5 transition-colors group border-t border-(--ui-border)"
              >
                <Gamepad2 className="w-4 h-4 text-[#438B6E] group-hover:scale-110 transition-transform" />
                <div>
                  <div className="font-medium text-(--ui-strong) text-[11px]">导出到 Godot 4</div>
                </div>
              </button>

              {/* Option 4: 更多导出选项与设置 */}
              <div className="border-t border-(--ui-border) mt-1 pt-1">
                <button
                  onClick={() => {
                    onOpenExportModal();
                    setShowExportMenu(false);
                  }}
                  className="w-full px-3.5 py-2 text-left hover:bg-(--ui-hover) text-(--ui-muted) hover:text-(--ui-strong) flex items-center gap-2 transition-colors text-[11px]"
                >
                  <Sliders className="w-3.5 h-3.5 text-(--ui-muted)" />
                  <span>更多画质与格式设置...</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. Modal Dialog for "新建文件" */}
      {showNewDocDialog && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-100"
          onClick={() => setShowNewDocDialog(false)}
        >
          <div
            className="bg-(--ui-panel) border border-(--ui-border) rounded-2xl w-full max-w-md p-5 shadow-2xl text-(--ui-strong) select-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-(--ui-divider)">
              <div className="flex items-center gap-2">
                <FilePlus className="w-5 h-5 text-(--ui-accent)" />
                <h3 className="font-bold text-sm text-(--ui-strong)">新建剪纸画布</h3>
              </div>
              <button
                onClick={() => setShowNewDocDialog(false)}
                className="p-1 rounded-lg hover:bg-(--ui-hover) text-(--ui-muted) hover:text-(--ui-strong)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 py-4 text-xs">
              <div>
                <label className="text-(--ui-muted) block mb-1">文件名称:</label>
                <input
                  type="text"
                  value={newDocName}
                  onChange={(e) => setNewDocName(e.target.value)}
                  className="w-full bg-(--ui-input) border border-(--ui-border) rounded-xl px-3 py-2 text-(--ui-strong) text-xs outline-none focus:border-(--ui-accent)"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-(--ui-muted) block mb-1">宽度 (px):</label>
                  <input
                    type="number"
                    min={200}
                    max={4000}
                    step={50}
                    value={newDocWidth}
                    onChange={(e) => setNewDocWidth(Number(e.target.value))}
                    className="w-full bg-(--ui-input) border border-(--ui-border) rounded-xl px-3 py-2 text-(--ui-strong) text-xs outline-none focus:border-(--ui-accent)"
                  />
                </div>
                <div>
                  <label className="text-(--ui-muted) block mb-1">高度 (px):</label>
                  <input
                    type="number"
                    min={200}
                    max={4000}
                    step={50}
                    value={newDocHeight}
                    onChange={(e) => setNewDocHeight(Number(e.target.value))}
                    className="w-full bg-(--ui-input) border border-(--ui-border) rounded-xl px-3 py-2 text-(--ui-strong) text-xs outline-none focus:border-(--ui-accent)"
                  />
                </div>
              </div>

              {/* Preset dimensions */}
              <div>
                <span className="text-(--ui-muted) block mb-1.5">标准民俗尺幅预设:</span>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { name: '800 × 800 (传统方窗)', w: 800, h: 800 },
                    { name: '1000 × 800 (工坊横屏)', w: 1000, h: 800 },
                    { name: '750 × 1000 (宣纸挂轴)', w: 750, h: 1000 },
                    { name: '1200 × 675 (现代宽幅)', w: 1200, h: 675 },
                  ].map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => {
                        setNewDocWidth(preset.w);
                        setNewDocHeight(preset.h);
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-(--ui-raised) hover:bg-(--ui-hover) text-(--ui-text-2) hover:text-(--ui-strong) border border-(--ui-border) text-left transition-colors"
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-(--ui-divider)">
              <button
                onClick={() => setShowNewDocDialog(false)}
                className="px-4 py-2 rounded-xl bg-(--ui-raised) hover:bg-(--ui-hover) text-(--ui-muted) hover:text-(--ui-strong) text-xs transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreateDocument}
                className="px-5 py-2 rounded-xl bg-(--ui-accent) hover:bg-(--ui-accent-hover) text-white font-semibold text-xs shadow-md shadow-blue-950/60 transition-colors"
              >
                创建画布
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
