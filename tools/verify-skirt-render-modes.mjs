import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const require=createRequire(process.env.PLAYWRIGHT_PACKAGE_JSON||'D:/GodotProjects/weave-and-wander/asset-workbench/package.json');
const {chromium,expect}=require('@playwright/test');
const output=join(tmpdir(),'papercut-skirt-render-modes');await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1600,height:1050}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const toggle=mode=>page.getByRole('button',{name:'渲染模式：'+mode,exact:true});
const shot=name=>page.screenshot({path:join(output,name+'.png')});
const pixels=()=>page.getByTestId('skirt-preview').evaluate(el=>{const gl=el.getContext('webgl2'),p=new Uint8Array(el.width*el.height*4);gl.readPixels(0,0,el.width,el.height,gl.RGBA,gl.UNSIGNED_BYTE,p);let sum=0,count=0,clipped=0;for(let i=0;i<p.length;i+=4)if(p[i+3]>0){sum+=p[i]+p[i+1]+p[i+2];count++;if(p[i]===255&&p[i+1]===255&&p[i+2]===255)clipped++;}return {sum,count,clipped,error:gl.getError(),image:el.toDataURL()};});
try{
 await page.goto(process.env.EDITOR_URL||'http://127.0.0.1:3119/');await page.getByRole('button',{name:'工作模式：剪贴画板',exact:true}).click();await page.getByRole('menuitemradio',{name:'Weave & Wander 资产',exact:true}).click();await page.getByRole('button',{name:/参数化百褶裙/}).click();
 const canvas=page.getByTestId('skirt-preview');await expect(canvas).toHaveAttribute('data-avatar','ready',{timeout:30000});await expect(canvas).toHaveAttribute('data-render-mode','material');
 const material=await pixels();await shot('material');
 await toggle('材质预览').click();await expect(canvas).toHaveAttribute('data-render-mode','toon');const toon=await pixels();await shot('toon');
 expect(toon.error).toBe(0);expect(toon.count).toBe(material.count);expect(toon.image).not.toBe(material.image);expect(toon.clipped/toon.count).toBeLessThan(.01);
 await toggle('三渲二').click();expect((await pixels()).image).toBe(material.image);
 await page.getByRole('button',{name:'躺下',exact:true}).click();await page.getByRole('slider',{name:'动作进度',exact:true}).evaluate(el=>{el.value='.8';el.dispatchEvent(new Event('input',{bubbles:true}));});await expect(canvas).toHaveAttribute('data-bench','true');
 const progress=await canvas.getAttribute('data-progress');await toggle('材质预览').click();expect(await canvas.getAttribute('data-progress')).toBe(progress);expect((await pixels()).error).toBe(0);await shot('toon-lying');
 await page.getByRole('button',{name:'穿着',exact:true}).click();await expect(canvas).toHaveAttribute('data-render-mode','toon');await shot('toon-garment');
 await page.getByRole('button',{name:'回到画板细绘',exact:true}).click();await expect(page.locator('.skirt-live-preview canvas')).toHaveAttribute('data-render-mode','toon',{timeout:30000});await toggle('三渲二').click();await expect(page.locator('.skirt-live-preview canvas')).toHaveAttribute('data-render-mode','material');
 await page.getByRole('button',{name:'百褶裙 · 参数与展开 ↗',exact:true}).click();await expect(toggle('材质预览')).toBeVisible();await toggle('材质预览').click();await page.reload();await page.getByRole('button',{name:'工作模式：剪贴画板',exact:true}).click();await page.getByRole('menuitemradio',{name:'Weave & Wander 资产',exact:true}).click();if(await page.getByRole('dialog',{name:'制作资产'}).isVisible())await page.getByRole('button',{name:/参数化百褶裙/}).click();await expect(toggle('三渲二')).toBeVisible();await expect(page.getByTestId('skirt-preview')).toHaveAttribute('data-render-mode','toon');
 expect(errors).toEqual([]);console.log(JSON.stringify({passed:true,materialMean:material.sum/material.count/3,toonMean:toon.sum/toon.count/3,clippedRatio:toon.clipped/toon.count,output,errors}));
}finally{await browser.close();}

