export type CanvasView = 'front' | 'sector' | 'ring';
export type Template = 'plain' | 'mosuo_reference' | 'yi_reference' | 'wax_reference';
export type Pattern = 'solid' | 'dash' | 'diamond' | 'wax';
export type Fabric = 'cotton' | 'linen' | 'silk' | 'wool';
export type UV = [number, number];
export interface Band { id:string; start:number; end:number; color:string; pattern:Pattern; repeat:number }
export interface Patch { id:string; u0:number; u1:number; v0:number; v1:number; color:string; pattern:Pattern; repeat:number }
export interface Stroke { id:string; color:string; width:number; points:UV[] }
export interface Parameters { length_cm:number; waist_cm:number; hem_cm:number; pleat_count:number; pleat_depth_cm:number; sharpness:number; thickness_mm:number; fabric:Fabric; base_color:string }
export interface SkirtDesign {
  schema:'weave-pleated-skirt'; version:1; design_id:string; item_id:string; component_id:string; collection_id:string;
  template_id:Template; canvas_view:CanvasView;
  source:{note:string; references:{title:string;path:string}[]};
  parameters:Parameters; bands:Band[]; patches:Patch[]; strokes:Stroke[];
  pattern_uv:{origin:'waist';seam:'back';u:'circumference';v:'waist_to_hem'};
}
export const templates:Record<Template,string> = {plain:'素裙 · 自由设计',mosuo_reference:'摩梭照片参考',yi_reference:'彝族照片参考',wax_reference:'蜡染照片参考'};
export const views:Record<CanvasView,string> = {front:'01 正视梯形',sector:'02 半圆环展开',ring:'03 圆环俯视'};
export const fabrics:Record<Fabric,string> = {cotton:'棉布',linen:'亚麻',silk:'丝绸',wool:'毛呢'};
export const patterns:Record<Pattern,string> = {solid:'纯色',dash:'针脚',diamond:'菱格',wax:'蜡染几何'};
export const limits = {length_cm:[40,120],waist_cm:[50,110],hem_cm:[100,360],pleat_count:[16,128],pleat_depth_cm:[.2,4],sharpness:[0,1],thickness_mm:[.2,3]} as const;
export const newId = () => crypto.randomUUID();
const band = (start:number,end:number,color:string,pattern:Pattern='solid',repeat=32):Band => ({id:newId(),start,end,color,pattern,repeat});
export function createDesign(template:Template='mosuo_reference'):SkirtDesign {
  const d:SkirtDesign = {schema:'weave-pleated-skirt',version:1,design_id:newId(),item_id:newId(),component_id:newId(),collection_id:'pleated-skirt-study',template_id:template,canvas_view:'sector',source:{note:'依据用户提供的服饰照片建立的可编辑设计起点；具体地域与工艺以来源为准。',references:[]},parameters:{length_cm:88,waist_cm:68,hem_cm:230,pleat_count:64,pleat_depth_cm:1.4,sharpness:.82,thickness_mm:.7,fabric:'cotton',base_color:'#ede8db'},bands:[],patches:[],strokes:[],pattern_uv:{origin:'waist',seam:'back',u:'circumference',v:'waist_to_hem'}};
  if(template==='mosuo_reference') {
    d.bands=[band(.79,.80,'#c74674')];
    d.source.references=[{title:'当代摩梭母女-1 — 摄影者朱晓安',path:'D:/Eagle库/纯纯素材仓库.library/images/MVL2PCZVKPFCJ.info/当代摩梭母女-1 - 摄影者朱晓安.jpg'}];
  } else if(template==='yi_reference') {
    Object.assign(d.parameters,{base_color:'#202135',hem_cm:290,pleat_count:96,sharpness:.96});
    d.bands=[band(.42,.72,'#765178'),band(.72,.745,'#34b6cc'),band(.75,.76,'#e6ddd5'),band(.77,.78,'#d84b69'),band(.785,.81,'#e9ded4','dash',48)];
    d.source.references=[{title:'收到了越西老板寄来的彝族裙子 — baby blue',path:'D:/Eagle库/纯纯素材仓库.library/images/MVL2IMSGPE1ZL.info/收到了越西老板寄来的彝族裙子 - baby blue.jpg'}];
  } else if(template==='wax_reference') {
    Object.assign(d.parameters,{base_color:'#e3dfcc',hem_cm:280,pleat_count:96,sharpness:.7,fabric:'linen'});
    d.bands=[band(.56,.61,'#293b43'),band(.64,.76,'#283d48','wax',32),band(.80,.82,'#263d45'),band(.88,.94,'#273b43','diamond',40)];
    d.source.references=[{title:'用户提供的手工蜡染裙参考图',path:'user-reference:codex-clipboard-b560de74-fa8d-40a8-8261-94da1e678c64.png'}];
  }
  return d;
}
function object(v:unknown):Record<string,unknown> { if(!v||typeof v!=='object'||Array.isArray(v))throw Error('裙子设计应为对象');return v as Record<string,unknown>; }
function exact(v:Record<string,unknown>,fields:string){const keys=fields.split(' ');if(Object.keys(v).some(k=>!keys.includes(k))||keys.some(k=>!Object.hasOwn(v,k)))throw Error('裙子设计包含缺失或未知的字段');}
function text(v:unknown,max=512):string {if(typeof v!=='string'||!v.length||v.length>max)throw Error('裙子文字字段无效');return v;}
function num(v:unknown,min:number,max:number):number {if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error(`裙子参数范围应为 ${min}–${max}`);return v;}
function enumValue<T extends string>(v:unknown,values:Record<T,string>):T {if(typeof v!=='string'||!Object.hasOwn(values,v))throw Error('未知的裙子选项');return v as T;}
export function color(v:unknown):string {if(typeof v!=='string'||!/^#[0-9a-f]{6}$/i.test(v))throw Error('颜色应为 #RRGGBB');return v;}
function list(v:unknown,max:number):unknown[] {if(!Array.isArray(v)||v.length>max)throw Error('裙子片段数量超限或格式无效');return v;}
/** Strict, transactional import: never mutate the active design until this succeeds. */
export function parseDesign(value:unknown):SkirtDesign {
  const v=object(value);if(v.schema!=='weave-pleated-skirt'||v.version!==1)throw Error('需要 weave-pleated-skirt v1 设计文件');
  const p=object(v.parameters),s=object(v.source),uv=object(v.pattern_uv),ids=new Set<string>();
  exact(v,'schema version design_id item_id component_id collection_id template_id canvas_view source parameters bands patches strokes pattern_uv');
  exact(p,'length_cm waist_cm hem_cm pleat_count pleat_depth_cm sharpness thickness_mm fabric base_color');exact(s,'note references');exact(uv,'origin seam u v');
  const id=(value:unknown)=>{const str=text(value,128);if(ids.has(str))throw Error('裙子片段 ID 重复');ids.add(str);return str;};
  const parameters={} as Parameters;
  for(const [key,range] of Object.entries(limits)) (parameters as unknown as Record<string,unknown>)[key]=num(p[key],range[0],range[1]);
  if(!Number.isInteger(parameters.pleat_count))throw Error('褶数必须为整数');
  parameters.fabric=enumValue(p.fabric,fabrics);parameters.base_color=color(p.base_color);
  const decoration=(b:Record<string,unknown>)=>{const repeat=num(b.repeat,4,64);if(!Number.isInteger(repeat))throw Error('纹样重复次数必须为整数');return {id:id(b.id),color:color(b.color),pattern:enumValue(b.pattern,patterns),repeat};};
  const bands=list(v.bands,32).map(x=>{const b=object(x);exact(b,'id start end color pattern repeat');const start=num(b.start,0,.995),end=num(b.end,.005,1);if(end-start<.004999)throw Error('镶边宽度至少为裙长的 0.5%');return {...decoration(b),start,end};});
  const patches=list(v.patches,64).map(x=>{const b=object(x);exact(b,'id u0 u1 v0 v1 color pattern repeat');const u0=num(b.u0,0,1),u1=num(b.u1,0,1),v0=num(b.v0,0,1),v1=num(b.v1,0,1);if(u1<=u0||v1<=v0)throw Error('拼色片区域无效');return {...decoration(b),u0,u1,v0,v1};});
  let count=0;const strokes=list(v.strokes,256).map(x=>{const b=object(x);exact(b,'id color width points');const points=list(b.points,40000).map(x=>{if(!Array.isArray(x)||x.length!==2)throw Error('笔迹坐标无效');return [num(x[0],0,1),num(x[1],0,1)] as UV;});count+=points.length;if(count>40000)throw Error('笔迹最多 40000 点');return {id:id(b.id),color:color(b.color),width:num(b.width,.001,.05),points};});
  if(uv.origin!=='waist'||uv.seam!=='back'||uv.u!=='circumference'||uv.v!=='waist_to_hem')throw Error('裙子纹样坐标不匹配');
  if(typeof s.note!=='string'||s.note.length>4000)throw Error('来源说明无效');
  return {schema:'weave-pleated-skirt',version:1,design_id:text(v.design_id,128),item_id:text(v.item_id,128),component_id:text(v.component_id,128),collection_id:text(v.collection_id,128),template_id:enumValue(v.template_id,templates),canvas_view:enumValue(v.canvas_view,views),source:{note:s.note,references:list(s.references,32).map(r=>{const x=object(r);exact(x,'title path');return {title:text(x.title),path:text(x.path,2048)};})},parameters,bands,patches,strokes,pattern_uv:{origin:'waist',seam:'back',u:'circumference',v:'waist_to_hem'}};
}
