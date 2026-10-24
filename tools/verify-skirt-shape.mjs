import {createRequire} from 'node:module';
import {mkdir,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const require=createRequire('D:/GodotProjects/weave-and-wander/asset-workbench/package.json'),{chromium,expect}=require('@playwright/test');
const out=join(tmpdir(),'papercut-shape');await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1600,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:3119/');await page.getByRole('button',{name:'工作模式：剪贴画板',exact:true}).click();
 await page.getByRole('menuitemradio',{name:'Weave & Wander 资产',exact:true}).click();await page.getByRole('button',{name:/参数化百褶裙/}).click();
 const p=page.getByTestId('skirt-preview'),shape=page.getByRole('combobox',{name:'廓形',exact:true}),hem=page.getByRole('combobox',{name:'下摆形状',exact:true}),fold=page.getByRole('button',{name:'廓形参数',exact:true});
 await expect(p).toHaveAttribute('data-avatar','ready');await expect(fold).toHaveAttribute('aria-expanded','false');
 const sync=async()=>expect(page.locator('.skirt-native-status')).toHaveText('已同步');
 const set=async(label,value)=>{const n=page.getByRole('spinbutton',{name:label+' 数值',exact:true});await n.fill(String(value));await n.press('Tab');await sync();await expect(n).toHaveValue(String(value));};
 const select=async(locator,value)=>{await locator.selectOption(value);await sync();};
 await fold.focus();await page.keyboard.press('Enter');await expect(fold).toHaveAttribute('aria-expanded','true');await expect(fold).toBeFocused();
 for(const [id,label,value] of [['relaxed','松量 / %',65],['a_line','张开 / %',72],['bell','鼓起 / %',75],['trumpet','尾摆扩张 / %',80]]){
  await select(shape,id);await set(label,value);await page.screenshot({path:join(out,id+'.png')});
 }
 await select(shape,'bell');await expect(page.getByRole('spinbutton',{name:'鼓起 / % 数值',exact:true})).toHaveValue('75');
 await select(hem,'wide');await set('短长轴比 / %',45);await page.screenshot({path:join(out,'wide.png')});
 await select(hem,'deep');await expect(page.getByRole('spinbutton',{name:'短长轴比 / % 数值',exact:true})).toHaveValue('45');await page.screenshot({path:join(out,'deep.png')});
 await select(hem,'circle');await expect(page.getByRole('spinbutton',{name:'短长轴比 / % 数值',exact:true})).toHaveCount(0);
 await select(hem,'wide');await set('短长轴比 / %',60);
 await fold.click();await expect(fold).toHaveAttribute('aria-expanded','false');
 await page.getByRole('button',{name:'撤销',exact:true}).click();await sync();await expect(fold).toHaveAttribute('aria-expanded','false');
 await fold.click();await expect(page.getByRole('spinbutton',{name:'短长轴比 / % 数值',exact:true})).toHaveValue('45');
 await page.getByRole('button',{name:'重做',exact:true}).click();await sync();await expect(page.getByRole('spinbutton',{name:'短长轴比 / % 数值',exact:true})).toHaveValue('60');
 for(const action of ['裙摆展示','转圈圈','坐下','躺下']){await page.getByRole('button',{name:action,exact:true}).click();await page.getByRole('slider',{name:'动作进度',exact:true}).evaluate(el=>{el.value='.5';el.dispatchEvent(new Event('input',{bubbles:true}));});expect(Number(await p.getAttribute('data-warp-error'))).toBeLessThan(.0001);}
 await page.getByRole('button',{name:'站立',exact:true}).click();await select(shape,'trumpet');await page.screenshot({path:join(out,'final-desktop.png')});
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'保存设计 JSON',exact:true}).click();await (await download).saveAs(join(out,'design.json'));
 const d=JSON.parse(await readFile(join(out,'design.json'),'utf8'));expect(d.shape.relaxed.fullness).toBe(.65);expect(d.shape.a_line.flare).toBe(.72);expect(d.shape.bell.volume).toBe(.75);expect(d.shape.trumpet.flare).toBe(.8);expect(d.shape.hem).toEqual({mode:'wide',ratio:.6});
 const projectDownload=page.waitForEvent('download');await page.getByRole('button',{name:'保存完整原稿',exact:true}).click();await (await projectDownload).saveAs(join(out,'project.weave.json'));
 const project=JSON.parse(await readFile(join(out,'project.weave.json'),'utf8'));expect(project.project.pleatedSkirt.shape).toEqual(d.shape);
 await select(shape,'relaxed');await set('松量 / %',20);
 const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'导入设计',exact:true}).click();await (await chooser).setFiles(join(out,'design.json'));await sync();
 await expect(shape).toHaveValue('trumpet');await expect(hem).toHaveValue('wide');await expect(page.getByRole('spinbutton',{name:'尾摆扩张 / % 数值',exact:true})).toHaveValue('80');
 await page.setViewportSize({width:800,height:1000});await page.screenshot({path:join(out,'narrow.png')});
 const sizes=await page.locator('.skirt-controls').evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth}));expect(sizes.scroll).toBeLessThanOrEqual(sizes.client);
 const [a,b]=await Promise.all([shape.boundingBox(),hem.boundingBox()]);expect(Math.abs(a.width-b.width)).toBeLessThan(1);expect(Math.abs(a.y-b.y)).toBeLessThan(1);
 expect(errors).toEqual([]);console.log(JSON.stringify({passed:true,out,errors}));
}finally{await browser.close();}
