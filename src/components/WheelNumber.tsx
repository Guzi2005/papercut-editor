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
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const latest = useRef({ value, onChange });
  latest.current = { value, onChange };

  const clamp = (v: number) => {
    const snapped = Math.round(v / step) * step;
    return Math.min(max, Math.max(min, +snapped.toFixed(4)));
  };

  // React's wheel listener is passive, so preventDefault needs a native listener.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dir = e.deltaY < 0 || e.deltaX < 0 ? 1 : -1;
      const { value: v, onChange: cb } = latest.current;
      cb(clamp(v + dir * step * (e.shiftKey ? 10 : 1)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [min, max, step]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (editing || e.button !== 0) return;
    const startX = e.clientX;
    const startV = value;
    const range = max - min;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      if (Math.abs(dx) < 2) return;
      latest.current.onChange(clamp(startV + (dx / 160) * range));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const text = format ? format(value) : String(value);

  return (
    <div
      ref={ref}
      data-tip={`${tip} · 滚轮调节`}
      onPointerDown={onPointerDown}
      onDoubleClick={() => {
        setDraft(String(value));
        setEditing(true);
      }}
      style={{ touchAction: 'none' }}
      className={`h-7 pointer-coarse:h-9 flex items-center gap-1 px-2 pointer-coarse:px-1 rounded-lg bg-(--ui-raised) border border-(--ui-border) text-(--ui-text-2) cursor-ew-resize select-none hover:border-(--ui-accent) ${className}`}
    >
      <button
        type="button"
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
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const v = parseFloat(draft);
            if (!Number.isNaN(v)) onChange(clamp(v));
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') setEditing(false);
          }}
          className="w-10 bg-transparent outline-none text-[11px] font-mono text-(--ui-strong)"
        />
      ) : (
        <span className="text-[11px] font-mono tabular-nums text-(--ui-strong) min-w-[2.2em] text-right">{text}</span>
      )}
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onChange(clamp(value + step))}
        className="hidden pointer-coarse:flex w-7 h-7 items-center justify-center rounded-md text-(--ui-muted) active:bg-(--ui-hover)"
      >
        +
      </button>
    </div>
  );
};
