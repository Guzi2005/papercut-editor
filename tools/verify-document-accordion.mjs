import {createRequire} from 'node:module';import {tmpdir} from 'node:os';import {join} from 'node:path';
const require=createRequire('D:/GodotProjects/weave-and-wander/asset-workbench/package.json'),{chromium,expect}=require('@playwright/test');
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}});
try{
 await page.goto('http://127.0.0.1:3119/');const strip=page.locator('[data-document-tabs]'),tabs=strip.getByRole('tab');
 await expect(tabs).toHaveCount(2);const active=strip.locator('[data-active="true"]'),inactive=strip.locator('[data-active="false"]');
 await expect(tabs.locator('img')).toHaveCount(2);expect(await tabs.first().innerText()).toBe('');
 const seam=await tabs.evaluateAll(items=>items.slice(1).map((item,i)=>item.getBoundingClientRect().left-items[i].getBoundingClientRect().right));expect(seam.every(gap=>Math.abs(gap)<.1)).toBe(true);
 const before=await inactive.boundingBox();await inactive.hover();await expect(page.locator('[data-document-details]')).toBeVisible();expect((await inactive.boundingBox()).width).toBe(before.width);
 await page.screenshot({path:join(tmpdir(),'document-mosaic.png')});
 await page.mouse.move(1100,400);await expect(page.locator('[data-document-details]')).toHaveCount(0);
 await active.focus();await page.keyboard.press('ArrowRight');await expect(strip.locator('[data-active="true"]')).toBeFocused();
 await page.keyboard.press('F2');const input=page.locator('[data-document-details]').getByRole('textbox',{name:'文档名称',exact:true});await expect(input).toBeFocused();await input.fill('画面拼图测试');await input.press('Enter');await expect(strip.getByRole('tab',{name:'画面拼图测试',exact:true})).toHaveAttribute('aria-selected','true');
 const count=await tabs.count();await page.getByRole('button',{name:'新建空白画布',exact:true}).click();await page.getByRole('button',{name:'创建画布',exact:true}).click();await expect(tabs).toHaveCount(count+1);
 await strip.locator('[data-active="true"]').hover();await page.locator('[data-document-details] button[aria-label^="关闭 "]').click();await expect(tabs).toHaveCount(count);
 const wide=await tabs.first().boundingBox();await page.setViewportSize({width:390,height:844});expect((await tabs.first().boundingBox()).width).toBeLessThan(wide.width);await expect(tabs.locator('img')).toHaveCount(count);const header=await page.locator('header').first().evaluate(e=>[e.clientWidth,e.scrollWidth]);expect(header[1]).toBeLessThanOrEqual(header[0]+1);
 console.log('PASS artwork mosaic, stable hover details, keyboard selection/rename, create/close, mobile overflow');
}finally{await browser.close();}
