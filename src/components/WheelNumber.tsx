/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';

interface WheelNumberProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  /** Display transform, e.g. 0.85 → "85%" */
  format?: (v: number) => string;
  onChange: (v: number) => void;
  icon?: React.ReactNode;
  tip: string;
  className?: string;
  variant?: 'default' | 'bare';
  /** Numeric change per horizontal pixel; useful for values with very wide valid ranges. */
  dragStep?: number;
}

/**
 * Compact numeric control: scroll the wheel over it (Shift = ×10), drag sideways to scrub,
 * or double-click to type. Replaces range sliders so option strips stay one line.
 */
export const WheelNumber: React.FC<WheelNumberProps> = ({
  value,
  min,
  max,
  step = 1,
  format,
  onChange,
  icon,
  tip,
  className = '',
  variant = 'default',
  dragStep,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const latest = useRef({ value, onChange });
  latest.current = { value, onChange };
  const editingRef=useRef(editing);
  editingRef.current=editing;
  const cancelled=useRef(false),stopDrag=useRef<(()=>void)|null>(null);
  useEffect(()=>()=>stopDrag.current?.(),[]);

  const clamp = (v: number) => {
    const snapped = Math.round(v / step) * step;
    return Math.min(max, Math.max(min, +snapped.toFixed(4)));
  };

  // React's wheel listener is passive, so preventDefault needs a native listener.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if(editingRef.current||(!e.deltaY&&!e.deltaX))return;
      e.preventDefault();
      const dir = e.deltaY < 0 || e.deltaX < 0 ? 1 : -1;
      const { value: v, onChange: cb } = latest.current;
      const next=clamp(v + dir * step * (e.shiftKey ? 10 : 1));
      if(next!==v)cb(next);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [min, max, step]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (editing || e.button !== 0) return;
    stopDrag.current?.();
    const startX = e.clientX;
    const startV = value;
    const range = max - min;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      if (Math.abs(dx) < 2) return;
      const next=clamp(startV + dx * (dragStep ?? range/160) * (ev.shiftKey?10:1));
      if(next!==latest.current.value)latest.current.onChange(next);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('blur', up);
      stopDrag.current=null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('blur', up);
    stopDrag.current=up;
  };

  const text = format ? format(value) : String(value);

  return (
    <div
      ref={ref}
      role={editing?undefined:'spinbutton'} tabIndex={editing?undefined:0}
      aria-label={editing?undefined:tip} aria-valuenow={editing?undefined:value} aria-valuemin={editing?undefined:min} aria-valuemax={editing?undefined:max}
      aria-valuetext={editing?undefined:text}
      data-tip={`${tip} · 滚轮 / 拖动调节 · 双击输入 · Shift ×10`}
      onPointerDown={onPointerDown}
      onDoubleClick={() => {
        if(editing)return;
        cancelled.current=false;
        setDraft(String(value));
        setEditing(true);
      }}
      onKeyDown={e=>{
        if(editing)return;
        if(e.key==='Enter'||e.key==='F2'){e.preventDefault();e.stopPropagation();cancelled.current=false;setDraft(String(value));setEditing(true);return;}
        const dir=e.key==='ArrowUp'||e.key==='ArrowRight'?1:e.key==='ArrowDown'||e.key==='ArrowLeft'?-1:0;
        if(dir){e.preventDefault();e.stopPropagation();const next=clamp(value+dir*step*(e.shiftKey?10:1));if(next!==value)onChange(next);}
      }}
      style={{ touchAction: 'none' }}
      className={`h-7 pointer-coarse:h-9 flex items-center gap-1 px-2 pointer-coarse:px-1 text-(--ui-text-2) cursor-ew-resize select-none outline-none focus-visible:ring-1 focus-visible:ring-(--ui-accent) ${variant==='bare'?'hover:bg-(--ui-hover)':'rounded-lg bg-(--ui-raised) border border-(--ui-border) hover:border-(--ui-accent)'} ${className}`}
    >
      <button
        type="button"
        aria-label={`减小${tip}`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onChange(clamp(value - step))}
        className="hidden pointer-coarse:flex w-7 h-7 items-center justify-center rounded-md text-(--ui-muted) active:bg-(--ui-hover)"
      >
        −
      </button>
      {icon && <span className="text-(--ui-muted) flex items-center">{icon}</span>}
      {editing ? (
        <input
          autoFocus
          aria-label={tip}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onDoubleClick={e=>e.stopPropagation()}
          onBlur={() => {
            const v = parseFloat(draft);
            if (!cancelled.current&&Number.isFinite(v)&&clamp(v)!==value) onChange(clamp(v));
            setEditing(false);
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') {cancelled.current=true;setEditing(false);}
          }}
          className="w-10 bg-transparent outline-none text-[11px] font-mono text-(--ui-strong)"
        />
      ) : (
        <span className="text-[11px] font-mono tabular-nums text-(--ui-strong) min-w-[2.2em] text-right">{text}</span>
      )}
      <button
        type="button"
        aria-label={`增大${tip}`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onChange(clamp(value + step))}
        className="hidden pointer-coarse:flex w-7 h-7 items-center justify-center rounded-md text-(--ui-muted) active:bg-(--ui-hover)"
      >
        +
      </button>
    </div>
  );
};
