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
 const p=page.getByTestId('skirt-preview'),shape=page.getByRole('combobox',{name:'廓形',exact:true}),hem=page.getByRole('button',{name:'编辑下摆轮廓',exact:true}),fold=page.getByRole('button',{name:'廓形参数',exact:true});
 await expect(p).toHaveAttribute('data-avatar','ready');await expect(fold).toHaveAttribute('aria-expanded','false');
 const sync=async()=>expect(page.locator('.skirt-native-status')).toHaveText('已同步');
 const set=async(label,value)=>{const n=page.getByRole('spinbutton',{name:label+' 数值',exact:true});await n.fill(String(value));await n.press('Tab');await sync();await expect(n).toHaveValue(String(value));};
 const select=async(locator,value)=>{await locator.selectOption(value);await sync();};
 await fold.focus();await page.keyboard.press('Enter');await expect(fold).toHaveAttribute('aria-expanded','true');await expect(fold).toBeFocused();
 for(const [id,label,value] of [['relaxed','松量 / %',65],['a_line','张开 / %',72],['bell','鼓起 / %',75],['trumpet','尾摆扩张 / %',80]]){
  await select(shape,id);await set(label,value);await page.screenshot({path:join(out,id+'.png')});
 }
 await select(shape,'bell');await expect(page.getByRole('spinbutton',{name:'鼓起 / % 数值',exact:true})).toHaveValue('75');
 await expect(page.getByRole('combobox',{name:'下摆形状',exact:true})).toHaveCount(0);
 await set('短长轴比 / %',45);await set('长轴朝向 / °',37);await page.screenshot({path:join(out,'rotated.png')});
 await set('短长轴比 / %',60);
 await fold.click();await expect(fold).toHaveAttribute('aria-expanded','false');
 await page.getByRole('button',{name:'撤销',exact:true}).click();await sync();await expect(fold).toHaveAttribute('aria-expanded','false');
 await fold.click();await expect(page.getByRole('spinbutton',{name:'短长轴比 / % 数值',exact:true})).toHaveValue('45');
 await page.getByRole('button',{name:'重做',exact:true}).click();await sync();await expect(page.getByRole('spinbutton',{name:'短长轴比 / % 数值',exact:true})).toHaveValue('60');
 await set('长轴朝向 / °',0);
 const handle=name=>page.locator(`[data-hem-handle="${name}"]`);
 const center=async(name)=>{const b=await handle(name).boundingBox();return {x:b.x+b.width/2,y:b.y+b.height/2};};
 const minor=await center('minor'),before=await p.evaluate(el=>el.toDataURL());await page.mouse.move(minor.x,minor.y);await page.mouse.down();await page.mouse.move(minor.x,minor.y+7,{steps:8});
 await expect.poll(()=>p.evaluate(el=>el.toDataURL())).not.toBe(before);await page.mouse.up();await sync();expect(Number(await page.getByRole('spinbutton',{name:'短长轴比 / % 数值',exact:true}).inputValue())).toBeGreaterThan(60);
 await page.getByRole('button',{name:'撤销',exact:true}).click();await sync();await expect(page.getByRole('spinbutton',{name:'短长轴比 / % 数值',exact:true})).toHaveValue('60');
 const major=await center('major');await page.mouse.move(major.x,major.y);await page.mouse.down();await page.mouse.move(major.x+12,major.y,{steps:5});await page.keyboard.press('Escape');await page.mouse.up();await expect(page.getByRole('spinbutton',{name:'裙摆大小 / cm 数值',exact:true})).toHaveValue('230');await expect(p).toBeVisible();
 await handle('rotation').focus();await page.keyboard.press('ArrowRight');await sync();await expect(handle('rotation')).toBeFocused();await page.keyboard.press('ArrowRight');await sync();await expect(page.getByRole('spinbutton',{name:'长轴朝向 / ° 数值',exact:true})).toHaveValue('2');
 const rotation=await center('rotation'),box=await page.locator('.skirt-hem-editor').boundingBox(),cx=box.x+box.width/2,cy=box.y+box.height/2,radius=Math.hypot(rotation.x-cx,rotation.y-cy);
 await page.mouse.move(rotation.x,rotation.y);await page.mouse.down();await page.mouse.move(cx+radius*.7071,cy+radius*.7071,{steps:8});await page.mouse.up();await sync();expect(Number(await page.getByRole('spinbutton',{name:'长轴朝向 / ° 数值',exact:true}).inputValue())).toBeCloseTo(45,0);
 const size=await center('major');await page.mouse.move(size.x,size.y);await page.mouse.down();await page.mouse.move(size.x+6,size.y+6,{steps:6});await page.mouse.up();await sync();expect(Number(await page.getByRole('spinbutton',{name:'裙摆大小 / cm 数值',exact:true}).inputValue())).toBeGreaterThan(230);
 await set('长轴朝向 / °',37);
 for(const action of ['裙摆展示','转圈圈','坐下','躺下']){await page.getByRole('button',{name:action,exact:true}).click();await page.getByRole('slider',{name:'动作进度',exact:true}).evaluate(el=>{el.value='.5';el.dispatchEvent(new Event('input',{bubbles:true}));});expect(Number(await p.getAttribute('data-warp-error'))).toBeLessThan(.0001);}
 await page.getByRole('button',{name:'站立',exact:true}).click();await select(shape,'trumpet');await page.screenshot({path:join(out,'final-desktop.png')});
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'保存设计 JSON',exact:true}).click();await (await download).saveAs(join(out,'design.json'));
 const d=JSON.parse(await readFile(join(out,'design.json'),'utf8'));expect(d.shape.relaxed.fullness).toBe(.65);expect(d.shape.a_line.flare).toBe(.72);expect(d.shape.bell.volume).toBe(.75);expect(d.shape.trumpet.flare).toBe(.8);expect(d.shape.hem).toEqual({mode:'custom',ratio:.6,angle_deg:37});
 const projectDownload=page.waitForEvent('download');await page.getByRole('button',{name:'保存完整原稿',exact:true}).click();await (await projectDownload).saveAs(join(out,'project.weave.json'));
 const project=JSON.parse(await readFile(join(out,'project.weave.json'),'utf8'));expect(project.project.pleatedSkirt.shape).toEqual(d.shape);
 await select(shape,'relaxed');await set('松量 / %',20);
 const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'导入设计',exact:true}).click();await (await chooser).setFiles(join(out,'design.json'));await sync();
 await expect(shape).toHaveValue('trumpet');await expect(page.getByRole('spinbutton',{name:'长轴朝向 / ° 数值',exact:true})).toHaveValue('37');await expect(page.getByRole('spinbutton',{name:'尾摆扩张 / % 数值',exact:true})).toHaveValue('80');
 await page.setViewportSize({width:800,height:1000});await page.screenshot({path:join(out,'narrow.png')});
 expect(await p.evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===el;})).toBe(true);
 const sizes=await page.locator('.skirt-controls').evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth}));expect(sizes.scroll).toBeLessThanOrEqual(sizes.client);
 const [a,b]=await Promise.all([shape.boundingBox(),hem.boundingBox()]);expect(Math.abs(a.width-b.width)).toBeLessThan(1);expect(Math.abs(a.y-b.y)).toBeLessThan(1);
 expect(errors).toEqual([]);console.log(JSON.stringify({passed:true,out,errors}));
}finally{await browser.close();}
