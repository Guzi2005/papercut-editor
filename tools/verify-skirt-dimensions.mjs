import {createRequire} from 'node:module';
import {mkdir,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
const require=createRequire('D:/GodotProjects/weave-and-wander/asset-workbench/package.json');
const {chromium,expect}=require('@playwright/test'),out=join(tmpdir(),'papercut-dimensions');await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1600,height:1050}});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const canvas=page.getByTestId('skirt-canvas');
const pixels=()=>canvas.evaluate(el=>el.toDataURL());
async function snapshot(){const pending=page.waitForEvent('download');await page.getByRole('button',{name:'保存设计 JSON',exact:true}).click();const file=await pending;const path=join(out,'design.json');await file.saveAs(path);return JSON.parse(await readFile(path,'utf8'));}
async function mode(label,id){await page.getByRole('button',{name:'设置',exact:true}).click();const group=page.getByRole('group',{name:'图纸尺寸',exact:true});await group.getByRole('button',{name:label,exact:true}).click();await expect(group.getByRole('button',{name:label,exact:true})).toHaveAttribute('aria-pressed','true');await expect(canvas).toHaveAttribute('data-dimension-mode',id);await page.getByRole('button',{name:'设置',exact:true}).click();}
try{
 await page.goto('http://127.0.0.1:3119/');await page.getByRole('button',{name:'工作模式：剪贴画板',exact:true}).click();await page.getByRole('menuitemradio',{name:'Weave & Wander 资产',exact:true}).click();await page.getByRole('button',{name:/参数化百褶裙/}).click();await expect(page.locator('.skirt-native-status')).toHaveText('已同步');
 await expect(canvas).toHaveAttribute('data-dimension-mode','diagram');
 for(const view of ['梯形平铺','圆弧展开','圆环俯视']){
  await page.getByRole('tab',{name:new RegExp(view)}).click();const before=await snapshot(),diagram=await pixels();await page.screenshot({path:join(out,view+'.png')});
  await mode('概括式','summary');const summary=await pixels();expect(summary).not.toBe(diagram);
  await mode('隐藏','hidden');expect(await pixels()).not.toBe(summary);await mode('图例式','diagram');expect(await pixels()).toBe(diagram);expect(await snapshot()).toEqual(before);
 }
 await page.getByRole('button',{name:'设置',exact:true}).click();await page.screenshot({path:join(out,'settings.png')});await page.getByRole('button',{name:'设置',exact:true}).click();
 await mode('概括式','summary');await page.reload();await page.getByRole('button',{name:'工作模式：剪贴画板',exact:true}).click();await page.getByRole('menuitemradio',{name:'Weave & Wander 资产',exact:true}).click();await page.getByRole('button',{name:/参数化百褶裙/}).click();await expect(canvas).toHaveAttribute('data-dimension-mode','summary');await mode('图例式','diagram');
 const p2=await page.context().newPage();await p2.goto('http://127.0.0.1:3119/');await p2.evaluate(()=>localStorage.setItem('pleated-skirt-dimension-mode','hidden'));await expect(canvas).toHaveAttribute('data-dimension-mode','hidden');await p2.close();await mode('图例式','diagram');
 await page.getByRole('tab',{name:/梯形平铺/}).click();await page.getByRole('button',{name:'一键反面',exact:true}).click();await mode('隐藏','hidden');await expect(canvas).toHaveAttribute('data-turn','0.5');await mode('图例式','diagram');await expect(canvas).toHaveAttribute('data-turn','0.5');
 expect(errors).toEqual([]);console.log(JSON.stringify({passed:true,output:out,errors}));
}finally{await browser.close();}
