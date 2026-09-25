/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** One sheet of a twin set: its name suffix and whether it sits above or below the current layer. */
export interface TwinPart {
  suffix: string;
  place: 'above' | 'below';
}

/** Layers that belong together at different depths, such as front and back hair. */
export interface TwinPreset {
  id: string;
  name: string;
  parts: TwinPart[];
}

export const DEFAULT_TWIN_PRESETS: TwinPreset[] = [
  { id: 'hair', name: '头发', parts: [{ suffix: '前发', place: 'above' }, { suffix: '后发', place: 'below' }] },
  { id: 'hat', name: '帽子', parts: [{ suffix: '前片', place: 'above' }, { suffix: '后片', place: 'below' }] },
];

const KEY = 'weave.twinPresets';

export function loadTwinPresets(): TwinPreset[] {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null') as TwinPreset[] | null;
    return Array.isArray(saved) ? saved : DEFAULT_TWIN_PRESETS;
  } catch {
    return DEFAULT_TWIN_PRESETS;
  }
}

export function storeTwinPresets(presets: TwinPreset[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(presets));
  } catch {
    /* storage unavailable */
  }
}
