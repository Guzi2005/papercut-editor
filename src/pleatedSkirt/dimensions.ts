import type {CanvasView,Parameters,UV} from './model';
import {flatPoint,layout,project} from './projection';

export interface DimensionPath {points:UV[];kind:'dimension'|'extension'|'leader'|'tick'}
export interface DimensionLabel {at:UV;text:string;angle?:number;align?:CanvasTextAlign}
export interface DimensionDrawing {paths:DimensionPath[];labels:DimensionLabel[]}
const add=(a:UV,b:UV,k=1):UV=>[a[0]+b[0]*k,a[1]+b[1]*k];
const unit=(a:UV,b:UV):UV=>{const dx=b[0]-a[0],dy=b[1]-a[1],n=Math.hypot(dx,dy)||1;return [dx/n,dy/n];};
const middle=(a:UV,b:UV):UV=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
const cm=(n:number)=>`${Number(n.toFixed(1))} cm`;

/** Display-only drafting marks in the same normalized space as the garment. */
export function dimensionDrawing(p:Parameters,view:CanvasView):DimensionDrawing {
 const drawing:DimensionDrawing={paths:[],labels:[]};
 const path=(points:UV[],kind:DimensionPath['kind']='dimension')=>drawing.paths.push({points,kind});
 const tick=(at:UV,tangent:UV)=>{
  const normal:UV=[-tangent[1],tangent[0]],diagonal=add(tangent,normal);
  path([add(at,diagonal,-.005),add(at,diagonal,.005)],'tick');
 };
 const extension=(from:UV,to:UV)=>{const direction=unit(from,to);path([add(from,direction,.006),add(to,direction,.009)],'extension');};
 const dimension=(a:UV,b:UV,offset:UV,text:string,labelOffset:UV)=>{
  const start=add(a,offset),end=add(b,offset),direction=unit(start,end);
  extension(a,start);extension(b,end);path([start,end]);tick(start,direction);tick(end,direction);
  let angle=Math.atan2(direction[1],direction[0]);if(angle>Math.PI/2)angle-=Math.PI;if(angle<-Math.PI/2)angle+=Math.PI;
  drawing.labels.push({at:add(middle(start,end),labelOffset),text,angle});
 };
 if(view==='front'){
  const tl=flatPoint(0,0,p),tr=flatPoint(1,0,p),bl=flatPoint(0,1,p),br=flatPoint(1,1,p);
  dimension(tl,tr,[0,-.045],`半腰围 ${cm(p.waist_cm/2)}`,[0,-.018]);
  dimension(bl,br,[0,.045],`半裙摆 ${cm(p.hem_cm/2)}`,[0,.022]);
  // Vertical length, not the sloping side seam of the laid-flat trapezoid.
  const x=Math.max(tr[0],br[0])+.045;
  const a:UV=[x,tr[1]],b:UV=[x,br[1]];
  extension(tr,a);extension(br,b);path([a,b]);tick(a,[0,1]);tick(b,[0,1]);
  drawing.labels.push({at:[x+.019,(a[1]+b[1])/2],text:`裙长 ${cm(p.length_cm)}`,angle:-Math.PI/2});
 }else if(view==='ring'){
  // Circumferences use leaders: ring width is a top-view radial difference,
  // never the skirt's vertical length or the developed cloth length.
  for(const [v,u,x,align,text] of [[0,.125,.05,'left',`腰围 ${cm(p.waist_cm)}`],[1,.875,.95,'right',`裙摆周长 ${cm(p.hem_cm)}`]] as const){
   const at=project([u,v],view,p),end:UV=[x,.065],elbow:UV=[x===.05?.28:.72,.065];
   path([at,elbow,end],'leader');tick(at,unit(at,elbow));drawing.labels.push({at:[x,.043],text,align});
  }
  drawing.labels.push({at:[.5,.965],text:`裙长 ${cm(p.length_cm)} · 侧向尺寸`});
 }else{
  const l=layout(p,view);
  if(l.mode==='cylinder'){
   dimension(project([0,0],view,p),project([1,0],view,p),[0,-.04],`腰围 ${cm(p.waist_cm)}`,[0,-.018]);
   dimension(project([0,1],view,p),project([1,1],view,p),[0,.04],`裙摆周长 ${cm(p.hem_cm)}`,[0,.022]);
  }else{
   for(const v of [0,1]){
    const outside=(u:number)=>unit(project([u,1-v],view,p),project([u,v],view,p));
    const curve=Array.from({length:161},(_,i)=>add(project([i/160,v],view,p),outside(i/160),.032));
    path(curve);extension(project([0,v],view,p),curve[0]);extension(project([1,v],view,p),curve[160]);
    tick(curve[0],unit(curve[0],curve[1]));tick(curve[160],unit(curve[159],curve[160]));
    drawing.labels.push({at:add(curve[80],outside(.5),.020),text:`${v?'裙摆弧长':'腰口弧长'} ${cm(v?p.hem_cm:p.waist_cm)}`});
   }
  }
  const a=project([1,0],view,p),b=project([1,1],view,p),direction=unit(a,b);
  let normal:UV=[direction[1],-direction[0]];
  const inside=project([.99,.5],view,p),center=middle(a,b);
  if((inside[0]-center[0])*normal[0]+(inside[1]-center[1])*normal[1]>0)normal=[-normal[0],-normal[1]];
  const slant=Math.hypot(p.length_cm,(p.hem_cm-p.waist_cm)/(2*Math.PI));
  dimension(a,b,[normal[0]*.032,normal[1]*.032],`${l.mode==='cylinder'?'裙长':'展开斜长'} ${cm(l.mode==='cylinder'?p.length_cm:slant)}`,[normal[0]*.019,normal[1]*.019]);
  if(l.mode!=='cylinder')drawing.labels.push({at:[.5,.965],text:`裙长 ${cm(p.length_cm)}`});
 }
 return drawing;
}

export function drawDimensions(ctx:CanvasRenderingContext2D,size:number,drawing:DimensionDrawing,color:string){
 const opacity=ctx.globalAlpha;ctx.save();ctx.scale(size,size);ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=.0012;
 for(const {points,kind} of drawing.paths){
  ctx.globalAlpha=opacity*(kind==='extension'?.5:.85);ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();
 }
 ctx.globalAlpha=opacity;ctx.font=`${size*.019}px sans-serif`;ctx.textBaseline='middle';
 for(const label of drawing.labels){
  ctx.save();ctx.translate(...label.at);ctx.rotate(label.angle||0);ctx.scale(1/size,1/size);ctx.textAlign=label.align||'center';ctx.fillText(label.text,0,0);ctx.restore();
 }
 ctx.restore();
}
