import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const require = createRequire('D:/GodotProjects/weave-and-wander/asset-workbench/package.json');
const { chromium, expect } = require('@playwright/test');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
try {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:3119/');
  await expect(page.getByRole('tab', { name: '乌克兰剪纸 · 生命树', exact: true })).toBeVisible();
  await expect(page.locator('[data-document-tab]')).toHaveCount(1);
  await page.screenshot({ path: join(tmpdir(), 'ukrainian-editor.png') });
  await page.locator('button[data-tip="文件"]').click();
  await page.getByRole('button',{name:'预设',exact:true}).hover();
  await expect(page.getByRole('button',{name:'乌克兰剪纸 · 生命树',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'织游角色 · 造型拼装',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'波兰剪纸 · 夜骑白马的天使',exact:true})).toHaveCount(0);
  const result = await page.evaluate(async () => {
    const { PRESET_PROJECTS } = await import('/src/utils/presetTemplates.ts');
    const { generateSvgMarkup } = await import('/src/utils/svgExporter.ts');
    const p = PRESET_PROJECTS[0].factory();
    p.canvasBg.texture = 'none';
    const svg = generateSvgMarkup(p);
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const image = new Image();
    image.src = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    await image.decode();
    const canvas = document.createElement('canvas'); canvas.width=p.width; canvas.height=p.height;
    const ctx = canvas.getContext('2d');ctx.drawImage(image,0,0);
    const pixels=ctx.getImageData(0,0,p.width,p.height).data;
    let total=0, mismatch=0;
    for(let y=0;y<p.height;y++)for(let x=0;x<p.width/2;x++) {
      const a=pixels[(y*p.width+x)*4],b=pixels[(y*p.width+p.width-x-1)*4];
      if(a>100||b>100){total++;if(Math.abs(a-b)>32)mismatch++;}
    }
    URL.revokeObjectURL(image.src);
    return { ids:PRESET_PROJECTS.map(p=>p.id), cuts:p.layers.ua_tree.cutouts.length,
      raster:doc.querySelectorAll('image').length, xmlErrors:doc.querySelectorAll('parsererror').length,
      mismatch:mismatch/total, symmetry:p.symmetry.kind };
  });
  expect(result.ids).toEqual(['ukrainian_tree','double_fish']);
  expect(result.cuts).toBeGreaterThan(40);
  expect(result.raster).toBe(0);expect(result.xmlErrors).toBe(0);
  expect(result.mismatch).toBeLessThan(.002);
  expect(errors).toEqual([]);
  console.log('PASS', result);
} finally { await browser.close(); }
