/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PapercutProject } from '../types/papercut';
import { escapeAttr, renderLayerMarkup } from './layerSvg';
import { isLayerRendered } from './projectOps';

interface ExportOptions {
  includeBackground?: boolean;
  scale?: number;
  includePaperTexture?: boolean;
  includeShadow?: boolean;
}

/**
 * Generates clean, standalone SVG source code for the entire papercut project.
 */
export function generateSvgMarkup(
  project: PapercutProject,
  options: ExportOptions = {}
): string {
  const {
    includeBackground = true,
    scale = 1,
    includePaperTexture = false,
    includeShadow = false,
  } = options;

  const width = Math.round(project.width * scale);
  const height = Math.round(project.height * scale);
  const { layers, groups, rootOrder } = project;
  const layerOpts = {
    idPrefix: 'x_',
    grain: includePaperTexture,
    shadow: includeShadow ? project.shadowStrength ?? 0.5 : 0,
    paperMode: project.paperMode ?? 'soft',
  };

  const lines: string[] = [];
  lines.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${project.width} ${project.height}" width="${width}" height="${height}">`
  );

  if (includeBackground) {
    lines.push(
      `  <rect width="${project.width}" height="${project.height}" fill="${project.backgroundColor}" id="background-mat" />`
    );
  }

  rootOrder.forEach((item) => {
    if (item.type === 'group') {
      const grp = groups.find((g) => g.id === item.id);
      if (!grp || !grp.visible) return;
      lines.push(`  <g id="${grp.id}" data-name="${escapeAttr(grp.name)}">`);
      grp.layerIds.forEach((lid) => {
        if (isLayerRendered(project, lid)) {
          lines.push(`    ${renderLayerMarkup(layers[lid], layerOpts)}`);
        }
      });
      lines.push(`  </g>`);
    } else if (isLayerRendered(project, item.id)) {
      lines.push(`  ${renderLayerMarkup(layers[item.id], layerOpts)}`);
    }
  });

  lines.push(`</svg>`);
  return lines.join('\n');
}

/**
 * Downloads a string or binary payload as a file
 */
export function downloadFile(content: BlobPart, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Rasterizes standalone SVG markup to a canvas of the given pixel size. */
export function rasterizeSvg(
  svgMarkup: string,
  pixelWidth: number,
  pixelHeight: number
): Promise<HTMLCanvasElement> {
  const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(pixelWidth));
      canvas.height = Math.max(1, Math.round(pixelHeight));
      const ctx = canvas.getContext('2d');
      URL.revokeObjectURL(url);
      if (!ctx) {
        reject(new Error('Cannot get canvas 2d context'));
        return;
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

/**
 * Renders SVG to Canvas and exports as PNG Data URL
 */
export async function exportToPng(
  project: PapercutProject,
  scale = 2,
  includeBackground = true,
  includePaperTexture = true
): Promise<string> {
  const svgMarkup = generateSvgMarkup(project, {
    scale: 1,
    includeBackground,
    includePaperTexture,
    includeShadow: true,
  });
  const canvas = await rasterizeSvg(svgMarkup, project.width * scale, project.height * scale);
  return canvas.toDataURL('image/png');
}
