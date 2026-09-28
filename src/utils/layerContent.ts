import clipping, { type MultiPolygon } from 'polygon-clipping';
import type { Layer, LayerDrawStroke, Point } from '../types/papercut';
import { BASE_BLOCK, paperSequence, strokeReach } from './layerSvg';
import { shapeOf } from './pathfinder';
import { parseVectorPath } from './vectorPath';
import { strokeOutline } from './strokePath';

export interface ContentBounds { x:number; y:number; width:number; height:number }
interface ContentBlock { id:string; color:string; shape:MultiPolygon; opacity:number }
interface LayerContent { colors:string[]; bounds:ContentBounds|null; blocks:Map<string,ContentBounds> }
const cache = new WeakMap<Layer,LayerContent>();
const empty:MultiPolygon=[];
const union=(a:MultiPolygon,b:MultiPolygon)=>clipping.union(a,b);
const subtract=(a:MultiPolygon,b:MultiPolygon)=>a.length&&b.length?clipping.difference(a,b):a;
const intersect=(a:MultiPolygon,b:MultiPolygon)=>a.length&&b.length?clipping.intersection(a,b):empty;
function bounds(shape:MultiPolygon):ContentBounds|null {
  const points=shape.flat(2);
  if(!points.length)return null;
  let x=Infinity,y=Infinity,right=-Infinity,bottom=-Infinity;
  for(const p of points){x=Math.min(x,p[0]);y=Math.min(y,p[1]);right=Math.max(right,p[0]);bottom=Math.max(bottom,p[1]);}
  return {x,y,width:right-x,height:bottom-y};
}
function drawingShape(d:LayerDrawStroke):MultiPolygon {
  if(d.fill)return shapeOf(d.d);
  let result:MultiPolygon=[];
  for(const c of parseVectorPath(d.d)) {
    const points:Point[]=[];
    c.nodes.forEach((a,i)=>{
      points.push({x:a.x,y:a.y});
      const b=c.nodes[(i+1)%c.nodes.length];
      if((!c.closed&&i===c.nodes.length-1)||(!a.outgoing&&!b.incoming))return;
      const p=a.outgoing??a,q=b.incoming??b;
      const count=Math.max(4,Math.min(64,Math.ceil((Math.hypot(p.x-a.x,p.y-a.y)+Math.hypot(q.x-p.x,q.y-p.y)+Math.hypot(b.x-q.x,b.y-q.y))/2)));
      for(let j=1;j<count;j++){const t=j/count,u=1-t;points.push({x:u*u*u*a.x+3*u*u*t*p.x+3*u*t*t*q.x+t*t*t*b.x,y:u*u*u*a.y+3*u*u*t*p.y+3*u*t*t*q.y+t*t*t*b.y});}
    });
    if(c.closed&&points.length)points.push(points[0]);
    if(points.length>=2)result=union(result,shapeOf(strokeOutline(points,{width:d.strokeWidth,round:0,cap:d.strokeLinecap??'round',smooth:[]})));
  }
  return result;
}

/** Recomputed from current geometry, including cuts and later occlusion; never accumulates prior colours or bounds. */
export function layerContent(layer:Layer):LayerContent {
  const found=cache.get(layer);if(found)return found;
  const blocks:ContentBlock[]=[];
  if(layer.kind!=='doodle') {
    if(layer.baseShape.d)blocks.push({id:BASE_BLOCK,color:layer.color,shape:shapeOf(layer.baseShape.d),opacity:1});
    for(const p of paperSequence(layer)) {
      const shape=shapeOf(p.d);
      if(p.isHole)blocks.forEach(b=>{b.shape=subtract(b.shape,shape);});
      else blocks.push({id:p.id,color:p.fillColor||layer.color,shape,opacity:1});
    }
  }
  const paper=blocks.reduce((a,b)=>union(a,b.shape),empty);
  for(const d of layer.drawings??[]) {
    if(d.opacity<=0||!d.d)continue;
    const raw=drawingShape(d);
    blocks.push({id:d.id,color:d.color,shape:layer.kind==='doodle'?raw:intersect(raw,paper),opacity:d.opacity});
  }
  let covered:MultiPolygon=[];
  const colors:string[]=[], blockBounds=new Map<string,ContentBounds>();
  let all:MultiPolygon=[];
  for(let i=blocks.length-1;i>=0;i--) {
    const b=blocks[i],visible=subtract(b.shape,covered),box=bounds(visible);
    if(box){blockBounds.set(b.id,box);if(!colors.includes(b.color))colors.push(b.color);all=union(all,visible);}
    if(b.opacity>=1)covered=union(covered,b.shape);
  }
  if(blockBounds.has(BASE_BLOCK)&&layer.pattern&&(layer.pattern.opacity??1)>0)colors.push(layer.pattern.color);
  if(paper.length&&layer.surface&&!layer.surface.inheritColor&&layer.surface.intensity>0)colors.push(layer.surface.color);
  if(all.length&&layer.stroke?.enabled&&layer.stroke.width>0&&layer.stroke.opacity>0)colors.push(layer.stroke.color);
  const box=bounds(all),reach=strokeReach(layer);
  const result={colors:[...new Set(colors)],blocks:blockBounds,bounds:box&&{x:box.x-reach,y:box.y-reach,width:box.width+2*reach,height:box.height+2*reach}};
  cache.set(layer,result);return result;
}
