import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';

export const digest=(svg,source)=>createHash('sha256').update(svg).update('\0').update(source||'').digest('hex');
const svgHash=svg=>digest(svg,'');
const optional=async file=>{try{return await fs.readFile(file,'utf8');}catch(e){if(e.code==='ENOENT')return '';throw e;}};
const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]+$/.test(id);
export function inside(root,relative) {
  if(typeof relative!=='string'||!relative||path.isAbsolute(relative))throw new Error('资产路径必须相对于项目根目录');
  const full=path.resolve(root,relative),rel=path.relative(root,full);
  if(!rel||rel==='..'||rel.startsWith('..'+path.sep))throw new Error('资产路径不能离开项目目录');
  return full;
}
async function noSymlinkEscape(root,file) {
  const realRoot=await fs.realpath(root);let parent=file;
  while(true){try{const real=await fs.realpath(parent),rel=path.relative(realRoot,real);if(rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel))throw new Error('资产链接指向项目目录之外');return;}catch(e){if(e.code!=='ENOENT')throw e;parent=path.dirname(parent);}}
}
export async function loadProject(configFile) {
  const config=JSON.parse(await fs.readFile(configFile,'utf8'));
  if(config.version!==1||!validId(config.id)||!config.name||!Array.isArray(config.assets))throw new Error('项目配置格式无效');
  const root=await fs.realpath(path.resolve(path.dirname(configFile),config.root||'.'));
  const ids=new Set(),paths=new Set();
  for(const a of config.assets){
    if(!validId(a.id)||ids.has(a.id)||!a.name||!a.documentId||![a.width,a.height].every(n=>Number.isInteger(n)&&n>0&&n<=8192)||a.width*a.height>32000000)throw new Error('资产标识或尺寸无效');
    ids.add(a.id);
    if(!a.source.endsWith('.weave.json')||!a.svg.endsWith('.svg'))throw new Error('资产必须指定 .weave.json 和 .svg 文件');
    for(const rel of [a.source,a.svg]){const file=inside(root,rel);if(paths.has(file.toLowerCase()))throw new Error('两个资产不能写入同一文件');paths.add(file.toLowerCase());await noSymlinkEscape(root,file);}
  }
  if(config.previewScene && (!/^res:\/\/.+\.tscn$/.test(config.previewScene)||config.previewScene.includes('..')))throw new Error('预览场景路径无效');
  return {...config,root};
}
export function validatePayload(body,asset) {
  const doc=JSON.parse(body.source),p=doc.project,svg=body.svg;
  if(doc.format!=='weave-papercut'||p?.id!==asset.documentId||p.width!==asset.width||p.height!==asset.height||!p.layers||!Array.isArray(p.rootOrder))throw new Error(`文档必须对应 ${asset.name}（${asset.width} × ${asset.height}）`);
  if(typeof svg!=='string'||!svg.startsWith('<svg ')||!svg.trimEnd().endsWith('</svg>')||!svg.includes(`viewBox="0 0 ${asset.width} ${asset.height}"`))throw new Error('SVG 尺寸或格式不正确');
  if(/<(?:script|foreignObject|image)\b|\bon\w+\s*=|(?:href|src)\s*=\s*["'](?!#)|url\(\s*["']?(?!#)[^)]|<!DOCTYPE|<!ENTITY/i.test(svg))throw new Error('SVG 不能包含脚本或外部引用');
  doc.weaveBridge={svgHash:svgHash(svg)};
  return {svg,source:JSON.stringify(doc,null,1)};
}
export function projectBridge(options={}) {
  const files=options.configFiles || (process.env.WEAVE_PROJECT_CONFIGS?JSON.parse(process.env.WEAVE_PROJECT_CONFIGS):process.env.AIRSWIPER_PROJECT?[path.join(process.env.AIRSWIPER_PROJECT,'weave.project.json')]:[]);
  if(!files.length)return {name:'weave-project-bridge-disabled'};
  const token=randomBytes(24).toString('hex');let projectsPromise,locked=false;
  const previews=new Map();
  const projects=()=>projectsPromise??=Promise.all(files.map(loadProject)).then(ps=>{if(new Set(ps.map(p=>p.id)).size!==ps.length)throw new Error('项目 ID 必须唯一');return ps;});
  const read=async(p,a)=>{
    for(const rel of [a.svg,a.source])await noSymlinkEscape(p.root,inside(p.root,rel));
    const [svg,source]=await Promise.all([optional(inside(p.root,a.svg)),optional(inside(p.root,a.source))]);
    const recorded=source?JSON.parse(source).weaveBridge?.svgHash:null;
    return {svg,source,revision:digest(svg,source),externalSvgChanged:!!recorded&&recorded!==svgHash(svg)};
  };
  const history=(p,a)=>inside(p.root,`.weave-history/${a.id}`);
  const commit=async(p,a,next,old)=>{
    const dir=history(p,a);await noSymlinkEscape(p.root,dir);await fs.mkdir(dir,{recursive:true});
    await fs.writeFile(path.join(p.root,'.weave-history/.gdignore'),'');
    await fs.writeFile(path.join(dir,`${Date.now()}-${randomBytes(3).toString('hex')}.json`),JSON.stringify(old));
    const svg=inside(p.root,a.svg),source=inside(p.root,a.source);
    for(const f of [svg,source]){await noSymlinkEscape(p.root,f);await fs.mkdir(path.dirname(f),{recursive:true});}
    const put=async(file,data)=>{if(data){await fs.writeFile(file+'.tmp',data,'utf8');await fs.rename(file+'.tmp',file);}else await fs.rm(file,{force:true});};
    try{await put(source,next.source);await put(svg,next.svg);}catch(e){await put(source,old.source);await put(svg,old.svg);throw e;}
    await fs.writeFile(path.join(dir,'previous.json'),JSON.stringify(old));
    return {revision:digest(next.svg,next.source)};
  };
  return {name:'weave-project-bridge',configureServer(server){
    server.middlewares.use(async(req,res,next)=>{
      const url=new URL(req.url||'/','http://localhost');if(!url.pathname.startsWith('/__weave/'))return next();
      const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
      const host=req.headers.host||'';
      if(!/^127\.0\.0\.1:\d+$/.test(host)||(req.headers.origin&&req.headers.origin!==`http://${host}`))return send(403,{error:'仅允许本机同源连接'});
      try{
        const ps=await projects();
        if(req.method==='GET'&&url.pathname==='/__weave/status')return send(200,{version:1,token,configFiles:files.map(f=>path.resolve(f)),projects:ps.map(p=>({id:p.id,name:p.name,preview:!!p.previewScene,assets:p.assets}))});
        if(!['GET','POST'].includes(req.method))return send(405,{error:'不支持的操作'});
        let body={};
        if(req.method==='POST'){
          if(req.headers['x-art-token']!==token)return send(403,{error:'连接已更新，请刷新页面'});
          let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>12*1024*1024)throw new Error('文件超过 12 MB');chunks.push(chunk);}body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
        }
        const p=ps.find(p=>p.id===(body.projectId||url.searchParams.get('project')));
        const a=p?.assets.find(a=>a.id===(body.assetId||url.searchParams.get('asset')));
        if(!p||!a)return send(404,{error:'未配置的项目或资产'});
        if(req.method==='GET'&&url.pathname==='/__weave/asset')return send(200,await read(p,a));
        if(req.method!=='POST')return send(405,{error:'不支持的操作'});
        if(locked)return send(409,{error:'正在保存另一份资产，请稍后重试'});locked=true;
        try{
          if(url.pathname==='/__weave/preview'){
            if(!p.previewScene)throw new Error('此项目未设置 Godot 预览场景');
            const old=previews.get(p.id);if(old&&old.exitCode===null&&!old.killed)return send(200,{running:true});
            const exe=options.godot||process.env.WEAVE_GODOT||process.env.AIRSWIPER_GODOT;if(!exe)throw new Error('启动时请指定 Godot 路径');await fs.access(exe);
            const runtime=inside(p.root,'.weave-history/preview-runtime');await noSymlinkEscape(p.root,runtime);await fs.mkdir(runtime,{recursive:true});
            await fs.writeFile(path.join(p.root,'.weave-history/.gdignore'),'');
            const child=spawn(exe,['--path',p.root,'--windowed','--resolution','1280x720',p.previewScene,'--','--test','--art-preview'],{windowsHide:true,stdio:'ignore',env:{...process.env,APPDATA:runtime,LOCALAPPDATA:runtime}});
            await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});previews.set(p.id,child);child.once('exit',()=>previews.delete(p.id));return send(200,{running:true});
          }
          const old=await read(p,a);if(body.revision!==old.revision)return send(409,{error:'磁盘版本已变化；请重新打开资产。当前改稿保留在文档中。'});
          if(url.pathname==='/__weave/apply')return send(200,await commit(p,a,validatePayload(body,a),old));
          if(url.pathname==='/__weave/restore'){
            const file=path.join(history(p,a),'previous.json');await noSymlinkEscape(p.root,file);
            const previous=await optional(file);if(!previous)throw new Error('没有可撤回的应用记录');return send(200,await commit(p,a,JSON.parse(previous),old));
          }
          send(404,{error:'不存在的操作'});
        }finally{locked=false;}
      }catch(e){send(400,{error:e.message});}
    });
  }};
}
