import {createRequire} from 'node:module';import {tmpdir} from 'node:os';import {join} from 'node:path';
const require=createRequire('D:/GodotProjects/weave-and-wander/asset-workbench/package.json'),{chromium,expect}=require('@playwright/test');
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:3119/');
 const tabs=page.locator('[data-document-tabs]');
 const alignment=await tabs.evaluate(e=>{const r=e.getBoundingClientRect();return [...e.children].filter(c=>c.tagName==='DIV').map(c=>Math.abs(c.getBoundingClientRect().bottom-r.bottom));});expect(alignment.every(x=>x<1)).toBe(true);
 await page.getByRole('button',{name:'工作模式：剪贴画板',exact:true}).click();await page.getByRole('menuitemradio',{name:'Weave & Wander 资产',exact:true}).click();await page.getByRole('button',{name:/参数化百褶裙/}).click();
 const preview=page.getByTestId('skirt-preview');await expect(preview).toHaveAttribute('data-avatar','ready');await page.getByRole('button',{name:'站姿摆布',exact:true}).click();
 const before=await preview.evaluate(c=>c.toDataURL()),left=page.getByRole('slider',{name:'左脚占位',exact:true}),rightArm=page.getByRole('slider',{name:'右手臂张开角度',exact:true});
 const box=await left.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x-5,box.y+box.height/2+18,{steps:6});await page.mouse.up();
 expect(JSON.parse(await preview.getAttribute('data-stance')).left.x).toBeLessThan(-.15);
 await rightArm.focus();await rightArm.press('ArrowUp');await rightArm.press('Shift+ArrowUp');await expect(rightArm).toHaveAttribute('aria-valuenow','11');
 expect(await preview.evaluate(c=>c.toDataURL())).not.toBe(before);expect(Number(await preview.getAttribute('data-warp-error'))).toBeLessThan(.0001);
 await rightArm.press('Shift+ArrowUp');await rightArm.press('Shift+ArrowUp');await rightArm.press('Shift+ArrowUp');await rightArm.press('Shift+ArrowUp');
 await page.screenshot({path:join(tmpdir(),'papercut-stance.png')});
 await page.getByRole('button',{name:'坐下',exact:true}).click();await expect(page.locator('.skirt-stance-editor')).toBeHidden();await page.getByRole('button',{name:'站立',exact:true}).click();await page.getByRole('button',{name:'站姿摆布',exact:true}).click();await expect(rightArm).toHaveAttribute('aria-valuenow','51');
 await page.locator('.skirt-stance-editor').getByRole('button',{name:'复位',exact:true}).click();await expect(rightArm).toHaveAttribute('aria-valuenow','0');
 expect(errors).toEqual([]);console.log('PASS tab baseline, foot dragging, arm keyboard controls, reset, action visibility, cloth length');
}finally{await browser.close();}
