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

export type WorkbenchSkin = 'indigo' | 'cinnabar' | 'celadon' | 'wisteria' | 'ebony';

export const WORKBENCH_SKINS: {
  id: WorkbenchSkin;
  name: string;
  tag: string;
  desc: string;
  colors: [string, string, string]; // primary, secondary, background
}[] = [
  {
    id: 'indigo',
    name: '扎染蓝印',
    tag: '经典工坊',
    desc: '蓝印花布靛青与紫藤薄蓝，素练宣纸底',
    colors: ['#2652D0', '#BAC5EB', '#161B29'],
  },
  {
    id: 'cinnabar',
    name: '朱砂玄墨',
    tag: '正统金石',
    desc: '正统朱红印泥配玄墨金石案台，喜庆古雅',
    colors: ['#D23838', '#EB8E88', '#1A1418'],
  },
  {
    id: 'celadon',
    name: '青绿山水',
    tag: '宋韵古风',
    desc: '千里江山冷杉深翠配湖水青绿，宁静致远',
    colors: ['#1B523D', '#438B6E', '#111A16'],
  },
  {
    id: 'wisteria',
    name: '紫藤花影',
    tag: '雅致绛紫',
    desc: '深绛紫茄配粉藕丁香，江南花影摇曳',
    colors: ['#5E365A', '#BAC5EB', '#1D141F'],
  },
  {
    id: 'ebony',
    name: '暖木纸香',
    tag: '沉香木案',
    desc: '乌木刻台配蜜蜡明黄与暖麦宣纸，沉稳温润',
    colors: ['#C4831B', '#E8DEC8', '#1C1814'],
  },
];

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
    <header className="h-13 bg-[#161B29] border-b border-[#263147] flex items-center justify-between text-[#CAD0DB] select-none z-30 shrink-0 px-2 sm:px-4 gap-2">
      {/* 1. Left: Brand Icon + 文件 / 设置 (皮肤选择) Menu Tabs */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Brand Seal */}
        <div className="flex items-center gap-2 pr-2 border-r border-[#263147]">
          <div className="w-6 h-6 rounded-lg bg-[#2652D0] flex items-center justify-center text-white text-[12px] font-bold shadow-md shadow-blue-950/60 border border-[#BAC5EB]/40">
            ❖
          </div>
          <span className="text-sm font-bold tracking-tight text-[#FBFBFC] hidden md:inline">
            Weave 剪纸工坊
          </span>
          <span
            className={`hidden lg:flex items-center gap-1 text-[10px] ${saveStatus === 'saving' ? 'text-[#7E8FB8]' : 'text-[#438B6E]'}`}
            title="作品自动保存在本浏览器中；Ctrl+S 另存为 .weave.json 文件"
          >
            <CloudCheck className="w-3 h-3" />
            {saveStatus === 'saving' ? '保存中' : '已自动保存'}
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
                ? 'bg-[#232D42] text-[#FBFBFC]'
                : 'text-[#BAC5EB] hover:bg-[#1E2538] hover:text-[#FBFBFC]'
            }`}
          >
            <span>文件</span>
            <ChevronDown className="w-3 h-3 text-[#7E8FB8]" />
          </button>

          {/* File Dropdown */}
          {showFileMenu && (
            <div className="absolute left-0 top-full mt-1 w-56 bg-[#161B29] border border-[#3A4766] rounded-xl shadow-2xl py-1 z-50 text-xs backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100">
              <button
                onClick={() => {
                  setShowFileMenu(false);
                  setShowCanvasSubmenu(false);
                  setShowNewDocDialog(true);
                }}
                className="w-full px-3 py-2 text-left hover:bg-[#232D42] text-[#FBFBFC] flex items-center gap-2 transition-colors"
              >
                <FilePlus className="w-3.5 h-3.5 text-[#2652D0]" />
                <div className="flex-1 flex items-center justify-between">
                  <span className="font-medium">新建剪纸文件...</span>
                  <span className="text-[10px] text-[#7E8FB8]">Alt+N</span>
                </div>
              </button>

              <button
                onClick={() => {
                  setShowFileMenu(false);
                  onOpenProjectFile();
                }}
                className="w-full px-3 py-2 text-left hover:bg-[#232D42] text-[#FBFBFC] flex items-center gap-2 transition-colors"
              >
                <FolderOpen className="w-3.5 h-3.5 text-[#8E9FCA]" />
                <div className="flex-1 flex items-center justify-between">
                  <span>打开项目 (.weave.json)...</span>
                  <span className="text-[10px] text-[#7E8FB8]">Ctrl+O</span>
                </div>
              </button>

              <button
                onClick={() => {
                  setShowFileMenu(false);
                  onSaveProjectFile();
                }}
                className="w-full px-3 py-2 text-left hover:bg-[#232D42] text-[#FBFBFC] flex items-center gap-2 transition-colors"
              >
                <Save className="w-3.5 h-3.5 text-[#8E9FCA]" />
                <div className="flex-1 flex items-center justify-between">
                  <span>保存项目到本地文件</span>
                  <span className="text-[10px] text-[#7E8FB8]">Ctrl+S</span>
                </div>
              </button>

              <button
                onClick={() => {
                  setShowFileMenu(false);
                  onOpenGodotExport();
                }}
                className="w-full px-3 py-2 text-left hover:bg-[#232D42] text-[#FBFBFC] flex items-center gap-2 transition-colors"
              >
                <Gamepad2 className="w-3.5 h-3.5 text-[#438B6E]" />
                <span>导出到 Godot...</span>
              </button>

              <div className="border-t border-[#263147] my-1" />
              <div className="px-3 py-1 text-[10px] font-semibold text-[#7E8FB8]">
                打开预设工坊文件
              </div>

              {PRESET_PROJECTS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => {
                    onOpenPreset(preset.id);
                    setShowFileMenu(false);
                    setShowCanvasSubmenu(false);
                  }}
                  className="w-full px-3 py-1.5 text-left hover:bg-[#232D42] text-[#BAC5EB] hover:text-white flex items-center gap-2 transition-colors text-[11px]"
                >
                  <Sparkles className="w-3 h-3 text-[#EB8E88]" />
                  <span className="truncate">{preset.name}</span>
                </button>
              ))}

              <div className="border-t border-[#263147] my-1" />

              {/* “画布大小与设置”点击后展开二级菜单，而不是跳转到“设置”tab！ */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCanvasSubmenu(!showCanvasSubmenu);
                  }}
                  className={`w-full px-3 py-2 text-left flex items-center justify-between transition-colors ${
                    showCanvasSubmenu
                      ? 'bg-[#232D42] text-[#FBFBFC]'
                      : 'hover:bg-[#232D42] text-[#BAC5EB] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Sliders className="w-3.5 h-3.5 text-[#8E9FCA]" />
                    <span>画布大小与设置</span>
                  </div>
                  <ChevronRight
                    className={`w-3.5 h-3.5 text-[#7E8FB8] transition-transform ${
                      showCanvasSubmenu ? 'rotate-90 sm:rotate-0' : ''
                    }`}
                  />
                </button>

                {/* 二级菜单 (Flyout Submenu for Canvas Dimensions) */}
                {showCanvasSubmenu && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="sm:absolute sm:left-full sm:top-0 sm:ml-1 mt-1 sm:mt-0 w-68 bg-[#161B29] border border-[#3A4766] rounded-xl shadow-2xl p-3 z-50 text-xs backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-[#263147] font-semibold text-[#FBFBFC]">
                      <div className="flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5 text-[#2652D0]" />
                        <span>画板尺寸 (宽 × 高)</span>
                      </div>
                      <span className="text-[10px] text-[#7E8FB8] font-mono">
                        {currentWidth} × {currentHeight}
                      </span>
                    </div>

                    {/* Width & Height inputs */}
                    <div className="grid grid-cols-2 gap-2 py-2">
                      <div>
                        <label className="text-[10px] text-[#8E9FCA] block mb-1">
                          宽度 (px):
                        </label>
                        <input
                          type="number"
                          min={200}
                          max={4000}
                          step={50}
                          value={customWidth}
                          onChange={(e) => setCustomWidth(Number(e.target.value))}
                          className="w-full bg-[#0F131D] border border-[#2B364D] rounded-lg px-2 py-1 text-white text-xs outline-none focus:border-[#2652D0]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#8E9FCA] block mb-1">
                          高度 (px):
                        </label>
                        <input
                          type="number"
                          min={200}
                          max={4000}
                          step={50}
                          value={customHeight}
                          onChange={(e) => setCustomHeight(Number(e.target.value))}
                          className="w-full bg-[#0F131D] border border-[#2B364D] rounded-lg px-2 py-1 text-white text-xs outline-none focus:border-[#2652D0]"
                        />
                      </div>
                    </div>

                    {/* Quick Presets */}
                    <div className="space-y-1 pt-1 border-t border-[#263147]">
                      <div className="text-[10px] text-[#7E8FB8] mb-1">常用画板规格:</div>
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
                            className="px-2 py-1 rounded bg-[#1C2335] hover:bg-[#28324A] text-[#BAC5EB] hover:text-white text-[10px] text-left transition-colors border border-[#2B364D]"
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Apply button */}
                    <button
                      onClick={handleApplyCanvasSize}
                      className="w-full mt-2.5 py-1.5 bg-[#2652D0] hover:bg-[#1E43B8] text-white rounded-lg font-medium text-xs shadow-md transition-colors"
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
                ? 'bg-[#232D42] text-[#FBFBFC]'
                : 'text-[#BAC5EB] hover:bg-[#1E2538] hover:text-[#FBFBFC]'
            }`}
          >
            <Palette className="w-3.5 h-3.5 text-[#EB8E88]" />
            <span>设置</span>
            <ChevronDown className="w-3 h-3 text-[#7E8FB8]" />
          </button>

          {/* Settings Dropdown: 编辑器皮肤选择 */}
          {showSettingsMenu && (
            <div className="absolute left-0 top-full mt-1 w-72 bg-[#161B29] border border-[#3A4766] rounded-xl shadow-2xl p-3 z-50 text-xs backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100">
              <div className="flex items-center justify-between pb-2 border-b border-[#263147] font-semibold text-[#FBFBFC]">
                <div className="flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-[#2652D0]" />
                  <span>工坊案台皮肤选择</span>
                </div>
                <span className="text-[10px] text-[#7E8FB8]">5 款民俗风格</span>
              </div>

              {/* Skin Theme List */}
              <div className="space-y-1.5 pt-2">
                {WORKBENCH_SKINS.map((skin) => {
                  const isActive = currentSkin === skin.id;

                  return (
                    <button
                      key={skin.id}
                      onClick={() => {
                        onSelectSkin?.(skin.id);
                        setShowSettingsMenu(false);
                      }}
                      className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                        isActive
                          ? 'bg-[#20293D] border-[#2652D0] text-[#FBFBFC] shadow-md ring-1 ring-[#BAC5EB]/40'
                          : 'bg-[#121622] border-[#263147] text-[#BAC5EB] hover:bg-[#1C2335] hover:text-[#FBFBFC]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* 3 Color swatch preview dots */}
                        <div className="flex items-center -space-x-1 shrink-0">
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-white/30 z-30"
                            style={{ backgroundColor: skin.colors[0] }}
                          />
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-white/30 z-20"
                            style={{ backgroundColor: skin.colors[1] }}
                          />
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-white/30 z-10"
                            style={{ backgroundColor: skin.colors[2] }}
                          />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-xs text-[#FBFBFC]">
                              {skin.name}
                            </span>
                            <span className="text-[9px] px-1 py-0.2 rounded bg-white/10 text-[#BAC5EB]">
                              {skin.tag}
                            </span>
                          </div>
                          <div className="text-[10px] text-[#7E8FB8] truncate mt-0.5">
                            {skin.desc}
                          </div>
                        </div>
                      </div>

                      {isActive && (
                        <Check className="w-4 h-4 text-[#2652D0] shrink-0 ml-2" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. Center: SAI-Style Document Tabs (多文件选项卡栏，点击切换) */}
      <div className="flex-1 flex items-center overflow-x-auto no-scrollbar gap-1 px-2 border-x border-[#263147] h-full">
        {documents.map((doc) => {
          const isActive = doc.id === activeDocId;
          const isEditing = editingDocId === doc.id;

          return (
            <div
              key={doc.id}
              onClick={() => onSelectDocument(doc.id)}
              className={`h-8.5 px-3 flex items-center gap-1.5 rounded-t-lg cursor-pointer transition-all border-t border-x text-xs shrink-0 select-none group relative ${
                isActive
                  ? 'bg-[#1E2538] border-[#2652D0] text-[#FBFBFC] font-medium shadow-md'
                  : 'bg-[#121622] border-transparent text-[#7E8FB8] hover:bg-[#181E2E] hover:text-[#BAC5EB]'
              }`}
            >
              {/* Tab Diamond Motif */}
              <span
                className={`text-[9px] font-bold ${
                  isActive ? 'text-[#2652D0]' : 'text-[#485675]'
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
                  className="px-1 py-0.5 bg-[#0F131D] text-white text-xs outline-none rounded border border-[#2652D0] w-24"
                />
              ) : (
                <span
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setEditingDocId(doc.id);
                    setEditingDocName(doc.name);
                  }}
                  className="truncate max-w-[120px] text-[11px]"
                  title={`${doc.name} (${doc.width}×${doc.height}) - 双击重命名`}
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
                  className="p-0.5 rounded hover:bg-[#28324A] text-[#7E8FB8] hover:text-white transition-colors"
                  title="关闭标签页"
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
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#1E2538] text-[#7E8FB8] hover:text-[#FBFBFC] transition-colors shrink-0"
          title="新建空白画布标签页"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 3. Right: Zoom (放缩) + Unified Export Square Button */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Zoom Controls */}
        <div className="flex items-center bg-[#1E2538] rounded-xl p-0.5 border border-[#2B364D] text-[#BAC5EB]">
          <button
            onClick={() => onZoomChange(Math.max(zoom - 0.15, 0.25))}
            className="p-1.5 rounded-lg hover:bg-[#28324A] hover:text-[#FBFBFC] transition-colors"
            title="缩小画布"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onResetZoom}
            className="px-2 py-0.5 font-mono text-[11px] text-[#FBFBFC] hover:bg-[#28324A] rounded-md transition-colors"
            title="重置缩放至100%"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={() => onZoomChange(Math.min(zoom + 0.15, 3.5))}
            className="p-1.5 rounded-lg hover:bg-[#28324A] hover:text-[#FBFBFC] transition-colors"
            title="放大画布"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          {onFitZoom && (
            <button
              onClick={onFitZoom}
              className="p-1.5 rounded-lg hover:bg-[#28324A] hover:text-[#FBFBFC] transition-colors border-l border-[#2B364D] ml-0.5"
              title="适应画板全屏"
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
                ? 'bg-[#1E43B8] text-white ring-2 ring-[#BAC5EB]/60 scale-105'
                : 'bg-[#2652D0] hover:bg-[#1E43B8] text-white shadow-blue-950/60 border border-[#BAC5EB]/40 hover:scale-105'
            }`}
            title="导出菜单（点击展开）"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Dropdown Menu (展开下拉菜单) */}
          {showExportMenu && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-[#161B29]/98 border border-[#3A4766] rounded-2xl shadow-2xl py-1.5 z-50 text-xs backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-1.5 text-[10px] font-semibold text-[#8E9FCA] border-b border-[#2B364D] flex items-center justify-between">
                <span>导出剪纸作品</span>
                <span className="text-[#2652D0] font-mono">❖</span>
              </div>

              {/* Option 1: 复制 SVG 源码 */}
              <button
                onClick={handleCopy}
                className="w-full px-3.5 py-2.5 text-left hover:bg-[#232D42] text-[#BAC5EB] hover:text-[#FBFBFC] flex items-center justify-between transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <Copy className="w-4 h-4 text-[#8E9FCA] group-hover:text-[#BAC5EB]" />
                  <div>
                    <div className="font-medium text-[#FBFBFC] text-[11px]">复制 SVG 源码</div>
                    <div className="text-[10px] text-[#7E8FB8]">直接贴入矢量编辑器或代码</div>
                  </div>
                </div>
                {copiedToast && <Check className="w-4 h-4 text-[#438B6E]" />}
              </button>

              {/* Option 2: 下载 .SVG 矢量文件 */}
              {onQuickDownloadSvg && (
                <button
                  onClick={() => {
                    onQuickDownloadSvg();
                    setShowExportMenu(false);
                  }}
                  className="w-full px-3.5 py-2.5 text-left hover:bg-[#232D42] text-[#BAC5EB] hover:text-[#FBFBFC] flex items-center gap-2.5 transition-colors group"
                >
                  <FileCode className="w-4 h-4 text-[#2652D0] group-hover:scale-110 transition-transform" />
                  <div>
                    <div className="font-medium text-[#FBFBFC] text-[11px]">下载 .SVG 矢量图</div>
                    <div className="text-[10px] text-[#7E8FB8]">纯净矢量路径 · 无损缩放</div>
                  </div>
                </button>
              )}

              {/* Option 3: 下载 .PNG 高清图片 */}
              {onQuickDownloadPng && (
                <button
                  onClick={() => {
                    onQuickDownloadPng();
                    setShowExportMenu(false);
                  }}
                  className="w-full px-3.5 py-2.5 text-left hover:bg-[#232D42] text-[#BAC5EB] hover:text-[#FBFBFC] flex items-center gap-2.5 transition-colors group"
                >
                  <ImageIcon className="w-4 h-4 text-[#EB8E88] group-hover:scale-110 transition-transform" />
                  <div>
                    <div className="font-medium text-[#FBFBFC] text-[11px]">下载 .PNG 高清图</div>
                    <div className="text-[10px] text-[#7E8FB8]">2x 高分辨率透明底图</div>
                  </div>
                </button>
              )}

              <button
                onClick={() => {
                  onOpenGodotExport();
                  setShowExportMenu(false);
                }}
                className="w-full px-3.5 py-2.5 text-left hover:bg-[#232D42] text-[#BAC5EB] hover:text-[#FBFBFC] flex items-center gap-2.5 transition-colors group border-t border-[#2B364D]"
              >
                <Gamepad2 className="w-4 h-4 text-[#438B6E] group-hover:scale-110 transition-transform" />
                <div>
                  <div className="font-medium text-[#FBFBFC] text-[11px]">导出到 Godot 4</div>
                  <div className="text-[10px] text-[#7E8FB8]">每个物件一个 .tscn · 部件 PNG · 深度 z_index</div>
                </div>
              </button>

              {/* Option 4: 更多导出选项与设置 */}
              <div className="border-t border-[#2B364D] mt-1 pt-1">
                <button
                  onClick={() => {
                    onOpenExportModal();
                    setShowExportMenu(false);
                  }}
                  className="w-full px-3.5 py-2 text-left hover:bg-[#232D42] text-[#8E9FCA] hover:text-[#FBFBFC] flex items-center gap-2 transition-colors text-[11px]"
                >
                  <Sliders className="w-3.5 h-3.5 text-[#8E9FCA]" />
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
            className="bg-[#161B29] border border-[#2B364D] rounded-2xl w-full max-w-md p-5 shadow-2xl text-white select-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#263147]">
              <div className="flex items-center gap-2">
                <FilePlus className="w-5 h-5 text-[#2652D0]" />
                <h3 className="font-bold text-sm text-[#FBFBFC]">新建剪纸画布</h3>
              </div>
              <button
                onClick={() => setShowNewDocDialog(false)}
                className="p-1 rounded-lg hover:bg-[#232D42] text-[#7E8FB8] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 py-4 text-xs">
              <div>
                <label className="text-[#8E9FCA] block mb-1">文件名称:</label>
                <input
                  type="text"
                  value={newDocName}
                  onChange={(e) => setNewDocName(e.target.value)}
                  className="w-full bg-[#0F131D] border border-[#2B364D] rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-[#2652D0]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#8E9FCA] block mb-1">宽度 (px):</label>
                  <input
                    type="number"
                    min={200}
                    max={4000}
                    step={50}
                    value={newDocWidth}
                    onChange={(e) => setNewDocWidth(Number(e.target.value))}
                    className="w-full bg-[#0F131D] border border-[#2B364D] rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-[#2652D0]"
                  />
                </div>
                <div>
                  <label className="text-[#8E9FCA] block mb-1">高度 (px):</label>
                  <input
                    type="number"
                    min={200}
                    max={4000}
                    step={50}
                    value={newDocHeight}
                    onChange={(e) => setNewDocHeight(Number(e.target.value))}
                    className="w-full bg-[#0F131D] border border-[#2B364D] rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-[#2652D0]"
                  />
                </div>
              </div>

              {/* Preset dimensions */}
              <div>
                <span className="text-[#7E8FB8] block mb-1.5">标准民俗尺幅预设:</span>
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
                      className="px-2.5 py-1.5 rounded-xl bg-[#1C2335] hover:bg-[#28324A] text-[#BAC5EB] hover:text-white border border-[#2B364D] text-left transition-colors"
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#263147]">
              <button
                onClick={() => setShowNewDocDialog(false)}
                className="px-4 py-2 rounded-xl bg-[#1C2335] hover:bg-[#28324A] text-[#8E9FCA] hover:text-white text-xs transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreateDocument}
                className="px-5 py-2 rounded-xl bg-[#2652D0] hover:bg-[#1E43B8] text-white font-semibold text-xs shadow-md shadow-blue-950/60 transition-colors"
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
