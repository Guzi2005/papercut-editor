import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CornerDownRight, Minus, Plus, Spline, Unlink, MoveHorizontal } from 'lucide-react';
import type { Layer, Point } from '../types/papercut';
import { moveHandle, parseVectorPath, segmentD, serializeVectorPath, setNodeMode, splitSegment, type NodeMode, type VectorPath } from '../utils/vectorPath';

type Target = { id: string; label: string; d: string; modes?: NodeMode[][]; kind: 'base'|'cutout'|'positive'|'drawing' };
type Address = { contour: number; node: number };
type Drag = { pointer: number; start: Point; source: VectorPath; selected: Address[]; at: Address; side?: 'incoming'|'outgoing'; moved: boolean };
const same = (a: Address, b: Address) => a.contour === b.contour && a.node === b.node;
const targetsFor = (layer: Layer): Target[] => [
  ...(layer.kind !== 'doodle' && layer.baseShape.d ? [{id:'base',label:'纸片外轮廓',d:layer.baseShape.d,modes:layer.baseShape.vectorNodeModes,kind:'base' as const}] : []),
  ...layer.positiveElements.map(p => ({id:p.id,label:`贴花 · ${p.name}`,d:p.d,modes:p.vectorNodeModes,kind:'positive' as const})),
  ...layer.cutouts.map(p => ({id:p.id,label:`切口 · ${p.name}`,d:p.d,modes:p.vectorNodeModes,kind:'cutout' as const})),
  ...(layer.drawings ?? []).map((p,i) => ({id:p.id,label:`笔迹 ${i+1}`,d:p.d,modes:p.vectorNodeModes,kind:'drawing' as const})),
];

