import {createRequire} from 'node:module';import {tmpdir} from 'node:os';import {join} from 'node:path';
const require=createRequire('D:/GodotProjects/weave-and-wander/asset-workbench/package.json'),{chromium,expect}=require('@playwright/test');
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}});
try{
 await page.goto('http://127.0.0.1:3119/');const strip=page.locator('[data-document-tabs]'),tabs=strip.getByRole('tab');
 await expect(tabs).toHaveCount(2);const active=strip.locator('[data-active="true"]'),inactive=strip.locator('[data-active="false"]');
 await expect(active).toHaveCSS('width','188px');await expect(inactive).toHaveCSS('width','34px');
 await inactive.hover();await expect(inactive).toHaveCSS('width','188px');await page.screenshot({path:join(tmpdir(),'document-accordion-hover.png')});
 await page.mouse.move(700,200);await expect(inactive).toHaveCSS('width','34px');
 await active.focus();await page.keyboard.press('ArrowRight');await expect(strip.locator('[data-active="true"]')).toBeFocused();await expect(strip.locator('[data-active="true"]')).toHaveCSS('width','188px');
 const name=strip.locator('[data-active="true"]').getByRole('button',{name:'文档名称',exact:true});await name.dblclick();const input=strip.getByRole('textbox',{name:'文档名称',exact:true});await expect(input).toBeFocused();await page.mouse.move(700,200);await expect(strip.locator('[data-active="true"]')).toHaveCSS('width','188px');await input.press('Escape');
 const count=await tabs.count();await page.getByRole('button',{name:'新建空白画布',exact:true}).click();await page.getByRole('button',{name:'创建画布',exact:true}).click();await expect(tabs).toHaveCount(count+1);
 await strip.locator('[data-active="true"] button[aria-label^="关闭 "]').click();await expect(tabs).toHaveCount(count);
 await page.setViewportSize({width:390,height:844});await expect(strip.locator('[data-active="true"]')).toHaveCSS('width','136px');
 console.log('PASS collapsed/hover/active accordion, keyboard selection, inline rename, create/close, compact width');
}finally{await browser.close();}
