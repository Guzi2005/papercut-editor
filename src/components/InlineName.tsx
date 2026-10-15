import {useRef,useState} from 'react';

/** Names stay as text until explicitly edited, like layer names elsewhere in the editor. */
export function InlineName({value,onCommit,label,className='',maxLength=80,placeholder='未命名',allowEmpty=false,normalize,disabled=false,initialEditing=false,onEditingEnd}:{
  value:string;onCommit:(value:string)=>void;label:string;className?:string;maxLength?:number;placeholder?:string;allowEmpty?:boolean;
  normalize?:(draft:string)=>string|null;disabled?:boolean;initialEditing?:boolean;onEditingEnd?:()=>void;
}){
  const [editing,setEditing]=useState(initialEditing),[draft,setDraft]=useState(value),cancelled=useRef(false);
  const start=()=>{cancelled.current=false;setDraft(value);setEditing(true);};
  const finish=()=>{const next=normalize?normalize(draft):draft.trim();if(!cancelled.current&&next!==null&&(next||allowEmpty)&&next!==value)onCommit(next);setEditing(false);onEditingEnd?.();};
  return editing?<input autoFocus data-property-control="" aria-label={label} value={draft} maxLength={maxLength} placeholder={placeholder} spellCheck={false}
    onFocus={e=>e.currentTarget.select()} onChange={e=>setDraft(e.target.value)} onBlur={finish}
    onPointerDown={e=>e.stopPropagation()} onDoubleClick={e=>e.stopPropagation()}
    onKeyDown={e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur();}if(e.key==='Escape'){e.preventDefault();cancelled.current=true;setEditing(false);onEditingEnd?.();}}}
    className={`min-w-0 bg-(--ui-input) border-b border-(--ui-accent) outline-none px-0.5 ${className}`}/>
    :<button type="button" data-property-control="" disabled={disabled} aria-label={label} data-tip={`${label} · 双击编辑`} onPointerDown={e=>e.stopPropagation()} onDoubleClick={e=>{e.stopPropagation();start();}}
      onKeyDown={e=>{if(e.key==='Enter'||e.key==='F2'){e.preventDefault();e.stopPropagation();start();}}}
      className={`min-w-0 truncate text-left border-b border-transparent hover:border-(--ui-border-strong) hover:text-(--ui-accent) outline-none focus-visible:border-(--ui-accent) disabled:opacity-40 ${className}`}>{value||<span className="text-(--ui-muted)">{placeholder}</span>}</button>;
}
