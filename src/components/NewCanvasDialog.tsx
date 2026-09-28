import { useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, Check, Pipette, X } from 'lucide-react';
import { CanvasBackdrop } from './CanvasBackdrop';
import type { BlankCanvasOptions } from '../utils/presetTemplates';
import type { CanvasBackground, CanvasTexture } from '../types/papercut';

const SIZES = [
  {name:'小素材',w:512,h:512}, {name:'方形',w:1024,h:1024},
  {name:'横屏',w:1920,h:1080}, {name:'竖屏',w:1080,h:1920},
  {name:'横幅',w:1600,h:900}, {name:'高清方形',w:2048,h:2048},
];
const TEXTURES: {id:CanvasTexture;name:string}[] = [{id:'none',name:'无纹理'},{id:'paper',name:'纸纹'},{id:'linen',name:'布纹'},{id:'grid',name:'方格'}];
const field='w-full min-w-0 rounded-sm border border-(--ui-border) bg-(--ui-input) px-2 py-1.5 outline-none focus:border-(--ui-accent)';

export function NewCanvasDialog({onClose,onCreate}: {onClose:()=>void;onCreate:(opts:BlankCanvasOptions)=>void}) {
  const [width,setWidth]=useState('1024'), [height,setHeight]=useState('1024');
  const [background,setBackground]=useState('transparent');
  const [color,setColor]=useState('#F6EEE2');
  const [texture,setTexture]=useState<CanvasTexture>('none');
  const [name,setName]=useState('');
  const [paper,setPaper]=useState(false);
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{ const el=dialog.current; el?.showModal(); return ()=>el?.close(); },[]);
  const w=Number(width),h=Number(height);
  const valid=Number.isInteger(w)&&Number.isInteger(h)&&w>=64&&h>=64&&w<=4096&&h<=4096;
  const bg: CanvasBackground = background==='transparent' ? {kind:'transparent',display:'light',texture} : {kind:'solid',color:background==='custom'?color:background,texture};
  const previewW=valid?w:1024,previewH=valid?h:1024;
  const sampleClass=(active:boolean)=>`group relative flex min-w-0 flex-col items-center gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-(--ui-accent) ${active?'text-(--ui-strong)':'text-(--ui-muted) hover:text-(--ui-strong)'}`;
  const frameClass=(active:boolean)=>`relative block w-full border ${active?'border-(--ui-accent) ring-1 ring-(--ui-accent)':'border-(--ui-border) group-hover:border-(--ui-border-strong)'}`;
  const previewScale=Math.min(156/previewW,178/previewH);
  const side=Math.min(previewW,previewH)*.76;
  const previewPaper={x:(previewW-side)/2,y:(previewH-side)/2};
  const tick=(active:boolean)=>active?<Check aria-hidden="true" size={12} className="absolute right-1 top-1 bg-(--ui-accent) text-white p-px"/>:null;
  return <dialog ref={dialog} aria-labelledby="new-canvas-title" onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}}
    className="m-auto w-[min(700px,calc(100vw-32px))] max-h-[calc(100dvh-32px)] overflow-y-auto rounded-md border border-(--ui-border-strong) bg-(--ui-panel) p-0 text-(--ui-text) shadow-2xl backdrop:bg-black/40">
    <form className="text-xs" onSubmit={e=>{e.preventDefault();if(valid)onCreate({name:name.trim()||'未命名画布',width:w,height:h,mode:paper?'cut':'create',canvasBg:bg});}}>
      <header className="flex items-center justify-between border-b border-(--ui-divider) px-5 py-3"><h2 id="new-canvas-title" className="text-sm font-semibold text-(--ui-strong)">新建空白画布</h2><button type="button" aria-label="关闭新建画布" onClick={onClose} className="p-1 hover:bg-(--ui-hover)"><X size={16}/></button></header>
      <div className="grid grid-cols-1 sm:grid-cols-[190px_1fr] gap-6 p-5">
        <aside className="flex flex-col gap-5 sm:border-r border-(--ui-divider) sm:pr-5">
          <figure className="m-0 flex flex-col items-center">
            <div className="flex h-[212px] w-full items-center justify-center" aria-label="画布比例预览区">
              <div className="relative" style={{width:previewW*previewScale,height:previewH*previewScale}}>
                <svg aria-label="画布预览" viewBox={`0 0 ${previewW} ${previewH}`} className="h-full w-full outline outline-1 outline-(--ui-border-strong)">
                  <CanvasBackdrop bg={bg} width={previewW} height={previewH} zoom={previewScale}/>
                  {paper&&<rect x={previewPaper.x} y={previewPaper.y} width={side} height={side} rx={Math.min(24,side*.04)} fill="#D72626"/>}
                </svg>
                <span className="absolute -top-5 left-0 w-full text-center text-[10px] tabular-nums text-(--ui-muted)">{valid?`${w} px`:'宽'}</span>
                <span className="absolute -bottom-5 left-0 w-full text-center text-[10px] tabular-nums text-(--ui-muted)">{valid?`高 ${h} px`: '高'}</span>
              </div>
            </div>
            <figcaption className="mt-3 text-[10px] text-(--ui-muted)">画布预览 · {background==='transparent'?'透明底':'实色底'}</figcaption>
          </figure>
          <label className="space-y-2"><span className="block text-(--ui-muted)">画布名称</span><input aria-label="画布名称" placeholder="未命名画布" value={name} onChange={e=>setName(e.target.value)} className={field}/></label>
          <label className="flex items-center gap-2 text-(--ui-muted) cursor-pointer"><input type="checkbox" checked={paper} onChange={e=>setPaper(e.target.checked)} className="accent-(--ui-accent)"/><span aria-hidden="true" className="block h-3.5 w-3.5 bg-[#D72626]"/>起始色纸</label>
        </aside>
        <div className="space-y-5 min-w-0">
          <fieldset><legend className="mb-3 text-(--ui-muted)">尺寸预设</legend>
            <div className="grid grid-cols-3 gap-x-3 gap-y-3">{SIZES.map(s=>{
              const active=w===s.w&&h===s.h;
              const scale=42/Math.max(s.w,s.h),factor=s.name==='小素材'?.65:s.name==='方形'?.85:1;
              return <button type="button" key={s.name} aria-label={`${s.name} ${s.w} × ${s.h}`} aria-pressed={active} onClick={()=>{setWidth(String(s.w));setHeight(String(s.h));}} className={sampleClass(active)}>
                <span className={`flex h-12 w-full items-center justify-center border-b ${active?'border-(--ui-accent)':'border-transparent group-hover:border-(--ui-border)'}`}>
                  <svg aria-hidden="true" width={s.w*scale*factor} height={s.h*scale*factor} viewBox={`0 0 ${s.w} ${s.h}`} className="overflow-visible"><rect width={s.w} height={s.h} fill={active?'var(--ui-accent)':'var(--ui-input)'} fillOpacity={active?.13:1} stroke={active?'var(--ui-accent)':'var(--ui-muted)'} strokeWidth={1.2/(scale*factor)}/><path d={`M ${s.w*.5} ${s.h*.25} V ${s.h*.75} M ${s.w*.25} ${s.h*.5} H ${s.w*.75}`} stroke="currentColor" opacity=".25" strokeWidth={.7/(scale*factor)}/></svg>
                </span>
                <span>{s.name}</span><span className="text-[10px] tabular-nums opacity-65 -mt-1">{s.w} × {s.h}</span>
              </button>;
            })}</div>
            <div className="flex items-center gap-2 mt-3"><label className="flex-1 flex items-center gap-2 text-(--ui-muted)">宽<input type="number" aria-label="画布宽度" min={64} max={4096} step={1} required value={width} onChange={e=>setWidth(e.target.value)} className={field}/></label><button type="button" title="交换宽高" aria-label="交换宽高" className="p-1 hover:bg-(--ui-hover)" onClick={()=>{setWidth(height);setHeight(width);}}><ArrowLeftRight size={14}/></button><label className="flex-1 flex items-center gap-2 text-(--ui-muted)">高<input type="number" aria-label="画布高度" min={64} max={4096} step={1} required value={height} onChange={e=>setHeight(e.target.value)} className={field}/></label><span className="text-(--ui-muted)">px</span></div>
            {!valid&&<p role="status" className="text-red-400 mt-2">宽高须为 64–4096 之间的整数。</p>}
          </fieldset>
          <fieldset><legend className="mb-3 text-(--ui-muted)">背景</legend><div className="grid grid-cols-4 gap-3">{[{id:'transparent',name:'透明'},{id:'#FFFFFF',name:'白色'},{id:'#F6EEE2',name:'米白'},{id:'custom',name:'自定义'}].map(b=>{
            const active=background===b.id;
            return <button type="button" key={b.id} aria-label={b.name} aria-pressed={active} onClick={()=>setBackground(b.id)} className={sampleClass(active)}>
              <span className={frameClass(active)}><svg aria-hidden="true" viewBox="0 0 80 36" className="block w-full"><CanvasBackdrop bg={b.id==='transparent'?{kind:'transparent',display:'light'}:{kind:'solid',color:b.id==='custom'?color:b.id}} width={80} height={36} zoom={1}/></svg>{b.id==='custom'&&<Pipette size={14} className="absolute left-1.5 top-1.5 text-[#5f5145]"/>}{tick(active)}</span><span>{b.name}</span>
            </button>;
          })}</div>{background==='custom'&&<label className="mt-2 flex items-center gap-2 text-(--ui-muted)"><input type="color" aria-label="背景颜色" value={color} onChange={e=>setColor(e.target.value)} className="h-6 w-8"/>{color.toUpperCase()}</label>}</fieldset>
          <fieldset><legend className="mb-3 text-(--ui-muted)">纹理</legend><div className="grid grid-cols-4 gap-3">{TEXTURES.map(t=>{
            const active=texture===t.id;
            return <button type="button" key={t.id} aria-label={t.name} aria-pressed={active} onClick={()=>setTexture(t.id)} className={sampleClass(active)}>
              <span className={frameClass(active)}><svg aria-hidden="true" viewBox="0 0 80 44" className="block w-full"><CanvasBackdrop bg={{kind:'solid',color:background==='transparent'?'#F6EEE2':background==='custom'?color:background,texture:t.id}} width={80} height={44} zoom={1}/></svg>{tick(active)}</span><span>{t.name}</span>
            </button>;
          })}</div><p className="mt-3 text-[10px] text-(--ui-muted)">{background==='transparent'?'透明背景的纹理仅辅助预览，不参与导出。':'包含背景导出时，保留颜色与纹理。'}</p></fieldset>
        </div>
      </div>
      <footer className="flex justify-end gap-2 px-5 py-3 border-t border-(--ui-divider)"><button type="button" onClick={onClose} className="px-4 py-2 rounded-sm hover:bg-(--ui-hover)">取消</button><button type="submit" disabled={!valid} className="px-5 py-2 rounded-sm bg-(--ui-accent) text-white disabled:opacity-40">创建画布</button></footer>
    </form>
  </dialog>;
}
