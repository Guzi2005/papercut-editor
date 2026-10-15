import { VectorModes, isVectorTool } from './VectorModes';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
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
  RotateCw,
  Lasso,
  PaintBucket,
  Unlink2,
  Ungroup,
  FlipHorizontal2,
  FlipVertical2,
  Scissors,
  Layers,
  Stamp,
} from 'lucide-react';
import { playCrispClick } from '../utils/soundEffects';
import { WheelNumber } from './WheelNumber';
import { DEFAULT_STROKE, PathCap } from '../utils/strokePath';
import { DEFAULT_SYMMETRY, SymmetryKind } from '../utils/symmetry';

export type WorkspaceMode = 'draw' | 'arrange' | 'assets';

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
  workspaceModesEnabled?: boolean;
  workspaceMode?: WorkspaceMode;
  onWorkspaceModeChange?: (mode: WorkspaceMode) => void;
  onGroupSelection?: () => void;
  onUngroupSelection?: () => void;
  onFlipSelection?: (direction: 'horizontal' | 'vertical') => void;
  onMirrorSelection?: () => void;
  onCreateAsset?: () => void;
  onOpenSymmetrySettings?: () => void;
  currentTool: ToolType;
  onOpenStamp?: () => void;
  onOpenMaterials?:()=>void;
  onCaptureStamp?:()=>void;
  canCaptureStamp?:boolean;
  brushSettings: BrushSettings;
  onChangeBrushSettings: (newSettings: Partial<BrushSettings>) => void;
  onSelectTool?: (tool: ToolType) => void;
  selectionScope: 'part' | 'item' | 'color' | 'group';
  onChangeSelectionScope: (scope: 'part' | 'item' | 'color' | 'group') => void;
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
  <div className="flex items-center gap-0.5 border-r border-(--ui-divider) pr-1 shrink-0">{children}</div>
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
    className={`w-7 h-7 pointer-coarse:w-9 pointer-coarse:h-8 flex items-center justify-center border-b-2 transition-colors disabled:opacity-35 ${
      active ? 'border-(--ui-accent) text-(--ui-accent)' : 'border-transparent text-(--ui-muted) hover:bg-(--ui-hover) hover:text-(--ui-strong)'
    }`}
  >
    {children}
  </button>
);

