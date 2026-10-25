import type {Silhouette, SkirtDesign} from './model';

export type HemShape = 'body' | 'circle' | 'wide' | 'deep' | 'custom';
export interface ShapeSettings {
  relaxed:{fullness:number;taper:number};
  a_line:{flare:number;curve:number};
  bell:{volume:number;peak:number};
  trumpet:{fit:number;flare_start:number;flare:number};
  hem:{mode:HemShape;ratio:number;angle_deg?:number};
}
export const hemShapes:Record<HemShape,string>={body:'自然椭圆',circle:'正圆',wide:'横向椭圆',deep:'纵向椭圆',custom:'自定义'};
export const defaultShapeSettings:ShapeSettings={
  relaxed:{fullness:.5,taper:.5},a_line:{flare:.5,curve:.5},
  bell:{volume:.5,peak:.6},trumpet:{fit:.5,flare_start:.5,flare:.6},
  hem:{mode:'body',ratio:.7},
};
export const shapeControls:Record<Silhouette,readonly {key:string;label:string;min:number;max:number;tip:string}[]>={
  relaxed:[{key:'fullness',label:'松量 / %',min:0,max:1,tip:'手动增加或收拢自然垂落时的松量'},
    {key:'taper',label:'收摆 / %',min:0,max:1,tip:'越大，下半段越收拢；不改变布料总长'}],
  a_line:[{key:'flare',label:'张开 / %',min:0,max:1,tip:'A 字两侧的张开程度'},
    {key:'curve',label:'扩展曲线 / %',min:0,max:1,tip:'从较晚展开到较早展开，50 为均匀扩展'}],
  bell:[{key:'volume',label:'鼓起 / %',min:0,max:1,tip:'钟形中段向外鼓起的程度'},
    {key:'peak',label:'鼓起位置 / %',min:.2,max:.85,tip:'最宽处从腰到下摆的位置'}],
  trumpet:[{key:'fit',label:'上段松量 / %',min:0,max:1,tip:'鱼尾上半段贴合或放松的程度'},
    {key:'flare_start',label:'起摆位置 / %',min:.2,max:.85,tip:'从腰到下摆，开始向外扩张的位置'},
    {key:'flare',label:'尾摆扩张 / %',min:0,max:1,tip:'鱼尾下半段向外打开的程度'}],
};
/** Fresh copy: editing one profile keeps the other profiles and hem settings. */
export function effectiveShape(design:SkirtDesign):ShapeSettings {
  return structuredClone(design.shape??defaultShapeSettings);
}
/** Legacy presets remain readable; new edits use continuous ratio + angle. */
export function effectiveHem(design:SkirtDesign){
  const hem=(design.shape??defaultShapeSettings).hem;
  return {ratio:hem.mode==='body'?1.87/2.59:hem.mode==='circle'?1:hem.ratio,
    angle_deg:hem.mode==='deep'?90:hem.mode==='custom'?((hem.angle_deg??0)%180):0};
}
export function setHemParameters(design:SkirtDesign,patch:Partial<{ratio:number;angle_deg:number}>){
  const current=effectiveHem(design),shape=effectiveShape(design);
  const ratio=patch.ratio??current.ratio,angle=patch.angle_deg??current.angle_deg;
  if(!Number.isFinite(ratio)||!Number.isFinite(angle))throw Error('下摆参数无效');
  shape.hem={mode:'custom',ratio:Math.max(.35,Math.min(1,ratio)),angle_deg:((angle%180)+180)%180};design.shape=shape;
}
export function ellipsePerimeter(a:number,b:number){
  const h=((a-b)/(a+b))**2;return Math.PI*(a+b)*(1+3*h/(10+Math.sqrt(4-3*h)));
}
export function hemAxes(design:SkirtDesign){
  const hem=effectiveHem(design),major=design.parameters.hem_cm/ellipsePerimeter(1,hem.ratio);
  return {...hem,major,minor:major*hem.ratio};
}
export function setShapeParameter(design:SkirtDesign,profile:Silhouette,key:string,value:number){
  const control=shapeControls[profile].find(c=>c.key===key);
  if(!control||!Number.isFinite(value))throw Error('未知的廓形参数');
  const shape=effectiveShape(design);
  Object.assign(shape[profile],{[key]:Math.max(control.min,Math.min(control.max,value))});
  design.shape=shape;
}
