/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { FOLK_PALETTE } from '../utils/presetTemplates';

interface RecentColorsBarProps {
  recentColors: string[];
  activeColor: string;
  onSelectColor: (hex: string) => void;
  colorNotes?: Record<string, string>;
}

export const RecentColorsBar: React.FC<RecentColorsBarProps> = ({
  recentColors,
  activeColor,
  onSelectColor,
  colorNotes = {},
}) => {
  const getColorName = (hex: string) => {
    if (colorNotes[hex.toLowerCase()]) {
      return colorNotes[hex.toLowerCase()];
    }
    const found = FOLK_PALETTE.find(
      (p) => p.hex.toLowerCase() === hex.toLowerCase()
    );
    return found ? found.name : hex.toUpperCase();
  };

  const getNote = (hex: string) => {
    return colorNotes[hex.toLowerCase()] || '';
  };

  return (
    <div className="h-11 shrink-0 bg-[#121622] border-t border-[#263147] flex items-end justify-center select-none gap-1.5 px-3 relative z-20">
      <span className="self-center mr-2 text-[10px] text-[#5E6E94]">近期用色</span>
      {/* Rectangular / Square Bookmarks anchored to bottom, substantial height (不要太短乃至成悬浮样) */}
      {recentColors.map((hex) => {
        const isSelected = activeColor.toLowerCase() === hex.toLowerCase();
        const name = getColorName(hex);
        const note = getNote(hex);

        return (
          <button
            key={hex}
            onClick={() => onSelectColor(hex)}
            className={`relative group rounded-none transition-all duration-200 ease-out flex flex-col items-center justify-start cursor-pointer shadow-2xl ${
              isSelected
                ? 'h-9 w-9 z-20 ring-2 ring-white/95 shadow-blue-950/80'
                : 'h-6 w-8 hover:h-8 opacity-90 hover:opacity-100 z-10'
            }`}
            style={{
              backgroundColor: hex,
              borderTop: '2.5px solid rgba(255,255,255,0.4)',
              borderLeft: '1px solid rgba(255,255,255,0.18)',
              borderRight: '1px solid rgba(255,255,255,0.18)',
              borderBottom: 'none',
            }}
          >
            {/* Top stitch mark */}
            <div className="w-3.5 h-0.5 bg-white/45 mt-1 rounded-none" />

            {/* Note tooltip: ONLY appears on hover (其备注只有hover时才浮现，带轻微动效) */}
            <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center pointer-events-none z-50 whitespace-nowrap animate-in fade-in zoom-in-95 duration-100">
              <div className="bg-[#121622]/98 backdrop-blur-md px-2.5 py-1 text-white text-[10px] shadow-2xl border border-[#3A4766] rounded-md flex flex-col items-center gap-0.5">
                <div className="flex items-center gap-1.5 font-semibold text-[#BAC5EB]">
                  <span
                    className="w-2 h-2 inline-block border border-white/50"
                    style={{ backgroundColor: hex }}
                  />
                  <span>{name}</span>
                </div>
                {note && note !== name && (
                  <span className="text-[9px] text-[#8E9FCA] max-w-[130px] truncate">
                    {note}
                  </span>
                )}
                <span className="text-[8px] font-mono text-[#6C7D9E] uppercase">
                  {hex}
                </span>
              </div>
              {/* Pointer triangle */}
              <div className="w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-[#121622] -mt-px" />
            </div>
          </button>
        );
      })}
    </div>
  );
};
