import {SkirtDimensionSettings} from './SkirtDimensionSettings';
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
  GitBranch,
  Scissors,
} from 'lucide-react';
import { PRESET_PROJECTS } from '../utils/presetTemplates';
import { SKINS, WorkbenchSkin } from '../utils/skins';
import { CanvasBackground, PaperMode, PapercutProject, ShadowBlend } from '../types/papercut';
import { CanvasBgPanel } from './CanvasBgPanel';
import { TwinPresetsPanel } from './TwinPresetsPanel';
import { AspectSizeButton, SIZE_PRESETS } from './AspectSizeButton';
import { TwinPreset } from '../utils/twinPresets';
import { DocThumbnail, DocumentTabImage } from './DocThumbnail';
import { SHADOW_BLENDS } from '../utils/layerSvg';
import { WheelNumber } from './WheelNumber';
import { SaveSettingsPanel } from './SaveSettingsPanel';
import { AssetModeEntry } from './AssetModeEntry';
import { SaveSettings, SaveStatus, describeSaveSettings } from '../utils/saveSettings';
import { ZOOM_STEP, MIN_ZOOM, MAX_ZOOM } from '../utils/zoom';
import { isSoundMuted, toggleSound, playCrispClick } from '../utils/soundEffects';
import type { DrawingPreviewMode } from '../utils/drawingPreview';

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

const DrawingPreviewGlyph: React.FC<{ mode: DrawingPreviewMode }> = ({ mode }) => (
  <svg viewBox="0 0 32 32" className="w-7 h-7" aria-hidden="true">
    <path
      d="M6 6 C20 4 29 15 22 24 C15 30 8 23 6 6 Z"
      fill={mode === 'filled' ? 'currentColor' : 'none'}
      stroke={mode === 'outline' ? 'currentColor' : 'none'}
      strokeWidth="1.6"
      strokeDasharray={mode === 'outline' ? '3 2' : undefined}
      strokeLinejoin="round"
    />
  </svg>
);

const DRAWING_PREVIEW_MODES: { id: DrawingPreviewMode; label: string; tip: string }[] = [
  { id: 'outline', label: '轮廓预览', tip: '拖动时显示选区轮廓 · 松手提交' },
  { id: 'filled', label: '即时填充', tip: '拖动时用选中色即时填充 · 无边框 · 松手提交' },
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
  project: PapercutProject;
}

interface TopBarProps {
  onOpenAssets?: () => void;
  assetsReady?: boolean;
  assetMode?: boolean;
  onAssetModeChange?: (enabled: boolean) => void;
  workspaceModesEnabled?: boolean;
  onWorkspaceModesEnabledChange?: (enabled: boolean) => void;
  documents: DocumentTabItem[];
  activeDocId: string;
  onSelectDocument: (docId: string) => void;
  onNewDocument: () => void;
  twinPresets?: TwinPreset[];
  onChangeTwinPresets?: (presets: TwinPreset[]) => void;
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
  drawingPreviewMode: DrawingPreviewMode;
  onChangeDrawingPreviewMode: (mode: DrawingPreviewMode) => void;
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
  onOpenAssets,
  assetsReady = true,
  assetMode = false,
  onAssetModeChange,
  workspaceModesEnabled = false,
  onWorkspaceModesEnabledChange,
  documents,
  activeDocId,
  onSelectDocument,
  onNewDocument,
  twinPresets = [],
  onChangeTwinPresets,
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
  drawingPreviewMode,
  onChangeDrawingPreviewMode,
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
  const [showZoomMenu, setShowZoomMenu] = useState(false);
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [showCanvasSubmenu, setShowCanvasSubmenu] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [settingsFlyout, setSettingsFlyout] = useState<'mode' | 'save' | 'twin' | null>(null);
  const [soundOn, setSoundOn] = useState(() => !isSoundMuted());
  const [thumb, setThumb] = useState<{ id: string; x: number; y: number; editing?:boolean } | null>(null);
  const thumbTimer = useRef<number | undefined>(undefined);
  const showThumbSoon = (id: string, el: HTMLElement) => {
    window.clearTimeout(thumbTimer.current);
    thumbTimer.current = window.setTimeout(() => {
      const r = el.getBoundingClientRect();
      setThumb({ id, x: r.left, y: r.bottom + 6 });
    }, 450);
  };
  const hideThumb = () => {
    window.clearTimeout(thumbTimer.current);
    setThumb(null);
  };
  const leaveThumb = () => {
    window.clearTimeout(thumbTimer.current);
    thumbTimer.current=window.setTimeout(()=>{
      if(!document.querySelector('[data-document-details]')?.contains(document.activeElement))setThumb(null);
    },160);
  };
  useEffect(()=>()=>window.clearTimeout(thumbTimer.current),[]);
  const [fileFlyout, setFileFlyout] = useState<'preset' | 'size' | 'bg' | null>(null);
  // Settings menu fields (canvas size)
  const [customWidth, setCustomWidth] = useState(currentWidth);
  const [customHeight, setCustomHeight] = useState(currentHeight);

