import { NewCanvasDialog } from './components/NewCanvasDialog';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import {
  PapercutProject,
  PapercutItem,
  Layer,
  LayerGroup,
  ToolType,
  BrushSettings,
  CutoutPath,
  LayerDrawStroke,
  ReferenceImage,
} from './types/papercut';
import { PRESET_PROJECTS, FOLK_PALETTE, createBlankCanvas, BlankCanvasOptions } from './utils/presetTemplates';
import { generateSvgMarkup, downloadFile, exportToPng } from './utils/svgExporter';
import { Transform, applyTransform } from './utils/pathTransform';
import {
  newId,
  transformLayer,
  normalizeProject,
  findGroupOfLayer,
  findItemOfLayer,
  flattenLayerIds,
  transformBlocks,
  removeBlocks,
  BlockSelection,
  itemPrefix,
  prefixedName,
  renameItemParts,
  NAME_SEP,
} from './utils/projectOps';
import {
  loadWorkspace,
  saveWorkspace,
  storageStatus,
  serializeProject,
  parseProjectFile,
  pickFile,
  readFileAsDataUrl,
  PROJECT_FILE_EXT,
} from './utils/storage';
import { TopBar, DocumentTabItem } from './components/TopBar';
import { TooltipLayer } from './components/TooltipLayer';
import { WorkbenchSkin, skinVariables, loadSkin, saveSkin } from './utils/skins';
import { useMediaQuery, COMPACT_QUERY } from './hooks/useMediaQuery';
import { Toolbar } from './components/Toolbar';
import { ToolOptions } from './components/ToolOptions';
import { Canvas, SelectionScope, PointInfo, FlashRequest } from './components/Canvas';
import { LayersPanel } from './components/LayersPanel';
import { ExportModal } from './components/ExportModal';
import { GodotExportModal } from './components/GodotExportModal';
import { KeymapModal } from './components/KeymapModal';
import { ToolQuickMenu } from './components/ToolQuickMenu';
import { ActionId, Keymap, actionForKey, comboFromKeyEvent, loadKeymap, saveKeymap } from './utils/keymap';
import { MIN_ZOOM, MAX_ZOOM, ZOOM_STEP } from './utils/zoom';
import { playHistory, playToolPick, playPaperPlace } from './utils/soundEffects';
import { TwinPreset, loadTwinPresets, storeTwinPresets } from './utils/twinPresets';
import { projectShadowOptions } from './utils/layerSvg';
import { SaveSettings, SaveStatus, loadSaveSettings, storeSaveSettings } from './utils/saveSettings';
import { SaveBanner } from './components/SaveBanner';
import { applyPathfinder, PathfinderOp } from './utils/pathfinder';
import { mergeLayerOnto } from './utils/mergeLayers';

interface DocumentItem {
  id: string;
  name: string;
  project: PapercutProject;
  history: PapercutProject[];
  historyIndex: number;
  activeLayerId: string;
  zoom: number;
}

const HISTORY_LIMIT = 60;
/** Undo steps kept for documents in background tabs. */
const INACTIVE_HISTORY = 20;

function firstLayerId(p: PapercutProject): string {
  const ids = flattenLayerIds(p);
  return ids[ids.length - 1] || '';
}

function makeDocument(id: string, name: string, project: PapercutProject, zoom = 0.9): DocumentItem {
  const p = normalizeProject(project);
  return { id, name, project: p, history: [p], historyIndex: 0, activeLayerId: firstLayerId(p), zoom };
}

function initialDocuments(): DocumentItem[] {
  const find = (id: string) => PRESET_PROJECTS.find((p) => p.id === id)!;
  const chars = find('weave_characters');
  const polish = find('polish_angel');
  return [
    makeDocument('doc_characters', chars.name, chars.factory(), 0.85),
    makeDocument('doc_polish', polish.name, polish.factory(), 0.85),
  ];
}

