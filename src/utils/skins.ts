/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';

export type WorkbenchSkin = 'indigo' | 'songyan' | 'xuan' | 'linen';

interface SkinColors {
  app: string;
  panel: string;
  panel2: string;
  input: string;
  raised: string;
  hover: string;
  divider: string;
  border: string;
  borderStrong: string;
  strong: string;
  text: string;
  text2: string;
  muted: string;
  faint: string;
  accent: string;
  accentHover: string;
  accentGlow: string;
  accent2: string;
  grid: string;
  accentFill?: string;
  accentInk?: string;
  accentFillHover?: string;
}

export interface SkinDefinition {
  id: WorkbenchSkin;
  name: string;
  tone: 'dark' | 'light';
  desc: string;
  colors: SkinColors;
}

const dark = (c: Partial<SkinColors> & Pick<SkinColors, 'accent' | 'accentHover' | 'accentGlow' | 'accent2'>, base: Partial<SkinColors> = {}): SkinColors => ({
  app: '#111520',
  panel: '#161B29',
  panel2: '#121622',
  input: '#0F131D',
  raised: '#1C2335',
  hover: '#262F45',
  divider: '#263147',
  border: '#2B364D',
  borderStrong: '#3A4766',
  strong: '#FBFBFC',
  text: '#CAD0DB',
  text2: '#BAC5EB',
  muted: '#8E9FCA',
  faint: '#5E6E94',
  grid: '#405073',
  ...base,
  ...c,
});

export const SKINS: SkinDefinition[] = [
  {
    id: 'indigo',
    name: '黑白青卡片',
    tone: 'light',
    desc: '浅灰工作台与柔和炭灰按钮，青色标记交互状态',
    colors: {
      app: '#E8EAEB', panel: '#F3F4F4', panel2: '#FAFAFA', input: '#FFFFFF', raised: '#E0E3E4', hover: '#D7EDF0',
      divider: '#D9D9D9', border: '#C8C8C8', borderStrong: '#505050', strong: '#242424', text: '#303030', text2: '#626262',
      muted: '#686E70', faint: '#858C8F', accent: '#343A3D', accentHover: '#4B5458', accentGlow: '#9ADFE8', accent2: '#246F7A',
      grid: '#D2D2D2', accentFill: '#343A3D', accentInk: '#FFFFFF', accentFillHover: '#4B5458',
    },
  },
  {
    id: 'songyan',
    name: '苔纸荧光',
    tone: 'light',
    desc: '浅色：暖米纸、淡薄荷与墨黑，青柠荧光和珊瑚点缀',
    // Reference coral #D58B80 is deepened to a readable #A65348 for text and lines.
    colors: {
      app: '#F0EBE1', panel: '#D4E0DA', panel2: '#EAF0EA', input: '#FFFDF8', raised: '#E9E4D8', hover: '#C6D6CC',
      divider: '#C2CEC5', border: '#B5C3B9', borderStrong: '#93A294', strong: '#20231F', text: '#2E352D', text2: '#3E4A40',
      muted: '#55635A', faint: '#748277', accent: '#52651D', accentHover: '#3F4F16', accentGlow: '#C5FF39', accent2: '#A65348',
      grid: '#B9C4B7', accentFill: '#C5FF39', accentInk: '#20231F', accentFillHover: '#AEE62B',
    },
  },
  {
    id: 'xuan',
    name: '宣纸素白',
    tone: 'light',
    desc: '浅色：米白宣纸与靛蓝',
    colors: {
      app: '#E4DED3', panel: '#F6F2EA', panel2: '#EEE8DD', input: '#FFFFFF', raised: '#EBE5D9', hover: '#E0D8CA',
      divider: '#DDD4C5', border: '#D2C8B7', borderStrong: '#B9AD99', strong: '#1E1B26', text: '#3A3645', text2: '#3F4775',
      muted: '#6D6878', faint: '#9C95A2', accent: '#2E58D6', accentHover: '#2248B8', accentGlow: '#4D74E6', accent2: '#C0584F', grid: '#C9BFAE',
    },
  },
  {
    id: 'linen',
    name: '亚麻织布',
    tone: 'light',
    desc: '浅色：亚麻灰与桑葚绛',
    colors: {
      app: '#D9D6D0', panel: '#F2F0EC', panel2: '#E8E5DF', input: '#FFFFFF', raised: '#E4E0D9', hover: '#D8D3CA',
      divider: '#D2CCC2', border: '#C7C0B4', borderStrong: '#ACA496', strong: '#221A20', text: '#3B3339', text2: '#52253A',
      muted: '#6F6670', faint: '#9E959C', accent: '#52253A', accentHover: '#401B2D', accentGlow: '#7A3D57', accent2: '#2E58D6', grid: '#C2BAAE',
    },
  },
];

export function skinVariables(id: WorkbenchSkin): React.CSSProperties {
  const skin = SKINS.find((s) => s.id === id) || SKINS[0];
  const c = skin.colors;
  return {
    '--ui-app': c.app,
    '--ui-panel': c.panel,
    '--ui-panel-2': c.panel2,
    '--ui-input': c.input,
    '--ui-raised': c.raised,
    '--ui-hover': c.hover,
    '--ui-divider': c.divider,
    '--ui-border': c.border,
    '--ui-border-strong': c.borderStrong,
    '--ui-strong': c.strong,
    '--ui-text': c.text,
    '--ui-text-2': c.text2,
    '--ui-muted': c.muted,
    '--ui-faint': c.faint,
    '--ui-accent': c.accent,
    '--ui-accent-hover': c.accentHover,
    '--ui-accent-glow': c.accentGlow,
    '--ui-accent-2': c.accent2,
    '--ui-accent-fill': c.accentFill ?? c.accent,
    '--ui-accent-ink': c.accentInk ?? '#FFFFFF',
    '--ui-accent-fill-hover': c.accentFillHover ?? c.accentHover,
    '--ui-grid': c.grid,
    colorScheme: skin.tone,
  } as React.CSSProperties;
}

const SKIN_KEY = 'weave-skin';

export function loadSkin(): WorkbenchSkin {
  const saved = localStorage.getItem(SKIN_KEY) as WorkbenchSkin | null;
  return saved && SKINS.some((s) => s.id === saved) ? saved : 'linen';
}

export function saveSkin(id: WorkbenchSkin) {
  localStorage.setItem(SKIN_KEY, id);
}
