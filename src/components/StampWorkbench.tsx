import {useEffect,useRef,useState} from 'react';
import {Check,Copy,Download,GripHorizontal,Minus,Pencil,Plus,RotateCcw,Save,Trash2,Undo2,Upload,X} from 'lucide-react';
import type {CutoutPath,Layer} from '../types/papercut';
import {BUILTIN_STAMPS,DEFAULT_STAMP_SETTINGS,loadStampLibrary,saveStampLibrary,validateStampLibrary,type StampDefinition,type StampSettings} from '../utils/stamps';
import {StampInstances,StampPainter,StampStrokePreview} from './StampPainter';
import {layerContent} from '../utils/layerContent';
import {transformPathD,multiply,translate,scaleAbout} from '../utils/pathTransform';
import {downloadFile} from '../utils/svgExporter';
import {RibbonOptions} from './RibbonOptions';
import {normalizeHex} from '../utils/color';
import {InlineName} from './InlineName';
import {WheelNumber} from './WheelNumber';
import {motifMode} from '../utils/materialLibrary';
import {PROPERTY_GESTURE_EVENT,type PropertyGestureDetail} from '../utils/propertyGesture';

const field='w-full min-w-0 bg-transparent border-b border-(--ui-border) px-1 py-1 text-xs outline-none focus:border-(--ui-accent)';
const action='inline-flex h-7 w-7 shrink-0 items-center justify-center text-(--ui-muted) hover:bg-(--ui-hover) hover:text-(--ui-strong) disabled:opacity-30 focus-visible:outline focus-visible:outline-1 focus-visible:outline-(--ui-accent)';
function Dial({label,value,min,max,step=1,onChange,unit=''}:{label:string;value:number;min:number;max:number;step?:number;onChange:(n:number)=>void;unit?:string}){
  return <div className="flex min-h-7 items-center justify-between gap-2 text-[11px]"><span className="text-(--ui-muted)">{label}</span><WheelNumber variant="bare" value={value} min={min} max={max} step={step} dragStep={step} tip={label} format={n=>`${Math.round(n*100)/100}${unit}`} onChange={onChange}/></div>;
}
export function StampWorkbench({definition,settings,onDefinition,onSettings,activeLayer,onEditCanvas,onClose,hideLibrary=false,onApplyStroke}:{definition:StampDefinition;settings:StampSettings;onDefinition:(d:StampDefinition)=>void;onSettings:(s:StampSettings)=>void;activeLayer:Layer|null;onEditCanvas:()=>void;onClose:()=>void;hideLibrary?:boolean;onApplyStroke?:()=>void}){
  const [library,setLibrary]=useState(loadStampLibrary),[tab,setTab]=useState<'pattern'|'brush'|'weave'>('brush'),[collapsed,setCollapsed]=useState(false);
  useEffect(()=>{if(settings.mode==='stamp'&&tab==='weave')setTab('brush');},[settings.mode,tab]);
  useEffect(()=>{const refresh=()=>setLibrary(loadStampLibrary());window.addEventListener('papercut-stamps-changed',refresh);window.addEventListener('storage',refresh);return()=>{window.removeEventListener('papercut-stamps-changed',refresh);window.removeEventListener('storage',refresh);};},[]);
  const [group,setGroup]=useState('基础纹样'),[query,setQuery]=useState('');
  const drafts=useRef(new Map<string,StampDefinition>());
  const savedDefinition=[...BUILTIN_STAMPS,...library].find(d=>d.id===definition.id);
  const dirty=!savedDefinition||JSON.stringify({...definition,settings})!==JSON.stringify({...savedDefinition,settings:savedDefinition.settings??DEFAULT_STAMP_SETTINGS});
  const shown=[...BUILTIN_STAMPS,...library].filter(d=>(group==='全部'||(group==='我的图章'?!d.builtin:(d.group??'基础纹样')===group))&&d.name.includes(query));
  const [position,setPosition]=useState({x:Math.max(8,window.innerWidth-598),y:94});
  const [trials,setTrials]=useState<CutoutPath[][]>([]),[message,setMessage]=useState(''),[parameterUndo,setParameterUndo]=useState<StampSettings|null>(null);
  const currentSettings=useRef(settings);currentSettings.current=settings;
  const parameterGesture=useRef<{id:string;before:StampSettings;changed:boolean}|null>(null);
  useEffect(()=>{
    const event=(event:Event)=>{
      const detail=(event as CustomEvent<PropertyGestureDetail>).detail;
      if(detail.phase==='begin'){parameterGesture.current={id:detail.id,before:structuredClone(currentSettings.current),changed:false};return;}
      const gesture=parameterGesture.current;if(!gesture||gesture.id!==detail.id)return;
      if(gesture.changed&&detail.phase==='end')setParameterUndo(gesture.before);
      parameterGesture.current=null;
    };
    window.addEventListener(PROPERTY_GESTURE_EVENT,event);return()=>window.removeEventListener(PROPERTY_GESTURE_EVENT,event);
  },[]);
  const moving=useRef<{x:number;y:number;px:number;py:number}|null>(null),file=useRef<HTMLInputElement>(null);
  const palette=[...new Set(definition.parts.map(p=>p.color))];
  const set=(patch:Partial<StampSettings>)=>{if(parameterGesture.current)parameterGesture.current.changed=true;else setParameterUndo(structuredClone(settings));onSettings({...settings,...patch});};
  const choose=(next:StampDefinition)=>{if(dirty)drafts.current.set(definition.id,{...definition,settings:structuredClone(settings)});const selected=drafts.current.get(next.id)??next;onDefinition(structuredClone(selected));if((selected.settings?.mode??settings.mode)==='stamp'&&tab==='weave')setTab('brush');onSettings({...DEFAULT_STAMP_SETTINGS,...(!selected.settings?{mode:settings.mode,ribbonWidth:settings.ribbonWidth,ribbonFill:settings.ribbonFill,ribbonColor:settings.ribbonColor,ribbonEdge:settings.ribbonEdge,ribbonEdgeColor:settings.ribbonEdgeColor,ribbonRows:settings.ribbonRows,ribbonRowGap:settings.ribbonRowGap,ribbonStagger:settings.ribbonStagger,selvage:settings.selvage,selvageWidth:settings.selvageWidth,selvageDepth:settings.selvageDepth,selvageSpacing:settings.selvageSpacing,selvageInset:settings.selvageInset,selvageColor:settings.selvageColor,skipColorMode:settings.skipColorMode,skipColorEvery:settings.skipColorEvery,skipColorSource:settings.skipColorSource,skipColors:settings.skipColors}:{}),...selected.settings});setParameterUndo(null);setMessage(drafts.current.has(next.id)?'已恢复尚未保存的编辑。':'');};
  const persist=(next:StampDefinition[])=>{try{saveStampLibrary(next);setLibrary(next);return true;}catch{setMessage('本地存储空间不足，请导出备份图章库。');return false;}};
  const save=(copy=false)=>{if(!definition.parts.length&&!(settings.mode==='ribbon'&&settings.ribbonFill)){setMessage('先添加图案或从图层采集。');return;}const saved={...definition,settings:structuredClone(settings),builtin:false,id:copy||definition.builtin||library.some(d=>d.id===definition.id&&motifMode(d)!==settings.mode)?`user_${Date.now()}`:definition.id};const next=[...library.filter(s=>s.id!==saved.id),saved];if(next.length>100){setMessage('图章库最多 100 个图章，请先导出备份。');return;}try{validateStampLibrary([saved]);}catch{setMessage('图案过于复杂或含无效路径，请精简到 200 个色块以内。');return;}if(persist(next)){drafts.current.delete(saved.id);onDefinition(saved);setGroup('我的图章');setQuery('');setMessage('已保存到我的图章，可导出备份。');}};
  const capture=()=>{
    if(!activeLayer)return;
    if(activeLayer.fabric){setMessage('图片布料不能转为矢量图章。请选中描摹后的图形，再收为图章。');return;}
    if(activeLayer.opacity<1||activeLayer.blendMode!=='normal'||activeLayer.pattern&&(activeLayer.pattern.opacity??1)>0||activeLayer.stroke?.enabled&&activeLayer.stroke.width>0&&activeLayer.stroke.opacity>0||(activeLayer.drawings??[]).some(p=>p.opacity>0&&(p.opacity<1||(p.blur??0)>0))){setMessage('当前图层带有透明、描边或纹理效果。请使用“选中 → 收为图章”，确认简化效果后保存。');return;}
    const content=layerContent(activeLayer),b=content.bounds;
    if(!b||!content.pieces.length){setMessage('当前图层没有可采集的图形。');return;}
    if(content.pieces.length>200){setMessage('请将图案整理为 200 个以内的色块后采集。');return;}
    const scale=90/Math.max(b.width,b.height),m=multiply(translate(50,50),multiply(scaleAbout(scale,0,0),translate(-b.x-b.width/2,-b.y-b.height/2)));
    choose({id:`user_${Date.now()}`,name:activeLayer.name+' · 图章',parts:content.pieces.map((p,i)=>({id:`p${i}`,d:transformPathD(p.d,m),color:normalizeHex(p.color)??'#000000'}))});setTab('pattern');setMessage('已采集可见轮廓；可编辑节点后保存入库。');
  };
  useEffect(()=>{const resize=()=>setPosition(p=>({x:Math.max(8,Math.min(p.x,window.innerWidth-Math.min(580,window.innerWidth-16)-8)),y:Math.max(8,Math.min(p.y,window.innerHeight-100))}));window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);},[]);
  const previewRatio=Math.min(1,36/settings.size,50/settings.ribbonWidth);
  const motifAngle=settings.angle*Math.PI/180;
  const motifPreviewScale=Math.min(1,142/((100*settings.motifScale+settings.outline*2)*(Math.abs(Math.cos(motifAngle))+Math.abs(Math.sin(motifAngle)))));
  const previewSettings={...settings,size:settings.size*previewRatio,ribbonWidth:settings.ribbonWidth*previewRatio,ribbonEdge:settings.ribbonEdge*previewRatio,selvageWidth:settings.selvageWidth*previewRatio,selvageDepth:settings.selvageDepth*previewRatio,selvageSpacing:settings.selvageSpacing*previewRatio,selvageInset:settings.selvageInset*previewRatio};
  const strokePreview=Array.from({length:41},(_,i)=>({x:22+i*7,y:40+Math.sin(i/40*Math.PI*2)*15}));
  return <section data-stamp-workbench role="dialog" aria-modal="false" aria-label={settings.mode==='ribbon'?'织带工作台':'图章工作台'} className="fixed z-[45] border border-(--ui-border-strong) bg-(--ui-panel) text-(--ui-text) shadow-xl text-xs" style={{left:position.x,top:position.y,width:collapsed?220:'min(580px,calc(100vw - 16px))'}}>
    <header className="flex h-9 items-center gap-2 px-2 border-b border-(--ui-divider) touch-none cursor-move" onPointerDown={e=>{if((e.target as Element).closest('button'))return;e.currentTarget.setPointerCapture(e.pointerId);moving.current={x:e.clientX,y:e.clientY,px:position.x,py:position.y};}} onPointerMove={e=>{const p=moving.current;if(p)setPosition({x:Math.max(0,Math.min(window.innerWidth-150,p.px+e.clientX-p.x)),y:Math.max(0,Math.min(window.innerHeight-40,p.py+e.clientY-p.y))});}} onPointerUp={()=>moving.current=null} onPointerCancel={()=>moving.current=null}>
      <GripHorizontal size={14} className="text-(--ui-muted)"/><strong className="flex-1 font-medium">{settings.mode==='ribbon'?'织带':'图章'}工作台 <span className="font-normal text-[10px] text-(--ui-muted)">{dirty?'• 未保存':''}</span></strong><button className={action} data-tip={collapsed?'展开工作台':'折叠工作台'} aria-label={collapsed?'展开图章工作台':'折叠图章工作台'} onClick={()=>setCollapsed(v=>!v)}>{collapsed?<Plus size={14}/>:<Minus size={14}/>}</button><button className={action} data-tip="关闭工作台" aria-label="关闭图章工作台" onClick={onClose}><X size={14}/></button>
    </header>
    {!collapsed&&<div className="p-2.5 overflow-y-auto space-y-2.5" style={{maxHeight:`calc(100dvh - ${position.y+38}px)`}}>
      <nav aria-label="图章绘制方式" className="flex items-center gap-4 border-b border-(--ui-divider)">{(['stamp','ribbon'] as const).map(mode=><button key={mode} aria-pressed={settings.mode===mode} className={`pb-1.5 ${settings.mode===mode?'border-b border-(--ui-accent) text-(--ui-strong)':'text-(--ui-muted)'}`} onClick={()=>{set({mode});setTab(mode==='ribbon'?'weave':'brush');}}>{mode==='stamp'?'图章':'织带'}</button>)}<span className="ml-auto pb-1.5 text-[10px] text-(--ui-muted)">{settings.mode==='ribbon'?'连续纹样':'盖印 / 散布'}</span></nav>
      <div className="flex items-center gap-1"><InlineName label="图章名称" value={definition.name} onCommit={name=>onDefinition({...definition,name})} className="min-w-0 flex-1 font-medium" maxLength={80}/><button className={action} data-tip="保存到素材库" aria-label="保存图章" onClick={()=>save()}><Save size={15}/></button><button className={action} data-tip="另存副本" aria-label="另存图章副本" onClick={()=>save(true)}><Copy size={15}/></button><button className={action} data-tip="新建图案" aria-label="新建图章" onClick={()=>{choose({id:`user_${Date.now()}`,name:settings.mode==='ribbon'?'新织带':'新图章',parts:[]});setTab('pattern');}}><Plus size={16}/></button></div>
      {!hideLibrary&&<><div className="flex gap-2"><select className={field} aria-label="图章示例组" value={group} onChange={e=>setGroup(e.target.value)}>{['基础纹样','白俄罗斯几何纹样','织带示例','我的图章','全部'].map(g=><option key={g}>{g}</option>)}</select><input className={field} aria-label="搜索图章" placeholder="搜索图章…" value={query} onChange={e=>setQuery(e.target.value)}/></div>
      <div className="grid grid-cols-8 gap-1 max-h-40 overflow-y-auto pb-1" aria-label="图章库">{shown.map(d=><button key={d.id} title={d.name} aria-label={`使用图章 ${d.name}`} aria-pressed={definition.id===d.id} className={`stamp-library-cell min-w-0 border ${definition.id===d.id?'border-(--ui-accent)':'border-transparent'}`} onClick={()=>choose(d)}><svg viewBox="-5 -5 110 110" className="w-full h-12 bg-[#f6eee2]">{d.settings?.mode==='ribbon'?<StampStrokePreview definition={d} settings={{...d.settings,size:40,ribbonWidth:d.settings.ribbonWidth/d.settings.size*40,ribbonEdge:1}} points={[{x:0,y:50},{x:100,y:50}]}/>:<StampInstances definition={d} settings={d.settings??DEFAULT_STAMP_SETTINGS} placements={[{x:50,y:50,scale:1,angle:0}]}/>}</svg><span className="block truncate text-[9px] py-1">{d.name}</span></button>)}</div>
      {!shown.length&&<p className="text-(--ui-muted)">没有匹配图章；试试其他分组或关键词。</p>}</>}
      <div className="grid grid-cols-1 min-[560px]:grid-cols-[minmax(0,1fr)_216px] gap-3">
        <div className="space-y-2.5 min-w-0">
          <div>
            <div className="flex h-6 items-center justify-between text-[11px] text-(--ui-muted)"><span>图案 <span className="ml-1 text-[10px]">{definition.parts.length} 色块</span></span><button className={action} aria-label="编辑图案画布" data-tip="编辑图案 · 也可双击预览" onClick={onEditCanvas}><Pencil size={13}/></button></div>
            <svg viewBox="0 0 160 160" className="w-full h-28 cursor-pointer" aria-label="图章成品预览" data-tip="双击编辑原图案" onDoubleClick={onEditCanvas}><StampInstances definition={definition} settings={settings} placements={[{x:80,y:80,angle:motifAngle,scale:motifPreviewScale}]}/></svg>
          </div>
          <div><div className="text-(--ui-muted) text-[11px] mb-1">笔画</div><svg viewBox="0 0 324 80" className="w-full h-16" aria-label="图章笔画预览"><StampStrokePreview definition={definition} settings={previewSettings} points={strokePreview}/></svg></div>
          <div><div className="flex h-6 items-center justify-between text-[11px] text-(--ui-muted)"><span>试印 <span className="text-[10px]">· 不影响画布</span></span><span className="flex"><button className={action} disabled={!trials.length} data-tip="撤销试印" aria-label="撤销试印" onClick={()=>setTrials(t=>t.slice(0,-1))}><Undo2 size={13}/></button><button className={action} disabled={!trials.length} data-tip="清空试印" aria-label="清空试印" onClick={()=>setTrials([])}><Trash2 size={13}/></button></span></div><svg viewBox="0 0 324 160" className="w-full bg-[#fff2c9] touch-none" aria-label="图章试印区">{trials.flat().map(p=><path key={p.id} d={p.d} fill={p.fillColor}/>)}<StampPainter definition={definition} settings={settings} width={324} height={160} onCommit={p=>setTrials(t=>[...t.slice(-9),p])}/></svg></div>
        </div>
        <div className="space-y-2 min-w-0">
          <nav aria-label="图章参数" className="flex gap-4 border-b border-(--ui-divider)">{((settings.mode==='ribbon'?['pattern','brush','weave']:['pattern','brush']) as ('pattern'|'brush'|'weave')[]).map(t=><button key={t} aria-pressed={tab===t} className={`pb-1.5 ${tab===t?'border-b border-(--ui-accent) text-(--ui-strong)':'text-(--ui-muted)'}`} onClick={()=>setTab(t)}>{t==='pattern'?'图案':t==='weave'?'编排':'笔刷'}</button>)}</nav>
          {tab==='pattern'?<>
            <button disabled={!activeLayer} onClick={capture} className="flex items-center gap-1.5 text-(--ui-strong) py-1 disabled:opacity-30 hover:text-(--ui-accent)"><Copy size={13}/>从当前图层采集</button>
            <Dial label="图案缩放" value={settings.motifScale*100} min={50} max={150} onChange={n=>set({motifScale:n/100})} unit="%"/>
            <Dial label="整体色相" value={settings.hue} min={-180} max={180} onChange={hue=>set({hue})} unit="°"/>
            <Dial label="整体饱和度" value={settings.saturation} min={-100} max={100} onChange={saturation=>set({saturation})}/>
            <Dial label="整体明度" value={settings.lightness} min={-80} max={80} onChange={lightness=>set({lightness})}/>
            <div className="flex items-center justify-between gap-2 py-1"><span className="text-(--ui-muted) text-[11px] shrink-0">重着色</span><div className="flex flex-wrap justify-end gap-1">{palette.map(c=><input key={c} aria-label={`替换颜色 ${c}`} data-tip={`替换 ${c}`} type="color" className="w-6 h-6" value={settings.recolor[c]??c} onChange={e=>set({recolor:{...settings.recolor,[c]:e.target.value}})}/>)}</div></div>
            <Dial label="描边宽度" value={settings.outline} min={0} max={6} step={.25} onChange={outline=>set({outline})}/>
            <label className="flex items-center justify-between text-(--ui-muted)">描边颜色<input type="color" aria-label="图章描边颜色" value={settings.outlineColor} onChange={e=>set({outlineColor:e.target.value})} className="w-7 h-6"/></label>
          </>:tab==='weave'?<RibbonOptions settings={settings} onChange={set} palette={palette}/>:<>
            {settings.mode==='ribbon'&&<div className="space-y-1 border-b border-(--ui-divider) pb-2">
              <Dial label="织带宽度" value={settings.ribbonWidth} min={8} max={400} onChange={ribbonWidth=>set({ribbonWidth})} unit=" px"/>
              <label className="flex items-center justify-between text-[11px]"><span className="flex items-center gap-2"><input type="checkbox" checked={settings.ribbonFill} onChange={e=>set({ribbonFill:e.target.checked})}/>连续底带</span><input type="color" aria-label="织带底色" disabled={!settings.ribbonFill} value={settings.ribbonColor} onChange={e=>set({ribbonColor:e.target.value})} className="w-7 h-6"/></label>
              {settings.ribbonFill&&<><Dial label="织带边线" value={settings.ribbonEdge} min={0} max={12} step={.5} onChange={ribbonEdge=>set({ribbonEdge})} unit=" px"/><label className="flex items-center justify-between text-(--ui-muted)">边线颜色<input type="color" aria-label="织带边线颜色" value={settings.ribbonEdgeColor} onChange={e=>set({ribbonEdgeColor:e.target.value})} className="w-7 h-6"/></label></>}
            </div>}
            <Dial label={settings.mode==='ribbon'?'纹样尺寸':'盖印尺寸'} value={settings.size} min={8} max={300} onChange={size=>set({size})} unit=" px"/>
            <Dial label="图案间距" value={settings.spacing} min={.15} max={3} step={.05} onChange={spacing=>set({spacing})} unit=" × 尺寸"/>
            <Dial label="初始角度" value={settings.angle} min={-180} max={180} onChange={angle=>set({angle})} unit="°"/>
            {settings.mode==='stamp'?<label className="flex items-center gap-2 text-[11px]"><input type="checkbox" checked={settings.follow} onChange={e=>set({follow:e.target.checked})}/>跟随路径旋转</label>:<p className="text-[10px] text-(--ui-muted)">织带纹样始终跟随路径转向。</p>}
            <div className="border-t border-(--ui-divider) pt-2 space-y-1"><span className="text-[10px] text-(--ui-muted)">随机变化</span><Dial label="横向散布" value={settings.scatter} min={0} max={.5} step={.01} onChange={scatter=>set({scatter})}/><Dial label="大小变化" value={settings.sizeJitter} min={0} max={.3} step={.01} onChange={sizeJitter=>set({sizeJitter})}/><Dial label="角度变化" value={settings.angleJitter} min={0} max={30} onChange={angleJitter=>set({angleJitter})} unit="°"/></div>
          </>}
          <div className="flex items-center justify-between border-t border-(--ui-divider) pt-1 text-[10px] text-(--ui-muted)"><span>滚轮调值 · 双击输入</span><div className="flex"><button className={action} data-tip="撤销参数调整" aria-label="撤销参数调整" disabled={!parameterUndo} onClick={()=>{if(parameterUndo){onSettings(parameterUndo);setParameterUndo(null);}}}><Undo2 size={13}/></button><button className={action} data-tip="恢复默认参数" aria-label="恢复默认参数" onClick={()=>{setParameterUndo(structuredClone(settings));onSettings({...DEFAULT_STAMP_SETTINGS,mode:settings.mode});}}><RotateCcw size={13}/></button></div></div>
        </div>
      </div>
      {onApplyStroke&&<button onClick={onApplyStroke} className="flex w-full items-center justify-center gap-1.5 bg-(--ui-accent) text-white py-1.5"><Check size={14}/>应用到选中纹样笔画</button>}
      <footer className="border-t border-(--ui-divider) pt-1 flex items-center gap-1 text-[11px] text-(--ui-muted)"><button aria-label="导出图章库" data-tip="导出素材库" onClick={()=>downloadFile(JSON.stringify(library,null,2),'我的图章库.json','application/json')} className={action}><Download size={14}/></button><button aria-label="导入图章库" data-tip="导入素材库" onClick={()=>file.current?.click()} className={action}><Upload size={14}/></button>{!definition.builtin&&library.some(d=>d.id===definition.id)&&<button aria-label="从素材库移除当前图章" data-tip="移出库 · 保留当前编辑" className={action} onClick={()=>{if(persist(library.filter(d=>d.id!==definition.id)))setMessage('已从图章库移除，当前图案仍可另存。');}}><Trash2 size={14}/></button>}<span role="status" className="flex-1 text-right text-[10px]">{message}</span></footer>
      <input ref={file} type="file" accept=".json,application/json" hidden onChange={async e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;try{if(f.size>5_000_000)throw new Error('图章库文件须小于 5 MB');const data=validateStampLibrary(JSON.parse(await f.text()));const imported=data.map((d,i)=>({...d,id:`import_${Date.now()}_${i}`}));if(imported.length+library.length>100)throw new Error('图章库最多 100 个图章');if(persist([...library,...imported]))setMessage(`已导入 ${data.length} 个图章`);}catch(err){setMessage(err instanceof Error?err.message:'无法读取图章库');}}}/>
    </div>}
  </section>;
}
