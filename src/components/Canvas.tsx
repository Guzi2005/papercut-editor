import {LiveStampPathOverlay} from './LiveStampPathOverlay';
import {FabricAdjustOverlay} from './FabricAdjustOverlay';
import { StampPainter } from './StampPainter';
import type { StampDefinition, StampSettings } from '../utils/stamps';
import { layerContent } from '../utils/layerContent';
import { VectorEditor } from './VectorEditor';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import {
  PapercutProject,
  PapercutItem,
  Layer,
  ToolType,
  BrushSettings,
  Point,
  CutoutPath,
  LayerDrawStroke,
  GeomShapeType,
} from '../types/papercut';
import {
  generateFreehandDrawPath,
  generateGeomShape,
  rebuildPathFromPoints,
  extractAnchorPointsFromD,
  f,
} from '../utils/bezierMath';
import {
  playPaperRustle,
  playPaperPlace,
  playDiscardSwoosh,
  playCrispClick,
  strokeStart,
  strokeMove,
  strokeEnd,
  StrokeSound,
} from '../utils/soundEffects';
import { renderLayerMarkup, projectShadowOptions, BASE_BLOCK } from '../utils/layerSvg';
import { classifyCarve, pathContains, paperAt, topBlockAt } from '../utils/paperHit';
import { generateKnifeCut, knifeCursorPath, fixedNibAngle } from '../utils/knifeBrush';
import { generateWillowShape, pullString, stabilizerRadius } from '../utils/willowShape';
import {
  Matrix,
  IDENTITY,
  translate,
  rotateAbout,
  matrixToSvg,
  Transform,
  isWarp,
  applyTransform,
  cornersTransform,
  applyToPoint,
} from '../utils/pathTransform';
import {
  findGroupOfLayer,
  findItemOfLayer,
  isLayerRendered,
  flattenLayerIds,
  transformLayer,
  transformBlocks,
  blockColor,
  blocksOfColor,
  BlockSelection,
} from '../utils/projectOps';
import { Check, X } from 'lucide-react';
import { useMediaQuery, COARSE_QUERY } from '../hooks/useMediaQuery';
import { Keymap, bindingHas, comboFromKeyEvent, comboFromPointer, comboFromWheel } from '../utils/keymap';
import { WHEEL_ZOOM_RATE, clampZoom } from '../utils/zoom';
import { applySymmetry, symmetryCenter, symmetryGuides, symmetryMatrices, DEFAULT_SYMMETRY } from '../utils/symmetry';
import { splitSubpaths } from '../utils/layerSvg';
import { ShortcutHints } from './ShortcutHints';
import { PathfinderBar } from './PathfinderBar';
import type { PathfinderOp } from '../utils/pathfinder';
import { CanvasBackdrop } from './CanvasBackdrop';
import { DEFAULT_STROKE, StrokeStyle, strokeOutline } from '../utils/strokePath';

export type SelectionScope = 'part' | 'item' | 'color';

export interface FlashRequest {
  key: number;
  layerIds: string[];
  itemId?: string;
}

/** What lies under a canvas point: the colour showing there and every layer covering it, top first. */
export interface PointInfo {
  color: string | null;
  layers: { id: string; name: string; color: string }[];
}

interface CanvasProps {
  liveStampPath?:import('../utils/liveStamps').LiveStampStroke;
  onLiveStampPathCommit?:(points:Point[])=>void;
  fabricAdjust?:boolean;
  onFabricCommit?:(fill:import('../types/papercut').FabricFill)=>void;
  onBlockSelectionChange?:(selection:BlockSelection)=>void;
  stampDefinition: StampDefinition;
  stampSettings: StampSettings;
  onStamp: (paths: CutoutPath[],stroke?:import('../utils/liveStamps').LiveStampStroke) => void;
  project: PapercutProject;
  onCommitVectorLayer: (layer: Layer) => void;
  activeLayerId: string | null;
  currentTool: ToolType;
  brushSettings: BrushSettings;
  onChangeBrushSettings: (newSettings: Partial<BrushSettings>) => void;
  zoom: number;
  onZoomChange: (newZoom: number) => void;
  onAddCutout: (cutout: CutoutPath) => void;
  onRemoveCutouts: (cutoutIds: string[]) => void;
  onUpdateCutout: (cutoutId: string, updates: Partial<CutoutPath>, commit?: boolean) => void;
  onAddDrawingStroke?: (stroke: LayerDrawStroke) => void;
  onCommitCutoutEdit?: () => void;
  onExitAnchorEdit?: () => void;
  selectedLayerIds: string[];
  selectionScope: SelectionScope;
  selectedItem: PapercutItem | null;
  onSelectLayers: (layerIds: string[], activeLayerId?: string) => void;
  onPickLayer: (layerId: string) => void;
  onTransformLayers: (layerIds: string[], m: Transform) => void;
  onTransformBlocks: (sel: BlockSelection, m: Transform) => void;
  onDeleteBlocks: (sel: BlockSelection) => void;
  /** Shape-builder operation on selected blocks; returns the blocks holding the result. */
  onPathfinder: (sel: BlockSelection, op: PathfinderOp) => BlockSelection | null;
  onUpdateItem: (itemId: string, updates: Partial<PapercutItem>) => void;
  onDeleteLayers: (layerIds: string[]) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  /** Incremented by the host to recentre the canvas after a fit-to-screen. */
  fitSignal?: number;
  keymap: Keymap;
  /** Right click without dragging: the current tool's quick menu at the pointer. */
  onOpenToolMenu?: (x: number, y: number, here?: PointInfo) => void;
  /** Briefly outline these layers to help find them; with `itemId`, also point at the item's pivot. */
  flash?: FlashRequest | null;
}

interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

type Corner = 'nw' | 'ne' | 'se' | 'sw';
type Side = 'n' | 'e' | 's' | 'w';
const CORNERS: Corner[] = ['nw', 'ne', 'se', 'sw'];

/** Box corners clockwise from top-left, matching CORNERS. */
const boxCorners = (b: BBox): Point[] => [
  { x: b.x, y: b.y },
  { x: b.x + b.width, y: b.y },
  { x: b.x + b.width, y: b.y + b.height },
  { x: b.x, y: b.y + b.height },
];

const nonZero = (v: number) => (Math.abs(v) < 0.02 ? (v < 0 ? -0.02 : 0.02) : v);
const scaleAboutXY = (sx: number, sy: number, ax: number, ay: number): Matrix => [sx, 0, 0, sy, ax - sx * ax, ay - sy * ay];

type DragKind =
  | { kind: 'move' }
  | { kind: 'scale'; corner: Corner; box: BBox }
  | { kind: 'edge'; side: Side; box: BBox }
  | { kind: 'rotate'; center: Point; startAngle: number }
  | { kind: 'pivot' }
  | { kind: 'socket'; socketId: string };

interface DragState {
  drag: DragKind;
  start: Point;
  moved: boolean;
  /** Selection to apply if the press ends without dragging (narrowing inside a selection). */
  clickSelect?: { ids: string[]; active: string };
}


type ShadowOptions = ReturnType<typeof projectShadowOptions>;

const LayerMarkup = React.memo(function LayerMarkup({
  layer,
  shadowOpts,
  transform,
}: {
  layer: Layer;
  shadowOpts: ShadowOptions;
  transform?: string;
}) {
  const html = useMemo(
    () => renderLayerMarkup(layer, { idPrefix: 'cv_', ...shadowOpts, grain: true, interactive: true }),
    [layer, shadowOpts]
  );
  return <g data-layer-id={layer.id} transform={transform} dangerouslySetInnerHTML={{ __html: html }} />;
});

