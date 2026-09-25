/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { PapercutProject } from '../types/papercut';
import { generateSvgMarkup } from '../utils/svgExporter';

const cache = new WeakMap<PapercutProject, string>();

function thumbUrl(project: PapercutProject): string {
  let url = cache.get(project);
  if (!url) {
    url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(generateSvgMarkup(project, { includeBackground: true, includeShadow: true }))}`;
    cache.set(project, url);
  }
  return url;
}

/** Preview card shown under a document tab after a short hover. */
export const DocThumbnail: React.FC<{ project: PapercutProject; name: string; x: number; y: number }> = ({ project, name, x, y }) => {
  const maxW = 220, maxH = 160;
  const k = Math.min(maxW / project.width, maxH / project.height);
  const w = Math.round(project.width * k), h = Math.round(project.height * k);
  const left = Math.max(8, Math.min(x, window.innerWidth - w - 24));
  return (
    <div
      className="fixed z-[70] p-2 rounded-xl bg-(--ui-panel) border border-(--ui-border-strong) shadow-2xl pointer-events-none animate-in fade-in zoom-in-95 duration-150"
      style={{ left, top: y }}
    >
      <div className="rounded-md overflow-hidden border border-(--ui-border)" style={{ width: w, height: h, background: '#FAF8F2' }}>
        <img src={thumbUrl(project)} width={w} height={h} alt="" draggable={false} />
      </div>
      <div className="mt-1.5 flex items-center gap-2 text-[11px]">
        <span className="font-medium text-(--ui-strong) truncate max-w-[150px]">{name}</span>
        <span className="ml-auto font-mono text-[10px] text-(--ui-muted)">
          {project.width}×{project.height}
        </span>
      </div>
    </div>
  );
};
