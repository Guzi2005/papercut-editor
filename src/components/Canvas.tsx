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
} from '../types/papercut';
import {
  generateRealtimeWillowLeaf,
  generateFreehandKnifePath,
  generateFreehandDrawPath,
  generateGeomShape,
  rebuildPathFromPoints,
  extractAnchorPointsFromD,
  f,
} from '../utils/bezierMath';
import {
  playPaperRustle,
  playDiscardSwoosh,
  playCrispClick,
} from '../utils/soundEffects';
import { renderLayerMarkup } from '../utils/layerSvg';
import {
  Matrix,
  IDENTITY,
  translate,
  scaleAbout,
  rotateAbout,
  matrixToSvg,
  applyToPoint,
} from '../utils/pathTransform';
import { findGroupOfLayer, findItemOfLayer, isLayerRendered, flattenLayerIds } from '../utils/projectOps';
import { Check, X, Lock, EyeOff, Box } from 'lucide-react';

export type SelectionScope = 'part' | 'item';

interface CanvasProps {
  project: PapercutProject;
  activeLayerId: string | null;
  currentTool: ToolType;
  brushSettings: BrushSettings;
  onChangeBrushSettings: (newSettings: Partial<BrushSettings>) => void;
  zoom: number;
  onZoomChange: (newZoom: number) => void;
  onAddCutout: (cutout: CutoutPath) => void;
  onRemoveCutout: (cutoutId: string) => void;
  onUpdateCutout: (cutoutId: string, updates: Partial<CutoutPath>) => void;
  onAddDrawingStroke?: (stroke: LayerDrawStroke) => void;
  onCommitCutoutEdit?: () => void;
  onExitAnchorEdit?: () => void;
  selectedLayerIds: string[];
  selectionScope: SelectionScope;
  selectedItem: PapercutItem | null;
  onSelectLayers: (layerIds: string[], activeLayerId?: string) => void;
  onPickLayer: (layerId: string) => void;
  onTransformLayers: (layerIds: string[], m: Matrix) => void;
  onUpdateItem: (itemId: string, updates: Partial<PapercutItem>) => void;
  onDeleteLayers: (layerIds: string[]) => void;
}

interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

type DragKind =
  | { kind: 'move' }
  | { kind: 'scale'; anchor: Point; startDist: number }
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

const MODE_LABELS: Record<string, string> = { cutout: '刻纸', positive: '贴花', erase: '剪除' };

