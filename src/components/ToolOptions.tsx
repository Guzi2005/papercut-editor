/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  ToolType,
  BrushSettings,
  GeomShapeType,
  KnifeTipShape,
  DrawBrushType,
  PencilHardness,
} from '../types/papercut';
import {
  Square,
  Circle,
  Triangle,
  Star,
  Diamond,
  Pencil,
  PenLine,
  SprayCan,
  Feather,
  Activity,
  Box,
  MousePointerClick,
  Group,
  Waves,
  Droplet,
  Sparkles,
  Pentagon,
  Minus,
  CornerDownRight,
  Spline,
  Link2,
  Lasso,
  PaintBucket,
  Unlink2,
} from 'lucide-react';
import { playCrispClick } from '../utils/soundEffects';
import { WheelNumber } from './WheelNumber';
import { DEFAULT_STROKE, PathCap } from '../utils/strokePath';
import { DEFAULT_SYMMETRY, SymmetryKind } from '../utils/symmetry';

const SymGlyph: React.FC<{ kind: SymmetryKind }> = ({ kind }) => (
  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round">
    {kind === 'none' && <path d="M3 12 L7 4 L7 12 Z" />}
    {kind === 'mirror' && (
      <>
        <path d="M2 12 L7 4 L7 12 Z" />
        <path d="M14 12 L9 4 L9 12 Z" />
        <path d="M8 1 V15" fill="none" strokeDasharray="1.5 1.5" />
      </>
    )}
    {kind === 'rotate' && (
      <>
        <path d="M8 8 L8 1.5 L12 5 Z" />
        <path d="M8 8 L14.5 8 L11 12 Z" />
        <path d="M8 8 L8 14.5 L4 11 Z" />
        <path d="M8 8 L1.5 8 L5 4 Z" />
      </>
    )}
  </svg>
);

interface ToolOptionsProps {
  currentTool: ToolType;
  brushSettings: BrushSettings;
  onChangeBrushSettings: (newSettings: Partial<BrushSettings>) => void;
  onSelectTool?: (tool: ToolType) => void;
  selectionScope: 'part' | 'item' | 'color';
  onChangeSelectionScope: (scope: 'part' | 'item' | 'color') => void;
  selectedCount: number;
  onCreateItemFromSelection: () => void;
  canvasWidth: number;
  canvasHeight: number;
}

export const Glyph: React.FC<{ d: string; fill?: boolean }> = ({ d, fill }) => (
  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

export const KNIFE_TIPS: { id: KnifeTipShape; tip: string; icon: React.ReactNode }[] = [
  { id: 'round', tip: '圆刃：等宽圆头', icon: <Glyph d="M8 3a5 5 0 1 1 0 10A5 5 0 0 1 8 3z" fill /> },
  { id: 'flat', tip: '平刃：水平刀口，横细竖粗', icon: <Glyph d="M2 7h12v2H2z" fill /> },
  { id: 'chisel', tip: '斜刃：45° 斜刀口', icon: <Glyph d="M3.5 13.9 2.1 12.5 12.5 2.1l1.4 1.4z" fill /> },
  { id: 'slash', tip: '柳刃：两端收尖', icon: <Glyph d="M3 13Q4 4 13 3Q12 12 3 13z" fill /> },
];

export const DRAW_BRUSHES: { id: DrawBrushType; tip: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'pencil', tip: '铅笔', icon: Pencil },
  { id: 'pen', tip: '钢笔', icon: PenLine },
  { id: 'airbrush', tip: '喷枪', icon: SprayCan },
  { id: 'willow', tip: '柳叶笔：按运笔弧度填出叶形色块', icon: Feather },
];

export const GEOM_SHAPES: { id: GeomShapeType; tip: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'rect', tip: '矩形', icon: Square },
  { id: 'circle', tip: '圆形', icon: Circle },
  { id: 'triangle', tip: '三角形', icon: Triangle },
  { id: 'diamond', tip: '菱形', icon: Diamond },
  { id: 'star', tip: '星形', icon: Star },
  { id: 'polyline', tip: '不规则多边形：单击加点，双击闭合', icon: Pentagon },
  { id: 'path', tip: '折线：单击加点，双击或回车结束，Backspace 撤一点', icon: Activity },
];

export const PATH_CAPS: { id: PathCap; tip: string; icon: React.ReactNode }[] = [
  { id: 'round', tip: '两端圆头', icon: <Glyph d="M5 5h6a3 3 0 0 1 0 6H5a3 3 0 0 1 0-6z" fill /> },
  { id: 'butt', tip: '两端平头', icon: <Glyph d="M2 5h12v6H2z" fill /> },
  { id: 'square', tip: '两端方头（延出半个宽度）', icon: <Glyph d="M1 5h14v6H1z M3 8h10" /> },
  { id: 'taper', tip: '两端尖头', icon: <Glyph d="M1 8Q8 3 15 8Q8 13 1 8z" fill /> },
];

