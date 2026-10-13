import type {StampSettings} from '../utils/stamps';

const field='w-full min-w-0 bg-(--ui-input) border border-(--ui-border) px-1 py-1 text-[11px]';
function NumberControl({label,value,min,max,step=1,onChange}:{label:string;value:number;min:number;max:number;step?:number;onChange:(value:number)=>void}){
  return <label className="flex items-center justify-between gap-2 text-[11px] text-(--ui-muted)">{label}<input aria-label={label} type="number" min={min} max={max} step={step} value={Math.round(value*100)/100} className="w-16 bg-transparent border-b border-(--ui-border) text-right tabular-nums" onChange={e=>{if(e.target.value!==''&&Number.isFinite(e.target.valueAsNumber))onChange(Math.max(min,Math.min(max,e.target.valueAsNumber)));}}/></label>;
}
export function RibbonOptions({settings:s,onChange,palette}:{settings:StampSettings;onChange:(patch:Partial<StampSettings>)=>void;palette:string[]}){
  const occupied=s.size*s.motifScale+(s.ribbonRows-1)*s.size*s.ribbonRowGap;
  return <div className="space-y-4">
    <fieldset className="space-y-2"><legend className="text-(--ui-strong) mb-2">纹样排列</legend>
      <NumberControl label="图章行数" value={s.ribbonRows} min={1} max={6} onChange={n=>onChange({ribbonRows:Math.round(n)})}/>
      {s.ribbonRows>1&&<><NumberControl label="行距 × 纹样尺寸" value={s.ribbonRowGap} min={.2} max={2} step={.05} onChange={ribbonRowGap=>onChange({ribbonRowGap})}/><label className="flex items-center gap-2 text-[11px]"><input type="checkbox" checked={s.ribbonStagger} onChange={e=>onChange({ribbonStagger:e.target.checked})}/>隔行错开半格</label></>}
      <svg viewBox="0 0 200 54" aria-label="织带行数示意" className="w-full h-14 border-y border-(--ui-divider)">{Array.from({length:s.ribbonRows},(_,row)=>Array.from({length:7},(_,col)=>{const y=27+(row-(s.ribbonRows-1)/2)*7,x=12+col*26+(s.ribbonStagger&&row%2?13:0);return <path key={`${row}_${col}`} d={`M ${x} ${y-3} l 3 3 -3 3 -3 -3 Z`} fill="currentColor"/>;}))}</svg>
      <p className="text-[10px] text-(--ui-muted)">排列约占 {Math.round(occupied)} px，带宽 {s.ribbonWidth} px。{occupied>s.ribbonWidth?'纹样会超出底带，可增大带宽或减小纹样尺寸。':''}</p>
      <button className="w-full border border-(--ui-border) py-1 text-[11px]" onClick={()=>onChange({ribbonWidth:Math.min(400,Math.ceil(occupied+(s.selvage==='none'?8:2*(s.selvageInset+s.selvageDepth))))})}>按排列调整带宽</button>
    </fieldset>
    <fieldset className="border-t border-(--ui-divider) pt-3 space-y-2"><legend className="text-(--ui-strong)">锁边</legend>
      <select aria-label="锁边样式" className={field} value={s.selvage} onChange={e=>onChange({selvage:e.target.value as StampSettings['selvage']})}><option value="none">无锁边</option><option value="dash">直针 │ │ │</option><option value="cross">交叉针 × × ×</option><option value="zigzag">锯齿针 /\/\/\</option></select>
      {s.selvage!=='none'&&<><label className="flex items-center justify-between text-[11px] text-(--ui-muted)">线色<input aria-label="锁边颜色" type="color" value={s.selvageColor} onChange={e=>onChange({selvageColor:e.target.value})} className="w-7 h-6"/></label><NumberControl label="锁边线宽" value={s.selvageWidth} min={.5} max={6} step={.25} onChange={selvageWidth=>onChange({selvageWidth})}/><NumberControl label="针脚深度" value={s.selvageDepth} min={2} max={24} onChange={selvageDepth=>onChange({selvageDepth})}/><NumberControl label="针脚间距" value={s.selvageSpacing} min={4} max={60} onChange={selvageSpacing=>onChange({selvageSpacing})}/><NumberControl label="距带边" value={s.selvageInset} min={0} max={40} onChange={selvageInset=>onChange({selvageInset})}/><p className="text-[10px] text-(--ui-muted)">两侧对称缝线，关闭连续底带后仍可单独使用。</p></>}
    </fieldset>
    <fieldset className="border-t border-(--ui-divider) pt-3 space-y-2"><legend className="text-(--ui-strong)">跳色</legend>
      <select aria-label="跳色排列" className={field} value={s.skipColorMode} onChange={e=>onChange({skipColorMode:e.target.value as StampSettings['skipColorMode']})}><option value="none">保持图章原色</option><option value="column">按列循环</option><option value="row">按行循环</option><option value="checker">棋盘交错</option></select>
      {s.skipColorMode!=='none'&&<><select aria-label="跳色替换原色" className={field} value={palette.includes(s.skipColorSource)?s.skipColorSource:palette[0]??''} onChange={e=>onChange({skipColorSource:e.target.value})}>{palette.map((c,i)=><option key={c} value={c}>替换色 {i+1} · {c}</option>)}</select><div className="flex items-center gap-2 flex-wrap">{s.skipColors.map((c,i)=><input key={i} aria-label={`跳色 ${i+1}`} type="color" value={c} className="w-7 h-6" onChange={e=>onChange({skipColors:s.skipColors.map((v,j)=>i===j?e.target.value:v)})}/>)}<button aria-label="增加跳色" disabled={s.skipColors.length>=6} onClick={()=>onChange({skipColors:[...s.skipColors,'#2F6E59']})}>＋</button><button aria-label="减少跳色" disabled={s.skipColors.length<=2} onClick={()=>onChange({skipColors:s.skipColors.slice(0,-1)})}>−</button></div><NumberControl label="每几格换色" value={s.skipColorEvery} min={1} max={12} onChange={n=>onChange({skipColorEvery:Math.round(n)})}/><p className="text-[10px] text-(--ui-muted)">仅替换所选原色，其余色块与描边保留；色序从每笔起点开始。</p></>}
    </fieldset>
  </div>;
}
