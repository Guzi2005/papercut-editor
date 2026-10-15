import {useEffect,useRef,useState} from 'react';
import type {Point} from '../types/papercut';
import {serializeVectorPath,type VectorNode,type VectorPath} from '../utils/vectorPath';
import {applySymmetry} from '../utils/symmetry';
import type {Matrix} from '../utils/pathTransform';
import {drawingPreviewStyle,type DrawingPreviewMode} from '../utils/drawingPreview';
import {splitSubpaths} from '../utils/layerSvg';

const constrained=(p:Point,origin:Point,enabled:boolean):Point=>{
  if(!enabled)return p;
  const angle=Math.round(Math.atan2(p.y-origin.y,p.x-origin.x)/(Math.PI/12))*Math.PI/12,length=Math.hypot(p.x-origin.x,p.y-origin.y);
  return {x:origin.x+Math.cos(angle)*length,y:origin.y+Math.sin(angle)*length};
};

/** One press places a node; dragging that same press defines its tangent, as a conventional pen tool. */
export function VectorPen({width,height,zoom,color,strokeWidth,disabled,panHeld,matrices,previewMode,onCommit}:{
  width:number;height:number;zoom:number;color:string;strokeWidth:number;disabled:boolean;panHeld:boolean;matrices:Matrix[];previewMode:DrawingPreviewMode;
  onCommit:(path:VectorPath,closed:boolean)=>void;
}){
  const root=useRef<SVGGElement>(null),nodesRef=useRef<VectorNode[]>([]),gesture=useRef<{pointer:number;index:number;start:Point}|null>(null);
  const [nodes,setNodes]=useState<VectorNode[]>([]),[hover,setHover]=useState<Point|null>(null);
  const update=(next:VectorNode[])=>{nodesRef.current=next;setNodes(next);};
  const cancel=()=>{gesture.current=null;update([]);setHover(null);};
  const commit=(closed:boolean)=>{
    const n=nodesRef.current;
    if(n.length<2)return;
    onCommit([{nodes:structuredClone(n),closed,relative:false}],closed);cancel();
  };
  const point=(e:{clientX:number;clientY:number}):Point=>{
    const matrix=root.current?.getScreenCTM();if(!matrix)return {x:0,y:0};
    const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());return {x:p.x,y:p.y};
  };
  useEffect(()=>{if(disabled)cancel();},[disabled]);
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{
      if((e.target as Element|null)?.closest('input,textarea,select,[contenteditable="true"],[role="spinbutton"],[data-property-control],[data-layers-panel]'))return;
      if(!nodesRef.current.length || document.querySelector('dialog[open]'))return;
      if(e.key==='Enter'){e.preventDefault();e.stopImmediatePropagation();commit(false);}
      else if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();cancel();}
      else if(e.key==='Backspace'||e.key==='Delete'){e.preventDefault();e.stopImmediatePropagation();gesture.current=null;update(nodesRef.current.slice(0,-1));}
      else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&gesture.current){e.preventDefault();e.stopImmediatePropagation();cancel();}
    };
    window.addEventListener('keydown',key,true);window.addEventListener('blur',cancel);
    return()=>{window.removeEventListener('keydown',key,true);window.removeEventListener('blur',cancel);};
  });
  const finish=(e:React.PointerEvent)=>{
    if(gesture.current?.pointer!==e.pointerId)return;
    e.stopPropagation();gesture.current=null;
    if(root.current?.hasPointerCapture(e.pointerId))root.current.releasePointerCapture(e.pointerId);
  };
  const closing=nodes.length>=2&&hover&&Math.hypot(nodes[0].x-hover.x,nodes[0].y-hover.y)*zoom<10;
  const previewNodes=hover&&!gesture.current&&nodes.length?[...nodes,closing?nodes[0]:hover]:nodes;
  const d=previewNodes.length>=2?serializeVectorPath([{nodes:previewNodes,closed:previewMode==='filled'&&previewNodes.length>=3,relative:false}]):'';
  const pathStyle=drawingPreviewStyle(previewMode,color,zoom);
  return <g ref={root} data-vector-pen="true" onPointerDown={e=>{
    if(e.button!==0||disabled||panHeld)return;
    e.stopPropagation();e.preventDefault();
    let p=point(e),current=nodesRef.current;
    if(current.length>=2&&Math.hypot(p.x-current[0].x,p.y-current[0].y)*zoom<10){commit(true);return;}
    if(current.length)p=constrained(p,current.at(-1)!,e.ctrlKey||e.metaKey);
    const next=[...current,{...p,mode:'corner' as const}];update(next);setHover(p);
    gesture.current={pointer:e.pointerId,index:next.length-1,start:p};root.current?.setPointerCapture(e.pointerId);
  }} onPointerMove={e=>{
    if(disabled||panHeld)return;
    const p=point(e),g=gesture.current;
    if(!g){setHover(nodes.length?constrained(p,nodes.at(-1)!,e.ctrlKey||e.metaKey):p);return;}
    if(g.pointer!==e.pointerId)return;e.stopPropagation();
    if(Math.hypot(p.x-g.start.x,p.y-g.start.y)*zoom<2)return;
    const next=structuredClone(nodesRef.current),n=next[g.index],out=constrained(p,n,e.ctrlKey||e.metaKey);
    n.outgoing=out;n.incoming=e.altKey?{...n}:{x:2*n.x-out.x,y:2*n.y-out.y};n.mode=e.altKey?'corner':'symmetric';update(next);setHover(p);
  }} onPointerUp={finish} onPointerCancel={cancel} onLostPointerCapture={()=>{if(gesture.current)cancel();}} onPointerLeave={()=>{if(!gesture.current)setHover(null);}}>
    <rect width={width} height={height} fill="transparent" pointerEvents={disabled||panHeld?'none':'all'} style={{cursor:closing?'pointer':'crosshair',touchAction:'none'}}/>
    {d&&splitSubpaths(applySymmetry(d,matrices)).map((piece,i)=><path key={i} d={piece} {...pathStyle} pointerEvents="none"/>)}
    {nodes.length>=2&&<path d={serializeVectorPath([{nodes,closed:false,relative:false}])} fill="none" stroke={color} strokeWidth={strokeWidth} opacity=".6" pointerEvents="none"/>}
    {nodes.map((n,i)=><g key={i} pointerEvents="none">
      {(['incoming','outgoing']as const).map(side=>n[side]&&<g key={side}><line x1={n.x} y1={n.y} x2={n[side]!.x} y2={n[side]!.y} stroke="#2652d0" strokeWidth={1/zoom}/><circle cx={n[side]!.x} cy={n[side]!.y} r={3/zoom} fill="white" stroke="#2652d0" strokeWidth={1/zoom}/></g>)}
      <rect x={n.x-3.5/zoom} y={n.y-3.5/zoom} width={7/zoom} height={7/zoom} fill={i===0&&closing?'#2652d0':'white'} stroke="#2652d0" strokeWidth={1.3/zoom}/>
    </g>)}
  </g>;
}
