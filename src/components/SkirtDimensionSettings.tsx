import {useSyncExternalStore} from 'react';
import {Ruler} from 'lucide-react';
import {readDimensionMode,setDimensionMode,subscribeDimensionMode,type DimensionMode} from '../pleatedSkirt/dimensionSettings';
const modes:{id:DimensionMode;label:string;tip:string}[]=[
 {id:'hidden',label:'隐藏',tip:'不显示尺寸标注'},
 {id:'summary',label:'概括式',tip:'底部一行显示腰围、裙摆和裙长'},
 {id:'diagram',label:'图例式',tip:'尺寸线与引线标注；平铺宽度为周长的一半'},
];
export function SkirtDimensionSettings(){
 const value=useSyncExternalStore(subscribeDimensionMode,readDimensionMode,()=> 'diagram' as const);
 return <>
  <div className="flex items-center gap-2 mb-1.5 text-(--ui-muted)"><Ruler className="w-3.5 h-3.5 text-(--ui-accent)"/><span>图纸尺寸</span></div>
  <div className="flex gap-1" role="group" aria-label="图纸尺寸">
   {modes.map(mode=><button key={mode.id} type="button" onClick={()=>setDimensionMode(mode.id)} aria-pressed={value===mode.id} data-tip={mode.tip}
    className={`flex-1 py-1 border-b-2 text-[10px] transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-(--ui-accent) ${value===mode.id?'border-(--ui-accent) text-(--ui-accent)':'border-transparent text-(--ui-muted) hover:text-(--ui-strong) hover:bg-(--ui-hover)'}`}>{mode.label}</button>)}
  </div>
 </>;
}
