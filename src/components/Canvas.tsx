/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  PapercutProject,
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
import { Check, X } from 'lucide-react';

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

  // Polyline shape drawing state (单击新增锚点，双击终止)
  const [polylinePoints, setPolylinePoints] = useState<Point[]>([]);
  const [hoverCanvasPoint, setHoverCanvasPoint] = useState<Point | null>(null);
  const [lastClickTime, setLastClickTime] = useState<number>(0);

  // Anchor Edit Tool State
  const [selectedCutoutId, setSelectedCutoutId] = useState<string | null>(null);
  const [activeAnchorIndex, setActiveAnchorIndex] = useState<number | null>(null);
  const [editableAnchors, setEditableAnchors] = useState<Point[]>([]);
  const [hasDraggedAnchor, setHasDraggedAnchor] = useState(false);
  const [isDraggingAnchor, setIsDraggingAnchor] = useState(false);

  // Active layer
  const activeLayer = activeLayerId ? project.layers[activeLayerId] : null;

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

  // Transform client screen coordinates to Canvas coordinate system
  const clientToCanvas = useCallback(
    (clientX: number, clientY: number): Point => {
      if (!svgRef.current) return { x: 0, y: 0 };
      const rect = svgRef.current.getBoundingClientRect();
      const scaleX = project.width / rect.width;
      const scaleY = project.height / rect.height;

      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    },
    [project.width, project.height]
  );

  // Wheel zoom around cursor
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey || isSpacePressed) {
      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
      const newZoom = Math.min(Math.max(zoom * zoomFactor, 0.25), 3.5);

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

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

  const getEventPressure = (
    e: React.MouseEvent | MouseEvent | React.PointerEvent | PointerEvent
  ): number => {
    if ('pressure' in e && typeof e.pressure === 'number' && e.pressure > 0) {
      return e.pressure;
    }
    return 0.5;
  };

  // Mouse / Pointer Down handler
  const handleMouseDown = (e: React.MouseEvent | React.PointerEvent) => {
    if (e.button === 1 || isSpacePressed) {
      setIsPanning(true);
      setPanStart({
        x: e.clientX - pan.x,
        y: e.clientY - pan.y,
      });
      return;
    }

    if (e.button !== 0) return;
    const pt = clientToCanvas(e.clientX, e.clientY);
    pt.pressure = getEventPressure(e);

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
      if (!activeLayer || activeLayer.locked || !activeLayer.visible) return;

      const now = Date.now();
      // If clicking near first point or rapid double click
      if (
        polylinePoints.length >= 3 &&
        Math.hypot(pt.x - polylinePoints[0].x, pt.y - polylinePoints[0].y) < 20 / zoom
      ) {
        const d = `M ${polylinePoints.map((p) => `${f(p.x)} ${f(p.y)}`).join(' L ')} Z`;
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
          points: polylinePoints,
        };
        onAddCutout(newCutout);
        playPaperRustle();
        setPolylinePoints([]);
        return;
      }

      if (now - lastClickTime < 320 && polylinePoints.length >= 2) {
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
    setIsDrawing(true);
    setStartPoint(pt);
    setCurrentPoint(pt);
    setStrokePoints([pt]);
  };

  // Global mouse move & up listeners
  useEffect(() => {
    if (!isDrawing && !isPanning && activeAnchorIndex === null) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      if (isPanning) {
        setPan({
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y,
        });
        return;
      }

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
      setCurrentPoint(pt);

      if (
        currentTool === 'willow_leaf' ||
        currentTool === 'pen_knife' ||
        currentTool === 'freehand' ||
        currentTool === 'hand_draw'
      ) {
        setStrokePoints((prev) => [...prev, pt]);
      }
    };

    const handleWindowMouseUp = () => {
      if (isPanning) {
        setIsPanning(false);
        return;
      }

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

      // 1. Hand Draw Tool (手绘：铅笔/钢笔/喷枪，附属于当前图层蒙版)
      if (currentTool === 'hand_draw') {
        if (activeLayer && !activeLayer.locked && activeLayer.visible && strokePoints.length >= 2) {
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
      if (brushSettings.mode === 'erase' && activeLayer && !activeLayer.locked && activeLayer.visible) {
        if (brushSettings.eraseMode === 'willow') {
          // 柳叶笔橡皮：以柳叶笔划痕作为镂空割除
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
          // 智能橡皮：触碰切口直接消除
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
      } else if (baseD && activeLayer && !activeLayer.locked && activeLayer.visible) {
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

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    window.addEventListener('pointermove', handleWindowMouseMove);
    window.addEventListener('pointerup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
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
    activeLayer,
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

  // Generate live preview path while drawing
  const getLivePreviewPath = (): string => {
    if (!isDrawing || !startPoint || !currentPoint) return '';

    if (currentTool === 'willow_leaf') {
      if (strokePoints.length < 2) return '';
      return generateRealtimeWillowLeaf(
        strokePoints,
        brushSettings.willowMode || 'chord',
        brushSettings.stabilizer ?? 0.55,
        brushSettings.simplifyTolerance ?? 4.5
      );
    } else if (currentTool === 'geom_shape') {
      const dist = Math.hypot(currentPoint.x - startPoint.x, currentPoint.y - startPoint.y);
      const p1 = dist < 8 ? { x: startPoint.x - 40, y: startPoint.y - 40 } : startPoint;
      const p2 = dist < 8 ? { x: startPoint.x + 40, y: startPoint.y + 40 } : currentPoint;
      const geom = generateGeomShape(brushSettings.geomShapeType || 'rect', p1, p2);
      return geom.d;
    } else if (currentTool === 'pen_knife' || currentTool === 'freehand') {
      if (strokePoints.length >= 2) {
        return generateFreehandKnifePath(
          strokePoints,
          brushSettings.stampSize || 26,
          brushSettings.knifeTipShape || 'round',
          brushSettings.knifePressure ?? false
        );
      }
    } else if (currentTool === 'hand_draw') {
      if (strokePoints.length >= 2) {
        return generateFreehandDrawPath(strokePoints);
      }
    }
    return '';
  };

  const previewD = getLivePreviewPath();

  // Compile layers in drawing order (bottom to top)
  const renderLayerOrder: Layer[] = [];
  project.rootOrder.forEach((item) => {
    if (item.type === 'group') {
      const grp = project.groups.find((g) => g.id === item.id);
      if (grp && grp.visible) {
        grp.layerIds.forEach((lid) => {
          const lyr = project.layers[lid];
          if (lyr && lyr.visible) renderLayerOrder.push(lyr);
        });
      }
    } else {
      const lyr = project.layers[item.id];
      if (lyr && lyr.visible) renderLayerOrder.push(lyr);
    }
  });

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onPointerDown={handleMouseDown}
      onWheel={handleWheel}
      style={{ touchAction: 'none' }}
      className={`flex-1 relative overflow-hidden select-none bg-[#111520] cursor-${
        isDraggingAnchor
          ? 'grabbing'
          : isSpacePressed || isPanning
          ? 'grab'
          : currentTool === 'anchor_edit'
          ? 'default'
          : 'crosshair'
      }`}
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

      {/* SVG Canvas Container with craft framing */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px)`,
          transition: isPanning ? 'none' : 'transform 0.05s ease-out',
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
              {/* Paper Drop Shadow for authentic layered craft relief */}
              <filter id="paper-drop-shadow" x="-10%" y="-10%" width="130%" height="130%">
                <feDropShadow
                  dx="2"
                  dy="3.5"
                  stdDeviation="3"
                  floodColor="#0E1320"
                  floodOpacity="0.35"
                />
              </filter>

              {/* Grid pattern for the craft tablet inside */}
              <pattern id="craft-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#E2E7F3" strokeWidth="0.8" />
              </pattern>

              {/* Clipping Masks for Each Layer (绘制内容附属于目前的剪纸图层，不会画到剪纸图层外面，镂空处亦受剪纸保护) */}
              {renderLayerOrder.map((layer) => {
                const holePaths = layer.cutouts.filter((c) => c.isHole).map((c) => c.d);
                const compoundD = [layer.baseShape?.d, ...holePaths].filter(Boolean).join(' ');
                return (
                  <clipPath id={`layer_clip_${layer.id}`} key={`clip_${layer.id}`}>
                    <path
                      d={compoundD || layer.baseShape?.d || ''}
                      clipRule="evenodd"
                    />
                  </clipPath>
                );
              })}
            </defs>

            {/* Underlay Notepad Backing */}
            <rect
              width={project.width}
              height={project.height}
              fill="#FAF8F2"
              rx="16"
              className="shadow-inner"
            />
            <rect
              width={project.width}
              height={project.height}
              fill="url(#craft-grid)"
              rx="16"
              opacity="0.85"
            />

            {/* Layer Stacks */}
            {renderLayerOrder.map((layer) => {
              const isCurrentLayer = layer.id === activeLayerId;
              const holePaths = layer.cutouts.filter((c) => c.isHole).map((c) => c.d);
              const positiveElements = layer.positiveElements.concat(
                layer.cutouts.filter((c) => !c.isHole)
              );

              // Paper base + hollow cutouts
              const compoundD = [layer.baseShape.d, ...holePaths].join(' ');

              return (
                <g
                  key={layer.id}
                  opacity={layer.opacity}
                  style={{ mixBlendMode: layer.blendMode }}
                  filter="url(#paper-drop-shadow)"
                >
                  {/* 1. Base Paper with Holes (fill-rule="evenodd" is the key to true hollow papercuts) */}
                  {layer.baseShape.d && (
                    <path
                      d={compoundD}
                      fill={layer.color}
                      fillRule="evenodd"
                      className="transition-colors duration-100"
                    />
                  )}

                  {/* 2. Positive Applique Cutouts (Additive paper pieces) */}
                  {positiveElements.map((elem) => (
                    <path
                      key={elem.id}
                      d={elem.d}
                      fill={elem.fillColor || layer.color}
                    />
                  ))}

                  {/* 3. Layer Hand Drawings (手绘：铅笔/钢笔/喷枪，严格受限于图层剪贴蒙版，绝不出界) */}
                  {layer.drawings && layer.drawings.length > 0 && (
                    <g clipPath={`url(#layer_clip_${layer.id})`}>
                      {layer.drawings.map((drw) => (
                        <path
                          key={drw.id}
                          d={drw.d}
                          fill="none"
                          stroke={drw.color}
                          strokeWidth={drw.strokeWidth}
                          strokeOpacity={drw.opacity}
                          strokeLinecap={drw.strokeLinecap || 'round'}
                          strokeLinejoin={drw.strokeLinejoin || 'round'}
                          style={{
                            filter: drw.blur ? `blur(${drw.blur}px)` : undefined,
                          }}
                        />
                      ))}
                    </g>
                  )}

                  {/* 4. Direct clickable hit area for cutouts when in anchor_edit mode */}
                  {isCurrentLayer && currentTool === 'anchor_edit' && (
                    <g>
                      {layer.cutouts.map((c) => {
                        const isSelected = selectedCutoutId === c.id;
                        return (
                          <g key={`hit_group_${c.id}`}>
                            <path
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
                          </g>
                        );
                      })}
                    </g>
                  )}
                </g>
              );
            })}

            {/* Real-time Hand Drawing Stroke Preview (Clipped by active layer mask) */}
            {isDrawing && currentTool === 'hand_draw' && activeLayer && previewD && (
              <g clipPath={`url(#layer_clip_${activeLayer.id})`}>
                <path
                  d={previewD}
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
            {isDrawing && currentTool !== 'hand_draw' && previewD && (
              <g>
                <path
                  d={previewD}
                  fill={
                    brushSettings.mode === 'erase'
                      ? '#EB8E88'
                      : brushSettings.mode === 'cutout'
                      ? '#FAF8F2'
                      : (activeLayer?.color || '#2652D0')
                  }
                  fillOpacity={brushSettings.mode === 'erase' ? 0.3 : 0.88}
                  stroke={
                    brushSettings.mode === 'erase'
                      ? '#EB8E88'
                      : brushSettings.mode === 'cutout'
                      ? '#2652D0'
                      : '#EB8E88'
                  }
                  strokeWidth={2 / zoom}
                  strokeDasharray={brushSettings.mode === 'erase' ? '3 3' : brushSettings.mode === 'cutout' ? '4 3' : undefined}
                  opacity={0.88}
                />
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
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={18 / zoom}
                        fill="transparent"
                        style={{ pointerEvents: 'all' }}
                        className="cursor-move"
                      />
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isAnchorActive ? 8 / zoom : 6 / zoom}
                        fill={isAnchorActive ? '#2652D0' : '#FFFFFF'}
                        stroke="#2652D0"
                        strokeWidth={2.5 / zoom}
                        className="transition-transform hover:scale-125 shadow-lg"
                      />
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={2.5 / zoom}
                        fill={isAnchorActive ? '#FFFFFF' : '#2652D0'}
                      />
                    </g>
                  );
                })}
              </g>
            )}
          </svg>
        </div>
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
