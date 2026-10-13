import {useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {Blend,ImagePlus,Layers2,Maximize,Move,Plus,Search,Settings2,Spline,SquareDashed,Trash2,FlipHorizontal} from 'lucide-react';
import {WardrobePanel} from './WardrobePanel';
import {WheelNumber} from './WheelNumber';
import {InlineName} from './InlineName';
import {StampInstances,StampStrokePreview} from './StampPainter';
import type {FabricAsset,FabricFill,Layer,PapercutProject} from '../types/papercut';
import type {LiveStampStroke} from '../utils/liveStamps';
import {fitFabricTransform} from '../utils/fabric';
import {layerContent} from '../utils/layerContent';
import {BUILTIN_STAMPS,DEFAULT_STAMP_SETTINGS,loadStampLibrary,type StampDefinition,type StampSettings} from '../utils/stamps';
import {definitionForMode,libraryForMode,ribbonTileSettings,type MaterialTab,type MotifMode} from '../utils/materialLibrary';

const field='min-w-0 bg-transparent border-0 outline-none text-[11px] focus-visible:ring-1 focus-visible:ring-(--ui-accent)';
function Action({label,children,onClick,disabled=false,pressed}:{label:string;children:ReactNode;onClick:()=>void;disabled?:boolean;pressed?:boolean}){
  return <button type="button" aria-label={label} data-tip={label} disabled={disabled} aria-pressed={pressed} onClick={onClick}
    className={`h-7 w-7 shrink-0 inline-flex items-center justify-center outline-none focus-visible:ring-1 focus-visible:ring-(--ui-accent) hover:bg-(--ui-hover) disabled:opacity-30 ${pressed?'text-(--ui-accent)':'text-(--ui-muted)'}`}>{children}</button>;
}
interface Props {
  project:PapercutProject;layer:Layer|null;onImport:(asset:FabricAsset)=>void;onUse:(asset:FabricAsset)=>void;onUpdate:(fill:FabricFill|undefined)=>void;
  onUseStamp:(definition:StampDefinition)=>void;onEditStamp:(definition:StampDefinition)=>void;onCreateMaterial:(mode:MotifMode)=>void;
  onModeChange:(mode:MotifMode)=>void;onCapture:()=>void;canCapture:boolean;adjusting:boolean;onAdjust:(v:boolean)=>void;
  onWardrobeUpdate:(project:PapercutProject)=>void;onCreateTemplate:()=>void;onEditLiveStamp:(stroke:LiveStampStroke)=>void;
  onExpandLiveStamp:(id:string)=>void;onEditLivePath:(stroke:LiveStampStroke)=>void;request?:{tab:MaterialTab;key:number};activeStampId:string;stampSettings:StampSettings;
}
export function FabricPanel({project,layer,onImport,onUse,onUpdate,onUseStamp,onEditStamp,onCreateMaterial,onModeChange,onCapture,canCapture,adjusting,onAdjust,onWardrobeUpdate,onCreateTemplate,onEditLiveStamp,onExpandLiveStamp,onEditLivePath,request,activeStampId,stampSettings}:Props){
  const file=useRef<HTMLInputElement>(null),search=useRef<HTMLInputElement>(null);
  const [message,setMessage]=useState(''),[tab,setTab]=useState<MaterialTab>(request?.tab??stampSettings.mode),[query,setQuery]=useState(''),[searchOpen,setSearchOpen]=useState(false);
  const [groups,setGroups]=useState({stamp:'all',ribbon:'all'}),[libraryVersion,setLibraryVersion]=useState(0);
  const [sourceOpen,setSourceOpen]=useState(false);
  useEffect(()=>{if(request)setTab(request.tab);},[request?.key,request?.tab]);
  useEffect(()=>{setTab(current=>current==='stamp'||current==='ribbon'?stampSettings.mode:current);},[stampSettings.mode]);
  useEffect(()=>{const refresh=()=>setLibraryVersion(v=>v+1);window.addEventListener('papercut-stamps-changed',refresh);window.addEventListener('storage',refresh);return()=>{window.removeEventListener('papercut-stamps-changed',refresh);window.removeEventListener('storage',refresh);};},[]);
  const library=useMemo(()=>[...BUILTIN_STAMPS,...loadStampLibrary()],[libraryVersion]);
  const fill=layer?.fabric,asset=fill&&project.fabricAssets?.[fill.assetId],assets=Object.values(project.fabricAssets??{});
  const mode=tab==='ribbon'?'ribbon':'stamp',group=groups[mode];
  const recipes=libraryForMode(library,mode).filter(d=>d.name.includes(query)&&(group==='all'||(group==='mine'?!d.builtin:(d.group??'基础纹样')===group)));
  const sources=libraryForMode(library,'stamp').filter(d=>d.name.includes(query));
  const sections=mode==='ribbon'||group!=='all'?[{name:'',entries:recipes}]:[
    {name:'基础纹样',entries:recipes.filter(d=>d.builtin&&(d.group??'基础纹样')==='基础纹样')},
    {name:'经典几何',entries:recipes.filter(d=>d.builtin&&d.group==='白俄罗斯几何纹样')},
    {name:'个人图章',entries:recipes.filter(d=>!d.builtin)},
  ];
  const strokes=(layer?.liveStamps??[]).map((stroke,index)=>({stroke,index})).filter(({stroke})=>stroke.settings.mode===mode);
  const importFile=async(f:File)=>{try{
    if(!['image/png','image/jpeg','image/webp'].includes(f.type)||f.size>20_000_000)throw new Error('请选择 20 MB 以内的 PNG、JPEG 或 WebP 图片。');
    const url=URL.createObjectURL(f);
    try{const img=new Image();img.src=url;await img.decode();const ratio=Math.min(1,2048/Math.max(img.naturalWidth,img.naturalHeight)),canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(img.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(img.naturalHeight*ratio));canvas.getContext('2d')!.drawImage(img,0,0,canvas.width,canvas.height);
      onImport({id:`fabric_${crypto.randomUUID()}`,name:f.name.replace(/\.[^.]+$/,''),src:canvas.toDataURL('image/png'),width:canvas.width,height:canvas.height});setMessage('已收进本项目，单击布样使用，双击调整。');
    }finally{URL.revokeObjectURL(url);}
  }catch(e){setMessage(e instanceof Error?e.message:'无法读取图片');}};
  const scale=fill?Math.hypot(fill.transform[0],fill.transform[1]):1,angle=fill?Math.atan2(fill.transform[1],fill.transform[0])*180/Math.PI:0;
  const patch=(updates:Partial<FabricFill>)=>{if(fill)onUpdate({...fill,...updates});};
  const switchTab=(next:MaterialTab)=>{setTab(next);setMessage('');if(next==='stamp'||next==='ribbon')onModeChange(next);};
  const cell=(definition:StampDefinition,useMode:MotifMode)=>{
    const selected=activeStampId===definition.id&&stampSettings.mode===useMode;
    const choose=()=>definitionForMode(definition,useMode,stampSettings);
    return <button type="button" key={definition.id} aria-label={`使用${useMode==='ribbon'?'织带':'图章'} ${definition.name}`} aria-pressed={selected}
      data-tip={`${definition.name} · 单击使用 / 双击编辑原稿`} onClick={()=>onUseStamp(choose())} onDoubleClick={()=>onEditStamp(choose())}
      className={`min-w-0 py-1 text-left outline-none focus-visible:ring-1 focus-visible:ring-(--ui-accent) group ${selected?'text-(--ui-accent)':'text-(--ui-text-2)'}`}>
      {useMode==='ribbon'?<svg aria-hidden viewBox="0 0 140 60" className="block w-full h-12"><StampStrokePreview definition={definition} settings={ribbonTileSettings(definition)} points={[{x:-20,y:30},{x:160,y:30}]}/></svg>
        :<svg aria-hidden viewBox="0 0 100 100" className="block w-full h-12"><StampInstances definition={definition} settings={definition.settings??DEFAULT_STAMP_SETTINGS} placements={[{x:50,y:50,angle:0,scale:.8}]}/></svg>}
      <span className={`block truncate pt-1 pb-0.5 text-[10px] text-center border-b ${selected?'border-(--ui-accent)':'border-transparent group-hover:border-(--ui-divider)'}`}>{definition.name}</span>
    </button>;
  };
  return <section data-material-panel className="space-y-2 text-xs">
    <nav aria-label="素材类型" className="sticky top-0 z-10 bg-(--ui-panel) flex border-b border-(--ui-divider)">
      {(['stamp','ribbon','fabric','outfit'] as const).map(t=><button key={t} type="button" aria-pressed={tab===t} onClick={()=>switchTab(t)}
        className={`flex-1 py-2 border-b-2 text-[11px] ${tab===t?'border-(--ui-accent) text-(--ui-strong)':'border-transparent text-(--ui-muted) hover:text-(--ui-strong)'}`}>
        {t==='stamp'?'图章':t==='ribbon'?'织带':t==='fabric'?'布料':'套装'}</button>)}
    </nav>
    {tab==='outfit'?<WardrobePanel key={project.id} project={project} onUpdate={onWardrobeUpdate} onCreateTemplate={onCreateTemplate}/>:tab==='stamp'||tab==='ribbon'?<>
      <div className="flex items-center gap-1">
        <select aria-label={mode==='stamp'?'图章分组':'织带分组'} className={field+' flex-1 h-7'} value={group} onChange={e=>setGroups(v=>({...v,[mode]:e.target.value}))}>
          <option value="all">{mode==='stamp'?'全部图章':'全部配方'}</option>
          {mode==='stamp'&&<><option value="基础纹样">基础纹样</option><option value="白俄罗斯几何纹样">经典几何</option></>}
          <option value="mine">{mode==='stamp'?'个人图章':'个人织带'}</option>
        </select>
        <Action label={mode==='stamp'?'新建图章':'新建织带'} onClick={()=>onCreateMaterial(mode)}><Plus size={14}/></Action>
        <Action label={mode==='stamp'?'选中收为图章':'选中收为织带'} onClick={onCapture} disabled={!canCapture}><SquareDashed size={14}/></Action>
        <Action label="搜索素材" pressed={searchOpen||!!query} onClick={()=>{setSearchOpen(v=>!v);requestAnimationFrame(()=>search.current?.focus());}}><Search size={13}/></Action>
      </div>
      {(searchOpen||query)&&<input ref={search} aria-label="素材搜索" placeholder="搜索名称…" className={field+' w-full py-1 border-b border-(--ui-divider)'} value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();setQuery('');setSearchOpen(false);}}}/>}
      {sections.map(section=>section.entries.length>0&&<div key={section.name}>
        {section.name&&<div className="flex items-center gap-2 pt-1 text-[10px] text-(--ui-muted)"><span>{section.name}</span><span className="flex-1 border-t border-(--ui-divider)"/><span>{section.entries.length}</span></div>}
        <div className={mode==='stamp'?'grid grid-cols-4 gap-x-1 gap-y-0.5':'grid grid-cols-2 gap-x-3 gap-y-1'}>{section.entries.map(d=>cell(d,mode))}</div>
      </div>)}
      {!recipes.length&&<p className="py-2 text-[11px] text-(--ui-muted)">{query?'没有匹配素材。':mode==='ribbon'?'还没有个人织带；可以从图章制作。':'还没有个人图章；双击示例编辑后保存。'}</p>}
      {mode==='ribbon'&&<details open={sourceOpen} onToggle={e=>setSourceOpen(e.currentTarget.open)} className="pt-2 border-t border-(--ui-divider)"><summary className="cursor-pointer text-[11px] text-(--ui-muted)">从图章制作<span className="ml-2 text-[10px]">{sources.length}</span></summary>{sourceOpen&&<div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1">{sources.map(d=>cell(d,'ribbon'))}</div>}</details>}
    </>:<>
      <div className="flex items-center gap-2"><button type="button" aria-label="导入图片布料" data-tip="导入 PNG / JPEG / WebP" onClick={()=>file.current?.click()} className="flex items-center gap-1.5 py-1 text-(--ui-muted) hover:text-(--ui-strong)"><ImagePlus size={14}/>导入布样</button><span className="ml-auto text-[10px] text-(--ui-faint)">{assets.length||''}</span></div>
      <input hidden type="file" ref={file} accept="image/png,image/jpeg,image/webp" onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)void importFile(f);}}/>
      <div className="grid grid-cols-3 gap-2">{assets.map(a=><div key={a.id} className="min-w-0">
        <button type="button" aria-label={`使用布料 ${a.name}`} data-tip="单击填入轮廓 / 双击移动布料" className="block w-full outline-none focus-visible:ring-1 focus-visible:ring-(--ui-accent)" onClick={()=>{if(fill?.assetId!==a.id)onUse(a);}} onDoubleClick={()=>{if(fill?.assetId!==a.id)onUse(a);onAdjust(true);}}><img src={a.src} alt="" className="h-14 w-full object-cover"/></button>
        <InlineName value={a.name} onCommit={name=>onImport({...a,name})} label="布料名称" className={`block w-full text-[10px] py-1 border-b ${a.id===asset?.id?'border-(--ui-accent) text-(--ui-accent)':'border-transparent'}`}/>
      </div>)}</div>
      {!assets.length&&<p className="py-2 text-(--ui-muted) text-[11px]">导入照片、扫描布样或插画，填入纸片轮廓。</p>}
      {fill&&asset&&<div className="border-t border-(--ui-divider) pt-2 space-y-1">
        <div className="flex items-center gap-1"><span className="flex-1 truncate text-[11px]">{layer?.name}</span>
          <Action label="在画布上移动布料" pressed={adjusting} onClick={()=>onAdjust(!adjusting)}><Move size={13}/></Action>
          <Action label="布料铺满轮廓" onClick={()=>{const b=layerContent(layer!).bounds;if(b)patch({transform:fitFabricTransform(asset,b,'cover')});}}><Maximize size={13}/></Action>
          <Action label="水平镜像布料" onClick={()=>patch({transform:[-fill.transform[0],-fill.transform[1],fill.transform[2],fill.transform[3],fill.transform[4]+asset.width*fill.transform[0],fill.transform[5]+asset.width*fill.transform[1]]})}><FlipHorizontal size={13}/></Action>
          <Action label="移除布料填充" onClick={()=>onUpdate(undefined)}><Trash2 size={13}/></Action>
        </div>
        <div className="flex items-center justify-between text-[11px]"><span className="text-(--ui-muted)">宽度</span><WheelNumber variant="bare" tip="布料图片宽度" value={asset.width*scale} min={4} max={8000} dragStep={2} format={n=>`${Math.round(n)} px`} onChange={v=>{const k=v/(asset.width*scale);patch({transform:fill.transform.map((n,i)=>i<4?n*k:n) as FabricFill['transform']});}}/><span className="text-(--ui-muted)">角度</span><WheelNumber variant="bare" tip="布料角度" value={angle} min={-180} max={180} dragStep={1} format={n=>`${Math.round(n)}°`} onChange={v=>{const r=(v-angle)*Math.PI/180,c=Math.cos(r),sn=Math.sin(r),[a,b,cc,d,x,y]=fill.transform;patch({transform:[c*a-sn*b,sn*a+c*b,c*cc-sn*d,sn*cc+c*d,x,y]});}}/></div>
        <div className="flex items-center justify-between text-[11px]"><span className="text-(--ui-muted)">X</span><WheelNumber variant="bare" tip="布料位置 X" value={fill.transform[4]} min={-100000} max={100000} dragStep={1} format={n=>String(Math.round(n))} onChange={v=>patch({transform:[...fill.transform.slice(0,4),v,fill.transform[5]] as FabricFill['transform']})}/><span className="text-(--ui-muted)">Y</span><WheelNumber variant="bare" tip="布料位置 Y" value={fill.transform[5]} min={-100000} max={100000} dragStep={1} format={n=>String(Math.round(n))} onChange={v=>patch({transform:[...fill.transform.slice(0,5),v] as FabricFill['transform']})}/></div>
        <div className="flex items-center justify-between"><select aria-label="布料铺设方式" className={field+' h-7'} value={fill.repeat} onChange={e=>patch({repeat:e.target.value as FabricFill['repeat']})}><option value="single">单张</option><option value="tile">平铺</option><option value="mirror">镜像平铺</option></select><WheelNumber variant="bare" tip="布料不透明度" icon={<Blend size={12}/>} value={fill.opacity*100} min={0} max={100} dragStep={1} format={n=>`${Math.round(n)}%`} onChange={v=>patch({opacity:v/100})}/></div>
        {adjusting&&<p role="status" className="text-[10px] text-(--ui-accent)">拖动内部布料，轮廓保持不动。</p>}
      </div>}
    </>}
    {(tab==='stamp'||tab==='ribbon')&&strokes.length>0&&<details className="pt-2 border-t border-(--ui-divider)"><summary className="cursor-pointer text-[11px] text-(--ui-muted)">本图层{mode==='ribbon'?'织带':'图章'}笔画<span className="ml-2">{strokes.length}</span></summary>
      {strokes.map(({stroke,index})=><div key={stroke.id} className="flex items-center gap-1 py-1"><button type="button" data-tip="双击编辑配方" className="min-w-0 flex-1 truncate text-left text-[11px]" onDoubleClick={()=>onEditLiveStamp(stroke)}>{stroke.definition.name}</button>
        <Action label={`编辑纹样笔画 ${index+1}`} onClick={()=>onEditLiveStamp(stroke)}><Settings2 size={13}/></Action>
        <Action label={`调整纹样路径 ${index+1}`} onClick={()=>onEditLivePath(stroke)}><Spline size={13}/></Action>
        <Action label={`展开纹样笔画 ${index+1}`} onClick={()=>onExpandLiveStamp(stroke.id)}><Layers2 size={13}/></Action>
      </div>)}
    </details>}
    {message&&<p role="status" className="text-[10px] text-(--ui-muted)">{message}</p>}
  </section>;
}
