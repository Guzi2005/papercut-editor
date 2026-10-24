import {type SkirtDesign,type Pattern} from './model';

function region(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,ink:string,pattern:Pattern,repeat:number) {
  ctx.fillStyle=ink;ctx.fillRect(x,y,w,h);if(pattern==='solid')return;
  ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.strokeStyle='#f2e9d4';ctx.fillStyle='#f2e9d4';
  const step=ctx.canvas.width/repeat;ctx.lineWidth=Math.max(1,step*.05);
  for(let i=Math.floor(x/step)-1;i<(x+w)/step+1;i++) {
    const cx=(i+.5)*step,cy=y+h/2;
    if(pattern==='dash'){ctx.fillRect(cx-step*.12,y+h*.25,step*.24,h*.5);continue;}
    ctx.beginPath();ctx.moveTo(cx,cy-h*.36);ctx.lineTo(cx+step*.4,cy);ctx.lineTo(cx,cy+h*.36);ctx.lineTo(cx-step*.4,cy);ctx.closePath();ctx.stroke();
    if(pattern==='wax'){ctx.beginPath();ctx.arc(cx,cy,Math.min(step*.16,h*.18),0,Math.PI*2);ctx.stroke();ctx.fillRect(cx-step*.04,y+h*.07,step*.08,h*.07);}
  }
  ctx.restore();
}
export function paintTexture(canvas:HTMLCanvasElement,d:SkirtDesign,overlay?:CanvasImageSource) {
  const ctx=canvas.getContext('2d')!,w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);ctx.fillStyle=d.parameters.base_color;ctx.fillRect(0,0,w,h);
  for(const b of d.bands)region(ctx,0,b.start*h,w,(b.end-b.start)*h,b.color,b.pattern,b.repeat);
  for(const p of d.patches)region(ctx,p.u0*w,p.v0*h,(p.u1-p.u0)*w,(p.v1-p.v0)*h,p.color,p.pattern,p.repeat);
  if(overlay)ctx.drawImage(overlay,0,0,w,h);
  ctx.lineJoin='round';ctx.lineCap='round';
  for(const stroke of d.strokes){if(!stroke.points.length)continue;ctx.strokeStyle=stroke.color;ctx.lineWidth=stroke.width*w;ctx.beginPath();stroke.points.forEach(([u,v],i)=>i===0?ctx.moveTo(u*w,v*h):ctx.lineTo(u*w,v*h));if(stroke.points.length===1){ctx.lineTo(stroke.points[0][0]*w+.01,stroke.points[0][1]*h+.01);}ctx.stroke();}
}
export function pngBytes(canvas:HTMLCanvasElement) {return Uint8Array.from(atob(canvas.toDataURL('image/png').split(',')[1]),x=>x.charCodeAt(0));}
