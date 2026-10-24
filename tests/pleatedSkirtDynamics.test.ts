import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {SkirtInertia,naturalEnvelope,restOpening} from '../src/pleatedSkirt/skirtDynamics';import {graspSkirt} from '../src/pleatedSkirt/grasp';
import {createDesign,parseDesign,type Silhouette} from '../src/pleatedSkirt/model';import {defaultMotionOptions,moveArm} from '../src/pleatedSkirt/motion';
import {buildMesh} from '../src/pleatedSkirt/geometry';import {GarmentBinding} from '../src/pleatedSkirt/avatar';import {DrapeConstraint} from '../src/pleatedSkirt/drapeConstraint';
import {effectiveDrape} from '../src/pleatedSkirt/drape';
import {effectiveShape,shapeControls,setShapeParameter,type HemShape} from '../src/pleatedSkirt/shape';
const manifest=JSON.parse(readFileSync('public/pleated-avatar/manifest.json','utf8'));
function fixture(shape:Silhouette='relaxed',length=88,hem=230){const d=createDesign();d.silhouette=shape;d.parameters.length_cm=length;d.parameters.hem_cm=hem;const mesh=buildMesh(d.parameters),binding=new GarmentBinding(mesh,manifest.cage,length);binding.deform(new Float32Array(manifest.cage.restPositions));const rest=binding.positions.slice(),constraint=new DrapeConstraint(mesh,rest),width=d.parameters.pleat_count*8+1;naturalEnvelope(binding.positions,rest,d,width);constraint.projectLengths(binding.positions);return {d,rest,constraint,width,natural:binding.positions.slice()};}
test('silhouettes persist while legacy documents remain without an injected field',()=>{const legacy=createDesign();assert.equal(Object.hasOwn(parseDesign(legacy),'silhouette'),false);for(const silhouette of ['relaxed','a_line','bell','trumpet'] as Silhouette[])assert.equal(parseDesign({...legacy,silhouette}).silhouette,silhouette);assert.throws(()=>parseDesign({...legacy,silhouette:'other'}));});
test('inertia is timestep independent, lags on acceleration and continues responding during deceleration',()=>{const d=createDesign(),motion={...defaultMotionOptions,speed:.7,uniformity:0};const direct=new SkirtInertia().sample(3,d,motion),stepped=new SkirtInertia();for(let i=0;i<=90;i++)stepped.sample(i/30,d,motion);assert.equal(direct.angle,stepped.angle);assert.deepEqual(direct.lag,stepped.lag);assert.deepEqual(direct.opening,stepped.opening);const samples:{lag:number;omega:number;open:number}[]=[];for(let i=0;i<100;i++){stepped.sample(i/20,d,motion);samples.push({lag:stepped.lag[24],omega:stepped.omega,open:stepped.opening[24]});}assert.ok(samples.some(x=>x.lag<-.05));assert.ok(samples.some(x=>x.lag>.02));assert.ok(samples.some((x,i)=>i&&x.omega<samples[i-1].omega&&x.open>samples[i-1].open));});
test('all resting silhouettes spread under spin while keeping longitudinal material length',()=>{const shapes=[];for(const shape of ['relaxed','a_line','bell','trumpet'] as Silhouette[]){const {d,rest,constraint,width,natural}=fixture(shape),spin=rest.slice(),inertia=new SkirtInertia().sample(3,d,{...defaultMotionOptions,speed:1,uniformity:1});naturalEnvelope(spin,rest,d,width,inertia);constraint.projectLengths(spin);const radius=(p:Float32Array)=>{let r=0;for(let c=0;c<width-1;c++){const a=(24*width+c)*3;r+=Math.hypot(p[a],p[a+2])/(width-1);}return r;};assert.ok(radius(spin)>radius(natural)+.02,shape);assert.ok(constraint.maxWarpError(spin)<1e-4);shapes.push(radius(natural));}assert.ok(new Set(shapes.map(x=>x.toFixed(3))).size===4);});
test('hands reach still fabric before lifting; held contacts coincide and lengths survive release',()=>{for(const length of [40,88,120]){const {natural,width,constraint}=fixture('relaxed',length);for(const t of [0,.1,.18,.21]){const p=natural.slice();graspSkirt(p,natural,width,t,defaultMotionOptions);assert.deepEqual(p,natural);}for(const t of [.3,.5,.64,.7,.8,1]){const p=natural.slice(),hands=graspSkirt(p,natural,width,t,defaultMotionOptions);assert.ok(constraint.maxWarpError(p)<1e-4,`length ${length} t ${t}: ${constraint.maxWarpError(p)}`);assert.ok(p.every(Number.isFinite));for(const h of hands)if(h.contact){const a=(h.row*width+h.column)*3;assert.deepEqual(h.target,Array.from(p.subarray(a,a+3)));}if(t===1)assert.ok(p.every((x,i)=>Math.abs(x-natural[i])<1e-5));}}});