export function VectorEditor({layer, zoom, disabled, panHeld, onCommit, onPreview}: {
  layer: Layer; zoom: number; disabled: boolean; panHeld: boolean; onCommit: (layer: Layer) => void; onPreview: (layer: Layer | null) => void;
}) {
  const targets = useMemo(() => targetsFor(layer), [layer]);
  const [targetId, setTargetId] = useState('base');
  const target = targets.find(t => t.id === targetId) ?? targets[0];
  const parsed = useMemo(() => {
    try {
      const path=parseVectorPath(target?.d ?? '');
      path.forEach((c,ci)=>c.nodes.forEach((n,ni)=>{ n.mode=target?.modes?.[ci]?.[ni] ?? n.mode; }));
      return {path,error:''};
    }
    catch { return {path:[] as VectorPath,error:'此路径暂不支持精细编辑'}; }
  }, [target?.d,target?.modes]);
  const [draft, setDraft] = useState<VectorPath | null>(null);
  const [selection, setSelection] = useState<Address[]>([]);
  const [context, setContext] = useState<{x:number;y:number}|null>(null);
  const drag = useRef<Drag | null>(null);
  const draftRef = useRef<VectorPath | null>(null);
  const root = useRef<SVGGElement>(null);
  const [toolbar, setToolbar] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => { setToolbar(document.getElementById('vector-options')); }, []);
  const path = draft ?? parsed.path;
  const selected = selection.filter(a => path[a.contour]?.nodes[a.node]);
  const editable = !disabled && !parsed.error && !!target;
  const updateDraft = (p: VectorPath | null) => { draftRef.current = p; setDraft(p); onPreview(p ? buildLayer(p) : null); };
  const cancel = () => { drag.current = null; updateDraft(null); };
  useEffect(() => { cancel(); }, [target?.d, target?.id, disabled]);
  useEffect(() => () => onPreview(null), [onPreview]);
  const buildLayer = (next: VectorPath): Layer => {
    if (!target) return layer;
    const d = serializeVectorPath(next);
    const vectorNodeModes=next.map(c=>c.nodes.map(n=>n.mode ?? 'corner'));
    let updated = layer;
    const revise = <T extends {id:string;d:string}>(p: T): T => p.id === target.id ? {...p,d,vectorNodeModes,points:undefined,geomType:undefined,stroke:undefined} : p;
    if (target.kind === 'base') updated = {...layer,baseShape:{type:'freeform',d,vectorNodeModes}};
    if (target.kind === 'cutout') updated = {...layer,cutouts:layer.cutouts.map(revise)};
    if (target.kind === 'positive') updated = {...layer,positiveElements:layer.positiveElements.map(revise)};
    if (target.kind === 'drawing') updated = {...layer,drawings:layer.drawings?.map(revise)};
    return updated;
  };
  const commit = (next: VectorPath) => {
    if (!target || disabled) return;
    const updated=buildLayer(next);
    if (JSON.stringify(updated) !== JSON.stringify(layer)) onCommit(updated);
  };
  const mutate = (fn: (p: VectorPath) => void) => {
    if (!editable || drag.current) return;
    const next = structuredClone(path); fn(next); commit(next); setContext(null);
  };
  const mode = (m: NodeMode) => mutate(p => selected.forEach(a => setNodeMode(p[a.contour],a.node,m)));
  const remove = () => {
    mutate(p => p.forEach((c,ci) => {
      const remaining = c.nodes.filter((_,i) => !selected.some(a => a.contour === ci && a.node === i));
      if (remaining.length >= (c.closed ? 3 : 2)) c.nodes = remaining;
    }));
    setSelection([]);
  };
  const insert = () => {
    mutate(p => [...selected].sort((a,b) => b.node-a.node).forEach(a => splitSegment(p[a.contour],a.node)));
    setSelection([]);
  };
  const straighten = () => mutate(p => selected.forEach(a => {
    const c=p[a.contour], n=c.nodes[a.node];
    if (c.closed || a.node < c.nodes.length-1) { delete n.outgoing; delete c.nodes[(a.node+1)%c.nodes.length].incoming; }
  }));
  const coords = (e: {clientX:number;clientY:number}): Point => {
    const matrix = root.current?.getScreenCTM();
    return matrix ? new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse()) : {x:0,y:0};
  };
  const begin = (e: React.PointerEvent, at: Address, side?: 'incoming'|'outgoing') => {
    if (e.button === 2) { e.stopPropagation(); return; }
    if (e.button !== 0 || panHeld) return;
    e.stopPropagation(); e.preventDefault();
    if (disabled) return;
    const exists = selected.some(a => same(a,at));
    const next = side ? [at] : e.shiftKey ? (exists ? selected.filter(a => !same(a,at)) : [...selected,at]) : exists ? selected : [at];
    setSelection(next); setContext(null);
    if (!next.length) return;
    root.current?.setPointerCapture(e.pointerId);
    drag.current = {pointer:e.pointerId,start:coords(e),source:structuredClone(path),selected:next,at,side,moved:false};
  };
  const move = (e: React.PointerEvent) => {
    const gesture = drag.current;
    if (!gesture || gesture.pointer !== e.pointerId) return;
    e.stopPropagation();
    const p=coords(e), dx=p.x-gesture.start.x, dy=p.y-gesture.start.y;
    if (!gesture.moved && Math.hypot(dx,dy)*zoom < 2) return;
    gesture.moved=true;
    const next=structuredClone(gesture.source);
    if (gesture.side) {
      const n=next[gesture.at.contour].nodes[gesture.at.node];
      let dest=p;
      if (e.ctrlKey || e.metaKey) {
        const len=Math.hypot(p.x-n.x,p.y-n.y), angle=Math.round(Math.atan2(p.y-n.y,p.x-n.x)/(Math.PI/12))*Math.PI/12;
        dest={x:n.x+len*Math.cos(angle),y:n.y+len*Math.sin(angle)};
      }
      moveHandle(n,gesture.side,dest,e.altKey);
    } else {
      const x=(e.ctrlKey || e.metaKey) && Math.abs(dy)>Math.abs(dx) ? 0 : dx;
      const y=(e.ctrlKey || e.metaKey) && Math.abs(dx)>=Math.abs(dy) ? 0 : dy;
      gesture.selected.forEach(a => {
        const n=next[a.contour].nodes[a.node];
        n.x+=x; n.y+=y;
        if(n.incoming) { n.incoming.x+=x; n.incoming.y+=y; }
        if(n.outgoing) { n.outgoing.x+=x; n.outgoing.y+=y; }
      });
    }
    updateDraft(next);
  };
  const finish = (e: React.PointerEvent) => {
    if (!drag.current || drag.current.pointer !== e.pointerId) return;
    e.stopPropagation();
    const next=draftRef.current, moved=drag.current.moved;
    drag.current=null;
    if(root.current?.hasPointerCapture(e.pointerId)) root.current.releasePointerCapture(e.pointerId);
    updateDraft(null);
    if(moved && next) commit(next);
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input,textarea,select,[contenteditable="true"]')) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); cancel(); setSelection([]); setContext(null); return; }
      if (drag.current) { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.stopImmediatePropagation(); cancel(); } return; }
      if (!editable) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault(); e.stopImmediatePropagation(); setSelection(path.flatMap((c,contour) => c.nodes.map((_,node) => ({contour,node}))));
      } else if (selected.length && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault(); e.stopImmediatePropagation(); remove();
      }
    };
    const blur = () => { cancel(); setContext(null); };
    window.addEventListener('keydown',key,true); window.addEventListener('blur',blur);
    return () => { window.removeEventListener('keydown',key,true); window.removeEventListener('blur',blur); };
  });
  const actions = [
    {label:'尖角节点',hint:'控制柄可独立调整',Icon:CornerDownRight,run:()=>mode('corner')},
    {label:'平滑节点',hint:'两侧控制柄保持共线',Icon:Spline,run:()=>mode('smooth')},
    {label:'对称节点',hint:'两侧控制柄共线且等长',Icon:MoveHorizontal,run:()=>mode('symmetric')},
    {label:'插入节点',hint:'在所选节点之后的线段中点插入，保持曲线形状',Icon:Plus,run:insert},
    {label:'删除节点',hint:'每条闭合轮廓至少保留 3 个节点',Icon:Minus,run:remove},
    {label:'线段变直',hint:'将所选节点之后的曲线转为直线',Icon:Unlink,run:straighten},
  ];
  return <>
    {toolbar && createPortal(<div className="flex items-center gap-1 min-w-0 overflow-x-auto" aria-label="精细矢量工具栏">
      <select aria-label="编辑路径" className="h-7 max-w-44 min-w-20 rounded bg-(--ui-raised) text-xs" value={target?.id ?? ''} onChange={e=>{ cancel();setTargetId(e.target.value);setSelection([]); }}>
        {targets.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
      </select>
      <span className="h-4 border-l border-(--ui-border) mx-1"/>
      {actions.map(({label,hint,Icon,run})=><button key={label} aria-label={label} title={`${label} · ${hint}`} disabled={!editable || !selected.length} onClick={run} className="h-7 w-7 shrink-0 rounded hover:bg-(--ui-hover) disabled:opacity-30"><Icon size={15} className="mx-auto"/></button>)}
      <span className="text-(--ui-muted) text-[11px] whitespace-nowrap ml-2">{disabled ? '图层已锁定或隐藏' : parsed.error || (selected.length ? `${selected.length} 个节点 · Alt 独立柄 · Ctrl 约束` : '选择节点 · Shift 加选 · 双击线段加点')}</span>
    </div>,toolbar)}
    <g ref={root} onPointerMove={move} onPointerUp={finish} onPointerCancel={()=>cancel()} onLostPointerCapture={()=>{if(drag.current) cancel();}}>
      {!disabled && targets.map(t=><path key={t.id} d={t.d} fill="none" stroke="transparent" strokeWidth={12/zoom} pointerEvents={panHeld ? 'none' : 'stroke'} onPointerDown={e=>{
        if(e.button!==0) return; e.stopPropagation(); setTargetId(t.id); setSelection([]); setContext(null);
      }}/>)}
      {!disabled && path.map((c,ci)=><g key={ci}>
        {c.nodes.map((n,ni)=>{
          const next=c.nodes[(ni+1)%c.nodes.length];
          if(!c.closed && ni===c.nodes.length-1) return null;
          return <path key={ni} d={`M ${n.x} ${n.y} ${segmentD(n,next)}`} fill="none" stroke="#60a5fa" strokeWidth={1.4/zoom} pointerEvents={panHeld?'none':'stroke'} style={{cursor:'crosshair'}} onPointerDown={e=>{if(e.button===0) e.stopPropagation();}} onDoubleClick={e=>{ e.stopPropagation(); mutate(p=>splitSegment(p[ci],ni)); setSelection([{contour:ci,node:ni+1}]); }}/>
        })}
        {c.nodes.map((n,ni)=>{
          const at={contour:ci,node:ni}, active=selected.some(a=>same(a,at));
          return <g key={ni}>
            {active && (['incoming','outgoing'] as const).map(side=>n[side] && <g key={side}>
              <line x1={n.x} y1={n.y} x2={n[side]!.x} y2={n[side]!.y} stroke="#60a5fa" strokeWidth={1/zoom}/>
              <circle aria-label={`${side==='incoming'?'入':'出'}控制柄 ${ni+1}`} cx={n[side]!.x} cy={n[side]!.y} r={4/zoom} fill="white" stroke="#2563eb" strokeWidth={1.5/zoom} pointerEvents={panHeld?'none':'all'} style={{cursor:'grab'}} onPointerDown={e=>begin(e,at,side)}/>
            </g>)}
            <rect aria-label={`节点 ${ci+1}-${ni+1}`} x={n.x-4/zoom} y={n.y-4/zoom} width={8/zoom} height={8/zoom} rx={1/zoom} fill={active?'#2563eb':'white'} stroke="#2563eb" strokeWidth={1.5/zoom} pointerEvents={panHeld?'none':'all'} style={{cursor:'move'}} onPointerDown={e=>begin(e,at)} onContextMenu={e=>{e.preventDefault();e.stopPropagation();setSelection([at]);setContext({x:e.clientX,y:e.clientY});}}/>
          </g>;
        })}
      </g>)}
    </g>
    {context && createPortal(<div className="fixed inset-0 z-50" onPointerDown={()=>setContext(null)} onContextMenu={e=>{e.preventDefault();setContext(null);}}>
      <div role="menu" aria-label="节点操作" className="absolute w-44 p-1 rounded-lg border border-(--ui-border) bg-(--ui-panel) shadow-xl text-(--ui-text) text-xs" style={{left:Math.max(8,Math.min(context.x,window.innerWidth-184)),top:Math.max(8,Math.min(context.y,window.innerHeight-220))}} onPointerDown={e=>e.stopPropagation()}>
        {actions.map(({label,Icon,run})=><button role="menuitem" key={label} onClick={run} className="w-full flex items-center gap-2 p-2 rounded hover:bg-(--ui-hover)"><Icon size={14}/>{label}</button>)}
      </div>
    </div>,document.body)}
  </>;
}
