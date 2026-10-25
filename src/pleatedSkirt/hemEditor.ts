import type {SkirtDesign} from './model';
import {effectiveHem, hemAxes, setHemParameters, ellipsePerimeter} from './shape';

const NS='http://www.w3.org/2000/svg';
const VIEW_W=200, VIEW_H=190, CX=100, CY=95, SCALE=.85, ROTATION_OFFSET=14;
const HEM_MIN=100, HEM_MAX=360, RATIO_MIN=.35, RATIO_MAX=1, ANGLE_MAX=180;

type HandleName='major'|'minor'|'rotation';
type Point={x:number;y:number};
interface DragState {
  pointerId:number;
  handle:HandleName;
  snapshot:SkirtDesign;
  start:Point;
  majorDir:Point;
  minorDir:Point;
  majorPx:number;
  minorPx:number;
  initialHem:number;
  initialRatio:number;
  candidate?:SkirtDesign;
  changed:boolean;
}

const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));
const normalizeAngle=(angle:number)=>((angle%180)+180)%180;
const svgElement=<K extends keyof SVGElementTagNameMap>(tag:K)=>document.createElementNS(NS,tag) as SVGElementTagNameMap[K];

function rotate(x:number,y:number,angleDeg:number):Point {
  const radians=angleDeg*Math.PI/180,cos=Math.cos(radians),sin=Math.sin(radians);
  return {x:CX+x*cos-y*sin,y:CY+x*sin+y*cos};
}
function angleDistance(a:number,b:number){
  const distance=Math.abs(a-b)%180;
  return Math.min(distance,180-distance);
}
function sameHem(a:SkirtDesign,b:SkirtDesign){
  const ha=effectiveHem(a),hb=effectiveHem(b);
  return Math.abs(a.parameters.hem_cm-b.parameters.hem_cm)<1e-8
    &&Math.abs(ha.ratio-hb.ratio)<1e-8
    &&angleDistance(ha.angle_deg,hb.angle_deg)<1e-8;
}
function ariaNumber(value:number){
  const rounded=Math.round(value*10000)/10000;
  return Object.is(rounded,-0)?'0':String(rounded);
}

