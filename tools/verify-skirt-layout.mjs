import {createRequire} from 'node:module';import {mkdir} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';
const require=createRequire('D:/GodotProjects/weave-and-wander/asset-workbench/package.json'),{chromium,expect}=require('@playwright/test');
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});const out=join(tmpdir(),'papercut-layout');await mkdir(out,{recursive:true});
try{
 for(const [width,height,touch] of [[320,740,true],[390,844,true],[844,390,true],[820,1180,true],[1440,1000,false]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:3119/');
  const header=await page.locator('header').first().evaluate(e=>({width:e.clientWidth,scroll:e.scrollWidth}));expect(header.scroll).toBeLessThanOrEqual(header.width+1);
  if(width<=640){await page.getByRole('button',{name:'画布缩放设置',exact:true}).click();const zoom=page.getByRole('group',{name:'画布缩放控件',exact:true});await expect(zoom).toBeVisible();const r=await zoom.boundingBox();expect(r.x).toBeGreaterThanOrEqual(0);expect(r.x+r.width).toBeLessThanOrEqual(width);await page.getByRole('button',{name:'画布缩放设置',exact:true}).click();}
  await page.getByRole('button',{name:'工作模式：剪贴画板',exact:true}).click();await page.getByRole('menuitemradio',{name:'Weave & Wander 资产',exact:true}).click();await page.getByRole('button',{name:/参数化百褶裙/}).click();
  const canvas=page.getByTestId('skirt-preview');await expect(canvas).toHaveAttribute('data-avatar','ready');
  if(width>640&&width<=900)await page.getByRole('button',{name:'工作区：三维',exact:true}).click();
  const separation=await page.evaluate(()=>{const content=document.querySelector('.skirt-native-content').getBoundingClientRect(),nav=document.querySelector('.skirt-mobile-nav').getBoundingClientRect(),toolbar=document.querySelector('.skirt-native-toolbar').getBoundingClientRect();return {contentTop:content.top,contentBottom:content.bottom,navTop:nav.top,navHeight:nav.height,toolbarBottom:toolbar.bottom};});
  expect(separation.contentTop).toBeGreaterThanOrEqual(separation.toolbarBottom-1);if(separation.navHeight)expect(separation.contentBottom).toBeLessThanOrEqual(separation.navTop+1);
  const noOverlap=async(a,b)=>{const r=await a.boundingBox(),s=await b.boundingBox();expect(r&&s).toBeTruthy();const intersection=Math.max(0,Math.min(r.x+r.width,s.x+s.width)-Math.max(r.x,s.x))*Math.max(0,Math.min(r.y+r.height,s.y+s.height)-Math.max(r.y,s.y));expect(intersection).toBe(0);};
  await page.getByRole('button',{name:'站姿摆布',exact:true}).click();await noOverlap(canvas,page.locator('.skirt-stance-editor'));
  await page.locator('.skirt-stance-editor').scrollIntoViewIfNeeded();await page.screenshot({path:join(out,`${width}-stance.png`)});
  await page.getByRole('button',{name:'转圈圈',exact:true}).click();await noOverlap(canvas,page.locator('.skirt-motion-controls'));
  const speed=page.getByRole('spinbutton',{name:'转速 / 圈每秒 数值',exact:true});await speed.scrollIntoViewIfNeeded();
  const accessible=await speed.evaluate(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit===e||e.contains(hit);});expect(accessible).toBe(true);
  await page.screenshot({path:join(out,`${width}-motion.png`)});
  if(width<=640)await page.getByRole('button',{name:'工作区：参数',exact:true}).click();
  const controls=await page.locator('.skirt-controls').evaluate(e=>({width:e.clientWidth,scroll:e.scrollWidth}));expect(controls.scroll).toBeLessThanOrEqual(controls.width+1);
  if(width<=640){const groups=await page.locator('.skirt-control-group').evaluateAll(elements=>elements.map(e=>e.getBoundingClientRect().width));expect(groups.every(w=>w>width-40)).toBe(true);}
  const last=page.locator('.skirt-controls button').last();await last.scrollIntoViewIfNeeded();
  expect(await last.evaluate(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit===e||e.contains(hit);})).toBe(true);
  expect(errors).toEqual([]);await context.close();console.log(`PASS ${width}x${height}: footer separation, exposed controls, no preview overlays, no parameter overflow`);
 }
}finally{await browser.close();}