function unionBBox(boxes: BBox[]): BBox | null {
  if (boxes.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  boxes.forEach((b) => {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  });
  if (!isFinite(minX)) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export const Canvas: React.FC<CanvasProps> = ({
  project,
  stampDefinition, stampSettings, onStamp, fabricAdjust, onFabricCommit, onBlockSelectionChange, liveStampPath, onLiveStampPathCommit,
  onCommitVectorLayer,
  activeLayerId,
  currentTool,
  brushSettings,
  onChangeBrushSettings,
  zoom,
  onZoomChange,
  onAddCutout,
  onRemoveCutouts,
  onUpdateCutout,
  onAddDrawingStroke,
  onCommitCutoutEdit,
  onExitAnchorEdit,
  selectedLayerIds,
  selectionScope,
  selectedItem,
  onSelectLayers,
  onPickLayer,
  onTransformLayers,
  onTransformBlocks,
  onDeleteBlocks,
  onPathfinder,
  onUpdateItem,
  onDeleteLayers,
  onUndo,
  onRedo,
  fitSignal = 0,
  keymap,
  onOpenToolMenu,
  flash,
}) => {
  const [flashing, setFlashing] = useState<FlashRequest | null>(null);
  const [vectorPreview, setVectorPreview] = useState<Layer | null>(null);
  useEffect(() => {
    if (!flash) return;
    setFlashing(flash);
    const t = window.setTimeout(() => setFlashing(null), 1900);
    return () => window.clearTimeout(t);
  }, [flash]);
  const rightDownRef = useRef<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Pan offset
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Point>({ x: 0, y: 0 });

  // Spacebar state for pan
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [currentPoint, setCurrentPoint] = useState<Point | null>(null);
  const [strokePoints, setStrokePoints] = useState<Point[]>([]);

  // Pointer samples accumulate in refs and are flushed to state once per animation frame,
  // so high-rate pen input never queues more renders than the display can show.
  const strokeRef = useRef<Point[]>([]);
  const curRef = useRef<Point | null>(null);
  const panTargetRef = useRef<Point | null>(null);
  const rafRef = useRef(0);
  const rectRef = useRef<DOMRect | null>(null);
  const brushRef = useRef<SVGGElement>(null);
  const stringRef = useRef<SVGLineElement>(null);
  const previewRef = useRef<SVGGElement>(null);
  const lastClientRef = useRef<{ x: number; y: number } | null>(null);
  const previewFnRef = useRef<(pts: Point[], cur: Point) => string>(() => '');

  // Touch: pinch/pan gesture state, pen-driven palm rejection.
  const coarse = useMediaQuery(COARSE_QUERY);
  const touchesRef = useRef(new Map<number, { x: number; y: number }>());
  const gestureRef = useRef<{
    startDist: number;
    startMid: { x: number; y: number };
    startPan: Point;
    startZoom: number;
    startTime: number;
    fingers: number;
    moved: boolean;
  } | null>(null);
  const penSeenRef = useRef(false);
  const pointerTypeRef = useRef('mouse');
  const zoomRef = useRef(zoom);
  const panRef = useRef<Point>({ x: 0, y: 0 });

  // Click-placed shape state (单击新增锚点，双击终止)
  const [polylinePoints, setPolylinePoints] = useState<Point[]>([]);
  const [polyHover, setPolyHover] = useState<Point | null>(null);
  const multiPoint = brushSettings.geomShapeType === 'polyline' || brushSettings.geomShapeType === 'path';
  const pathStyle = (n: number): StrokeStyle => ({
    width: brushSettings.pathWidth ?? DEFAULT_STROKE.width,
    round: brushSettings.pathRound ?? DEFAULT_STROKE.round,
    cap: brushSettings.pathCap ?? DEFAULT_STROKE.cap,
    smooth: Array(n).fill(!!brushSettings.pathCurve),
  });
  const [lastClickTime, setLastClickTime] = useState<number>(0);

  // Anchor Edit Tool State
  const [selectedCutoutId, setSelectedCutoutId] = useState<string | null>(null);
  const [activeAnchorIndex, setActiveAnchorIndex] = useState<number | null>(null);
  const [editableAnchors, setEditableAnchors] = useState<Point[]>([]);
  const [hasDraggedAnchor, setHasDraggedAnchor] = useState(false);
  const [isDraggingAnchor, setIsDraggingAnchor] = useState(false);

  // Select tool state: live preview matrix + pivot/socket drag positions
  const dragRef = useRef<DragState | null>(null);
  const [preview, setPreview] = useState<Transform>(IDENTITY);
  const [dragPoint, setDragPoint] = useState<Point | null>(null);
  const [isSelectDragging, setIsSelectDragging] = useState(false);
  const [selectionBBox, setSelectionBBox] = useState<BBox | null>(null);
  // Colour-block selection: pieces inside layers rather than whole layers.
  const colorScope = currentTool === 'select' && selectionScope === 'color';
  const [blockSel, setBlockSel] = useState<BlockSelection>({});
  useEffect(()=>{onBlockSelectionChange?.(blockSel);},[blockSel,onBlockSelectionChange]);
  const blockCount = Object.values(blockSel).reduce((n, a) => n + a.length, 0);
  const blockMode = colorScope && blockCount > 0;
  const lastBlockClick = useRef<{ t: number; key: string }>({ t: 0, key: '' });
  useEffect(() => {
    if (!colorScope) setBlockSel({});
  }, [colorScope]);
  useEffect(() => {
    setBlockSel((prev) => {
      let changed = false;
      const next: BlockSelection = {};
      Object.entries(prev).forEach(([lid, ids]) => {
        const layer = project.layers[lid];
        const kept = layer && selectedLayerIds.includes(lid) ? ids.filter((id) => blockColor(layer, id) !== null) : [];
        if (kept.length !== ids.length) changed = true;
        if (kept.length) next[lid] = kept;
      });
      return changed ? next : prev;
    });
  }, [project, selectedLayerIds]);
  const lockAspect = brushSettings.lockAspect ?? true;
  const [activeBBox, setActiveBBox] = useState<BBox | null>(null);

  const activeLayer = activeLayerId ? project.layers[activeLayerId] : null;
  const activeGroup = activeLayerId ? findGroupOfLayer(project, activeLayerId) : null;
  const activeLocked = !!activeLayer && (activeLayer.locked || !!activeGroup?.locked);
  const activeHidden = !!activeLayerId && !isLayerRendered(project, activeLayerId);
  const activeDoodle = activeLayer?.kind === 'doodle';
  const editingStroke = currentTool === 'anchor_edit' && selectedCutoutId ? activeLayer?.cutouts.find((c) => c.id === selectedCutoutId)?.stroke : undefined;
  const shadowOpts = useMemo(
    () => projectShadowOptions(project),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project.shadowStrength, project.shadowSoftness, project.shadowBlend, project.paperMode, project.fabricAssets]
  );

  // Hold-to-pan key (Space by default, configurable)
  const keymapRef = useRef(keymap);
  keymapRef.current = keymap;
  const heldPanCode = useRef<string | null>(null);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.querySelector('dialog[open], [data-stamp-workbench]:focus-within')) return;
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }
      if (!e.repeat && bindingHas(keymapRef.current, 'view.panHold', comboFromKeyEvent(e))) {
        e.preventDefault();
        heldPanCode.current = e.code;
        setIsSpacePressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (heldPanCode.current && e.code === heldPanCode.current) {
        heldPanCode.current = null;
        setIsSpacePressed(false);
        setIsPanning(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Arrow-key nudge and delete for the select tool
  useEffect(() => {
    if (currentTool !== 'select') return;
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('dialog[open], [data-stamp-workbench]:focus-within')) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (selectedLayerIds.length === 0 && !blockMode) return;
      const step = e.shiftKey ? 10 : 1;
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      if (moves[e.key]) {
        e.preventDefault();
        if (blockMode) onTransformBlocks(blockSel, translate(...moves[e.key]));
        else if (!colorScope) onTransformLayers(selectedLayerIds, translate(...moves[e.key]));
      } else if (bindingHas(keymapRef.current, 'edit.delete', comboFromKeyEvent(e))) {
        e.preventDefault();
        if (blockMode) {
          onDeleteBlocks(blockSel);
          setBlockSel({});
        } else if (!colorScope) onDeleteLayers(selectedLayerIds);
        else return;
        playDiscardSwoosh();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentTool, selectedLayerIds, onTransformLayers, onDeleteLayers, blockMode, colorScope, blockSel, onTransformBlocks, onDeleteBlocks]);

  // When switching to/from anchor_edit, auto-select latest cutout if none selected
  useEffect(() => {
    if (currentTool === 'anchor_edit') {
      if (!selectedCutoutId && activeLayer && activeLayer.cutouts.length > 0) {
        const lastCutout = activeLayer.cutouts[activeLayer.cutouts.length - 1];
        setSelectedCutoutId(lastCutout.id);
        const anchors =
          lastCutout.points && lastCutout.points.length > 0
            ? lastCutout.points
            : extractAnchorPointsFromD(lastCutout.d);
        setEditableAnchors(anchors);
      }
    } else {
      setSelectedCutoutId(null);
      setActiveAnchorIndex(null);
      setEditableAnchors([]);
    }
  }, [currentTool, activeLayerId]);

  // Sync selected cutout anchors if active layer changes
  useEffect(() => {
    if (currentTool === 'anchor_edit' && selectedCutoutId && activeLayer) {
      const cutout = activeLayer.cutouts.find((c) => c.id === selectedCutoutId);
      if (cutout) {
        const anchors =
          cutout.points && cutout.points.length > 0
            ? cutout.points
            : extractAnchorPointsFromD(cutout.d);
        setEditableAnchors(anchors);
      }
    }
  }, [activeLayer, selectedCutoutId, currentTool]);

  // Measure selection / active layer bounds from the rendered geometry
  const measureLayers = useCallback((ids: string[]): BBox | null => {
    return unionBBox(ids.flatMap(id=>{
      const layer=project.layers[id];
      if(!layer||!isLayerRendered(project,id))return [];
      const box=layerContent(layer).bounds;
      return box?[box]:[];
    }));
  }, [project]);

  const measureBlocks = useCallback((sel: BlockSelection): BBox | null => {
    return unionBBox(Object.entries(sel).flatMap(([lid,ids])=>{
      const layer=project.layers[lid];
      if(!layer||!isLayerRendered(project,lid))return [];
      const blocks=layerContent(layer).blocks;
      return ids.flatMap(id=>blocks.has(id)?[blocks.get(id)!]:[]);
    }));
  }, [project]);

  useLayoutEffect(() => {
    setSelectionBBox(colorScope ? (blockCount ? measureBlocks(blockSel) : null) : measureLayers(selectedLayerIds));
    setActiveBBox(activeLayerId ? measureLayers([activeLayerId]) : null);
  }, [project, selectedLayerIds, activeLayerId, measureLayers, measureBlocks, colorScope, blockSel, blockCount]);

  // Transform client screen coordinates to Canvas coordinate system
  const clientToCanvas = useCallback(
    (clientX: number, clientY: number): Point => {
      if (!svgRef.current) return { x: 0, y: 0 };
      const rect = rectRef.current || svgRef.current.getBoundingClientRect();
      const scaleX = project.width / rect.width;
      const scaleY = project.height / rect.height;

      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    },
    [project.width, project.height]
  );

  useEffect(() => {
    rectRef.current = null;
    panRef.current = pan;
  }, [pan, zoom]);

  // Zoom changed from outside (buttons, keys, fit): scale the pan so the view zooms about its centre.
  const expectedZoomRef = useRef(zoom);
  const lastZoomRef = useRef(zoom);
  useEffect(() => {
    const prev = lastZoomRef.current;
    lastZoomRef.current = zoom;
    zoomRef.current = zoom;
    if (expectedZoomRef.current === zoom || prev === zoom) {
      expectedZoomRef.current = zoom;
      return;
    }
    expectedZoomRef.current = zoom;
    const k = zoom / prev;
    setPan((p) => {
      const np = { x: p.x * k, y: p.y * k };
      panRef.current = np;
      return np;
    });
  }, [zoom]);

  useEffect(() => {
    if (fitSignal) {
      panRef.current = { x: 0, y: 0 };
      setPan({ x: 0, y: 0 });
    }
  }, [fitSignal]);

  const abortGestureConflicts = () => {
    strokeEnd();
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    strokeRef.current = [];
    curRef.current = null;
    setIsDrawing(false);
    setStartPoint(null);
    dragRef.current = null;
    setIsSelectDragging(false);
    setPreview(IDENTITY);
    setDragPoint(null);
    setIsPanning(false);
    setActiveAnchorIndex(null);
    setIsDraggingAnchor(false);
    brushRef.current?.setAttribute('visibility', 'hidden');
  };

  const beginPinch = () => {
    const pts = [...touchesRef.current.values()];
    const [a, b] = pts;
    gestureRef.current = {
      startDist: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
      startMid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      startPan: { ...panRef.current },
      startZoom: zoomRef.current,
      startTime: performance.now(),
      fingers: pts.length,
      moved: false,
    };
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!touchesRef.current.has(e.pointerId)) return;
      touchesRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const g = gestureRef.current;
      if (!g || touchesRef.current.size < 2) return;
      const [a, b] = [...touchesRef.current.values()];
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const nextZoom = clampZoom(g.startZoom * (dist / g.startDist));
      const qx = (g.startMid.x - cx - g.startPan.x) / g.startZoom;
      const qy = (g.startMid.y - cy - g.startPan.y) / g.startZoom;
      if (Math.hypot(mid.x - g.startMid.x, mid.y - g.startMid.y) > 8 || Math.abs(dist - g.startDist) > 10) g.moved = true;
      g.fingers = Math.max(g.fingers, touchesRef.current.size);
      const np = { x: mid.x - cx - qx * nextZoom, y: mid.y - cy - qy * nextZoom };
      panRef.current = np;
      zoomRef.current = nextZoom;
      expectedZoomRef.current = nextZoom;
      setPan(np);
      onZoomChange(nextZoom);
    };
    const onEnd = (e: PointerEvent) => {
      if (!touchesRef.current.delete(e.pointerId)) return;
      const g = gestureRef.current;
      if (g && touchesRef.current.size < 2) {
        if (!g.moved && performance.now() - g.startTime < 320) {
          if (g.fingers >= 3) onRedo?.();
          else onUndo?.();
        }
        gestureRef.current = touchesRef.current.size === 0 ? null : { ...g, moved: true };
      }
      if (touchesRef.current.size === 0) gestureRef.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };
  }, [onZoomChange, onUndo, onRedo]);

  // The cached rect lives for one gesture; drop it once every pointerup handler has run.
  useEffect(() => {
    const clear = () => setTimeout(() => (rectRef.current = null), 0);
    window.addEventListener('pointerup', clear, true);
    window.addEventListener('resize', clear);
    return () => {
      window.removeEventListener('pointerup', clear, true);
      window.removeEventListener('resize', clear);
    };
  }, []);

  const scheduleFlush = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      if (panTargetRef.current) {
        setPan(panTargetRef.current);
        panTargetRef.current = null;
      }
      // Stroke preview and brush ring are written straight to the DOM in the same frame,
      // so the drawn tip never trails the ring by a React render.
      if (curRef.current) {
        const pts = strokeRef.current;
        const tip = curRef.current;
        if (previewRef.current) {
          const d = previewFnRef.current(pts, curRef.current);
          previewRef.current.innerHTML = d ? splitSubpaths(d).map((piece) => `<path d="${piece}"/>`).join('') : '';
        }
        const line = stringRef.current;
        const last = pts[pts.length - 1];
        if (line && last) {
          line.setAttribute('x1', String(last.x));
          line.setAttribute('y1', String(last.y));
          line.setAttribute('x2', String(tip.x));
          line.setAttribute('y2', String(tip.y));
        }
        const g = brushRef.current;
        if (g && lastClientRef.current && pointerTypeRef.current !== 'touch') {
          g.setAttribute('transform', `translate(${tip.x} ${tip.y})${cursorTurnRef.current(tip)}`);
          g.setAttribute('visibility', g.dataset.show === '1' ? 'visible' : 'hidden');
        }
      }
    });
  }, []);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const nib = { angle: brushSettings.knifeAngle ?? 0, follow: !!brushSettings.knifeFollow };
  const turningNib =
    nib.follow && (currentTool === 'pen_knife' || currentTool === 'freehand') && ['flat', 'chisel'].includes(brushSettings.knifeTipShape || 'round');
  // A turning nib's cursor faces across the pointer's recent direction of travel.
  const cursorDirRef = useRef<{ last: Point | null; deg: number }>({ last: null, deg: 0 });
  const cursorTurnRef = useRef<(p: Point) => string>(() => '');
  const cursorTurn = (p: Point): string => {
    if (!turningNib) return '';
    const st = cursorDirRef.current;
    if (st.last) {
      const dx = p.x - st.last.x, dy = p.y - st.last.y;
      if (Math.hypot(dx, dy) * zoom > 3) {
        const target = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
        let delta = ((target - st.deg + 540) % 360) - 180;
        if (Math.abs(delta) > 90) delta -= Math.sign(delta) * 180;
        st.deg += delta * 0.5;
        st.last = p;
      }
    } else st.last = p;
    return ` rotate(${st.deg.toFixed(1)})`;
  };
  cursorTurnRef.current = cursorTurn;

  // The canvas cursor is the brush itself, so there is only one pointer on screen and it is
  // drawn in the same frame as the stroke it leaves.
  const brushCursor: { d: string; cross: boolean } | null = (() => {
    if (activeLocked || activeHidden) return null;
    if (activeDoodle && currentTool !== 'hand_draw') return null;
    if (currentTool === 'pen_knife' || currentTool === 'freehand') {
      const tipShape = brushSettings.knifeTipShape || 'round';
      return { d: knifeCursorPath(brushSettings.stampSize || 26, tipShape, fixedNibAngle(tipShape, nib)), cross: false };
    }
    if (currentTool === 'hand_draw') {
      if (brushSettings.drawBrushType === 'willow') return { d: '', cross: true };
      const r = Math.max(1, (brushSettings.drawSize || 6) / 2);
      return { d: `M ${-r} 0 A ${r} ${r} 0 1 1 ${r} 0 A ${r} ${r} 0 1 1 ${-r} 0 Z`, cross: false };
    }
    if (currentTool === 'willow_leaf' || currentTool === 'geom_shape') return { d: '', cross: true };
    return null;
  })();
  const brushRadius = brushCursor ? 1 : 0;

  const moveBrush = (clientX: number, clientY: number, visible: boolean) => {
    const g = brushRef.current;
    if (!g) return;
    if (!visible || brushRadius === 0) {
      g.setAttribute('visibility', 'hidden');
      return;
    }
    const pt = clientToCanvas(clientX, clientY);
    g.setAttribute('transform', `translate(${pt.x} ${pt.y})${cursorTurn(pt)}`);
    g.setAttribute('visibility', 'visible');
  };

  // The brush is drawn in artboard space, so wheel panning/zooming would carry it off with the
  // paper; re-seat it under the pointer, which has not moved on screen.
  const hoverRef = useRef<{ x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    const c = hoverRef.current;
    if (!c) return;
    rectRef.current = null;
    if (isDrawing) {
      if (curRef.current) {
        curRef.current = { ...clientToCanvas(c.x, c.y), pressure: curRef.current.pressure };
        scheduleFlush();
      }
      return;
    }
    moveBrush(c.x, c.y, pointerTypeRef.current !== 'touch' && !isSpacePressed && !isPanning);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pan, zoom]);

  // Wheel: zoom is exponential in the scroll amount, so trackpad pinches and notched wheels both
  // feel even; refs keep bursts of events within one frame from compounding on stale state.
  const handleWheel = (e: React.WheelEvent) => {
    const combo = comboFromWheel(e);
    hoverRef.current = { x: e.clientX, y: e.clientY };
    const px = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    if (bindingHas(keymap, 'view.zoomWheel', combo)) {
      const cur = zoomRef.current;
      const next = clampZoom(cur * Math.exp(-e.deltaY * px * WHEEL_ZOOM_RATE));
      if (next === cur) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const mx = e.clientX - rect.left - rect.width / 2;
        const my = e.clientY - rect.top - rect.height / 2;
        const p = panRef.current;
        const np = { x: mx - (mx - p.x) * (next / cur), y: my - (my - p.y) * (next / cur) };
        panRef.current = np;
        setPan(np);
      }
      zoomRef.current = next;
      expectedZoomRef.current = next;
      onZoomChange(next);
      return;
    }
    const horizontal = e.shiftKey && e.deltaX === 0;
    const plain = combo.replace('Shift+', '');
    if (bindingHas(keymap, 'view.panWheel', combo) || (horizontal && bindingHas(keymap, 'view.panWheel', plain))) {
      const dx = (horizontal ? e.deltaY : e.deltaX) * px;
      const dy = horizontal ? 0 : e.deltaY * px;
      const np = { x: panRef.current.x - dx, y: panRef.current.y - dy };
      panRef.current = np;
      setPan(np);
    }
  };

  // Ctrl+wheel must be cancelled with a non-passive listener or the browser zooms the page.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const stop = (e: WheelEvent) => e.preventDefault();
    el.addEventListener('wheel', stop, { passive: false });
    return () => el.removeEventListener('wheel', stop);
  }, []);

  const getEventPressure = (
    e: React.MouseEvent | MouseEvent | React.PointerEvent | PointerEvent
  ): number => {
    if ('pressure' in e && typeof e.pressure === 'number' && e.pressure > 0) {
      return e.pressure;
    }
    return 0.5;
  };

  const layerIdFromTarget = (target: EventTarget | null): string | null => {
    const el = (target as Element | null)?.closest?.('[data-layer-id]');
    return el ? el.getAttribute('data-layer-id') : null;
  };

  const expandToScope = (layerId: string): string[] => {
    if (selectionScope === 'item') {
      const item = findItemOfLayer(project, layerId);
      if (item) return [...item.partIds];
    }
    return [layerId];
  };

  // ---------- Select tool ----------
  const beginSelectDrag = (drag: DragKind, pt: Point, clickSelect?: DragState['clickSelect']) => {
    dragRef.current = { drag, start: pt, moved: false, clickSelect };
    setIsSelectDragging(true);
    setPreview(IDENTITY);
    setDragPoint(null);
  };

  // ---------- Lasso: selects whatever the loop touches, in the current scope ----------
  const lassoMode = !!brushSettings.selectLasso;
  const [lasso, setLasso] = useState<Point[] | null>(null);

  const finishLasso = (poly: Point[], additive: boolean) => {
    const svg = svgRef.current;
    if (!svg) return;
    const xs = poly.map((p) => p.x), ys = poly.map((p) => p.y);
    const pb = { x: Math.min(...xs), y: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
    const inPoly = (x: number, y: number) => {
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i], b = poly[j];
        if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
      }
      return inside;
    };
    const touches = (el: Element | null, hit: (x: number, y: number) => boolean) => {
      let bb: DOMRect | undefined;
      try {
        bb = (el as SVGGraphicsElement | null)?.getBBox();
      } catch {
        return false;
      }
      if (!bb || (bb.width === 0 && bb.height === 0)) return false;
      const x0 = Math.max(bb.x, pb.x), x1 = Math.min(bb.x + bb.width, pb.x2);
      const y0 = Math.max(bb.y, pb.y), y1 = Math.min(bb.y + bb.height, pb.y2);
      if (x0 > x1 || y0 > y1) return false;
      const step = Math.max(1.5, (x1 - x0) / 24, (y1 - y0) / 24);
      for (let y = y0; y <= y1; y += step) {
        for (let x = x0; x <= x1; x += step) {
          if (inPoly(x, y) && hit(x, y)) return true;
        }
      }
      return false;
    };
    const layerEl = (id: string) => svg.querySelector(`[data-layer-id="${id}"]`);

    if (colorScope) {
      const next: BlockSelection = additive ? { ...blockSel } : {};
      renderLayerOrder.forEach((layer) => {
        const found: string[] = [];
        const root = layerEl(layer.id);
        const blockEl = (id: string) => root?.querySelector(`[data-element-id="${id}"]`) ?? null;
        if (layer.kind !== 'doodle' && layer.baseShape?.d && touches(blockEl(BASE_BLOCK), (x, y) => pathContains(layer.baseShape.d, x, y))) found.push(BASE_BLOCK);
        [...layer.positiveElements, ...layer.cutouts].forEach((c) => !c.isHole && touches(blockEl(c.id), (x, y) => pathContains(c.d, x, y)) && found.push(c.id));
        (layer.drawings || []).forEach((d) => touches(blockEl(d.id), () => true) && found.push(d.id));
        if (found.length) next[layer.id] = Array.from(new Set([...(next[layer.id] || []), ...found]));
      });
      setBlockSel(next);
      const keys = Object.keys(next);
      onSelectLayers(keys, keys[keys.length - 1]);
      return;
    }
    const hitIds = renderLayerOrder
      .filter((layer) => touches(layerEl(layer.id), layer.kind === 'doodle' ? () => true : (x, y) => paperAt(layer, x, y)))
      .flatMap((layer) => expandToScope(layer.id));
    const ids = Array.from(new Set([...(additive ? selectedLayerIds : []), ...hitIds]));
    onSelectLayers(ids, hitIds[hitIds.length - 1] ?? ids[ids.length - 1]);
  };

  const beginLasso = (start: Point, additive: boolean, onClick: () => void) => {
    const pts = [start];
    setLasso(pts);
    const move = (ev: PointerEvent) => {
      const p = clientToCanvas(ev.clientX, ev.clientY);
      const last = pts[pts.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) * zoom > 3) {
        pts.push(p);
        setLasso([...pts]);
      }
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setLasso(null);
      const w = Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x));
      const h = Math.max(...pts.map((p) => p.y)) - Math.min(...pts.map((p) => p.y));
      if (pts.length < 3 || Math.hypot(w, h) * zoom < 6) onClick();
      else finishLasso(pts, additive);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const handleSelectDown = (e: React.PointerEvent, pt: Point) => {
    const handle = (e.target as Element).closest?.('[data-handle]')?.getAttribute('data-handle');
    const box = selectionBBox;

    if (handle && box) {
      if (handle.startsWith('scale-')) {
        beginSelectDrag({ kind: 'scale', corner: handle.slice(6) as Corner, box }, pt);
        return;
      }
      if (handle.startsWith('edge-')) {
        beginSelectDrag({ kind: 'edge', side: handle.slice(5) as Side, box }, pt);
        return;
      }
      if (handle === 'rotate') {
        const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        beginSelectDrag({ kind: 'rotate', center, startAngle: Math.atan2(pt.y - center.y, pt.x - center.x) }, pt);
        return;
      }
    }
    if (handle === 'pivot' && selectedItem) {
      beginSelectDrag({ kind: 'pivot' }, pt);
      setDragPoint(selectedItem.pivot);
      return;
    }
    if (handle?.startsWith('socket:') && selectedItem) {
      const socketId = handle.slice(7);
      const socket = selectedItem.sockets.find((s) => s.id === socketId);
      beginSelectDrag({ kind: 'socket', socketId }, pt);
      if (socket) setDragPoint({ x: socket.x, y: socket.y });
      return;
    }

    const insideBox = !!box && pt.x >= box.x && pt.x <= box.x + box.width && pt.y >= box.y && pt.y <= box.y + box.height;
    if (!insideBox && (lassoMode || !layerIdFromTarget(e.target))) {
      const target = e.target;
      const shift = e.shiftKey;
      beginLasso(pt, shift, () => clickSelect(target, shift, pt, false));
      return;
    }
    clickSelect(e.target, e.shiftKey, pt, true);
  };

  /** Selection by clicking; `allowDrag` is false when replaying a click after a lasso that never grew. */
  const clickSelect = (target: EventTarget | null, shiftKey: boolean, pt: Point, allowDrag: boolean) => {
    const box = selectionBBox;
    const startDrag: typeof beginSelectDrag = (...args) => allowDrag && beginSelectDrag(...args);
    const e = { target, shiftKey };
    if (colorScope) {
      const lid = layerIdFromTarget(e.target);
      const layer = lid ? project.layers[lid] : null;
      let bid = (e.target as Element).closest?.('[data-element-id]')?.getAttribute('data-element-id') ?? null;
      // Masks don't affect hit testing, so a click inside a hole would otherwise pick the sheet.
      if (layer && bid === BASE_BLOCK && !paperAt(layer, pt.x, pt.y)) bid = null;
      if (lid && layer && bid) {
        const key = `${lid}:${bid}`;
        const now = performance.now();
        const double = lastBlockClick.current.key === key && now - lastBlockClick.current.t < 350;
        lastBlockClick.current = { t: now, key };
        const has = !!blockSel[lid]?.includes(bid);
        let next: BlockSelection = blockSel;
        if (double) {
          const c = blockColor(layer, bid);
          next = { [lid]: c ? blocksOfColor(layer, c) : [bid] };
        } else if (e.shiftKey) {
          const ids = has ? blockSel[lid].filter((i) => i !== bid) : [...(blockSel[lid] || []), bid];
          next = { ...blockSel, [lid]: ids };
          if (!ids.length) delete next[lid];
        } else if (!has) {
          next = { [lid]: [bid] };
        }
        setBlockSel(next);
        onSelectLayers(Object.keys(next), lid);
        if (!e.shiftKey || has) startDrag({ kind: 'move' }, pt);
        return;
      }
      if (box && pt.x >= box.x && pt.x <= box.x + box.width && pt.y >= box.y && pt.y <= box.y + box.height) {
        startDrag({ kind: 'move' }, pt);
        return;
      }
      setBlockSel({});
      onSelectLayers([]);
      return;
    }

    const hitId = layerIdFromTarget(e.target);
    if (hitId) {
      const scoped = expandToScope(hitId);
      const alreadySelected = scoped.every((id) => selectedLayerIds.includes(id));
      if (e.shiftKey) {
        const next = alreadySelected
          ? selectedLayerIds.filter((id) => !scoped.includes(id))
          : Array.from(new Set([...selectedLayerIds, ...scoped]));
        onSelectLayers(next, hitId);
        return;
      }
      if (!alreadySelected) {
        onSelectLayers(scoped, hitId);
        startDrag({ kind: 'move' }, pt);
      } else {
        const narrows = scoped.length < selectedLayerIds.length;
        startDrag({ kind: 'move' }, pt, narrows ? { ids: scoped, active: hitId } : undefined);
        if (!narrows && hitId !== activeLayerId) onPickLayer(hitId);
      }
      return;
    }

    if (
      box &&
      pt.x >= box.x && pt.x <= box.x + box.width &&
      pt.y >= box.y && pt.y <= box.y + box.height
    ) {
      startDrag({ kind: 'move' }, pt);
      return;
    }
    onSelectLayers([]);
  };

  useEffect(() => {
    if (!isSelectDragging) return;
    // Corners and edges scale with the aspect ratio locked by default (Shift flips the lock);
    // holding Ctrl frees them: a corner drags on its own (perspective), an edge slides whole.
    const computeTransform = (st: DragState, pt: Point, shift: boolean, ctrl: boolean): Transform => {
      const d = st.drag;
      const dx = pt.x - st.start.x;
      const dy = pt.y - st.start.y;
      if (d.kind === 'move') {
        if (shift) return Math.abs(dx) > Math.abs(dy) ? translate(dx, 0) : translate(0, dy);
        return translate(dx, dy);
      }
      if (d.kind === 'rotate') {
        let a = Math.atan2(pt.y - d.center.y, pt.x - d.center.x) - d.startAngle;
        if (shift) a = Math.round(a / (Math.PI / 12)) * (Math.PI / 12);
        return rotateAbout(a, d.center.x, d.center.y);
      }
      const lock = lockAspect !== shift;
      if (d.kind === 'scale') {
        const src = boxCorners(d.box);
        const i = CORNERS.indexOf(d.corner);
        const c = src[i];
        const anchor = src[(i + 2) % 4];
        if (ctrl) {
          const dst = src.map((p, k) => (k === i ? { x: p.x + dx, y: p.y + dy } : p));
          return cornersTransform(src, dst) ?? IDENTITY;
        }
        const vx = c.x - anchor.x, vy = c.y - anchor.y;
        if (lock) {
          const t = nonZero(((pt.x - anchor.x) * vx + (pt.y - anchor.y) * vy) / Math.max(1e-6, vx * vx + vy * vy));
          return scaleAboutXY(t, t, anchor.x, anchor.y);
        }
        return scaleAboutXY(nonZero((pt.x - anchor.x) / (vx || 1)), nonZero((pt.y - anchor.y) / (vy || 1)), anchor.x, anchor.y);
      }
      if (d.kind === 'edge') {
        const src = boxCorners(d.box);
        const moving = { n: [0, 1], e: [1, 2], s: [2, 3], w: [3, 0] }[d.side];
        if (ctrl) {
          const dst = src.map((p, k) => (moving.includes(k) ? { x: p.x + dx, y: p.y + dy } : p));
          return cornersTransform(src, dst) ?? IDENTITY;
        }
        const b = d.box;
        const vertical = d.side === 'n' || d.side === 's';
        if (vertical) {
          const edgeY = d.side === 'n' ? b.y : b.y + b.height;
          const oppY = d.side === 'n' ? b.y + b.height : b.y;
          const sy = nonZero((pt.y - oppY) / (edgeY - oppY || 1));
          return scaleAboutXY(lock ? Math.abs(sy) : 1, sy, b.x + b.width / 2, oppY);
        }
        const edgeX = d.side === 'w' ? b.x : b.x + b.width;
        const oppX = d.side === 'w' ? b.x + b.width : b.x;
        const sx = nonZero((pt.x - oppX) / (edgeX - oppX || 1));
        return scaleAboutXY(sx, lock ? Math.abs(sx) : 1, oppX, b.y + b.height / 2);
      }
      return IDENTITY;
    };

    const onMove = (e: PointerEvent) => {
      const st = dragRef.current;
      if (!st) return;
      const pt = clientToCanvas(e.clientX, e.clientY);
      if (!st.moved && Math.hypot(pt.x - st.start.x, pt.y - st.start.y) * zoom < 2) return;
      st.moved = true;
      if (st.drag.kind === 'pivot' || st.drag.kind === 'socket') {
        setDragPoint({ x: Math.round(pt.x), y: Math.round(pt.y) });
      } else {
        setPreview(computeTransform(st, pt, e.shiftKey, e.ctrlKey || e.metaKey));
      }
    };

    const onUp = (e: PointerEvent) => {
      const st = dragRef.current;
      dragRef.current = null;
      setIsSelectDragging(false);
      if (!st || !st.moved) {
        if (st?.clickSelect) onSelectLayers(st.clickSelect.ids, st.clickSelect.active);
        setPreview(IDENTITY);
        setDragPoint(null);
        return;
      }
      const pt = clientToCanvas(e.clientX, e.clientY);
      if (st.drag.kind === 'pivot' && selectedItem) {
        onUpdateItem(selectedItem.id, { pivot: { x: Math.round(pt.x), y: Math.round(pt.y) } });
      } else if (st.drag.kind === 'socket' && selectedItem) {
        const sid = st.drag.socketId;
        onUpdateItem(selectedItem.id, {
          sockets: selectedItem.sockets.map((s) =>
            s.id === sid ? { ...s, x: Math.round(pt.x), y: Math.round(pt.y) } : s
          ),
        });
      } else {
        const m = computeTransform(st, pt, e.shiftKey, e.ctrlKey || e.metaKey);
        const canMove = (id: string) => {
          const l = project.layers[id];
          return l && !l.locked && !findGroupOfLayer(project, id)?.locked;
        };
        if (colorScope) {
          const sel = Object.fromEntries(Object.entries(blockSel).filter(([lid]) => canMove(lid)));
          if (Object.keys(sel).length > 0) onTransformBlocks(sel, m);
        } else {
          const movable = selectedLayerIds.filter(canMove);
          if (movable.length > 0) onTransformLayers(movable, m);
        }
      }
      setPreview(IDENTITY);
      setDragPoint(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [isSelectDragging, clientToCanvas, zoom, selectedItem, selectedLayerIds, project, onTransformLayers, onTransformBlocks, onUpdateItem, onSelectLayers, lockAspect, colorScope, blockSel]);

  // Mouse / Pointer Down handler
  const handleMouseDown = (e: React.PointerEvent) => {
    pointerTypeRef.current = e.pointerType;
    if (e.pointerType === 'pen') penSeenRef.current = true;
    if (e.pointerType === 'touch') {
      touchesRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touchesRef.current.size >= 2) {
        abortGestureConflicts();
        beginPinch();
        return;
      }
      // Remaining finger of a finished pinch, or a palm/finger while a pen is in use: never draw.
      if (gestureRef.current || penSeenRef.current) {
        setIsPanning(true);
        setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
        return;
      }
    }
    if (e.button === 2 && e.pointerType !== 'touch') rightDownRef.current = { x: e.clientX, y: e.clientY };
    if (bindingHas(keymap, 'view.panDrag', comboFromPointer(e, isSpacePressed, 'drag'))) {
      setIsPanning(true);
      setPanStart({
        x: e.clientX - pan.x,
        y: e.clientY - pan.y,
      });
      return;
    }

    if (e.button !== 0) return;
    rectRef.current = svgRef.current?.getBoundingClientRect() || null;
    const pt = clientToCanvas(e.clientX, e.clientY);
    pt.pressure = getEventPressure(e);

    // Alt + 点击：拾取画布上的图层，任何工具下可用
    if (bindingHas(keymap, 'layer.pick', comboFromPointer(e, false, 'click'))) {
      const hitId = layerIdFromTarget(e.target);
      if (hitId) {
        onPickLayer(hitId);
        playCrispClick();
      }
      return;
    }

    if ((e.target as Element).closest?.('[data-handle="sym-center"]')) {
      setSymDragging(true);
      return;
    }

    if (currentTool === 'vector_edit' || currentTool === 'stamp') return;

    if (currentTool === 'select') {
      handleSelectDown(e, pt);
      return;
    }

    // 1. Anchor Edit Tool
    if (currentTool === 'anchor_edit') {
      if (selectedCutoutId && editableAnchors.length > 0) {
        const hitIdx = editableAnchors.findIndex(
          (a) => Math.hypot(a.x - pt.x, a.y - pt.y) < 18 / zoom
        );
        if (hitIdx !== -1) {
          setActiveAnchorIndex(hitIdx);
          setIsDraggingAnchor(true);
          setHasDraggedAnchor(false);
          document.body.style.cursor = 'grabbing';
          return;
        }
      }

      if (activeLayer) {
        for (let i = activeLayer.cutouts.length - 1; i >= 0; i--) {
          const cutout = activeLayer.cutouts[i];
          const anchors = cutout.points || extractAnchorPointsFromD(cutout.d);
          const hitIdx = anchors.findIndex(
            (a) => Math.hypot(a.x - pt.x, a.y - pt.y) < 22 / zoom
          );
          if (hitIdx !== -1) {
            setSelectedCutoutId(cutout.id);
            setEditableAnchors(anchors);
            setActiveAnchorIndex(hitIdx);
            setIsDraggingAnchor(true);
            setHasDraggedAnchor(false);
            document.body.style.cursor = 'grabbing';
            return;
          }
        }
      }
      return;
    }

    // 2. Click-placed shapes: 不规则多边形 closes, 折线 stays an open band (单击加点，双击 / Enter 结束)
    if (currentTool === 'geom_shape' && multiPoint) {
      if (!activeLayer || activeLocked || activeHidden || activeDoodle) return;

      const now = Date.now();
      const closeNearStart =
        brushSettings.geomShapeType === 'polyline' &&
        polylinePoints.length >= 3 &&
        Math.hypot(pt.x - polylinePoints[0].x, pt.y - polylinePoints[0].y) < 20 / zoom;
      const doubleClick = now - lastClickTime < 320 && polylinePoints.length >= 2;

      if (closeNearStart || doubleClick) {
        finishMultiPoint(polylinePoints);
        return;
      }

      setLastClickTime(now);
      setPolylinePoints((prev) => [...prev, pt]);
      setPolyHover(pt);
      playCrispClick();
      return;
    }

    if (activeDoodle && currentTool !== 'hand_draw') return;

    if (activeLayer && !activeLocked && !activeHidden) {
      const voice: StrokeSound | null =
        currentTool === 'hand_draw'
          ? brushSettings.drawBrushType === 'willow'
            ? 'brush'
            : brushSettings.drawBrushType || 'pencil'
          : currentTool === 'willow_leaf'
          ? 'scissors'
          : currentTool === 'pen_knife' || currentTool === 'freehand'
          ? 'knife'
          : null;
      if (voice) strokeStart(voice, e.clientX, e.clientY);
    }

    // 3. Normal drawing (Willow Leaf, Geom Shapes, Pen Knife, Hand Draw)
    strokeRef.current = [pt];
        lastClientRef.current = { x: e.clientX, y: e.clientY };
    curRef.current = pt;
    setIsDrawing(true);
    setStartPoint(pt);
    setCurrentPoint(pt);
    setStrokePoints([pt]);
  };

  // Global pointer move & up listeners for drawing / panning / anchor editing
  useEffect(() => {
    if (!isDrawing && !isPanning && activeAnchorIndex === null) return;

    const handleWindowMouseMove = (e: PointerEvent) => {
      if (isPanning) {
        panTargetRef.current = { x: e.clientX - panStart.x, y: e.clientY - panStart.y };
        scheduleFlush();
        return;
      }

      lastClientRef.current = { x: e.clientX, y: e.clientY };
      const pt = clientToCanvas(e.clientX, e.clientY);
      pt.pressure = getEventPressure(e);

      // Anchor dragging in anchor_edit mode
      if (currentTool === 'anchor_edit' && activeAnchorIndex !== null && selectedCutoutId) {
        const nextAnchors = [...editableAnchors];
        nextAnchors[activeAnchorIndex] = pt;
        setEditableAnchors(nextAnchors);
        setHasDraggedAnchor(true);

        const editing = activeLayer?.cutouts.find((c) => c.id === selectedCutoutId);
        const newD = editing?.stroke ? strokeOutline(nextAnchors, editing.stroke) : rebuildPathFromPoints(nextAnchors);
        onUpdateCutout(selectedCutoutId, {
          d: newD,
          points: nextAnchors,
        });
        return;
      }

      if (!isDrawing) return;
      const collectsStroke =
        currentTool === 'willow_leaf' ||
        currentTool === 'pen_knife' ||
        currentTool === 'freehand' ||
        currentTool === 'hand_draw';
      const samples = e.getCoalescedEvents?.() || [];
      const stabilized =
        currentTool === 'willow_leaf' || (currentTool === 'hand_draw' && brushSettings.drawBrushType === 'willow');
      const radius = stabilized ? stabilizerRadius(brushSettings.stabilizer ?? 0.55, zoom) : 0;
      if (collectsStroke) {
        strokeMove(e.clientX, e.clientY);
        (samples.length > 0 ? samples : [e]).forEach((ev) => {
          const sp = clientToCanvas(ev.clientX, ev.clientY);
          sp.pressure = getEventPressure(ev);
          if (radius > 0) {
            const pts = strokeRef.current;
            const tip = pullString(pts[pts.length - 1], sp, radius);
            if (tip) pts.push(tip);
          } else {
            strokeRef.current.push(sp);
          }
        });
      }
      curRef.current = pt;
      scheduleFlush();
    };

    const handleWindowMouseUp = () => {
      strokeEnd();
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      if (isPanning) {
        if (panTargetRef.current) setPan(panTargetRef.current);
        panTargetRef.current = null;
        setIsPanning(false);
        return;
      }
      const strokePoints = strokeRef.current;
      const currentPoint = curRef.current;
      curRef.current = null;

      if (currentTool === 'anchor_edit' || isDraggingAnchor || activeAnchorIndex !== null) {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        setIsDraggingAnchor(false);
        setActiveAnchorIndex(null);
        if (hasDraggedAnchor) {
          onCommitCutoutEdit?.();
          setHasDraggedAnchor(false);
        }
        return;
      }

      if (!isDrawing || !startPoint || !currentPoint) {
        setIsDrawing(false);
        return;
      }

      const dist = Math.hypot(currentPoint.x - startPoint.x, currentPoint.y - startPoint.y);
      const canEdit = !!activeLayer && !activeLocked && !activeHidden;
      const canCarve = canEdit && !activeDoodle;

      // 1. Hand Draw Tool (手绘：铅笔/钢笔/喷枪，附属于当前图层蒙版)
      if (currentTool === 'hand_draw') {
        if (activeLayer && canEdit && strokePoints.length >= 2 && brushSettings.drawBrushType === 'willow') {
          const leafD = generateWillowShape(strokePoints, brushSettings.willowMode || 'chord');
          if (leafD) {
            onAddDrawingStroke?.({
              id: `drw_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
              brushType: 'willow',
              d: withSymmetry(leafD),
              color: brushSettings.brushColor,
              opacity: brushSettings.drawOpacity ?? 0.85,
              strokeWidth: 0,
              fill: true,
            });
          }
        } else if (activeLayer && canEdit && strokePoints.length >= 2) {
          const drawD = generateFreehandDrawPath(strokePoints);
          if (drawD) {
            const brushType = brushSettings.drawBrushType || 'pencil';
            const hardness = brushSettings.pencilHardness || 3;
            let finalOpacity = brushSettings.drawOpacity ?? 0.85;
            if (brushType === 'pencil' && hardness === 1) finalOpacity *= 0.85;

            let strokeWidth = brushSettings.drawSize || 6;
            if (brushSettings.pressure) {
              const avgPressure =
                strokePoints.reduce((acc, p) => acc + (p.pressure || 0.5), 0) /
                strokePoints.length;
              strokeWidth = Math.max(1, strokeWidth * (0.35 + avgPressure * 1.3));
            }

            const newStroke: LayerDrawStroke = {
              id: `drw_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
              brushType,
              d: withSymmetry(drawD),
              color: brushSettings.brushColor,
              opacity: finalOpacity,
              strokeWidth,
              strokeLinecap: hardness === 5 ? 'square' : 'round',
              strokeLinejoin: 'round',
              pencilHardness: hardness,
              blur:
                brushType === 'airbrush'
                  ? (brushSettings.airbrushSoftness || 12)
                  : hardness === 1
                  ? 0.8
                  : undefined,
            };

            onAddDrawingStroke?.(newStroke);
          }
        }
        setIsDrawing(false);
        setStartPoint(null);
        setCurrentPoint(null);
        setStrokePoints([]);
        return;
      }

      // 2. Papercut Carving Tools (Willow Leaf, Geom, Pen Knife)
      let baseD = '';
      let cutoutPoints: Point[] | undefined = undefined;

      if (currentTool === 'willow_leaf') {
        if (strokePoints.length >= 2) {
          baseD = generateWillowShape(strokePoints, brushSettings.willowMode || 'chord');
          cutoutPoints = strokePoints;
        }
      } else if (currentTool === 'geom_shape') {
        if (multiPoint) {
          setIsDrawing(false);
          return;
        }
        const p1 = dist < 8 ? { x: startPoint.x - 40, y: startPoint.y - 40 } : startPoint;
        const p2 = dist < 8 ? { x: startPoint.x + 40, y: startPoint.y + 40 } : currentPoint;
        const geom = generateGeomShape((brushSettings.geomShapeType || 'rect') as Exclude<GeomShapeType, 'path'>, p1, p2, {
          starPoints: brushSettings.starPoints ?? 5,
          starRoundness: brushSettings.starRoundness ?? 0,
          starIrregularity: brushSettings.starIrregularity ?? 0,
        });
        baseD = geom.d;
        cutoutPoints = geom.points;
      } else if (currentTool === 'pen_knife' || currentTool === 'freehand') {
        if (strokePoints.length >= 2) {
          baseD = generateKnifeCut(
            strokePoints,
            brushSettings.stampSize || 26,
            brushSettings.knifeTipShape || 'round',
            brushSettings.pressure,
            nib
          );
          cutoutPoints = strokePoints;
        }
      }

      if (carveMode === 'erase' && brushSettings.eraseMode === 'wipe' && activeLayer && canCarve) {
        const raw = strokePoints.length > 1 ? strokePoints : [startPoint, currentPoint];
        const pts: Point[] = [];
        raw.forEach((p, i) => {
          const q = raw[i - 1];
          const steps = q ? Math.max(1, Math.ceil(Math.hypot(p.x - q.x, p.y - q.y) / 2)) : 1;
          for (let k = q ? 1 : 0; k <= steps; k++) {
            pts.push(q ? { x: q.x + ((p.x - q.x) * k) / steps, y: q.y + ((p.y - q.y) * k) / steps } : p);
          }
        });
        const swept = symMats.flatMap((m) => pts.map((p) => applyToPoint(m, p)));
        const reach = 6 / zoom;
        const hit = activeLayer.cutouts.filter((c) => {
          const anchors = c.points && c.points.length > 0 ? c.points : [];
          return swept.some(
            (p) => pathContains(c.d, p.x, p.y) || anchors.some((a) => Math.hypot(a.x - p.x, a.y - p.y) < reach)
          );
        });
        if (hit.length > 0) {
          onRemoveCutouts(hit.map((c) => c.id));
          playDiscardSwoosh();
        }
      } else if (baseD && activeLayer && canCarve) {
        baseD = withSymmetry(baseD);
        const isHole = decideHole(activeLayer, baseD, cutoutPoints ?? strokePoints, startPoint);
        const toolNames: Record<string, string> = {
          willow_leaf: '剪纸',
          geom_shape: '几何',
          pen_knife: '笔刀',
          freehand: '笔刀',
        };

        const newCutout: CutoutPath = {
          id: `cut_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          name: `${carveMode === 'erase' ? '剪除' : toolNames[currentTool] || '切口'} ${activeLayer.cutouts.length + 1}`,
          type:
            currentTool === 'willow_leaf'
              ? 'willow_leaf'
              : currentTool === 'geom_shape'
              ? 'geom_shape'
              : 'pen_knife',
          d: baseD,
          isHole,
          fillColor: isHole ? undefined : brushSettings.brushColor,
          createdAt: Date.now(),
          points: cutoutPoints,
          geomType:
            currentTool === 'geom_shape'
              ? brushSettings.geomShapeType || 'rect'
              : undefined,
        };

        onAddCutout(newCutout);
        if (isHole) playPaperRustle();
        else playPaperPlace();
      }

      setIsDrawing(false);
      setStartPoint(null);
      setCurrentPoint(null);
      setStrokePoints([]);
    };

    window.addEventListener('pointermove', handleWindowMouseMove);
    window.addEventListener('pointerup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('pointermove', handleWindowMouseMove);
      window.removeEventListener('pointerup', handleWindowMouseUp);
    };
  }, [
    isDrawing,
    isPanning,
    activeAnchorIndex,
    panStart,
    clientToCanvas,
    currentTool,
    selectedCutoutId,
    editableAnchors,
    hasDraggedAnchor,
    isDraggingAnchor,
    activeLayer,
    activeLocked,
    activeHidden,
    onUpdateCutout,
    onCommitCutoutEdit,
    startPoint,
    currentPoint,
    strokePoints,
    brushSettings,
    onAddCutout,
    onRemoveCutouts,
    onAddDrawingStroke,
    zoom,
  ]);

  const symmetry = brushSettings.symmetry ?? DEFAULT_SYMMETRY;
  const symMats = useMemo(
    () => symmetryMatrices(symmetry, project.width, project.height),
    [symmetry, project.width, project.height]
  );
  const withSymmetry = (d: string) => applySymmetry(d, symMats);

  // 刻纸/贴花/剪除 belong to the 剪纸 tool; 几何 and 笔刀 always carve by 刻纸's own judgement.
  const carveMode = currentTool === 'willow_leaf' ? brushSettings.mode : 'cutout';
  const decideHole = (layer: Layer, d: string, pts: Point[], start: Point) =>
    carveMode === 'positive' ? false : carveMode === 'erase' ? true : classifyCarve(layer, d, pts, start) === 'hole';

  const finishMultiPoint = (pts: Point[]) => {
    setPolylinePoints([]);
    setPolyHover(null);
    if (!activeLayer || pts.length < 2) return;
    const open = brushSettings.geomShapeType === 'path';
    if (!open && pts.length < 3) return;
    const stroke = open ? pathStyle(pts.length) : undefined;
    const d = withSymmetry(stroke ? strokeOutline(pts, stroke) : `M ${pts.map((p) => `${f(p.x)} ${f(p.y)}`).join(' L ')} Z`);
    if (!d) return;
    const isHole = decideHole(activeLayer, d, pts, pts[0]);
    onAddCutout({
      id: `cut_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: `${open ? '折线' : '多边形'} ${activeLayer.cutouts.length + 1}`,
      type: 'geom_shape',
      geomType: open ? 'path' : 'polyline',
      d,
      isHole,
      fillColor: isHole ? undefined : brushSettings.brushColor,
      createdAt: Date.now(),
      points: pts,
      stroke,
    });
    if (isHole) playPaperRustle();
    else playPaperPlace();
  };
  const finishRef = useRef(finishMultiPoint);
  finishRef.current = finishMultiPoint;
  const pendingRef = useRef(polylinePoints);
  pendingRef.current = polylinePoints;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('dialog[open], [data-stamp-workbench]:focus-within')) return;
      if (pendingRef.current.length === 0) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        finishRef.current(pendingRef.current);
      } else if (e.key === 'Escape') {
        setPolylinePoints([]);
        setPolyHover(null);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        e.stopPropagation();
        setPolylinePoints((p) => p.slice(0, -1));
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
  useEffect(() => {
    if (currentTool !== 'geom_shape' || !multiPoint) {
      setPolylinePoints([]);
      setPolyHover(null);
    }
  }, [currentTool, multiPoint]);

  const [symDragging, setSymDragging] = useState(false);
  const symmetryRef = useRef(symmetry);
  symmetryRef.current = symmetry;
  useEffect(() => {
    if (!symDragging) return;
    const onMove = (e: PointerEvent) => {
      const p = clientToCanvas(e.clientX, e.clientY);
      const snap = 8 / zoom;
      let x = Math.round(p.x);
      let y = Math.round(p.y);
      if (Math.abs(x - project.width / 2) < snap) x = project.width / 2;
      if (Math.abs(y - project.height / 2) < snap) y = project.height / 2;
      onChangeBrushSettings({ symmetry: { ...symmetryRef.current, cx: x, cy: y } });
    };
    const onUp = () => setSymDragging(false);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [symDragging, clientToCanvas, zoom, project.width, project.height, onChangeBrushSettings]);

  const drawingTool = ['willow_leaf', 'geom_shape', 'pen_knife', 'freehand', 'hand_draw'].includes(currentTool);
  const symGuides = drawingTool ? symmetryGuides(symmetry, project.width, project.height) : [];
  const symCenter = symmetryCenter(symmetry, project.width, project.height);

  // Live preview geometry, evaluated from refs inside the animation-frame flush
  previewFnRef.current = (pts: Point[], cur: Point): string => withSymmetry(previewShape(pts, cur));
  const previewShape = (pts: Point[], cur: Point): string => {
    const start = pts[0] || startPoint;
    if (!start) return '';
    if (currentTool === 'willow_leaf') {
      if (pts.length < 2) return '';
      return generateWillowShape(pts, brushSettings.willowMode || 'chord');
    } else if (currentTool === 'geom_shape') {
      const origin = startPoint || start;
      const dist = Math.hypot(cur.x - origin.x, cur.y - origin.y);
      const p1 = dist < 8 ? { x: origin.x - 40, y: origin.y - 40 } : origin;
      const p2 = dist < 8 ? { x: origin.x + 40, y: origin.y + 40 } : cur;
      if (multiPoint) return '';
      return generateGeomShape((brushSettings.geomShapeType || 'rect') as Exclude<GeomShapeType, 'path'>, p1, p2, {
        starPoints: brushSettings.starPoints ?? 5,
        starRoundness: brushSettings.starRoundness ?? 0,
        starIrregularity: brushSettings.starIrregularity ?? 0,
      }).d;
    } else if (currentTool === 'pen_knife' || currentTool === 'freehand') {
      if (pts.length >= 2) {
        return generateKnifeCut(
          pts,
          brushSettings.stampSize || 26,
          brushSettings.knifeTipShape || 'round',
          brushSettings.pressure,
          nib
        );
      }
    } else if (currentTool === 'hand_draw') {
      if (pts.length < 2) return '';
      if (brushSettings.drawBrushType === 'willow') {
        return generateWillowShape(pts, brushSettings.willowMode || 'chord');
      }
      return generateFreehandDrawPath(pts);
    }
    return '';
  };

  const pointInfo = (pt: Point): PointInfo => {
    const layers: PointInfo['layers'] = [];
    let color: string | null = null;
    for (let i = renderLayerOrder.length - 1; i >= 0; i--) {
      const layer = renderLayerOrder[i];
      const block = topBlockAt(layer, pt.x, pt.y);
      if (!block) continue;
      const c = blockColor(layer, block) ?? layer.color;
      if (!color) color = c;
      layers.push({ id: layer.id, name: layer.name, color: c });
    }
    return { color, layers };
  };

  const renderLayerOrder: Layer[] = flattenLayerIds(project)
    .filter((id) => isLayerRendered(project, id))
    .map((id) => project.layers[id]);

  const selectedSet = new Set(selectedLayerIds);
  const previewTransform = preview === IDENTITY || isWarp(preview) ? undefined : matrixToSvg(preview);
  const liveCorners = selectionBBox && preview !== IDENTITY ? boxCorners(selectionBBox).map((p) => applyTransform(preview, p)) : null;
  const liveBox = liveCorners ? unionBBox(liveCorners.map((p) => ({ x: p.x, y: p.y, width: 0, height: 0 }))) : selectionBBox;

  const ref = project.reference;
  const referenceNode =
    ref && ref.visible ? (
      <image
        href={ref.src}
        x={ref.x}
        y={ref.y}
        width={ref.width}
        height={ref.height}
        opacity={ref.opacity}
        preserveAspectRatio="xMidYMid meet"
        style={{ pointerEvents: 'none' }}
      />
    ) : null;

  const hs = 1 / zoom;
  const hh = hs * (coarse ? 1.8 : 1);
  const itemPivot =
    selectedItem &&
    (dragRef.current?.drag.kind === 'pivot' && dragPoint
      ? dragPoint
      : applyTransform(preview, selectedItem.pivot));

  const cursorClass = isDraggingAnchor
    ? 'cursor-grabbing'
    : isSpacePressed || isPanning
    ? 'cursor-grab'
    : currentTool === 'select'
    ? lassoMode
      ? 'cursor-crosshair'
      : 'cursor-default'
    : currentTool === 'anchor_edit'
    ? 'cursor-default'
    : activeLocked || activeHidden || (activeDoodle && currentTool !== 'hand_draw')
    ? 'cursor-not-allowed'
    : brushCursor
    ? 'cursor-none'
    : 'cursor-crosshair';

  return (
    <div
      ref={containerRef}
      onPointerDown={handleMouseDown}
      onPointerMove={(e) => {
        hoverRef.current = { x: e.clientX, y: e.clientY };
        if (polylinePoints.length > 0) setPolyHover(clientToCanvas(e.clientX, e.clientY));
        if (!isDrawing) moveBrush(e.clientX, e.clientY, e.pointerType !== 'touch' && !isSpacePressed && !isPanning);
      }}
      onPointerLeave={() => {
        if (isDrawing) return;
        hoverRef.current = null;
        moveBrush(0, 0, false);
      }}
      onWheel={handleWheel}
      onPointerUp={(e) => {
        const d = rightDownRef.current;
        rightDownRef.current = null;
        if (e.button === 2 && d && !isDrawing && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) {
          onOpenToolMenu?.(e.clientX, e.clientY, pointInfo(clientToCanvas(e.clientX, e.clientY)));
        }
      }}
      onContextMenu={(e) => e.preventDefault()}
      style={{ touchAction: 'none' }}
      className={`flex-1 relative overflow-hidden select-none bg-(--ui-app) ${cursorClass}`}
    >
      {/* Outer Studio Workbench Grid Texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-15"
        style={{
          backgroundImage:
            'linear-gradient(to right, var(--ui-grid) 1px, transparent 1px), linear-gradient(to bottom, var(--ui-grid) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* SVG Canvas Container */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0)`,
        }}
      >
        <div
          style={{
            width: `${project.width * zoom}px`,
            height: `${project.height * zoom}px`,
            position: 'relative',
          }}
          className="pointer-events-auto shrink-0"
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${project.width} ${project.height}`}
            className="overflow-visible w-full h-full"
          >
            <CanvasBackdrop bg={project.canvasBg} width={project.width} height={project.height} zoom={zoom} />

            {ref && !ref.onTop && referenceNode}

            {/* Isolated so blend modes mix only between paper layers, never with the notepad backing */}
            <g style={{ isolation: 'isolate' }}>
              {renderLayerOrder.map((layer) => (
                <LayerMarkup
                  key={layer.id}
                  layer={
                    currentTool === 'vector_edit' && vectorPreview?.id === layer.id
                      ? vectorPreview
                      : colorScope && blockSel[layer.id] && preview !== IDENTITY
                      ? transformBlocks(layer, blockSel[layer.id], preview)
                      : !colorScope && isWarp(preview) && selectedSet.has(layer.id)
                      ? transformLayer(layer, preview)
                      : layer
                  }
                  shadowOpts={shadowOpts}
                  transform={!colorScope && selectedSet.has(layer.id) ? previewTransform : undefined}
                />
              ))}
            </g>

            {ref && ref.onTop && referenceNode}

          </svg>

          {/* Interaction overlay: redrawn every pointer move without repainting the filtered paper layers */}
          <svg
            viewBox={`0 0 ${project.width} ${project.height}`}
            className="absolute inset-0 w-full h-full overflow-visible"
            style={{ pointerEvents: 'none', willChange: 'transform' }}
          >
            {liveStampPath&&!isSpacePressed&&onLiveStampPathCommit&&<LiveStampPathOverlay key={liveStampPath.id} stroke={liveStampPath} onCommit={onLiveStampPathCommit}/>}
            {fabricAdjust&&!isSpacePressed&&activeLayer?.fabric&&!activeLocked&&onFabricCommit&&<FabricAdjustOverlay layer={activeLayer} assets={project.fabricAssets} onCommit={onFabricCommit}/>}
            {currentTool === 'stamp' && <StampPainter definition={stampDefinition} settings={stampSettings} width={project.width} height={project.height} panHeld={isSpacePressed} disabled={activeLocked || (!!activeLayer && !isLayerRendered(project,activeLayer.id))} onCommit={onStamp}/>}
            {currentTool === 'vector_edit' && activeLayer && <VectorEditor
              key={project.id + ':' + activeLayer.id}
              layer={activeLayer} zoom={zoom} disabled={activeLocked || !isLayerRendered(project, activeLayer.id)}
              panHeld={isSpacePressed} onCommit={onCommitVectorLayer} onPreview={setVectorPreview}
            />}
            {/* Direct clickable hit area for cutouts when in anchor_edit mode */}
            {activeLayer && currentTool === 'anchor_edit' && isLayerRendered(project, activeLayer.id) && (
              <g>
                {activeLayer.cutouts.map((c) => {
                  const isSelected = selectedCutoutId === c.id;
                  return (
                    <path
                      key={`hit_${c.id}`}
                      d={c.d}
                      fill={isSelected ? '#2652D0' : 'transparent'}
                      fillOpacity={isSelected ? 0.08 : 0}
                      stroke={isSelected ? '#2652D0' : '#BAC5EB'}
                      strokeWidth={isSelected ? 2.5 / zoom : 1.5 / zoom}
                      strokeDasharray={isSelected ? '4 3' : '2 2'}
                      strokeOpacity={isSelected ? 1 : 0.4}
                      style={{ pointerEvents: 'all' }}
                      className="cursor-pointer"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setSelectedCutoutId(c.id);
                        const anchors =
                          c.points && c.points.length > 0
                            ? c.points
                            : extractAnchorPointsFromD(c.d);
                        setEditableAnchors(anchors);
                      }}
                    />
                  );
                })}
              </g>
            )}

            {/* Active layer outline for drawing tools, so it is always clear where strokes land */}
            {currentTool !== 'select' && activeBBox && !isDrawing && (
              <rect
                x={activeBBox.x - 4 * hs}
                y={activeBBox.y - 4 * hs}
                width={activeBBox.width + 8 * hs}
                height={activeBBox.height + 8 * hs}
                fill="none"
                stroke={activeLocked ? '#D23838' : '#2652D0'}
                strokeOpacity={0.55}
                strokeWidth={1.2 * hs}
                strokeDasharray={`${5 * hs} ${4 * hs}`}
                pointerEvents="none"
              />
            )}

            {/* Real-time Hand Drawing Stroke Preview (Clipped by active layer mask) */}
            {isDrawing && currentTool === 'hand_draw' && activeLayer && (
              <g mask={activeDoodle ? undefined : `url(#cv_${activeLayer.id}_paper)`}>
                <g
                  ref={previewRef}
                  fill={brushSettings.drawBrushType === 'willow' ? brushSettings.brushColor : 'none'}
                  fillOpacity={brushSettings.drawOpacity ?? 0.85}
                  stroke={brushSettings.drawBrushType === 'willow' ? 'none' : brushSettings.brushColor}
                  strokeWidth={brushSettings.drawSize || 6}
                  strokeOpacity={brushSettings.drawOpacity ?? 0.85}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    filter:
                      brushSettings.drawBrushType === 'airbrush'
                        ? `blur(${brushSettings.airbrushSoftness || 12}px)`
                        : brushSettings.pencilHardness === 1
                        ? 'blur(0.8px)'
                        : undefined,
                  }}
                />
              </g>
            )}

            {/* Real-time Cutout Preview (Willow Leaf, Geom Shapes, Pen Knife) */}
            {isDrawing && currentTool !== 'hand_draw' && (
              <g
                ref={previewRef}
                fill={carveMode === 'erase' ? '#EB8E88' : carveMode === 'cutout' ? '#FAF8F2' : brushSettings.brushColor}
                fillOpacity={carveMode === 'erase' ? 0.3 : carveMode === 'cutout' ? 0.55 : 0.88}
                stroke={carveMode === 'cutout' ? '#2652D0' : '#EB8E88'}
                strokeWidth={2 / zoom}
                strokeDasharray={carveMode === 'erase' ? '3 3' : carveMode === 'cutout' ? '4 3' : undefined}
                opacity={0.88}
              />
            )}

            {/* Click-placed shape in progress */}
            {polylinePoints.length > 0 && brushSettings.geomShapeType === 'path' && (
              <path
                d={withSymmetry(strokeOutline([...polylinePoints, ...(polyHover ? [polyHover] : [])], pathStyle(polylinePoints.length + 1)))}
                fill={carveMode === 'cutout' ? '#FAF8F2' : brushSettings.brushColor}
                fillOpacity={0.6}
                stroke="#2652D0"
                strokeWidth={1.2 / zoom}
                strokeDasharray={`${4 / zoom} ${3 / zoom}`}
                pointerEvents="none"
              />
            )}
            {polylinePoints.length > 0 && (
              <polyline
                points={[...polylinePoints, ...(polyHover ? [polyHover] : [])].map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke="#2652D0"
                strokeWidth={2 / zoom}
                strokeDasharray="4 3"
                pointerEvents="none"
              />
            )}

            {lasso && lasso.length > 1 && (
              <polygon
                points={lasso.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="#2652D0"
                fillOpacity={0.07}
                stroke="#2652D0"
                strokeWidth={1.3 / zoom}
                strokeDasharray={`${5 / zoom} ${3 / zoom}`}
                strokeLinejoin="round"
                pointerEvents="none"
              />
            )}

            {/* Select tool: bounding box + scale/rotate handles */}
            {currentTool === 'select' && liveBox && (
              <g>
                {liveCorners ? (
                  <polygon
                    points={liveCorners.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="none"
                    stroke="#2652D0"
                    strokeWidth={1.5 * hh}
                    pointerEvents="none"
                  />
                ) : (
                  <rect
                    x={liveBox.x}
                    y={liveBox.y}
                    width={liveBox.width}
                    height={liveBox.height}
                    fill="none"
                    stroke="#2652D0"
                    strokeWidth={1.5 * hh}
                    strokeDasharray={selectedItem ? undefined : `${6 * hh} ${4 * hh}`}
                    pointerEvents="none"
                  />
                )}
                {!isSelectDragging && (
                  <>
                    <line
                      x1={liveBox.x + liveBox.width / 2}
                      y1={liveBox.y}
                      x2={liveBox.x + liveBox.width / 2}
                      y2={liveBox.y - 26 * hh}
                      stroke="#2652D0"
                      strokeWidth={1.2 * hh}
                      pointerEvents="none"
                    />
                    <circle
                      data-handle="rotate"
                      pointerEvents="all"
                      cx={liveBox.x + liveBox.width / 2}
                      cy={liveBox.y - 26 * hh}
                      r={6 * hh}
                      fill="#FBFBFC"
                      stroke="#2652D0"
                      strokeWidth={2 * hh}
                      className="cursor-grab"
                    />
                    {(['n', 's', 'e', 'w'] as const).map((side) => {
                      const b = liveBox;
                      const horiz = side === 'n' || side === 's';
                      const x = side === 'e' ? b.x + b.width : b.x;
                      const y = side === 's' ? b.y + b.height : b.y;
                      const t = 8 * hh;
                      return (
                        <g key={side} data-handle={`edge-${side}`} pointerEvents="all" className={horiz ? 'cursor-ns-resize' : 'cursor-ew-resize'}>
                          <rect
                            x={horiz ? b.x : x - t / 2}
                            y={horiz ? y - t / 2 : b.y}
                            width={horiz ? b.width : t}
                            height={horiz ? t : b.height}
                            fill="transparent"
                          />
                          <rect
                            x={horiz ? b.x + b.width / 2 - 7 * hh : x - 2.5 * hh}
                            y={horiz ? y - 2.5 * hh : b.y + b.height / 2 - 7 * hh}
                            width={(horiz ? 14 : 5) * hh}
                            height={(horiz ? 5 : 14) * hh}
                            rx={2.5 * hh}
                            fill="#FBFBFC"
                            stroke="#2652D0"
                            strokeWidth={1.5 * hh}
                          />
                        </g>
                      );
                    })}
                    {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
                      <rect
                        key={corner}
                        data-handle={`scale-${corner}`}
                        pointerEvents="all"
                        x={(corner.includes('w') ? liveBox.x : liveBox.x + liveBox.width) - 5 * hh}
                        y={(corner.includes('n') ? liveBox.y : liveBox.y + liveBox.height) - 5 * hh}
                        width={10 * hh}
                        height={10 * hh}
                        fill="#FBFBFC"
                        stroke="#2652D0"
                        strokeWidth={2 * hh}
                        className={corner === 'nw' || corner === 'se' ? 'cursor-nwse-resize' : 'cursor-nesw-resize'}
                      />
                    ))}
                  </>
                )}
              </g>
            )}

            {flashing && (() => {
              const ids = flashing.layerIds.filter((id) => isLayerRendered(project, id));
              if (ids.length === 0) return null;
              return (
                <g key={flashing.key} className="item-flash" pointerEvents="none">
                  <defs>
                    <filter id="item-flash-halo" x="-10%" y="-10%" width="120%" height="120%">
                      <feMorphology in="SourceAlpha" operator="dilate" radius={3.5 / zoom} result="d" />
                      <feComposite in="d" in2="SourceAlpha" operator="out" result="ring" />
                      <feGaussianBlur in="ring" stdDeviation={1.2 / zoom} result="glow" />
                      <feFlood floodColor="#3A6DF0" />
                      <feComposite in2="glow" operator="in" result="halo" />
                      <feFlood floodColor="#3A6DF0" floodOpacity="0.22" />
                      <feComposite in2="SourceAlpha" operator="in" result="tint" />
                      <feMerge>
                        <feMergeNode in="tint" />
                        <feMergeNode in="halo" />
                      </feMerge>
                    </filter>
                  </defs>
                  {ids.map((id) => (
                      <use key={id} href={`#cv_${id}_body`} filter="url(#item-flash-halo)" />
                    ))}
                </g>
              );
            })()}

            {/* Item pivot & sockets */}
            {currentTool === 'select' && selectedItem && itemPivot && (
              <g>
                {selectedItem.sockets.map((s) => {
                  const pos =
                    dragRef.current?.drag.kind === 'socket' &&
                    (dragRef.current.drag as { socketId: string }).socketId === s.id &&
                    dragPoint
                      ? dragPoint
                      : applyTransform(preview, s);
                  return (
                    <g key={s.id} data-handle={`socket:${s.id}`} pointerEvents="all" className="cursor-move">
                      <path
                        d={`M ${pos.x} ${pos.y - 7 * hh} L ${pos.x + 7 * hh} ${pos.y} L ${pos.x} ${pos.y + 7 * hh} L ${pos.x - 7 * hh} ${pos.y} Z`}
                        fill="#EB8E88"
                        stroke="#FBFBFC"
                        strokeWidth={1.5 * hh}
                      />
                      <text
                        x={pos.x + 10 * hh}
                        y={pos.y + 4 * hh}
                        fontSize={11 * hh}
                        fill="#482A45"
                        fontWeight={600}
                        style={{ paintOrder: 'stroke', stroke: '#FBFBFC', strokeWidth: 3 * hh }}
                      >
                        {s.name}
                      </text>
                    </g>
                  );
                })}
                {flashing?.itemId === selectedItem.id && (
                  <g key={flashing.key} pointerEvents="none">
                    {[0, 0.45].map((delay) => (
                      <circle key={delay} cx={itemPivot.x} cy={itemPivot.y} r={9 * hh} fill="none" stroke="#D23838" strokeWidth={2 * hh} opacity="0">
                        <animate attributeName="r" from={9 * hh} to={30 * hh} dur="0.9s" begin={`${delay}s`} fill="freeze" />
                        <animate attributeName="opacity" values="0.9;0" dur="0.9s" begin={`${delay}s`} fill="freeze" />
                      </circle>
                    ))}
                    <text
                      x={itemPivot.x + 16 * hh}
                      y={itemPivot.y - 12 * hh}
                      fontSize={11 * hh}
                      fill="#D23838"
                      fontWeight={600}
                      className="item-flash"
                      style={{ paintOrder: 'stroke', stroke: '#FBFBFC', strokeWidth: 3 * hh }}
                    >
                      拖动调整锚点
                    </text>
                  </g>
                )}
                <g data-handle="pivot" pointerEvents="all" className="cursor-move">
                  <title>锚点：拖动调整</title>
                  <circle cx={itemPivot.x} cy={itemPivot.y} r={9 * hh} fill="#FBFBFC" fillOpacity={0.85} stroke="#D23838" strokeWidth={2 * hh} />
                  <path
                    d={`M ${itemPivot.x - 13 * hh} ${itemPivot.y} H ${itemPivot.x + 13 * hh} M ${itemPivot.x} ${itemPivot.y - 13 * hh} V ${itemPivot.y + 13 * hh}`}
                    stroke="#D23838"
                    strokeWidth={1.5 * hh}
                  />
                </g>
              </g>
            )}

            {/* Interactive Anchor Points Handles (when in anchor_edit mode) */}
            {currentTool === 'anchor_edit' && editableAnchors.length > 0 && (
              <g className="cursor-move">
                {editingStroke && (
                  <polyline
                    points={editableAnchors.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="none"
                    stroke="#2652D0"
                    strokeOpacity={0.45}
                    strokeWidth={1 / zoom}
                    strokeDasharray={`${3 / zoom} ${3 / zoom}`}
                    pointerEvents="none"
                  />
                )}
                {editableAnchors.map((pt, idx) => {
                  const isAnchorActive = activeAnchorIndex === idx;
                  const corner = !!editingStroke && !editingStroke.smooth[idx];
                  return (
                    <g
                      key={`anchor_${idx}`}
                      pointerEvents="all"
                      data-tip={editingStroke ? '双击切换尖角 / 曲线' : undefined}
                      onDoubleClick={(e) => {
                        if (!editingStroke || !selectedCutoutId) return;
                        e.stopPropagation();
                        const smooth = editableAnchors.map((_, i) => (i === idx ? !editingStroke.smooth[i] : !!editingStroke.smooth[i]));
                        const stroke = { ...editingStroke, smooth };
                        onUpdateCutout(selectedCutoutId, { stroke, d: strokeOutline(editableAnchors, stroke) }, true);
                        playCrispClick();
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setActiveAnchorIndex(idx);
                        setIsDraggingAnchor(true);
                        setHasDraggedAnchor(false);
                        document.body.style.cursor = 'grabbing';
                        document.body.style.userSelect = 'none';
                      }}
                    >
                      <circle cx={pt.x} cy={pt.y} r={18 / zoom} fill="transparent" style={{ pointerEvents: 'all' }} />
                      {corner ? (
                        <rect
                          x={pt.x - (isAnchorActive ? 7 : 5.5) / zoom}
                          y={pt.y - (isAnchorActive ? 7 : 5.5) / zoom}
                          width={(isAnchorActive ? 14 : 11) / zoom}
                          height={(isAnchorActive ? 14 : 11) / zoom}
                          fill={isAnchorActive ? '#2652D0' : '#FFFFFF'}
                          stroke="#2652D0"
                          strokeWidth={2.5 / zoom}
                        />
                      ) : (
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isAnchorActive ? 8 / zoom : 6 / zoom}
                          fill={isAnchorActive ? '#2652D0' : '#FFFFFF'}
                          stroke="#2652D0"
                          strokeWidth={2.5 / zoom}
                        />
                      )}
                      <circle cx={pt.x} cy={pt.y} r={2.5 / zoom} fill={isAnchorActive ? '#FFFFFF' : '#2652D0'} />
                    </g>
                  );
                })}
              </g>
            )}
            {isDrawing &&
              (brushSettings.stabilizer ?? 0) > 0 &&
              (currentTool === 'willow_leaf' || (currentTool === 'hand_draw' && brushSettings.drawBrushType === 'willow')) && (
                <line
                  ref={stringRef}
                  stroke="#EB8E88"
                  strokeWidth={1.4 / zoom}
                  strokeDasharray={`${3 / zoom} ${2 / zoom}`}
                  pointerEvents="none"
                />
              )}

            {symGuides.length > 0 && (
              <g>
                {symGuides.map(([x1, y1, x2, y2], i) => (
                  <line
                    key={i}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="#EB8E88"
                    strokeOpacity={0.75}
                    strokeWidth={1.2 / zoom}
                    strokeDasharray={`${6 / zoom} ${4 / zoom}`}
                    pointerEvents="none"
                  />
                ))}
                <g data-handle="sym-center" pointerEvents="all" className="cursor-move">
                  <circle cx={symCenter.x} cy={symCenter.y} r={(coarse ? 14 : 8) / zoom} fill="#FBFBFC" fillOpacity={0.9} stroke="#EB8E88" strokeWidth={2 / zoom} />
                  <circle cx={symCenter.x} cy={symCenter.y} r={2 / zoom} fill="#EB8E88" />
                </g>
              </g>
            )}

            {/* Brush size ring following the pointer */}
            <g ref={brushRef} data-show={brushCursor && !isSpacePressed && !isPanning ? '1' : '0'} visibility="hidden" pointerEvents="none">
              {brushCursor?.d && (
                <>
                  <path d={brushCursor.d} fill="none" stroke="#FBFBFC" strokeWidth={2.5 / zoom} opacity={0.9} />
                  <path
                    d={brushCursor.d}
                    fill={brushSettings.drawBrushType === 'airbrush' && currentTool === 'hand_draw' ? 'none' : 'none'}
                    stroke="#1B2352"
                    strokeWidth={1 / zoom}
                    strokeDasharray={currentTool === 'hand_draw' && brushSettings.drawBrushType === 'airbrush' ? `${3 / zoom} ${2 / zoom}` : undefined}
                  />
                </>
              )}
              {brushCursor?.cross && (
                <>
                  <path
                    d={`M ${-9 / zoom} 0 H ${-2.5 / zoom} M ${2.5 / zoom} 0 H ${9 / zoom} M 0 ${-9 / zoom} V ${-2.5 / zoom} M 0 ${2.5 / zoom} V ${9 / zoom}`}
                    stroke="#FBFBFC"
                    strokeWidth={3 / zoom}
                  />
                  <path
                    d={`M ${-9 / zoom} 0 H ${-2.5 / zoom} M ${2.5 / zoom} 0 H ${9 / zoom} M 0 ${-9 / zoom} V ${-2.5 / zoom} M 0 ${2.5 / zoom} V ${9 / zoom}`}
                    stroke="#1B2352"
                    strokeWidth={1.2 / zoom}
                  />
                </>
              )}
              <circle r={1.2 / zoom} fill="#1B2352" />
            </g>
          </svg>
        </div>
      </div>

      <ShortcutHints keymap={keymap} currentTool={currentTool} spaceHeld={isSpacePressed} />

      {colorScope && blockCount >= 2 && !isSelectDragging && (
        <PathfinderBar
          count={blockCount}
          onApply={(op) => {
            const editable = Object.fromEntries(
              Object.entries(blockSel).filter(([lid]) => {
                const l = project.layers[lid];
                return l && !l.locked && !findGroupOfLayer(project, lid)?.locked;
              })
            );
            const next = onPathfinder(editable, op);
            if (!next) return;
            setBlockSel(next);
            onSelectLayers(Object.keys(next), Object.keys(next).pop());
            playPaperRustle();
          }}
        />
      )}

      {/* Floating Check and Cross for Anchor Edit */}
      {currentTool === 'anchor_edit' && onExitAnchorEdit && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-(--ui-panel)/95 backdrop-blur-md px-2 py-1.5 rounded-2xl border border-(--ui-accent) shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <button
            onClick={onExitAnchorEdit}
            className="w-8 h-8 rounded-xl bg-(--ui-accent) hover:bg-(--ui-accent-hover) text-white flex items-center justify-center shadow-md transition-all hover:scale-105 cursor-pointer"
            data-tip="完成并退出锚点微调"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
          </button>
          <button
            onClick={onExitAnchorEdit}
            className="w-8 h-8 rounded-xl bg-(--ui-raised) hover:bg-(--ui-hover) text-(--ui-muted) hover:text-(--ui-strong) flex items-center justify-center transition-all hover:scale-105 cursor-pointer"
            data-tip="退出锚点微调"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      )}
    </div>
  );
};