  const exportMenuRef = useRef<HTMLDivElement>(null);
  const zoomMenuRef = useRef<HTMLDivElement>(null);
  const documentTabsRef = useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const strip=documentTabsRef.current,tab=strip?.querySelector<HTMLElement>('[data-active="true"]');
    if(!strip||!tab)return;
    const frame=requestAnimationFrame(()=>{
      const left=tab.getBoundingClientRect().left-strip.getBoundingClientRect().left+strip.scrollLeft,right=left+tab.offsetWidth;
      if(left<strip.scrollLeft)strip.scrollLeft=left;
      else if(right>strip.scrollLeft+strip.clientWidth)strip.scrollLeft=right-strip.clientWidth;
    });
    return()=>cancelAnimationFrame(frame);
  },[activeDocId]);
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
      if (zoomMenuRef.current && !zoomMenuRef.current.contains(target)) setShowZoomMenu(false);
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
    window.addEventListener('pointerdown', handleClickOutside);
    return () => window.removeEventListener('pointerdown', handleClickOutside);
  }, []);

  const handleApplyCanvasSize = () => {
    const w = Math.max(200, Math.min(customWidth, 4000));
    const h = Math.max(200, Math.min(customHeight, 4000));
    onUpdateCanvasSize(w, h);
    setShowCanvasSubmenu(false);
    setShowFileMenu(false);
  };

  return (
    <header className="relative h-13 bg-(--ui-panel) border-b border-(--ui-divider) flex items-center justify-between text-(--ui-text) select-none z-60 shrink-0 px-2 sm:px-4 gap-1 sm:gap-2">
      {/* 1. Left: Brand Icon + 文件 / 设置 (皮肤选择) Menu Tabs */}
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="flex items-center gap-1.5 pr-2 border-r border-(--ui-divider)">
          <AssetModeEntry
            onOpenAssets={onOpenAssets}
            assetsReady={assetsReady}
            assetMode={assetMode}
            onAssetModeChange={onAssetModeChange}
          />
          <button
            onClick={onSaveNow}
            aria-label="立即保存工作区"
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
                  { label: '新建', key: 'Alt+N', icon: <FilePlus className="w-3.5 h-3.5 text-(--ui-accent)" />, run: onNewDocument },
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
                          <WheelNumber key={label} tip={`画布${label === '宽' ? '宽度' : '高度'}`}
                            icon={<span className="text-[10px]">{label}</span>} value={i === 0 ? customWidth : customHeight}
                            min={200} max={4000} step={1} dragStep={5}
                            onChange={i === 0 ? setCustomWidth : setCustomHeight} />
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-1.5 justify-between">
                        {SIZE_PRESETS.map(({ w, h }) => (
                          <AspectSizeButton
                            key={`${w}x${h}`}
                            w={w}
                            h={h}
                            active={customWidth === w && customHeight === h}
                            onClick={() => {
                              setCustomWidth(w);
                              setCustomHeight(h);
                            }}
                          />
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
            aria-label="设置"
            aria-expanded={showSettingsMenu}
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
              {onWorkspaceModesEnabledChange && <button type="button" role="switch" aria-checked={workspaceModesEnabled}
                onClick={() => onWorkspaceModesEnabledChange(!workspaceModesEnabled)}
                onPointerEnter={() => setSettingsFlyout(null)}
                data-tip="在工具属性栏显示绘制、编排、资产标签；共享当前画布"
                className="w-full px-3 py-2 flex items-center gap-2 text-left text-(--ui-text-2) hover:bg-(--ui-hover)">
                <PanelRight className="w-3.5 h-3.5 text-(--ui-muted)" />
                <span className="flex-1">工作模式标签</span>
                <span className={`text-[10px] ${workspaceModesEnabled ? 'text-(--ui-accent)' : 'text-(--ui-faint)'}`}>{workspaceModesEnabled ? '开' : '关'}</span>
              </button>}
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
                        aria-label={sk.name}
                        onClick={() => onSelectSkin?.(sk.id)}
                        data-tip={sk.name}
                        className={`w-7 h-7 rounded-full p-0.5 border-2 transition-colors ${
                          currentSkin === sk.id ? 'border-(--ui-accent)' : 'border-transparent hover:border-(--ui-border-strong)'
                        }`}
                      >
                        <span className="block w-full h-full rounded-full" style={{ background: `conic-gradient(${c.accentFill ?? c.accent} 0 34%, ${c.panel} 0 67%, ${c.accent2} 0)` }} />
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
              <div className="px-3 pt-1 pb-2" onPointerEnter={() => setSettingsFlyout(null)}>
                <div className="flex items-center gap-2 mb-1.5 text-(--ui-muted)">
                  <Scissors className="w-3.5 h-3.5 text-(--ui-accent)" />
                  <span>绘制反馈</span>
                </div>
                <div className="flex gap-1" role="group" aria-label="绘制反馈">
                  {DRAWING_PREVIEW_MODES.map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => onChangeDrawingPreviewMode(mode.id)}
                      aria-label={mode.label}
                      aria-pressed={drawingPreviewMode === mode.id}
                      data-tip={mode.tip}
                      className={`flex-1 flex items-center gap-1 py-1 border-b-2 transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-(--ui-accent) ${
                        drawingPreviewMode === mode.id
                          ? 'border-(--ui-accent) text-(--ui-accent)'
                          : 'border-transparent text-(--ui-muted) hover:text-(--ui-strong) hover:bg-(--ui-hover)'
                      }`}
                    >
                      <DrawingPreviewGlyph mode={mode.id} />
                      <span className="text-[10px]">{mode.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="px-3 pt-1 pb-2" onPointerEnter={() => setSettingsFlyout(null)}><SkirtDimensionSettings /></div>
              <div className="h-px bg-(--ui-divider) my-1" />
              <div className="relative" onPointerEnter={(e) => e.pointerType === 'mouse' && setSettingsFlyout('twin')}>
                <button
                  onClick={() => setSettingsFlyout((v) => (v === 'twin' ? null : 'twin'))}
                  className={`w-full px-3 py-2 flex items-center gap-2 text-left transition-colors ${
                    settingsFlyout === 'twin' ? 'bg-(--ui-hover) text-(--ui-strong)' : 'text-(--ui-text-2) hover:bg-(--ui-hover)'
                  }`}
                >
                  <GitBranch className="w-3.5 h-3.5 text-(--ui-muted)" />
                  <span className="flex-1">孪生图层</span>
                  <span className="text-[10px] text-(--ui-faint)">{twinPresets.length}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-(--ui-muted)" />
                </button>
                {settingsFlyout === 'twin' && onChangeTwinPresets && (
                  <TwinPresetsPanel value={twinPresets} onChange={onChangeTwinPresets} />
                )}
              </div>
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

      {/* The artwork itself identifies each document; names live in details. */}
      <div ref={documentTabsRef} data-document-tabs role="tablist" aria-label="文档" onScroll={hideThumb} className="relative min-w-0 flex-1 flex items-end overflow-x-auto no-scrollbar h-full">
        {documents.map((doc,index) => {
          const isActive = doc.id === activeDocId;
          const color = tabColor(doc.id);

          return (
            <div
              key={doc.id}
              role="tab"
              aria-label={doc.name}
              aria-selected={isActive}
              tabIndex={isActive?0:-1}
              data-document-tab
              data-active={isActive}
              onKeyDown={event=>{
                if(event.target!==event.currentTarget)return;
                let target=index;
                if(event.key==='ArrowRight')target=(index+1)%documents.length;
                else if(event.key==='ArrowLeft')target=(index+documents.length-1)%documents.length;
                else if(event.key==='Home')target=0;
                else if(event.key==='End')target=documents.length-1;
                else if(event.key==='F2'){event.preventDefault();const r=event.currentTarget.getBoundingClientRect();setThumb({id:doc.id,x:r.left,y:r.bottom+6,editing:true});return;}
                else if(event.key==='Escape'){hideThumb();return;}
                else if(event.key==='Enter'||event.key===' '){event.preventDefault();onSelectDocument(doc.id);return;}
                else return;
                event.preventDefault();const tabs=event.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[data-document-tab]');tabs?.[target]?.focus();onSelectDocument(documents[target].id);
              }}
              onClick={() => {
                hideThumb();
                onSelectDocument(doc.id);
              }}
              onPointerEnter={(e) => e.pointerType === 'mouse' && showThumbSoon(doc.id, e.currentTarget)}
              onPointerLeave={leaveThumb}
              onFocus={event=>{if(event.target===event.currentTarget)showThumbSoon(doc.id,event.currentTarget);}}
              onBlur={leaveThumb}
              onDoubleClick={event=>{const r=event.currentTarget.getBoundingClientRect();setThumb({id:doc.id,x:r.left,y:r.bottom+6,editing:true});}}
              style={{ '--document-color':color,'--document-aspect':String(doc.width/doc.height) } as React.CSSProperties}
              className={`document-mosaic-tab cursor-pointer text-xs select-none relative ${
                isActive
                  ? 'text-(--ui-strong)'
                  : 'text-(--ui-muted)'
              }`}
            >
              <DocumentTabImage project={doc.project}/>
            </div>
          );
        })}

        {/* Plus Button to Quick Create New Document Tab */}
        <button
          onClick={() => onNewDocument()}
          className="w-7 h-full flex items-center justify-center hover:bg-(--ui-raised) text-(--ui-muted) hover:text-(--ui-strong) transition-colors shrink-0"
          aria-label="新建空白画布"
          data-tip="新建空白画布"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 3. Right: Zoom (放缩) + Unified Export Square Button */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {/* Zoom Controls */}
        <div className="relative" ref={zoomMenuRef}>
        <button type="button" aria-label="画布缩放设置" aria-expanded={showZoomMenu} onClick={()=>setShowZoomMenu(!showZoomMenu)}
          className="sm:hidden w-12 h-9 rounded-lg text-[11px] text-(--ui-text-2) hover:bg-(--ui-hover)">{Math.round(zoom*100)}%</button>
        <div role="group" aria-label="画布缩放控件" className={`${showZoomMenu?'flex':'hidden'} absolute right-0 top-full mt-1 p-2 rounded-lg border border-(--ui-border) bg-(--ui-panel) shadow-lg sm:static sm:mt-0 sm:p-0 sm:border-0 sm:bg-transparent sm:shadow-none sm:flex items-center text-(--ui-text-2)`}>
          <button
            onClick={() => onZoomChange(zoom / ZOOM_STEP)}
            className="p-1.5 rounded-lg hover:bg-(--ui-hover) hover:text-(--ui-strong) transition-colors"
            data-tip="缩小画布"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <WheelNumber tip="画布缩放" value={Math.round(zoom * 100)} min={MIN_ZOOM * 100} max={MAX_ZOOM * 100}
            dragStep={1} format={value => `${value}%`} onChange={value => onZoomChange(value / 100)} />
          <button
            onClick={() => onZoomChange(zoom * ZOOM_STEP)}
            className="p-1.5 rounded-lg hover:bg-(--ui-hover) hover:text-(--ui-strong) transition-colors"
            data-tip="放大画布"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={onResetZoom} data-tip="回到原始大小（100%）"
            className="h-7 px-1 text-[10px] font-mono text-(--ui-muted) hover:text-(--ui-strong)">1:1</button>
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

      {thumb && (() => {
        const doc = documents.find((d) => d.id === thumb.id);
        return doc ? <DocThumbnail key={doc.id} project={doc.project} name={doc.name} x={thumb.x} y={thumb.y} editing={thumb.editing}
          onEnter={()=>window.clearTimeout(thumbTimer.current)} onLeave={leaveThumb}
          onRename={name=>onRenameDocument(doc.id,name)}
          onClose={documents.length>1?()=>{hideThumb();onCloseDocument(doc.id);}:undefined}/> : null;
      })()}
    </header>
  );
};
