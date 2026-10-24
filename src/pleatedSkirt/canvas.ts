import {dimensionDrawing,drawDimensions} from './dimensions';
import {readDimensionMode,subscribeDimensionMode} from './dimensionSettings';
import {project,unproject,flatLayout,flatPoint,flatHit,wrapU} from './projection';
import {type SkirtDesign,type UV,type CanvasView} from './model';
export class PatternCanvas {
 private unsubscribeDimensions:()=>void;private lookup?:Int32Array;private key='';private observer:ResizeObserver;private events=new AbortController();
 design?:SkirtDesign;texture?:HTMLCanvasElement;selected='';guides=true;turnTool=true;
 private turn=0;private viewScale=1;private viewPanX=0;private viewPanY=0;
 private viewDrag?:{id:number;x:number;y:number;pan:boolean};private drawing=false;private frame=0;
 onDown:(uv:UV,e:PointerEvent)=>void=()=>{};onMove:(uv:UV|null,e:PointerEvent)=>void=()=>{};onUp:()=>void=()=>{};onCancel:()=>void=()=>{};
 constructor(public canvas:HTMLCanvasElement){
  this.unsubscribeDimensions=subscribeDimensionMode(()=>this.draw());
  this.observer=new ResizeObserver(()=>this.draw());this.observer.observe(canvas);const signal=this.events.signal;
  canvas.addEventListener('pointerdown',e=>{
   if(this.viewDrag||this.drawing)return;
   const flat=this.design?.canvas_view==='front';
   if(flat&&(e.button===1||e.button===2||(e.button===0&&this.turnTool))){this.viewDrag={id:e.pointerId,x:e.clientX,y:e.clientY,pan:e.button===1};canvas.setPointerCapture(e.pointerId);e.preventDefault();return;}
   if(e.button!==0)return;const uv=this.hit(e);if(!uv)return;
   this.drawing=true;e.preventDefault();canvas.setPointerCapture(e.pointerId);this.onDown(uv,e);
  },{signal});
  canvas.addEventListener('pointermove',e=>{
   if(this.viewDrag?.id===e.pointerId){
    const dx=e.clientX-this.viewDrag.x,dy=e.clientY-this.viewDrag.y;
    if(this.viewDrag.pan){this.viewPanX+=dx;this.viewPanY+=dy;}else this.turn=wrapU(this.turn-dx/(this.canvas.clientWidth*this.viewScale)*.5);
    this.viewDrag={...this.viewDrag,x:e.clientX,y:e.clientY};this.applyViewTransform();this.drawSoon();return;
   }
   if(this.drawing)this.onMove(this.hit(e),e);
  },{signal});
  canvas.addEventListener('pointerup',e=>{if(this.viewDrag?.id===e.pointerId){this.viewDrag=undefined;this.draw();return;}if(this.drawing){this.drawing=false;this.onUp();}},{signal});
  for(const name of ['pointercancel','lostpointercapture'])canvas.addEventListener(name,()=>{this.viewDrag=undefined;if(this.drawing){this.drawing=false;this.onCancel();}},{signal});
  canvas.addEventListener('wheel',e=>{if(this.design?.canvas_view!=='front'||this.drawing)return;e.preventDefault();this.viewScale=Math.max(.7,Math.min(2.2,this.viewScale*Math.exp(-e.deltaY*.001)));this.applyViewTransform();},{passive:false,signal});
  canvas.addEventListener('contextmenu',e=>e.preventDefault(),{signal});
 }
 flip(){if(this.drawing||this.viewDrag)return;this.turn=wrapU(this.turn+.5);this.draw();}
 resetView(){this.turn=0;this.viewScale=1;this.viewPanX=this.viewPanY=0;this.applyViewTransform();this.draw();}
 private drawSoon(){if(!this.frame)this.frame=requestAnimationFrame(()=>{this.frame=0;this.draw();});}
 private hit(e:PointerEvent){if(!this.design)return null;const r=this.canvas.getBoundingClientRect(),point:UV=[(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height];return this.design.canvas_view==='front'?flatHit(point,this.design.parameters,this.turn):unproject(point,this.design.canvas_view,this.design.parameters)?.uv??null;}
 update(d:SkirtDesign,t:HTMLCanvasElement,selected=''){this.design=d;this.texture=t;this.selected=selected;this.applyViewTransform();this.draw();}
 private applyViewTransform(){this.canvas.style.transform=this.design?.canvas_view==='front'?`translate(${this.viewPanX}px,${this.viewPanY}px) scale(${this.viewScale})`:'';}
 draw(){const d=this.design,t=this.texture;if(!d||!t||!this.canvas.clientWidth)return;
  const flat=d.canvas_view==='front',size=Math.min(1024,Math.max(256,Math.round(this.canvas.clientWidth*Math.min(devicePixelRatio,1.5))));
  if(this.canvas.width!==size||this.canvas.height!==size){this.canvas.width=size;this.canvas.height=size;}
  const dimensionMode=readDimensionMode();this.canvas.dataset.dimensionMode=dimensionMode;
  this.canvas.dataset.turn=String(this.turn);this.canvas.dataset.flatPanels=flat?'1':'0';
  const ctx=this.canvas.getContext('2d')!,key=JSON.stringify([size,t.width,t.height,d.canvas_view,d.parameters.waist_cm,d.parameters.hem_cm,d.parameters.length_cm]);
  // Cache the fixed silhouette; rotation only changes the sampled texture column.
  if(key!==this.key){this.key=key;this.lookup=new Int32Array(size*size).fill(-1);for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const point:UV=[(x+.5)/size,(y+.5)/size],uv=flat?flatHit(point,d.parameters):unproject(point,d.canvas_view,d.parameters)?.uv;
   if(uv){const [u,v]=uv;this.lookup[y*size+x]=Math.min(t.height-1,Math.floor(v*t.height))*t.width+Math.min(t.width-1,Math.floor(u*t.width));}
  }}
  const source=t.getContext('2d')!.getImageData(0,0,t.width,t.height).data,out=ctx.createImageData(size,size),shift=flat?Math.round(this.turn*t.width):0;
  for(let i=0;i<this.lookup!.length;i++){const at=this.lookup![i];if(at>=0){const column=at%t.width,index=(at-column+(column+shift)%t.width)*4;out.data.set(source.subarray(index,index+4),i*4);}}
  ctx.clearRect(0,0,size,size);ctx.putImageData(out,0,0);
  const point=(uv:UV)=>flat?flatPoint(uv[0],uv[1],d.parameters):project(uv,d.canvas_view,d.parameters);
  const line=(points:UV[],color:string,width:number)=>{ctx.strokeStyle=color;ctx.lineWidth=width*size/600;ctx.beginPath();points.forEach((uv,i)=>{const [x,y]=point(uv);if(i)ctx.lineTo(x*size,y*size);else ctx.moveTo(x*size,y*size);});ctx.stroke();};
  const h=(v:number)=>Array.from({length:161},(_,i)=>[i/160,v] as UV);
  if(this.guides){if(flat){for(let i=0;i<d.parameters.pleat_count;i++){const x=wrapU(i/d.parameters.pleat_count-.25-this.turn)*2;if(x<=1)line([[x,0],[x,1]],'#b09c7a55',.65);}}else for(let i=0;i<=d.parameters.pleat_count;i++)line([[i/d.parameters.pleat_count,0],[i/d.parameters.pleat_count,1]],'#b09c7a55',.65);}
  line(h(0),'#9b856b',1.2);line(h(1),'#9b856b',1.2);if(d.canvas_view!=='ring'){line([[0,0],[0,1]],'#9b856b',1.2);line([[1,0],[1,1]],'#9b856b',1.2);}
  const band=d.bands.find(b=>b.id===this.selected);if(band){line(h(band.start),'#c98937',2);line(h(band.end),'#c98937',2);}
  ctx.fillStyle=getComputedStyle(this.canvas).getPropertyValue('--ui-muted')||'#85786b';ctx.font=`${size*.019}px sans-serif`;ctx.textAlign='center';
  if(flat){const degrees=Math.round(this.turn*360)%360;ctx.fillText(degrees===0?'正面':degrees===180?'背面':`${degrees}°`,size*.5,size*Math.max(.025,flatLayout(d.parameters).top-(dimensionMode==='diagram'?.10:.035)));}
  if(dimensionMode==='diagram')drawDimensions(ctx,size,dimensionDrawing(d.parameters,d.canvas_view),getComputedStyle(this.canvas).getPropertyValue('--ui-text-2')||'#85786b');
  if(dimensionMode==='summary')ctx.fillText(`腰 ${d.parameters.waist_cm} · 裙摆 ${d.parameters.hem_cm} · 裙长 ${d.parameters.length_cm} cm`,size*.5,size*.96);
 }
 dispose(){this.unsubscribeDimensions();cancelAnimationFrame(this.frame);this.events.abort();this.observer.disconnect();}
}
export function templateSVG(d:SkirtDesign,view:CanvasView):string{
 const point=(x:number,v:number)=>(view==='front'?flatPoint(x,v,d.parameters):project([x,v],view,d.parameters)).map(n=>(n*1000).toFixed(2)).join(',');
 const path=[...Array.from({length:161},(_,i)=>point(i/160,0)),...Array.from({length:161},(_,i)=>point(1-i/160,1))].join(' '),count=d.parameters.pleat_count/(view==='front'?2:1);
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><title>百褶裙 ${view} 腰${d.parameters.waist_cm} 裙摆${d.parameters.hem_cm} 裙长${d.parameters.length_cm}cm</title><polygon points="${path}" fill="none" stroke="#9b856b"/>${Array.from({length:Math.floor(count)+1},(_,i)=>`<polyline points="${point(i/count,0)} ${point(i/count,1)}" stroke="#c7bcaa" fill="none"/>`).join('')}</svg>`;
}
