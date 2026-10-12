import {useEffect,useId,useMemo,useRef,useState} from 'react';
import type {CutoutPath,Point} from '../types/papercut';
import {ribbonBasePaths,stampStrokePaths,prepareStamp,stampPlacements,type StampDefinition,type StampSettings,type StampPlacement} from '../utils/stamps';

export function StampInstances({definition,settings,placements}:{definition:StampDefinition;settings:StampSettings;placements:StampPlacement[]}) {
  const id='stamp-'+useId().replace(/[^a-z0-9_-]/gi,'');
  const parts=useMemo(()=>prepareStamp(definition,settings),[definition,settings]);
  return <g pointerEvents="none"><defs><g id={id}>{parts.map(p=><path key={p.id} d={p.d} fill={p.color}/>)}</g></defs>{placements.map((p,i)=><use key={i} href={`#${id}`} transform={`translate(${p.x} ${p.y}) rotate(${p.angle*180/Math.PI}) scale(${p.scale}) translate(-50 -50)`}/>)}</g>;
}

export function StampStrokePreview({definition,settings,points,seed=17}:{definition:StampDefinition;settings:StampSettings;points:Point[];seed?:number}) {
  const base=useMemo(()=>ribbonBasePaths(points,settings,'preview'),[points,settings]);
  return <g pointerEvents="none">{base.map(p=><path key={p.id} d={p.d} fill={p.fillColor}/>)}<StampInstances definition={definition} settings={settings} placements={stampPlacements(points,settings,seed)}/></g>;
}

export function StampPainter({definition,settings,width,height,panHeld=false,disabled=false,onCommit}:{definition:StampDefinition;settings:StampSettings;width:number;height:number;panHeld?:boolean;disabled?:boolean;onCommit:(paths:CutoutPath[])=>void}) {
  const root=useRef<SVGGElement>(null),gesture=useRef<{points:Point[];seed:number;pointer:number}|null>(null);
  const [preview,setPreview]=useState<StampPlacement[]>([]);
  const [previewPoints,setPreviewPoints]=useState<Point[]>([]);
  const [hover,setHover]=useState<Point|null>(null);
  const base=useMemo(()=>ribbonBasePaths(previewPoints,settings,'gesture'),[previewPoints,settings]);
  const cancel=()=>{gesture.current=null;setPreview([]);setPreviewPoints([]);};
  useEffect(()=>{cancel();setHover(null);},[definition,settings,disabled,panHeld]);
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&gesture.current){e.preventDefault();e.stopImmediatePropagation();cancel();}};window.addEventListener('keydown',key,true);window.addEventListener('blur',cancel);return()=>{window.removeEventListener('keydown',key,true);window.removeEventListener('blur',cancel);};},[]);
  const point=(e:{clientX:number;clientY:number}):Point=>{const m=root.current?.getScreenCTM();return m?new DOMPoint(e.clientX,e.clientY).matrixTransform(m.inverse()):{x:0,y:0};};
  const finish=(e:React.PointerEvent)=>{
    const g=gesture.current;if(!g||g.pointer!==e.pointerId)return;
    e.stopPropagation();const end=point(e),last=g.points.at(-1)!;if(Math.hypot(end.x-last.x,end.y-last.y)>.3&&g.points.length<4096)g.points.push(end);cancel();
    if(root.current?.hasPointerCapture(e.pointerId))root.current.releasePointerCapture(e.pointerId);
    onCommit(stampStrokePaths(definition,settings,g.points,g.seed,`stamp_${Date.now().toString(36)}_${g.seed.toString(36)}`));
  };
  return <g ref={root} tabIndex={-1} onPointerDown={e=>{
    if(e.button!==0||panHeld||disabled)return;e.stopPropagation();e.preventDefault();root.current?.focus();root.current?.setPointerCapture(e.pointerId);
    gesture.current={points:[point(e)],seed:Math.floor(Math.random()*2147483647),pointer:e.pointerId};
    setPreview(stampPlacements(gesture.current.points,settings,gesture.current.seed));
    setPreviewPoints([...gesture.current.points]);
  }} onPointerMove={e=>{
    const g=gesture.current;if(!g){if(!disabled&&!panHeld)setHover(point(e));return;}if(g.pointer!==e.pointerId)return;e.stopPropagation();
    const samples=e.nativeEvent.getCoalescedEvents?.()??[e.nativeEvent];
    for(const sample of samples.length?samples:[e.nativeEvent]){const p=point(sample),last=g.points.at(-1)!;if(Math.hypot(p.x-last.x,p.y-last.y)>.3&&g.points.length<4096)g.points.push({x:p.x,y:p.y});}
    setPreview(stampPlacements(g.points,settings,g.seed));
    setPreviewPoints([...g.points]);
  }} onPointerLeave={()=>setHover(null)} onPointerUp={finish} onPointerCancel={cancel} onLostPointerCapture={()=>{if(gesture.current)cancel();}}>
    <rect width={width} height={height} fill="transparent" pointerEvents={panHeld||disabled?'none':'all'} style={{cursor:'crosshair',touchAction:'none'}}/>
    {base.map(p=><path key={p.id} d={p.d} fill={p.fillColor} pointerEvents="none"/>)}<StampInstances definition={definition} settings={settings} placements={preview}/>
    {!preview.length&&hover&&!disabled&&!panHeld&&<g opacity=".4" pointerEvents="none"><StampStrokePreview definition={definition} settings={settings} points={[hover]}/><circle cx={hover.x} cy={hover.y} r="2" fill="none" stroke="currentColor" vectorEffect="non-scaling-stroke"/></g>}
  </g>;
}