test('shape settings roundtrip strictly and switching profiles preserves their independent values',()=>{
 const d=createDesign();assert.equal(Object.hasOwn(parseDesign(d),'shape'),false);
 setShapeParameter(d,'bell','volume',.8);setShapeParameter(d,'trumpet','flare_start',.7);
 d.shape!.hem={mode:'deep',ratio:.45};
 const roundtrip=parseDesign(JSON.parse(JSON.stringify(d)));
 assert.deepEqual(roundtrip,d);assert.equal(roundtrip.shape!.bell.volume,.8);
 for(const mutate of [(s:any)=>s.extra=0,(s:any)=>delete s.bell,(s:any)=>s.bell.peak=1,
  (s:any)=>s.relaxed.fullness=NaN,(s:any)=>s.trumpet.fit='0.5',(s:any)=>s.hem.mode='bad',
  (s:any)=>s.hem.ratio=.1,(s:any)=>delete s.hem.ratio]){
  const bad=structuredClone(d);mutate(bad.shape);assert.throws(()=>parseDesign(bad));
 }
});
test('every silhouette parameter changes its resting profile',()=>{
 for(const profile of Object.keys(shapeControls) as Silhouette[])for(const control of shapeControls[profile]){
  const d=createDesign();d.silhouette=profile;
  setShapeParameter(d,profile,control.key,control.min);
  const lo=Array.from({length:24},(_,i)=>restOpening(d,(i+1)/24));
  setShapeParameter(d,profile,control.key,control.max);
  const hi=Array.from({length:24},(_,i)=>restOpening(d,(i+1)/24));
  assert.ok(lo.some((v,i)=>Math.abs(v-hi[i])>.03),`${profile}.${control.key} has no effect`);
 }
});
test('elliptical hems keep the waist and material lengths, and round out when spinning',()=>{
 for(const mode of ['circle','wide','deep'] as HemShape[])for(const shape of ['relaxed','a_line','bell','trumpet'] as Silhouette[]){
  const {d,rest,width,constraint}=fixture(shape);d.shape=effectiveShape(d);d.shape.hem={mode,ratio:.45};
  const natural=rest.slice();naturalEnvelope(natural,rest,d,width);constraint.projectLengths(natural);
  const spinning=rest.slice(),inertia=new SkirtInertia().sample(4,d,{...defaultMotionOptions,speed:1.5,uniformity:1});
  naturalEnvelope(spinning,rest,d,width,inertia);constraint.projectLengths(spinning);
  for(const p of [natural,spinning]){assert.deepEqual(p.subarray(0,width*3),rest.subarray(0,width*3));assert.ok(p.every(Number.isFinite));assert.ok(constraint.maxWarpError(p)<1e-4);}
  const axes=(p:Float32Array,lag=0)=>{let xx=0,zz=0;for(let c=0;c<width-1;c++){const a=(24*width+c)*3,x=p[a]*Math.cos(lag)-p[a+2]*Math.sin(lag),z=p[a]*Math.sin(lag)+p[a+2]*Math.cos(lag);xx+=x*x;zz+=z*z;}return Math.sqrt(xx/zz);};
  const ratio=axes(natural),spun=axes(spinning,inertia.lag[24]);
  if(mode==='wide')assert.ok(ratio>1.3,`${shape} wide ${ratio}`);
  if(mode==='deep')assert.ok(ratio<.8,`${shape} deep ${ratio}`);
  if(mode==='circle')assert.ok(Math.abs(ratio-1)<.15,`${shape} circle ${ratio}`);
  else assert.ok(Math.abs(spun-1)<Math.abs(ratio-1),`${shape} ${mode} failed to round: ${ratio} -> ${spun}`);
 }
});

test('seated and lying targets retain the configured silhouette at the end of the transition',()=>{
 const {d,rest,width,constraint}=fixture();
 for(const action of ['sit','lie']){
  const results:Float32Array[]=[];
  for(const mode of ['wide','deep'] as HemShape[]){
   d.shape=effectiveShape(d);d.shape.hem={mode,ratio:.45};
   const natural=rest.slice();naturalEnvelope(natural,rest,d,width);constraint.projectLengths(natural);
   const p=natural.slice();constraint.apply(p,new Float32Array(p.length),effectiveDrape(d),1,action,natural);
   assert.ok(p.every(Number.isFinite));assert.ok(constraint.maxWarpError(p)<1e-4);results.push(p);
  }
  assert.ok(results[0].some((v,i)=>Math.abs(v-results[1][i])>.03),`${action} erased hem shape`);
 }
});
test('hand fitting reaches the contact even for a collinear target',()=>{
 for(const target of [[0,-.2,0],[0,.3,0],[.2,-.4,.05]]){
  const p=new Float32Array([0,-.5,0]),n=new Float32Array([0,0,1]);
  moveArm(p,n,0,1,[0,0,0],[0,-.5,0],target);
  for(let k=0;k<3;k++)assert.ok(Math.abs(p[k]-target[k])<1e-6);assert.ok(n.every(Number.isFinite));
 }
});
