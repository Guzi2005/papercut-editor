/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftRight, Pipette, PaintBucket, Plus } from 'lucide-react';
import { InlineName } from './InlineName';
import { WheelNumber } from './WheelNumber';
import { beginPropertyGesture } from '../utils/propertyGesture';
import { FOLK_PALETTE } from '../utils/presetTemplates';
import { HSV, hexToHsv, hexToRgb, hsvToHex, isLight, mixHex, normalizeHex, rgbToHex } from '../utils/color';

const SUB_KEY = 'weave.subColor';
const SWATCH_KEY = 'weave.swatches';

const load = <T,>(key: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};
const save = (key: string, v: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage unavailable */
  }
};

interface ColorStudioProps {
  color: string;
  /** `commit` is false while dragging, so only settled colours enter the recent list. */
  onChange: (hex: string, commit: boolean) => void;
  recent: string[];
  documentColors: string[];
  paperColor?: string;
  onApplyToPaper?: (hex: string) => void;
  colorNotes: Record<string, string>;
  onUpdateColorNote?: (hex: string, note: string) => void;
  width: number;
}

/** Drag helper: calls `fn` with the pointer position relative to `el`, with capture. */
function useDrag(fn: (x: number, y: number, rect: DOMRect, end: boolean) => void) {
  const ref = useRef(fn);
  ref.current = fn;
  return (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const rect = el.getBoundingClientRect();
    const gesture = beginPropertyGesture('scrub');
    const send = (ev: PointerEvent | React.PointerEvent, end: boolean) => ref.current(ev.clientX - rect.left, ev.clientY - rect.top, rect, end);
    send(e, false);
    const move = (ev: PointerEvent) => send(ev, false);
    const up = (ev: PointerEvent) => {
      send(ev, true);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      gesture.end();
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };
}

const Swatch: React.FC<{
  hex: string;
  active?: boolean;
  tip?: string;
  onClick: () => void;
  onDoubleClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  round?: boolean;
}> = ({ hex, active, tip, onClick, onDoubleClick, onContextMenu, round }) => (
  <button
    onClick={onClick}
    onDoubleClick={onDoubleClick}
    onContextMenu={onContextMenu}
    data-tip={tip ?? hex}
    className={`w-full aspect-square ${round ? 'rounded-full' : 'rounded-[5px]'} border transition-transform ${
      isLight(hex) ? 'border-black/15' : 'border-white/15'
    } ${active ? 'ring-2 ring-(--ui-accent) scale-105 z-10' : 'hover:scale-110'}`}
    style={{ backgroundColor: hex }}
  />
);

const Section: React.FC<{ title: string; extra?: React.ReactNode; children: React.ReactNode }> = ({ title, extra, children }) => (
  <div>
    <div className="flex items-center justify-between mb-1 text-[10px] text-(--ui-muted)">
      <span>{title}</span>
      {extra}
    </div>
    {children}
  </div>
);

type Channel = { key: string; label: string; max: number; value: number; track: string; set: (v: number) => string };

const ChannelSlider: React.FC<{ ch: Channel; onChange: (hex: string, commit: boolean) => void }> = ({ ch, onChange }) => {
  const drag = useDrag((x, _y, rect, end) => onChange(ch.set(Math.round(Math.min(1, Math.max(0, x / rect.width)) * ch.max)), end));
  const t = ch.value / ch.max;
  return (
    <div className="flex items-center gap-2" data-tip={`${ch.label} · 拖动或滚轮调节`}>
      <span className="w-3 text-[10px] font-semibold text-(--ui-muted)">{ch.label}</span>
      <div onPointerDown={drag} className="relative flex-1 h-3.5 rounded-full cursor-pointer touch-none border border-(--ui-border)" style={{ background: ch.track }}>
        <span
          className="absolute top-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.45)] pointer-events-none"
          style={{ left: `${t * 100}%` }}
        />
      </div>
      <WheelNumber value={Math.round(ch.value)} min={0} max={ch.max} tip={`${ch.label} 色彩通道`}
        onChange={value => onChange(ch.set(value), true)} className="shrink-0" />
    </div>
  );
};

export const ColorStudio: React.FC<ColorStudioProps> = ({
  color,
  onChange,
  recent,
  documentColors,
  paperColor,
  onApplyToPaper,
  colorNotes,
  onUpdateColorNote,
  width,
}) => {
  // Hue and saturation are kept apart from the hex so greys and blacks don't forget their hue.
  const [hsv, setHsv] = useState<HSV>(() => hexToHsv(color));
  const [sub, setSub] = useState<string>(() => load(SUB_KEY, '#F7F4EB'));
  const [swatches, setSwatches] = useState<string[]>(() => load(SWATCH_KEY, []));
  const [mode, setMode] = useState<'hsv' | 'rgb'>('hsv');
  const [editingNote, setEditingNote] = useState<string | null>(null);

  useEffect(() => {
    if (hsvToHex(hsv) !== normalizeHex(color)) setHsv(hexToHsv(color));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color]);

  const setFromHsv = (next: HSV, commit: boolean) => {
    setHsv(next);
    onChange(hsvToHex(next), commit);
  };
  const pick = (hex: string) => onChange(hex, true);

  const size = Math.max(150, Math.min(width - 24, 236));
  const ring = Math.round(size * 0.1);
  const inner = size - ring * 2;
  const square = Math.floor((inner / Math.SQRT2) * 0.94);

  const wheelTarget = useRef<'hue' | 'sv' | null>(null);
  const dragWheel = useDrag((x, y, rect, end) => {
    const cx = rect.width / 2, cy = rect.height / 2;
    const dx = x - cx, dy = y - cy;
    const half = square / 2;
    if (!wheelTarget.current) wheelTarget.current = Math.abs(dx) <= half + 2 && Math.abs(dy) <= half + 2 ? 'sv' : 'hue';
    if (wheelTarget.current === 'hue') {
      const h = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
      setFromHsv({ ...hsv, h }, end);
    } else {
      const s = Math.min(100, Math.max(0, ((dx + half) / square) * 100));
      const v = Math.min(100, Math.max(0, (1 - (dy + half) / square) * 100));
      setFromHsv({ ...hsv, s, v }, end);
    }
    if (end) wheelTarget.current = null;
  });

  const rgb = hexToRgb(color);
  const channels: Channel[] =
    mode === 'hsv'
      ? [
          {
            key: 'h', label: 'H', max: 360, value: hsv.h,
            track: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
            set: (v) => { const n = { ...hsv, h: v % 360 }; setHsv(n); return hsvToHex(n); },
          },
          {
            key: 's', label: 'S', max: 100, value: hsv.s,
            track: `linear-gradient(to right, ${hsvToHex({ ...hsv, s: 0 })}, ${hsvToHex({ ...hsv, s: 100 })})`,
            set: (v) => { const n = { ...hsv, s: v }; setHsv(n); return hsvToHex(n); },
          },
          {
            key: 'v', label: 'V', max: 100, value: hsv.v,
            track: `linear-gradient(to right, #000, ${hsvToHex({ ...hsv, v: 100 })})`,
            set: (v) => { const n = { ...hsv, v }; setHsv(n); return hsvToHex(n); },
          },
        ]
      : (['r', 'g', 'b'] as const).map((k) => ({
          key: k, label: k.toUpperCase(), max: 255, value: rgb[k],
          track: `linear-gradient(to right, ${rgbToHex({ ...rgb, [k]: 0 })}, ${rgbToHex({ ...rgb, [k]: 255 })})`,
          set: (v: number) => rgbToHex({ ...rgb, [k]: v }),
        }));

  const mids = useMemo(() => Array.from({ length: 9 }, (_, i) => mixHex(color, sub, i / 8)), [color, sub]);
  const hueHex = hsvToHex({ h: hsv.h, s: 100, v: 100 });
  const cur = normalizeHex(color);

  const swap = () => {
    const main = color;
    onChange(sub, true);
    setSub(main);
    save(SUB_KEY, main);
  };
  const saveSwatches = (next: string[]) => {
    setSwatches(next);
    save(SWATCH_KEY, next);
  };
  const eyedropper = async () => {
    const ED = (window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
    if (!ED) return;
    try {
      const r = await new ED().open();
      const h = normalizeHex(r.sRGBHex);
      if (h) pick(h);
    } catch {
      /* cancelled */
    }
  };
  const canEyedrop = typeof window !== 'undefined' && 'EyeDropper' in window;
  const grid = (n: number) => ({ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` });
  const cols = Math.max(8, Math.floor((width - 24) / 26));

  return (
    <div className="space-y-3">
      {/* 主色 / 副色 · 十六进制 · 吸管 */}
      <div className="flex items-center gap-2">
        <div className="relative w-12 h-11 shrink-0">
          <button
            onClick={swap}
            data-tip="副色 · 单击与主色互换"
            className="absolute right-0 bottom-0 w-7 h-7 rounded-md border-2 border-(--ui-panel) shadow"
            style={{ backgroundColor: sub }}
          />
          <label className="absolute left-0 top-0 w-7 h-7 rounded-md border-2 border-(--ui-panel) shadow cursor-pointer overflow-hidden" style={{ backgroundColor: color }} data-tip="主色（画笔与贴花）">
            <input type="color" value={cur ?? '#000000'} onChange={(e) => onChange(e.target.value, true)} className="absolute inset-0 opacity-0 cursor-pointer" />
          </label>
          <button onClick={swap} data-tip="主副色互换" className="absolute left-0 bottom-0 w-4 h-4 flex items-center justify-center text-(--ui-muted) hover:text-(--ui-strong)">
            <ArrowLeftRight className="w-3 h-3" />
          </button>
        </div>
        <InlineName value={cur ?? color} onCommit={pick} normalize={normalizeHex} maxLength={9}
          label="十六进制色值" className="min-w-0 flex-1 h-7 font-mono text-[11px] text-(--ui-strong) uppercase" />
        {canEyedrop && (
          <button onClick={eyedropper} data-tip="吸管：从屏幕任意处取色" className="h-7 w-7 flex items-center justify-center rounded-lg bg-(--ui-raised) border border-(--ui-border) text-(--ui-muted) hover:text-(--ui-strong)">
            <Pipette className="w-3.5 h-3.5" />
          </button>
        )}
        {onApplyToPaper && (
          <button
            onClick={() => onApplyToPaper(color)}
            data-tip="给当前纸片上色"
            className="h-7 w-7 flex items-center justify-center rounded-lg bg-(--ui-raised) border border-(--ui-border) text-(--ui-muted) hover:text-(--ui-strong)"
          >
            <PaintBucket className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* 色相环 + 饱和度/明度方块 */}
      <div
        onPointerDown={dragWheel}
        className="relative mx-auto touch-none cursor-crosshair"
        style={{ width: size, height: size }}
      >
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'conic-gradient(#f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
            WebkitMask: `radial-gradient(circle, transparent ${inner / 2 - 0.5}px, #000 ${inner / 2}px)`,
            mask: `radial-gradient(circle, transparent ${inner / 2 - 0.5}px, #000 ${inner / 2}px)`,
          }}
        />
        <span
          className="absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)] pointer-events-none"
          style={{
            left: size / 2 + Math.sin((hsv.h * Math.PI) / 180) * (size / 2 - ring / 2),
            top: size / 2 - Math.cos((hsv.h * Math.PI) / 180) * (size / 2 - ring / 2),
            backgroundColor: hueHex,
          }}
        />
        <div
          className="absolute rounded-sm"
          style={{
            width: square,
            height: square,
            left: (size - square) / 2,
            top: (size - square) / 2,
            background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueHex})`,
          }}
        >
          <span
            className="absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full border-2 pointer-events-none"
            style={{
              left: (hsv.s / 100) * square,
              top: (1 - hsv.v / 100) * square,
              borderColor: hsv.v > 60 && hsv.s < 50 ? '#1B1626' : '#fff',
              backgroundColor: color,
            }}
          />
        </div>
      </div>

      {/* 滑条 */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-0.5 bg-(--ui-raised) rounded-lg p-0.5 border border-(--ui-border) w-fit">
          {(['hsv', 'rgb'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-2 h-5 rounded-md text-[10px] font-semibold ${mode === m ? 'bg-(--ui-accent) text-white' : 'text-(--ui-muted) hover:text-(--ui-strong)'}`}
            >
              {m.toUpperCase()}
            </button>
          ))}
        </div>
        {channels.map((ch) => (
          <ChannelSlider key={ch.key} ch={ch} onChange={onChange} />
        ))}
      </div>

      {/* 中间色：主色 → 副色 */}
      <Section title="中间色">
        <div className="flex h-6 rounded-md overflow-hidden border border-(--ui-border)">
          {mids.map((c, i) => (
            <button key={i} onClick={() => pick(c)} data-tip={c} className="flex-1 hover:scale-y-110 transition-transform" style={{ backgroundColor: c }} />
          ))}
        </div>
      </Section>

      {recent.length > 0 && (
        <Section title="最近">
          <div className="grid gap-1.5" style={grid(cols)}>
            {recent.slice(0, cols).map((c) => (
              <Swatch key={c} hex={c} active={normalizeHex(c) === cur} onClick={() => pick(c)} />
            ))}
          </div>
        </Section>
      )}

      {documentColors.length > 0 && (
        <Section title="文档用色">
          <div className="grid gap-1.5" style={grid(cols)}>
            {documentColors.map((c) => (
              <Swatch key={c} hex={c} active={c === cur} tip={c === normalizeHex(paperColor ?? '') ? `${c} · 当前纸色` : c} onClick={() => pick(c)} />
            ))}
          </div>
        </Section>
      )}

      <Section
        title="我的色板"
        extra={
          <button
            onClick={() => cur && !swatches.includes(cur) && saveSwatches([...swatches, cur])}
            data-tip="把主色存入色板 · 右键色块移除"
            className="flex items-center gap-0.5 text-(--ui-muted) hover:text-(--ui-strong)"
          >
            <Plus className="w-3 h-3" />
          </button>
        }
      >
        {swatches.length > 0 ? (
          <div className="grid gap-1.5" style={grid(cols)}>
            {swatches.map((c) => (
              <Swatch
                key={c}
                hex={c}
                active={c === cur}
                tip={`${c} · 右键移除`}
                onClick={() => pick(c)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  saveSwatches(swatches.filter((s) => s !== c));
                }}
              />
            ))}
          </div>
        ) : (
          <div className="text-[10px] text-(--ui-faint)">点 + 存下主色</div>
        )}
      </Section>

      <Section title="民俗色卡">
        <div className="grid gap-1.5" style={grid(cols)} data-tip="单击取色 · 双击改备注">
          {FOLK_PALETTE.map((c) => {
            const name = colorNotes[c.hex.toLowerCase()] || c.name;
            return (
              <div key={c.hex} className="relative">
                <Swatch
                  hex={c.hex}
                  round
                  active={normalizeHex(c.hex) === cur}
                  tip={`${name} ${c.hex}`}
                  onClick={() => pick(c.hex)}
                  onDoubleClick={() => setEditingNote(c.hex)}
                />
                {editingNote === c.hex && (
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-50 bg-(--ui-panel) border border-(--ui-border-strong) p-1 shadow-xl flex items-center min-w-[130px]">
                    <InlineName value={name} label="色卡备注" initialEditing allowEmpty
                      onCommit={note => onUpdateColorNote?.(c.hex, note)} onEditingEnd={() => setEditingNote(null)}
                      className="text-[10px] w-full" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
};
