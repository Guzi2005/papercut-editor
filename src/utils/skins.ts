/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';

export type WorkbenchSkin =
  | 'indigo'
  | 'cinnabar'
  | 'celadon'
  | 'wisteria'
  | 'ebony'
  | 'xuan'
  | 'linen';

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
    name: '扎染蓝印',
    tone: 'dark',
    desc: '靛青与紫藤，默认工作台',
    colors: dark({ accent: '#2652D0', accentHover: '#1E43B8', accentGlow: '#3A6DF0', accent2: '#EB8E88' }),
  },
  {
    id: 'cinnabar',
    name: '朱砂玄墨',
    tone: 'dark',
    desc: '印泥朱红配玄墨案台',
    colors: dark(
      { accent: '#C23A30', accentHover: '#A52F27', accentGlow: '#E0564A', accent2: '#E3A548' },
      {
        app: '#150F10', panel: '#1C1416', panel2: '#171012', input: '#110B0C', raised: '#241A1C', hover: '#312326',
        divider: '#35272A', border: '#3D2D30', borderStrong: '#523C40', text: '#DACBCB', text2: '#E7C9C4', muted: '#B08F8C', faint: '#7A605E', grid: '#5A3A3C',
      }
    ),
  },
  {
    id: 'celadon',
    name: '青绿山水',
    tone: 'dark',
    desc: '冷杉深翠与湖水青绿',
    colors: dark(
      { accent: '#2F7A5E', accentHover: '#25644C', accentGlow: '#43A07E', accent2: '#E3C07A' },
      {
        app: '#0D1512', panel: '#121C18', panel2: '#0F1714', input: '#0A110E', raised: '#18251F', hover: '#20322A',
        divider: '#23362D', border: '#2A4036', borderStrong: '#3A5749', text: '#C9D8D0', text2: '#B4D4C4', muted: '#86A999', faint: '#587565', grid: '#2F5343',
      }
    ),
  },
  {
    id: 'wisteria',
    name: '紫藤花影',
    tone: 'dark',
    desc: '深绛紫茄配丁香粉藕',
    colors: dark(
      { accent: '#7A56C4', accentHover: '#6545A8', accentGlow: '#9577DC', accent2: '#E48CB0' },
      {
        app: '#15101B', panel: '#1B1522', panel2: '#17111D', input: '#110C16', raised: '#231B2D', hover: '#2E2439',
        divider: '#33283F', border: '#3A2E48', borderStrong: '#4F4062', text: '#D6CCE0', text2: '#CDBDEB', muted: '#A08FBF', faint: '#6E6088', grid: '#4A3A63',
      }
    ),
  },
  {
    id: 'ebony',
    name: '暖木纸香',
    tone: 'dark',
    desc: '乌木刻台配蜜蜡明黄',
    colors: dark(
      { accent: '#B97A1C', accentHover: '#9C6615', accentGlow: '#D6962F', accent2: '#E48C8C' },
      {
        app: '#16120E', panel: '#1D1813', panel2: '#18140F', input: '#120E0B', raised: '#262019', hover: '#322A21',
        divider: '#372E24', border: '#40362A', borderStrong: '#574A39', text: '#DCD2C4', text2: '#E6D5B8', muted: '#AF9C80', faint: '#7A6B57', grid: '#5A4A36',
      }
    ),
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
    '--ui-grid': c.grid,
    colorScheme: skin.tone,
  } as React.CSSProperties;
}

const SKIN_KEY = 'weave-skin';

export function loadSkin(): WorkbenchSkin {
  const saved = localStorage.getItem(SKIN_KEY) as WorkbenchSkin | null;
  return saved && SKINS.some((s) => s.id === saved) ? saved : 'indigo';
}

export function saveSkin(id: WorkbenchSkin) {
  localStorage.setItem(SKIN_KEY, id);
}
