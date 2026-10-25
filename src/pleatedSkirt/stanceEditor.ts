import {defaultStance,limitStance,type Stance} from './stance';
import {el,button} from './ui';
const NS='http://www.w3.org/2000/svg';
const svg=<K extends keyof SVGElementTagNameMap>(tag:K,attrs:Record<string,string|number>={})=>{const e=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));return e;};
/** Compact anatomical sketch and a separate orthographic footprint plan. */
export function createStanceEditor(onChange:(s:Stance)=>void){
 let state=defaultStance();const root=el('div','skirt-stance-editor'),heading=el('div','skirt-stance-heading'),reset=button('复位',()=>{state=defaultStance();render();onChange(state);});heading.append(el('strong','','站姿摆布'),reset);
 const figure=svg('svg',{viewBox:'0 0 200 150','aria-label':'手臂张开角度'}),plan=svg('svg',{viewBox:'0 0 200 200','aria-label':'左右脚占位网格'});
 figure.classList.add('skirt-stance-figure');plan.classList.add('skirt-stance-plan');
 figure.append(svg('circle',{cx:100,cy:74,r:65,class:'stance-construction'}),svg('rect',{x:35,y:9,width:130,height:130,class:'stance-construction'}),svg('path',{d:'M100 5V144 M28 70H172',class:'stance-axis'}),svg('circle',{cx:100,cy:28,r:9,class:'stance-anatomy'}),svg('path',{d:'M91 40 Q85 59 91 88 L82 125 M109 40 Q115 59 109 88 L118 125 M91 88L109 88 M90 43L110 43',class:'stance-anatomy'}));
 for(let i=10;i<=190;i+=18)plan.append(svg('path',{d:`M${i} 10V190 M10 ${i}H190`,class:i===100?'stance-axis':'stance-grid'}));
 plan.append(svg('circle',{cx:100,cy:100,r:17,class:'skirt-hem-head'}));
 const frontLabel=svg('text',{x:100,y:8,'text-anchor':'middle',class:'stance-value'});frontLabel.textContent='前';plan.append(frontLabel);
 const handles=new Map<string,SVGElement>(),arms=new Map<string,SVGPathElement>(),values=new Map<string,SVGTextElement>();
 const locate=(e:PointerEvent,canvas:SVGSVGElement)=>{const point=new DOMPoint(e.clientX,e.clientY),matrix=canvas.getScreenCTM();return matrix?point.matrixTransform(matrix.inverse()):point;};
 for(const [key,side,name] of [['left',-1,'左'],['right',1,'右']] as const){
  const line=svg('path',{class:'stance-arm'}),ghost=svg('path',{d:`M${100+side*9} 45L${100+side*49} 45 M${100+side*9} 45L${100+side*38} 17`,class:'stance-construction'});arms.set(key,line);figure.append(ghost,line);
  const hand=svg('circle',{r:5,class:'stance-hand',tabindex:0,role:'slider','aria-label':`${name}手臂张开角度`,'aria-valuemin':0,'aria-valuemax':110});
  const foot=svg('g',{class:'stance-foot',tabindex:0,role:'slider','aria-label':`${name}脚占位`});foot.append(svg('path',{d:'M-7 14 Q-10 5 -8 -12 Q-7 -24 0 -25 Q8 -24 8 -13 L7 12 Q6 20 0 20 Q-6 20 -7 14Z'}));
  const text=svg('text',{x:100+side*70,y:143,'text-anchor':'middle',class:'stance-value'});values.set(key,text);figure.append(text,hand);plan.append(foot);
  handles.set(`${key}-arm`,hand);handles.set(`${key}-foot`,foot);
  for(const [type,raw,canvas] of [['arm',hand,figure],['foot',foot,plan]] as const){
   const handle:SVGElement=raw;
   let drag:{id:number;snapshot:Stance;start:DOMPoint}|undefined;
   const update=(e:PointerEvent)=>{const p=locate(e,canvas),next=structuredClone(state);if(type==='foot'&&drag){next[key].x=drag.snapshot[key].x+(p.x-drag.start.x)/180;next[key].z=drag.snapshot[key].z-(p.y-drag.start.y)/180;}else next[key].arm=Math.atan2(side*(p.x-(100+side*9)),p.y-45)*180/Math.PI;state=limitStance(next);render();onChange(state);};
   handle.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();drag={id:e.pointerId,snapshot:structuredClone(state),start:locate(e,canvas)};handle.setPointerCapture(e.pointerId);handle.focus();});
   handle.addEventListener('pointermove',e=>{if(drag?.id===e.pointerId){e.preventDefault();update(e);}});
   handle.addEventListener('pointerup',e=>{if(drag?.id===e.pointerId)drag=undefined;});
   const cancel=()=>{if(!drag)return;state=drag.snapshot;drag=undefined;render();onChange(state);};
   handle.addEventListener('pointercancel',cancel);handle.addEventListener('lostpointercapture',cancel);
   handle.addEventListener('keydown',e=>{if(e.key==='Escape'){if(drag){e.preventDefault();e.stopPropagation();cancel();}return;}const next=structuredClone(state),step=e.shiftKey?.05:.01;if(type==='arm'){if(!['ArrowLeft','ArrowDown','ArrowRight','ArrowUp','Home'].includes(e.key))return;next[key].arm=e.key==='Home'?0:next[key].arm+(['ArrowUp','ArrowRight'].includes(e.key)?1:-1)*(e.shiftKey?10:1);}else {if(!['ArrowLeft','ArrowDown','ArrowRight','ArrowUp'].includes(e.key))return;next[key].x+=(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0);next[key].z+=(e.key==='ArrowUp'?step:e.key==='ArrowDown'?-step:0);}e.preventDefault();state=limitStance(next);render();onChange(state);});
  }
 }
 function render(){for(const [key,side] of [['left',-1],['right',1]] as const){const v=state[key],angle=v.arm*Math.PI/180,x=100+side*(9+43*Math.sin(angle)),y=45+43*Math.cos(angle),hand=handles.get(`${key}-arm`)!,foot=handles.get(`${key}-foot`)!;hand.setAttribute('cx',String(x));hand.setAttribute('cy',String(y));hand.setAttribute('aria-valuenow',String(Math.round(v.arm)));hand.setAttribute('aria-valuetext',`${Math.round(v.arm)}°`);arms.get(key)!.setAttribute('d',`M${100+side*9} 45L${x} ${y}`);values.get(key)!.textContent=`${key==='left'?'左':'右'} ${Math.round(v.arm)}°`;foot.setAttribute('transform',`translate(${100+v.x*180} ${100-(v.z-.045)*180})`);foot.setAttribute('aria-valuemin',side<0?'-42':'5.5');foot.setAttribute('aria-valuemax',side<0?'-5.5':'42');foot.setAttribute('aria-valuenow',String(Math.round(v.x*100)));foot.setAttribute('aria-valuetext',`左右 ${Math.round(v.x*100)} cm，前后 ${Math.round((v.z-.045)*100)} cm`);}}
 render();root.append(heading,figure,plan);return root;
}
