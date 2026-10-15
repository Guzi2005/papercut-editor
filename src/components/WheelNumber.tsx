/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { beginPropertyGesture,previewPropertyChange } from '../utils/propertyGesture';

interface WheelNumberProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
  icon?: React.ReactNode;
  tip: string;
  className?: string;
  variant?: 'default' | 'bare';
  dragStep?: number;
  disabled?: boolean;
}

/** Text at rest; wheel or scrub to adjust, double-click / Enter / F2 to type. */
export const WheelNumber: React.FC<WheelNumberProps> = ({
  value, min, max, step = 1, format, onChange, icon, tip, className = '',
  variant = 'bare', dragStep, disabled = false,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const latest = useRef({ value, onChange, disabled });
  latest.current = { value, onChange, disabled };
  const editingRef = useRef(editing);
  editingRef.current = editing;
  const cancelled = useRef(false);
  const stopDrag = useRef<((cancelled?: boolean) => void) | null>(null);
  const wheel = useRef<ReturnType<typeof beginPropertyGesture> | null>(null);
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishWheel = () => {
    if (wheelTimer.current) clearTimeout(wheelTimer.current);
    wheelTimer.current = null;
    wheel.current?.end();
    wheel.current = null;
  };
  useEffect(() => () => { stopDrag.current?.(); finishWheel(); }, []);

  const clamp = (v: number) => {
    const snapped = Math.round(v / step) * step;
    return Math.min(max, Math.max(min, +snapped.toFixed(6)));
  };
  const change = (next: number) => {
    if (next === latest.current.value) return;
    latest.current.value = next;
    previewPropertyChange(()=>latest.current.onChange(next));
  };

  // Native wheel listeners can prevent the sidebar from scrolling while adjusting a value.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (editingRef.current || latest.current.disabled || (!e.deltaY && !e.deltaX)) return;
      e.preventDefault();
      e.stopPropagation();
      stopDrag.current?.();
      const delta = e.deltaY || e.deltaX;
      const next = clamp(latest.current.value + (delta < 0 ? 1 : -1) * step * (e.shiftKey ? 10 : 1));
      if (next !== latest.current.value) {
        if(wheel.current&&!wheel.current.isActive())wheel.current=null;
        wheel.current ??= beginPropertyGesture('wheel');
        change(next);
      }
      if (wheelTimer.current) clearTimeout(wheelTimer.current);
      if (wheel.current) wheelTimer.current = setTimeout(finishWheel, 320);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => { el.removeEventListener('wheel', onWheel); finishWheel(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [min, max, step]);

  const startEdit = () => {
    if (editing || disabled) return;
    stopDrag.current?.();
    finishWheel();
    cancelled.current = false;
    setDraft(String(latest.current.value));
    setEditing(true);
  };
  const onPointerDown = (e: React.PointerEvent) => {
    if (editing || disabled || e.button !== 0) return;
    e.stopPropagation();
    stopDrag.current?.();
    finishWheel();
    const startX = e.clientX, startV = latest.current.value;
    let gesture: ReturnType<typeof beginPropertyGesture> | null = null;
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId || Math.abs(ev.clientX - startX) < 3) return;
      const next = clamp(startV + (ev.clientX - startX) * (dragStep ?? (max - min) / 160) * (ev.shiftKey ? 10 : 1));
      if (next !== latest.current.value) {
        gesture ??= beginPropertyGesture('scrub');
        change(next);
      }
    };
    const finish = (cancel = false) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancelPointer);
      window.removeEventListener('blur', blur);
      window.removeEventListener('keydown', key, true);
      stopDrag.current = null;
      if (gesture && cancel) change(startV);
      gesture?.end(cancel);
    };
    const up = (ev: PointerEvent) => { if (ev.pointerId === e.pointerId) finish(); };
    const cancelPointer = (ev: PointerEvent) => { if (ev.pointerId === e.pointerId) finish(true); };
    const blur = () => finish();
    const key = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); finish(true); }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancelPointer);
    window.addEventListener('blur', blur);
    window.addEventListener('keydown', key, true);
    stopDrag.current = finish;
  };
  const text = format ? format(value) : String(value);
  return <div ref={ref} data-property-control="" role={editing ? undefined : 'spinbutton'} tabIndex={editing || disabled ? undefined : 0}
    aria-label={editing ? undefined : tip} aria-valuenow={editing ? undefined : value}
    aria-valuemin={editing ? undefined : min} aria-valuemax={editing ? undefined : max}
    aria-valuetext={editing ? undefined : text} aria-disabled={disabled || undefined}
    data-tip={`${tip} · 滚轮 / 拖动调节 · 双击输入 · Shift ×10`}
    onPointerDown={onPointerDown} onDoubleClick={e => { e.stopPropagation(); startEdit(); }}
    onKeyDown={e => {
      if (editing || disabled) return;
      if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); e.stopPropagation(); startEdit(); return; }
      const dir = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? -1 : 0;
      if (dir) { e.preventDefault(); e.stopPropagation(); finishWheel(); change(clamp(value + dir * step * (e.shiftKey ? 10 : 1))); }
    }}
    style={{ touchAction: 'none' }}
    className={`h-7 pointer-coarse:h-9 flex items-center gap-1 px-1.5 text-(--ui-text-2) select-none outline-none focus-visible:ring-1 focus-visible:ring-(--ui-accent) ${disabled ? 'opacity-40' : 'cursor-ew-resize'} ${editing ? 'bg-(--ui-input) border-b border-(--ui-accent)' : variant === 'bare' ? 'border-b border-transparent hover:border-(--ui-border-strong) hover:text-(--ui-accent)' : 'border border-(--ui-border) hover:border-(--ui-accent)'} ${className}`}>
    <button type="button" disabled={disabled} aria-label={`减小${tip}`} onPointerDown={e => e.stopPropagation()}
      onClick={() => change(clamp(value - step))} className="hidden pointer-coarse:flex w-7 h-7 items-center justify-center text-(--ui-muted) active:bg-(--ui-hover)">−</button>
    {icon && <span className="text-(--ui-muted) flex items-center">{icon}</span>}
    {editing ? <input autoFocus aria-label={tip} value={draft} inputMode="decimal"
      onFocus={e => e.currentTarget.select()} onChange={e => setDraft(e.target.value)}
      onPointerDown={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()}
      onBlur={() => {
        const next = Number(draft.trim());
        if (!cancelled.current && draft.trim() && Number.isFinite(next)) change(clamp(next));
        setEditing(false);
      }}
      onKeyDown={e => {
        e.stopPropagation();
        if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
        if (e.key === 'Escape') { e.preventDefault(); cancelled.current = true; setEditing(false); }
      }}
      className="w-[6ch] min-w-0 bg-transparent outline-none text-[11px] font-mono text-(--ui-strong)" />
      : <span className="text-[11px] font-mono tabular-nums text-(--ui-strong) min-w-[2.2em] text-right">{text}</span>}
    <button type="button" disabled={disabled} aria-label={`增大${tip}`} onPointerDown={e => e.stopPropagation()}
      onClick={() => change(clamp(value + step))} className="hidden pointer-coarse:flex w-7 h-7 items-center justify-center text-(--ui-muted) active:bg-(--ui-hover)">+</button>
  </div>;
};
