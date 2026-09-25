/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type SaveStatus = 'saving' | 'saved' | 'dirty';

export interface SaveSettings {
  auto: boolean;
  /** edit: shortly after each change settles · interval: on a fixed clock, only when something changed */
  trigger: 'edit' | 'interval';
  /** Seconds to wait after the last edit. */
  delay: number;
  /** Minutes between timed saves. */
  interval: number;
  /** Also write the linked document to a .weave.json file on disk (File System Access API). */
  toFile: boolean;
  banner: boolean;
  warnOnLeave: boolean;
}

export const DEFAULT_SAVE_SETTINGS: SaveSettings = {
  auto: true,
  trigger: 'edit',
  delay: 3,
  interval: 2,
  toFile: false,
  banner: true,
  warnOnLeave: true,
};

export const DELAY_OPTIONS = [1, 3, 10, 30];
export const INTERVAL_OPTIONS = [1, 2, 5, 10];

const KEY = 'weave.saveSettings';

export function loadSaveSettings(): SaveSettings {
  try {
    return { ...DEFAULT_SAVE_SETTINGS, ...(JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<SaveSettings>) };
  } catch {
    return { ...DEFAULT_SAVE_SETTINGS };
  }
}

export function storeSaveSettings(s: SaveSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable */
  }
}

export const fileSaveSupported = () => typeof window !== 'undefined' && 'showSaveFilePicker' in window;

export function describeSaveSettings(s: SaveSettings): string {
  if (!s.auto) return '手动';
  return s.trigger === 'edit' ? `编辑后 ${s.delay} 秒` : `每 ${s.interval} 分钟`;
}