export default function App() {
  const [documents, setDocuments] = useState<DocumentItem[]>(initialDocuments);
  const [activeDocId, setActiveDocId] = useState<string>(() => documents[0].id);
  const [hydrated, setHydrated] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [saveSettings, setSaveSettingsState] = useState<SaveSettings>(loadSaveSettings);
  const setSaveSettings = (patch: Partial<SaveSettings>) =>
    setSaveSettingsState((prev) => {
      const next = { ...prev, ...patch };
      storeSaveSettings(next);
      return next;
    });
  const [saveBanner, setSaveBanner] = useState<{ id: number; text: string; error?: boolean } | null>(null);
  const [saveFile, setSaveFile] = useState<{ docId: string; name: string; handle: FileSystemFileHandle } | null>(null);

  // Selection (not persisted)
  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([]);
  const [selectionScope, setSelectionScope] = useState<SelectionScope>('item');
  const [toolMenu, setToolMenu] = useState<{ x: number; y: number; here?: PointInfo } | null>(null);
  const [flash, setFlash] = useState<FlashRequest | null>(null);
  const closeToolMenu = useCallback(() => setToolMenu(null), []);
  const [imageDrop, setImageDrop] = useState<{ file: File; preview: string } | null>(null);

  // Tool & Brush Settings
  const [currentTool, setCurrentTool] = useState<ToolType>('select');
  const toolMounted = useRef(false);
  useEffect(() => {
    if (toolMounted.current) playToolPick();
    toolMounted.current = true;
  }, [currentTool]);
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
    pressure: true,
    brushColor: '#15161C',
    knifeTipShape: 'round',
    drawBrushType: 'pencil',
    drawOpacity: 0.85,
    drawSize: 6,
    pencilHardness: 3,
    airbrushSoftness: 12,
  });

  const [skin, setSkinState] = useState<WorkbenchSkin>(loadSkin);
  const setSkin = (id: WorkbenchSkin) => {
    setSkinState(id);
    saveSkin(id);
  };

  // Variables live on <html> so portals (tooltips, native popups) are themed too.
  useLayoutEffect(() => {
    const root = document.documentElement.style;
    Object.entries(skinVariables(skin)).forEach(([k, v]) => {
      if (k.startsWith('--')) root.setProperty(k, String(v));
      else if (k === 'colorScheme') root.colorScheme = String(v);
    });
  }, [skin]);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isNewCanvasOpen, setIsNewCanvasOpen] = useState(false);
  const [isGodotModalOpen, setIsGodotModalOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [keymap, setKeymap] = useState<Keymap>(loadKeymap);
  const compact = useMediaQuery(COMPACT_QUERY);
  const [panelOpen, setPanelOpen] = useState(false);
  const [fitSignal, setFitSignal] = useState(0);
  const lastFitZoomRef = useRef<number | null>(null);

  const [colorNotes, setColorNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(FOLK_PALETTE.map((c) => [c.hex.toLowerCase(), c.name]))
  );

  const [recentBrushColors, setRecentBrushColors] = useState<string[]>([]);

  const handleUpdateColorNote = (hex: string, note: string) => {
    setColorNotes((prev) => ({ ...prev, [hex.toLowerCase()]: note }));
  };


  // ---------- Persistence: restore on boot, autosave after edits ----------
  useEffect(() => {
    let cancelled = false;
    loadWorkspace().then((snap) => {
      if (cancelled) return;
      if (snap) {
        const docs = snap.documents.map((d) => ({
          ...d,
          history: [d.project],
          historyIndex: 0,
        }));
        setDocuments(docs);
        setActiveDocId(docs.some((d) => d.id === snap.activeDocId) ? snap.activeDocId : docs[0].id);
      }
      setHydrated(true);
      storageStatus();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Saves are driven by the user's settings; the latest state is read through refs so timers
  // never write a stale workspace.
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const stateRef = useRef({ documents, activeDocId, saveSettings, saveFile });
  stateRef.current = { documents, activeDocId, saveSettings, saveFile };

  const performSave = useCallback(async (reason: 'auto' | 'manual' | 'leave') => {
    if (savingRef.current) return;
    const { documents: docs, activeDocId: activeId, saveSettings: st, saveFile: file } = stateRef.current;
    savingRef.current = true;
    dirtyRef.current = false;
    setSaveStatus('saving');
    let fileNote = '';
    try {
      await saveWorkspace({
        documents: docs.map(({ id, name, project, activeLayerId, zoom }) => ({ id, name, project, activeLayerId, zoom })),
        activeDocId: activeId,
        savedAt: Date.now(),
      });
      const linked = file && st.toFile ? docs.find((d) => d.id === file.docId) : undefined;
      if (file && linked) {
        const w = await file.handle.createWritable();
        await w.write(serializeProject(linked.project));
        await w.close();
        fileNote = ` · 已写入 ${file.name}`;
      }
      setSaveStatus(dirtyRef.current ? 'dirty' : 'saved');
      if (reason !== 'leave' && (reason === 'manual' || st.banner)) {
        const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
        setSaveBanner({ id: Date.now(), text: `${reason === 'manual' ? '已保存' : '已自动保存'} · ${time}${fileNote}` });
      }
    } catch (err) {
      dirtyRef.current = true;
      setSaveStatus('dirty');
      setSaveBanner({ id: Date.now(), text: `保存失败：${err instanceof Error ? err.message : String(err)}`, error: true });
    } finally {
      savingRef.current = false;
    }
  }, []);

  const lastSeen = useRef<{ documents: typeof documents; activeDocId: string } | null>(null);
  const saveTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!hydrated) return;
    const prev = lastSeen.current;
    lastSeen.current = { documents, activeDocId };
    // The restore itself is not an edit; a settings change only reschedules pending work.
    if (!prev) return;
    const changed =
      prev.activeDocId !== activeDocId ||
      prev.documents.length !== documents.length ||
      documents.some((d, i) => {
        const o = prev.documents[i];
        return !o || o.id !== d.id || o.project !== d.project || o.name !== d.name || o.zoom !== d.zoom || o.activeLayerId !== d.activeLayerId;
      });
    if (changed) {
      dirtyRef.current = true;
      setSaveStatus('dirty');
    }
    window.clearTimeout(saveTimer.current);
    if (!dirtyRef.current) return;
    if (saveSettings.auto && saveSettings.trigger === 'edit') {
      saveTimer.current = window.setTimeout(() => performSave('auto'), saveSettings.delay * 1000);
    }
  }, [documents, activeDocId, hydrated, saveSettings.auto, saveSettings.trigger, saveSettings.delay, performSave]);

  useEffect(() => {
    if (!hydrated || !saveSettings.auto || saveSettings.trigger !== 'interval') return;
    const t = window.setInterval(() => dirtyRef.current && performSave('auto'), saveSettings.interval * 60000);
    return () => window.clearInterval(t);
  }, [hydrated, saveSettings.auto, saveSettings.trigger, saveSettings.interval, performSave]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden' && dirtyRef.current && stateRef.current.saveSettings.auto) performSave('leave');
    };
    const onLeave = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current && stateRef.current.saveSettings.warnOnLeave) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('beforeunload', onLeave);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('beforeunload', onLeave);
    };
  }, [performSave]);

  const pickSaveFile = async () => {
    const picker = (window as unknown as {
      showSaveFilePicker?: (o: unknown) => Promise<FileSystemFileHandle>;
    }).showSaveFilePicker;
    if (!picker) return;
    try {
      const handle = await picker({
        suggestedName: `${(project.name || 'papercut').replace(/[\\/:*?"<>|\s]+/g, '_')}${PROJECT_FILE_EXT}`,
        types: [{ description: 'Weave 剪纸项目', accept: { 'application/json': [PROJECT_FILE_EXT, '.json'] } }],
      });
      setSaveFile({ docId: activeDocId, name: handle.name, handle });
      setSaveSettings({ toFile: true });
      dirtyRef.current = true;
      performSave('manual');
    } catch {
      /* cancelled */
    }
  };

  // Current active document object
  const activeDoc = documents.find((d) => d.id === activeDocId) || documents[0];
  const project = activeDoc.project;
  const activeLayerId = activeDoc.activeLayerId;
  const zoom = activeDoc.zoom;

  useEffect(() => {
    setSelectedLayerIds([]);
    // Background tabs keep only their most recent undo steps.
    setDocuments((prev) => {
      let changed = false;
      const next = prev.map((d) => {
        if (d.id === activeDocId || d.history.length <= INACTIVE_HISTORY) return d;
        changed = true;
        const start = Math.max(0, Math.min(d.historyIndex - INACTIVE_HISTORY + 1, d.history.length - INACTIVE_HISTORY));
        return { ...d, history: d.history.slice(start, start + INACTIVE_HISTORY), historyIndex: d.historyIndex - start };
      });
      return changed ? next : prev;
    });
  }, [activeDocId]);

  // Drop selection entries that no longer exist (after undo/delete)
  useEffect(() => {
    setSelectedLayerIds((prev) => {
      const next = prev.filter((id) => project.layers[id]);
      return next.length === prev.length ? prev : next;
    });
  }, [project]);

  const pushHistory = useCallback(
    (newProject: PapercutProject) => {
      setDocuments((prevDocs) =>
        prevDocs.map((doc) => {
          if (doc.id !== activeDocId) return doc;
          const nextHistory = doc.history.slice(0, doc.historyIndex + 1);
          nextHistory.push(newProject);
          if (nextHistory.length > HISTORY_LIMIT) nextHistory.shift();
          return {
            ...doc,
            project: newProject,
            history: nextHistory,
            historyIndex: nextHistory.length - 1,
          };
        })
      );
    },
    [activeDocId]
  );

  const canUndo = activeDoc.historyIndex > 0;
  const canRedo = activeDoc.historyIndex < activeDoc.history.length - 1;

  const changeBrushColor = (hex: string, commit = true) => {
    setBrushSettings((prev) => ({ ...prev, brushColor: hex }));
    if (commit) {
      setRecentBrushColors((prev) => [hex, ...prev.filter((c) => c.toLowerCase() !== hex.toLowerCase())].slice(0, 12));
    }
  };

  const handleUndo = useCallback(() => {
    if (canUndo) playHistory(false);
    setDocuments((prevDocs) =>
      prevDocs.map((doc) => {
        if (doc.id !== activeDocId || doc.historyIndex <= 0) return doc;
        const newIdx = doc.historyIndex - 1;
        return { ...doc, historyIndex: newIdx, project: doc.history[newIdx] };
      })
    );
  }, [activeDocId, canUndo]);

  const handleRedo = useCallback(() => {
    if (canRedo) playHistory(true);
    setDocuments((prevDocs) =>
      prevDocs.map((doc) => {
        if (doc.id !== activeDocId || doc.historyIndex >= doc.history.length - 1) return doc;
        const newIdx = doc.historyIndex + 1;
        return { ...doc, historyIndex: newIdx, project: doc.history[newIdx] };
      })
    );
  }, [activeDocId, canRedo]);

  const handleZoomChange = (newZoom: number) => {
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newZoom));
    setDocuments((prev) => prev.map((d) => (d.id === activeDocId ? { ...d, zoom: z } : d)));
  };

  const handleSelectLayer = useCallback(
    (layerId: string) => {
      setDocuments((prev) =>
        prev.map((d) => (d.id === activeDocId ? { ...d, activeLayerId: layerId } : d))
      );
    },
    [activeDocId]
  );

  const handleSelectLayers = useCallback(
    (ids: string[], active?: string) => {
      setSelectedLayerIds(ids);
      if (active) handleSelectLayer(active);
    },
    [handleSelectLayer]
  );

  const handlePanelSelectLayer = (layerId: string) => {
    handleSelectLayer(layerId);
    setSelectedLayerIds([layerId]);
  };

  // ---------- Documents ----------
  const openProjectAsDocument = (proj: PapercutProject, name?: string) => {
    const doc = makeDocument(`doc_${Date.now()}`, name || proj.name, proj);
    setDocuments((prev) => [...prev, doc]);
    setActiveDocId(doc.id);
  };

  const handleNewDocument = (opts: BlankCanvasOptions) => {
    const width = opts?.width ?? 800;
    const height = opts?.height ?? 800;
    const mode = opts?.mode ?? 'cut';
    const docName = opts?.name || (mode === 'cut' ? `新建剪纸 ${documents.length + 1}` : `新建创作 ${documents.length + 1}`);
    const blankProj = createBlankCanvas({
      width,
      height,
      mode,
      paperColor: opts?.paperColor,
      canvasBg: opts.canvasBg,
      name: docName,
    });
    openProjectAsDocument(blankProj, docName);
    setIsNewCanvasOpen(false);
  };

  const handleOpenPreset = (presetId: string) => {
    const preset = PRESET_PROJECTS.find((p) => p.id === presetId);
    if (!preset) return;
    openProjectAsDocument(preset.factory(), preset.name);
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
        d.id === docId ? { ...d, name: newName, project: { ...d.project, name: newName } } : d
      )
    );
  };

  const handleUpdateCanvasSize = (w: number, h: number) => {
    pushHistory({ ...project, width: w, height: h });
  };

  const handleSaveProjectFile = useCallback(() => {
    const filename = `${(project.name || 'papercut').replace(/[\\/:*?"<>|\s]+/g, '_')}${PROJECT_FILE_EXT}`;
    downloadFile(serializeProject(project), filename, 'application/json');
  }, [project]);

  const handleOpenProjectFile = useCallback(async () => {
    const file = await pickFile('.json,.weave.json,application/json');
    if (!file) return;
    try {
      const proj = parseProjectFile(await file.text());
      openProjectAsDocument(proj, proj.name || file.name.replace(/\.weave\.json$|\.json$/i, ''));
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Keyboard Shortcuts (user-configurable, see utils/keymap) ----------
  useEffect(() => {
    const TOOLS: Partial<Record<ActionId, ToolType>> = {
      'tool.select': 'select',
      'tool.cut': 'willow_leaf',
      'tool.geom': 'geom_shape',
      'tool.knife': 'pen_knife',
      'tool.draw': 'hand_draw',
      'tool.anchor': 'anchor_edit',
    };
    const MODES: Partial<Record<ActionId, BrushSettings['mode']>> = {
      'mode.cutout': 'cutout',
      'mode.positive': 'positive',
      'mode.erase': 'erase',
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (isShortcutsOpen || document.querySelector('dialog[open]')) return;
      const combo = comboFromKeyEvent(e);
      const action = combo ? actionForKey(keymap, combo) : null;
      if (!action) return;
      // Canvas owns these (hold-to-pan, delete selection).
      if (action === 'view.panHold' || action === 'edit.delete') return;
      e.preventDefault();

      if (TOOLS[action]) {
        setCurrentTool(TOOLS[action]!);
        return;
      }
      if (MODES[action]) {
        setBrushSettings((prev) => ({ ...prev, mode: MODES[action]! }));
        setCurrentTool('willow_leaf');
        return;
      }
      switch (action) {
        case 'edit.undo':
          return handleUndo();
        case 'edit.redo':
          return handleRedo();
        case 'file.save':
          return handleSaveProjectFile();
        case 'file.open':
          return void handleOpenProjectFile();
        case 'file.new':
          return setIsNewCanvasOpen(true);
        case 'help.keymap':
          return setIsShortcutsOpen(true);
        case 'select.scope':
          if (currentTool === 'select') setSelectionScope((sc) => (sc === 'item' ? 'part' : sc === 'part' ? 'color' : 'item'));
          return;
        case 'select.cancel':
          if (currentTool === 'anchor_edit') setCurrentTool('pen_knife');
          else setSelectedLayerIds([]);
          return;
        case 'brush.smaller':
        case 'brush.bigger': {
          const up = action === 'brush.bigger';
          setBrushSettings((prev) => {
            const bump = (v: number) => Math.max(1, Math.min(120, Math.round(v * (up ? 1.15 : 1 / 1.15)) + (up ? 1 : -1)));
            if (currentTool === 'pen_knife' || currentTool === 'freehand') return { ...prev, stampSize: bump(prev.stampSize || 26) };
            if (currentTool === 'hand_draw') return { ...prev, drawSize: bump(prev.drawSize || 6) };
            return prev;
          });
          return;
        }
        case 'view.zoomIn':
          return handleZoomChange(zoom * ZOOM_STEP);
        case 'view.zoomOut':
          return handleZoomChange(zoom / ZOOM_STEP);
        case 'view.zoom100':
          return handleZoomChange(1);
        case 'view.fit':
          return handleFitZoom();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const handleFitZoom = () => {
    const stage = document.getElementById('canvas-stage')?.getBoundingClientRect();
    const availWidth = (stage?.width ?? window.innerWidth - 420) - 32;
    const availHeight = (stage?.height ?? window.innerHeight - 170) - 32;
    if (availWidth > 0 && availHeight > 0) {
      const fitRatio = Math.min(availWidth / project.width, availHeight / project.height);
      const z = Math.min(fitRatio, 2.0);
      lastFitZoomRef.current = z;
      handleZoomChange(z);
      setFitSignal((n) => n + 1);
    }
  };
  const fitRef = useRef(handleFitZoom);
  fitRef.current = handleFitZoom;
  const zoomNowRef = useRef(zoom);
  zoomNowRef.current = zoom;

  // Fit when a document opens larger than the stage (e.g. first launch in tablet portrait).
  useEffect(() => {
    if (!hydrated) return;
    const id = requestAnimationFrame(() => {
      const stage = document.getElementById('canvas-stage')?.getBoundingClientRect();
      if (stage && (project.width * zoom > stage.width - 16 || project.height * zoom > stage.height - 16)) {
        fitRef.current();
      }
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, activeDocId, compact]);

  // Rotating a tablet swaps the stage aspect, so refit once the new layout has settled.
  useEffect(() => {
    let landscape = window.innerWidth > window.innerHeight;
    let timer: number | undefined;
    const onResize = () => {
      const now = window.innerWidth > window.innerHeight;
      const rotated = now !== landscape;
      landscape = now;
      // Keep a fitted view fitted; leave a zoom the user chose alone unless the device rotated.
      const wasFitted = lastFitZoomRef.current !== null && Math.abs(zoomNowRef.current - lastFitZoomRef.current) < 1e-4;
      if (!rotated && !wasFitted) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => fitRef.current(), 200);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.clearTimeout(timer);
    };
  }, []);

  // ---------- Layer content edits ----------
  const updateActiveLayer = (fn: (layer: Layer) => Layer) => {
    if (!activeLayerId || !project.layers[activeLayerId]) return;
    const layer = project.layers[activeLayerId];
    pushHistory({ ...project, layers: { ...project.layers, [activeLayerId]: fn(layer) } });
  };

  const handleAddCutout = (cutout: CutoutPath) => {
    updateActiveLayer((layer) => ({ ...layer, cutouts: [...layer.cutouts, cutout] }));
  };

  const handleAddDrawingStroke = (stroke: LayerDrawStroke) => {
    updateActiveLayer((layer) => ({ ...layer, drawings: [...(layer.drawings || []), stroke] }));
  };

  const handleUpdateCutout = (cutoutId: string, updates: Partial<CutoutPath>, commit = false) => {
    if (!activeLayerId || !project.layers[activeLayerId]) return;
    const layer = project.layers[activeLayerId];
    const newProject: PapercutProject = {
      ...project,
      layers: {
        ...project.layers,
        [activeLayerId]: {
          ...layer,
          cutouts: layer.cutouts.map((c) => (c.id === cutoutId ? { ...c, ...updates, ...(updates.d ? {vectorNodeModes: undefined} : {}) } : c)),
        },
      },
    };
    if (commit) {
      pushHistory(newProject);
      return;
    }
    setDocuments((prevDocs) =>
      prevDocs.map((doc) => (doc.id === activeDocId ? { ...doc, project: newProject } : doc))
    );
  };

  const handleCommitCutoutEdit = () => {
    pushHistory(project);
  };

  const handleRemoveCutouts = (cutoutIds: string[]) => {
    const drop = new Set(cutoutIds);
    updateActiveLayer((layer) => ({ ...layer, cutouts: layer.cutouts.filter((c) => !drop.has(c.id)) }));
  };

  const handleTransformLayers = useCallback(
    (layerIds: string[], m: Transform) => {
      const layers = { ...project.layers };
      layerIds.forEach((id) => {
        if (layers[id]) layers[id] = transformLayer(layers[id], m);
      });
      const idSet = new Set(layerIds);
      const items = (project.items || []).map((it) =>
        it.partIds.every((pid) => idSet.has(pid))
          ? {
              ...it,
              pivot: applyTransform(m, it.pivot),
              sockets: it.sockets.map((s) => ({ ...s, ...applyTransform(m, s) })),
            }
          : it
      );
      pushHistory({ ...project, layers, items });
    },
    [project, pushHistory]
  );

  const handleTransformBlocks = useCallback(
    (sel: BlockSelection, m: Transform) => {
      const layers = { ...project.layers };
      Object.entries(sel).forEach(([lid, ids]) => {
        if (layers[lid] && ids.length) layers[lid] = transformBlocks(layers[lid], ids, m);
      });
      pushHistory({ ...project, layers });
    },
    [project, pushHistory]
  );

  const handleDeleteBlocks = useCallback(
    (sel: BlockSelection) => {
      const layers = { ...project.layers };
      Object.entries(sel).forEach(([lid, ids]) => {
        if (layers[lid]) layers[lid] = removeBlocks(layers[lid], ids);
      });
      pushHistory({ ...project, layers });
    },
    [project, pushHistory]
  );

  const handlePathfinder = (sel: BlockSelection, op: PathfinderOp): BlockSelection | null => {
    const r = applyPathfinder(project, sel, op);
    if (!r) return null;
    pushHistory(r.project);
    return r.selection;
  };

  // ---------- Layer structure ----------
  const handleReorderLayers = (
    sourceId: string,
    targetId: string,
    position: 'above' | 'below' = 'above'
  ) => {
    if (sourceId === targetId) return;
    const rootOrder = project.rootOrder.filter((r) => !(r.type === 'layer' && r.id === sourceId));
    const groups = project.groups.map((g) => ({
      ...g,
      layerIds: g.layerIds.filter((id) => id !== sourceId),
    }));

    const targetGroup = groups.find((g) => g.layerIds.includes(targetId));
    if (targetGroup) {
      const idx = targetGroup.layerIds.indexOf(targetId);
      targetGroup.layerIds.splice(position === 'above' ? idx + 1 : idx, 0, sourceId);
    } else {
      const idx = rootOrder.findIndex((r) => r.type === 'layer' && r.id === targetId);
      if (idx === -1) rootOrder.push({ type: 'layer', id: sourceId });
      else rootOrder.splice(position === 'above' ? idx + 1 : idx, 0, { type: 'layer', id: sourceId });
    }
    pushHistory({ ...project, rootOrder, groups });
  };

  const handleMoveLayerToGroup = (layerId: string, groupId: string) => {
    const rootOrder = project.rootOrder.filter((r) => !(r.type === 'layer' && r.id === layerId));
    const groups = project.groups.map((g) => {
      const without = g.layerIds.filter((id) => id !== layerId);
      return g.id === groupId ? { ...g, layerIds: [...without, layerId] } : { ...g, layerIds: without };
    });
    pushHistory({ ...project, rootOrder, groups });
  };

  const handleReorderRoot = (sourceRootId: string, targetRootId: string, position: 'above' | 'below') => {
    if (sourceRootId === targetRootId) return;
    const moving = project.rootOrder.find((r) => r.id === sourceRootId);
    if (!moving) return;
    const rootOrder = project.rootOrder.filter((r) => r.id !== sourceRootId);
    const idx = rootOrder.findIndex((r) => r.id === targetRootId);
    rootOrder.splice(position === 'above' ? idx + 1 : idx, 0, moving);
    pushHistory({ ...project, rootOrder });
  };

  const handleAddLayer = (groupId?: string, kind: 'paper' | 'doodle' = 'paper') => {
    const newLayerId = newId('layer');
    const defaultColor = FOLK_PALETTE[Object.keys(project.layers).length % FOLK_PALETTE.length].hex;
    const doodle = kind === 'doodle';

    const newLayer: Layer = {
      id: newLayerId,
      name: `${doodle ? '涂鸦' : '纸片'} ${Object.keys(project.layers).length + 1}`,
      kind,
      color: doodle ? brushSettings.brushColor : defaultColor,
      texture: 'xuan',
      opacity: 1,
      blendMode: 'normal',
      visible: true,
      locked: false,
      grain: doodle ? 0 : 0.35,
      // Blank by default — carve or paste to give it shape.
      baseShape: doodle ? { type: 'freeform', d: '' } : { type: 'freeform', d: '' },
      cutouts: [],
      positiveElements: [],
      drawings: [],
    };

    let groups = project.groups;
    let rootOrder = project.rootOrder;
    const targetGroupId = groupId ?? (activeLayerId ? findGroupOfLayer(project, activeLayerId)?.id : undefined);

    if (targetGroupId) {
      groups = groups.map((g) => {
        if (g.id !== targetGroupId) return g;
        const ids = [...g.layerIds];
        const at = activeLayerId ? ids.indexOf(activeLayerId) : -1;
        if (!groupId && at !== -1) ids.splice(at + 1, 0, newLayerId);
        else ids.push(newLayerId);
        return { ...g, layerIds: ids };
      });
    } else if (groups[0]) {
      // Prefer an existing depth group over a root-level orphan when creating into an empty project.
      groups = groups.map((g, i) => (i === 0 ? { ...g, layerIds: [...g.layerIds, newLayerId] } : g));
    } else {
      rootOrder = [...rootOrder, { type: 'layer', id: newLayerId }];
    }

    pushHistory({ ...project, layers: { ...project.layers, [newLayerId]: newLayer }, groups, rootOrder });
    handleSelectLayer(newLayerId);
    setSelectedLayerIds([newLayerId]);
    if (doodle) setCurrentTool('hand_draw');
  };

  // ---------- Twin layers: several sheets at once around the current layer ----------
  const [twinPresets, setTwinPresetsState] = useState<TwinPreset[]>(loadTwinPresets);
  const setTwinPresets = (next: TwinPreset[]) => {
    setTwinPresetsState(next);
    storeTwinPresets(next);
  };

  const handleAddTwin = (presetId: string) => {
    const preset = twinPresets.find((p) => p.id === presetId);
    if (!preset || preset.parts.length === 0) return;
    const item = activeLayerId ? findItemOfLayer(project, activeLayerId) : null;
    const prefix = item ? itemPrefix(item) : '';
    const made = preset.parts.map((part) => {
      const id = newId('layer');
      const layer: Layer = {
        id,
        name: prefix ? `${prefix}${NAME_SEP}${part.suffix}` : part.suffix,
        kind: 'paper',
        color: brushSettings.brushColor,
        texture: 'xuan',
        opacity: 1,
        blendMode: 'normal',
        visible: true,
        locked: false,
        grain: 0.35,
        baseShape: { type: 'freeform', d: '' },
        cutouts: [],
        positiveElements: [],
        drawings: [],
      };
      return { layer, place: part.place };
    });
    // Later entries in a stack draw on top: "above" parts go right after the current layer (the
    // first nearest to it), "below" parts right before it.
    const above = made.filter((m) => m.place === 'above').map((m) => m.layer.id);
    const below = made.filter((m) => m.place === 'below').map((m) => m.layer.id).reverse();
    const place = (ids: string[], anchor: string | null) => {
      const at = anchor ? ids.indexOf(anchor) : -1;
      if (at === -1) return [...ids, ...below, ...above];
      return [...ids.slice(0, at), ...below, ids[at], ...above, ...ids.slice(at + 1)];
    };
    const layers = { ...project.layers };
    made.forEach((m) => (layers[m.layer.id] = m.layer));
    const grp = activeLayerId ? findGroupOfLayer(project, activeLayerId) : project.groups[0];
    let groups = project.groups;
    let rootOrder = project.rootOrder;
    if (grp) {
      groups = groups.map((g) => (g.id === grp.id ? { ...g, layerIds: place(g.layerIds, activeLayerId) } : g));
    } else {
      const anchorAt = activeLayerId ? rootOrder.findIndex((r) => r.type === 'layer' && r.id === activeLayerId) : -1;
      const entry = (id: string) => ({ type: 'layer' as const, id });
      rootOrder =
        anchorAt === -1
          ? [...rootOrder, ...below.map(entry), ...above.map(entry)]
          : [...rootOrder.slice(0, anchorAt), ...below.map(entry), rootOrder[anchorAt], ...above.map(entry), ...rootOrder.slice(anchorAt + 1)];
    }
    const items = item
      ? (project.items || []).map((it) => (it.id === item.id ? { ...it, partIds: [...it.partIds, ...made.map((m) => m.layer.id)] } : it))
      : project.items;
    pushHistory({ ...project, layers, groups, rootOrder, items });
    const ids = made.map((m) => m.layer.id);
    handleSelectLayer(above[0] ?? ids[0]);
    setSelectedLayerIds(ids);
    playPaperPlace();
  };

  const handleUpdateLayer = (layerId: string, updates: Partial<Layer>) => {
    if (!project.layers[layerId]) return;
    pushHistory({
      ...project,
      layers: { ...project.layers, [layerId]: { ...project.layers[layerId], ...updates } },
    });
  };


  const handleDeleteLayers = useCallback(
    (layerIds: string[]) => {
      if (layerIds.length === 0) return;
      const del = new Set(layerIds);
      const layers = { ...project.layers };
      layerIds.forEach((id) => delete layers[id]);
      const next = normalizeProject({ ...project, layers });
      pushHistory(next);
      setSelectedLayerIds([]);
      if (activeLayerId && del.has(activeLayerId)) {
        handleSelectLayer(firstLayerId(next));
      }
    },
    [project, pushHistory, activeLayerId, handleSelectLayer]
  );

  const handleDeleteLayer = (layerId: string) => handleDeleteLayers([layerId]);

  const handleDuplicateLayer = (layerId: string) => {
    const source = project.layers[layerId];
    if (!source) return;
    const dupId = newId('layer');
    const reId = <T extends { id: string }>(c: T): T => ({ ...c, id: newId('cut') });
    const duplicated: Layer = {
      ...source,
      id: dupId,
      name: `${source.name} 副本`,
      cutouts: source.cutouts.map(reId),
      positiveElements: source.positiveElements.map(reId),
      drawings: (source.drawings || []).map((d) => ({ ...d, id: newId('drw') })),
    };

    const rootOrder = [...project.rootOrder];
    const groups = project.groups.map((g) => {
      const at = g.layerIds.indexOf(layerId);
      if (at === -1) return g;
      const ids = [...g.layerIds];
      ids.splice(at + 1, 0, dupId);
      return { ...g, layerIds: ids };
    });
    const rootIdx = rootOrder.findIndex((r) => r.type === 'layer' && r.id === layerId);
    if (rootIdx !== -1) rootOrder.splice(rootIdx + 1, 0, { type: 'layer', id: dupId });

    pushHistory({ ...project, layers: { ...project.layers, [dupId]: duplicated }, rootOrder, groups });
    handleSelectLayer(dupId);
    setSelectedLayerIds([dupId]);
  };

  /** Merge this layer into the one directly below it in the same stack. Returns name choices for the result. */
  const handleMergeDown = (layerId: string): { layerId: string; names: [string, string] } | null => {
    const upper = project.layers[layerId];
    if (!upper || upper.locked) return null;
    const grp = findGroupOfLayer(project, layerId);
    const ids = grp ? grp.layerIds : project.rootOrder.filter((r) => r.type === 'layer').map((r) => r.id);
    const i = ids.indexOf(layerId);
    const belowId = i > 0 ? ids[i - 1] : null;
    const lower = belowId ? project.layers[belowId] : null;
    if (!lower || lower.locked) return null;
    const names: [string, string] = [upper.name, lower.name];
    const merged = mergeLayerOnto(upper, lower);
    const layers = { ...project.layers, [lower.id]: merged };
    delete layers[layerId];
    const next = normalizeProject({ ...project, layers });
    pushHistory(next);
    handleSelectLayer(lower.id);
    setSelectedLayerIds([lower.id]);
    return { layerId: lower.id, names };
  };

  const handleInvertLayerCutouts = (layerId: string) => {
    const layer = project.layers[layerId];
    if (!layer) return;
    handleUpdateLayer(layerId, {
      cutouts: layer.cutouts.map((c) => ({
        ...c,
        isHole: !c.isHole,
        fillColor: c.isHole ? layer.color : undefined,
      })),
    });
  };

  const handleClearLayerCutouts = (layerId: string) => {
    handleUpdateLayer(layerId, { cutouts: [], positiveElements: [] });
  };

  // ---------- Depth groups ----------
  const handleAddGroup = () => {
    const gid = newId('grp');
    const group: LayerGroup = {
      id: gid,
      name: `深度层 ${project.groups.length + 1}`,
      collapsed: false,
      visible: true,
      locked: false,
      layerIds: [],
    };
    pushHistory({ ...project, groups: [...project.groups, group], rootOrder: [...project.rootOrder, { type: 'group', id: gid }] });
  };

  const handleUpdateGroup = (groupId: string, updates: Partial<LayerGroup>) => {
    pushHistory({
      ...project,
      groups: project.groups.map((g) => (g.id === groupId ? { ...g, ...updates } : g)),
    });
  };

  const handleDeleteGroup = (groupId: string) => {
    const grp = project.groups.find((g) => g.id === groupId);
    if (!grp) return;
    const idx = project.rootOrder.findIndex((r) => r.type === 'group' && r.id === groupId);
    const rootOrder = [...project.rootOrder];
    rootOrder.splice(idx, 1, ...grp.layerIds.map((id) => ({ type: 'layer' as const, id })));
    pushHistory({ ...project, groups: project.groups.filter((g) => g.id !== groupId), rootOrder });
  };

  // ---------- Items (物件) ----------
  const items = project.items || [];

  const setItems = (next: PapercutItem[]) => pushHistory({ ...project, items: next });

  const handleCreateItem = () =>
    createItemFrom(selectedLayerIds.length > 0 ? selectedLayerIds : activeLayerId ? [activeLayerId] : []);

  const createItemFrom = (ids: string[], name?: string) => {
    if (ids.length === 0) return;
    let pivot = { x: project.width / 2, y: project.height / 2 };
    const boxes = ids
      .map((id) => (document.querySelector(`g[data-layer-id="${id}"]`) as SVGGElement | null)?.getBBox())
      .filter((b): b is DOMRect => !!b && b.width > 0);
    if (boxes.length > 0) {
      const minX = Math.min(...boxes.map((b) => b.x));
      const maxX = Math.max(...boxes.map((b) => b.x + b.width));
      const maxY = Math.max(...boxes.map((b) => b.y + b.height));
      pivot = { x: Math.round((minX + maxX) / 2), y: Math.round(maxY) };
    }
    const idSet = new Set(ids);
    const stripped = items
      .map((it) => ({ ...it, partIds: it.partIds.filter((p) => !idSet.has(p)) }))
      .filter((it) => it.partIds.length > 0);
    const orderedIds = flattenLayerIds(project).filter((id) => idSet.has(id));
    const item: PapercutItem = {
      id: newId('item'),
      name: name || `物件 ${items.length + 1}`,
      partIds: orderedIds,
      pivot,
      sockets: [],
    };
    setItems([...stripped, item]);
    setSelectedLayerIds(orderedIds);
    setSelectionScope('item');
  };

  const handleSelectItem = (itemId: string) => {
    const item = items.find((it) => it.id === itemId);
    if (!item) return;
    setSelectedLayerIds([...item.partIds]);
    setSelectionScope('item');
    setCurrentTool('select');
    setFlash({ key: Date.now(), layerIds: item.partIds, itemId });
    if (!item.partIds.includes(activeLayerId)) handleSelectLayer(item.partIds[item.partIds.length - 1]);
  };

  const handleUpdateItem = useCallback(
    (itemId: string, updates: Partial<PapercutItem>) => {
      const before = (project.items || []).find((it) => it.id === itemId);
      if (!before) return;
      const after = { ...before, ...updates };
      const renamed = itemPrefix(after) !== itemPrefix(before);
      pushHistory({
        ...project,
        layers: renamed ? renameItemParts(project.layers, after, [itemPrefix(before), before.name]) : project.layers,
        items: (project.items || []).map((it) => (it.id === itemId ? after : it)),
      });
    },
    [project, pushHistory]
  );

  const handleDeleteItem = (itemId: string) => {
    setItems(items.filter((it) => it.id !== itemId));
  };

  const handleAddPartToItem = (itemId: string, layerId: string) => {
    const nextItems = items
      .map((it) => {
        const without = it.partIds.filter((p) => p !== layerId);
        return it.id === itemId ? { ...it, partIds: [...without, layerId] } : { ...it, partIds: without };
      })
      .filter((it) => it.partIds.length > 0);
    const target = nextItems.find((it) => it.id === itemId);
    const layer = project.layers[layerId];
    const oldItem = items.find((it) => it.id !== itemId && it.partIds.includes(layerId));
    const layers =
      target && layer
        ? { ...project.layers, [layerId]: { ...layer, name: prefixedName(layer.name, itemPrefix(target), oldItem ? [itemPrefix(oldItem)] : []) } }
        : project.layers;
    pushHistory({ ...project, layers, items: nextItems });
  };

  const handleRemovePartFromItem = (itemId: string, layerId: string) => {
    setItems(
      items
        .map((it) => (it.id === itemId ? { ...it, partIds: it.partIds.filter((p) => p !== layerId) } : it))
        .filter((it) => it.partIds.length > 0)
    );
  };

  const handleAddSocket = (itemId: string) => {
    const item = items.find((it) => it.id === itemId);
    if (!item) return;
    const n = item.sockets.length + 1;
    handleUpdateItem(itemId, {
      sockets: [
        ...item.sockets,
        { id: newId('sock'), name: `socket_${n}`, x: item.pivot.x + 30 * n, y: item.pivot.y - 60 },
      ],
    });
  };

  // ---------- Project style / reference ----------
  const handleUpdateProject = (updates: Partial<PapercutProject>) => {
    pushHistory({ ...project, ...updates });
  };

  const handleImportReference = async () => {
    const file = await pickFile('image/*');
    if (!file) return;
    await applyImageAsReference(file);
  };

  const applyImageAsReference = async (file: File) => {
    const src = await readFileAsDataUrl(file);
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('image load failed'));
      img.src = src;
    });
    const ratio = Math.min(project.width / img.width, project.height / img.height);
    const width = img.width * ratio;
    const height = img.height * ratio;
    const reference: ReferenceImage = {
      src,
      opacity: 0.45,
      visible: true,
      onTop: true,
      x: (project.width - width) / 2,
      y: (project.height - height) / 2,
      width,
      height,
    };
    handleUpdateProject({ reference });
  };

  /** Drop an image as an editable paper rectangle sized to the fitted image. */
  const applyImageAsEditObject = async (file: File) => {
    const src = await readFileAsDataUrl(file);
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('image load failed'));
      img.src = src;
    });
    const ratio = Math.min(project.width / img.width, project.height / img.height, 1);
    const w = Math.max(24, img.width * ratio);
    const h = Math.max(24, img.height * ratio);
    const x = (project.width - w) / 2;
    const y = (project.height - h) / 2;
    const baseName = file.name.replace(/\.[^.]+$/, '') || '图片纸片';
    const newLayerId = newId('layer');
    const newLayer: Layer = {
      id: newLayerId,
      name: baseName,
      kind: 'paper',
      color: brushSettings.brushColor,
      texture: 'xuan',
      opacity: 1,
      blendMode: 'normal',
      visible: true,
      locked: false,
      grain: 0.2,
      baseShape: {
        type: 'rect',
        d: `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`,
      },
      cutouts: [],
      positiveElements: [],
      drawings: [],
    };
    let groups = project.groups;
    let rootOrder = project.rootOrder;
    const targetGroupId = activeLayerId ? findGroupOfLayer(project, activeLayerId)?.id : groups[0]?.id;
    if (targetGroupId) {
      groups = groups.map((g) => (g.id === targetGroupId ? { ...g, layerIds: [...g.layerIds, newLayerId] } : g));
    } else {
      rootOrder = [...rootOrder, { type: 'layer', id: newLayerId }];
    }
    // Keep the image as a dim reference under the new paper so the silhouette stays visible while carving.
    const reference: ReferenceImage = {
      src,
      opacity: 0.55,
      visible: true,
      onTop: false,
      x,
      y,
      width: w,
      height: h,
    };
    pushHistory({
      ...project,
      layers: { ...project.layers, [newLayerId]: newLayer },
      groups,
      rootOrder,
      reference,
    });
    handleSelectLayer(newLayerId);
    setSelectedLayerIds([newLayerId]);
    playPaperPlace();
  };

  // ---------- Quick export ----------
  const handleQuickCopySvg = () => {
    navigator.clipboard.writeText(generateSvgMarkup(project, { includeBackground: false }));
  };

  const handleQuickDownloadSvg = () => {
    downloadFile(
      generateSvgMarkup(project, { includeBackground: false }),
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

  const selectedItem = (() => {
    if (selectedLayerIds.length === 0) return null;
    const item = findItemOfLayer(project, selectedLayerIds[0]);
    if (!item) return null;
    const sel = new Set(selectedLayerIds);
    return item.partIds.length === sel.size && item.partIds.every((p) => sel.has(p)) ? item : null;
  })();

  const documentTabItems: DocumentTabItem[] = documents.map((d) => ({
    id: d.id,
    name: d.name,
    width: d.project.width,
    height: d.project.height,
    project: d.project,
  }));

  return (
    <div
      className="flex flex-col h-dvh w-screen bg-(--ui-app) text-(--ui-text) overflow-hidden font-sans select-none pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
      onDragOver={(e) => {
        if (![...e.dataTransfer.types].includes('Files')) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={(e) => {
        const file = [...e.dataTransfer.files].find((f) => f.type.startsWith('image/'));
        if (!file) return;
        e.preventDefault();
        e.stopPropagation();
        const preview = URL.createObjectURL(file);
        setImageDrop({ file, preview });
      }}
    >
      <TooltipLayer />
      {imageDrop && (
        <div
          className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => {
            URL.revokeObjectURL(imageDrop.preview);
            setImageDrop(null);
          }}
        >
          <div
            className="bg-(--ui-panel) border border-(--ui-border-strong) rounded-2xl w-full max-w-sm p-4 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-semibold text-(--ui-strong)">导入图片</div>
            <div className="text-[11px] text-(--ui-muted) truncate">{imageDrop.file.name}</div>
            <img src={imageDrop.preview} alt="" className="w-full max-h-40 object-contain rounded-lg bg-(--ui-raised)" />
            <div className="grid grid-cols-2 gap-2">
              <button
                className="h-9 rounded-xl bg-(--ui-raised) hover:bg-(--ui-hover) text-(--ui-text-2) hover:text-(--ui-strong) text-xs border border-(--ui-border)"
                onClick={async () => {
                  const { file, preview } = imageDrop;
                  setImageDrop(null);
                  URL.revokeObjectURL(preview);
                  await applyImageAsReference(file);
                }}
              >
                作为参考图
              </button>
              <button
                className="h-9 rounded-xl bg-(--ui-accent) hover:bg-(--ui-accent-hover) text-white text-xs font-medium"
                onClick={async () => {
                  const { file, preview } = imageDrop;
                  setImageDrop(null);
                  URL.revokeObjectURL(preview);
                  await applyImageAsEditObject(file);
                }}
              >
                作为编辑对象
              </button>
            </div>
            <button
              className="w-full h-8 text-[11px] text-(--ui-muted) hover:text-(--ui-strong)"
              onClick={() => {
                URL.revokeObjectURL(imageDrop.preview);
                setImageDrop(null);
              }}
            >
              取消
            </button>
          </div>
        </div>
      )}
      <TopBar
        documents={documentTabItems}
        activeDocId={activeDocId}
        onSelectDocument={setActiveDocId}
        onNewDocument={() => setIsNewCanvasOpen(true)}
        onCloseDocument={handleCloseDocument}
        onRenameDocument={handleRenameDocument}
        onOpenPreset={handleOpenPreset}
        onOpenProjectFile={handleOpenProjectFile}
        onSaveProjectFile={handleSaveProjectFile}
        saveStatus={saveStatus}
        saveSettings={saveSettings}
        onChangeSaveSettings={setSaveSettings}
        onSaveNow={() => performSave('manual')}
        saveFileName={saveFile ? `${saveFile.name}（${documents.find((d) => d.id === saveFile.docId)?.name ?? '已关闭的文档'}）` : null}
        onPickSaveFile={pickSaveFile}
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
        onOpenGodotExport={() => setIsGodotModalOpen(true)}
        onOpenKeymap={() => setIsShortcutsOpen(true)}
        paperMode={project.paperMode ?? 'soft'}
        compact={compact}
        panelOpen={panelOpen}
        onTogglePanel={() => setPanelOpen((v) => !v)}
        onChangePaperMode={(mode) => handleUpdateProject({ paperMode: mode })}
        shadow={(() => {
          const o = projectShadowOptions(project);
          return { strength: o.shadow, softness: o.shadowSoftness, blend: o.shadowBlend };
        })()}
        onChangeShadow={handleUpdateProject}
        twinPresets={twinPresets}
        onChangeTwinPresets={setTwinPresets}
        canvasBg={project.canvasBg}
        onChangeCanvasBg={(canvasBg) => handleUpdateProject({ canvasBg })}
        onQuickCopySvg={handleQuickCopySvg}
        onQuickDownloadSvg={handleQuickDownloadSvg}
        onQuickDownloadPng={handleQuickDownloadPng}
      />

      <ToolOptions
        currentTool={currentTool}
        brushSettings={brushSettings}
        onChangeBrushSettings={(settings) => setBrushSettings((prev) => ({ ...prev, ...settings }))}
        onSelectTool={setCurrentTool}
        selectionScope={selectionScope}
        onChangeSelectionScope={setSelectionScope}
        selectedCount={selectedLayerIds.length}
        onCreateItemFromSelection={handleCreateItem}
        canvasWidth={project.width}
        canvasHeight={project.height}
      />

      <div className="flex-1 flex overflow-hidden relative">
        <Toolbar
          currentTool={currentTool}
          onSelectTool={setCurrentTool}
          carveMode={brushSettings.mode}
          onChangeCarveMode={(mode) => {
            setBrushSettings((prev) => ({ ...prev, mode }));
            setCurrentTool('willow_leaf');
          }}
          eraseMode={brushSettings.eraseMode === 'wipe' ? 'wipe' : 'hole'}
          onChangeEraseMode={(eraseMode) => setBrushSettings((prev) => ({ ...prev, mode: 'erase', eraseMode }))}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onFitZoom={handleFitZoom}
          onShowShortcuts={() => setIsShortcutsOpen(true)}
          pressure={brushSettings.pressure}
          onTogglePressure={() => setBrushSettings((prev) => ({ ...prev, pressure: !prev.pressure }))}
          brushColor={brushSettings.brushColor}
          onChangeBrushColor={changeBrushColor}
          recentBrushColors={recentBrushColors}
          keymap={keymap}
          onOpenToolMenu={(x, y) => setToolMenu({ x, y })}
        />

        <div id="canvas-stage" className="flex-1 flex flex-col relative overflow-hidden">
          <SaveBanner banner={saveBanner} onDone={() => setSaveBanner(null)} />
          <Canvas
            onCommitVectorLayer={(layer) => pushHistory({...project, layers: {...project.layers, [layer.id]: layer}})}
            project={project}
            activeLayerId={activeLayerId}
            currentTool={currentTool}
            brushSettings={brushSettings}
            onChangeBrushSettings={(settings) => setBrushSettings((prev) => ({ ...prev, ...settings }))}
            zoom={zoom}
            onZoomChange={handleZoomChange}
            onAddCutout={handleAddCutout}
            onRemoveCutouts={handleRemoveCutouts}
            onUpdateCutout={handleUpdateCutout}
            onAddDrawingStroke={handleAddDrawingStroke}
            onCommitCutoutEdit={handleCommitCutoutEdit}
            onExitAnchorEdit={() => setCurrentTool('pen_knife')}
            selectedLayerIds={selectedLayerIds}
            selectionScope={selectionScope}
            selectedItem={selectedItem}
            onSelectLayers={handleSelectLayers}
            onPickLayer={handlePanelSelectLayer}
            onTransformLayers={handleTransformLayers}
            onTransformBlocks={handleTransformBlocks}
            onDeleteBlocks={handleDeleteBlocks}
            onPathfinder={handlePathfinder}
            onUpdateItem={handleUpdateItem}
            onDeleteLayers={handleDeleteLayers}
            keymap={keymap}
            onUndo={handleUndo}
            onRedo={handleRedo}
            fitSignal={fitSignal}
            onOpenToolMenu={(x, y, here) => setToolMenu({ x, y, here })}
            flash={flash}
          />
          {toolMenu && (
            <ToolQuickMenu
              x={toolMenu.x}
              y={toolMenu.y}
              currentTool={currentTool}
              brushSettings={brushSettings}
              onChangeBrushSettings={(patch) => setBrushSettings((prev) => ({ ...prev, ...patch }))}
              onSelectTool={setCurrentTool}
              selectionScope={selectionScope}
              onChangeSelectionScope={setSelectionScope}
              selectedCount={selectedLayerIds.length}
              onCreateItemFromSelection={handleCreateItem}
              onClose={closeToolMenu}
              here={toolMenu.here}
              onPickColor={changeBrushColor}
              onPickLayer={handlePanelSelectLayer}
              activeLayerId={activeLayerId}
            />
          )}


        </div>

        {compact && panelOpen && (
          <div className="absolute inset-0 z-30 bg-black/30" onPointerDown={() => setPanelOpen(false)} />
        )}
        <div
          className={
            compact
              ? `absolute top-0 right-0 bottom-0 z-40 flex shadow-2xl transition-transform duration-200 ${panelOpen ? 'translate-x-0' : 'translate-x-full'}`
              : 'flex shrink-0'
          }
        >
          <LayersPanel
          project={project}
          activeLayerId={activeLayerId}
          selectedLayerIds={selectedLayerIds}
          colorNotes={colorNotes}
          onUpdateColorNote={handleUpdateColorNote}
          onSelectLayer={handlePanelSelectLayer}
          onSelectLayers={handleSelectLayers}
          onHighlightLayers={(layerIds) => setFlash({ key: Date.now(), layerIds })}
          onUpdateLayer={handleUpdateLayer}
          onAddLayer={handleAddLayer}
          twinPresets={twinPresets}
          onAddTwin={handleAddTwin}
          onCreateItemFromLayer={(layerId) => createItemFrom([layerId], project.layers[layerId]?.name)}
          brushColor={brushSettings.brushColor}
          recentColors={recentBrushColors}
          onChangeBrushColor={changeBrushColor}
          currentTool={currentTool}
          brushSettings={brushSettings}
          selectedItem={selectedItem}
          onDeleteLayer={handleDeleteLayer}
          onDeleteLayers={handleDeleteLayers}
          onDuplicateLayer={handleDuplicateLayer}
          onMergeDown={handleMergeDown}
          onInvertLayerCutouts={handleInvertLayerCutouts}
          onClearLayerCutouts={handleClearLayerCutouts}
          onReorderLayers={handleReorderLayers}
          onReorderRoot={handleReorderRoot}
          onMoveLayerToGroup={handleMoveLayerToGroup}
          onAddGroup={handleAddGroup}
          onUpdateGroup={handleUpdateGroup}
          onDeleteGroup={handleDeleteGroup}
          onCreateItem={handleCreateItem}
          onSelectItem={handleSelectItem}
          onUpdateItem={handleUpdateItem}
          onDeleteItem={handleDeleteItem}
          onAddPartToItem={handleAddPartToItem}
          onRemovePartFromItem={handleRemovePartFromItem}
          onAddSocket={handleAddSocket}
          onUpdateProject={handleUpdateProject}
          onImportReference={handleImportReference}
        />
        </div>
      </div>

      {isExportModalOpen && (
        <ExportModal project={project} onClose={() => setIsExportModalOpen(false)} />
      )}
      {isNewCanvasOpen && <NewCanvasDialog onClose={() => setIsNewCanvasOpen(false)} onCreate={handleNewDocument} />}
      {isGodotModalOpen && (
        <GodotExportModal project={project} onClose={() => setIsGodotModalOpen(false)} />
      )}
      {isShortcutsOpen && (
        <KeymapModal
          keymap={keymap}
          onChange={(m) => {
            setKeymap(m);
            saveKeymap(m);
          }}
          onClose={() => setIsShortcutsOpen(false)}
        />
      )}
    </div>
  );
}
