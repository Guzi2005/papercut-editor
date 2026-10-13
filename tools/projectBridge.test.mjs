import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {projectBridge,loadProject,validatePayload} from './projectBridge.mjs';

const asset={id:'scene',name:'Scene',documentId:'scene_doc',width:320,height:180,source:'art/scene.weave.json',svg:'assets/scene.svg'};
const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><path fill="#fa0" d="M0 0L30 30Z"/></svg>';
const source=JSON.stringify({format:'weave-papercut',version:1,project:{id:asset.documentId,width:320,height:180,layers:{},groups:[],rootOrder:[],items:[]}});

test('configured dimensions and passive SVG only',()=>{
  assert.equal(validatePayload({source,svg},asset).svg,svg);
  assert.throws(()=>validatePayload({source,svg}, {...asset,width:100}));
  for(const bad of ['<script/>','<image href="http://example.com/a"/>','<path onclick="x()"/>','<use href="file:///private"/>'])assert.throws(()=>validatePayload({source,svg:svg.replace('</svg>',bad+'</svg>')},asset));
});

test('two projects: isolated apply, revision conflict, external SVG detection and paired restore',async()=>{
  const baseDir=await fs.mkdtemp(path.join(os.tmpdir(),'weave-project-test-'));
  let server;
  try{
    const files=[];
    for(const id of ['first','second']){
      const root=path.join(baseDir,id);await fs.mkdir(root);
      const file=path.join(root,'weave.project.json');
      await fs.writeFile(file,JSON.stringify({version:1,id,name:id,assets:[asset]}));files.push(file);
    }
    let handler;projectBridge({configFiles:files}).configureServer({middlewares:{use:h=>handler=h}});
    server=http.createServer((req,res)=>handler(req,res,()=>{res.writeHead(404);res.end();}));
    await new Promise(r=>server.listen(0,'127.0.0.1',r));
    const base=`http://127.0.0.1:${server.address().port}/__weave/`;
    const status=await(await fetch(base+'status')).json();assert.deepEqual(status.projects.map(p=>p.id),['first','second']);
    assert.deepEqual(status.configFiles,files);
    const read=async id=>await(await fetch(base+`asset?project=${id}&asset=scene`)).json();
    const post=(route,id,data,headers={})=>fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json','X-Art-Token':status.token,...headers},body:JSON.stringify({projectId:id,assetId:'scene',...data})});
    const empty=await read('second');assert.equal(empty.svg,'');assert.equal(empty.source,'');
    assert.equal((await post('apply','second',{source,svg,revision:empty.revision},{Origin:'https://example.com'})).status,403);
    assert.equal((await post('apply','second',{source,svg,revision:empty.revision},{'X-Art-Token':'no'})).status,403);
    assert.equal((await post('apply','missing',{source,svg,revision:empty.revision})).status,404);
    let r=await post('apply','second',{source,svg,revision:empty.revision});assert.equal(r.status,200,await r.text());
    const saved=await read('second');assert.equal(saved.svg,svg);assert.equal(saved.externalSvgChanged,false);
    assert.equal((await read('first')).source,'');assert.equal((await read('first')).svg,'');
    assert.equal((await post('apply','second',{source,svg,revision:empty.revision})).status,409);
    const changed=svg.replace('#fa0','#f00');
    await fs.writeFile(path.join(baseDir,'second',asset.svg),changed);
    const external=await read('second');assert.equal(external.externalSvgChanged,true);
    assert.equal((await post('apply','second',{source,svg,revision:saved.revision})).status,409);
    r=await post('apply','second',{source,svg:changed,revision:external.revision});assert.equal(r.status,200);
    const current=await read('second');assert.equal(current.externalSvgChanged,false);
    r=await post('restore','second',{revision:current.revision});assert.equal(r.status,200);
    const restored=await read('second');assert.equal(restored.svg,external.svg);assert.equal(restored.source,external.source);
    await fs.access(path.join(baseDir,'second','.weave-history/.gdignore'));
    const first=await read('first');r=await post('apply','first',{source,svg,revision:first.revision});assert.equal(r.status,200);
    r=await post('restore','first',{revision:(await read('first')).revision});assert.equal(r.status,200);
    assert.equal((await read('first')).source,'');assert.equal((await read('first')).svg,'');
  }finally{
    if(server)await new Promise(r=>server.close(r));
    await fs.rm(baseDir,{recursive:true,force:true});
  }
});

test('configuration rejects escaping and overlapping asset paths',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'weave-config-test-'));
  try{
    const file=path.join(root,'weave.project.json');
    for(const assets of [[{...asset,svg:'../outside.svg'}],[asset,{...asset,id:'other'}],[asset,asset]]){
      await fs.writeFile(file,JSON.stringify({version:1,id:'test',name:'Test',assets}));
      await assert.rejects(()=>loadProject(file));
    }
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