export const ToolOptions: React.FC<ToolOptionsProps> = ({
  workspaceModesEnabled = false,
  workspaceMode = 'draw',
  onWorkspaceModeChange,
  onGroupSelection,
  onUngroupSelection,
  onFlipSelection,
  onMirrorSelection,
  onCreateAsset,
  onOpenSymmetrySettings,
  currentTool,
  onOpenStamp, onOpenMaterials, onCaptureStamp, canCaptureStamp,
  onSelectTool,
  brushSettings,
  onChangeBrushSettings,
  selectionScope,
  onChangeSelectionScope,
  selectedCount,
  onCreateItemFromSelection,
}) => {
  const sym = brushSettings.symmetry ?? DEFAULT_SYMMETRY;
  const set = onChangeBrushSettings;
  const showDrawing = !workspaceModesEnabled || workspaceMode === 'draw';


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
      {workspaceModesEnabled && <div role="tablist" aria-label="工作模式" className="flex items-center shrink-0 h-full border-r border-(--ui-divider) pr-2 gap-1">
        {([['draw', '绘制'], ['arrange', '编排'], ['assets', '资产']] as const).map(([mode, label]) =>
          <button key={mode} type="button" role="tab" aria-selected={workspaceMode === mode}
            onClick={() => onWorkspaceModeChange?.(mode)}
            className={`h-full px-2 border-b-2 ${workspaceMode === mode ? 'border-(--ui-accent) text-(--ui-accent)' : 'border-transparent text-(--ui-muted) hover:text-(--ui-strong)'}`}>{label}</button>)}
      </div>}
      {showDrawing && currentTool === 'stamp' && <><button onClick={onOpenStamp} className="px-2 py-1 hover:bg-(--ui-hover)">笔刷设置</button><button onClick={onOpenMaterials}>素材库</button><span className="text-(--ui-muted) truncate">单击盖印 · 拖动绘制织带</span></>}
      {showDrawing && isVectorTool(currentTool) && <>
        <VectorModes tool={currentTool} onSelect={onSelectTool ?? (() => {})} />
        {currentTool === 'vector_pen' && <Segmented>
          <IconButton active={brushSettings.mode === 'cutout'} tip="钢笔刻纸：闭合路径作为切口" onClick={() => set({ mode: 'cutout' })}><Scissors className="w-3.5 h-3.5" /></IconButton>
          <IconButton active={brushSettings.mode === 'positive'} tip="钢笔贴花：闭合路径作为色块" onClick={() => set({ mode: 'positive' })}><Layers className="w-3.5 h-3.5" /></IconButton>
        </Segmented>}
        {currentTool === 'vector_edit' ? <div id="vector-options" className="min-w-0 flex-1" /> : <span className="text-(--ui-muted) truncate">{currentTool === 'vector_pen' ? '单击落角点 · 拖动拉曲线 · 点起点闭合 · Enter 完成' : '选择路径 · 拖动锚点调整轮廓'}</span>}
      </>}
      {(currentTool === 'select' || (workspaceModesEnabled && workspaceMode === 'arrange')) && (!workspaceModesEnabled || workspaceMode !== 'assets') && (
        <>
          <Segmented>
            <IconButton active={selectionScope === 'item'} tip="整物件选取 (Tab)" onClick={() => onChangeSelectionScope('item')}>
              <Box className="w-3.5 h-3.5" />
            </IconButton>
            <IconButton active={selectionScope === 'part'} tip="单部件选取 (Tab)" onClick={() => onChangeSelectionScope('part')}>
              <MousePointerClick className="w-3.5 h-3.5" />
            </IconButton>
            <IconButton active={selectionScope === 'group'} tip="绘制组选取 (Tab)" onClick={() => onChangeSelectionScope('group')}>
              <Group className="w-3.5 h-3.5" />
            </IconButton>
            <IconButton active={selectionScope === 'color'} tip="色块选取 (Tab) · Shift 加选，双击选同色" onClick={() => onChangeSelectionScope('color')}>
              <PaintBucket className="w-3.5 h-3.5" />
            </IconButton>
          </Segmented>
          <IconButton disabled={!canCaptureStamp} tip="选中内容收为图章" onClick={onCaptureStamp ?? (() => {})}><Stamp className="w-3.5 h-3.5" /></IconButton>
          <IconButton
            active={!!brushSettings.selectLasso}
            tip={brushSettings.selectLasso ? '圈选：拖动圈画选中（Shift 加选）' : '点选：单击选中，空白处拖动圈选'}
            onClick={() => set({ selectLasso: !brushSettings.selectLasso })}
          >
            <Lasso className="w-3.5 h-3.5" />
          </IconButton>
          {onGroupSelection && <IconButton tip="组合为绘制组 · Ctrl+G" onClick={onGroupSelection} disabled={selectedCount === 0}><Group className="w-3.5 h-3.5" /></IconButton>}
          {onUngroupSelection && <IconButton tip="解散绘制组 · Ctrl+Shift+G" onClick={onUngroupSelection} disabled={selectedCount === 0}><Ungroup className="w-3.5 h-3.5" /></IconButton>}
          <IconButton tip="转为资产物件（Item）" onClick={onCreateItemFromSelection} disabled={selectedCount === 0}>
            <Box className="w-3.5 h-3.5" />
          </IconButton>
          {onFlipSelection && <><IconButton tip="水平翻转" disabled={selectedCount === 0} onClick={() => onFlipSelection('horizontal')}><FlipHorizontal2 className="w-3.5 h-3.5" /></IconButton>
            <IconButton tip="垂直翻转" disabled={selectedCount === 0} onClick={() => onFlipSelection('vertical')}><FlipVertical2 className="w-3.5 h-3.5" /></IconButton></>}
          {onMirrorSelection && <IconButton tip="沿画布对称轴镜像复制" disabled={selectedCount === 0} onClick={onMirrorSelection}><SymGlyph kind="mirror" /></IconButton>}
          <IconButton
            active={brushSettings.lockAspect ?? true}
            tip={`${brushSettings.lockAspect ?? true ? '已锁定长宽比' : '长宽比未锁定'} · 按住 Shift 临时切换，按住 Ctrl 拖角/边自由变形`}
            onClick={() => set({ lockAspect: !(brushSettings.lockAspect ?? true) })}
          >
            {brushSettings.lockAspect ?? true ? <Link2 className="w-3.5 h-3.5" /> : <Unlink2 className="w-3.5 h-3.5" />}
          </IconButton>
        </>
      )}

      {showDrawing && currentTool === 'willow_leaf' && willowOptions}

      {showDrawing && currentTool === 'geom_shape' && (
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

      {showDrawing && (currentTool === 'pen_knife' || currentTool === 'freehand') && (
        <>
          <Segmented>
            {KNIFE_TIPS.map((t) => (
              <IconButton key={t.id} active={(brushSettings.knifeTipShape || 'round') === t.id} tip={t.tip} onClick={() => set({ knifeTipShape: t.id })}>
                {t.icon}
              </IconButton>
            ))}
          </Segmented>
          <WheelNumber tip="画笔大小 ( [ / ] )" icon={<Circle className="w-3 h-3" />} value={brushSettings.stampSize || 26} min={4} max={120} onChange={(v) => set({ stampSize: v })} />
          {['flat', 'chisel'].includes(brushSettings.knifeTipShape || 'round') && (
            <>
              <Segmented>
                <IconButton active={!brushSettings.knifeFollow} tip="刀头固定角度" onClick={() => set({ knifeFollow: false })}>
                  <Glyph d="M3 8h10" />
                </IconButton>
                <IconButton active={!!brushSettings.knifeFollow} tip="刀头随笔画旋转" onClick={() => set({ knifeFollow: true })}>
                  <RotateCw className="w-3.5 h-3.5" />
                </IconButton>
              </Segmented>
              <WheelNumber
                tip={brushSettings.knifeFollow ? '刀头相对笔画的偏角（0° 横跨笔画）' : '刀头角度（0° 水平）'}
                icon={<span className="text-[10px]">∠</span>}
                value={brushSettings.knifeAngle ?? 0}
                min={-90}
                max={90}
                step={5}
                format={(v) => `${v}°`}
                onChange={(v) => set({ knifeAngle: v })}
              />
            </>
          )}
        </>
      )}

      {showDrawing && currentTool === 'hand_draw' && (
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
      {workspaceModesEnabled && workspaceMode === 'assets' && <>
        <button type="button" onClick={onOpenMaterials} className="h-7 px-2 hover:bg-(--ui-hover)">素材库</button>
        <button type="button" onClick={onCreateAsset ?? onCaptureStamp} disabled={!canCaptureStamp}
          className="h-7 px-2 flex items-center gap-1 hover:bg-(--ui-hover) disabled:opacity-35"><Stamp className="w-3.5 h-3.5" />收为素材</button>
        <button type="button" onClick={onCreateItemFromSelection} disabled={selectedCount === 0}
          className="h-7 px-2 flex items-center gap-1 hover:bg-(--ui-hover) disabled:opacity-35"><Box className="w-3.5 h-3.5" />转为物件</button>
        <span className="text-(--ui-muted) truncate">图章、织带、布料与套装</span>
      </>}
      {onOpenSymmetrySettings && <button type="button" onClick={onOpenSymmetrySettings}
        data-tip="画布对称设置 · 在图层栏调整对称轴和中心"
        className={`ml-auto shrink-0 h-7 px-1.5 flex items-center gap-1 hover:bg-(--ui-hover) ${sym.kind === 'none' ? 'text-(--ui-muted)' : 'text-(--ui-accent)'}`}>
        <SymGlyph kind={sym.kind} />
        <span className="text-[10px]">{sym.kind === 'none' ? '对称' : sym.kind === 'mirror' ? '轴对称' : '中心对称'}</span>
      </button>}
    </div>
  );
};