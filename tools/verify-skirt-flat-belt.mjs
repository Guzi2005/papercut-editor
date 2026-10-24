import {createRequire} from 'node:module';
import {mkdir,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
const require=createRequire(process.env.PLAYWRIGHT_PACKAGE_JSON||'D:/GodotProjects/weave-and-wander/asset-workbench/package.json');
const {chromium,expect}=require('@playwright/test'),out=join(tmpdir(),'papercut-flat-belt');await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1600,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
const ready=()=>expect(page.locator('.skirt-native-status')).toHaveText('已同步');
const snapshot=async()=>{const wait=page.waitForEvent('download');await page.getByRole('button',{name:'保存设计 JSON',exact:true}).click();const file=await wait;const path=join(out,'design.json');await file.saveAs(path);return JSON.parse(await readFile(path,'utf8'));};
const canvas=page.getByTestId('skirt-canvas');
const pixels=()=>canvas.evaluate(el=>el.toDataURL());
const drag=async(x0,y0,x1,y1,button='left')=>{const b=await canvas.boundingBox();await page.mouse.move(b.x+b.width*x0,b.y+b.height*y0);await page.mouse.down({button});await page.mouse.move(b.x+b.width*x1,b.y+b.height*y1,{steps:12});await page.mouse.up({button});};
try{
 await page.goto(process.env.EDITOR_URL||'http://127.0.0.1:3119/');await page.getByRole('button',{name:'工作模式：剪贴画板',exact:true}).click();await page.getByRole('menuitemradio',{name:'Weave & Wander 资产',exact:true}).click();await page.getByRole('button',{name:/参数化百褶裙/}).click();await ready();
 const fixture=await snapshot();fixture.canvas_view='front';fixture.bands=[];fixture.strokes=[];fixture.patches=['#df5d66','#51a4c2','#e8b54c','#705997'].map((color,i)=>({id:'quarter-'+i,u0:i/4,u1:(i+1)/4,v0:0,v1:1,color,pattern:'solid',repeat:8}));
 const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'导入设计',exact:true}).click();await (await chooser).setFiles({name:'belt.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});await ready();
 await expect(canvas).toHaveAttribute('data-flat-panels','1');await page.getByRole('button',{name:'隐藏褶线',exact:true}).click();const original=await snapshot(),front=await pixels(),bounds=await canvas.boundingBox();await page.screenshot({path:join(out,'front.png')});
 await page.getByRole('button',{name:'一键反面',exact:true}).click();await expect(canvas).toHaveAttribute('data-turn','0.5');expect(await pixels()).not.toBe(front);expect(await canvas.boundingBox()).toEqual(bounds);await page.screenshot({path:join(out,'back.png')});await page.getByRole('button',{name:'一键反面',exact:true}).click();expect(await pixels()).toBe(front);
 for(let i=0;i<4;i++)await drag(.25,.5,.75,.5);
 expect(Math.min(Number(await canvas.getAttribute('data-turn')),1-Number(await canvas.getAttribute('data-turn')))).toBeLessThan(1e-6);expect(await pixels()).toBe(front);expect(await snapshot()).toEqual(original);expect(await canvas.evaluate(el=>el.style.transform)).not.toContain('rotate');
 await page.getByRole('button',{name:'一键反面',exact:true}).click();await page.getByRole('button',{name:'正反同步',exact:true}).click();await page.getByRole('button',{name:'画笔',exact:true}).click();await drag(.46,.43,.54,.53);await ready();const painted=await snapshot();expect(painted.strokes).toHaveLength(2);for(const stroke of painted.strokes)for(const [u] of stroke.points)expect(u<.25||u>.75).toBe(true);
 await page.getByRole('button',{name:'拼色片',exact:true}).click();await drag(.46,.55,.54,.65);await ready();const patched=await snapshot();expect(patched.patches.length).toBe(6);for(const patch of patched.patches.slice(4))expect(patch.u1-patch.u0).toBeLessThan(.15);
 await drag(.4,.4,.5,.45,'middle');await page.getByRole('button',{name:'画笔',exact:true}).click();await drag(.48,.6,.52,.65);await ready();const moved=await snapshot();expect(moved.strokes.length).toBe(4);for(const stroke of moved.strokes.slice(2))for(const [u] of stroke.points)expect(u<.25||u>.75).toBe(true);
 const before=await snapshot();await drag(.3,.4,.55,.4,'right');expect(await snapshot()).toEqual(before);await page.screenshot({path:join(out,'side.png')});
 await page.getByRole('button',{name:'复位平铺',exact:true}).click();await expect(canvas).toHaveAttribute('data-turn','0');expect(await canvas.boundingBox()).toEqual(bounds);expect(errors).toEqual([]);console.log(JSON.stringify({passed:true,fullRevolution:true,backSeamPainting:true,panHitTesting:true,output:out,errors}));
}finally{await browser.close();}
