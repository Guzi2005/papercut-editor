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
    className="w-full flex items-center gap-2 py-1 text-left text-(--ui-text-2) hover:text-(--ui-strong) disabled:opacity-35"
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
          className={`flex-1 h-6 px-1.5 rounded-md text-[11px] whitespace-nowrap transition-colors ${
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
  return (
    <div className="absolute left-full top-0 ml-1 w-60 bg-(--ui-panel) border border-(--ui-border-strong) rounded-xl shadow-2xl p-2.5 flex flex-col gap-2 text-xs">
      <Toggle on={s.auto} onChange={(auto) => onChange({ auto })} label="自动保存" />

      <div className={`flex flex-col gap-1.5 ${s.auto ? '' : 'opacity-35 pointer-events-none'}`}>
        <div className="text-[10px] text-(--ui-muted)">时机</div>
        <Choice value={s.trigger} options={['edit', 'interval'] as ('edit' | 'interval')[]} onChange={(trigger) => onChange({ trigger })} format={(v) => (v === 'edit' ? '编辑后' : '定时')} />
        {s.trigger === 'edit' ? (
          <Choice value={s.delay} options={DELAY_OPTIONS} onChange={(delay) => onChange({ delay })} format={(v) => `${v} 秒`} />
        ) : (
          <Choice value={s.interval} options={INTERVAL_OPTIONS} onChange={(interval) => onChange({ interval })} format={(v) => `${v} 分`} />
        )}
        <div className="text-[10px] text-(--ui-faint) leading-snug">
          {s.trigger === 'edit' ? '停笔后等待这么久再保存' : '只在有修改时保存'}；切到其他窗口时也会保存
        </div>
      </div>

      <div className="h-px bg-(--ui-divider)" />
      <div className="text-[10px] text-(--ui-muted)">保存到</div>
      <div className="text-[11px] text-(--ui-text-2)">浏览器本地（始终）</div>
      <Toggle
        on={s.toFile && !!fileName}
        disabled={!canFile}
        onChange={(v) => (v && !fileName ? onPickFile() : onChange({ toFile: v }))}
        label="同时写入本地文件"
        tip={canFile ? '每次保存时把当前文档写入选定的 .weave.json 文件' : '当前浏览器不支持直接写入本地文件（Chrome / Edge 可用）'}
      />
      {canFile && (
        <button
          onClick={onPickFile}
          className="flex items-center gap-1.5 h-7 px-2 rounded-lg bg-(--ui-raised) border border-(--ui-border) text-(--ui-text-2) hover:text-(--ui-strong) text-left"
          data-tip="选择或新建要同步写入的文件（绑定当前文档）"
        >
          <FileDown className="w-3.5 h-3.5 shrink-0 text-(--ui-muted)" />
          <span className="truncate">{fileName ?? '选择文件…'}</span>
        </button>
      )}

      <div className="h-px bg-(--ui-divider)" />
      <Toggle on={s.banner} onChange={(banner) => onChange({ banner })} label="自动保存时显示横幅" />
      <Toggle on={s.warnOnLeave} onChange={(warnOnLeave) => onChange({ warnOnLeave })} label="有未保存修改时离开前提醒" />

      <button onClick={onSaveNow} className="h-7 rounded-lg bg-(--ui-accent) hover:bg-(--ui-accent-hover) text-white text-[11px] font-medium">
        立即保存
      </button>
    </div>
  );
};
