/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface TipState {
  text: string;
  x: number;
  y: number;
  place: 'above' | 'below' | 'right';
}

const DELAY_MS = 350;

/**
 * One app-wide tooltip for every element carrying `data-tip`. It renders into document.body
 * with fixed positioning, so it is never clipped by scrolling panels or toolbars.
 */
export const TooltipLayer: React.FC = () => {
  const [tip, setTip] = useState<TipState | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const current = useRef<Element | null>(null);

  useEffect(() => {
    const hide = () => {
      window.clearTimeout(timer.current);
      current.current = null;
      setTip(null);
    };
    const onOver = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.('[data-tip]') || null;
      if (el === current.current) return;
      hide();
      if (!el) return;
      const text = el.getAttribute('data-tip');
      if (!text) return;
      current.current = el;
      timer.current = window.setTimeout(() => {
        if (!el.isConnected) return;
        const r = el.getBoundingClientRect();
        if (el.getAttribute('data-tip-side') === 'right') {
          setTip({ text, x: r.right + 8, y: r.top + r.height / 2, place: 'right' });
          return;
        }
        const below = r.top < 64;
        setTip({ text, x: r.left + r.width / 2, y: below ? r.bottom + 8 : r.top - 8, place: below ? 'below' : 'above' });
      }, DELAY_MS);
    };
    document.addEventListener('mouseover', onOver);
    document.addEventListener('pointerdown', hide, true);
    window.addEventListener('blur', hide);
    return () => {
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('pointerdown', hide, true);
      window.removeEventListener('blur', hide);
      window.clearTimeout(timer.current);
    };
  }, []);

  if (!tip) return null;
  const left = tip.place === 'right' ? tip.x : Math.min(Math.max(tip.x, 130), window.innerWidth - 130);
  const transform =
    tip.place === 'right' ? 'translate(0, -50%)' : `translate(-50%, ${tip.place === 'below' ? '0' : '-100%'})`;
  return createPortal(
    <div
      className="fixed z-[1000] pointer-events-none px-2 py-1 rounded-md text-[11px] leading-snug max-w-[240px] shadow-xl border bg-(--ui-panel) text-(--ui-strong) border-(--ui-border-strong)"
      style={{
        left,
        top: tip.y,
        transform,
      }}
    >
      {tip.text}
    </div>,
    document.body
  );
};
