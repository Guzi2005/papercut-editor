import {useMemo,useRef,useState} from 'react';
import type {Point} from '../types/papercut';
import type {LiveStampStroke} from '../utils/liveStamps';
import {matrixToSvg} from '../utils/pathTransform';
import {douglasPeucker} from '../utils/bezierMath';

/** Node edits address a stroke's local centreline; object placement stays independent. */
export function LiveStampPathOverlay({stroke,onCommit}:{stroke:LiveStampStroke;onCommit:(points:Point[])=>void}){
  const root=useRef<SVGGElement>(null),drag=useRef<{index:number;pointer:number}|null>(null),[draft,setDraft]=useState<Point[]|null>(null);
  const points=useMemo(()=>draft??douglasPeucker(stroke.points,2),[draft,stroke.points]);
  const point=(e:{clientX:number;clientY:number})=>new DOMPoint(e.clientX,e.clientY).matrixTransform(root.current!.getScreenCTM()!.inverse());
  return <g ref={root} transform={stroke.transform?matrixToSvg(stroke.transform):undefined}>
    <polyline points={points.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="var(--ui-accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" pointerEvents="none"/>
    <polyline points={points.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="transparent" strokeWidth="14" vectorEffect="non-scaling-stroke" pointerEvents="stroke" style={{cursor:'copy'}} onPointerDown={e=>e.stopPropagation()} onDoubleClick={e=>{e.stopPropagation();const p=point(e);let best=Infinity,index=0,projected={x:p.x,y:p.y};for(let i=0;i<points.length-1;i++){const a=points[i],b=points[i+1],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1))),q={x:a.x+t*dx,y:a.y+t*dy},distance=Math.hypot(q.x-p.x,q.y-p.y);if(distance<best){best=distance;index=i+1;projected=q;}}const next=[...points];next.splice(index,0,projected);onCommit(next);}}/>
    {points.map((p,index)=><circle pointerEvents="all" data-live-stamp-node={index} key={index} cx={p.x} cy={p.y} r="5" fill="var(--ui-panel)" stroke="var(--ui-accent)" vectorEffect="non-scaling-stroke" style={{cursor:'move',touchAction:'none'}} onPointerDown={e=>{if(e.button!==0)return;e.stopPropagation();e.preventDefault();if(e.altKey&&points.length>2){onCommit(points.filter((_,i)=>i!==index));return;}e.currentTarget.setPointerCapture(e.pointerId);drag.current={index,pointer:e.pointerId};setDraft(points.map(q=>({...q})));}} onPointerMove={e=>{const g=drag.current;if(!g||g.pointer!==e.pointerId||g.index!==index)return;e.stopPropagation();const q=point(e);setDraft(prev=>(prev??points).map((v,i)=>i===index?{x:q.x,y:q.y}:v));}} onPointerUp={e=>{const g=drag.current;if(!g||g.pointer!==e.pointerId)return;e.stopPropagation();const q=point(e),next=points.map((v,i)=>i===g.index?{x:q.x,y:q.y}:v);drag.current=null;setDraft(null);onCommit(next);}} onPointerCancel={()=>{drag.current=null;setDraft(null);}}/>) }
  </g>;
}
