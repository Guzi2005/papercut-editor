/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Maximize, Sparkles } from 'lucide-react';
import { LayerSurface, SurfaceTextureType } from '../types/papercut';
import { WheelNumber } from './WheelNumber';
import {
  SURFACE_LABELS,
  SURFACE_OPTIONS,
  SURFACE_PRESETS,
  defaultSurface,
  surfaceTint,
} from '../utils/paperSurface';
import { isLight, normalizeHex } from '../utils/color';

/** Surface texture control in the layer dock (foil / crinkle / xuan / tape). */
export const TextureButton: React.FC<{
  surface?: LayerSurface;
  paperColor: string;
  onChange: (surface: LayerSurface | undefined) => void;
}> = ({ surface, paperColor, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = !!surface;
  const tint = surface ? surfaceTint(surface, paperColor) : paperColor;
  const set = (patch: Partial<LayerSurface>) => {
    if (!surface) return;
    onChange({ ...surface, ...patch });
  };

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);

  const pickType = (id: SurfaceTextureType | 'none') => {
    if (id === 'none') {
      onChange(undefined);
      return;
    }
    onChange(surface?.type === id ? surface : defaultSurface(id, paperColor));
  };

  const presets = surface ? SURFACE_PRESETS[surface.type] : [];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-tip={active ? `纹理：${SURFACE_LABELS[surface!.type]}` : '纹理：无'}
        className={`h-7 flex items-center gap-1 px-1.5 rounded-lg border text-[11px] transition-colors ${
          active ? 'bg-(--ui-accent)/20 border-(--ui-accent)/60 text-(--ui-strong)' : 'bg-(--ui-raised) border-(--ui-border) text-(--ui-muted) hover:text-(--ui-strong)'
        }`}
      >
        <Sparkles className="w-3 h-3" style={active ? { color: tint } : undefined} />
        纹理
      </button>
      {open && (
        <div className="absolute bottom-full right-0 mb-2 z-50 w-56 p-2 rounded-xl bg-(--ui-panel) border border-(--ui-border-strong) shadow-2xl text-xs space-y-2">
          <div className="grid grid-cols-3 gap-1">
            {SURFACE_OPTIONS.map((o) => {
              const on = o.id === 'none' ? !surface : surface?.type === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => pickType(o.id)}
                  className={`h-7 rounded-lg text-[11px] transition-colors ${
                    on ? 'bg-(--ui-accent) text-white' : 'bg-(--ui-raised) text-(--ui-muted) hover:text-(--ui-strong)'
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>

          {surface && (
            <>
              <div className="text-[10px] text-(--ui-faint) px-0.5">色彩</div>
              <div className="flex flex-wrap gap-1.5">
                {presets.map((p) => {
                  const inherit = p.id === 'inherit';
                  const swatch = inherit ? paperColor : p.color!;
                  const selected = inherit ? surface.inheritColor : !surface.inheritColor && normalizeHex(surface.color) === normalizeHex(swatch);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        onChange(
                          inherit
                            ? { ...surface, inheritColor: true, color: paperColor }
                            : { ...surface, inheritColor: false, color: p.color! }
                        )
                      }
                      data-tip={p.label}
                      className={`relative w-7 h-7 rounded-lg border-2 transition-transform hover:scale-105 ${
                        selected ? 'border-(--ui-accent)' : isLight(swatch) ? 'border-black/20' : 'border-white/25'
                      }`}
                      style={{
                        background: inherit
                          ? `linear-gradient(135deg, ${paperColor} 50%, transparent 50%), linear-gradient(135deg, transparent 50%, #888 50%)`
                          : swatch,
                      }}
                    />
                  );
                })}
                <label
                  className="relative w-7 h-7 rounded-lg border border-white/30 cursor-pointer overflow-hidden"
                  style={{ backgroundColor: tint }}
                  data-tip="自定义颜色"
                >
                  <input
                    type="color"
                    value={(normalizeHex(tint) || '#888888').toLowerCase()}
                    onChange={(e) => onChange({ ...surface, inheritColor: false, color: e.target.value })}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </label>
              </div>
              <div className="flex items-center gap-1.5">
                <WheelNumber
                  tip="纹理强度"
                  icon={<Sparkles className="w-3 h-3" />}
                  value={Math.round(surface.intensity * 100)}
                  min={10}
                  max={100}
                  step={5}
                  format={(v) => `${v}%`}
                  onChange={(v) => set({ intensity: v / 100 })}
                />
                <WheelNumber
                  tip="纹理尺度"
                  icon={<Maximize className="w-3 h-3" />}
                  value={Math.round(surface.scale * 100)}
                  min={40}
                  max={250}
                  step={10}
                  format={(v) => `${v}%`}
                  onChange={(v) => set({ scale: v / 100 })}
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
