import type { PapercutProject } from '../types/papercut';
import type { GodotExportOptions } from './godotExport';
import { computeDepthTable, flattenLayerIds, isLayerRendered } from './projectOps';

/** Only portable project-relative folders; never allow archive path traversal. */
export function normalizeResourceRoot(value: string): string {
  const input=value.trim();
  if(input==='res://') return input;
  const root=input.replace(/\/+$/,'');
  if(!root.startsWith('res://')) throw Error('资源路径必须以 res:// 开头');
  const segments=root.slice(6).split('/');
  if(segments.some(s=>!s||s==='.'||s==='..'||/[\\:"<>|?*\x00-\x1f]/.test(s)||/[. ]$/.test(s)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(s)))
    throw Error('资源路径含无效目录，请使用 res://art/papercut 这样的路径');
  return root;
}
export function checkGodotExport(project:PapercutProject, options:GodotExportOptions) {
  const errors:string[]=[],warnings:string[]=[];
  try{normalizeResourceRoot(options.resRoot);}catch(e){errors.push((e as Error).message);}
  if(![1,2,4].includes(options.textureScale))errors.push('纹理倍率必须为 1、2 或 4');
  if(![project.width,project.height].every(n=>Number.isFinite(n)&&n>0))errors.push('画布尺寸无效');
  const order=flattenLayerIds(project),ordered=new Set(order),owners=new Map<string,string>();
  if(ordered.size!==order.length)errors.push('深度列表含重复图层');
  const ids=new Set<string>();
  const finitePoint=(p:{x:number;y:number})=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
  for(const item of project.items||[]){
    if(!item.id||ids.has(item.id))errors.push(`「${item.name}」物件 ID 重复或为空`);
    ids.add(item.id);
    if(!finitePoint(item.pivot))errors.push(`「${item.name}」原点坐标无效`);
    for(const socket of item.sockets||[])if(!finitePoint(socket))errors.push(`「${item.name}」挂点 ${socket.name} 坐标无效`);
    for(const id of item.partIds){
      if(!project.layers[id]||!ordered.has(id))errors.push(`「${item.name}」引用了不在深度列表中的部件`);
      if(owners.has(id))errors.push(`「${project.layers[id]?.name||id}」重复归属物件`);
      owners.set(id,item.id);
    }
  }
  const included=order.filter(id=>(options.includeHidden||isLayerRendered(project,id))&&(options.includeLooseLayers||owners.has(id)));
  if(!included.length)errors.push('没有符合当前选项的可见部件');
  const z=computeDepthTable(project).zOf;
  if(included.some(id=>Math.abs(z[id]||0)>4096))errors.push('深度超出 Godot 的 z_index 范围，请减少深度组或组内纸片');
  const loose=order.filter(id=>!owners.has(id)&&isLayerRendered(project,id)).length;
  if(loose&&!options.includeLooseLayers)warnings.push(`${loose} 个未归组部件不会导出`);
  const blended=included.filter(id=>project.layers[id].blendMode!=='normal').length;
  if(blended)warnings.push(`${blended} 个部件将烘焙同物件内的混合色，动画移动后不会重新混色`);
  const hidden=order.filter(id=>!isLayerRendered(project,id)).length;
  if(hidden&&!options.includeHidden)warnings.push(`${hidden} 个隐藏部件不会导出`);
  const orphan=Object.keys(project.layers).filter(id=>!ordered.has(id)).length;
  if(orphan)warnings.push(`${orphan} 个未放入深度列表的图层不会导出`);
  return {errors:[...new Set(errors)],warnings,partCount:included.length};
}

export function assertTextureBudget(width:number,height:number,scale:number,layerName:string) {
  const w=Math.ceil(width*scale),h=Math.ceil(height*scale);
  if(!Number.isFinite(w)||!Number.isFinite(h)||w<1||h<1||w>8192||h>8192||w*h>32_000_000)
    throw Error(`「${layerName}」贴图过大（${w} × ${h}），请降低纹理倍率或拆分部件`);
}
