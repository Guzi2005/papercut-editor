/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  PapercutProject,
  Layer,
  ToolType,
  BrushSettings,
  CutoutPath,
  LayerDrawStroke,
} from './types/papercut';
import { PRESET_PROJECTS, FOLK_PALETTE } from './utils/presetTemplates';
import { createBaseShapePath } from './utils/bezierMath';
import { generateSvgMarkup, downloadFile, exportToPng } from './utils/svgExporter';
import { TopBar, DocumentTabItem, WorkbenchSkin } from './components/TopBar';
import { Toolbar } from './components/Toolbar';
import { ToolOptions } from './components/ToolOptions';
import { Canvas } from './components/Canvas';
import { LayersPanel } from './components/LayersPanel';
import { ExportModal } from './components/ExportModal';
import { RecentColorsBar } from './components/RecentColorsBar';

interface DocumentItem {
  id: string;
  name: string;
  project: PapercutProject;
  history: PapercutProject[];
  historyIndex: number;
  activeLayerId: string;
  zoom: number;
}

export default function App() {
  // Built-in initial open documents
  const [documents, setDocuments] = useState<DocumentItem[]>(() => {
    const p1 = PRESET_PROJECTS[0].factory();
    const p2 = PRESET_PROJECTS[2].factory();
    const p3 = PRESET_PROJECTS[3].factory();

    return [
      {
        id: 'doc_workshop',
        name: '针脚与远方·民俗工坊',
        project: p1,
        history: [p1],
        historyIndex: 0,
        activeLayerId: p1.groups[0]?.layerIds[0] || Object.keys(p1.layers)[0] || '',
        zoom: 0.9,
      },
      {
        id: 'doc_rosette',
        name: '吉庆连年·八折团花',
        project: p2,
        history: [p2],
        historyIndex: 0,
        activeLayerId: p2.groups[0]?.layerIds[0] || Object.keys(p2.layers)[0] || '',
        zoom: 0.95,
      },
      {
        id: 'doc_blank',
        name: '新建剪纸 1',
        project: p3,
        history: [p3],
        historyIndex: 0,
        activeLayerId: p3.groups[0]?.layerIds[0] || Object.keys(p3.layers)[0] || '',
        zoom: 0.9,
      },
    ];
  });

  const [activeDocId, setActiveDocId] = useState<string>('doc_workshop');

  // Tool & Brush Settings
  const [currentTool, setCurrentTool] = useState<ToolType>('willow_leaf');
  const [brushSettings, setBrushSettings] = useState<BrushSettings>({
    willowMode: 'chord',
    stabilizer: 0.55,
    simplifyTolerance: 4.5,
    curvature: 0,
    geomShapeType: 'rect',
    combSpacing: 16,
    combToothAngle: 65,
    stampSize: 26,
    mode: 'cutout',
    // 笔刀 (Pen knife)
    knifePressure: false,
    knifeTipShape: 'round',
    // 手绘 (Hand draw)
    drawBrushType: 'pencil',
    drawPressure: true,
    drawOpacity: 0.85,
    drawColor: '#161B29',
    drawSize: 6,
    pencilHardness: 3,
    airbrushSoftness: 12,
  });

  // Workbench Skin (编辑器皮肤选择)
  const [skin, setSkin] = useState<WorkbenchSkin>('indigo');

  // Export Modal
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Color Notes (色卡备注，支持双击编辑)
  const [colorNotes, setColorNotes] = useState<Record<string, string>>({
    '#2652d0': '扎染靛蓝',
    '#3b6ef0': '青花瓷蓝',
    '#bac5eb': '紫藤浅蓝',
    '#482a45': '深绛紫茄',
    '#1b523d': '松针墨绿',
    '#438b6e': '湖水青绿',
    '#eb8e88': '珊瑚胭脂',
    '#e8dec8': '麦芒亚麻',
    '#1e2538': '苍石墨青',
    '#fbfbfc': '宣纸净白',
    '#e59824': '蜜蜡明黄',
    '#d23838': '朱砂印红',
    '#9daee3': '丁香粉藕',
    '#15171f': '玄墨沉黑',
    '#f3efe6': '素练暖白',
  });

  const handleUpdateColorNote = (hex: string, note: string) => {
    setColorNotes((prev) => ({ ...prev, [hex.toLowerCase()]: note }));
  };

  // Recent Colors (近期用色，方块书签式交互，选中时伸出)
  const [recentColors, setRecentColors] = useState<string[]>([
    '#2652D0',
    '#BAC5EB',
    '#482A45',
    '#1B523D',
    '#EB8E88',
    '#FBFBFC',
    '#3B6EF0',
    '#D23838',
  ]);

  const pushRecentColor = (hex: string) => {
    setRecentColors((prev) => {
      const filtered = prev.filter(
        (c) => c.toLowerCase() !== hex.toLowerCase()
      );
      return [hex, ...filtered].slice(0, 9);
    });
  };

  // Current active document object
  const activeDoc = documents.find((d) => d.id === activeDocId) || documents[0];
  const project = activeDoc.project;
  const activeLayerId = activeDoc.activeLayerId;
  const zoom = activeDoc.zoom;

  // History push for active document
  const pushHistory = useCallback(
    (newProject: PapercutProject) => {
      setDocuments((prevDocs) =>
        prevDocs.map((doc) => {
          if (doc.id !== activeDocId) return doc;
          const nextHistory = doc.history.slice(0, doc.historyIndex + 1);
          nextHistory.push(newProject);
          if (nextHistory.length > 30) nextHistory.shift();
          return {
            ...doc,
            project: newProject,
            history: nextHistory,
            historyIndex: Math.min(doc.historyIndex + 1, 29),
          };
        })
      );
    },
    [activeDocId]
  );

  const canUndo = activeDoc.historyIndex > 0;
  const canRedo = activeDoc.historyIndex < activeDoc.history.length - 1;

  const handleUndo = useCallback(() => {
    setDocuments((prevDocs) =>
      prevDocs.map((doc) => {
        if (doc.id !== activeDocId || doc.historyIndex <= 0) return doc;
        const newIdx = doc.historyIndex - 1;
        return {
          ...doc,
          historyIndex: newIdx,
          project: doc.history[newIdx],
        };
      })
    );
  }, [activeDocId]);

  const handleRedo = useCallback(() => {
    setDocuments((prevDocs) =>
      prevDocs.map((doc) => {
        if (doc.id !== activeDocId || doc.historyIndex >= doc.history.length - 1)
          return doc;
        const newIdx = doc.historyIndex + 1;
        return {
          ...doc,
          historyIndex: newIdx,
          project: doc.history[newIdx],
        };
      })
    );
  }, [activeDocId]);

  // Zoom handler
  const handleZoomChange = (newZoom: number) => {
    setDocuments((prev) =>
      prev.map((d) => (d.id === activeDocId ? { ...d, zoom: newZoom } : d))
    );
  };

  // Layer selection
  const handleSelectLayer = (layerId: string) => {
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === activeDocId ? { ...d, activeLayerId: layerId } : d
      )
    );
  };

  // Document Management Operations
  const handleSelectDocument = (docId: string) => {
    setActiveDocId(docId);
  };

  const handleNewDocument = (
    name?: string,
    width = 800,
    height = 800
  ) => {
    const newId = `doc_${Date.now()}`;
    const docName = name || `新建剪纸 ${documents.length + 1}`;
    const blankProj = PRESET_PROJECTS[3].factory();
    blankProj.name = docName;
    blankProj.width = width;
    blankProj.height = height;

    if (blankProj.layers['layer_main']) {
      blankProj.layers['layer_main'].baseShape.d = createBaseShapePath(
        'rect',
        width,
        height
      );
    }

    const newDoc: DocumentItem = {
      id: newId,
      name: docName,
      project: blankProj,
      history: [blankProj],
      historyIndex: 0,
      activeLayerId: 'layer_main',
      zoom: 0.9,
    };

    setDocuments((prev) => [...prev, newDoc]);
    setActiveDocId(newId);
  };

  const handleOpenPreset = (presetId: string) => {
    const preset = PRESET_PROJECTS.find((p) => p.id === presetId);
    if (!preset) return;
    const newProj = preset.factory();
    const newId = `doc_${Date.now()}`;
    const firstLayerId =
      newProj.groups[0]?.layerIds[0] || Object.keys(newProj.layers)[0] || '';

    const newDoc: DocumentItem = {
      id: newId,
      name: preset.name,
      project: newProj,
      history: [newProj],
      historyIndex: 0,
      activeLayerId: firstLayerId,
      zoom: 0.9,
    };

    setDocuments((prev) => [...prev, newDoc]);
    setActiveDocId(newId);
  };

  const handleCloseDocument = (docId: string) => {
    if (documents.length <= 1) return;
    const closeIdx = documents.findIndex((d) => d.id === docId);
    const nextDocs = documents.filter((d) => d.id !== docId);
    setDocuments(nextDocs);
    if (activeDocId === docId) {
      const nextActive = nextDocs[Math.max(0, closeIdx - 1)] || nextDocs[0];
      setActiveDocId(nextActive.id);
    }
  };

  const handleRenameDocument = (docId: string, newName: string) => {
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === docId
          ? {
              ...d,
              name: newName,
              project: { ...d.project, name: newName },
            }
          : d
      )
    );
  };

  const handleUpdateCanvasSize = (w: number, h: number) => {
    const updatedProject: PapercutProject = {
      ...project,
      width: w,
      height: h,
    };
    pushHistory(updatedProject);
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }

      // New Document: Ctrl+N
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleNewDocument();
      }

      // Tool hotkeys: 1-5
      if (e.key === '1') setCurrentTool('willow_leaf');
      if (e.key === '2') setCurrentTool('geom_shape');
      if (e.key === '3') setCurrentTool('pen_knife');
      if (e.key === '4') setCurrentTool('hand_draw');
      if (e.key === '5') setCurrentTool('anchor_edit');

      // Escape to exit anchor_edit
      if (e.key === 'Escape' && currentTool === 'anchor_edit') {
        setCurrentTool('pen_knife');
      }

      // Zoom hotkeys (+, -)
      if (e.key === '=' || e.key === '+') {
        handleZoomChange(Math.min(zoom + 0.15, 3.5));
      } else if (e.key === '-' || e.key === '_') {
        handleZoomChange(Math.max(zoom - 0.15, 0.25));
      } else if (e.key === '0') {
        handleZoomChange(1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, zoom, currentTool]);

  // Fit to screen zoom
  const handleFitZoom = () => {
    const availWidth = window.innerWidth - 380;
    const availHeight = window.innerHeight - 120;
    if (availWidth > 0 && availHeight > 0) {
      const fitRatio = Math.min(
        availWidth / project.width,
        availHeight / project.height
      );
      handleZoomChange(Math.max(Math.min(fitRatio * 0.9, 2.0), 0.3));
    }
  };

  // Add Cutout to active layer
  const handleAddCutout = (cutout: CutoutPath) => {
    if (!activeLayerId || !project.layers[activeLayerId]) return;
    const layer = project.layers[activeLayerId];
    if (layer.locked || !layer.visible) return;

    const updatedLayer: Layer = {
      ...layer,
      cutouts: [...layer.cutouts, cutout],
    };

    const newProject: PapercutProject = {
      ...project,
      layers: {
        ...project.layers,
        [activeLayerId]: updatedLayer,
      },
    };
    pushHistory(newProject);
  };

  // Add Hand Drawing Stroke to active layer (附属于剪纸图层蒙版)
  const handleAddDrawingStroke = (stroke: LayerDrawStroke) => {
    if (!activeLayerId || !project.layers[activeLayerId]) return;
    const layer = project.layers[activeLayerId];
    if (layer.locked || !layer.visible) return;

    const currentDrawings = layer.drawings || [];
    const updatedLayer: Layer = {
      ...layer,
      drawings: [...currentDrawings, stroke],
    };

    const newProject: PapercutProject = {
      ...project,
      layers: {
        ...project.layers,
        [activeLayerId]: updatedLayer,
      },
    };
    pushHistory(newProject);
  };

  // Update Cutout
  const handleUpdateCutout = (cutoutId: string, updates: Partial<CutoutPath>) => {
    if (!activeLayerId || !project.layers[activeLayerId]) return;
    const layer = project.layers[activeLayerId];

    const updatedCutouts = layer.cutouts.map((c) =>
      c.id === cutoutId ? { ...c, ...updates } : c
    );

    const newProject: PapercutProject = {
      ...project,
      layers: {
        ...project.layers,
        [activeLayerId]: {
          ...layer,
          cutouts: updatedCutouts,
        },
      },
    };

    setDocuments((prevDocs) =>
      prevDocs.map((doc) =>
        doc.id === activeDocId ? { ...doc, project: newProject } : doc
      )
    );
  };

  const handleCommitCutoutEdit = () => {
    pushHistory(project);
  };

  const handleRemoveCutout = (cutoutId: string) => {
    if (!activeLayerId || !project.layers[activeLayerId]) return;
    const layer = project.layers[activeLayerId];

    const updatedLayer: Layer = {
      ...layer,
      cutouts: layer.cutouts.filter((c) => c.id !== cutoutId),
    };

    const newProject: PapercutProject = {
      ...project,
      layers: {
        ...project.layers,
        [activeLayerId]: updatedLayer,
      },
    };
    pushHistory(newProject);
  };

  // Reorder Layers (拖拽排序图层)
  const handleReorderLayers = (
    sourceId: string,
    targetId: string,
    position: 'above' | 'below' = 'above'
  ) => {
    if (sourceId === targetId) return;

    let newRootOrder = [...project.rootOrder];
    let newGroups = project.groups.map((g) => ({
      ...g,
      layerIds: [...g.layerIds],
    }));

    const sIdx = newRootOrder.findIndex(
      (item) => item.type === 'layer' && item.id === sourceId
    );
    const sourceGroup = newGroups.find((g) => g.layerIds.includes(sourceId));
    const targetGroup = newGroups.find((g) => g.layerIds.includes(targetId));

    if (sIdx !== -1) {
      const [moved] = newRootOrder.splice(sIdx, 1);
      const afterTargetIdx = newRootOrder.findIndex(
        (item) => item.type === 'layer' && item.id === targetId
      );
      if (afterTargetIdx !== -1) {
        // UI list is rendered in reverse (index 0 is bottom, last is top).
        // Visually 'above' in UI means higher z-index (after target in rootOrder).
        // Visually 'below' in UI means lower z-index (before target in rootOrder).
        const insertIdx = position === 'above' ? afterTargetIdx + 1 : afterTargetIdx;
        newRootOrder.splice(Math.max(0, insertIdx), 0, moved);
      } else if (targetGroup) {
        const gtIdx = targetGroup.layerIds.indexOf(targetId);
        const insertIdx = position === 'above' ? gtIdx + 1 : gtIdx;
        targetGroup.layerIds.splice(Math.max(0, insertIdx), 0, sourceId);
      } else {
        newRootOrder.push(moved);
      }
    } else if (sourceGroup && targetGroup && sourceGroup.id === targetGroup.id) {
      const gsIdx = sourceGroup.layerIds.indexOf(sourceId);
      sourceGroup.layerIds.splice(gsIdx, 1);
      const gtIdx = sourceGroup.layerIds.indexOf(targetId);
      const insertIdx = position === 'above' ? gtIdx + 1 : gtIdx;
      sourceGroup.layerIds.splice(Math.max(0, insertIdx), 0, sourceId);
    } else if (sourceGroup) {
      sourceGroup.layerIds = sourceGroup.layerIds.filter((id) => id !== sourceId);
      const afterTargetIdx = newRootOrder.findIndex(
        (item) => item.type === 'layer' && item.id === targetId
      );
      if (afterTargetIdx !== -1) {
        const insertIdx = position === 'above' ? afterTargetIdx + 1 : afterTargetIdx;
        newRootOrder.splice(Math.max(0, insertIdx), 0, { type: 'layer', id: sourceId });
      } else {
        newRootOrder.push({ type: 'layer', id: sourceId });
      }
    }

    const newProject: PapercutProject = {
      ...project,
      rootOrder: newRootOrder,
      groups: newGroups,
    };
    pushHistory(newProject);
  };

  // Layer Operations
  const handleAddLayer = (groupId?: string) => {
    const newId = `layer_${Date.now()}`;
    const defaultColor =
      FOLK_PALETTE[Object.keys(project.layers).length % FOLK_PALETTE.length].hex;

    pushRecentColor(defaultColor);

    const newLayer: Layer = {
      id: newId,
      name: `剪纸图层 ${Object.keys(project.layers).length + 1}`,
      color: defaultColor,
      texture: 'xuan',
      opacity: 1,
      blendMode: 'normal',
      visible: true,
      locked: false,
      baseShape: {
        type: 'rounded_rect',
        d: createBaseShapePath('rounded_rect', project.width, project.height, 100),
      },
      cutouts: [],
      positiveElements: [],
      drawings: [],
    };

    let newGroups = [...project.groups];
    let newRootOrder = [...project.rootOrder];

    if (groupId) {
      newGroups = newGroups.map((g) => {
        if (g.id === groupId) {
          return { ...g, layerIds: [...g.layerIds, newId] };
        }
        return g;
      });
    } else {
      newRootOrder.push({ type: 'layer', id: newId });
    }

    const newProject: PapercutProject = {
      ...project,
      layers: {
        ...project.layers,
        [newId]: newLayer,
      },
      groups: newGroups,
      rootOrder: newRootOrder,
    };

    handleSelectLayer(newId);
    pushHistory(newProject);
  };

  const handleUpdateLayer = (layerId: string, updates: Partial<Layer>) => {
    if (!project.layers[layerId]) return;
    if (updates.color) {
      pushRecentColor(updates.color);
    }
    const newProject: PapercutProject = {
      ...project,
      layers: {
        ...project.layers,
        [layerId]: {
          ...project.layers[layerId],
          ...updates,
        },
      },
    };
    pushHistory(newProject);
  };

  const handleSelectRecentColor = (hex: string) => {
    if (activeLayerId) {
      handleUpdateLayer(activeLayerId, { color: hex });
    }
  };

  const handleDeleteLayer = (layerId: string) => {
    const newLayers = { ...project.layers };
    delete newLayers[layerId];

    const newGroups = project.groups.map((g) => ({
      ...g,
      layerIds: g.layerIds.filter((id) => id !== layerId),
    }));

    const newRootOrder = project.rootOrder.filter(
      (item) => !(item.type === 'layer' && item.id === layerId)
    );

    const remainingLayerIds = Object.keys(newLayers);
    if (activeLayerId === layerId) {
      handleSelectLayer(remainingLayerIds[0] || '');
    }

    const newProject: PapercutProject = {
      ...project,
      layers: newLayers,
      groups: newGroups,
      rootOrder: newRootOrder,
    };
    pushHistory(newProject);
  };

  const handleDuplicateLayer = (layerId: string) => {
    const source = project.layers[layerId];
    if (!source) return;

    const newId = `layer_${Date.now()}`;
    const duplicated: Layer = {
      ...source,
      id: newId,
      name: `${source.name} 副本`,
      cutouts: source.cutouts.map((c) => ({
        ...c,
        id: `cut_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      })),
      drawings: source.drawings ? [...source.drawings] : [],
    };

    let newRootOrder = [...project.rootOrder];
    const rootIdx = newRootOrder.findIndex(
      (item) => item.type === 'layer' && item.id === layerId
    );
    if (rootIdx !== -1) {
      newRootOrder.splice(rootIdx + 1, 0, { type: 'layer', id: newId });
    } else {
      newRootOrder.push({ type: 'layer', id: newId });
    }

    const newProject: PapercutProject = {
      ...project,
      layers: {
        ...project.layers,
        [newId]: duplicated,
      },
      rootOrder: newRootOrder,
    };

    handleSelectLayer(newId);
    pushHistory(newProject);
  };

  const handleInvertLayerCutouts = (layerId: string) => {
    const layer = project.layers[layerId];
    if (!layer) return;

    const invertedCutouts = layer.cutouts.map((c) => ({
      ...c,
      isHole: !c.isHole,
      fillColor: c.isHole ? layer.color : undefined,
    }));

    handleUpdateLayer(layerId, { cutouts: invertedCutouts });
  };

  const handleClearLayerCutouts = (layerId: string) => {
    handleUpdateLayer(layerId, { cutouts: [], positiveElements: [] });
  };

  // Quick export helpers
  const handleQuickCopySvg = () => {
    const markup = generateSvgMarkup(project, { includeBackground: false });
    navigator.clipboard.writeText(markup);
  };

  const handleQuickDownloadSvg = () => {
    const markup = generateSvgMarkup(project, { includeBackground: false });
    downloadFile(
      markup,
      `${project.name || 'cyber_papercut'}.svg`,
      'image/svg+xml;charset=utf-8'
    );
  };

  const handleQuickDownloadPng = async () => {
    try {
      const dataUrl = await exportToPng(project, 2, false);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${project.name || 'cyber_papercut'}@2x.png`;
      a.click();
    } catch (e) {
      console.error('PNG export failed', e);
    }
  };

  const activeLayer = activeLayerId ? project.layers[activeLayerId] : null;

  const documentTabItems: DocumentTabItem[] = documents.map((d) => ({
    id: d.id,
    name: d.name,
    width: d.project.width,
    height: d.project.height,
  }));

  const SKIN_BACKGROUNDS: Record<WorkbenchSkin, string> = {
    indigo: 'bg-[#111520]',
    cinnabar: 'bg-[#181215]',
    celadon: 'bg-[#0E1713]',
    wisteria: 'bg-[#18111B]',
    ebony: 'bg-[#191512]',
  };

  return (
    <div
      className={`flex flex-col h-screen w-screen ${
        SKIN_BACKGROUNDS[skin] || 'bg-[#111520]'
      } text-[#CAD0DB] overflow-hidden font-sans transition-colors duration-200`}
    >
      {/* Top Bar (文件-设置皮肤、SAI风格多标签页切换、无重复撤销重做按钮) */}
      <TopBar
        documents={documentTabItems}
        activeDocId={activeDocId}
        onSelectDocument={handleSelectDocument}
        onNewDocument={handleNewDocument}
        onCloseDocument={handleCloseDocument}
        onRenameDocument={handleRenameDocument}
        onOpenPreset={handleOpenPreset}
        currentWidth={project.width}
        currentHeight={project.height}
        onUpdateCanvasSize={handleUpdateCanvasSize}
        currentSkin={skin}
        onSelectSkin={setSkin}
        zoom={zoom}
        onZoomChange={handleZoomChange}
        onResetZoom={() => handleZoomChange(1)}
        onFitZoom={handleFitZoom}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onQuickCopySvg={handleQuickCopySvg}
        onQuickDownloadSvg={handleQuickDownloadSvg}
        onQuickDownloadPng={handleQuickDownloadPng}
      />

      {/* Tool Options Strip - 压感开关、笔尖形状选择、手绘五档铅笔等 */}
      <ToolOptions
        currentTool={currentTool}
        brushSettings={brushSettings}
        onChangeBrushSettings={(settings) =>
          setBrushSettings((prev) => ({ ...prev, ...settings }))
        }
        onSelectTool={setCurrentTool}
      />

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Toolbar (柳叶、几何、笔刀、手绘、锚点微调) */}
        <Toolbar
          currentTool={currentTool}
          onSelectTool={setCurrentTool}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onFitZoom={handleFitZoom}
        />

        {/* Center Interactive Canvas */}
        <div className="flex-1 flex flex-col relative overflow-hidden">
          <Canvas
            project={project}
            activeLayerId={activeLayerId}
            currentTool={currentTool}
            brushSettings={brushSettings}
            onChangeBrushSettings={(settings) =>
              setBrushSettings((prev) => ({ ...prev, ...settings }))
            }
            zoom={zoom}
            onZoomChange={handleZoomChange}
            onAddCutout={handleAddCutout}
            onRemoveCutout={handleRemoveCutout}
            onUpdateCutout={handleUpdateCutout}
            onAddDrawingStroke={handleAddDrawingStroke}
            onCommitCutoutEdit={handleCommitCutoutEdit}
            onExitAnchorEdit={() => setCurrentTool('pen_knife')}
          />

          {/* 近期用色：纯方块书签无黑底，hover浮现备注，选中伸出 */}
          <RecentColorsBar
            recentColors={recentColors}
            activeColor={activeLayer?.color || ''}
            onSelectColor={handleSelectRecentColor}
            colorNotes={colorNotes}
          />
        </div>

        {/* Right Layers Panel (支持拖拽排序图层) */}
        <LayersPanel
          layers={project.layers}
          groups={project.groups}
          rootOrder={project.rootOrder}
          activeLayerId={activeLayerId}
          canvasWidth={project.width}
          canvasHeight={project.height}
          colorNotes={colorNotes}
          onUpdateColorNote={handleUpdateColorNote}
          onSelectLayer={handleSelectLayer}
          onUpdateLayer={handleUpdateLayer}
          onAddLayer={handleAddLayer}
          onDeleteLayer={handleDeleteLayer}
          onDuplicateLayer={handleDuplicateLayer}
          onInvertLayerCutouts={handleInvertLayerCutouts}
          onClearLayerCutouts={handleClearLayerCutouts}
          onReorderLayers={handleReorderLayers}
        />
      </div>

      {/* SVG / PNG Export Modal */}
      {isExportModalOpen && (
        <ExportModal
          project={project}
          onClose={() => setIsExportModalOpen(false)}
        />
      )}
    </div>
  );
}
