import {useRef,useState} from 'react';
import type {FabricFill,Layer,Point} from '../types/papercut';
import {layerContent} from '../utils/layerContent';
import {renderLayerMarkup} from '../utils/layerSvg';
import type {FabricAsset} from '../types/papercut';
export function FabricAdjustOverlay({layer,onCommit,assets}:{layer:Layer;onCommit:(fill:FabricFill)=>void;assets?:Record<string,FabricAsset>}){
  const root=useRef<SVGGElement>(null),gesture=useRef<{start:Point;fill:FabricFill;pointer:number}|null>(null),[delta,setDelta]=useState<Point>({x:0,y:0});
  const b=layerContent(layer).bounds;
  if(!b||!layer.fabric)return null;
  const point=(e:{clientX:number;clientY:number})=>new DOMPoint(e.clientX,e.clientY).matrixTransform(root.current!.getScreenCTM()!.inverse());
  const previewFill={...layer.fabric,transform:[...layer.fabric.transform.slice(0,4),layer.fabric.transform[4]+delta.x,layer.fabric.transform[5]+delta.y] as FabricFill['transform']};
  return <g ref={root} onPointerDown={e=>{if(e.button!==0)return;e.stopPropagation();e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);gesture.current={start:point(e),fill:layer.fabric!,pointer:e.pointerId};}} onPointerMove={e=>{const g=gesture.current;if(!g||g.pointer!==e.pointerId)return;e.stopPropagation();const p=point(e);setDelta({x:p.x-g.start.x,y:p.y-g.start.y});}} onPointerUp={e=>{const g=gesture.current;if(!g||g.pointer!==e.pointerId)return;e.stopPropagation();const p=point(e),m=[...g.fill.transform] as FabricFill['transform'];m[4]+=p.x-g.start.x;m[5]+=p.y-g.start.y;gesture.current=null;setDelta({x:0,y:0});onCommit({...g.fill,transform:m});}} onPointerCancel={()=>{gesture.current=null;setDelta({x:0,y:0});}}>
    {gesture.current&&<g pointerEvents="none" dangerouslySetInnerHTML={{__html:renderLayerMarkup({...layer,fabric:previewFill},{idPrefix:'fabric_adjust_',shadow:0,grain:false,paperMode:'vector',fabricAssets:assets})}}/>}
    <rect data-fabric-adjust x={b.x} y={b.y} width={b.width} height={b.height} fill="transparent" stroke="var(--ui-accent)" strokeDasharray="6 4" vectorEffect="non-scaling-stroke" pointerEvents="all" style={{cursor:'move',touchAction:'none'}}/>
    <text x={b.x+6} y={b.y+16} fontSize="12" fill="var(--ui-accent)" pointerEvents="none">移动布料 {Math.round(delta.x)}, {Math.round(delta.y)}</text>
  </g>;
}
