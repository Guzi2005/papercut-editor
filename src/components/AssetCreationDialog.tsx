/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, SyntheticEvent } from 'react';
import { ChevronRight, Layers, Scissors, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface AssetCreationDialogProps {
  open: boolean;
  onClose: () => void;
  onCreateSkirt: () => void;
  onUseCanvas: () => void;
}

type AssetCreationCallback = 'callbackCreateSkirt' | 'callbackUseCanvas';

export interface AssetCreationEntry {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  callback: AssetCreationCallback;
}

/** Add future asset types here; the dialog renders the registry without layout changes. */
export const ASSET_CREATION_ENTRIES: readonly AssetCreationEntry[] = [
  {
    id: 'pleated-skirt',
    label: '参数化百褶裙',
    description: '参数化版型，带实时三维预览',
    icon: Layers,
    callback: 'callbackCreateSkirt',
  },
  {
    id: 'cutout-asset',
    label: '剪贴资产',
    description: '从当前画布剪出可复用图形',
    icon: Scissors,
    callback: 'callbackUseCanvas',
  },
];

export function AssetCreationDialog({ open, onClose, onCreateSkirt, onUseCanvas }: AssetCreationDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const firstEntryRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [hint, setHint] = useState('选择制作方式');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) {
        previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        dialog.showModal();
      }
      const frame = window.requestAnimationFrame(() => firstEntryRef.current?.focus());
      return () => window.cancelAnimationFrame(frame);
    }

    if (dialog.open) dialog.close();
    if (previousFocusRef.current?.isConnected) previousFocusRef.current.focus();
    previousFocusRef.current = null;
    setHint('选择制作方式');
  }, [open]);

  useEffect(
    () => () => {
      const dialog = dialogRef.current;
      if (dialog?.open) dialog.close();
      if (previousFocusRef.current?.isConnected) previousFocusRef.current.focus();
    },
    []
  );

  const callbacks: Record<AssetCreationCallback, () => void> = {
    callbackCreateSkirt: onCreateSkirt,
    callbackUseCanvas: onUseCanvas,
  };

  const runEntry = (entry: AssetCreationEntry) => {
    onClose();
    callbacks[entry.callback]();
  };

  const closeOnBackdrop = (event: ReactMouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  const cancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="asset-creation-title"
      onCancel={cancel}
      onClick={closeOnBackdrop}
      className="m-auto w-[min(420px,calc(100vw-32px))] max-h-[calc(100dvh-32px)] overflow-y-auto rounded-sm border border-(--ui-border-strong) bg-(--ui-panel) p-0 text-(--ui-text) shadow-2xl backdrop:bg-black/40"
    >
      <div className="text-xs">
        <header className="flex items-center justify-between border-b border-(--ui-divider) px-4 py-3">
          <h2 id="asset-creation-title" className="text-sm font-semibold text-(--ui-strong)">
            制作资产
          </h2>
          <button
            type="button"
            aria-label="关闭制作资产"
            onClick={onClose}
            className="p-1 text-(--ui-muted) hover:bg-(--ui-hover) hover:text-(--ui-strong)"
          >
            <X size={16} />
          </button>
        </header>

        <div className="px-2 py-2">
          <div className="px-2 pb-1 pt-0.5 text-[10px] text-(--ui-muted)">选择制作方式</div>
          <div className="flex flex-col">
            {ASSET_CREATION_ENTRIES.map((entry, index) => {
              const Icon = entry.icon;
              return (
                <button
                  key={entry.id}
                  ref={index === 0 ? firstEntryRef : undefined}
                  type="button"
                  onClick={() => runEntry(entry)}
                  onPointerEnter={() => setHint(entry.description)}
                  onPointerLeave={() => setHint('选择制作方式')}
                  onFocus={() => setHint(entry.description)}
                  onBlur={() => setHint('选择制作方式')}
                  data-tip={entry.description}
                  className="group flex w-full items-center gap-3 rounded-sm px-2 py-2.5 text-left text-(--ui-text-2) transition-colors hover:bg-(--ui-hover) hover:text-(--ui-strong)"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center text-(--ui-accent)">
                    <Icon size={16} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-medium text-(--ui-strong)">{entry.label}</span>
                    <span className="sr-only">{entry.description}</span>
                  </span>
                  <ChevronRight
                    size={14}
                    aria-hidden="true"
                    className="shrink-0 text-(--ui-muted) group-hover:text-(--ui-text-2)"
                  />
                </button>
              );
            })}
          </div>
        </div>

        <footer className="flex items-center gap-3 border-t border-(--ui-divider) px-4 py-2.5">
          <p className="min-w-0 flex-1 truncate text-[10px] text-(--ui-muted)">{hint}</p>
          <button type="button" onClick={onClose} className="shrink-0 px-3 py-1.5 hover:bg-(--ui-hover)">
            取消
          </button>
        </footer>
      </div>
    </dialog>
  );
}
