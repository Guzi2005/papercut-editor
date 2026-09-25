/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ToolType,
  BrushSettings,
  GeomShapeType,
  KnifeTipShape,
  DrawBrushType,
  PencilHardness,
} from '../types/papercut';
import {
  Scissors,
  Layers,
  Eraser,
  Square,
  Circle,
  Triangle,
  Star,
  Diamond,
  Check,
  X,
  PenTool,
  Pencil,
  Feather,
  Sparkles,
  Zap,
  Activity,
  SlidersHorizontal,
} from 'lucide-react';
import { FOLK_PALETTE } from '../utils/presetTemplates';
import { playCrispClick } from '../utils/soundEffects';

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

const KNIFE_TIPS: { id: KnifeTipShape; label: string; desc: string }[] = [
  { id: 'round', label: '圆刃', desc: '平滑饱满弧度刀刃' },
  { id: 'flat', label: '平刃', desc: '平刀横切，起止利落' },
  { id: 'chisel', label: '斜刃', desc: '传统刻刀斜角割断' },
  { id: 'slash', label: '柳刃', desc: '柳叶尖刀两端极细' },
];

const DRAW_BRUSHES: { id: DrawBrushType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'pencil', label: '铅笔', icon: Pencil },
  { id: 'pen', label: '钢笔', icon: Feather },
  { id: 'airbrush', label: '喷枪', icon: Sparkles },
];

const PENCIL_HARDNESS_LEVELS: { level: PencilHardness; label: string; desc: string }[] = [
  { level: 1, label: '极软', desc: 'SAI 软性碳铅，边缘微晕柔和' },
  { level: 2, label: '软', desc: '较软石墨，层次丰富' },
  { level: 3, label: '中', desc: '标准 HB 铅笔线条' },
  { level: 4, label: '硬', desc: 'SAI 硬性铅笔，线条利落清晰' },
  { level: 5, label: '极硬', desc: '极细硬质针管笔触，边缘无漫射' },
];