const HARDNESS_NAMES = ['极软', '软', '中', '硬', '极硬'];

const Segmented: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-center bg-(--ui-raised) rounded-lg p-0.5 border border-(--ui-border) gap-0.5">{children}</div>
);

const IconButton: React.FC<{
  active?: boolean;
  tip: string;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  children: React.ReactNode;
}> = ({ active, tip, onClick, onContextMenu, disabled, children }) => (
  <button
    onClick={onClick}
    onContextMenu={onContextMenu}
    disabled={disabled}
    data-tip={tip}
    className={`w-7 h-6 pointer-coarse:w-9 pointer-coarse:h-8 flex items-center justify-center rounded-md transition-colors disabled:opacity-35 ${
      active ? 'bg-(--ui-accent) text-white' : 'text-(--ui-muted) hover:bg-(--ui-hover) hover:text-(--ui-strong)'
    }`}
  >
    {children}
  </button>
);

export const ToolOptions: React.FC<ToolOptionsProps> = ({
  currentTool,
  brushSettings,
  onChangeBrushSettings,
  selectionScope,
  onChangeSelectionScope,
  selectedCount,
  onCreateItemFromSelection,
  canvasWidth,
  canvasHeight,
}) => {
  const [showSym, setShowSym] = useState(false);
  const symRef = useRef<HTMLDivElement>(null);
  const sym = brushSettings.symmetry ?? DEFAULT_SYMMETRY;
  const setSym = (patch: Partial<typeof sym>) => onChangeBrushSettings({ symmetry: { ...sym, ...patch } });

  useEffect(() => {
    if (!showSym) return;
    const close = (e: PointerEvent) => {
      if (!symRef.current?.contains(e.target as Node)) setShowSym(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [showSym]);
  const set = onChangeBrushSettings;
  const carving = ['willow_leaf', 'geom_shape', 'pen_knife', 'freehand'].includes(currentTool);


  const willowOptions = (
    <>
      <Segmented>
        <IconButton active={(brushSettings.willowMode || 'chord') === 'chord'} tip="单弧成叶" onClick={() => set({ willowMode: 'chord' })}>
          <Glyph d="M2 12Q8 1 14 12z" />
        </IconButton>
        <IconButton active={brushSettings.willowMode === 'symmetric'} tip="对称双弧" onClick={() => set({ willowMode: 'symmetric' })}>
          <Glyph d="M2 8Q8 1 14 8Q8 15 2 8z" />
        </IconButton>
      </Segmented>
      <WheelNumber
        tip="防抖（牵绳长度，越大越稳）"
        icon={<Waves className="w-3 h-3" />}
        value={Math.round((brushSettings.stabilizer ?? 0.55) * 100)}
        min={0}
        max={90}
        step={5}
        format={(v) => `${v}%`}
        onChange={(v) => set({ stabilizer: v / 100 })}
      />
    </>
  );

  return (
    <div className="relative z-30 h-10 pointer-coarse:h-12 px-3 bg-(--ui-panel-2) border-b border-(--ui-divider) text-(--ui-text-2) flex items-center gap-2 text-xs select-none shrink-0">
      {currentTool === 'select' && (
        <>
          <Segmented>
            <IconButton active={selectionScope === 'item'} tip="整物件选取 (Tab)" onClick={() => onChangeSelectionScope('item')}>
              <Box className="w-3.5 h-3.5" />
            </IconButton>
            <IconButton active={selectionScope === 'part'} tip="单部件选取 (Tab)" onClick={() => onChangeSelectionScope('part')}>
              <MousePointerClick className="w-3.5 h-3.5" />
            </IconButton>
            <IconButton active={selectionScope === 'color'} tip="色块选取 (Tab) · Shift 加选，双击选同色" onClick={() => onChangeSelectionScope('color')}>
              <PaintBucket className="w-3.5 h-3.5" />
            </IconButton>
          </Segmented>
          <IconButton
            active={!!brushSettings.selectLasso}
            tip={brushSettings.selectLasso ? '圈选：拖动圈画选中（Shift 加选）' : '点选：单击选中，空白处拖动圈选'}
            onClick={() => set({ selectLasso: !brushSettings.selectLasso })}
          >
            <Lasso className="w-3.5 h-3.5" />
          </IconButton>
          <IconButton tip="把选中纸片打组为物件" onClick={onCreateItemFromSelection} disabled={selectedCount === 0}>
            <Group className="w-3.5 h-3.5" />
          </IconButton>
          <IconButton
            active={brushSettings.lockAspect ?? true}
            tip={`${brushSettings.lockAspect ?? true ? '已锁定长宽比' : '长宽比未锁定'} · 按住 Shift 临时切换，按住 Ctrl 拖角/边自由变形`}
            onClick={() => set({ lockAspect: !(brushSettings.lockAspect ?? true) })}
          >
            {brushSettings.lockAspect ?? true ? <Link2 className="w-3.5 h-3.5" /> : <Unlink2 className="w-3.5 h-3.5" />}
          </IconButton>
        </>
      )}

      {currentTool === 'willow_leaf' && willowOptions}

      {currentTool === 'geom_shape' && (
        <div className="flex items-center gap-2">
          <Segmented>
            {GEOM_SHAPES.map((g) => (
              <IconButton
                key={g.id}
                active={(brushSettings.geomShapeType || 'rect') === g.id}
                tip={g.tip}
                onClick={() => {
                  playCrispClick();
                  set({ geomShapeType: g.id });
                }}
              >
                <g.icon className="w-3.5 h-3.5" />
              </IconButton>
            ))}
          </Segmented>
          {brushSettings.geomShapeType === 'star' && (
            <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-left-2 duration-150">
              <WheelNumber tip="角数" icon={<Star className="w-3 h-3" />} value={brushSettings.starPoints ?? 5} min={3} max={16} onChange={(v) => set({ starPoints: v })} />
              <WheelNumber tip="圆角" icon={<Circle className="w-3 h-3" />} value={brushSettings.starRoundness ?? 0} min={0} max={25} onChange={(v) => set({ starRoundness: v })} />
              <WheelNumber tip="不规则" icon={<Sparkles className="w-3 h-3" />} value={brushSettings.starIrregularity ?? 0} min={0} max={100} step={5} format={(v) => `${v}%`} onChange={(v) => set({ starIrregularity: v })} />
            </div>
          )}
          {brushSettings.geomShapeType === 'path' && (
            <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-left-2 duration-150">
              <WheelNumber tip="宽度" icon={<Minus className="w-3 h-3" />} value={brushSettings.pathWidth ?? DEFAULT_STROKE.width} min={1} max={120} onChange={(v) => set({ pathWidth: v })} />
              <WheelNumber
                tip="折角圆度"
                icon={<CornerDownRight className="w-3 h-3" />}
                value={Math.round((brushSettings.pathRound ?? DEFAULT_STROKE.round) * 100)}
                min={0}
                max={100}
                step={5}
                format={(v) => `${v}%`}
                onChange={(v) => set({ pathRound: v / 100 })}
              />
              <Segmented>
                {PATH_CAPS.map((c) => (
                  <IconButton key={c.id} active={(brushSettings.pathCap ?? DEFAULT_STROKE.cap) === c.id} tip={c.tip} onClick={() => set({ pathCap: c.id })}>
                    {c.icon}
                  </IconButton>
                ))}
              </Segmented>
              <IconButton
                active={!!brushSettings.pathCurve}
                tip={brushSettings.pathCurve ? '曲线：锚点平滑穿过（锚点微调里双击单个锚点可切换）' : '尖角：锚点处折转（锚点微调里双击单个锚点可切换）'}
                onClick={() => set({ pathCurve: !brushSettings.pathCurve })}
              >
                <Spline className="w-3.5 h-3.5" />
              </IconButton>
            </div>
          )}
        </div>
      )}

      {(currentTool === 'pen_knife' || currentTool === 'freehand') && (
        <>
          <Segmented>
            {KNIFE_TIPS.map((t) => (
              <IconButton key={t.id} active={(brushSettings.knifeTipShape || 'round') === t.id} tip={t.tip} onClick={() => set({ knifeTipShape: t.id })}>
                {t.icon}
              </IconButton>
            ))}
          </Segmented>
          <WheelNumber tip="画笔大小 ( [ / ] )" icon={<Circle className="w-3 h-3" />} value={brushSettings.stampSize || 26} min={4} max={120} onChange={(v) => set({ stampSize: v })} />
        </>
      )}

      {currentTool === 'hand_draw' && (
        <>
          <Segmented>
            {DRAW_BRUSHES.map((b) => (
              <IconButton key={b.id} active={(brushSettings.drawBrushType || 'pencil') === b.id} tip={b.tip} onClick={() => set({ drawBrushType: b.id })}>
                <b.icon className="w-3.5 h-3.5" />
              </IconButton>
            ))}
          </Segmented>
          {brushSettings.drawBrushType === 'willow' ? (
            willowOptions
          ) : (
            <WheelNumber tip="画笔大小 ( [ / ] )" icon={<Circle className="w-3 h-3" />} value={brushSettings.drawSize ?? 6} min={1} max={120} onChange={(v) => set({ drawSize: v })} />
          )}
          <WheelNumber
            tip="不透明度"
            icon={<Droplet className="w-3 h-3" />}
            value={Math.round((brushSettings.drawOpacity ?? 0.85) * 100)}
            min={5}
            max={100}
            step={5}
            format={(v) => `${v}%`}
            onChange={(v) => set({ drawOpacity: v / 100 })}
          />
          {(brushSettings.drawBrushType || 'pencil') === 'pencil' && (
            <WheelNumber
              tip="铅笔软硬"
              icon={<span className="text-[10px] font-semibold">H</span>}
              value={brushSettings.pencilHardness || 3}
              min={1}
              max={5}
              format={(v) => HARDNESS_NAMES[v - 1]}
              onChange={(v) => set({ pencilHardness: v as PencilHardness })}
            />
          )}
          {brushSettings.drawBrushType === 'airbrush' && (
            <WheelNumber tip="晕染" icon={<SprayCan className="w-3 h-3" />} value={brushSettings.airbrushSoftness || 12} min={2} max={40} onChange={(v) => set({ airbrushSoftness: v })} />
          )}
        </>
      )}
      {(carving || currentTool === 'hand_draw') && (
        <div className="relative ml-auto" ref={symRef}>
          <IconButton
            active={sym.kind !== 'none'}
            tip={sym.kind === 'none' ? '对称：关' : sym.kind === 'mirror' ? `轴对称 · ${sym.count} 条轴` : `中心对称 · ${sym.count} 份`}
            onClick={() => setShowSym((v) => !v)}
          >
            <SymGlyph kind={sym.kind} />
          </IconButton>
          {showSym && (
            <div className="absolute top-full right-0 mt-2 z-50 p-2 rounded-xl bg-(--ui-panel) border border-(--ui-border-strong) shadow-2xl flex flex-col gap-2">
              <Segmented>
                {(
                  [
                    { id: 'none', tip: '关闭对称' },
                    { id: 'mirror', tip: '轴对称（镜像）' },
                    { id: 'rotate', tip: '中心对称（旋转）' },
                  ] as const
                ).map((k) => (
                  <IconButton
                    key={k.id}
                    active={sym.kind === k.id}
                    tip={k.tip}
                    onClick={() =>
                      setSym({
                        kind: k.id,
                        count: k.id === 'rotate' ? Math.max(2, sym.count) : k.id === 'mirror' ? Math.min(sym.count, 12) : sym.count,
                      })
                    }
                  >
                    <SymGlyph kind={k.id} />
                  </IconButton>
                ))}
              </Segmented>
              {sym.kind !== 'none' && (
                <div className="grid grid-cols-2 gap-1.5">
                  <WheelNumber
                    tip={sym.kind === 'mirror' ? '对称轴数量' : '旋转份数'}
                    icon={<span className="text-[10px]">×</span>}
                    value={sym.count}
                    min={sym.kind === 'mirror' ? 1 : 2}
                    max={sym.kind === 'mirror' ? 12 : 24}
                    onChange={(v) => setSym({ count: v })}
                  />
                  <WheelNumber
                    tip={sym.kind === 'mirror' ? '轴角度（90° 为竖直）' : '起始角度'}
                    icon={<span className="text-[10px]">∠</span>}
                    value={sym.angle}
                    min={0}
                    max={179}
                    step={sym.kind === 'mirror' ? 15 : 5}
                    format={(v) => `${v}°`}
                    onChange={(v) => setSym({ angle: v })}
                  />
                  <WheelNumber
                    tip="中心 X（也可在画布上拖动中心点）"
                    icon={<span className="text-[10px]">X</span>}
                    value={Math.round(sym.cx ?? canvasWidth / 2)}
                    min={0}
                    max={canvasWidth}
                    step={10}
                    onChange={(v) => setSym({ cx: v })}
                  />
                  <WheelNumber
                    tip="中心 Y（也可在画布上拖动中心点）"
                    icon={<span className="text-[10px]">Y</span>}
                    value={Math.round(sym.cy ?? canvasHeight / 2)}
                    min={0}
                    max={canvasHeight}
                    step={10}
                    onChange={(v) => setSym({ cy: v })}
                  />
                  <button
                    onClick={() => setSym({ cx: undefined, cy: undefined })}
                    data-tip="中心回到画布正中"
                    className="col-span-2 h-7 rounded-lg bg-(--ui-raised) border border-(--ui-border) text-(--ui-muted) hover:text-(--ui-strong) text-[11px]"
                  >
                    居中
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
