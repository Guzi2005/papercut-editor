import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SkirtPreview} from '../src/pleatedSkirt/preview';

test('failed avatar loading retries in place and removes its recovery control',async()=>{
  const originalFetch=globalThis.fetch,originalDocument=globalThis.document;
  let fail=true,calls=0,removed=0,uploads=0;
  const buttons:any[]=[];
  globalThis.fetch=async(input)=>{
    calls++;
    if(fail)throw new TypeError('Failed to fetch');
    const name=String(input).split('/').pop()!;
    return new Response(readFileSync(new URL(`../public/pleated-avatar/${name}`,import.meta.url)));
  };
  globalThis.document={createElement:()=>({addEventListener(){},remove(){removed++;}})} as any;
  const preview=Object.assign(Object.create(SkirtPreview.prototype),{
    disposed:false,avatarLoading:false,events:new AbortController(),
    canvas:{dataset:{},parentElement:{append(b:any){buttons.push(b);}},dispatchEvent(){}},
    upload(){uploads++;return {};},release(){},bindGarment(){},pose(){},draw(){},schedule(){},
  });
  const settle=async()=>{for(let i=0;i<30&&preview.avatarLoading;i++)await new Promise(r=>setImmediate(r));assert.equal(preview.avatarLoading,false);};
  try{
    preview.retryAvatar();preview.retryAvatar();await settle();
    assert.equal(calls,2,'concurrent retry must not duplicate the two asset requests');
    assert.equal(preview.canvas.dataset.avatar,'error');assert.equal(buttons.length,1);
    fail=false;preview.retryAvatar();await settle();
    assert.equal(preview.canvas.dataset.avatar,'ready');assert.equal(uploads,1);assert.equal(removed,1);
    preview.retryAvatar();assert.equal(calls,4,'ready preview must not re-upload the model');
    preview.avatar=undefined;preview.disposed=true;preview.retryAvatar();assert.equal(calls,4);
  }finally{globalThis.fetch=originalFetch;globalThis.document=originalDocument;preview.events.abort();}
});
