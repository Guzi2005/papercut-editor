import {uvToCanvas,canvasToUV} from './geometry';
import {type SkirtDesign,type UV,type CanvasView} from './model';

export class PatternCanvas {
  private lookup?:Int32Array;private key='';private observer:ResizeObserver;
  design?:SkirtDesign;texture?:HTMLCanvasElement;selected='';guides=true;
  onDown:(uv:UV,e:PointerEvent)=>void=()=>{};onMove:(uv:UV|null,e:PointerEvent)=>void=()=>{};onUp:()=>void=()=>{};onCancel:()=>void=()=>{};
  constructor(public canvas:HTMLCanvasElement){
    this.observer=new ResizeObserver(()=>this.draw());this.observer.observe(canvas);
    canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;const uv=this.eventUV(e);if(!uv)return;e.preventDefault();canvas.setPointerCapture(e.pointerId);this.onDown(uv,e);});
    canvas.addEventListener('pointermove',e=>this.onMove(this.eventUV(e),e));
    canvas.addEventListener('pointerup',()=>this.onUp());
    canvas.addEventListener('pointercancel',()=>this.onCancel());
    canvas.addEventListener('lostpointercapture',()=>this.onCancel());
  }
  private eventUV(e:PointerEvent):UV|null{if(!this.design)return null;const r=this.canvas.getBoundingClientRect();return canvasToUV([(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height],this.design.canvas_view);}
  update(d:SkirtDesign,t:HTMLCanvasElement,selected=''){this.design=d;this.texture=t;this.selected=selected;this.draw();}
  draw(){const d=this.design,t=this.texture;if(!d||!t)return;const rect=this.canvas.getBoundingClientRect();if(!rect.width)return;
    const size=Math.min(1024,Math.max(256,Math.round(rect.width*Math.min(devicePixelRatio,1.5))));
    if(this.canvas.width!==size||this.canvas.height!==size){this.canvas.width=size;this.canvas.height=size;}
    const ctx=this.canvas.getContext('2d')!,key=`${size}/${t.width}/${d.canvas_view}`;
    if(key!==this.key){this.key=key;this.lookup=new Int32Array(size*size).fill(-1);for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const uv=canvasToUV([(x+.5)/size,(y+.5)/size],d.canvas_view);if(uv)this.lookup[y*size+x]=(Math.min(t.height-1,Math.floor(uv[1]*t.height))*t.width+Math.min(t.width-1,Math.floor(uv[0]*t.width)))*4;
    }}
    const source=t.getContext('2d')!.getImageData(0,0,t.width,t.height).data,out=ctx.createImageData(size,size);
    for(let i=0;i<this.lookup!.length;i++){const at=this.lookup![i];if(at<0)continue;out.data[i*4]=source[at];out.data[i*4+1]=source[at+1];out.data[i*4+2]=source[at+2];out.data[i*4+3]=255;}
    ctx.clearRect(0,0,size,size);ctx.putImageData(out,0,0);
    const line=(points:UV[],color:string,width:number,dash:number[]=[])=>{ctx.strokeStyle=color;ctx.lineWidth=width*size/600;ctx.setLineDash(dash.map(x=>x*size/600));ctx.beginPath();points.forEach((uv,i)=>{const [x,y]=uvToCanvas(uv,d.canvas_view);if(i===0)ctx.moveTo(x*size,y*size);else ctx.lineTo(x*size,y*size);});ctx.stroke();};
    const horizontal=(v:number)=>Array.from({length:121},(_,i)=>[i/120,v] as UV);
    if(this.guides){for(let i=0;i<=d.parameters.pleat_count;i++)line([[i/d.parameters.pleat_count,0],[i/d.parameters.pleat_count,1]],'#b09c7a55',.65);}
    line(horizontal(0),'#9b856b',1.3);line(horizontal(1),'#9b856b',1.3);
    if(d.canvas_view!=='ring'){line([[0,0],[0,1]],'#9b856b',1.2);line([[1,0],[1,1]],'#9b856b',1.2);}
    const selected=d.bands.find(b=>b.id===this.selected);if(selected){line(horizontal(selected.start),'#c98937',2,[4,3]);line(horizontal(selected.end),'#c98937',2,[4,3]);}
    ctx.setLineDash([]);
  }
  dispose(){this.observer.disconnect();}
}

export function templateSVG(d:SkirtDesign,view:CanvasView):string {
  const project=(uv:UV)=>uvToCanvas(uv,view).map(n=>(n*1000).toFixed(2)).join(',');
  const h=(v:number)=>Array.from({length:161},(_,i)=>project([i/160,v])).join(' ');
  const path=[...Array.from({length:161},(_,i)=>project([i/160,0])),...Array.from({length:161},(_,i)=>project([1-i/160,1]))].join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><title>百褶裙 ${view} 模板</title><polygon points="${path}" fill="#f6f2e8" fill-rule="evenodd" stroke="#615c53"/>${Array.from({length:d.parameters.pleat_count+1},(_,i)=>`<polyline points="${project([i/d.parameters.pleat_count,0])} ${project([i/d.parameters.pleat_count,1])}" stroke="#c7bcaa" fill="none"/>`).join('')}${d.bands.map(b=>`<polyline points="${h(b.start)}" stroke="#b17b34" fill="none" stroke-dasharray="6 5"/><polyline points="${h(b.end)}" stroke="#b17b34" fill="none" stroke-dasharray="6 5"/>`).join('')}</svg>`;
}
