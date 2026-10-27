import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
const require=createRequire('D:/GodotProjects/weave-and-wander/asset-workbench/package.json');
const {chromium,expect}=require('@playwright/test');
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try {
  await page.goto('http://127.0.0.1:3119/');
  await page.locator('button[data-tip="文件"]').click();
  await page.getByRole('button',{name:'预设',exact:true}).hover();
  await page.getByRole('button',{name:'中国玩具',exact:true}).click();
  await expect(page.getByRole('tab',{name:'中国玩具',exact:true})).toHaveAttribute('aria-selected','true');
  await page.screenshot({path:join(tmpdir(),'chinese-toys-editor.png')});
  const result=await page.evaluate(async()=>{
    const {createChineseToysPreset}=await import('/src/utils/chineseToysPreset.ts');
    const {normalizeProject,transformLayer}=await import('/src/utils/projectOps.ts');
    const {flatStack}=await import('/src/utils/layerStack.ts');
    const {generateSvgMarkup}=await import('/src/utils/svgExporter.ts');
    const {editableStroke,reviseCutoutAnchors}=await import('/src/utils/vectorAnchors.ts');
    const {strokeOutline}=await import('/src/utils/strokePath.ts');
    const {transformPathD}=await import('/src/utils/pathTransform.ts');
    const p=createChineseToysPreset(),normal=flatStack(normalizeProject(JSON.parse(JSON.stringify(p))));
    const all=Object.values(normal.layers),brushes=all.flatMap(l=>l.drawings??[]);
    const bands=all.flatMap(l=>l.positiveElements).filter(c=>c.stroke);
    const original=bands[0],anchors=original.points.map((p,i)=>({...p,x:p.x+(i===0?11:0)}));
    const revised={...original,...reviseCutoutAnchors(original,anchors)};
    const thick={...original,stroke:{...original.stroke,width:original.stroke.width*2}};
    thick.d=strokeOutline(thick.points,thick.stroke);
    const lion=normal.layers.ct_yellow_lion,shift=[1,0,0,1,45,-21],moved=transformLayer(lion,shift);
    const svg=generateSvgMarkup(normal),xml=new DOMParser().parseFromString(svg,'image/svg+xml');
    const render=async(project)=>{
      const image=new Image(),url=URL.createObjectURL(new Blob([generateSvgMarkup(project)],{type:'image/svg+xml'}));
      image.src=url;await image.decode();const c=document.createElement('canvas');c.width=1000;c.height=1000;
      c.getContext('2d').drawImage(image,0,0);URL.revokeObjectURL(url);return c.getContext('2d').getImageData(0,0,1000,1000).data;
    };
    // A deliberately oversize brush fill must be clipped to the original paper silhouette.
    const isolated={...normal,canvasBg:undefined,drawingGroups:[],items:[],layers:{[lion.id]:{...lion,drawings:[]}},rootOrder:[{type:'layer',id:lion.id}]};
    const base=await render(isolated);
    isolated.layers[lion.id].drawings=[{id:'clip_probe',brushType:'willow',d:'M0 0 H1000 V1000 H0 Z',color:'#ff0000',opacity:1,strokeWidth:0,fill:true}];
    const painted=await render(isolated);let escaped=0,filled=0;
    for(let i=0;i<base.length;i+=4){
      if(base[i+3]===0&&painted[i+3]>8){
        // SVG mask antialiasing can cover the neighbouring edge pixel; exclude that one-pixel fringe.
        const px=i/4,x=px%1000,y=Math.floor(px/1000);
        let edge=false;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
          if(x+dx>=0&&x+dx<1000&&y+dy>=0&&y+dy<1000&&base[((y+dy)*1000+x+dx)*4+3]>0)edge=true;
        }
        if(!edge)escaped++;
      }
      if(painted[i]>240&&painted[i+3]>250)filled++;
    }
    const ids=all.flatMap(l=>[l.id,...l.positiveElements.map(v=>v.id),...l.cutouts.map(v=>v.id),...(l.drawings??[]).map(v=>v.id)]);
    return {layers:all.length,paint:brushes.length,willow:brushes.filter(d=>d.brushType==='willow').length,bands:bands.length,
      unique:new Set(ids).size===ids.length,normalUnchanged:generateSvgMarkup(p)===svg,
      nativeBands:bands.every(c=>!!editableStroke(c)),anchorWorks:!!editableStroke(revised)&&revised.d!==original.d,
      widthWorks:!!editableStroke(thick)&&thick.d!==original.d,paintMoves:moved.drawings.every((d,i)=>d.d===transformPathD(lion.drawings[i].d,shift)),
      escaped,filled,xmlErrors:xml.querySelectorAll('parsererror').length,raster:xml.querySelectorAll('image').length,
      wheelFaces:all.filter(l=>/扇面 \d/.test(l.name)).length,svg};
  });
  const {svg,...report}=result;
  expect(result.unique).toBe(true);expect(result.normalUnchanged).toBe(true);expect(result.nativeBands).toBe(true);
  expect(result.anchorWorks).toBe(true);expect(result.widthWorks).toBe(true);expect(result.paintMoves).toBe(true);
  expect(result.escaped).toBe(0);expect(result.filled).toBeGreaterThan(5000);
  expect(result.raster).toBe(0);expect(result.xmlErrors).toBe(0);expect(result.wheelFaces).toBe(42);expect(result.willow).toBeGreaterThan(30);
  expect(errors).toEqual([]);writeFileSync(join(tmpdir(),'chinese-toys.svg'),svg);
  const preview=await browser.newPage({viewport:{width:800,height:800}});
  await preview.setContent(svg);await preview.addStyleTag({content:'body{margin:0}svg{width:800px;height:800px}'});
  await preview.screenshot({path:join(tmpdir(),'chinese-toys-clean.png')});
  console.log('PASS native paper, clipped willow painting, vector anchor/width editing, serialization and UI preset',report);
} finally {await browser.close();}
