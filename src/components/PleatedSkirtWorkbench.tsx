import {useEffect,useRef,useState} from 'react';
import type {PapercutProject} from '../types/papercut';
import {SkirtStudio} from '../pleatedSkirt/studio';
import {SkirtPreview} from '../pleatedSkirt/preview';
import {paintTexture} from '../pleatedSkirt/texture';
import {rasterizeSkirtOverlay} from '../pleatedSkirt/project';
import type {SkirtDesign} from '../pleatedSkirt/model';
import {serializeProject} from '../utils/storage';
import {downloadFile} from '../utils/svgExporter';

interface Props {project:PapercutProject;onDesign:(d:SkirtDesign)=>void;onPaint:()=>void;onUndo:()=>void;onRedo:()=>void;canUndo:boolean;canRedo:boolean}
export function PleatedSkirtWorkbench(props:Props){
  const host=useRef<HTMLDivElement>(null),latest=useRef(props);latest.current=props;
  const studio=useRef<SkirtStudio|null>(null),overlay=useRef<HTMLCanvasElement|undefined>(undefined);
  const [status,setStatus]=useState('准备原稿图层…'),[ready,setReady]=useState(false),[renderedVersion,setRenderedVersion]=useState(0);
  useEffect(()=>{
    const instance=new SkirtStudio({get:()=>latest.current.project.pleatedSkirt,commit:(_,d)=>latest.current.onDesign(d),overlay:()=>overlay.current,paintLayer:()=>latest.current.onPaint(),status:setStatus});
    studio.current=instance;host.current!.append(instance.element);
    const onError=(e:Event)=>setStatus((e as CustomEvent).detail);window.addEventListener('skirt-error',onError);
    return()=>{window.removeEventListener('skirt-error',onError);instance.dispose();studio.current=null;};
  },[]);
  useEffect(()=>{
    let cancelled=false;setReady(false);
    rasterizeSkirtOverlay(props.project).then(bitmap=>{if(cancelled)return;overlay.current=bitmap;studio.current?.refresh();setReady(true);setRenderedVersion(v=>v+1);setStatus('已同步');}).catch(e=>{if(!cancelled)setStatus(`图层载入失败：${String(e)}`);});
    return()=>{cancelled=true;};
  },[props.project]);
  useEffect(()=>{studio.current?.restoreTabFocus();},[renderedVersion]);
  return <section className="skirt-host" data-skirt-workbench aria-label="百褶裙工作台" onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();props.onPaint();}}}>
    <div className="skirt-native-toolbar"><span>百褶裙 / 原稿与立体</span><button onClick={props.onUndo} disabled={!props.canUndo}>撤销</button><button onClick={props.onRedo} disabled={!props.canRedo}>重做</button><button onClick={()=>downloadFile(serializeProject(props.project),`${props.project.name}.weave.json`,'application/json')}>保存完整原稿</button><button onClick={props.onPaint}>回到画板细绘</button></div>
    <div ref={host} className="skirt-native-content" inert={!ready}/>
    <div className="skirt-native-status" role="status" data-tip="原画板图层已同步；展开图为等比例正投影">{status}</div>
  </section>;
}

/** Native scissors, pens, stamps and fabrics feed the very same texture preview. */
export function PleatedSkirtLivePreview({project,onOpen}:{project:PapercutProject;onOpen:()=>void}){
  const canvas=useRef<HTMLCanvasElement>(null),preview=useRef<SkirtPreview|null>(null),[error,setError]=useState('');
  useEffect(()=>{try{preview.current=new SkirtPreview(canvas.current!);}catch(e){setError(String(e));}return()=>{preview.current?.dispose();preview.current=null;};},[]);
  useEffect(()=>{let cancelled=false;rasterizeSkirtOverlay(project).then(overlay=>{if(cancelled||!project.pleatedSkirt)return;const texture=document.createElement('canvas');texture.width=texture.height=1024;paintTexture(texture,project.pleatedSkirt,overlay);preview.current?.update(project.pleatedSkirt,texture);}).catch(e=>{if(!cancelled)setError(String(e));});return()=>{cancelled=true;};},[project]);
  return <aside className="skirt-live-preview" aria-label="画板实时裙子预览"><button onClick={onOpen} data-tip="上腰口 · 下裙摆 · 左右接后缝">百褶裙 · 参数与展开 ↗</button><canvas ref={canvas}/>{error&&<p>{error}</p>}</aside>;
}
