/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { FileDown } from 'lucide-react';
import { DELAY_OPTIONS, INTERVAL_OPTIONS, SaveSettings, fileSaveSupported } from '../utils/saveSettings';

const Toggle: React.FC<{ on: boolean; onChange: (v: boolean) => void; label: string; tip?: string; disabled?: boolean }> = ({ on, onChange, label, tip, disabled }) => (
  <button
    onClick={() => !disabled && onChange(!on)}
    data-tip={tip}
    disabled={disabled}
    className="w-full h-6 flex items-center gap-2 text-left text-(--ui-text-2) hover:text-(--ui-strong) disabled:opacity-35"
  >
    <span className="flex-1">{label}</span>
    <span className={`relative w-7 h-4 rounded-full transition-colors ${on ? 'bg-(--ui-accent)' : 'bg-(--ui-raised) border border-(--ui-border)'}`}>
      <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${on ? 'left-3.5' : 'left-0.5'}`} />
    </span>
  </button>
);

function Choice<T extends string | number>({ value, options, onChange, format, disabled }: { value: T; options: T[]; onChange: (v: T) => void; format: (v: T) => string; disabled?: boolean }) {
  return (
    <div className={`flex items-center gap-0.5 bg-(--ui-raised) rounded-lg p-0.5 border border-(--ui-border) ${disabled ? 'opacity-35 pointer-events-none' : ''}`}>
      {options.map((o) => (
        <button
          key={String(o)}
          onClick={() => onChange(o)}
          className={`flex-1 h-5.5 px-1 rounded-md text-[11px] whitespace-nowrap transition-colors ${
            value === o ? 'bg-(--ui-accent) text-white' : 'text-(--ui-muted) hover:text-(--ui-strong)'
          }`}
        >
          {format(o)}
        </button>
      ))}
    </div>
  );
}

/** Autosave frequency and destination, shown as a flyout of the settings menu. */
export const SaveSettingsPanel: React.FC<{
  settings: SaveSettings;
  onChange: (patch: Partial<SaveSettings>) => void;
  onSaveNow: () => void;
  fileName: string | null;
  onPickFile: () => void;
}> = ({ settings: s, onChange, onSaveNow, fileName, onPickFile }) => {
  const canFile = fileSaveSupported();
  const fileOn = s.toFile && !!fileName;
  return (
    <div className="absolute left-full top-0 ml-1 w-52 bg-(--ui-panel) border border-(--ui-border-strong) rounded-xl shadow-2xl p-2 flex flex-col gap-1.5 text-xs">
      <Toggle on={s.auto} onChange={(auto) => onChange({ auto })} label="自动保存" tip="切到其他窗口时也会保存" />
      <div className={`flex flex-col gap-1 ${s.auto ? '' : 'opacity-35 pointer-events-none'}`}>
        <Choice value={s.trigger} options={['edit', 'interval'] as ('edit' | 'interval')[]} onChange={(trigger) => onChange({ trigger })} format={(v) => (v === 'edit' ? '停笔后' : '定时')} />
        {s.trigger === 'edit' ? (
          <Choice value={s.delay} options={DELAY_OPTIONS} onChange={(delay) => onChange({ delay })} format={(v) => `${v}秒`} />
        ) : (
          <Choice value={s.interval} options={INTERVAL_OPTIONS} onChange={(interval) => onChange({ interval })} format={(v) => `${v}分`} />
        )}
      </div>

      <div className="h-px bg-(--ui-divider) my-0.5" />
      <Toggle
        on={fileOn}
        disabled={!canFile}
        onChange={(v) => (v && !fileName ? onPickFile() : onChange({ toFile: v }))}
        label="写入文件"
        tip={canFile ? '同时写入本地 .weave.json' : '需要 Chrome / Edge'}
      />
      {canFile && fileName && (
        <button
          onClick={onPickFile}
          data-tip={`${fileName} · 点击更换`}
          className="-mt-1 flex items-center gap-1 text-[10px] text-(--ui-muted) hover:text-(--ui-strong) text-left"
        >
          <FileDown className="w-3 h-3 shrink-0" />
          <span className="truncate">{fileName.split('（')[0]}</span>
        </button>
      )}
      <Toggle on={s.banner} onChange={(banner) => onChange({ banner })} label="保存横幅" />
      <Toggle on={s.warnOnLeave} onChange={(warnOnLeave) => onChange({ warnOnLeave })} label="离开提醒" tip="有未保存修改时关闭页面前提醒" />

      <button onClick={onSaveNow} className="mt-0.5 h-7 rounded-lg bg-(--ui-accent) hover:bg-(--ui-accent-hover) text-white text-[11px] font-medium">
        立即保存
      </button>
    </div>
  );
};
