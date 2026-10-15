import {useEffect,useRef,useState} from 'react';
import {ChevronRight,Eye,EyeOff,Image as ImageIcon,Lock,Unlock,Move,RotateCw,Scan,Trash2} from 'lucide-react';
import type {PapercutProject,ReferenceImage,CanvasTexture} from '../types/papercut';
import {DEFAULT_SYMMETRY,symmetryCenter} from '../utils/symmetry';
import {WheelNumber} from './WheelNumber';
import {CanvasBgPanel} from './CanvasBgPanel';

export function CanvasLayerSettings({project,onUpdate,onImportReference,request}:{
  project:PapercutProject;onUpdate:(patch:Partial<PapercutProject>)=>void;onImportReference:()=>void;
  request?:{section?:'symmetry'|'canvas'|'reference';key:number};
}){
  const [referenceOpen,setReferenceOpen]=useState(false),[canvasOpen,setCanvasOpen]=useState(false);
  const [lockReferenceRatio,setLockReferenceRatio]=useState(true);
  const canvasRef=useRef<HTMLDivElement>(null),referenceRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(request?.section==='reference'){setReferenceOpen(true);referenceRef.current?.scrollIntoView({block:'nearest'});}
    else if(request?.section){setCanvasOpen(true);canvasRef.current?.scrollIntoView({block:'nearest'});}
  },[request?.key]);
  const ref=project.reference,sym=project.symmetry??DEFAULT_SYMMETRY;
  const center=symmetryCenter(sym,project.width,project.height);
  const setSym=(patch:Partial<typeof sym>)=>onUpdate({symmetry:{...sym,...patch}});
  const setRef=(patch:Partial<ReferenceImage>)=>{if(ref)onUpdate({reference:{...ref,...patch,onTop:false}});};
  const setReferenceSize=(axis:'width'|'height',v:number)=>{
    if(!ref)return;
    const other=axis==='width'?'height':'width';
    setRef({[axis]:v,...(lockReferenceRatio?{[other]:ref[other]*v/ref[axis]}:{})});
  };
  const button='h-7 w-7 flex items-center justify-center hover:bg-(--ui-hover) text-(--ui-muted) hover:text-(--ui-strong)';
  const row='h-10 flex items-center gap-2 border-t border-(--ui-divider)';
  return <div className="mt-3 text-[11px]" aria-label="画布与参考图设置">
    <div ref={referenceRef}>
      <div className={row}>
        <button className={button} aria-label="展开参考图设置" aria-expanded={referenceOpen} onClick={()=>setReferenceOpen(!referenceOpen)}><ChevronRight size={13} className={referenceOpen?'rotate-90':''}/></button>
        {ref?<img src={ref.src} alt="" className="w-7 h-7 object-contain"/>:<ImageIcon size={20} className="text-(--ui-faint)"/>}
        <button className="flex-1 text-left" onClick={()=>setReferenceOpen(!referenceOpen)}>参考图<span className="text-(--ui-faint) ml-2">置底</span></button>
        {ref&&<button className={button} aria-label={ref.visible?'隐藏参考图':'显示参考图'} onClick={()=>setRef({visible:!ref.visible})}>{ref.visible?<Eye size={14}/>:<EyeOff size={14}/>}</button>}
        <button className={button} aria-label={ref?'更换参考图':'导入参考图'} onClick={onImportReference}><ImageIcon size={14}/></button>
      </div>
      {referenceOpen&&<div className="pl-9 pb-2 space-y-1">
        {ref?<>
          <div className="flex items-center gap-1"><Move size={12}/>{(['x','y'] as const).map(axis=><WheelNumber key={axis} tip={`参考图 ${axis.toUpperCase()}`} value={ref[axis]} min={-32768} max={32768} dragStep={1} format={v=>`${axis.toUpperCase()} ${Math.round(v)}`} onChange={v=>setRef({[axis]:v})}/>)}</div>
          <div className="flex items-center gap-1">
            <button className={button} aria-label="锁定参考图比例" aria-pressed={lockReferenceRatio} onClick={()=>setLockReferenceRatio(!lockReferenceRatio)}>{lockReferenceRatio?<Lock size={12}/>:<Unlock size={12}/>}</button>
            {(['width','height'] as const).map(axis=><WheelNumber key={axis} tip={`参考图${axis==='width'?'宽度':'高度'}`} value={ref[axis]} min={1} max={32768} dragStep={1} format={v=>`${axis==='width'?'W':'H'} ${Math.round(v)}`} onChange={v=>setReferenceSize(axis,v)}/>)}
          </div>
          <div className="flex items-center gap-1"><WheelNumber tip="参考图透明度" value={ref.opacity*100} min={0} max={100} format={v=>`${Math.round(v)}%`} onChange={v=>setRef({opacity:v/100})}/><button className={button} aria-label="参考图居中" onClick={()=>setRef({x:(project.width-ref.width)/2,y:(project.height-ref.height)/2})}><Scan size={13}/></button><button className={`${button} ml-auto`} aria-label="移除参考图" onClick={()=>onUpdate({reference:undefined})}><Trash2 size={13}/></button></div>
        </>:<button className="py-2 text-(--ui-muted) hover:text-(--ui-accent)" onClick={onImportReference}>导入用于临摹和取色的图片</button>}
      </div>}
    </div>
    <div ref={canvasRef}>
      <div className={row}>
        <button className={button} aria-label="展开画布设置" aria-expanded={canvasOpen} onClick={()=>setCanvasOpen(!canvasOpen)}><ChevronRight size={13} className={canvasOpen?'rotate-90':''}/></button>
        <span className="w-7 h-7 flex items-center justify-center"><span className="border border-(--ui-muted)" style={{width:project.width>=project.height?23:23*project.width/project.height,height:project.height>=project.width?23:23*project.height/project.width,background:project.canvasBg?.kind==='solid'?project.canvasBg.color:'repeating-conic-gradient(#ccc 0 25%,#fff 0 50%) 0 0 / 8px 8px'}}/></span>
        <button className="flex-1 text-left" onClick={()=>setCanvasOpen(!canvasOpen)}>画布</button>
        <span className="font-mono tabular-nums text-(--ui-muted)">{project.width} × {project.height}</span>
      </div>
      {canvasOpen&&<div className="pl-2 pb-2 space-y-2">
        <div className="flex items-center gap-1"><WheelNumber tip="画布宽度" value={project.width} min={16} max={16384} dragStep={1} format={v=>`W ${v}`} onChange={v=>onUpdate({width:v})}/><WheelNumber tip="画布高度" value={project.height} min={16} max={16384} dragStep={1} format={v=>`H ${v}`} onChange={v=>onUpdate({height:v})}/></div>
        <div className="border-t border-(--ui-divider) pt-2" aria-label="画布对称设置">
          <div className="flex items-center gap-3 mb-1"><span className="text-(--ui-muted) flex-1">实时对称</span>
            <button className={button} aria-label="显示对称轴" aria-pressed={sym.visible!==false} onClick={()=>setSym({visible:sym.visible===false})}>{sym.visible===false?<EyeOff size={13}/>:<Eye size={13}/>}</button>
            <button className={button} aria-label="锁定对称轴" aria-pressed={sym.locked!==false} onClick={()=>setSym({locked:sym.locked===false})}>{sym.locked===false?<Unlock size={13}/>:<Lock size={13}/>}</button>
          </div>
          <div className="flex gap-1" role="group" aria-label="对称方式">
            {([['none','关闭'],['mirror','轴对称'],['rotate','中心对称']] as const).map(([kind,label])=><button key={kind} aria-pressed={sym.kind===kind} onClick={()=>setSym({kind,count:kind==='rotate'?2:1,visible:true})} className={`flex-1 h-7 border-b-2 ${sym.kind===kind?'border-(--ui-accent) text-(--ui-strong)':'border-transparent text-(--ui-muted) hover:bg-(--ui-hover)'}`}>{label}</button>)}
          </div>
          {sym.kind!=='none'&&<>
            <div className="flex items-center gap-1 mt-1">{(['x','y'] as const).map(axis=><WheelNumber key={axis} tip={`对称中心 ${axis.toUpperCase()}`} value={center[axis]} min={-32768} max={32768} dragStep={1} format={v=>`${axis.toUpperCase()} ${Math.round(v)}`} onChange={v=>setSym(axis==='x'?{cx:v}:{cy:v})}/>)}<button className={button} aria-label="对称中心回到画布中心" onClick={()=>setSym({cx:undefined,cy:undefined})}><Scan size={13}/></button></div>
            <div className="flex items-center gap-1">
              {sym.kind==='mirror'&&<WheelNumber icon={<RotateCw size={12}/>} tip="对称轴角度" value={sym.angle} min={-180} max={180} dragStep={.5} format={v=>`${v}°`} onChange={v=>setSym({angle:v})}/>}
              <WheelNumber tip={sym.kind==='mirror'?'对称轴数量':'中心重复数'} value={sym.count} min={sym.kind==='mirror'?1:2} max={sym.kind==='mirror'?4:12} format={v=>`${v} ${sym.kind==='mirror'?'轴':'份'}`} dragStep={.05} onChange={v=>setSym({count:v})}/>
            </div>
          </>}
        </div>
        <div className="border-t border-(--ui-divider) pt-1"><CanvasBgPanel inline value={project.canvasBg} onChange={canvasBg=>onUpdate({canvasBg})}/>
          <div className="flex gap-2 items-center text-[10px]"><span className="text-(--ui-muted)">纹理</span>{([['none','无'],['paper','纸张'],['linen','织物'],['grid','网格']] as [CanvasTexture,string][]).map(([texture,label])=><button key={texture} aria-pressed={(project.canvasBg?.texture??'none')===texture} onClick={()=>onUpdate({canvasBg:{...(project.canvasBg??{kind:'transparent',display:'grid'}),texture}})} className={`px-1 py-1 border-b ${(project.canvasBg?.texture??'none')===texture?'border-(--ui-accent)':'border-transparent text-(--ui-muted)'}`}>{label}</button>)}</div>
        </div>
      </div>}
    </div>
  </div>;
}
