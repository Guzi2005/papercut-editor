import {project,unproject,faceU,layout,type Face} from './projection';
import {type SkirtDesign,type UV,type CanvasView} from './model';
export class PatternCanvas {
 private lookup?:Int32Array;private key='';private observer:ResizeObserver;
 design?:SkirtDesign;texture?:HTMLCanvasElement;selected='';guides=true;activeFace:Face='front';private viewRotation=0;private viewScale=1;private viewPanX=0;private viewPanY=0;private viewDrag?:{id:number;x:number;y:number;button:number};
 onDown:(uv:UV,e:PointerEvent)=>void=()=>{};onMove:(uv:UV|null,e:PointerEvent)=>void=()=>{};onUp:()=>void=()=>{};onCancel:()=>void=()=>{};
 constructor(public canvas:HTMLCanvasElement){
  this.observer=new ResizeObserver(()=>this.draw());this.observer.observe(canvas);
  canvas.addEventListener('pointerdown',e=>{if(e.button===1||e.button===2){this.viewDrag={id:e.pointerId,x:e.clientX,y:e.clientY,button:e.button};canvas.setPointerCapture(e.pointerId);e.preventDefault();return;}if(e.button!==0)return;const hit=this.hit(e);if(!hit)return;this.activeFace=hit.face;e.preventDefault();canvas.setPointerCapture(e.pointerId);this.onDown(hit.uv,e);});
  canvas.addEventListener('pointermove',e=>{if(this.viewDrag?.id===e.pointerId){const dx=e.clientX-this.viewDrag.x,dy=e.clientY-this.viewDrag.y;if(this.viewDrag.button===2)this.viewRotation+=dx*.008;else{this.viewPanX+=dx;this.viewPanY+=dy;}this.viewDrag={...this.viewDrag,x:e.clientX,y:e.clientY};this.applyViewTransform();this.draw();return;}const hit=this.hit(e);this.onMove(hit&& (this.design?.canvas_view!=='front'||hit.face===this.activeFace)?hit.uv:null,e);});
  canvas.addEventListener('pointerup',e=>{if(this.viewDrag?.id===e.pointerId){this.viewDrag=undefined;return;}this.onUp();});canvas.addEventListener('pointercancel',()=>{this.viewDrag=undefined;this.onCancel();});canvas.addEventListener('lostpointercapture',()=>{this.viewDrag=undefined;this.onCancel();});canvas.addEventListener('wheel',e=>{if(this.design?.canvas_view!=='front')return;e.preventDefault();this.viewScale=Math.max(.7,Math.min(2.2,this.viewScale*Math.exp(-e.deltaY*.001)));this.applyViewTransform();this.draw();},{passive:false});canvas.addEventListener('contextmenu',e=>e.preventDefault());
 }
 private hit(e:PointerEvent){if(!this.design)return null;const r=this.canvas.getBoundingClientRect();let x=(e.clientX-(r.left+r.width/2)),y=(e.clientY-(r.top+r.height/2));if(this.design.canvas_view==='front'){const c=Math.cos(-this.viewRotation),s=Math.sin(-this.viewRotation),rx=x*c-y*s,ry=x*s+y*c;x=rx/this.viewScale-this.viewPanX;y=ry/this.viewScale-this.viewPanY;const base=Math.min(this.canvas.clientWidth||r.width,this.canvas.clientHeight||r.height);return unproject([x/base+.5,y/base+.5],this.design.canvas_view,this.design.parameters);}return unproject([(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height],this.design.canvas_view,this.design.parameters);}
 update(d:SkirtDesign,t:HTMLCanvasElement,selected=''){this.design=d;this.texture=t;this.selected=selected;this.applyViewTransform();this.draw();}
 private applyViewTransform(){if(this.design?.canvas_view==='front'){this.canvas.style.transformOrigin='50% 50%';this.canvas.style.transform=`translate(${this.viewPanX}px,${this.viewPanY}px) rotate(${this.viewRotation}rad) scale(${this.viewScale})`;this.canvas.dataset.viewRotation=this.viewRotation.toFixed(3);}else{this.canvas.style.transform='';delete this.canvas.dataset.viewRotation;}}
 draw(){const d=this.design,t=this.texture;if(!d||!t)return;const rect=this.canvas.getBoundingClientRect();if(!rect.width)return;
  const size=Math.min(1024,Math.max(256,Math.round(rect.width*Math.min(devicePixelRatio,1.5))));if(this.canvas.width!==size||this.canvas.height!==size){this.canvas.width=size;this.canvas.height=size;}
  const ctx=this.canvas.getContext('2d')!,key=JSON.stringify([size,t.width,d.canvas_view,d.parameters.waist_cm,d.parameters.hem_cm,d.parameters.length_cm]);
  if(key!==this.key){this.key=key;this.lookup=new Int32Array(size*size).fill(-1);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const hit=unproject([(x+.5)/size,(y+.5)/size],d.canvas_view,d.parameters);if(hit){const [u,v]=hit.uv;this.lookup[y*size+x]=(Math.min(t.height-1,Math.floor(v*t.height))*t.width+Math.min(t.width-1,Math.floor(u*t.width)))*4;}}}
  const source=t.getContext('2d')!.getImageData(0,0,t.width,t.height).data,out=ctx.createImageData(size,size);
  for(let i=0;i<this.lookup!.length;i++){const at=this.lookup![i];if(at>=0)out.data.set(source.subarray(at,at+4),i*4);}ctx.clearRect(0,0,size,size);ctx.putImageData(out,0,0);
  const line=(points:UV[],face:Face,color:string,width:number)=>{ctx.strokeStyle=color;ctx.lineWidth=width*size/600;ctx.beginPath();points.forEach((uv,i)=>{const [x,y]=project(uv,d.canvas_view,d.parameters,face);if(i)ctx.lineTo(x*size,y*size);else ctx.moveTo(x*size,y*size);});ctx.stroke();};
  for(const face of (d.canvas_view==='front'?['front','back']:['front']) as Face[]){const u=(x:number)=>d.canvas_view==='front'?faceU(x,face):x,h=(v:number)=>Array.from({length:161},(_,i)=>[u(i/160),v] as UV);
   if(this.guides)for(let i=0;i<=d.parameters.pleat_count/(d.canvas_view==='front'?2:1);i++){const x=i/(d.parameters.pleat_count/(d.canvas_view==='front'?2:1));line([[u(x),0],[u(x),1]],face,'#b09c7a55',.65);}
   line(h(0),face,'#9b856b',1.2);line(h(1),face,'#9b856b',1.2);if(d.canvas_view!=='ring'){line([[u(0),0],[u(0),1]],face,'#9b856b',1.2);line([[u(1),0],[u(1),1]],face,'#9b856b',1.2);}
   const band=d.bands.find(b=>b.id===this.selected);if(band){line(h(band.start),face,'#c98937',2);line(h(band.end),face,'#c98937',2);}
  }
  ctx.fillStyle=getComputedStyle(this.canvas).getPropertyValue('--ui-muted')||'#85786b';ctx.font=`${size*.019}px sans-serif`;ctx.textAlign='center';
  if(d.canvas_view==='front'){const top=layout(d.parameters,'front').top;ctx.fillText('正面',size*.265,size*(top-.035));ctx.fillText('反面',size*.735,size*(top-.035));}
  ctx.fillText(`腰 ${d.parameters.waist_cm} · 裙摆 ${d.parameters.hem_cm} · 裙长 ${d.parameters.length_cm} cm`,size*.5,size*.96);
 }
 dispose(){this.observer.disconnect();}
}
export function templateSVG(d:SkirtDesign,view:CanvasView):string{
 const faces:Face[]=view==='front'?['front','back']:['front'];
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><title>百褶裙 ${view} 腰${d.parameters.waist_cm} 裙摆${d.parameters.hem_cm} 裙长${d.parameters.length_cm}cm</title>${faces.map(face=>{const uv=(x:number,v:number):UV=>[view==='front'?faceU(x,face):x,v],point=(x:number,v:number)=>project(uv(x,v),view,d.parameters,face).map(n=>(n*1000).toFixed(2)).join(',');const path=[...Array.from({length:161},(_,i)=>point(i/160,0)),...Array.from({length:161},(_,i)=>point(1-i/160,1))].join(' ');return `<polygon points="${path}" fill="none" stroke="#9b856b"/>${Array.from({length:d.parameters.pleat_count+1},(_,i)=>`<polyline points="${point(i/d.parameters.pleat_count,0)} ${point(i/d.parameters.pleat_count,1)}" stroke="#c7bcaa" fill="none"/>`).join('')}`;}).join('')}</svg>`;
}
