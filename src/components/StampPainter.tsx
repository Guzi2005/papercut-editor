import {useEffect,useId,useMemo,useRef,useState} from 'react';
import type {CutoutPath,Point} from '../types/papercut';
import {placedStampPaths,prepareStamp,stampPlacements,type StampDefinition,type StampSettings,type StampPlacement} from '../utils/stamps';

export function StampInstances({definition,settings,placements}:{definition:StampDefinition;settings:StampSettings;placements:StampPlacement[]}) {
  const id='stamp-'+useId().replace(/[^a-z0-9_-]/gi,'');
  const parts=useMemo(()=>prepareStamp(definition,settings),[definition,settings]);
  return <g pointerEvents="none"><defs><g id={id}>{parts.map(p=><path key={p.id} d={p.d} fill={p.color}/>)}</g></defs>{placements.map((p,i)=><use key={i} href={`#${id}`} transform={`translate(${p.x} ${p.y}) rotate(${p.angle*180/Math.PI}) scale(${p.scale}) translate(-50 -50)`}/>)}</g>;
}

export function StampPainter({definition,settings,width,height,panHeld=false,disabled=false,onCommit}:{definition:StampDefinition;settings:StampSettings;width:number;height:number;panHeld?:boolean;disabled?:boolean;onCommit:(paths:CutoutPath[])=>void}) {
  const root=useRef<SVGGElement>(null),gesture=useRef<{points:Point[];seed:number;pointer:number}|null>(null);
  const [preview,setPreview]=useState<StampPlacement[]>([]);
  const [hover,setHover]=useState<Point|null>(null);
  const parts=useMemo(()=>prepareStamp(definition,settings),[definition,settings]);
  const cancel=()=>{gesture.current=null;setPreview([]);};
  useEffect(()=>{cancel();setHover(null);},[definition,settings,disabled,panHeld]);
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&gesture.current){e.preventDefault();e.stopImmediatePropagation();cancel();}};window.addEventListener('keydown',key,true);window.addEventListener('blur',cancel);return()=>{window.removeEventListener('keydown',key,true);window.removeEventListener('blur',cancel);};},[]);
  const point=(e:{clientX:number;clientY:number}):Point=>{const m=root.current?.getScreenCTM();return m?new DOMPoint(e.clientX,e.clientY).matrixTransform(m.inverse()):{x:0,y:0};};
  const finish=(e:React.PointerEvent)=>{
    const g=gesture.current;if(!g||g.pointer!==e.pointerId)return;
    e.stopPropagation();const placements=stampPlacements(g.points,settings,g.seed);cancel();
    if(root.current?.hasPointerCapture(e.pointerId))root.current.releasePointerCapture(e.pointerId);
    onCommit(placedStampPaths(parts,placements,definition.name,`stamp_${Date.now().toString(36)}_${g.seed.toString(36)}`));
  };
  return <g ref={root} tabIndex={-1} onPointerDown={e=>{
    if(e.button!==0||panHeld||disabled)return;e.stopPropagation();e.preventDefault();root.current?.focus();root.current?.setPointerCapture(e.pointerId);
    gesture.current={points:[point(e)],seed:Math.floor(Math.random()*2147483647),pointer:e.pointerId};
    setPreview(stampPlacements(gesture.current.points,settings,gesture.current.seed));
  }} onPointerMove={e=>{
    const g=gesture.current;if(!g){if(!disabled&&!panHeld)setHover(point(e));return;}if(g.pointer!==e.pointerId)return;e.stopPropagation();
    const samples=e.nativeEvent.getCoalescedEvents?.()??[e.nativeEvent];
    for(const sample of samples.length?samples:[e.nativeEvent]){const p=point(sample),last=g.points.at(-1)!;if(Math.hypot(p.x-last.x,p.y-last.y)>.3&&g.points.length<4096)g.points.push({x:p.x,y:p.y});}
    setPreview(stampPlacements(g.points,settings,g.seed));
  }} onPointerLeave={()=>setHover(null)} onPointerUp={finish} onPointerCancel={cancel} onLostPointerCapture={()=>{if(gesture.current)cancel();}}>
    <rect width={width} height={height} fill="transparent" pointerEvents={panHeld||disabled?'none':'all'} style={{cursor:'crosshair',touchAction:'none'}}/>
    <StampInstances definition={definition} settings={settings} placements={preview}/>
    {!preview.length&&hover&&!disabled&&!panHeld&&<g opacity=".4" pointerEvents="none"><StampInstances definition={definition} settings={settings} placements={[{...hover,angle:settings.angle*Math.PI/180,scale:settings.size/100}]}/><circle cx={hover.x} cy={hover.y} r="2" fill="none" stroke="currentColor" vectorEffect="non-scaling-stroke"/></g>}
  </g>;
}