/** A compact plan-view editor for the hem ellipse. */
export function createHemEditor(
  design:SkirtDesign,
  onPreview:(design:SkirtDesign)=>void,
  onCommit:(design:SkirtDesign)=>void,
  onCancel:()=>void,
):SVGSVGElement {
  const svg=svgElement('svg');
  svg.setAttribute('class','skirt-hem-editor');
  svg.setAttribute('viewBox',`0 0 ${VIEW_W} ${VIEW_H}`);
  svg.setAttribute('preserveAspectRatio','none');
  svg.setAttribute('fill','none');
  svg.setAttribute('stroke','currentColor');
  svg.setAttribute('role','group');
  svg.setAttribute('aria-label','下摆轮廓编辑器');

  // Fixed drafting references stay behind the editable hem, independent of
  // its size and rotation. The head is a schematic standing-position guide.
  const grid=svgElement('g');
  grid.setAttribute('class','skirt-hem-grid');
  grid.setAttribute('aria-hidden','true');
  grid.setAttribute('pointer-events','none');
  for(let i=-12;i<=12;i++)for(const vertical of [true,false]){
    const position=(vertical?CX:CY)+i*10*SCALE;
    if(position<0||position>(vertical?VIEW_W:VIEW_H))continue;
    const line=svgElement('line');
    line.setAttribute('x1',String(vertical?position:0));line.setAttribute('x2',String(vertical?position:VIEW_W));
    line.setAttribute('y1',String(vertical?0:position));line.setAttribute('y2',String(vertical?VIEW_H:position));
    line.setAttribute('class',i%5===0?'skirt-hem-grid-major':'skirt-hem-grid-minor');grid.append(line);
  }
  const head=svgElement('circle');
  head.setAttribute('class','skirt-hem-head');
  head.setAttribute('cx',String(CX));head.setAttribute('cy',String(CY+3.5*SCALE));
  head.setAttribute('r',String(16*SCALE));
  head.setAttribute('pointer-events','none');head.setAttribute('aria-hidden','true');

  const outline=svgElement('ellipse');
  outline.setAttribute('class','skirt-hem-outline');
  outline.setAttribute('fill','none');
  outline.setAttribute('stroke','currentColor');

  const majorAxis=svgElement('line'),minorAxis=svgElement('line');
  for(const axis of [majorAxis,minorAxis]){
    axis.setAttribute('class','skirt-hem-axis');
    axis.setAttribute('fill','none');
    axis.setAttribute('stroke','currentColor');
  }

  const front=svgElement('text');
  front.textContent='前';
  front.setAttribute('x',String(CX));
  front.setAttribute('y','186.5');
  front.setAttribute('text-anchor','middle');
  front.setAttribute('fill','currentColor');
  front.setAttribute('stroke','none');
  front.setAttribute('font-size','9');
  front.setAttribute('opacity','.55');
  front.setAttribute('pointer-events','none');
  front.setAttribute('aria-hidden','true');

  const definitions:Record<HandleName,{label:string;title:string}>={
    major:{label:'下摆大小',title:'拖动调整下摆大小（100–360 cm）'},
    minor:{label:'下摆椭圆率',title:'拖动调整下摆椭圆率（35%–100%）'},
    rotation:{label:'下摆朝向',title:'拖动调整下摆朝向（0°–180°）'},
  };
  const handles={} as Record<HandleName,SVGCircleElement>;
  for(const name of ['major','minor','rotation'] as const){
    const handle=svgElement('circle'),definition=definitions[name];
    handle.setAttribute('class','skirt-hem-handle');
    handle.setAttribute('data-hem-handle',name);
    handle.setAttribute('tabindex','0');
    handle.setAttribute('focusable','true');
    handle.setAttribute('role','slider');
    handle.setAttribute('aria-label',definition.label);
    handle.setAttribute('fill','currentColor');
    handle.setAttribute('stroke','currentColor');
    handle.setAttribute('r','5');
    const title=svgElement('title');
    title.textContent=definition.title;
    handle.append(title);
    handles[name]=handle;
  }

  svg.append(grid,outline,majorAxis,minorAxis,head,front,handles.major,handles.minor,handles.rotation);

  let current=design;
  let drag:DragState|null=null;

  function setSlider(handle:SVGCircleElement,now:number,min:number,max:number,text:string){
    handle.setAttribute('aria-valuenow',ariaNumber(now));
    handle.setAttribute('aria-valuemin',ariaNumber(min));
    handle.setAttribute('aria-valuemax',ariaNumber(max));
    handle.setAttribute('aria-valuetext',text);
  }
  function setLine(line:SVGLineElement,from:Point,to:Point){
    line.setAttribute('x1',ariaNumber(from.x));
    line.setAttribute('y1',ariaNumber(from.y));
    line.setAttribute('x2',ariaNumber(to.x));
    line.setAttribute('y2',ariaNumber(to.y));
  }
  function setHandle(handle:SVGCircleElement,at:Point){
    handle.setAttribute('cx',ariaNumber(at.x));
    handle.setAttribute('cy',ariaNumber(at.y));
  }
  function draw(next:SkirtDesign){
    const geometry=hemAxes(next);
    const majorPx=geometry.major*SCALE,minorPx=geometry.minor*SCALE,angle=geometry.angle_deg;
    const majorEnd=rotate(majorPx,0,angle),majorOther=rotate(-majorPx,0,angle);
    const minorEnd=rotate(0,minorPx,angle),minorOther=rotate(0,-minorPx,angle);

    outline.setAttribute('cx',String(CX));
    outline.setAttribute('cy',String(CY));
    outline.setAttribute('rx',ariaNumber(majorPx));
    outline.setAttribute('ry',ariaNumber(minorPx));
    outline.setAttribute('transform',`rotate(${ariaNumber(angle)} ${CX} ${CY})`);
    setLine(majorAxis,majorOther,majorEnd);
    setLine(minorAxis,minorOther,minorEnd);
    setHandle(handles.major,majorEnd);
    setHandle(handles.minor,minorEnd);
    setHandle(handles.rotation,rotate(majorPx+ROTATION_OFFSET,0,angle));

    setSlider(handles.major,next.parameters.hem_cm,HEM_MIN,HEM_MAX,`${Math.round(next.parameters.hem_cm)} 厘米`);
    setSlider(handles.minor,geometry.ratio,RATIO_MIN,RATIO_MAX,`${Math.round(geometry.ratio*100)}%`);
    setSlider(handles.rotation,geometry.angle_deg,0,ANGLE_MAX,`${Math.round(geometry.angle_deg)} 度`);
  }
  function pointFromEvent(event:{clientX:number;clientY:number}):Point {
    const bounds=svg.getBoundingClientRect();
    const width=bounds.width>0?bounds.width:VIEW_W;
    const height=bounds.height>0?bounds.height:VIEW_H;
    return {
      x:(event.clientX-bounds.left)*VIEW_W/width,
      y:(event.clientY-bounds.top)*VIEW_H/height,
    };
  }
  function handleFromTarget(target:EventTarget|null):SVGCircleElement|null {
    const element=target as Element|null;
    const hit=element?.closest?.('[data-hem-handle]');
    if(!hit)return null;
    const name=hit.getAttribute('data-hem-handle');
    return name==='major'||name==='minor'||name==='rotation'?hit as SVGCircleElement:null;
  }
  function handleName(handle:SVGCircleElement):HandleName {
    return handle.getAttribute('data-hem-handle') as HandleName;
  }
  function capture(pointerId:number){
    try{if(typeof svg.setPointerCapture==='function')svg.setPointerCapture(pointerId);}catch{}
  }
  function release(pointerId:number){
    try{if(typeof svg.releasePointerCapture==='function')svg.releasePointerCapture(pointerId);}catch{}
  }
  function candidateFor(state:DragState,point:Point):SkirtDesign {
    const candidate=structuredClone(state.snapshot);
    if(state.handle==='major'){
      const dx=point.x-state.start.x,dy=point.y-state.start.y;
      const projected=state.majorPx+dx*state.majorDir.x+dy*state.majorDir.y;
      candidate.parameters.hem_cm=Math.round(clamp(state.initialHem*Math.max(0,projected)/state.majorPx,HEM_MIN,HEM_MAX));
      setHemParameters(candidate,{ratio:state.initialRatio});
    }else if(state.handle==='minor'){
      const dx=point.x-state.start.x,dy=point.y-state.start.y;
      const projected=state.minorPx+dx*state.minorDir.x+dy*state.minorDir.y;
      // With perimeter fixed, changing the ratio also changes the major axis.
      // Invert the minor-radius equation so the handle follows the pointer.
      let lo=RATIO_MIN,hi=RATIO_MAX;
      for(let i=0;i<28;i++){const ratio=(lo+hi)*.5,minor=state.initialHem*ratio/ellipsePerimeter(1,ratio)*SCALE;if(minor<projected)lo=ratio;else hi=ratio;}
      setHemParameters(candidate,{ratio:Math.round((lo+hi)*50)/100});
    }else{
      const angle=Math.atan2(point.y-CY,point.x-CX)*180/Math.PI;
      setHemParameters(candidate,{angle_deg:normalizeAngle(Math.round(angle))});
    }
    return candidate;
  }
  function cancelDrag(){
    const active=drag;
    if(!active)return;
    drag=null;
    release(active.pointerId);
    current=active.snapshot;
    draw(current);
    onCancel();
  }

  svg.addEventListener('pointerdown',event=>{
    if(drag||event.button!==0)return;
    const handle=handleFromTarget(event.target);
    if(!handle)return;
    const snapshot=structuredClone(current),geometry=hemAxes(snapshot);
    const radians=geometry.angle_deg*Math.PI/180;
    drag={
      pointerId:event.pointerId,
      handle:handleName(handle),
      snapshot,
      start:pointFromEvent(event),
      majorDir:{x:Math.cos(radians),y:Math.sin(radians)},
      minorDir:{x:-Math.sin(radians),y:Math.cos(radians)},
      majorPx:geometry.major*SCALE,
      minorPx:geometry.minor*SCALE,
      initialHem:snapshot.parameters.hem_cm,
      initialRatio:geometry.ratio,
      changed:false,
    };
    capture(event.pointerId);
    try{handle.focus({preventScroll:true});}catch{}
    event.preventDefault();
  });

  svg.addEventListener('pointermove',event=>{
    const active=drag;
    if(!active||event.pointerId!==active.pointerId)return;
    const candidate=candidateFor(active,pointFromEvent(event));
    active.candidate=candidate;
    active.changed=!sameHem(active.snapshot,candidate);
    draw(candidate);
    onPreview(candidate);
    event.preventDefault();
  });

  svg.addEventListener('pointerup',event=>{
    const active=drag;
    if(!active||event.pointerId!==active.pointerId)return;
    drag=null;
    release(active.pointerId);
    event.preventDefault();
    if(active.changed&&active.candidate){
      current=active.candidate;
      draw(current);
      onCommit(active.candidate);
    }else{
      current=active.snapshot;
      draw(current);
      if(active.candidate)onCancel();
    }
  });

  svg.addEventListener('pointercancel',event=>{
    if(!drag||event.pointerId!==drag.pointerId)return;
    cancelDrag();
  });
  svg.addEventListener('lostpointercapture',event=>{if(drag?.pointerId===event.pointerId)cancelDrag();});

  svg.addEventListener('keydown',event=>{
    if(event.key==='Escape'){
      if(drag){
        event.preventDefault();
        event.stopPropagation();
        cancelDrag();
      }
      return;
    }
    if(drag)return;
    const handle=handleFromTarget(event.target);
    if(!handle)return;
    const direction=event.key==='ArrowRight'||event.key==='ArrowUp'?1
      :event.key==='ArrowLeft'||event.key==='ArrowDown'?-1:0;
    if(!direction)return;
    event.preventDefault();
    const multiplier=event.shiftKey?10:1,name=handleName(handle),before=effectiveHem(current);
    const candidate=structuredClone(current);
    if(name==='major'){
      candidate.parameters.hem_cm=clamp(current.parameters.hem_cm+direction*multiplier,HEM_MIN,HEM_MAX);
      setHemParameters(candidate,{ratio:before.ratio});
    }else if(name==='minor'){
      setHemParameters(candidate,{ratio:clamp(before.ratio+direction*.01*multiplier,RATIO_MIN,RATIO_MAX)});
    }else{
      setHemParameters(candidate,{angle_deg:normalizeAngle(before.angle_deg+direction*multiplier)});
    }
    if(sameHem(current,candidate))return;
    current=candidate;
    draw(current);
    onCommit(candidate);
  });

  draw(current);
  return svg;
}