export const ToolOptions: React.FC<ToolOptionsProps> = ({
  currentTool,
  brushSettings,
  onChangeBrushSettings,
  onSelectTool,
  selectionScope,
  onChangeSelectionScope,
  selectedCount,
  onCreateItemFromSelection,
}) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showStarSettings, setShowStarSettings] = useState(false);

  return (
    <div className="relative z-30 min-h-10 px-3 py-1.5 bg-(--ui-panel-2) border-b border-(--ui-divider) text-(--ui-text-2) flex items-center justify-between text-xs select-none gap-3">
      {/* Left: Essential Tools Controls */}
      <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
        {currentTool !== 'hand_draw' && currentTool !== 'select' && currentTool !== 'anchor_edit' && (
          <>
            {/* ”剪除“下分两个模式：智能橡皮 vs 柳叶笔橡皮 */}
            {brushSettings.mode === 'erase' && (
              <div className="flex items-center bg-(--ui-raised) rounded-xl p-0.5 border border-(--ui-border) gap-0.5 animate-in fade-in">
                <button
                  onClick={() => onChangeBrushSettings({ eraseMode: 'smart' })}
                  className={`px-2 py-0.5 rounded-lg text-[10px] transition-colors ${
                    (brushSettings.eraseMode || 'smart') === 'smart'
                      ? 'bg-(--ui-accent) text-white font-medium shadow-sm'
                      : 'text-(--ui-muted) hover:text-(--ui-strong)'
                  }`}
                  data-tip="智能橡皮：划过或轻触切口即整体消除该切口"
                >
                  智能橡皮
                </button>
                <button
                  onClick={() => onChangeBrushSettings({ eraseMode: 'willow' })}
                  className={`px-2 py-0.5 rounded-lg text-[10px] transition-colors ${
                    brushSettings.eraseMode === 'willow'
                      ? 'bg-(--ui-accent) text-white font-medium shadow-sm'
                      : 'text-(--ui-muted) hover:text-(--ui-strong)'
                  }`}
                  data-tip="柳叶笔橡皮：以柳叶笔划痕进行局部割除镂空"
                >
                  柳叶笔橡皮
                </button>
              </div>
            )}

            <div className="w-px h-5 bg-(--ui-border) mx-0.5" />
          </>
        )}

        {currentTool === 'select' && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-(--ui-raised) rounded-xl p-0.5 border border-(--ui-border) gap-0.5">
              {([
                { id: 'item', label: '整物件', tip: '点击任一部件即选中它所属的整个物件' },
                { id: 'part', label: '单部件', tip: '只选中点击到的那一张纸片' },
              ] as const).map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => onChangeSelectionScope(opt.id)}
                  data-tip={`${opt.tip} (Tab 切换)`}
                  className={`px-2.5 py-0.5 rounded-lg text-[11px] transition-colors ${
                    selectionScope === opt.id
                      ? 'bg-(--ui-accent) text-white font-medium'
                      : 'text-(--ui-muted) hover:text-(--ui-strong)'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              onClick={onCreateItemFromSelection}
              disabled={selectedCount === 0}
              className="px-2.5 py-1 rounded-xl text-[11px] border border-(--ui-border) bg-(--ui-raised) text-(--ui-text-2) hover:text-(--ui-strong) hover:border-(--ui-accent-2) disabled:opacity-40 disabled:cursor-not-allowed"
              data-tip="把选中的纸片打包成物件（导出为一个 Godot 场景）"
            >
              打组为物件
            </button>
          </div>
        )}

        {/* 1. 柳叶笔 Controls */}
        {currentTool === 'willow_leaf' && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Formation Mode */}
            <div className="flex items-center gap-1 bg-(--ui-raised) rounded-xl p-0.5 border border-(--ui-border)">
              <button
                onClick={() => onChangeBrushSettings({ willowMode: 'chord' })}
                className={`px-2.5 py-0.5 rounded-lg text-[11px] transition-colors ${
                  (brushSettings.willowMode || 'chord') === 'chord'
                    ? 'bg-(--ui-accent) text-white font-medium'
                    : 'text-(--ui-muted) hover:text-(--ui-strong)'
                }`}
                data-tip="单弧画线，起终点实时连弦闭合成叶"
              >
                单弧成叶
              </button>
              <button
                onClick={() => onChangeBrushSettings({ willowMode: 'symmetric' })}
                className={`px-2.5 py-0.5 rounded-lg text-[11px] transition-colors ${
                  brushSettings.willowMode === 'symmetric'
                    ? 'bg-(--ui-accent) text-white font-medium'
                    : 'text-(--ui-muted) hover:text-(--ui-strong)'
                }`}
                data-tip="对称双弧：自动以起终点连线为轴，对称生成饱满双弧柳叶"
              >
                对称双弧
              </button>
            </div>

            {/* Stabilizer Slider */}
            <div className="flex items-center gap-2 bg-(--ui-raised) rounded-xl px-3 py-1 border border-(--ui-border)">
              <span className="text-[11px] text-(--ui-muted) shrink-0">防抖:</span>
              <input
                type="range"
                min="0"
                max="0.9"
                step="0.05"
                value={brushSettings.stabilizer ?? 0.55}
                onChange={(e) =>
                  onChangeBrushSettings({ stabilizer: parseFloat(e.target.value) })
                }
                className="w-20 sm:w-28 h-1.5 bg-(--ui-border) rounded-lg appearance-none cursor-pointer accent-(--ui-accent)"
                data-tip="笔刷平滑防抖程度"
              />
              <span className="text-[10px] font-mono text-(--ui-text-2) w-7 text-right">
                {Math.round((brushSettings.stabilizer ?? 0.55) * 100)}%
              </span>
            </div>
          </div>
        )}

        {/* 2. 基本几何形创建 (Geom Shapes) */}
        {currentTool === 'geom_shape' && (
          <div className="flex items-center gap-2 flex-wrap relative">
            <div className="flex items-center bg-(--ui-raised) rounded-xl p-0.5 border border-(--ui-border) gap-0.5">
              {[
                { id: 'rect', label: '矩形', icon: Square },
                { id: 'circle', label: '圆形', icon: Circle },
                { id: 'triangle', label: '正三角', icon: Triangle },
                { id: 'diamond', label: '菱形', icon: Diamond },
                { id: 'star', label: '星型', icon: Star },
                { id: 'polyline', label: '折线', icon: Activity },
              ].map((item) => {
                const isSelected =
                  (brushSettings.geomShapeType || 'rect') === item.id;
                const Icon = item.icon;

                return (
                  <div key={item.id} className="relative">
                    <button
                      onClick={() => {
                        playCrispClick();
                        onChangeBrushSettings({
                          geomShapeType: item.id as GeomShapeType,
                        });
                      }}
                      onContextMenu={(e) => {
                        if (item.id === 'star') {
                          e.preventDefault();
                          onChangeBrushSettings({ geomShapeType: 'star' });
                          setShowStarSettings((prev) => !prev);
                        }
                      }}
                      data-tip={
                        item.id === 'star'
                          ? '星型 (右键可修改角的个数、圆角、不规则度)'
                          : item.id === 'polyline'
                          ? '折线 (单击新增锚点，双击结束成形)'
                          : item.label
                      }
                      className={`relative group w-7 h-7 flex items-center justify-center rounded-lg transition-all ${
                        isSelected
                          ? 'bg-(--ui-accent) text-white font-medium shadow-md shadow-blue-950/60 ring-1 ring-(--ui-text-2)/40 scale-105'
                          : 'text-(--ui-muted) hover:bg-(--ui-hover) hover:text-(--ui-strong)'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <div className="absolute top-full mt-2 hidden group-hover:block px-2 py-0.5 bg-(--ui-panel-2)/95 backdrop-blur-md text-(--ui-strong) text-[10px] rounded-md shadow-xl z-50 whitespace-nowrap border border-(--ui-border-strong) pointer-events-none">
                        {item.label}
                        {item.id === 'star' && ' (右键设置)'}
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>

            {/* 星型参数快捷设置按钮 (如果当前选中的是星型) */}
            {brushSettings.geomShapeType === 'star' && (
              <div className="relative">
                <button
                  onClick={() => setShowStarSettings(!showStarSettings)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-xl text-[11px] border transition-colors ${
                    showStarSettings
                      ? 'bg-(--ui-accent) text-white border-(--ui-text-2)/50'
                      : 'bg-(--ui-raised) text-(--ui-text-2) hover:text-white border-(--ui-border)'
                  }`}
                  data-tip="自定义星型：角的个数、圆角程度、不规则程度"
                >
                  <SlidersHorizontal className="w-3 h-3" />
                  <span>星型设置 ({brushSettings.starPoints || 5}角)</span>
                </button>

                {/* 星型参数弹出框 */}
                {showStarSettings && (
                  <div
                    className="absolute top-full left-0 mt-2 bg-(--ui-panel) border border-(--ui-border-strong) p-3 rounded-2xl shadow-2xl z-50 w-64 backdrop-blur-md space-y-2.5 animate-in fade-in zoom-in-95 text-xs text-(--ui-text)"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between font-semibold text-(--ui-strong) border-b border-(--ui-border) pb-1.5">
                      <span>星型属性调节</span>
                      <button
                        onClick={() => setShowStarSettings(false)}
                        className="text-(--ui-muted) hover:text-(--ui-strong) p-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* 1. 角的个数 */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-(--ui-muted) mb-1">
                        <span>角的个数</span>
                        <span className="font-mono text-(--ui-strong) font-semibold">
                          {brushSettings.starPoints || 5} 角
                        </span>
                      </div>
                      <input
                        type="range"
                        min="3"
                        max="16"
                        step="1"
                        value={brushSettings.starPoints || 5}
                        onChange={(e) =>
                          onChangeBrushSettings({
                            starPoints: parseInt(e.target.value),
                          })
                        }
                        className="w-full h-1.5 bg-(--ui-border) rounded-lg appearance-none cursor-pointer accent-(--ui-accent)"
                      />
                    </div>

                    {/* 2. 圆角程度 */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-(--ui-muted) mb-1">
                        <span>圆角程度</span>
                        <span className="font-mono text-(--ui-strong) font-semibold">
                          {brushSettings.starRoundness || 0}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="25"
                        step="1"
                        value={brushSettings.starRoundness || 0}
                        onChange={(e) =>
                          onChangeBrushSettings({
                            starRoundness: parseInt(e.target.value),
                          })
                        }
                        className="w-full h-1.5 bg-(--ui-border) rounded-lg appearance-none cursor-pointer accent-(--ui-accent)"
                      />
                    </div>

                    {/* 3. 不规则程度 */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-(--ui-muted) mb-1">
                        <span>不规则程度</span>
                        <span className="font-mono text-(--ui-strong) font-semibold">
                          {brushSettings.starIrregularity || 0}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={brushSettings.starIrregularity || 0}
                        onChange={(e) =>
                          onChangeBrushSettings({
                            starIrregularity: parseInt(e.target.value),
                          })
                        }
                        className="w-full h-1.5 bg-(--ui-border) rounded-lg appearance-none cursor-pointer accent-(--ui-accent)"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {brushSettings.geomShapeType === 'polyline' && (
              <span className="text-[11px] text-(--ui-muted)" data-tip="单击添加锚点，双击或点回起点闭合">单击加点 · 双击闭合</span>
            )}
          </div>
        )}

        {/* 3. 笔刀 (Pen Knife: 压感开关、笔尖形状选择、刀印宽度) */}
        {(currentTool === 'pen_knife' || currentTool === 'freehand') && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* 压感开关 */}
            <button
              onClick={() =>
                onChangeBrushSettings({ knifePressure: !brushSettings.knifePressure })
              }
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[11px] transition-all ${
                brushSettings.knifePressure
                  ? 'bg-(--ui-accent) text-white border-(--ui-text-2)/50 shadow-sm font-medium'
                  : 'bg-(--ui-raised) text-(--ui-muted) border-(--ui-border) hover:bg-(--ui-hover)'
              }`}
              data-tip="切换数位板/触控笔压感（压感将实时影响下刀切口粗细）"
            >
              <Zap className="w-3 h-3" />
              <span>压感</span>
            </button>

            {/* 笔尖形状选择 */}
            <div className="flex items-center bg-(--ui-raised) rounded-xl p-0.5 border border-(--ui-border) gap-0.5">
              {KNIFE_TIPS.map((tip) => {
                const isSelected = (brushSettings.knifeTipShape || 'round') === tip.id;
                return (
                  <button
                    key={tip.id}
                    onClick={() => onChangeBrushSettings({ knifeTipShape: tip.id })}
                    className={`px-2 py-0.5 rounded-lg text-[11px] transition-colors ${
                      isSelected
                        ? 'bg-(--ui-accent) text-white font-medium shadow-sm'
                        : 'text-(--ui-muted) hover:text-(--ui-strong)'
                    }`}
                    data-tip={tip.desc}
                  >
                    {tip.label}
                  </button>
                );
              })}
            </div>

            {/* 刀印预设宽度与微调滑杆 */}
            <div className="flex items-center gap-1.5 bg-(--ui-raised) rounded-xl px-2 py-0.5 border border-(--ui-border)">
              <div className="flex items-center gap-0.5">
                {[
                  { label: '细刀', val: 16 },
                  { label: '中刀', val: 26 },
                  { label: '阔刀', val: 40 },
                ].map((sz) => (
                  <button
                    key={sz.label}
                    onClick={() => onChangeBrushSettings({ stampSize: sz.val })}
                    className={`px-1.5 py-0.5 rounded-lg text-[10px] transition-colors ${
                      (brushSettings.stampSize || 26) === sz.val
                        ? 'bg-(--ui-accent) text-white font-medium'
                        : 'text-(--ui-muted) hover:text-(--ui-strong)'
                    }`}
                  >
                    {sz.label}
                  </button>
                ))}
              </div>
              <div className="w-px h-3.5 bg-(--ui-border) mx-0.5 hidden sm:block" />
              <div className="hidden sm:flex items-center gap-1">
                <input
                  type="range"
                  min="6"
                  max="60"
                  step="2"
                  value={brushSettings.stampSize || 26}
                  onChange={(e) =>
                    onChangeBrushSettings({ stampSize: parseInt(e.target.value) })
                  }
                  className="w-14 sm:w-16 h-1 bg-(--ui-border) rounded-lg appearance-none cursor-pointer accent-(--ui-accent)"
                  data-tip="笔刀切口宽度"
                />
                <span className="text-[10px] font-mono text-(--ui-text-2) w-4 text-right">
                  {brushSettings.stampSize || 26}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 4. 手绘 (Hand Draw: 铅笔五档软硬、钢笔、喷枪、压感、透明度、颜色，自动开启剪贴蒙版) */}
        {currentTool === 'hand_draw' && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* 笔刷类型：铅笔、钢笔、喷枪 */}
            <div className="flex items-center bg-(--ui-raised) rounded-xl p-0.5 border border-(--ui-border) gap-0.5">
              {DRAW_BRUSHES.map((b) => {
                const isSelected = (brushSettings.drawBrushType || 'pencil') === b.id;
                const Icon = b.icon;
                return (
                  <button
                    key={b.id}
                    onClick={() => onChangeBrushSettings({ drawBrushType: b.id })}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                      isSelected
                        ? 'bg-(--ui-accent) text-white shadow-sm'
                        : 'text-(--ui-muted) hover:text-(--ui-strong)'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{b.label}</span>
                  </button>
                );
              })}
            </div>

            {/* 压感开关 */}
            <button
              onClick={() =>
                onChangeBrushSettings({ drawPressure: !brushSettings.drawPressure })
              }
              className={`flex items-center gap-1 px-2 py-1 rounded-xl border text-[11px] transition-all ${
                brushSettings.drawPressure
                  ? 'bg-(--ui-accent) text-white border-(--ui-text-2)/50 shadow-sm font-medium'
                  : 'bg-(--ui-raised) text-(--ui-muted) border-(--ui-border) hover:bg-(--ui-hover)'
              }`}
              data-tip="触控笔压感调节笔触大小与下笔浓淡"
            >
              <Zap className="w-3 h-3" />
              <span>压感</span>
            </button>

            {/* 铅笔专属：SAI 软硬五档 */}
            {(brushSettings.drawBrushType || 'pencil') === 'pencil' && (
              <div className="flex items-center gap-1 bg-(--ui-raised) rounded-xl px-2 py-0.5 border border-(--ui-border)">
                <span className="text-[10px] text-(--ui-muted)">软硬</span>
                <div className="flex items-center gap-0.5">
                  {PENCIL_HARDNESS_LEVELS.map((hl) => {
                    const isSelected = (brushSettings.pencilHardness || 3) === hl.level;
                    return (
                      <button
                        key={hl.level}
                        onClick={() => onChangeBrushSettings({ pencilHardness: hl.level })}
                        className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                          isSelected
                            ? 'bg-(--ui-accent) text-white font-semibold'
                            : 'text-(--ui-muted) hover:text-(--ui-strong)'
                        }`}
                        data-tip={`${hl.label} (${hl.desc})`}
                      >
                        {hl.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 不透明度调节 */}
            <div className="flex items-center gap-1.5 bg-(--ui-raised) rounded-xl px-2.5 py-1 border border-(--ui-border)">
              <span className="text-[10px] text-(--ui-muted)">不透明</span>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={brushSettings.drawOpacity ?? 0.85}
                onChange={(e) =>
                  onChangeBrushSettings({ drawOpacity: parseFloat(e.target.value) })
                }
                className="w-14 sm:w-18 h-1 bg-(--ui-border) rounded-lg appearance-none cursor-pointer accent-(--ui-accent)"
              />
              <span className="text-[10px] font-mono text-(--ui-text-2) w-7 text-right">
                {Math.round((brushSettings.drawOpacity ?? 0.85) * 100)}%
              </span>
            </div>

            {/* 笔尖粗细 */}
            <div className="flex items-center gap-1.5 bg-(--ui-raised) rounded-xl px-2.5 py-1 border border-(--ui-border)">
              <span className="text-[10px] text-(--ui-muted)">
                {brushSettings.drawBrushType === 'airbrush' ? '晕染' : '粗细'}
              </span>
              <input
                type="range"
                min={brushSettings.drawBrushType === 'airbrush' ? '10' : '2'}
                max={brushSettings.drawBrushType === 'airbrush' ? '80' : '40'}
                step="1"
                value={brushSettings.drawSize ?? 6}
                onChange={(e) =>
                  onChangeBrushSettings({ drawSize: parseInt(e.target.value) })
                }
                className="w-14 sm:w-18 h-1 bg-(--ui-border) rounded-lg appearance-none cursor-pointer accent-(--ui-accent)"
              />
              <span className="text-[10px] font-mono text-(--ui-text-2) w-5 text-right">
                {brushSettings.drawSize ?? 6}
              </span>
            </div>

            {/* 绘制颜色 (手绘专属色选器) */}
            <div className="relative">
              <button
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-(--ui-raised) hover:bg-(--ui-hover) border border-(--ui-border) text-[11px]"
                data-tip="画笔颜色"
              >
                <span
                  className="w-3.5 h-3.5 rounded-full border border-white/40 shadow-sm"
                  style={{ backgroundColor: brushSettings.drawColor || '#161B29' }}
                />
              </button>

              {/* Color picker popover */}
              {showColorPicker && (
                <div
                  className="absolute left-0 top-full mt-1 bg-(--ui-panel) border border-(--ui-border-strong) p-2.5 rounded-xl shadow-2xl z-50 grid grid-cols-5 gap-1.5 w-44 backdrop-blur-md"
                  onClick={(e) => e.stopPropagation()}
                >
                  {FOLK_PALETTE.slice(0, 15).map((col) => (
                    <button
                      key={col.hex}
                      onClick={() => {
                        onChangeBrushSettings({ drawColor: col.hex });
                        setShowColorPicker(false);
                      }}
                      className="w-6 h-6 rounded-md border border-white/20 hover:scale-110 transition-transform cursor-pointer"
                      style={{ backgroundColor: col.hex }}
                      data-tip={col.name}
                    />
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

      </div>

    </div>
  );
};
