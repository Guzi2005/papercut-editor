/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';

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

/** Both destinations share the same square badge as the mode trigger. */
const ModeBadge: React.FC<{assets:boolean;className?:string}> = ({assets,className=''}) => (
  <span aria-hidden="true" data-mode-badge={assets?'assets':'paper'} className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-(--ui-accent) text-(--ui-accent-ink) ${className}`}>
    {assets ? <CrossStitchPerson /> : <svg viewBox="0 0 24 24" className="h-5 w-5" focusable="false"><path fill="currentColor" d="M12 2l4 4-4 4-4-4zM6 8l4 4-4 4-4-4zM18 8l4 4-4 4-4-4zM12 14l4 4-4 4-4-4z"/></svg>}
  </span>
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

  const modeItemClass = 'flex min-h-8 w-full items-center gap-2 px-2 py-1 text-left text-(--ui-text-2) transition-colors hover:bg-(--ui-hover) hover:text-(--ui-strong)';

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
        className="group relative flex h-6 w-6 items-center justify-center rounded-md transition-colors outline-offset-4"
      >
        <ModeBadge assets={assetMode}/>
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="工作模式"
          onKeyDown={moveFocus}
          className="absolute left-0 top-full z-50 mt-1 w-max max-w-[calc(100vw-16px)] min-w-36 rounded-lg border border-(--ui-border) bg-(--ui-panel) p-0.5 text-xs shadow-lg"
        >
          {assetMode && <button
            type="button"
            role="menuitemradio"
            aria-checked={!assetMode}
            tabIndex={-1}
            onClick={selectPaper}
            data-tip="在画布上绘制、编排与剪贴"
            className={modeItemClass}
          >
            <ModeBadge assets={false} className="h-5 w-5 [&>svg]:h-4 [&>svg]:w-4"/>
            <span className="flex-1">剪贴画板</span>
          </button>}

          {!assetMode && <button
            type="button"
            role="menuitemradio"
            aria-checked={assetMode}
            aria-disabled={!assetsAvailable}
            disabled={!assetsAvailable}
            tabIndex={-1}
            onClick={selectAssets}
            data-tip={assetsAvailable ? '浏览、制作与复用资产' : '资产库加载中…'}
            className={`${modeItemClass} disabled:opacity-40`}
          >
            <ModeBadge assets className="h-5 w-5 [&>svg]:h-4 [&>svg]:w-4"/>
            <span className="flex-1">Weave &amp; Wander 资产</span>
          </button>}

          {assetMode && (
            <>
              <div className="my-0.5 h-px bg-(--ui-divider)" />
              <button
                type="button"
                role="menuitem"
                aria-disabled={!assetsAvailable}
                disabled={!assetsAvailable}
                tabIndex={-1}
                onClick={createAsset}
                data-tip={assetsAvailable ? '制作新的剪贴或百褶裙资产' : '资产库加载中…'}
                className={`${modeItemClass} disabled:opacity-40`}
              >
                <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center"><Plus className="h-3.5 w-3.5 text-(--ui-accent)" /></span>
                <span className="flex-1">新建资产</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
