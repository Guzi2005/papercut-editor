/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Layers, Plus, Scissors } from 'lucide-react';

interface AssetModeEntryProps {
  onOpenAssets?: () => void;
  assetsReady?: boolean;
  assetMode?: boolean;
  onAssetModeChange?: (enabled: boolean) => void;
}

/** A cross-stitch figure drawn from X stitches, made to stay legible in a 24px slot. */
const CrossStitchPerson: React.FC = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" focusable="false">
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square">
      {/* head */}
      <path d="M9.8 2.6l4.4 4.4M14.2 2.6l-4.4 4.4" />
      {/* torso, two stacked stitches */}
      <path d="M9.8 8.3l4.4 4.4M14.2 8.3l-4.4 4.4" />
      <path d="M9.8 13.7l4.4 4.4M14.2 13.7l-4.4 4.4" />
      {/* arms */}
      <path d="M4.3 8.3l3.1 3.1M7.4 8.3l-3.1 3.1" />
      <path d="M16.6 8.3l3.1 3.1M19.7 8.3l-3.1 3.1" />
      {/* legs */}
      <path d="M7.2 17.5l3.1 3.1M10.3 17.5l-3.1 3.1" />
      <path d="M13.7 17.5l3.1 3.1M16.8 17.5l-3.1 3.1" />
    </g>
  </svg>
);

/**
 * The top-left brand slot doubles as the paper/asset mode switch. It keeps the original
 * 24px footprint so the header gains no width, and opens a small native-theme menu.
 */
export const AssetModeEntry: React.FC<AssetModeEntryProps> = ({
  onOpenAssets,
  assetsReady = true,
  assetMode = false,
  onAssetModeChange,
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback((restoreTriggerFocus = true) => {
    setOpen(false);
    if (restoreTriggerFocus) triggerRef.current?.focus();
  }, []);

  // The asset destination is unavailable until the editor has hydrated.
  const assetsAvailable = assetsReady;

  useEffect(() => {
    if (!open) return;
    const menu = menuRef.current;
    const preferred =
      menu?.querySelector<HTMLButtonElement>('[role="menuitemradio"][aria-checked="true"]:not(:disabled)') ??
      menu?.querySelector<HTMLButtonElement>('[role^="menuitem"]:not(:disabled)');
    preferred?.focus();

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) closeMenu(true);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeMenu(true);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, closeMenu]);

  const moveFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const menu = menuRef.current;
    if (!menu) return;
    if (event.key === 'Tab') {
      closeMenu(true);
      return;
    }
    const items = Array.from(menu.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]:not(:disabled)'));
    if (items.length === 0) return;
    const current = items.indexOf(document.activeElement as HTMLButtonElement);

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      items[(current + 1 + items.length) % items.length]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      items[(current - 1 + items.length) % items.length]?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      items[items.length - 1]?.focus();
    }
  };

  const selectPaper = () => {
    closeMenu(true);
    onAssetModeChange?.(false);
  };

  const selectAssets = () => {
    if (!assetsAvailable) return;
    closeMenu(true);
    onAssetModeChange?.(true);
  };

  const createAsset = () => {
    if (!assetsAvailable) return;
    closeMenu(true);
    onOpenAssets?.();
  };

  const modeItemClass = (active: boolean) =>
    `flex w-full items-center gap-2 px-2.5 py-2 text-left transition-colors ${
      active
        ? 'bg-(--ui-hover) text-(--ui-strong)'
        : 'text-(--ui-text-2) hover:bg-(--ui-hover) hover:text-(--ui-strong)'
    }`;

  return (
    <div
      className="relative shrink-0"
      ref={rootRef}
      onBlur={(event) => {
        if (!open) return;
        const next = event.relatedTarget;
        if (next instanceof Node && event.currentTarget.contains(next)) return;
        closeMenu(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        aria-label={assetMode ? '工作模式：Weave & Wander 资产' : '工作模式：剪贴画板'}
        aria-haspopup="menu"
        aria-expanded={open}
        data-tip="切换剪贴画板与资产模式"
        className="flex h-6 w-6 items-center justify-center rounded-lg bg-(--ui-accent) text-white text-[12px] font-bold transition-colors hover:bg-(--ui-accent-hover)"
      >
        {assetMode ? <CrossStitchPerson /> : <span aria-hidden="true">❖</span>}
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="工作模式"
          onKeyDown={moveFocus}
          className="absolute left-0 top-full z-50 mt-1 w-56 rounded-xl border border-(--ui-border-strong) bg-(--ui-panel) py-1 text-xs shadow-2xl"
        >
          <div role="presentation" className="px-2.5 pb-1 pt-1 text-[10px] text-(--ui-muted)">工作模式</div>

          <button
            type="button"
            role="menuitemradio"
            aria-checked={!assetMode}
            tabIndex={-1}
            onClick={selectPaper}
            data-tip="在画布上绘制、编排与剪贴"
            className={modeItemClass(!assetMode)}
          >
            <span className="flex w-3.5 shrink-0 justify-center text-(--ui-accent)">
              {!assetMode && <Check className="h-3.5 w-3.5" />}
            </span>
            <Scissors className="h-3.5 w-3.5 shrink-0 text-(--ui-muted)" />
            <span className="flex-1">剪贴画板</span>
          </button>

          <button
            type="button"
            role="menuitemradio"
            aria-checked={assetMode}
            aria-disabled={!assetsAvailable}
            disabled={!assetsAvailable}
            tabIndex={-1}
            onClick={selectAssets}
            data-tip={assetsAvailable ? '浏览、制作与复用资产' : '资产库加载中…'}
            className={`${modeItemClass(assetMode)} disabled:opacity-40`}
          >
            <span className="flex w-3.5 shrink-0 justify-center text-(--ui-accent)">
              {assetMode && <Check className="h-3.5 w-3.5" />}
            </span>
            <Layers className="h-3.5 w-3.5 shrink-0 text-(--ui-muted)" />
            <span className="flex-1">Weave &amp; Wander 资产</span>
          </button>

          {assetMode && (
            <>
              <div className="my-1 h-px bg-(--ui-divider)" />
              <button
                type="button"
                role="menuitem"
                aria-disabled={!assetsAvailable}
                disabled={!assetsAvailable}
                tabIndex={-1}
                onClick={createAsset}
                data-tip={assetsAvailable ? '制作新的剪贴或百褶裙资产' : '资产库加载中…'}
                className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-(--ui-text-2) transition-colors hover:bg-(--ui-hover) hover:text-(--ui-strong) disabled:opacity-40"
              >
                <span className="w-3.5 shrink-0" />
                <Plus className="h-3.5 w-3.5 shrink-0 text-(--ui-accent)" />
                <span className="flex-1">新建资产</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
