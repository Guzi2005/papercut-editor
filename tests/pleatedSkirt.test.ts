import {test} from 'node:test';
import assert from 'node:assert/strict';
import {uvToCanvas,canvasToUV,buildMesh,surfacePoint} from '../src/pleatedSkirt/geometry';
import {createDesign,parseDesign} from '../src/pleatedSkirt/model';
import {createSkirtProject,withSkirtGuide} from '../src/pleatedSkirt/project';
import {serializeProject,parseProjectFile} from '../src/utils/storage';

test('half-ring is concentric and isotropic, with equal radial depth everywhere',()=>{
  for(const v of [0,.25,.5,1]){const radii=[];for(let i=0;i<=100;i++){const u=i/100,[x,y]=uvToCanvas([u,v],'sector');radii.push(Math.hypot(x-.5,y-.285));const back=canvasToUV([x,y],'sector')!;assert.ok(Math.abs(back[0]-u)<1e-8&&Math.abs(back[1]-v)<1e-8);}assert.ok(Math.max(...radii)-Math.min(...radii)<1e-10);const ring=uvToCanvas([.23,v],'ring');assert.ok(Math.abs(radii[0]-Math.hypot(ring[0]-.5,ring[1]-.5))<1e-10);}
});
test('native weave file retains garment identity, item membership, vector art and source',()=>{
  const p=createSkirtProject();const d=p.pleatedSkirt!;p.layers[d.component_id].drawings=[{id:'drawing',d:'M12 13 L30 40',brushType:'pen',color:'#123456',opacity:.6,strokeWidth:9}];
  const back=parseProjectFile(serializeProject(p));assert.deepEqual(back.pleatedSkirt,d);assert.deepEqual(back.layers[d.component_id].drawings,p.layers[d.component_id].drawings);assert.equal(back.items![0].partIds[0],d.component_id);
  const invalid=JSON.parse(serializeProject(p));invalid.project.pleatedSkirt.parameters.pleat_count=10000;assert.throws(()=>parseProjectFile(JSON.stringify(invalid)));
});
test('old documents stay optional and unknown design fields are not silently lost',()=>{
  const p=createSkirtProject();delete p.pleatedSkirt;assert.equal(parseProjectFile(serializeProject(p)).pleatedSkirt,undefined);
  assert.throws(()=>parseDesign({...createDesign(),unsupported_splice:{}}));
});
test('shared 3D mesh has outward surface normals and the requested thickness',()=>{
  const p=createDesign().parameters,m=buildMesh(p),shell=(p.pleat_count*8+1)*25;for(let i=0;i<shell;i+=13){const at=i*3,inside=(i+shell)*3;assert.ok(m.positions[at]*m.normals[at]+m.positions[at+2]*m.normals[at+2]>0);assert.ok(Math.abs(Math.hypot(...[0,1,2].map(k=>m.positions[at+k]-m.positions[inside+k]))-p.thickness_mm/1000)<1e-6);}
});

test('length and hem size change the silhouette independently while retaining waist and artwork',()=>{
  const design=createDesign(),p=design.parameters;
  const short={...p,length_cm:40},long={...p,length_cm:120},narrow={...p,hem_cm:100},wide={...p,hem_cm:360};
  for(const u of [0,.17,.5,.83,1]){
    assert.deepEqual(surfacePoint(short,u,1),surfacePoint(long,u,1));
    assert.ok(Math.abs(surfacePoint(long,u,0)[1]-surfacePoint(short,u,0)[1]-.8)<1e-10);
    assert.deepEqual(surfacePoint(narrow,u,0),surfacePoint(wide,u,0));
    const a=surfacePoint(narrow,u,1),b=surfacePoint(wide,u,1);
    assert.ok(Math.hypot(b[0],b[2])>Math.hypot(a[0],a[2]));
  }
  const original=structuredClone(design);buildMesh({...wide,length_cm:120});assert.deepEqual(design,original);
});

test('returning to native painting preserves user reference photos and generated guide placement',()=>{
  const p=createSkirtProject();p.reference={src:'data:image/png;base64,user',opacity:.3,visible:false,onTop:true,x:12,y:34,width:80,height:90};
  assert.equal(withSkirtGuide(p,'new-guide'),p);
  delete p.reference;const first=withSkirtGuide(p,'first-guide');first.reference!.x=17;first.reference!.opacity=.5;
  const restored=parseProjectFile(serializeProject(first));const updated=withSkirtGuide(restored,'new-guide');
  assert.equal(updated.reference!.src,'new-guide');assert.equal(updated.reference!.x,17);assert.equal(updated.reference!.opacity,.5);
});
