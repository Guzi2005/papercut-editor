/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PapercutProject, Layer } from '../types/papercut';

interface ExportOptions {
  includeBackground?: boolean;
  scale?: number;
  includePaperTexture?: boolean;
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
  } = options;

  const width = Math.round(project.width * scale);
  const height = Math.round(project.height * scale);
  const { layers, groups, rootOrder } = project;

  const lines: string[] = [];

  // SVG root element
  lines.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${project.width} ${project.height}" width="${width}" height="${height}">`
  );

  // Optional defs for paper texture
  if (includePaperTexture) {
    lines.push(`  <defs>`);
    lines.push(`    <filter id="xuan-paper-grain" x="0" y="0" width="100%" height="100%">`);
    lines.push(
      `      <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" result="noise" />`
    );
    lines.push(
      `      <feColorMatrix type="matrix" values="0 0 0 0 0.9  0 0 0 0 0.9  0 0 0 0 0.9  0 0 0 0.15 0" />`
    );
    lines.push(`      <feBlend mode="multiply" in="SourceGraphic" in2="noise" />`);
    lines.push(`    </filter>`);
    lines.push(`  </defs>`);
  }

  // Background
  if (includeBackground) {
    lines.push(
      `  <rect width="${project.width}" height="${project.height}" fill="${project.backgroundColor}" id="background-mat" />`
    );
  }

  // Render by groups
  const renderedGroupIds = new Set<string>();

  rootOrder.forEach((item) => {
    if (item.type === 'group') {
      const grp = groups.find((g) => g.id === item.id);
      if (!grp || !grp.visible || renderedGroupIds.has(grp.id)) return;
      renderedGroupIds.add(grp.id);

      lines.push(`  <g id="${grp.id}" data-name="${grp.name}">`);
      grp.layerIds.forEach((lid) => {
        const lyr = layers[lid];
        if (lyr && lyr.visible) {
          lines.push(renderLayerSvg(lyr, '    '));
        }
      });
      lines.push(`  </g>`);
    } else {
      const lyr = layers[item.id];
      if (lyr && lyr.visible) {
        lines.push(renderLayerSvg(lyr, '  '));
      }
    }
  });

  lines.push(`</svg>`);
  return lines.join('\n');
}

function renderLayerSvg(layer: Layer, indent: string): string {
  const parts: string[] = [];
  const holePaths = layer.cutouts.filter((c) => c.isHole).map((c) => c.d).filter(Boolean);
  const positivePaths = layer.positiveElements.concat(
    layer.cutouts.filter((c) => !c.isHole)
  );

  parts.push(
    `${indent}<g id="${layer.id}" data-name="${layer.name}" opacity="${layer.opacity}">`
  );

  // Defs clipPath for clipping mask (保证手绘不出剪纸外边界及镂空处)
  if (layer.baseShape && layer.baseShape.d) {
    const combinedD = [layer.baseShape.d, ...holePaths].join(' ');
    parts.push(`${indent}  <defs>`);
    parts.push(`${indent}    <clipPath id="clip_export_${layer.id}">`);
    parts.push(`${indent}      <path d="${combinedD}" clip-rule="evenodd" />`);
    parts.push(`${indent}    </clipPath>`);
    parts.push(`${indent}  </defs>`);
  }

  // Compound Base Shape with Cutout Holes (fill-rule="evenodd")
  if (layer.baseShape && layer.baseShape.d) {
    const combinedD = [layer.baseShape.d, ...holePaths].join(' ');
    parts.push(
      `${indent}  <!-- Paper cutout base with punched holes -->`
    );
    parts.push(
      `${indent}  <path d="${combinedD}" fill="${layer.color}" fill-rule="evenodd" />`
    );
  }

  // Positive elements / appliqués
  positivePaths.forEach((elem) => {
    const color = elem.fillColor || layer.color;
    parts.push(
      `${indent}  <path d="${elem.d}" fill="${color}" data-element-id="${elem.id}" />`
    );
  });

  // Layer Drawings with Clipping Mask
  if (layer.drawings && layer.drawings.length > 0) {
    parts.push(`${indent}  <g clip-path="url(#clip_export_${layer.id})">`);
    layer.drawings.forEach((drw) => {
      const filterAttr = drw.blur ? `style="filter: blur(${drw.blur}px)"` : '';
      parts.push(
        `${indent}    <path d="${drw.d}" fill="none" stroke="${drw.color}" stroke-width="${drw.strokeWidth}" stroke-opacity="${drw.opacity}" stroke-linecap="${drw.strokeLinecap || 'round'}" stroke-linejoin="${drw.strokeLinejoin || 'round'}" ${filterAttr} />`
      );
    });
    parts.push(`${indent}  </g>`);
  }

  parts.push(`${indent}</g>`);
  return parts.join('\n');
}

/**
 * Downloads a string as a file
 */
export function downloadFile(content: string, filename: string, mimeType: string) {
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

/**
 * Renders SVG to Canvas and exports as PNG Data URL
 */
export async function exportToPng(
  project: PapercutProject,
  scale = 2,
  includeBackground = true
): Promise<string> {
  const svgMarkup = generateSvgMarkup(project, {
    scale: 1,
    includeBackground,
    includePaperTexture: false,
  });

  const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = project.width * scale;
      canvas.height = project.height * scale;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Cannot get canvas 2d context'));
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      URL.revokeObjectURL(url);
      const dataUrl = canvas.toDataURL('image/png');
      resolve(dataUrl);
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };

    img.src = url;
  });
}
