/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CanvasBackground } from '../types/papercut';

export const DEFAULT_CANVAS_BG: CanvasBackground = { kind: 'transparent', display: 'grid' };
export const DEFAULT_GRID_COLOR = '#E2E7F3';
export const DEFAULT_GRID_LINE = 0.8;
export const DEFAULT_GRID_SIZE = 24;
export const DEFAULT_GRID_FILL = '#FAF8F2';

const CHECKERS = {
  light: ['#FFFFFF', '#E3E3E3'],
  dark: ['#4A4A4F', '#3A3A3F'],
};

/** What sits behind the paper on the artboard. Transparent modes are only a viewing aid. */
export const CanvasBackdrop: React.FC<{ bg?: CanvasBackground; width: number; height: number; zoom: number }> = ({
  bg = DEFAULT_CANVAS_BG,
  width,
  height,
  zoom,
}) => {
  if (bg.kind === 'solid') return <rect width={width} height={height} fill={bg.color} />;
  if (bg.display === 'none') return null;
  if (bg.display === 'white' || bg.display === 'black') {
    return <rect width={width} height={height} fill={bg.display === 'white' ? '#FFFFFF' : '#000000'} />;
  }
  if (bg.display === 'grid') {
    const size = Math.max(4, bg.gridSize ?? DEFAULT_GRID_SIZE);
    const stroke = Math.max(0.25, bg.gridLine ?? DEFAULT_GRID_LINE);
    const color = bg.gridColor ?? DEFAULT_GRID_COLOR;
    return (
      <>
        <defs>
          <pattern id="craft-grid" width={size} height={size} patternUnits="userSpaceOnUse">
            <path d={`M ${size} 0 L 0 0 0 ${size}`} fill="none" stroke={color} strokeWidth={stroke} />
          </pattern>
        </defs>
        <rect width={width} height={height} fill={DEFAULT_GRID_FILL} />
        <rect width={width} height={height} fill="url(#craft-grid)" opacity="0.85" />
      </>
    );
  }
  // Checker squares stay about 8 screen pixels at any zoom, as in SAI.
  const [a, b] = CHECKERS[bg.display];
  const s = 8 / zoom;
  return (
    <>
      <defs>
        <pattern id={`checker-${bg.display}`} width={s * 2} height={s * 2} patternUnits="userSpaceOnUse">
          <rect width={s * 2} height={s * 2} fill={a} />
          <rect width={s} height={s} fill={b} />
          <rect x={s} y={s} width={s} height={s} fill={b} />
        </pattern>
      </defs>
      <rect width={width} height={height} fill={`url(#checker-${bg.display})`} />
    </>
  );
};
