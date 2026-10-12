import type { CutoutPath, Point } from '../types/papercut';
import { transformPathD, rotateAbout, multiply, translate, scaleAbout } from './pathTransform';
import { hexToHsv, hsvToHex } from './color';
import { parseVectorPath } from './vectorPath';
import { strokeOutline } from './strokePath';
import { CLASSIC_STAMPS } from './classicStamps';

export interface StampPart { id:string; d:string; color:string }
export interface StampDefinition { id:string; name:string; parts:StampPart[]; settings?:StampSettings; builtin?:boolean; group?:string }
export interface StampSettings { motifScale:number; size:number; spacing:number; angle:number; follow:boolean; scatter:number; sizeJitter:number; angleJitter:number; hue:number; saturation:number; lightness:number; outline:number; outlineColor:string; recolor:Record<string,string> }
export const DEFAULT_STAMP_SETTINGS:StampSettings={motifScale:1,size:64,spacing:1,angle:0,follow:true,scatter:0,sizeJitter:0,angleJitter:0,hue:0,saturation:0,lightness:0,outline:0,outlineColor:'#1B2352',recolor:{}};
const part=(d:string,color='#F6EEE2',id='p'):StampPart=>({id,d,color});
const motif=(id:string,name:string,parts:StampPart[]):StampDefinition=>({id,name,parts:parts.map((p,i)=>({...p,id:`${id}_${i}`})),builtin:true});
const diamond='M 50 5 L 95 50 L 50 95 L 5 50 Z';
const petal='M 50 50 L 36 28 L 42 12 L 50 20 L 58 12 L 64 28 Z';
const rotated=(d:string,deg:number)=>transformPathD(d,rotateAbout(deg*Math.PI/180,50,50));
export const BUILTIN_STAMPS:StampDefinition[]=[
  motif('cornflower','矢车菊格子',[part(diamond,'#2E58D6'),...[0,90,180,270].map(a=>part(rotated(petal,a))),part('M 50 40 L 60 50 L 50 60 L 40 50 Z','#E3A548')]),
  motif('blueflower','蓝印四瓣花',[...[0,90,180,270].map(a=>part(rotated('M 50 50 Q 18 32 28 15 Q 40 9 50 29 Q 60 9 72 15 Q 82 32 50 50 Z',a),'#2E58D6')),part('M 50 40 L 60 50 L 50 60 L 40 50 Z')]),
  motif('wave','双层波浪',[part('M 0 48 C 25 8 25 8 50 48 C 75 88 75 88 100 48 L 100 58 C 75 98 75 98 50 58 C 25 18 25 18 0 58 Z','#2E58D6'),part('M 0 27 C 25 -3 25 -3 50 27 C 75 57 75 57 100 27 L 100 32 C 75 62 75 62 50 32 C 25 2 25 2 0 32 Z','#E3A548')]),
  motif('woven','织布格纹',[part('M 0 0 H 50 V 50 H 0 Z M 50 50 H 100 V 100 H 50 Z','#2E58D6'),part('M 6 6 H 44 V 44 H 6 Z M 56 56 H 94 V 94 H 56 Z','#F6EEE2')]),
  motif('mountain','锯齿山纹',[part('M 0 70 L 25 25 L 50 70 L 75 25 L 100 70 L 100 85 L 75 40 L 50 85 L 25 40 L 0 85 Z','#BD5A63'),part('M 0 14 H 100 V 18 H 0 Z','#E3A548')]),
  motif('leaf','橄榄叶枝',[part('M 48 5 H 52 V 95 H 48 Z','#2F6E59'),...[0,1,2].flatMap(i=>[part(`M 50 ${32+i*27} Q 15 ${36+i*27} 16 ${12+i*27} Q 43 ${10+i*27} 50 ${32+i*27} Z`,'#2F6E59'),part(`M 50 ${43+i*22} Q 85 ${47+i*22} 84 ${23+i*22} Q 57 ${21+i*22} 50 ${43+i*22} Z`,'#6F926B')])]),
  motif('stitch','十字绣针脚',[part('M 10 5 L 50 43 L 90 5 L 95 10 L 57 50 L 95 90 L 90 95 L 50 57 L 10 95 L 5 90 L 43 50 L 5 10 Z','#BD5A63')]),
  motif('rosette','民俗花轮',[...[0,45,90,135,180,225,270,315].map(a=>part(rotated('M 50 48 C 19 28 32 0 50 8 C 68 0 81 28 50 48 Z',a),'#E3A548')),part('M 50 32 A 18 18 0 1 1 49.99 32 Z','#BD5A63')]),
  ...CLASSIC_STAMPS,
];
export interface StampPlacement extends Point { angle:number; scale:number }
function random(seed:number,index:number,channel:number):number {let n=(seed^Math.imul(index+1,374761393)^Math.imul(channel+1,668265263))>>>0;n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;}
/** Distance-based placement: independent of pointer event frequency; seed is stable for the entire stroke. */
export function stampPlacements(points:Point[],s:StampSettings,seed:number):StampPlacement[] {
  if(!points.length)return [];
  const out:StampPlacement[]=[];
  const add=(p:Point,tangent:number)=>{
    const i=out.length,jitter=(random(seed,i,0)*2-1)*s.scatter*s.size;
    out.push({x:p.x-Math.sin(tangent)*jitter,y:p.y+Math.cos(tangent)*jitter,angle:(s.follow?tangent:0)+(s.angle+(random(seed,i,1)*2-1)*s.angleJitter)*Math.PI/180,scale:s.size/100*(1+(random(seed,i,2)*2-1)*s.sizeJitter)});
  };
  const first=points.find(p=>Math.hypot(p.x-points[0].x,p.y-points[0].y)>1e-6);
  add(points[0],first?Math.atan2(first.y-points[0].y,first.x-points[0].x):0);
  const step=Math.max(2,s.size*s.spacing);let remaining=step;
  for(let i=1;i<points.length&&out.length<300;i++){
    const a=points[i-1],b=points[i],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);if(!length)continue;
    let used=0;
    while(length-used>=remaining&&out.length<300){used+=remaining;add({x:a.x+dx*used/length,y:a.y+dy*used/length},Math.atan2(dy,dx));remaining=step;}
    remaining-=length-used;
  }
  return out;
}
export function prepareStamp(def:StampDefinition,s:StampSettings):StampPart[] {
  const fills=def.parts.map(p=>{const hsv=hexToHsv(s.recolor[p.color]??p.color);return {...p,d:transformPathD(p.d,scaleAbout(s.motifScale,50,50)),color:hsvToHex({h:(hsv.h+s.hue+360)%360,s:Math.max(0,Math.min(100,hsv.s+s.saturation)),v:Math.max(0,Math.min(100,hsv.v+s.lightness))})};});
  if(s.outline<=0)return fills;
  const borders:StampPart[]=[];
  for(const p of fills)for(const c of parseVectorPath(p.d)){
    const pts:Point[]=[];
    c.nodes.forEach((a,i)=>{pts.push(a);const b=c.nodes[(i+1)%c.nodes.length];if(!a.outgoing&&!b.incoming)return;const u=a.outgoing??a,v=b.incoming??b;for(let k=1;k<12;k++){const t=k/12,r=1-t;pts.push({x:r*r*r*a.x+3*r*r*t*u.x+3*r*t*t*v.x+t*t*t*b.x,y:r*r*r*a.y+3*r*r*t*u.y+3*r*t*t*v.y+t*t*t*b.y});}});
    if(c.closed&&pts.length)pts.push(pts[0]);
    if(pts.length>=2)borders.push(part(strokeOutline(pts,{width:s.outline*2,round:0,cap:'round',smooth:[]}),s.outlineColor,`outline_${p.id}_${borders.length}`));
  }
  return [...borders,...fills];
}
export function placedStampPaths(parts:StampPart[],placements:StampPlacement[],name:string,id:string):CutoutPath[] {
  const time=Date.now();
  return placements.flatMap((at,i)=>{
    const m=multiply(translate(at.x,at.y),multiply(rotateAbout(at.angle,0,0),multiply(scaleAbout(at.scale,0,0),translate(-50,-50))));
    return parts.map((p,j)=>({id:`${id}_${i}_${j}`,name:`${name} · ${i+1}`,type:'custom_polygon' as const,d:transformPathD(p.d,m),isHole:false,fillColor:p.color,createdAt:time+i*parts.length+j}));
  });
}
const KEY='papercut.stamps.v1';
export function loadStampLibrary():StampDefinition[]{try{return validateStampLibrary(JSON.parse(localStorage.getItem(KEY)??'[]'));}catch{return [];}}
export function validateStampLibrary(value:unknown):StampDefinition[]{
  if(!Array.isArray(value)||value.length>100)throw new Error('图章库最多 100 个图章');
  return value.map((v,i)=>{
    if(!v||typeof v.name!=='string'||!Array.isArray(v.parts)||v.parts.length>200)throw new Error('图章库格式无效');
    const parts=v.parts.map((p:StampPart,j:number)=>{if(!p||typeof p.d!=='string'||p.d.length>100000||!/^[MmLlHhVvCcSsQqTtAaZz0-9.,eE\s+\-]*$/.test(p.d)||!/^#[0-9a-f]{6}$/i.test(p.color))throw new Error('图案路径或颜色无效');parseVectorPath(p.d);return {id:`part_${j}`,d:p.d,color:p.color};});
    return {settings:v.settings ? normalizeStampSettings(v.settings) : undefined,id:typeof v.id==='string'?v.id:`stamp_${i}`,name:v.name.slice(0,80),parts};
  });
}
export function saveStampLibrary(library:StampDefinition[]):void {localStorage.setItem(KEY,JSON.stringify(library));}

export function normalizeStampSettings(value:Partial<StampSettings>):StampSettings {
  const s={...DEFAULT_STAMP_SETTINGS};
  const ranges:Record<string,[number,number]>={size:[8,300],spacing:[.15,3],angle:[-180,180],scatter:[0,.5],sizeJitter:[0,.3],angleJitter:[0,30],hue:[-180,180],saturation:[-100,100],lightness:[-80,80],outline:[0,6],motifScale:[.5,1.5]};
  for(const [key,[min,max]] of Object.entries(ranges)){const n=value[key as keyof StampSettings];if(typeof n==='number'&&Number.isFinite(n))(s as unknown as Record<string,unknown>)[key]=Math.max(min,Math.min(max,n));}
  if(typeof value.follow==='boolean')s.follow=value.follow;
  if(typeof value.outlineColor==='string'&&/^#[0-9a-f]{6}$/i.test(value.outlineColor))s.outlineColor=value.outlineColor;
  s.recolor={};if(value.recolor&&typeof value.recolor==='object')for(const [from,to] of Object.entries(value.recolor))if(/^#[0-9a-f]{6}$/i.test(from)&&typeof to==='string'&&/^#[0-9a-f]{6}$/i.test(to))s.recolor[from]=to;
  return s;
}
