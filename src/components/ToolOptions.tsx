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
  Settings2,
  Box,
  MousePointerClick,
  Group,
  Waves,
  Droplet,
  Sparkles,
  Eraser,
} from 'lucide-react';
import { playCrispClick } from '../utils/soundEffects';
import { WheelNumber } from './WheelNumber';

interface ToolOptionsProps {
  currentTool: ToolType;
  brushSettings: BrushSettings;
  onChangeBrushSettings: (newSettings: Partial<BrushSettings>) => void;
  onSelectTool?: (tool: ToolType) => void;
  selectionScope: 'part' | 'item';
  onChangeSelectionScope: (scope: 'part' | 'item') => void;
  selectedCount: number;
  onCreateItemFromSelection: () => void;
}

const Glyph: React.FC<{ d: string; fill?: boolean }> = ({ d, fill }) => (
  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const KNIFE_TIPS: { id: KnifeTipShape; tip: string; icon: React.ReactNode }[] = [
  { id: 'round', tip: '圆刃：等宽圆头', icon: <Glyph d="M8 3a5 5 0 1 1 0 10A5 5 0 0 1 8 3z" fill /> },
  { id: 'flat', tip: '平刃：水平刀口，横细竖粗', icon: <Glyph d="M2 7h12v2H2z" fill /> },
  { id: 'chisel', tip: '斜刃：45° 斜刀口', icon: <Glyph d="M3.5 13.9 2.1 12.5 12.5 2.1l1.4 1.4z" fill /> },
  { id: 'slash', tip: '柳刃：两端收尖', icon: <Glyph d="M3 13Q4 4 13 3Q12 12 3 13z" fill /> },
];

const DRAW_BRUSHES: { id: DrawBrushType; tip: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'pencil', tip: '铅笔', icon: Pencil },
  { id: 'pen', tip: '钢笔', icon: PenLine },
  { id: 'airbrush', tip: '喷枪', icon: SprayCan },
  { id: 'willow', tip: '柳叶笔：按运笔弧度填出叶形色块', icon: Feather },
];

const GEOM_SHAPES: { id: GeomShapeType; tip: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'rect', tip: '矩形', icon: Square },
  { id: 'circle', tip: '圆形', icon: Circle },
  { id: 'triangle', tip: '三角形', icon: Triangle },
  { id: 'diamond', tip: '菱形', icon: Diamond },
  { id: 'star', tip: '星形 · 右键设置', icon: Star },
  { id: 'polyline', tip: '折线：单击加点，双击闭合', icon: Activity },
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
}) => {
  const [showStarSettings, setShowStarSettings] = useState(false);
  const starRef = useRef<HTMLDivElement>(null);
  const set = onChangeBrushSettings;
  const carving = ['willow_leaf', 'geom_shape', 'pen_knife', 'freehand'].includes(currentTool);

  useEffect(() => {
    if (!showStarSettings) return;
    const close = (e: PointerEvent) => {
      if (!starRef.current?.contains(e.target as Node)) setShowStarSettings(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [showStarSettings]);

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
        tip="防抖"
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
          </Segmented>
          <IconButton tip="把选中纸片打组为物件" onClick={onCreateItemFromSelection} disabled={selectedCount === 0}>
            <Group className="w-3.5 h-3.5" />
          </IconButton>
        </>
      )}

      {carving && brushSettings.mode === 'erase' && (
        <Segmented>
          <IconButton active={(brushSettings.eraseMode || 'smart') === 'smart'} tip="智能橡皮：轻触即删除整个切口" onClick={() => set({ eraseMode: 'smart' })}>
            <Eraser className="w-3.5 h-3.5" />
          </IconButton>
          <IconButton active={brushSettings.eraseMode === 'willow'} tip="剪纸橡皮：按叶形局部剪除" onClick={() => set({ eraseMode: 'willow' })}>
            <Feather className="w-3.5 h-3.5" />
          </IconButton>
        </Segmented>
      )}

      {currentTool === 'willow_leaf' && willowOptions}

      {currentTool === 'geom_shape' && (
        <div className="relative flex items-center gap-2" ref={starRef}>
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
                onContextMenu={(e) => {
                  if (g.id !== 'star') return;
                  e.preventDefault();
                  set({ geomShapeType: 'star' });
                  setShowStarSettings((v) => !v);
                }}
              >
                <g.icon className="w-3.5 h-3.5" />
              </IconButton>
            ))}
          </Segmented>
          {brushSettings.geomShapeType === 'star' && (
            <IconButton active={showStarSettings} tip="星形设置" onClick={() => setShowStarSettings((v) => !v)}>
              <Settings2 className="w-3.5 h-3.5" />
            </IconButton>
          )}
          {showStarSettings && (
            <div className="absolute top-full left-0 mt-2 z-50 p-2 rounded-xl bg-(--ui-panel) border border-(--ui-border-strong) shadow-2xl flex items-center gap-1.5">
              <WheelNumber tip="角数" icon={<Star className="w-3 h-3" />} value={brushSettings.starPoints ?? 5} min={3} max={16} onChange={(v) => set({ starPoints: v })} />
              <WheelNumber tip="圆角" icon={<Circle className="w-3 h-3" />} value={brushSettings.starRoundness ?? 0} min={0} max={25} onChange={(v) => set({ starRoundness: v })} />
              <WheelNumber tip="不规则" icon={<Sparkles className="w-3 h-3" />} value={brushSettings.starIrregularity ?? 0} min={0} max={100} step={5} format={(v) => `${v}%`} onChange={(v) => set({ starIrregularity: v })} />
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
    </div>
  );
};