const LayerMarkup = React.memo(function LayerMarkup({
  layer,
  shadow,
  transform,
}: {
  layer: Layer;
  shadow: number;
  transform?: string;
}) {
  const html = useMemo(
    () => renderLayerMarkup(layer, { idPrefix: 'cv_', shadow, grain: true, interactive: true }),
    [layer, shadow]
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
  activeLayerId,
  currentTool,
  brushSettings,
  zoom,
  onZoomChange,
  onAddCutout,
  onRemoveCutout,
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
  onUpdateItem,
  onDeleteLayers,
}) => {
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
  const previewRef = useRef<SVGPathElement>(null);
  const predictedRef = useRef<Point[]>([]);
  const lastClientRef = useRef<{ x: number; y: number } | null>(null);
  const previewFnRef = useRef<(pts: Point[], cur: Point) => string>(() => '');

  // Polyline shape drawing state (单击新增锚点，双击终止)
  const [polylinePoints, setPolylinePoints] = useState<Point[]>([]);
  const [lastClickTime, setLastClickTime] = useState<number>(0);

  // Anchor Edit Tool State
  const [selectedCutoutId, setSelectedCutoutId] = useState<string | null>(null);
  const [activeAnchorIndex, setActiveAnchorIndex] = useState<number | null>(null);
  const [editableAnchors, setEditableAnchors] = useState<Point[]>([]);
  const [hasDraggedAnchor, setHasDraggedAnchor] = useState(false);
  const [isDraggingAnchor, setIsDraggingAnchor] = useState(false);

  // Select tool state: live preview matrix + pivot/socket drag positions
  const dragRef = useRef<DragState | null>(null);
  const [previewMatrix, setPreviewMatrix] = useState<Matrix>(IDENTITY);
  const [dragPoint, setDragPoint] = useState<Point | null>(null);
  const [isSelectDragging, setIsSelectDragging] = useState(false);
  const [selectionBBox, setSelectionBBox] = useState<BBox | null>(null);
  const [activeBBox, setActiveBBox] = useState<BBox | null>(null);

  const activeLayer = activeLayerId ? project.layers[activeLayerId] : null;
  const activeGroup = activeLayerId ? findGroupOfLayer(project, activeLayerId) : null;
  const activeItem = activeLayerId ? findItemOfLayer(project, activeLayerId) : null;
  const activeLocked = !!activeLayer && (activeLayer.locked || !!activeGroup?.locked);
  const activeHidden = !!activeLayerId && !isLayerRendered(project, activeLayerId);
  const shadow = project.shadowStrength ?? 0.5;

  // Spacebar listener for canvas hand tool
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
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
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (selectedLayerIds.length === 0) return;
      const step = e.shiftKey ? 10 : 1;
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      if (moves[e.key]) {
        e.preventDefault();
        onTransformLayers(selectedLayerIds, translate(...moves[e.key]));
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        onDeleteLayers(selectedLayerIds);
        playDiscardSwoosh();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentTool, selectedLayerIds, onTransformLayers, onDeleteLayers]);

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
    const svg = svgRef.current;
    if (!svg) return null;
    const boxes: BBox[] = [];
    ids.forEach((id) => {
      const el = svg.querySelector(`[data-layer-id="${id}"]`) as SVGGElement | null;
      if (!el) return;
      try {
        const b = el.getBBox();
        if (b.width > 0 || b.height > 0) boxes.push({ x: b.x, y: b.y, width: b.width, height: b.height });
      } catch {
        /* element not rendered */
      }
    });
    return unionBBox(boxes);
  }, []);

  useLayoutEffect(() => {
    setSelectionBBox(measureLayers(selectedLayerIds));
    setActiveBBox(activeLayerId ? measureLayers([activeLayerId]) : null);
  }, [project, selectedLayerIds, activeLayerId, measureLayers]);

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
  }, [pan, zoom]);

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
        const pts = strokeRef.current.concat(predictedRef.current);
        const tip = pts[pts.length - 1] || curRef.current;
        previewRef.current?.setAttribute('d', previewFnRef.current(pts, curRef.current) || 'M 0 0');
        const g = brushRef.current;
        if (g && lastClientRef.current) {
          g.setAttribute('transform', `translate(${tip.x} ${tip.y})`);
          g.setAttribute('visibility', g.dataset.radius === '0' ? 'hidden' : 'visible');
        }
      }
    });
  }, []);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const brushRadius =
    currentTool === 'pen_knife' || currentTool === 'freehand'
      ? (brushSettings.stampSize || 26) / 2
      : currentTool === 'hand_draw'
      ? (brushSettings.drawSize || 6) / 2
      : 0;

  const moveBrush = (clientX: number, clientY: number, visible: boolean) => {
    const g = brushRef.current;
    if (!g) return;
    if (!visible || brushRadius === 0) {
      g.setAttribute('visibility', 'hidden');
      return;
    }
    const pt = clientToCanvas(clientX, clientY);
    g.setAttribute('transform', `translate(${pt.x} ${pt.y})`);
    g.setAttribute('visibility', 'visible');
  };

  // Wheel zoom around cursor
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey || isSpacePressed) {
      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
      const newZoom = Math.min(Math.max(zoom * zoomFactor, 0.25), 3.5);

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left - rect.width / 2;
        const mouseY = e.clientY - rect.top - rect.height / 2;

        const newPanX = mouseX - (mouseX - pan.x) * (newZoom / zoom);
        const newPanY = mouseY - (mouseY - pan.y) * (newZoom / zoom);

        setPan({ x: newPanX, y: newPanY });
      }
      onZoomChange(newZoom);
    } else {
      setPan((prev) => ({
        x: prev.x - e.deltaX * 0.8,
        y: prev.y - e.deltaY * 0.8,
      }));
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
    setPreviewMatrix(IDENTITY);
    setDragPoint(null);
  };

  const handleSelectDown = (e: React.PointerEvent, pt: Point) => {
    const handle = (e.target as Element).closest?.('[data-handle]')?.getAttribute('data-handle');
    const box = selectionBBox;

    if (handle && box) {
      if (handle.startsWith('scale-')) {
        const corner = handle.slice(6);
        const anchor = {
          x: corner.includes('w') ? box.x + box.width : box.x,
          y: corner.includes('n') ? box.y + box.height : box.y,
        };
        beginSelectDrag(
          { kind: 'scale', anchor, startDist: Math.max(1, Math.hypot(pt.x - anchor.x, pt.y - anchor.y)) },
          pt
        );
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
        beginSelectDrag({ kind: 'move' }, pt);
      } else {
        const narrows = scoped.length < selectedLayerIds.length;
        beginSelectDrag({ kind: 'move' }, pt, narrows ? { ids: scoped, active: hitId } : undefined);
        if (!narrows && hitId !== activeLayerId) onPickLayer(hitId);
      }
      return;
    }

    if (
      box &&
      pt.x >= box.x && pt.x <= box.x + box.width &&
      pt.y >= box.y && pt.y <= box.y + box.height
    ) {
      beginSelectDrag({ kind: 'move' }, pt);
      return;
    }
    onSelectLayers([]);
  };

  useEffect(() => {
    if (!isSelectDragging) return;
    const computeMatrix = (st: DragState, pt: Point, shift: boolean): Matrix => {
      const d = st.drag;
      if (d.kind === 'move') {
        let dx = pt.x - st.start.x;
        let dy = pt.y - st.start.y;
        if (shift) {
          if (Math.abs(dx) > Math.abs(dy)) dy = 0;
          else dx = 0;
        }
        return translate(dx, dy);
      }
      if (d.kind === 'scale') {
        const s = Math.max(0.05, Math.hypot(pt.x - d.anchor.x, pt.y - d.anchor.y) / d.startDist);
        return scaleAbout(s, d.anchor.x, d.anchor.y);
      }
      if (d.kind === 'rotate') {
        let a = Math.atan2(pt.y - d.center.y, pt.x - d.center.x) - d.startAngle;
        if (shift) a = Math.round(a / (Math.PI / 12)) * (Math.PI / 12);
        return rotateAbout(a, d.center.x, d.center.y);
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
        setPreviewMatrix(computeMatrix(st, pt, e.shiftKey));
      }
    };

    const onUp = (e: PointerEvent) => {
      const st = dragRef.current;
      dragRef.current = null;
      setIsSelectDragging(false);
      if (!st || !st.moved) {
        if (st?.clickSelect) onSelectLayers(st.clickSelect.ids, st.clickSelect.active);
        setPreviewMatrix(IDENTITY);
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
        const m = computeMatrix(st, pt, e.shiftKey);
        const movable = selectedLayerIds.filter((id) => {
          const l = project.layers[id];
          return l && !l.locked && !findGroupOfLayer(project, id)?.locked;
        });
        if (movable.length > 0) onTransformLayers(movable, m);
      }
      setPreviewMatrix(IDENTITY);
      setDragPoint(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [isSelectDragging, clientToCanvas, zoom, selectedItem, selectedLayerIds, project, onTransformLayers, onUpdateItem, onSelectLayers]);

  // Mouse / Pointer Down handler
  const handleMouseDown = (e: React.PointerEvent) => {
    if (e.button === 1 || isSpacePressed) {
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
    if (e.altKey) {
      const hitId = layerIdFromTarget(e.target);
      if (hitId) {
        onPickLayer(hitId);
        playCrispClick();
      }
      return;
    }

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

    // 2. Polyline shape in geom_shape (折线：单击新增锚点，双击终止)
    if (currentTool === 'geom_shape' && brushSettings.geomShapeType === 'polyline') {
      if (!activeLayer || activeLocked || activeHidden) return;

      const now = Date.now();
      const closeNearStart =
        polylinePoints.length >= 3 &&
        Math.hypot(pt.x - polylinePoints[0].x, pt.y - polylinePoints[0].y) < 20 / zoom;
      const doubleClick = now - lastClickTime < 320 && polylinePoints.length >= 2;

      if (closeNearStart || doubleClick) {
        const finalPts = [...polylinePoints];
        const d = `M ${finalPts.map((p) => `${f(p.x)} ${f(p.y)}`).join(' L ')} Z`;
        const isHole =
          brushSettings.mode === 'cutout' ||
          (brushSettings.mode === 'erase' && brushSettings.eraseMode === 'willow');
        const newCutout: CutoutPath = {
          id: `cut_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          name: `折线切口 ${activeLayer.cutouts.length + 1}`,
          type: 'geom_shape',
          geomType: 'polyline',
          d,
          isHole,
          fillColor: isHole ? undefined : activeLayer.color,
          createdAt: Date.now(),
          points: finalPts,
        };
        onAddCutout(newCutout);
        playPaperRustle();
        setPolylinePoints([]);
        return;
      }

      setLastClickTime(now);
      setPolylinePoints((prev) => [...prev, pt]);
      playCrispClick();
      return;
    }

    // 3. Normal drawing (Willow Leaf, Geom Shapes, Pen Knife, Hand Draw)
    strokeRef.current = [pt];
    predictedRef.current = [];
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

        const newD = rebuildPathFromPoints(nextAnchors);
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
      if (collectsStroke) {
        (samples.length > 0 ? samples : [e]).forEach((ev) => {
          const sp = clientToCanvas(ev.clientX, ev.clientY);
          sp.pressure = getEventPressure(ev);
          strokeRef.current.push(sp);
        });
        predictedRef.current = (e.getPredictedEvents?.() || []).map((ev) => {
          const pp = clientToCanvas(ev.clientX, ev.clientY);
          pp.pressure = getEventPressure(ev);
          return pp;
        });
      }
      curRef.current = pt;
      scheduleFlush();
    };

    const handleWindowMouseUp = () => {
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

      // 1. Hand Draw Tool (手绘：铅笔/钢笔/喷枪，附属于当前图层蒙版)
      if (currentTool === 'hand_draw') {
        if (activeLayer && canEdit && strokePoints.length >= 2) {
          const drawD = generateFreehandDrawPath(strokePoints);
          if (drawD) {
            const brushType = brushSettings.drawBrushType || 'pencil';
            const hardness = brushSettings.pencilHardness || 3;
            let finalOpacity = brushSettings.drawOpacity ?? 0.85;
            if (brushType === 'pencil' && hardness === 1) finalOpacity *= 0.85;

            let strokeWidth = brushSettings.drawSize || 6;
            if (brushSettings.drawPressure) {
              const avgPressure =
                strokePoints.reduce((acc, p) => acc + (p.pressure || 0.5), 0) /
                strokePoints.length;
              strokeWidth = Math.max(1, strokeWidth * (0.35 + avgPressure * 1.3));
            }

            const newStroke: LayerDrawStroke = {
              id: `drw_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
              brushType,
              d: drawD,
              color: brushSettings.drawColor || '#161B29',
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
          baseD = generateRealtimeWillowLeaf(
            strokePoints,
            brushSettings.willowMode || 'chord',
            brushSettings.stabilizer ?? 0.55,
            brushSettings.simplifyTolerance ?? 4.5
          );
          cutoutPoints = strokePoints;
        }
      } else if (currentTool === 'geom_shape') {
        if (brushSettings.geomShapeType === 'polyline') {
          setIsDrawing(false);
          return;
        }
        const p1 = dist < 8 ? { x: startPoint.x - 40, y: startPoint.y - 40 } : startPoint;
        const p2 = dist < 8 ? { x: startPoint.x + 40, y: startPoint.y + 40 } : currentPoint;
        const geom = generateGeomShape(brushSettings.geomShapeType || 'rect', p1, p2, {
          starPoints: brushSettings.starPoints ?? 5,
          starRoundness: brushSettings.starRoundness ?? 0,
          starIrregularity: brushSettings.starIrregularity ?? 0,
        });
        baseD = geom.d;
        cutoutPoints = geom.points;
      } else if (currentTool === 'pen_knife' || currentTool === 'freehand') {
        if (strokePoints.length >= 2) {
          baseD = generateFreehandKnifePath(
            strokePoints,
            brushSettings.stampSize || 26,
            brushSettings.knifeTipShape || 'round',
            brushSettings.knifePressure ?? false
          );
          cutoutPoints = strokePoints;
        }
      }

      // Handle Erase mode: deletes touched cutouts (智能橡皮) vs 柳叶笔划痕局部镂空 (柳叶笔橡皮)
      if (brushSettings.mode === 'erase' && activeLayer && canEdit) {
        if (brushSettings.eraseMode === 'willow') {
          if (strokePoints.length >= 2) {
            const willowD = generateRealtimeWillowLeaf(
              strokePoints,
              brushSettings.willowMode || 'chord',
              brushSettings.stabilizer ?? 0.55,
              brushSettings.simplifyTolerance ?? 4.5
            );
            if (willowD) {
              const newCutout: CutoutPath = {
                id: `cut_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                name: `柳叶橡皮 ${activeLayer.cutouts.length + 1}`,
                type: 'willow_leaf',
                d: willowD,
                isHole: true,
                createdAt: Date.now(),
                points: strokePoints,
              };
              onAddCutout(newCutout);
              playPaperRustle();
            }
          }
        } else {
          const pts = strokePoints.length > 0 ? strokePoints : [startPoint, currentPoint];
          const toDeleteIds: string[] = [];

          activeLayer.cutouts.forEach((cutout) => {
            const anchors =
              cutout.points && cutout.points.length > 0
                ? cutout.points
                : extractAnchorPointsFromD(cutout.d);
            const isHit = pts.some((p) =>
              anchors.some((a) => Math.hypot(a.x - p.x, a.y - p.y) < 36)
            );
            if (isHit) {
              toDeleteIds.push(cutout.id);
            }
          });

          if (toDeleteIds.length > 0) {
            toDeleteIds.forEach((id) => onRemoveCutout(id));
            playDiscardSwoosh();
          } else if (activeLayer.cutouts.length > 0) {
            const nearest = activeLayer.cutouts.find((c) => {
              const anchors = c.points || extractAnchorPointsFromD(c.d);
              return anchors.some((a) => Math.hypot(a.x - startPoint.x, a.y - startPoint.y) < 40);
            });
            if (nearest) {
              onRemoveCutout(nearest.id);
              playDiscardSwoosh();
            }
          }
        }
      } else if (baseD && activeLayer && canEdit) {
        const isHole = brushSettings.mode === 'cutout';
        const toolNames: Record<string, string> = {
          willow_leaf: '柳叶',
          geom_shape: '几何',
          pen_knife: '笔刀',
          freehand: '笔刀',
        };

        const newCutout: CutoutPath = {
          id: `cut_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          name: `${toolNames[currentTool] || '切口'} ${activeLayer.cutouts.length + 1}`,
          type:
            currentTool === 'willow_leaf'
              ? 'willow_leaf'
              : currentTool === 'geom_shape'
              ? 'geom_shape'
              : 'pen_knife',
          d: baseD,
          isHole,
          fillColor: isHole ? undefined : activeLayer.color,
          createdAt: Date.now(),
          points: cutoutPoints,
          geomType:
            currentTool === 'geom_shape'
              ? brushSettings.geomShapeType || 'rect'
              : undefined,
        };

        onAddCutout(newCutout);
        playPaperRustle();
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
    onRemoveCutout,
    onAddDrawingStroke,
  ]);

  // Live preview geometry, evaluated from refs inside the animation-frame flush
  previewFnRef.current = (pts: Point[], cur: Point): string => {
    const start = pts[0] || startPoint;
    if (!start) return '';
    if (currentTool === 'willow_leaf') {
      if (pts.length < 2) return '';
      return generateRealtimeWillowLeaf(
        pts,
        brushSettings.willowMode || 'chord',
        brushSettings.stabilizer ?? 0.55,
        brushSettings.simplifyTolerance ?? 4.5
      );
    } else if (currentTool === 'geom_shape') {
      const origin = startPoint || start;
      const dist = Math.hypot(cur.x - origin.x, cur.y - origin.y);
      const p1 = dist < 8 ? { x: origin.x - 40, y: origin.y - 40 } : origin;
      const p2 = dist < 8 ? { x: origin.x + 40, y: origin.y + 40 } : cur;
      return generateGeomShape(brushSettings.geomShapeType || 'rect', p1, p2, {
        starPoints: brushSettings.starPoints ?? 5,
        starRoundness: brushSettings.starRoundness ?? 0,
        starIrregularity: brushSettings.starIrregularity ?? 0,
      }).d;
    } else if (currentTool === 'pen_knife' || currentTool === 'freehand') {
      if (pts.length >= 2) {
        return generateFreehandKnifePath(
          pts,
          brushSettings.stampSize || 26,
          brushSettings.knifeTipShape || 'round',
          brushSettings.knifePressure ?? false
        );
      }
    } else if (currentTool === 'hand_draw') {
      if (pts.length >= 2) return generateFreehandDrawPath(pts);
    }
    return '';
  };

  const renderLayerOrder: Layer[] = flattenLayerIds(project)
    .filter((id) => isLayerRendered(project, id))
    .map((id) => project.layers[id]);

  const selectedSet = new Set(selectedLayerIds);
  const previewTransform = previewMatrix === IDENTITY ? undefined : matrixToSvg(previewMatrix);
  const liveBox = (() => {
    if (!selectionBBox) return null;
    if (previewMatrix === IDENTITY) return selectionBBox;
    const b = selectionBBox;
    const corners = [
      { x: b.x, y: b.y },
      { x: b.x + b.width, y: b.y },
      { x: b.x, y: b.y + b.height },
      { x: b.x + b.width, y: b.y + b.height },
    ].map((p) => applyToPoint(previewMatrix, p));
    return unionBBox(corners.map((p) => ({ x: p.x, y: p.y, width: 0, height: 0 })));
  })();

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
  const itemPivot =
    selectedItem &&
    (dragRef.current?.drag.kind === 'pivot' && dragPoint
      ? dragPoint
      : applyToPoint(previewMatrix, selectedItem.pivot));

  const cursorClass = isDraggingAnchor
    ? 'cursor-grabbing'
    : isSpacePressed || isPanning
    ? 'cursor-grab'
    : currentTool === 'select'
    ? 'cursor-default'
    : currentTool === 'anchor_edit'
    ? 'cursor-default'
    : activeLocked || activeHidden
    ? 'cursor-not-allowed'
    : 'cursor-crosshair';

  return (
    <div
      ref={containerRef}
      onPointerDown={handleMouseDown}
      onPointerMove={(e) => {
        if (!isDrawing) moveBrush(e.clientX, e.clientY, !isSpacePressed && !isPanning);
      }}
      onPointerLeave={() => !isDrawing && moveBrush(0, 0, false)}
      onWheel={handleWheel}
      style={{ touchAction: 'none' }}
      className={`flex-1 relative overflow-hidden select-none bg-[#111520] ${cursorClass}`}
    >
      {/* Outer Studio Workbench Grid Texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-15"
        style={{
          backgroundImage:
            'linear-gradient(to right, #405073 1px, transparent 1px), linear-gradient(to bottom, #405073 1px, transparent 1px)',
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
          className="pointer-events-auto"
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${project.width} ${project.height}`}
            className="rounded-xl overflow-visible w-full h-full"
          >
            <defs>
              <pattern id="craft-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#E2E7F3" strokeWidth="0.8" />
              </pattern>
            </defs>

            {/* Underlay Notepad Backing */}
            <rect width={project.width} height={project.height} fill="#FAF8F2" rx="16" />
            <rect width={project.width} height={project.height} fill="url(#craft-grid)" rx="16" opacity="0.85" />

            {ref && !ref.onTop && referenceNode}

            {/* Isolated so blend modes mix only between paper layers, never with the notepad backing */}
            <g style={{ isolation: 'isolate' }}>
              {renderLayerOrder.map((layer) => (
                <LayerMarkup
                  key={layer.id}
                  layer={layer}
                  shadow={shadow}
                  transform={selectedSet.has(layer.id) ? previewTransform : undefined}
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
              <g mask={`url(#cv_${activeLayer.id}_mask)`}>
                <path
                  ref={previewRef}
                  fill="none"
                  stroke={brushSettings.drawColor || '#161B29'}
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
              <path
                ref={previewRef}
                fill={
                  brushSettings.mode === 'erase'
                    ? '#EB8E88'
                    : brushSettings.mode === 'cutout'
                    ? '#FAF8F2'
                    : activeLayer?.color || '#2652D0'
                }
                fillOpacity={brushSettings.mode === 'erase' ? 0.3 : 0.88}
                stroke={brushSettings.mode === 'cutout' ? '#2652D0' : '#EB8E88'}
                strokeWidth={2 / zoom}
                strokeDasharray={brushSettings.mode === 'erase' ? '3 3' : brushSettings.mode === 'cutout' ? '4 3' : undefined}
                opacity={0.88}
              />
            )}

            {/* Polyline in progress */}
            {polylinePoints.length > 0 && (
              <polyline
                points={polylinePoints.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke="#2652D0"
                strokeWidth={2 / zoom}
                strokeDasharray="4 3"
                pointerEvents="none"
              />
            )}

            {/* Select tool: bounding box + scale/rotate handles */}
            {currentTool === 'select' && liveBox && (
              <g>
                <rect
                  x={liveBox.x}
                  y={liveBox.y}
                  width={liveBox.width}
                  height={liveBox.height}
                  fill="none"
                  stroke="#2652D0"
                  strokeWidth={1.5 * hs}
                  strokeDasharray={selectedItem ? undefined : `${6 * hs} ${4 * hs}`}
                  pointerEvents="none"
                />
                {!isSelectDragging && (
                  <>
                    <line
                      x1={liveBox.x + liveBox.width / 2}
                      y1={liveBox.y}
                      x2={liveBox.x + liveBox.width / 2}
                      y2={liveBox.y - 26 * hs}
                      stroke="#2652D0"
                      strokeWidth={1.2 * hs}
                      pointerEvents="none"
                    />
                    <circle
                      data-handle="rotate"
                      pointerEvents="all"
                      cx={liveBox.x + liveBox.width / 2}
                      cy={liveBox.y - 26 * hs}
                      r={6 * hs}
                      fill="#FBFBFC"
                      stroke="#2652D0"
                      strokeWidth={2 * hs}
                      className="cursor-grab"
                    />
                    {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
                      <rect
                        key={corner}
                        data-handle={`scale-${corner}`}
                        pointerEvents="all"
                        x={(corner.includes('w') ? liveBox.x : liveBox.x + liveBox.width) - 5 * hs}
                        y={(corner.includes('n') ? liveBox.y : liveBox.y + liveBox.height) - 5 * hs}
                        width={10 * hs}
                        height={10 * hs}
                        fill="#FBFBFC"
                        stroke="#2652D0"
                        strokeWidth={2 * hs}
                        className={corner === 'nw' || corner === 'se' ? 'cursor-nwse-resize' : 'cursor-nesw-resize'}
                      />
                    ))}
                  </>
                )}
              </g>
            )}

            {/* Item pivot & sockets */}
            {currentTool === 'select' && selectedItem && itemPivot && (
              <g>
                {selectedItem.sockets.map((s) => {
                  const pos =
                    dragRef.current?.drag.kind === 'socket' &&
                    (dragRef.current.drag as { socketId: string }).socketId === s.id &&
                    dragPoint
                      ? dragPoint
                      : applyToPoint(previewMatrix, s);
                  return (
                    <g key={s.id} data-handle={`socket:${s.id}`} pointerEvents="all" className="cursor-move">
                      <path
                        d={`M ${pos.x} ${pos.y - 7 * hs} L ${pos.x + 7 * hs} ${pos.y} L ${pos.x} ${pos.y + 7 * hs} L ${pos.x - 7 * hs} ${pos.y} Z`}
                        fill="#EB8E88"
                        stroke="#FBFBFC"
                        strokeWidth={1.5 * hs}
                      />
                      <text
                        x={pos.x + 10 * hs}
                        y={pos.y + 4 * hs}
                        fontSize={11 * hs}
                        fill="#482A45"
                        fontWeight={600}
                        style={{ paintOrder: 'stroke', stroke: '#FBFBFC', strokeWidth: 3 * hs }}
                      >
                        {s.name}
                      </text>
                    </g>
                  );
                })}
                <g data-handle="pivot" pointerEvents="all" className="cursor-move">
                  <circle cx={itemPivot.x} cy={itemPivot.y} r={9 * hs} fill="#FBFBFC" fillOpacity={0.85} stroke="#D23838" strokeWidth={2 * hs} />
                  <path
                    d={`M ${itemPivot.x - 13 * hs} ${itemPivot.y} H ${itemPivot.x + 13 * hs} M ${itemPivot.x} ${itemPivot.y - 13 * hs} V ${itemPivot.y + 13 * hs}`}
                    stroke="#D23838"
                    strokeWidth={1.5 * hs}
                  />
                </g>
              </g>
            )}

            {/* Interactive Anchor Points Handles (when in anchor_edit mode) */}
            {currentTool === 'anchor_edit' && editableAnchors.length > 0 && (
              <g className="cursor-move">
                {editableAnchors.map((pt, idx) => {
                  const isAnchorActive = activeAnchorIndex === idx;
                  return (
                    <g
                      key={`anchor_${idx}`}
                      pointerEvents="all"
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
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isAnchorActive ? 8 / zoom : 6 / zoom}
                        fill={isAnchorActive ? '#2652D0' : '#FFFFFF'}
                        stroke="#2652D0"
                        strokeWidth={2.5 / zoom}
                      />
                      <circle cx={pt.x} cy={pt.y} r={2.5 / zoom} fill={isAnchorActive ? '#FFFFFF' : '#2652D0'} />
                    </g>
                  );
                })}
              </g>
            )}
            {/* Brush size ring following the pointer */}
            <g ref={brushRef} data-radius={brushRadius} visibility="hidden" pointerEvents="none">
              <circle r={Math.max(brushRadius, 1.5)} fill="none" stroke="#FBFBFC" strokeWidth={2.5 / zoom} opacity={0.9} />
              <circle r={Math.max(brushRadius, 1.5)} fill="none" stroke="#1B2352" strokeWidth={1 / zoom} />
            </g>
          </svg>
        </div>
      </div>

      {/* HUD: 当前图层 / 物件 / 模式，永远知道笔落在哪 */}
      <div className="absolute top-3 left-3 z-20 pointer-events-none flex flex-col gap-1.5 max-w-[60%]">
        {currentTool === 'select' ? (
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[#161B29]/92 border border-[#2B364D] text-[11px] text-[#CAD0DB] shadow-lg backdrop-blur-md">
            <span className="text-[#8E9FCA]">选择</span>
            <span className="text-[#FBFBFC] font-medium">
              {selectedLayerIds.length === 0
                ? '点击画布上的纸片'
                : selectedItem
                ? `物件「${selectedItem.name}」· ${selectedItem.partIds.length} 个部件`
                : `${selectedLayerIds.length} 个部件`}
            </span>
            <span className="text-[#5E6E94]">
              {selectionScope === 'item' ? '整物件选取' : '单部件选取'}
            </span>
          </div>
        ) : activeLayer ? (
          <div
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[#161B29]/92 border text-[11px] text-[#CAD0DB] shadow-lg backdrop-blur-md ${
              activeLocked || activeHidden ? 'border-[#D23838]/70' : 'border-[#2B364D]'
            }`}
          >
            <span className="w-3 h-3 rounded-sm border border-white/40 shrink-0" style={{ backgroundColor: activeLayer.color }} />
            <span className="text-[#FBFBFC] font-medium truncate">{activeLayer.name}</span>
            {activeGroup && <span className="text-[#7E8FB8] truncate">· {activeGroup.name}</span>}
            {activeItem && (
              <span className="flex items-center gap-1 text-[#EB8E88] truncate">
                <Box className="w-3 h-3" />
                {activeItem.name}
              </span>
            )}
            {currentTool !== 'hand_draw' && currentTool !== 'anchor_edit' && (
              <span className="px-1.5 py-0.5 rounded-md bg-[#2652D0]/25 text-[#BAC5EB]">
                {MODE_LABELS[brushSettings.mode] || '刻纸'}
              </span>
            )}
            {activeLocked && (
              <span className="flex items-center gap-1 text-[#EB8E88]">
                <Lock className="w-3 h-3" />已锁定
              </span>
            )}
            {activeHidden && (
              <span className="flex items-center gap-1 text-[#EB8E88]">
                <EyeOff className="w-3 h-3" />已隐藏
              </span>
            )}
          </div>
        ) : (
          <div className="px-2.5 py-1.5 rounded-xl bg-[#161B29]/92 border border-[#D23838]/70 text-[11px] text-[#EB8E88]">
            没有选中图层：在右侧选择，或按住 Alt 点击画布上的纸片
          </div>
        )}
      </div>

      {/* Floating Check and Cross for Anchor Edit */}
      {currentTool === 'anchor_edit' && onExitAnchorEdit && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-[#161B29]/95 backdrop-blur-md px-2 py-1.5 rounded-2xl border border-[#2652D0] shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <button
            onClick={onExitAnchorEdit}
            className="w-8 h-8 rounded-xl bg-[#2652D0] hover:bg-[#1E43B8] text-white flex items-center justify-center shadow-md transition-all hover:scale-105 cursor-pointer"
            title="完成并退出锚点微调"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
          </button>
          <button
            onClick={onExitAnchorEdit}
            className="w-8 h-8 rounded-xl bg-[#1E2538] hover:bg-[#28324A] text-[#8E9FCA] hover:text-white flex items-center justify-center transition-all hover:scale-105 cursor-pointer"
            title="退出锚点微调"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      )}
    </div>
  );
};
