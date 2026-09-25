/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { PATHFINDER_OPS, PathfinderOp } from '../utils/pathfinder';

/** Two overlapping squares, back at top-left and front at bottom-right, drawn per operation. */
const OpGlyph: React.FC<{ op: PathfinderOp }> = ({ op }) => {
  const back = 'M2 2h8v8H2z';
  const front = 'M6 6h8v8H6z';
  const overlap = 'M6 6h4v4H6z';
  const solid = { fill: 'currentColor' };
  const outline = { fill: 'none', stroke: 'currentColor', strokeWidth: 1, opacity: 0.55 };
  return (
    <svg viewBox="0 0 16 16" className="w-4 h-4">
      {op === 'unite' && <path d="M2 2h8v4h4v8H6v-4H2z" {...solid} />}
      {op === 'minusFront' && (
        <>
          <path d="M2 2h8v4H6v4H2z" {...solid} />
          <path d={front} {...outline} />
        </>
      )}
      {op === 'intersect' && (
        <>
          <path d={back} {...outline} />
          <path d={front} {...outline} />
          <path d={overlap} {...solid} />
        </>
      )}
      {op === 'exclude' && <path d="M2 2h8v4H6v4H2z M10 6h4v8H6v-4h4z" {...solid} />}
      {op === 'trim' && (
        <>
          <path d="M2 2h8v4H6v4H2z" {...solid} opacity={0.55} />
          <path d={front} {...solid} />
        </>
      )}
      {op === 'divide' && (
        <>
          <path d="M2 2h8v4H6v4H2z" {...solid} opacity={0.55} />
          <path d={front} {...solid} />
          <path d="M6 10h4V6" fill="none" stroke="var(--ui-panel)" strokeWidth={1.2} />
        </>
      )}
    </svg>
  );
};

/** Floating shape-builder bar for two or more selected colour blocks. */
export const PathfinderBar: React.FC<{ count: number; onApply: (op: PathfinderOp) => void }> = ({ count, onApply }) => (
  <div
    onPointerDown={(e) => e.stopPropagation()}
    className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-0.5 p-1 rounded-xl bg-(--ui-panel)/95 border border-(--ui-border-strong) shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-150"
  >
    <span className="px-1.5 text-[10px] text-(--ui-muted) whitespace-nowrap">{count} 块</span>
    {PATHFINDER_OPS.map((o) => (
      <button
        key={o.id}
        onClick={() => onApply(o.id)}
        data-tip={`${o.label}：${o.tip}`}
        className="h-7 px-1.5 flex items-center gap-1 rounded-lg text-[11px] text-(--ui-text-2) hover:bg-(--ui-hover) hover:text-(--ui-strong) transition-colors"
      >
        <OpGlyph op={o.id} />
        <span className="hidden xl:inline">{o.label}</span>
      </button>
    ))}
  </div>
);
