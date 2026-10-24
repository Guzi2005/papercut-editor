import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Parameters,CanvasView} from '../src/pleatedSkirt/model';
import {createDesign} from '../src/pleatedSkirt/model';
import {templateSVG} from '../src/pleatedSkirt/canvas';
import {layout,project,unproject,oppositeU,flatPoint,flatHit,flatUV,flatLayout,wrapU} from '../src/pleatedSkirt/projection';
import {mirrorGesture,mirrorNewMarks,splitSeamSpan} from '../src/pleatedSkirt/mirror';

const TAU=Math.PI*2;
const near=(actual:number,expected:number,tolerance=1e-7)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} is not near ${expected}`);
const params=(over:Partial<Parameters>={}):Parameters=>({...createDesign().parameters,...over});
const shortAngle=(a:number,b:number)=>{const d=Math.abs(a-b);return Math.min(d,Math.abs(d-1));};

function roundtrip(view:CanvasView,p:Parameters,u:number,v:number,turn=0){
 const xy=project([u,v],view,p,turn),hit=unproject(xy,view,p,turn);
 if(!hit)assert.fail(`${view} lost (${u}, ${v}) for ${JSON.stringify(p)}`);
 assert.ok(shortAngle(hit.uv[0],u)<=1e-7,`${view} u ${hit.uv[0]} != ${u}`);
 assert.ok(Math.abs(hit.uv[1]-v)<=1e-7,`${view} v ${hit.uv[1]} != ${v}`);

}

test('front and sector projections round trip for valid parameters, including hem<waist',()=>{
 const cases:Parameters[]=[
  params(),
  params({waist_cm:110,hem_cm:100,length_cm:40}),
  params({waist_cm:110,hem_cm:100,length_cm:120}),
  params({waist_cm:100,hem_cm:100,length_cm:88}),
  params({waist_cm:100,hem_cm:100.00001,length_cm:88}),
  params({waist_cm:100,hem_cm:99.99999,length_cm:88}),
  params({waist_cm:50,hem_cm:360,length_cm:40}),
  params({waist_cm:110,hem_cm:360,length_cm:120}),
 ];
 for(const p of cases){
  for(const u of [0,.1,.25,.4,.5,.6,.75,.9,1])for(const v of [0,.25,.5,.75,1])roundtrip('sector',p,u,v);
  for(const turn of [0,.125,.5,.97,-.3,1,2])for(const x of [0,.1,.5,.9,1])for(const v of [0,.5,1]){const uv=flatUV(x,v,turn),hit=flatHit(flatPoint(x,v,p),p,turn)!;assert.ok(hit);near(shortAngle(hit[0],uv[0]),0);near(hit[1],v);}
 }
});

test('ring is a top projection and round trips when waist and hem differ',()=>{
 for(const p of [params(),params({waist_cm:110,hem_cm:100}),params({waist_cm:50,hem_cm:360,length_cm:40})]){
  for(const u of [0,.1,.25,.5,.75,.9,1])for(const v of [0,.25,.5,.75,1])roundtrip('ring',p,u,v);
 }
 const equal=params({waist_cm:100,hem_cm:100,length_cm:88});
 const l=layout(equal,'ring'),waist=project([.5,0],'ring',equal),hem=project([.5,1],'ring',equal);
 assert.equal(l.cx,.5);assert.equal(l.cy,.5);
 near(Math.hypot(waist[0]-.5,waist[1]-.5),100/TAU*l.scale);
 near(Math.hypot(hem[0]-.5,hem[1]-.5),100/TAU*l.scale);
 for(const u of [0,.25,.5,.75,1]){
  const hit=unproject(project([u,0],'ring',equal),'ring',equal);
  if(!hit)assert.fail(`ring lost u=${u}`);assert.ok(shortAngle(hit.uv[0],u)<=1e-7);assert.equal(hit.uv[1],0);
 }
});

test('ring radius and scale come from circumference, not skirt length',()=>{
 const p=params({waist_cm:68,hem_cm:230,length_cm:88}),long=params({waist_cm:68,hem_cm:230,length_cm:120});
 const l=layout(p,'ring');
 assert.equal(layout(long,'ring').scale,l.scale);
 assert.deepEqual(project([.3,.4],'ring',long),project([.3,.4],'ring',p));
 const waist=project([.5,0],'ring',p),hem=project([.5,1],'ring',p);
 near(Math.hypot(waist[0]-.5,waist[1]-.5),68/TAU*l.scale);
 near(Math.hypot(hem[0]-.5,hem[1]-.5),230/TAU*l.scale);
});

test('equal waist/hem sector uses the stable rectangular cylinder limit',()=>{
 const p=params({waist_cm:100,hem_cm:100,length_cm:88}),l=layout(p,'sector');
 assert.equal(l.mode,'cylinder');assert.equal(l.sweep,0);assert.ok(Number.isFinite(l.scale));
 const top=project([.5,0],'sector',p),bottom=project([.5,1],'sector',p);
 const left=project([0,.5],'sector',p),right=project([1,.5],'sector',p);
 near(bottom[1]-top[1],88*l.scale);
 near(right[0]-left[0],100*l.scale);
 near((right[0]-left[0])/100,(bottom[1]-top[1])/88);
 for(const u of [0,.1,.5,.9,1])for(const v of [0,.25,.5,.75,1])roundtrip('sector',p,u,v);
});

test('near-equal sectors stay finite and close to the cylinder limit',()=>{
 const equal=params({waist_cm:100,hem_cm:100,length_cm:88}),nearEqual=params({waist_cm:100,hem_cm:100.00001,length_cm:88});
 const a=layout(equal,'sector'),b=layout(nearEqual,'sector');
 for(const value of Object.values(b))if(typeof value==='number')assert.ok(Number.isFinite(value));
 assert.equal(b.mode,'cylinder');
 assert.ok(Math.abs(a.scale-b.scale)<1e-9);
 const p1=project([.3,.7],'sector',equal),p2=project([.3,.7],'sector',nearEqual);
 assert.ok(Math.hypot(p1[0]-p2[0],p1[1]-p2[1])<1e-6);
 roundtrip('sector',nearEqual,.3,.7);
});

test('single flat silhouette retains one scale and reflect waist/2, hem/2 and length',()=>{
 for(const p of [params(),params({waist_cm:110,hem_cm:100}),params({waist_cm:100,hem_cm:100})]){
  const l=layout(p,'front'),waistLeft=project([.25,0],'front',p),waistRight=project([.75,0],'front',p);
  const hemLeft=project([.25,1],'front',p),hemRight=project([.75,1],'front',p);
  const top=project([.5,0],'front',p),bottom=project([.5,1],'front',p);
  near(waistRight[0]-waistLeft[0],p.waist_cm/2*l.scale);
  near(hemRight[0]-hemLeft[0],p.hem_cm/2*l.scale);
  near(bottom[1]-top[1],p.length_cm*l.scale);
  near((hemRight[0]-hemLeft[0])/(p.hem_cm/2),(bottom[1]-top[1])/p.length_cm);
 }
});

test('sector rejects the opposite side of an inverted cone',()=>{
 const p=params({waist_cm:110,hem_cm:100,length_cm:88}),l=layout(p,'sector');
 assert.equal(unproject([.5,l.cy+Math.abs(l.inner)*l.scale],'sector',p),null);
});

test('mirrored pen strokes split at the back seam and keep the source untouched',()=>{
 const d=createDesign();
 d.strokes=[{id:'stroke',color:'#c54d70',width:.009,points:[[.4,0],[.5,.5],[.6,1]]}];
 const before=structuredClone(d);
 const out=mirrorNewMarks(d,0,0);
 assert.deepEqual(d,before);
 assert.equal(out.strokes.length,3);
 for(const stroke of out.strokes.slice(1)){
  assert.ok(stroke.points.length>=2);
  for(const [u,v] of stroke.points){assert.ok(u>=0&&u<=1);assert.ok(v>=0&&v<=1);}
  for(let i=1;i<stroke.points.length;i++)assert.ok(Math.abs(stroke.points[i][0]-stroke.points[i-1][0])<=.500001);
 }
 const [first,second]=out.strokes.slice(1);
 near(first.points.at(-1)![0],0);near(second.points[0][0],1);
 near(first.points[0][0],oppositeU(.4));near(second.points.at(-1)![0],oppositeU(.6));
});

test('mirrored patches split into contiguous UV pieces instead of spanning the front',()=>{
 const d=createDesign();
 d.patches=[{id:'patch',u0:.35,u1:.6,v0:.2,v1:.8,color:'#c54d70',pattern:'solid',repeat:32}];
 const out=mirrorNewMarks(d,0,0),mirrored=out.patches.slice(1);
 assert.equal(mirrored.length,2);
 near(mirrored[0].u0,.9);near(mirrored[0].u1,1);
 near(mirrored[1].u0,0);near(mirrored[1].u1,.15);
 near(mirrored[0].u1,1);near(mirrored[1].u0,0);
 for(const patch of mirrored){assert.ok(patch.u1-patch.u0<=.5+1e-9);assert.equal(patch.v0,.2);assert.equal(patch.v1,.8);}
});

test('mirrored patches stay whole when they do not cross the seam',()=>{
 const d=createDesign();
 d.patches=[{id:'patch',u0:.8,u1:.9,v0:.2,v1:.8,color:'#c54d70',pattern:'solid',repeat:32}];
 const mirrored=mirrorNewMarks(d,0,0).patches.slice(1);
 assert.equal(mirrored.length,1);
 near(mirrored[0].u0,.6);near(mirrored[0].u1,.7);
});

test('seam spans split at the back seam and keep drag pieces contiguous',()=>{
 const forward=splitSeamSpan(.95,1.05),backward=splitSeamSpan(.05,-.05),front=splitSeamSpan(.05,.95);
 assert.equal(forward.length,2);near(forward[0][0],.95);near(forward[0][1],1);near(forward[1][0],0);near(forward[1][1],.05);
 assert.equal(backward.length,2);near(backward[0][0],.95);near(backward[0][1],1);near(backward[1][0],0);near(backward[1][1],.05);
 assert.equal(front.length,1);near(front[0][0],.05);near(front[0][1],.95);
 assert.deepEqual(splitSeamSpan(.5,.5),[]);
});

test('only a live drawing gesture mirrors a draft',()=>{
 const d=createDesign();
 d.canvas_view='front';
 d.strokes=[{id:'stroke',color:'#c54d70',width:.009,points:[[.4,0],[.45,1]]}];
 assert.equal(mirrorGesture(d,true,false,0,0),d);
 assert.equal(mirrorGesture(d,false,true,0,0),d);
 assert.equal(mirrorGesture({...d,canvas_view:'sector'},true,true,0,0).strokes.length,1);
 assert.equal(mirrorGesture(d,true,true,0,0).strokes.length,2);
});

test('turns wrap continuously and flips do not alter the flat silhouette',()=>{
 const p=params();
 for(const turn of [-2,-.501,-.001,0,.499,.5,.999,1,3])for(const x of [.1,.5,.9]){
  const point=flatPoint(x,.6,p),a=flatHit(point,p,turn)!,full=flatHit(point,p,turn+1)!,flip=flatHit(point,p,turn+.5)!;
  near(shortAngle(a[0],full[0]),0);near(shortAngle(wrapU(a[0]+.5),flip[0]),0);near(a[1],flip[1]);
 }
 const left=flatHit(flatPoint(.499,.6,p),p,.5)!,right=flatHit(flatPoint(.501,.6,p),p,.5)!;
 assert.ok(left[0]>.99&&right[0]<.01,'back seam travels through center without a gap');
 assert.equal(flatHit([0,0],p,.5),null);
});

test('flat SVG exports one stationary silhouette',()=>{
 const d=createDesign(),svg=templateSVG(d,'front');
 assert.equal((svg.match(/<polygon/g)||[]).length,1);
 assert.ok(!svg.includes('rotate('));
 assert.ok(svg.includes(flatPoint(0,0,d.parameters).map(v=>(v*1000).toFixed(2)).join(',')));
});
