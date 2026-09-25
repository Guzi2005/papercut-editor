/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

const SIZE_PRESETS = [
  { w: 800, h: 800 },
  { w: 1000, h: 800 },
  { w: 750, h: 1000 },
  { w: 1920, h: 1080 },
] as const;

export { SIZE_PRESETS };

/** Size preset whose outer shape mirrors the canvas aspect ratio. */
export const AspectSizeButton: React.FC<{
  w: number;
  h: number;
  active?: boolean;
  onClick: () => void;
  className?: string;
}> = ({ w, h, active, onClick, className = '' }) => {
  const maxSide = 56;
  const ratio = w / h;
  const boxW = ratio >= 1 ? maxSide : Math.max(28, Math.round(maxSide * ratio));
  const boxH = ratio <= 1 ? maxSide : Math.max(28, Math.round(maxSide / ratio));
  return (
    <button
      type="button"
      onClick={onClick}
      data-tip={`${w} × ${h}`}
      className={`flex flex-col items-center justify-center gap-1 p-1.5 rounded-xl border transition-colors ${
        active
          ? 'border-(--ui-accent) bg-(--ui-hover) text-(--ui-strong)'
          : 'border-(--ui-border) text-(--ui-text-2) hover:border-(--ui-border-strong) hover:text-(--ui-strong)'
      } ${className}`}
    >
      <span
        className={`flex items-center justify-center rounded-md border ${
          active ? 'border-(--ui-accent)/60 bg-(--ui-accent)/15' : 'border-(--ui-border-strong) bg-(--ui-raised)'
        }`}
        style={{ width: boxW, height: boxH }}
      >
        <span className="font-mono text-[9px] leading-tight text-center px-0.5">
          {w}
          <br />×
          <br />
          {h}
        </span>
      </span>
    </button>
  );
};
