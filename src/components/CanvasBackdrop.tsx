/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CanvasBackground } from '../types/papercut';

export const DEFAULT_CANVAS_BG: CanvasBackground = { kind: 'transparent', display: 'grid' };

const CHECKERS = {
  light: ['#FFFFFF', '#E3E3E3'],
  dark: ['#4A4A4F', '#3A3A3F'],
};

/** What sits behind the paper on the artboard. Transparent modes are only a viewing aid. */
export const CanvasBackdrop: React.FC<{ bg?: CanvasBackground; width: number; height: number; zoom: number }> = ({ bg = DEFAULT_CANVAS_BG, width, height, zoom }) => {
  if (bg.kind === 'solid') return <rect width={width} height={height} fill={bg.color} />;
  if (bg.display === 'white' || bg.display === 'black') {
    return <rect width={width} height={height} fill={bg.display === 'white' ? '#FFFFFF' : '#000000'} />;
  }
  if (bg.display === 'grid') {
    return (
      <>
        <defs>
          <pattern id="craft-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#E2E7F3" strokeWidth="0.8" />
          </pattern>
        </defs>
        <rect width={width} height={height} fill="#FAF8F2" />
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
