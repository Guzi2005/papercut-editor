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
  Settings,
  PanelRight,
  Keyboard,
  Layers as LayersGlyph,
  Volume2,
  VolumeX,
  SlidersHorizontal,
  Grid2x2,
  CloudUpload,
  Sun,
  CloudFog,
  Blend,
} from 'lucide-react';
import { PRESET_PROJECTS } from '../utils/presetTemplates';
import { SKINS, WorkbenchSkin } from '../utils/skins';
import { CanvasBackground, PaperMode, PapercutProject, ShadowBlend } from '../types/papercut';
import { CanvasBgPanel } from './CanvasBgPanel';
import { SHADOW_BLENDS } from '../utils/layerSvg';
import { WheelNumber } from './WheelNumber';
import { SaveSettingsPanel } from './SaveSettingsPanel';
import { SaveSettings, SaveStatus, describeSaveSettings } from '../utils/saveSettings';
import { ZOOM_STEP, WHEEL_ZOOM_RATE, clampZoom } from '../utils/zoom';
import { isSoundMuted, toggleSound, playCrispClick } from '../utils/soundEffects';

const ModeGlyph: React.FC<{ kind: PaperMode }> = ({ kind }) => (
  <svg viewBox="0 0 24 24" className="w-6 h-6">
    <defs>
      <filter id="mg-soft" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="1.4" />
      </filter>
    </defs>
    <rect x="0" y="0" width="24" height="24" rx="5" fill="#FAF8F2" />
    {kind === 'soft' && <rect x="7" y="8" width="11" height="11" rx="1" fill="#1B1626" opacity="0.45" filter="url(#mg-soft)" />}
    {kind === 'hard' && <rect x="8" y="8" width="11" height="11" rx="1" fill="#16266B" />}
    <rect x="5" y="5" width="11" height="11" rx="1" fill="#2E58D6" />
  </svg>
);

const PAPER_MODES: { id: PaperMode; tip: string; icon: React.ReactNode }[] = [
  { id: 'soft', tip: '剪贴模式：柔和投影', icon: <ModeGlyph kind="soft" /> },
  { id: 'vector', tip: '剪贴模式：平面矢量', icon: <ModeGlyph kind="vector" /> },
  { id: 'hard', tip: '剪贴模式：硬边加深投影', icon: <ModeGlyph kind="hard" /> },
];

