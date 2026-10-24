import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dimensionDrawing} from '../src/pleatedSkirt/dimensions';
import {createDesign,type CanvasView} from '../src/pleatedSkirt/model';
import {flatLayout,project,layout} from '../src/pleatedSkirt/projection';
const base=createDesign().parameters;
test('flat drafting measures half circumferences and vertical height, not the diagonal seam',()=>{
 const p={...base,waist_cm:70,hem_cm:250,length_cm:90},d=dimensionDrawing(p,'front'),lines=d.paths.filter(x=>x.kind==='dimension');
 assert.deepEqual(d.labels.map(x=>x.text),['半腰围 35 cm','半裙摆 125 cm','裙长 90 cm']);
 const scale=flatLayout(p).scale;
 for(const [i,expected] of [35,125,90].entries())assert.ok(Math.abs(Math.hypot(lines[i].points[1][0]-lines[i].points[0][0],lines[i].points[1][1]-lines[i].points[0][1])/scale-expected)<1e-8);
});
test('unwrapped length is cone slant while top projection uses circumference leaders',()=>{
 const p={...base,waist_cm:60,hem_cm:300,length_cm:40},d=dimensionDrawing(p,'sector');
 assert.ok(d.labels.some(x=>x.text==='腰口弧长 60 cm'));
 assert.ok(d.labels.some(x=>x.text==='裙摆弧长 300 cm'));
 const seam=d.paths.filter(x=>x.kind==='dimension').at(-1)!;
 const a=seam.points[0],b=seam.points[1],slant=Math.hypot(40,240/(2*Math.PI));
 assert.ok(Math.abs(Math.hypot(a[0]-b[0],a[1]-b[1])/layout(p,'sector').scale-slant)<1e-8);
 assert.ok(d.labels.some(x=>x.text===`展开斜长 ${Number(slant.toFixed(1))} cm`));
 const ring=dimensionDrawing(p,'ring'),long=dimensionDrawing({...p,length_cm:120},'ring');
 assert.deepEqual(ring.paths,long.paths);assert.ok(!ring.paths.some(x=>x.kind==='dimension'));
 assert.deepEqual(ring.paths.filter(x=>x.kind==='leader').map(x=>x.points[0]),[project([.125,0],'ring',p),project([.875,1],'ring',p)]);
 assert.ok(long.labels.some(x=>x.text==='裙长 120 cm · 侧向尺寸'));
});
test('drafting remains finite and inside the sheet at extreme and cylindrical dimensions',()=>{
 for(const waist_cm of [50,68,100,110])for(const hem_cm of [100,100.001,110,230,360])for(const length_cm of [40,88,120])for(const view of ['front','sector','ring'] as CanvasView[]){
  const p={...base,waist_cm,hem_cm,length_cm},d=dimensionDrawing(p,view);
  for(const [x,y] of [...d.paths.flatMap(x=>x.points),...d.labels.map(x=>x.at)])assert.ok(Number.isFinite(x)&&Number.isFinite(y)&&x>=0&&x<=1&&y>=0&&y<=1,`${view} ${JSON.stringify(p)}: ${x},${y}`);
 }
});
