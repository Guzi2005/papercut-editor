import React,{useEffect,useRef,useState} from 'react';
import type {PapercutProject} from '../types/papercut';
import {parseProjectFile,serializeProject} from '../utils/storage';
import {createBlankCanvas} from '../utils/presetTemplates';
import {exportStreet as exportVectorAsset} from '../utils/exportStreet';
import {importVectorAsset,type VectorAsset} from '../utils/importVectorAsset';
import {importStreet} from '../utils/importStreet';
type Asset=VectorAsset & {source:string;svg:string};
type Project={id:string;name:string;assets:Asset[];preview:boolean};
type Binding={projectId:string;assetId:string;revision:string};
export function ProjectAssetBridge({project,documentId,onOpen}:{project:PapercutProject;documentId:string;onOpen:(p:PapercutProject)=>string}){
  const [projects,setProjects]=useState<Project[]>([]),[projectId,setProjectId]=useState(''),[assetId,setAssetId]=useState('');
  const [bindings,setBindings]=useState<Record<string,Binding>>({}),[token,setToken]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('选择项目与资产，打开后编辑；应用时写回项目并备份。');
  const running=useRef(false);
  useEffect(()=>{const c=new AbortController();fetch('/__weave/status',{signal:c.signal}).then(r=>r.ok?r.json():null).then(d=>{if(d?.version===1){setProjects(d.projects);setToken(d.token);setProjectId(d.projects[0]?.id||'');setAssetId(d.projects[0]?.assets[0]?.id||'');}}).catch(()=>{});return()=>c.abort();},[]);
  const selected=projects.find(p=>p.id===projectId),asset=selected?.assets.find(a=>a.id===assetId),binding=bindings[documentId];
  const eligible=!!asset&&binding?.projectId===projectId&&binding.assetId===assetId;
  if(!projects.length)return null;
  const run=async(fn:()=>Promise<void>)=>{if(running.current)return;running.current=true;setBusy(true);try{await fn();}catch(e){setMessage(e instanceof Error?e.message:String(e));}finally{running.current=false;setBusy(false);}};
  const request=async(route:string,body?:object)=>{const r=await fetch(`/__weave/${route}?project=${encodeURIComponent(projectId)}&asset=${encodeURIComponent(assetId)}`,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-Art-Token':token},body:JSON.stringify({...body,projectId,assetId})});const d=await r.json();if(!r.ok)throw new Error(d.error||'连接失败');return d;};
  const open=async(fromSvg=false)=>{
    if(!asset)return;const d=await request('asset');
    if(d.externalSvgChanged&&!fromSvg)throw new Error('磁盘 SVG 在外部被修改。可点击“重新导入 SVG”建立新稿；旧文档不会丢失。');
    let p:PapercutProject;
    if(d.source&&!fromSvg)p=parseProjectFile(d.source);
    else if(d.svg)p=asset.importer==='airswiper-street'&&!fromSvg?importStreet(d.svg):importVectorAsset(d.svg,asset);
    else p=createBlankCanvas({name:asset.name,width:asset.width,height:asset.height,mode:'create'});
    if(p.width!==asset.width||p.height!==asset.height)throw new Error('原稿尺寸与资产配置不一致，请检查项目配置。');
    p={...p,id:asset.documentId};
    const id=onOpen(p);setBindings(b=>({...b,[id]:{projectId,assetId,revision:d.revision}}));setMessage(`已打开 ${asset.name} · ${Object.keys(p.layers).length} 个图层`);
  };
  const apply=async()=>{if(!eligible||!binding||!asset)return;const d=await request('apply',{revision:binding.revision,source:serializeProject(project),svg:exportVectorAsset(project)});setBindings(b=>({...b,[documentId]:{...binding,revision:d.revision}}));setMessage(`已应用 ${asset.name}，修改前版本已备份。`);};
  const style={padding:'5px 9px',borderRadius:6,border:'1px solid #9ba997',background:'#fff8dd',color:'#233c37'};
  return <section aria-label="项目资产连接" style={{flexShrink:0,display:'flex',alignItems:'center',gap:7,padding:'6px 12px',background:'#e2e7cf',color:'#233c37',fontSize:12,flexWrap:'wrap'}}>
    <strong>项目资产</strong>
    <select aria-label="连接项目" style={style} disabled={busy} value={projectId} onChange={e=>{setProjectId(e.target.value);setAssetId(projects.find(p=>p.id===e.target.value)?.assets[0]?.id||'');}}>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
    <select aria-label="连接资产" style={style} disabled={busy} value={assetId} onChange={e=>setAssetId(e.target.value)}>{selected?.assets.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select>
    <button style={style} disabled={busy||!asset} onClick={()=>run(()=>open())}>打开资产</button>
    <button style={style} disabled={busy||!eligible} onClick={()=>run(apply)}>应用到项目</button>
    <button style={style} disabled={busy||!selected?.preview||!asset} onClick={()=>run(async()=>{await request('preview',{});setMessage('已启动独立存档目录的 Godot 预览。');})}>运行预览</button>
    <button style={style} disabled={busy||!eligible} onClick={()=>run(async()=>{await request('restore',{revision:binding.revision});await open();setMessage('已撤回上次应用；恢复的版本已另开文档。');})}>撤回应用</button>
    <button style={style} disabled={busy||!asset} title="从磁盘 SVG 创建新的可编辑文档，原文档保留；应用时才会写回" onClick={()=>run(()=>open(true))}>重新导入 SVG</button>
    <span role="status">{busy?'正在处理…':message}</span>
  </section>;
}