const TAB_COLORS = ['#2E58D6', '#D0574B', '#2F9E6A', '#8A62D6', '#D69A2E', '#2FA8B0', '#D66A9E'];
const tabColor = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TAB_COLORS[h % TAB_COLORS.length];
};

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
  saveStatus: SaveStatus;
  saveSettings: SaveSettings;
  onChangeSaveSettings: (patch: Partial<SaveSettings>) => void;
  onSaveNow: () => void;
  saveFileName: string | null;
  onPickSaveFile: () => void;
  onOpenGodotExport: () => void;
  paperMode: PaperMode;
  onChangePaperMode: (mode: PaperMode) => void;
  shadow: { strength: number; softness: number; blend: ShadowBlend };
  onChangeShadow: (patch: Partial<Pick<PapercutProject, 'shadowStrength' | 'shadowSoftness' | 'shadowBlend'>>) => void;
  compact: boolean;
  onOpenKeymap: () => void;
  panelOpen: boolean;
  onTogglePanel: () => void;
  currentWidth: number;
  currentHeight: number;
  canvasBg?: CanvasBackground;
  onChangeCanvasBg: (bg: CanvasBackground) => void;
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
  saveSettings,
  onChangeSaveSettings,
  onSaveNow,
  saveFileName,
  onPickSaveFile,
  onOpenGodotExport,
  paperMode,
  onChangePaperMode,
  shadow,
  onChangeShadow,
  compact,
  onOpenKeymap,
  panelOpen,
  onTogglePanel,
  currentWidth,
  currentHeight,
  canvasBg,
  onChangeCanvasBg,
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
  const [settingsFlyout, setSettingsFlyout] = useState<'mode' | 'save' | null>(null);
  const [soundOn, setSoundOn] = useState(() => !isSoundMuted());
  const zoomBoxRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const onZoomRef = useRef(onZoomChange);
  onZoomRef.current = onZoomChange;
  useEffect(() => {
    const el = zoomBoxRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const px = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      const next = clampZoom(zoomRef.current * Math.exp(-e.deltaY * px * WHEEL_ZOOM_RATE));
      zoomRef.current = next;
      onZoomRef.current(next);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);
  const [fileFlyout, setFileFlyout] = useState<'preset' | 'size' | 'bg' | null>(null);
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
        <div className="flex items-center gap-1.5 pr-2 border-r border-(--ui-divider)">
          <div className="w-6 h-6 rounded-lg bg-(--ui-accent) flex items-center justify-center text-white text-[12px] font-bold" data-tip="Weave 剪纸工坊">
            ❖
          </div>
          <button
            onClick={onSaveNow}
            className={saveStatus === 'saving' ? 'text-(--ui-muted)' : saveStatus === 'dirty' ? 'text-(--ui-accent-2)' : 'text-[#438B6E]'}
            data-tip={
              saveStatus === 'saving'
                ? '保存中…'
                : saveStatus === 'dirty'
                ? `有未保存的修改（${describeSaveSettings(saveSettings)}）· 单击立即保存`
                : '已保存 · 单击立即保存 · Ctrl+S 另存为文件'
            }
          >
            {saveStatus === 'dirty' ? <CloudUpload className="w-4 h-4" /> : <CloudCheck className="w-4 h-4" />}
          </button>
        </div>

        {/* Menu Tab 1: 文件 (File Menu) */}
        <div className="relative" ref={fileMenuRef}>
          <button
            onClick={() => {
              setShowFileMenu(!showFileMenu);
              setShowCanvasSubmenu(false);
              setFileFlyout(null);
              setShowSettingsMenu(false);
            }}
            data-tip="文件"
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
              showFileMenu
                ? 'bg-(--ui-hover) text-(--ui-strong)'
                : 'text-(--ui-text-2) hover:bg-(--ui-raised) hover:text-(--ui-strong)'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
          </button>

          {showFileMenu && (
            <div className="absolute left-0 top-full mt-1 w-44 bg-(--ui-panel) border border-(--ui-border-strong) rounded-xl shadow-2xl py-1 z-50 text-xs">
              {(
                [
                  { label: '新建', key: 'Alt+N', icon: <FilePlus className="w-3.5 h-3.5 text-(--ui-accent)" />, run: () => setShowNewDocDialog(true) },
                  { label: '打开', key: 'Ctrl+O', icon: <FolderOpen className="w-3.5 h-3.5 text-(--ui-muted)" />, run: onOpenProjectFile },
                  { label: '保存', key: 'Ctrl+S', icon: <Save className="w-3.5 h-3.5 text-(--ui-muted)" />, run: onSaveProjectFile },
                  { label: '导出到 Godot', key: '…', icon: <Gamepad2 className="w-3.5 h-3.5 text-[#438B6E]" />, run: onOpenGodotExport },
                ] as const
              ).map((item) => (
                <button
                  key={item.label}
                  onPointerEnter={() => setShowCanvasSubmenu(false)}
                  onClick={() => {
                    setShowFileMenu(false);
                    setFileFlyout(null);
                    item.run();
                  }}
                  className="w-full px-3 py-2 flex items-center gap-2 text-left text-(--ui-text-2) hover:bg-(--ui-hover) hover:text-(--ui-strong)"
                >
                  {item.icon}
                  <span className="flex-1">{item.label}</span>
                  <span className="text-[10px] text-(--ui-faint) font-mono">{item.key}</span>
                </button>
              ))}
              <div className="h-px bg-(--ui-divider) my-1" />
              {(
                [
                  { id: 'preset', label: '预设', icon: <Sparkles className="w-3.5 h-3.5 text-(--ui-accent-2)" /> },
                  { id: 'size', label: '画布尺寸', icon: <Sliders className="w-3.5 h-3.5 text-(--ui-muted)" /> },
                  { id: 'bg', label: '画布背景', icon: <Grid2x2 className="w-3.5 h-3.5 text-(--ui-muted)" /> },
                ] as const
              ).map((entry) => (
                <div key={entry.id} className="relative" onPointerEnter={(e) => e.pointerType === 'mouse' && setFileFlyout(entry.id)}>
                  <button
                    onClick={() => setFileFlyout((v) => (v === entry.id ? null : entry.id))}
                    className={`w-full px-3 py-2 flex items-center gap-2 text-left transition-colors ${
                      fileFlyout === entry.id ? 'bg-(--ui-hover) text-(--ui-strong)' : 'text-(--ui-text-2) hover:bg-(--ui-hover)'
                    }`}
                  >
                    {entry.icon}
                    <span className="flex-1">{entry.label}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-(--ui-muted)" />
                  </button>
                  {fileFlyout === entry.id && entry.id === 'preset' && (
                    <div className="absolute left-full top-0 ml-1 w-52 bg-(--ui-panel) border border-(--ui-border-strong) rounded-xl shadow-2xl py-1">
                      {PRESET_PROJECTS.map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => {
                            onOpenPreset(preset.id);
                            setShowFileMenu(false);
                            setFileFlyout(null);
                          }}
                          data-tip={preset.desc}
                          className="w-full px-3 py-2 text-left text-(--ui-text-2) hover:bg-(--ui-hover) hover:text-(--ui-strong) truncate"
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {fileFlyout === entry.id && entry.id === 'bg' && <CanvasBgPanel value={canvasBg} onChange={onChangeCanvasBg} />}
                  {fileFlyout === entry.id && entry.id === 'size' && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute left-full top-0 ml-1 w-56 bg-(--ui-panel) border border-(--ui-border-strong) rounded-xl shadow-2xl p-2.5 space-y-2"
                    >
                      <div className="grid grid-cols-2 gap-1.5">
                        {(['宽', '高'] as const).map((label, i) => (
                          <label key={label} className="flex items-center gap-1.5 h-7 px-2 rounded-lg bg-(--ui-input) border border-(--ui-border)">
                            <span className="text-[10px] text-(--ui-muted)">{label}</span>
                            <input
                              type="number"
                              min={200}
                              max={4000}
                              step={50}
                              value={i === 0 ? customWidth : customHeight}
                              onChange={(e) => (i === 0 ? setCustomWidth : setCustomHeight)(Number(e.target.value))}
                              className="w-full bg-transparent text-(--ui-strong) text-xs font-mono outline-none"
                            />
                          </label>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          [800, 800],
                          [1000, 800],
                          [750, 1000],
                          [1920, 1080],
                        ].map(([w, h]) => (
                          <button
                            key={`${w}x${h}`}
                            onClick={() => {
                              setCustomWidth(w);
                              setCustomHeight(h);
                            }}
                            className={`h-7 rounded-lg text-[10px] font-mono border transition-colors ${
                              customWidth === w && customHeight === h
                                ? 'border-(--ui-accent) text-(--ui-strong)'
                                : 'border-(--ui-border) text-(--ui-text-2) hover:text-(--ui-strong)'
                            }`}
                          >
                            {w} × {h}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => {
                          handleApplyCanvasSize();
                          setFileFlyout(null);
                        }}
                        className="w-full h-7 bg-(--ui-accent) hover:bg-(--ui-accent-hover) text-white rounded-lg text-xs"
                      >
                        应用
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Menu Tab 2: 设置 (设置tab应当是有关编辑器皮肤选择的！) */}
        <div className="relative" ref={settingsMenuRef}>
          <button
            onClick={() => {
              setShowSettingsMenu(!showSettingsMenu);
              setSettingsFlyout(null);
              setShowFileMenu(false);
              setShowCanvasSubmenu(false);
            }}
            data-tip="设置"
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
              showSettingsMenu
                ? 'bg-(--ui-hover) text-(--ui-strong)'
                : 'text-(--ui-text-2) hover:bg-(--ui-raised) hover:text-(--ui-strong)'
            }`}
          >
            <Settings className="w-4 h-4" />
          </button>

          {showSettingsMenu && (
            <div className="absolute left-0 top-full mt-1 w-52 bg-(--ui-panel) border border-(--ui-border-strong) rounded-xl shadow-2xl py-1 z-50 text-xs">
              <div className="px-3 pt-1.5 pb-2">
                <div className="flex items-center gap-2 mb-1.5 text-(--ui-muted)">
                  <Palette className="w-3.5 h-3.5 text-(--ui-accent-2)" />
                  <span>皮肤</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {SKINS.map((sk) => {
                    const c = sk.colors;
                    return (
                      <button
                        key={sk.id}
                        onClick={() => onSelectSkin?.(sk.id)}
                        data-tip={sk.name}
                        className={`w-7 h-7 rounded-full p-0.5 border-2 transition-colors ${
                          currentSkin === sk.id ? 'border-(--ui-accent)' : 'border-transparent hover:border-(--ui-border-strong)'
                        }`}
                      >
                        <span className="block w-full h-full rounded-full" style={{ background: `conic-gradient(${c.accent} 0 34%, ${c.panel} 0 67%, ${c.accent2} 0)` }} />
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="relative px-3 pt-1 pb-2">
                <div className="flex items-center gap-2 mb-1.5 text-(--ui-muted)">
                  <LayersGlyph className="w-3.5 h-3.5 text-(--ui-accent)" />
                  <span>剪贴模式</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {PAPER_MODES.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => onChangePaperMode(m.id)}
                      data-tip={m.tip}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center border-2 transition-colors ${
                        paperMode === m.id ? 'border-(--ui-accent) bg-(--ui-hover)' : 'border-transparent hover:bg-(--ui-hover)'
                      }`}
                    >
                      {m.icon}
                    </button>
                  ))}
                  <button
                    onClick={() => setSettingsFlyout((v) => (v === 'mode' ? null : 'mode'))}
                    onPointerEnter={(e) => e.pointerType === 'mouse' && setSettingsFlyout('mode')}
                    disabled={paperMode === 'vector'}
                    data-tip={paperMode === 'vector' ? '平面矢量没有投影' : '投影参数'}
                    className={`ml-auto h-8 px-1.5 rounded-lg flex items-center gap-0.5 transition-colors disabled:opacity-30 ${
                      settingsFlyout === 'mode' ? 'bg-(--ui-hover) text-(--ui-strong)' : 'text-(--ui-muted) hover:bg-(--ui-hover) hover:text-(--ui-strong)'
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
                {settingsFlyout === 'mode' && paperMode !== 'vector' && (
                  <div className="absolute left-full top-0 ml-1 w-44 bg-(--ui-panel) border border-(--ui-border-strong) rounded-xl shadow-2xl p-2 flex flex-col gap-1.5">
                    <div className="text-[10px] text-(--ui-muted)">投影</div>
                    <WheelNumber
                      tip="投影强度"
                      icon={<Sun className="w-3 h-3" />}
                      value={Math.round(shadow.strength * 100)}
                      min={0}
                      max={100}
                      step={5}
                      format={(v) => `${v}%`}
                      onChange={(v) => onChangeShadow({ shadowStrength: v / 100 })}
                    />
                    <WheelNumber
                      tip="投影软硬：0 硬边 · 100 柔和"
                      icon={<CloudFog className="w-3 h-3" />}
                      value={Math.round(shadow.softness * 100)}
                      min={0}
                      max={100}
                      step={5}
                      format={(v) => `${v}%`}
                      onChange={(v) => onChangeShadow({ shadowSoftness: v / 100 })}
                    />
                    <label className="h-7 flex items-center gap-1 px-1.5 rounded-lg bg-(--ui-raised) border border-(--ui-border) text-(--ui-muted)" data-tip="投影合成模式">
                      <Blend className="w-3 h-3" />
                      <select
                        value={shadow.blend}
                        onChange={(e) => onChangeShadow({ shadowBlend: e.target.value as ShadowBlend })}
                        className="flex-1 bg-transparent text-[11px] text-(--ui-strong) outline-none"
                      >
                        {SHADOW_BLENDS.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
              </div>
              <div className="h-px bg-(--ui-divider) my-1" />
              <div className="relative" onPointerEnter={(e) => e.pointerType === 'mouse' && setSettingsFlyout('save')}>
                <button
                  onClick={() => setSettingsFlyout((v) => (v === 'save' ? null : 'save'))}
                  className={`w-full px-3 py-2 flex items-center gap-2 text-left transition-colors ${
                    settingsFlyout === 'save' ? 'bg-(--ui-hover) text-(--ui-strong)' : 'text-(--ui-text-2) hover:bg-(--ui-hover)'
                  }`}
                >
                  <Save className="w-3.5 h-3.5 text-(--ui-muted)" />
                  <span className="flex-1">保存</span>
                  <span className="text-[10px] text-(--ui-faint)">{describeSaveSettings(saveSettings)}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-(--ui-muted)" />
                </button>
                {settingsFlyout === 'save' && (
                  <SaveSettingsPanel
                    settings={saveSettings}
                    onChange={onChangeSaveSettings}
                    onSaveNow={onSaveNow}
                    fileName={saveFileName}
                    onPickFile={onPickSaveFile}
                  />
                )}
              </div>
              <button
                onPointerEnter={() => setSettingsFlyout(null)}
                onClick={() => {
                  setSoundOn(!toggleSound());
                  playCrispClick();
                }}
                className="w-full px-3 py-2 flex items-center gap-2 text-left text-(--ui-text-2) hover:bg-(--ui-hover) hover:text-(--ui-strong)"
              >
                {soundOn ? <Volume2 className="w-3.5 h-3.5 text-(--ui-muted)" /> : <VolumeX className="w-3.5 h-3.5 text-(--ui-muted)" />}
                <span className="flex-1">音效</span>
                <span className={`text-[10px] ${soundOn ? 'text-(--ui-accent-2)' : 'text-(--ui-faint)'}`}>{soundOn ? '开' : '关'}</span>
              </button>
              <button
                onPointerEnter={() => setSettingsFlyout(null)}
                onClick={() => {
                  setShowSettingsMenu(false);
                  onOpenKeymap();
                }}
                className="w-full px-3 py-2 flex items-center gap-2 text-left text-(--ui-text-2) hover:bg-(--ui-hover) hover:text-(--ui-strong)"
              >
                <Keyboard className="w-3.5 h-3.5 text-(--ui-muted)" />
                <span className="flex-1">快捷键</span>
                <span className="text-[10px] text-(--ui-faint)">…</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. Center: SAI-Style Document Tabs (多文件选项卡栏，点击切换) */}
      <div className="flex-1 flex items-center overflow-x-auto no-scrollbar gap-1 px-2 border-x border-(--ui-divider) h-full">
        {documents.map((doc) => {
          const isActive = doc.id === activeDocId;
          const isEditing = editingDocId === doc.id;
          const color = tabColor(doc.id);

          return (
            <div
              key={doc.id}
              onClick={() => onSelectDocument(doc.id)}
              style={{ borderTopColor: color, boxShadow: isActive ? `inset 0 2px 0 ${color}` : undefined }}
              className={`h-8.5 px-3 flex items-center gap-1.5 rounded-t-lg cursor-pointer transition-all border-t-2 text-xs shrink-0 select-none group relative ${
                isActive
                  ? 'bg-(--ui-raised) text-(--ui-strong) font-medium'
                  : 'bg-(--ui-panel-2) text-(--ui-muted) opacity-80 hover:opacity-100 hover:bg-(--ui-raised) hover:text-(--ui-text-2)'
              }`}
            >
              {/* Tab Diamond Motif */}
              <span className="text-[9px] font-bold" style={{ color }}>
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
        <div ref={zoomBoxRef} className="flex items-center bg-(--ui-raised) rounded-xl p-0.5 border border-(--ui-border) text-(--ui-text-2)">
          <button
            onClick={() => onZoomChange(zoom / ZOOM_STEP)}
            className="p-1.5 rounded-lg hover:bg-(--ui-hover) hover:text-(--ui-strong) transition-colors"
            data-tip="缩小画布"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onResetZoom}
            className="px-2 py-0.5 font-mono text-[11px] text-(--ui-strong) hover:bg-(--ui-hover) rounded-md transition-colors"
            data-tip="缩放 · 滚轮调节 · 单击回到 100%"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={() => onZoomChange(zoom * ZOOM_STEP)}
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

        {compact && (
          <button
            onClick={onTogglePanel}
            data-tip="图层面板"
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
              panelOpen ? 'bg-(--ui-accent) text-white' : 'bg-(--ui-raised) text-(--ui-text-2) hover:text-(--ui-strong)'
            }`}
          >
            <PanelRight className="w-4 h-4" />
          </button>
        )}

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
                <h3 className="font-bold text-sm text-(--ui-strong)">新建画布</h3>
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
                <label className="text-(--ui-muted) block mb-1">名称</label>
                <input
                  type="text"
                  value={newDocName}
                  onChange={(e) => setNewDocName(e.target.value)}
                  className="w-full bg-(--ui-input) border border-(--ui-border) rounded-xl px-3 py-2 text-(--ui-strong) text-xs outline-none focus:border-(--ui-accent)"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-(--ui-muted) block mb-1">宽</label>
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
                  <label className="text-(--ui-muted) block mb-1">高</label>
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
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { name: '800 × 800', w: 800, h: 800 },
                    { name: '1000 × 800', w: 1000, h: 800 },
                    { name: '750 × 1000', w: 750, h: 1000 },
                    { name: '1920 × 1080', w: 1920, h: 1080 },
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
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
