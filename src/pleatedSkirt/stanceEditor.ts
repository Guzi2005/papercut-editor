import {defaultStance,limitStance,stanceArm,stanceArmAngle,stanceDrop,stanceFigure,stanceLeg,stanceProject,type Stance} from './stance';
import {el,button} from './ui';

const NS='http://www.w3.org/2000/svg';
function svg<K extends keyof SVGElementTagNameMap>(tag:K,attrs:Record<string,string|number>={}){
 const element=document.createElementNS(NS,tag);for(const [key,value] of Object.entries(attrs))element.setAttribute(key,String(value));return element;
}
const segment=(points:readonly number[][])=>points.map((p,i)=>`${i?'L':'M'}${p.join(' ')}`).join(' ');
type SideKey='left'|'right';

/** A solid, avatar-proportioned front view and a separate foot placement plan. */
export function createStanceEditor(onChange:(s:Stance)=>void){
 let state=defaultStance();
 const root=el('div','skirt-stance-editor'),heading=el('div','skirt-stance-heading');
 const reset=button('复位',()=>{state=defaultStance();render();onChange(state);});heading.append(el('strong','','站姿摆布'),reset);
 const figure=svg('svg',{viewBox:`0 0 ${stanceFigure.width} ${stanceFigure.height}`,'aria-label':'手臂张开角度'});
 const plan=svg('svg',{viewBox:'0 0 200 200','aria-label':'左右脚占位网格'});
 figure.classList.add('skirt-stance-figure');plan.classList.add('skirt-stance-plan');
 const ground=svg('path',{d:'M36 215H184',class:'stance-axis'}),center=svg('path',{d:'M110 15V215',class:'stance-axis'});
 const head=svg('ellipse',{cx:110,cy:43,rx:22,ry:23,class:'stance-solid'});
 const neck=svg('rect',{x:103,y:64,width:14,height:17,rx:6,class:'stance-solid'});
 const torso=svg('path',{d:'M99 76 Q110 73 121 76 Q130 78 132 90 L130 117 Q128 124 120 124 H100 Q92 124 90 117 L88 90 Q90 78 99 76Z',class:'stance-solid'});
 const body=svg('g');body.append(neck,torso,head);
 const legs=svg('g'),arms=svg('g'),controls=svg('g');figure.append(ground,center,legs,body,arms,controls);
 for(let i=10;i<=190;i+=18)plan.append(svg('path',{d:`M${i} 10V190 M10 ${i}H190`,class:i===100?'stance-axis':'stance-grid'}));
 plan.append(svg('circle',{cx:100,cy:100,r:17,class:'skirt-hem-head'}));
 const front=svg('text',{x:100,y:8,'text-anchor':'middle',class:'stance-value'});front.textContent='前';plan.append(front);
 const handles=new Map<string,SVGElement>(),limbs=new Map<SideKey,{upper:SVGPathElement;lower:SVGPathElement;hand:SVGEllipseElement;joints:SVGCircleElement[];leg:SVGPathElement;sole:SVGRectElement}>();
 const labels=new Map<SideKey,SVGTextElement>();
 const locate=(e:PointerEvent,canvas:SVGSVGElement)=>{const point=new DOMPoint(e.clientX,e.clientY),matrix=canvas.getScreenCTM();return matrix?point.matrixTransform(matrix.inverse()):point;};

 for(const [key,side,name] of [['left',-1,'左'],['right',1,'右']] as const){
  const upper=svg('path',{class:'stance-limb stance-upper-arm'}),lower=svg('path',{class:'stance-limb stance-forearm'}),hand=svg('ellipse',{rx:6.5,ry:8,class:'stance-solid'});
  const leg=svg('path',{class:'stance-limb stance-leg'}),sole=svg('rect',{width:20,height:9,rx:4.5,class:'stance-solid'});
  legs.append(leg,sole);arms.append(upper,lower,hand);
  const joints=[0,1,2].map(()=>svg('circle',{r:2.3,class:'stance-joint'}));
  const handle=svg('circle',{r:8,class:'stance-hand',tabindex:0,role:'slider','aria-label':`${name}手臂张开角度`,'aria-valuemin':0,'aria-valuemax':110});
  const label=svg('text',{x:side<0?15:205,y:18,'text-anchor':side<0?'start':'end',class:'stance-value'});labels.set(key,label);controls.append(...joints,handle,label);
  limbs.set(key,{upper,lower,hand,joints,leg,sole});handles.set(`${key}-arm`,handle);
  const foot=svg('g',{class:'stance-foot',tabindex:0,role:'slider','aria-label':`${name}脚占位`});
  foot.append(svg('path',{d:'M-6 12 Q-9 4 -8 -11 Q-7 -22 0 -23 Q8 -22 8 -11 L7 11 Q6 18 0 18 Q-6 18 -6 12Z'}),svg('path',{d:'M-5 7Q0 5 5 7',class:'stance-sole-line'}));plan.append(foot);handles.set(`${key}-foot`,foot);

  for(const [type,raw,canvas] of [['arm',handle,figure],['foot',foot,plan]] as const){
   const target:SVGElement=raw;let drag:{id:number;snapshot:Stance;start:DOMPoint}|undefined;
   const change=(event:PointerEvent)=>{
    const point=locate(event,canvas),next=structuredClone(state);
    if(type==='foot'&&drag){next[key].x=drag.snapshot[key].x+(point.x-drag.start.x)/180;next[key].z=drag.snapshot[key].z-(point.y-drag.start.y)/180;}
    else next[key].arm=stanceArmAngle(side,point.x,point.y,stanceDrop(state));
    state=limitStance(next);render();onChange(state);
   };
   target.addEventListener('pointerdown',event=>{if(event.button!==0||drag)return;event.preventDefault();drag={id:event.pointerId,snapshot:structuredClone(state),start:locate(event,canvas)};target.setPointerCapture(event.pointerId);target.focus();root.dataset.dragging=`${key}-${type}`;});
   target.addEventListener('pointermove',event=>{if(drag?.id===event.pointerId){event.preventDefault();change(event);}});
   target.addEventListener('pointerup',event=>{if(drag?.id===event.pointerId){drag=undefined;delete root.dataset.dragging;}});
   const cancel=()=>{if(!drag)return;state=drag.snapshot;drag=undefined;delete root.dataset.dragging;render();onChange(state);};
   target.addEventListener('pointercancel',cancel);target.addEventListener('lostpointercapture',cancel);
   target.addEventListener('keydown',event=>{
    if(event.key==='Escape'){if(drag){event.preventDefault();event.stopPropagation();cancel();}return;}
    const next=structuredClone(state),step=event.shiftKey?.05:.01;
    if(type==='arm'){
     if(!['ArrowLeft','ArrowDown','ArrowRight','ArrowUp','Home'].includes(event.key))return;
     next[key].arm=event.key==='Home'?0:next[key].arm+(['ArrowUp','ArrowRight'].includes(event.key)?1:-1)*(event.shiftKey?10:1);
    }else{
     if(!['ArrowLeft','ArrowDown','ArrowRight','ArrowUp'].includes(event.key))return;
     next[key].x+=(event.key==='ArrowRight'?step:event.key==='ArrowLeft'?-step:0);
     next[key].z+=(event.key==='ArrowUp'?step:event.key==='ArrowDown'?-step:0);
    }
    event.preventDefault();state=limitStance(next);render();onChange(state);
   });
  }
 }
 function render(){
  const drop=stanceDrop(state);body.setAttribute('transform',`translate(0 ${drop*stanceFigure.scale})`);
  for(const [key,side] of [['left',-1],['right',1]] as const){
   const value=state[key],rig=stanceArm(side,value.arm,drop),limb=limbs.get(key)!,handle=handles.get(`${key}-arm`)!,foot=handles.get(`${key}-foot`)!;
   const shoulder=stanceProject(rig.shoulder),elbow=stanceProject(rig.elbow),wrist=stanceProject(rig.wrist),hand=stanceProject(rig.hand),leg=stanceLeg(state,side);
   limb.upper.setAttribute('d',segment([shoulder,elbow]));limb.lower.setAttribute('d',segment([elbow,wrist]));
   limb.hand.setAttribute('cx',String(hand[0]));limb.hand.setAttribute('cy',String(hand[1]));limb.hand.setAttribute('transform',`rotate(${-side*value.arm} ${hand[0]} ${hand[1]})`);
   [shoulder,elbow,wrist].forEach(([x,y],i)=>{limb.joints[i].setAttribute('cx',String(x));limb.joints[i].setAttribute('cy',String(y));});
   const ankle=stanceProject(leg.ankle);limb.leg.setAttribute('d',segment([stanceProject(leg.hip),stanceProject(leg.knee),ankle]));limb.sole.setAttribute('x',String(ankle[0]-10));limb.sole.setAttribute('y','207');
   handle.setAttribute('cx',String(wrist[0]));handle.setAttribute('cy',String(wrist[1]));handle.setAttribute('aria-valuenow',String(Math.round(value.arm)));handle.setAttribute('aria-valuetext',`${Math.round(value.arm)}°`);
   labels.get(key)!.textContent=`${key==='left'?'左':'右'} ${Math.round(value.arm)}°`;
   foot.setAttribute('transform',`translate(${100+value.x*180} ${100-(value.z-.045)*180})`);foot.setAttribute('aria-valuemin',side<0?'-42':'5.5');foot.setAttribute('aria-valuemax',side<0?'-5.5':'42');foot.setAttribute('aria-valuenow',String(Math.round(value.x*100)));foot.setAttribute('aria-valuetext',`左右 ${Math.round(value.x*100)} cm，前后 ${Math.round((value.z-.045)*100)} cm`);
  }
 }
 render();root.append(heading,figure,plan);return root;
}
