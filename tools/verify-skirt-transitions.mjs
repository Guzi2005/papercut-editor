import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const require=createRequire('D:/GodotProjects/weave-and-wander/asset-workbench/package.json');
const {chromium,expect}=require('@playwright/test');
const out=join(tmpdir(),'papercut-transitions');await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto('http://127.0.0.1:3119/');
 await page.getByRole('button',{name:'工作模式：剪贴画板',exact:true}).click();
 await page.getByRole('menuitemradio',{name:'Weave & Wander 资产',exact:true}).click();
 await page.getByRole('button',{name:/参数化百褶裙/}).click();
 const canvas=page.getByTestId('skirt-preview');await expect(canvas).toHaveAttribute('data-avatar','ready');
 const seek=async(value)=>page.getByRole('slider',{name:'动作进度',exact:true}).evaluate((el,value)=>{el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));},value);
 for(const [action,label] of [['walk','行走'],['sit','坐下'],['lie','躺下'],['display','裙摆展示'],['spin','转圈圈'],['stand','站立']]){
  const change=await page.evaluate(action=>{
   const c=document.querySelector('[data-testid="skirt-preview"]'),gl=c.getContext('webgl2');
   const read=()=>{const data=new Uint8Array(c.width*c.height*4);gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,data);return data;};
   const before=read();document.querySelector(`[data-action="${action}"]`).click();const after=read();
   let difference=0;for(let i=0;i<before.length;i++)difference+=Math.abs(before[i]-after[i]);
   return {difference:difference/before.length,mix:Number(c.dataset.mix)};
  },action);
  expect(change.mix).toBe(0);expect(change.difference).toBeLessThan(.5);
  await expect.poll(async()=>Number(await canvas.getAttribute('data-mix'))).toBeGreaterThan(.1);
  await page.getByRole('button',{name:'播放或暂停动作',exact:true}).click();
  const paused=await canvas.getAttribute('data-mix');await page.screenshot({path:join(out,`${action}-mix.png`)});
  expect(await canvas.getAttribute('data-mix')).toBe(paused);
  expect(Number(await canvas.getAttribute('data-warp-error'))).toBeLessThan(.0001);
  await page.getByRole('button',{name:'播放或暂停动作',exact:true}).click();
  await expect(canvas).toHaveAttribute('data-mix','1.0000');
  await seek(.78);
  console.log(`PASS ${label}: no first-frame jump (${change.difference.toFixed(5)}), pause/resume, cloth length preserved`);
 }
 await page.getByRole('button',{name:'转圈圈',exact:true}).click();
 await expect.poll(async()=>Number(await canvas.getAttribute('data-mix'))).toBeGreaterThan(.15);
 await page.getByRole('button',{name:'躺下',exact:true}).click();
 await expect.poll(async()=>Number(await canvas.getAttribute('data-mix'))).toBeGreaterThan(.15);
 await page.getByRole('button',{name:'行走',exact:true}).click();
 await seek(.63);await expect(canvas).toHaveAttribute('data-mix','1.0000');await expect(canvas).toHaveAttribute('data-progress','0.630');
 expect(errors).toEqual([]);console.log('PASS interrupted switches and exact timeline scrubbing');
} finally {await browser.close();}
