/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { CloudFog, Droplet, Move, RotateCw, Square } from 'lucide-react';
import { LayerStroke, StrokeLine, StrokePosition } from '../types/papercut';
import { WheelNumber } from './WheelNumber';

export const DEFAULT_LAYER_STROKE: LayerStroke = {
  enabled: true,
  position: 'outside',
  width: 4,
  opacity: 1,
  color: '#1B1626',
  softness: 0,
  angle: 45,
  offset: 0,
  line: 'solid',
};

const HAIRLINE: LayerStroke = { ...DEFAULT_LAYER_STROKE, width: 1, color: '#000000', position: 'outside' };

/** Identity of a stroke look, ignoring whether it is switched on. */
export const strokeKey = (s: LayerStroke) =>
  [s.position, s.width, s.color.toLowerCase(), s.opacity, s.softness, s.offset, s.offset ? s.angle : 0, s.line].join('|');

function describeStroke(s: LayerStroke): string {
  const pos = { inside: '内', center: '中', outside: '外' }[s.position];
  const line = { solid: '', dashed: ' 虚', dotted: ' 点', stitch: ' 缝' }[s.line];
  return `${pos} ${s.width}px${line}`;
}

const StrokeSwatch: React.FC<{ stroke: LayerStroke }> = ({ stroke: s }) => {
  const w = Math.min(4, Math.max(1, s.width / 2));
  const dash = s.line === 'dashed' ? `${w * 2.5} ${w * 1.6}` : s.line === 'dotted' ? `0 ${w * 2}` : s.line === 'stitch' ? `${w * 2} ${w * 1.4}` : undefined;
  return (
    <svg viewBox="0 0 22 16" className="w-5.5 h-4 shrink-0">
      <rect x="4" y="3" width="14" height="10" rx="2" fill="#D8342A" />
      <rect x="4" y="3" width="14" height="10" rx="2" fill="none" stroke={s.color} strokeOpacity={s.opacity} strokeWidth={w} strokeDasharray={dash} strokeLinecap={s.line === 'dotted' ? 'round' : 'butt'} />
    </svg>
  );
};

const POSITIONS: { id: StrokePosition; label: string; tip: string }[] = [
  { id: 'inside', label: '内', tip: '内描边：沿轮廓向内' },
  { id: 'center', label: '中', tip: '居中描边：跨在轮廓上' },
  { id: 'outside', label: '外', tip: '外描边：沿轮廓向外' },
];

const LINES: { id: StrokeLine; tip: string; dash?: string; cap?: 'round' | 'butt'; w: number }[] = [
  { id: 'solid', tip: '实线', w: 2.2 },
  { id: 'dashed', tip: '虚线', dash: '4 2.5', cap: 'butt', w: 2.2 },
  { id: 'dotted', tip: '点线', dash: '0 3.2', cap: 'round', w: 2.6 },
  { id: 'stitch', tip: '缝线', dash: '2.6 2', cap: 'round', w: 1.5 },
];

const Seg: React.FC<{ active: boolean; tip: string; onClick: () => void; children: React.ReactNode }> = ({ active, tip, onClick, children }) => (
  <button
    onClick={onClick}
    data-tip={tip}
    className={`flex-1 h-6 flex items-center justify-center rounded-md text-[11px] transition-colors ${
      active ? 'bg-(--ui-accent) text-white' : 'text-(--ui-muted) hover:text-(--ui-strong)'
    }`}
  >
    {children}
  </button>
);

