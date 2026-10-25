import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const require=createRequire('D:/GodotProjects/weave-and-wander/asset-workbench/package.json');
const {chromium,expect}=require('@playwright/test');
const out=join(tmpdir(),'papercut-mobile');await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
try {
 for(const [name,width,height] of [['phone',390,844],['tablet',820,1180],['tablet-landscape',1180,820]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:3119/');
  await page.getByRole('button',{name:'工作模式：剪贴画板',exact:true}).tap();
  await page.getByRole('menuitemradio',{name:'Weave & Wander 资产',exact:true}).tap();
  await page.getByRole('button',{name:/参数化百褶裙/}).tap();
  const paper=page.getByTestId('skirt-canvas'),preview=page.getByTestId('skirt-preview');
  await expect(preview).toHaveAttribute('data-avatar','ready');
  const sync=()=>expect(page.locator('.skirt-native-status')).toHaveText('已同步');await sync();
  const inside=async(locator)=>{const r=await locator.boundingBox();expect(r).toBeTruthy();expect(r.x).toBeGreaterThanOrEqual(-1);expect(r.y).toBeGreaterThanOrEqual(0);expect(r.x+r.width).toBeLessThanOrEqual(width+1);expect(r.y+r.height).toBeLessThanOrEqual(height+1);return r;};
  await inside(paper);expect((await paper.boundingBox()).height).toBeGreaterThan(200);
  const switchTo=async(pane)=>{if(width<=900)await page.getByRole('button',{name:`工作区：${pane}`,exact:true}).tap();};
  if(width<=640){await expect(page.locator('.skirt-controls')).toBeHidden();await switchTo('参数');await expect(paper).toBeHidden();}
  const length=page.getByRole('spinbutton',{name:'裙长 / cm 数值',exact:true});
  await length.fill('96');await length.press('Tab');await sync();
  await page.getByRole('button',{name:'撤销',exact:true}).tap();await sync();await expect(length).toHaveValue('88');
  await page.getByRole('button',{name:'重做',exact:true}).tap();await sync();await expect(length).toHaveValue('96');
  if(width<=640){await switchTo('图纸');await inside(paper);}
  await page.locator('[data-view="front"]').tap();await sync();
  if(width<=640)await switchTo('参数');
  await length.fill('97');await length.press('Tab');await sync();
  if(width<=640)await switchTo('图纸');
  await page.getByRole('button',{name:'画笔',exact:true}).tap();
  const session=await context.newCDPSession(page),point=(id,x,y)=>({id,x,y,radiusX:3,radiusY:3});
  const paperBox=await paper.boundingBox(),px=paperBox.x+paperBox.width/2,py=paperBox.y+paperBox.height*.7;
  const transform=await paper.evaluate(c=>c.style.transform);
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(0,px-15,py)]});
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(0,px-15,py),point(1,px+15,py)]});
  await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(0,px-35,py),point(1,px+35,py)]});
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[point(1,px+35,py)]});
  await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(1,px+45,py+10)]});
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  expect(await paper.evaluate(c=>c.style.transform)).not.toBe(transform);
  // The pinch cancels its initial single-finger draft; it must not add undo history.
  await page.getByRole('button',{name:'撤销',exact:true}).tap();await sync();
  if(width<=640)await switchTo('参数');
  await expect(length).toHaveValue('96');
  if(width<=640)await switchTo('图纸');
  await page.getByRole('button',{name:'重做',exact:true}).tap();await sync();
  await switchTo('三维');await inside(preview);expect((await preview.boundingBox()).height).toBeGreaterThan(200);
  await page.getByRole('button',{name:'坐下',exact:true}).tap();
  await page.getByRole('button',{name:'播放或暂停动作',exact:true}).tap();
  const imageBefore=await preview.evaluate(c=>c.toDataURL());
  const box=await preview.boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(0,x-25,y),point(1,x+25,y)]});
  await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(0,x-50,y+12),point(1,x+70,y+12)]});
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  expect(await preview.evaluate(c=>c.toDataURL())).not.toBe(imageBefore);
  await page.screenshot({path:join(out,`${name}-preview.png`)});
  if(width<=640){await switchTo('参数');await expect(length).toHaveValue('97');await page.screenshot({path:join(out,`${name}-controls.png`)});await switchTo('图纸');}
  else await switchTo('图纸');
  if(width<=900)await expect(paper).toBeVisible();
  await page.screenshot({path:join(out,`${name}-paper.png`)});
  if(width<=640){await switchTo('参数');await page.setViewportSize({width:844,height:390});await expect(page.getByRole('button',{name:'工作区：图纸',exact:true})).toHaveAttribute('aria-pressed','true');await expect(paper).toBeVisible();await expect(length).toBeVisible();}
  expect(errors).toEqual([]);await context.close();console.log(`PASS ${name}: touch navigation, parameter persistence, usable canvas, pinch/pan, no errors`);
 }
} finally {await browser.close();}
