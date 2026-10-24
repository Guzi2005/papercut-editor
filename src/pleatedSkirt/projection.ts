import type {Parameters,UV,CanvasView} from './model';
const TAU=Math.PI*2;
/** Below this cone angle the unwrap is the rectangular cylinder limit. */
const CYLINDER_EPS=.02;
/** Canvas-space tolerance shared by pointer hits and round trips. */
const EPS=1e-7;
export type ProjectionMode='front'|'sector'|'cylinder'|'ring';
export interface ProjectionLayout {
 scale:number;top:number;inner:number;outer:number;sweep:number;cx:number;cy:number;mode:ProjectionMode;
}
/**
 * Shared units (cm). Front is a finished garment laid flat, not its full UV.
 * Every view uses one scale for both axes, so a centimetre is the same length
 * horizontally and vertically.
 */
export function layout(p:Parameters,view:CanvasView):ProjectionLayout {
 if(view==='front')return {...flatLayout(p),inner:p.waist_cm/TAU,outer:p.hem_cm/TAU,sweep:TAU,cx:.5,cy:.5,mode:'front'};
 if(view==='ring'){
  // Top projection: radius is circumference / 2π. Length has no top-view
  // radius, so it must not shrink or grow the ring.
  const inner=p.waist_cm/TAU,outer=p.hem_cm/TAU,radius=Math.max(Math.abs(inner),Math.abs(outer),1e-9);
  const scale=.41/radius;
  return {scale,top:.5-radius*scale,inner,outer,sweep:TAU,cx:.5,cy:.5,mode:'ring'};
 }
 const delta=p.hem_cm-p.waist_cm;
 const slant=Math.hypot(p.length_cm,delta/TAU);
 const theta=delta/slant;
 if(Math.abs(theta)<CYLINDER_EPS){
  // As the cone becomes a cylinder the apex runs to infinity. Keep the
  // unwrap stable by drawing the limiting rectangle instead of a huge arc.
  const circumference=(p.waist_cm+p.hem_cm)/2;
  const scale=Math.min(.84/Math.max(circumference,1e-9),.76/Math.max(p.length_cm,1e-9));
  return {scale,top:.5-p.length_cm*scale/2,inner:circumference/TAU,outer:circumference/TAU,sweep:0,cx:.5,cy:.5,mode:'cylinder'};
 }
 // Signed angles/radii keep hem<waist oriented the same way as hem>waist.
 const half=Math.abs(theta)/2;
 const sinHalf=Math.sin(Math.min(Math.PI/2,half));
 const cosHalf=Math.cos(half);
 const waistRadius=p.waist_cm/theta,hemRadius=p.hem_cm/theta;
 const reach=Math.max(Math.abs(waistRadius),Math.abs(hemRadius));
 const width=2*reach*sinHalf;
 const y0=waistRadius,y1=hemRadius,y2=waistRadius*cosHalf,y3=hemRadius*cosHalf;
 const low=Math.min(y0,y1,y2,y3),high=Math.max(y0,y1,y2,y3);
 const scale=Math.min(.84/Math.max(width,1e-9),.76/Math.max(high-low,1e-9));
 const cy=.5-(low+high)*.5*scale;
 return {scale,top:cy+low*scale,inner:waistRadius,outer:hemRadius,sweep:Math.abs(theta),cx:.5,cy,mode:'sector'};
}
export const oppositeU=(u:number)=>(.5-u+1)%1;
export function project([u,v]:UV,view:CanvasView,p:Parameters,turn=0):UV{
 const l=layout(p,view);
 if(view==='front')return flatPoint(wrapU(u-.25-turn)*2,v,p);
 if(l.mode==='cylinder'){const width=(p.waist_cm+p.hem_cm)/2;return [l.cx+(u-.5)*width*l.scale,l.top+v*p.length_cm*l.scale];}
 const a=(u-.5)*l.sweep,r=l.inner+(l.outer-l.inner)*v;
 return [l.cx+Math.sin(a)*r*l.scale,l.cy+Math.cos(a)*r*l.scale];
}
export function unproject([x,y]:UV,view:CanvasView,p:Parameters,turn=0):{uv:UV}|null{
 const l=layout(p,view);let u:number,v:number;
 if(view==='front'){const uv=flatHit([x,y],p,turn);return uv?{uv}:null;}
 else if(l.mode==='cylinder'){
  const width=(p.waist_cm+p.hem_cm)/2;
  u=(x-l.cx)/(width*l.scale)+.5;
  v=(y-l.top)/(p.length_cm*l.scale);
 }
 else{
  const dx=x-l.cx,dy=y-l.cy,r=Math.hypot(dx,dy)/l.scale;
  if(view==='ring'){
   u=Math.atan2(dx,dy)/TAU+.5;
   const span=l.outer-l.inner;
   if(Math.abs(span)<1e-9){
    // A true top projection of a cylinder is one circle; height has no radial
    // representation. Accept the circle as the waist edge instead of NaN.
    if(Math.abs(r-Math.abs(l.inner))>Math.max(1e-6,Math.abs(l.inner)*1e-3))return null;
    v=0;
   }else v=(r-l.inner)/span;
  }else{
   let a=Math.atan2(dx,dy);
   const span=l.outer-l.inner;
   if(l.inner<0){a-=(a<0?-1:1)*Math.PI;v=(-r-l.inner)/span;}
   else v=(r-l.inner)/span;
   u=a/l.sweep+.5;
  }
 }
 if(u<-1e-5||u>1+1e-5||v<-EPS||v>1+EPS)return null;
 return {uv:[Math.max(0,Math.min(1,u)),Math.max(0,Math.min(1,v))]};
}

/** A fixed finished-skirt silhouette with a circular window into material U. */
export const wrapU=(u:number)=>((u%1)+1)%1;
export function flatLayout(p:Parameters){
 const scale=Math.min(.80/(Math.max(p.waist_cm,p.hem_cm)/2),.74/p.length_cm);
 return {scale,top:(1-p.length_cm*scale)/2};
}
export function flatPoint(x:number,v:number,p:Parameters):UV{
 const l=flatLayout(p),width=(p.waist_cm+(p.hem_cm-p.waist_cm)*v)/2*l.scale;
 return [.5+(x-.5)*width,l.top+v*p.length_cm*l.scale];
}
export function flatUV(x:number,v:number,turn=0):UV{return [wrapU(.25+x*.5+turn),v];}
export function flatHit([x,y]:UV,p:Parameters,turn=0):UV|null{
 const l=flatLayout(p),v=(y-l.top)/(p.length_cm*l.scale);
 if(v<-EPS||v>1+EPS)return null;
 const width=(p.waist_cm+(p.hem_cm-p.waist_cm)*v)/2*l.scale,local=(x-.5)/width+.5;
 return local<-EPS||local>1+EPS?null:flatUV(Math.max(0,Math.min(1,local)),Math.max(0,Math.min(1,v)),turn);
}