/** Layer outline settings, opened from the layer dock. */
export const StrokeButton: React.FC<{
  stroke?: LayerStroke;
  brushColor: string;
  onChange: (stroke: LayerStroke) => void;
  /** Enabled strokes on the document's other layers, offered as quick styles. */
  docStrokes: { stroke: LayerStroke; layerName: string }[];
}> = ({ stroke, brushColor, onChange, docStrokes }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const s = stroke ?? { ...DEFAULT_LAYER_STROKE, enabled: false };
  const set = (patch: Partial<LayerStroke>) => onChange({ ...s, ...patch });
  const quick = [{ stroke: HAIRLINE, label: '1px 黑边', tip: '1px 黑色外描边' }];
  docStrokes.forEach(({ stroke: st, layerName }) => {
    const k = strokeKey(st);
    const hit = quick.find((q) => strokeKey(q.stroke) === k);
    if (hit) {
      if (hit.stroke !== HAIRLINE) hit.tip += `、${layerName}`;
      return;
    }
    quick.push({ stroke: st, label: describeStroke(st), tip: `${layerName} 在用` });
  });

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        data-tip={s.enabled ? `描边：${POSITIONS.find((p) => p.id === s.position)?.label} · ${s.width}px` : '描边：关'}
        className={`h-7 flex items-center gap-1 px-1.5 rounded-lg border text-[11px] transition-colors ${
          s.enabled ? 'bg-(--ui-accent)/20 border-(--ui-accent)/60 text-(--ui-strong)' : 'bg-(--ui-raised) border-(--ui-border) text-(--ui-muted) hover:text-(--ui-strong)'
        }`}
      >
        <Square className="w-3 h-3" style={s.enabled ? { color: s.color, strokeWidth: 3 } : undefined} />
        描边
      </button>
      {open && (
        <div className="absolute bottom-full right-0 mb-2 z-50 flex items-end gap-1.5 text-xs">
          {/* 快速样式：1px 黑边 + 本文件其他部件在用的描边 */}
          <div className="w-24 p-1.5 rounded-xl bg-(--ui-panel) border border-(--ui-border-strong) shadow-2xl flex flex-col gap-1 max-h-72 overflow-y-auto">
            <div className="px-0.5 text-[10px] text-(--ui-faint)">快速样式</div>
            {quick.map((q) => {
              const active = s.enabled && strokeKey(s) === strokeKey(q.stroke);
              return (
                <button
                  key={strokeKey(q.stroke)}
                  onClick={() => onChange({ ...q.stroke, enabled: true })}
                  data-tip={q.tip}
                  className={`flex items-center gap-1.5 p-1 rounded-lg text-left transition-colors ${active ? 'bg-(--ui-accent)/25 text-(--ui-strong)' : 'hover:bg-(--ui-hover) text-(--ui-text-2)'}`}
                >
                  <StrokeSwatch stroke={q.stroke} />
                  <span className="text-[10px] leading-tight truncate">{q.label}</span>
                </button>
              );
            })}
          </div>

          <div className="w-60 p-2.5 rounded-xl bg-(--ui-panel) border border-(--ui-border-strong) shadow-2xl flex flex-col gap-2">
            {s.enabled && (
              <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 flex gap-0.5 bg-(--ui-raised) rounded-lg p-0.5 border border-(--ui-border)">
                    {POSITIONS.map((p) => (
                      <Seg key={p.id} active={s.position === p.id} tip={p.tip} onClick={() => set({ position: p.id })}>
                        {p.label}
                      </Seg>
                    ))}
                  </div>
                  <div className="flex-[1.3] flex gap-0.5 bg-(--ui-raised) rounded-lg p-0.5 border border-(--ui-border)">
                    {LINES.map((l) => (
                      <Seg key={l.id} active={s.line === l.id} tip={l.tip} onClick={() => set({ line: l.id })}>
                        <svg viewBox="0 0 18 6" className="w-4.5 h-2">
                          <path d="M1.5 3H16.5" stroke="currentColor" strokeWidth={l.w} strokeDasharray={l.dash} strokeLinecap={l.cap ?? 'round'} />
                        </svg>
                      </Seg>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <WheelNumber tip="宽度" icon={<Square className="w-3 h-3" />} value={s.width} min={1} max={60} onChange={(v) => set({ width: v })} />
                  <WheelNumber tip="不透明度" icon={<Droplet className="w-3 h-3" />} value={Math.round(s.opacity * 100)} min={0} max={100} step={5} format={(v) => `${v}%`} onChange={(v) => set({ opacity: v / 100 })} />
                  <WheelNumber tip="软硬：0 硬边 · 100 柔和" icon={<CloudFog className="w-3 h-3" />} value={Math.round(s.softness * 100)} min={0} max={100} step={5} format={(v) => `${v}%`} onChange={(v) => set({ softness: v / 100 })} />
                  <WheelNumber tip="偏移距离（错版）" icon={<Move className="w-3 h-3" />} value={s.offset} min={0} max={60} onChange={(v) => set({ offset: v })} />
                  <WheelNumber tip="偏移角度（0° 向右，90° 向下）" icon={<RotateCw className="w-3 h-3" />} value={s.angle} min={0} max={359} step={15} format={(v) => `${v}°`} onChange={(v) => set({ angle: v })} />
                  <div className="flex items-center gap-1">
                    <label className="relative w-7 h-7 rounded-lg border border-white/30 cursor-pointer overflow-hidden shrink-0" style={{ backgroundColor: s.color }} data-tip="描边颜色">
                      <input type="color" value={s.color} onChange={(e) => set({ color: e.target.value })} className="absolute inset-0 opacity-0 cursor-pointer" />
                    </label>
                    {['#1B1626', '#F7F4EB', brushColor].map((c, i) => (
                      <button
                        key={i}
                        onClick={() => set({ color: c })}
                        data-tip={i === 0 ? '墨黑' : i === 1 ? '米白' : '用画笔颜色'}
                        className="w-4 h-4 rounded-full border border-white/25 hover:scale-110 transition-transform"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
                <div className="h-px bg-(--ui-divider)" />
              </div>
            )}
            <button onClick={() => set({ enabled: !s.enabled })} className="w-full flex items-center gap-2 text-(--ui-text-2) hover:text-(--ui-strong)">
              <span className="flex-1 text-left font-medium">描边</span>
              <span className={`relative w-7 h-4 rounded-full transition-colors ${s.enabled ? 'bg-(--ui-accent)' : 'bg-(--ui-raised) border border-(--ui-border)'}`}>
                <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${s.enabled ? 'left-3.5' : 'left-0.5'}`} />
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
