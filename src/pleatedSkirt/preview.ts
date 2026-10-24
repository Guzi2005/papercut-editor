import {defaultMotionOptions,motionOptions,displayPhase,spinPhase,rotateY,moveArm,type MotionOptions} from './motion';
import {loadBench,type BenchMesh} from './bench';
import {effectiveDrape} from './drape';
import {DrapeConstraint} from './drapeConstraint';
import {buildMesh,type MeshData} from './geometry';
import type {SkirtDesign} from './model';
import {loadAvatar,GarmentBinding,sampleClip,type AvatarAsset,type PreviewAction,type AvatarAction} from './avatar';
export type {PreviewAction} from './avatar';
export type PreviewRenderMode='material'|'toon';
const MODE_KEY='pleated-skirt-preview-render-mode';
export function readPreviewRenderMode():PreviewRenderMode{try{return localStorage.getItem(MODE_KEY)==='toon'?'toon':'material';}catch{return 'material';}}
const vertex=`#version 300 es
precision highp float;
in vec3 paperPosition;in vec3 position;in vec3 normal;in vec2 uv;in vec3 vertexColor;
uniform float yaw,pitch,distance,aspect;uniform vec3 center;
out vec3 n;out vec2 tex;out vec3 tint;out vec3 worldNormal;out vec3 paper;
void main(){
 float cy=cos(yaw),sy=sin(yaw),cx=cos(pitch),sx=sin(pitch);
 mat3 ry=mat3(cy,0,-sy,0,1,0,sy,0,cy),rx=mat3(1,0,0,0,cx,sx,0,-sx,cx);
 worldNormal=normal;paper=paperPosition;vec3 p=rx*ry*(position-center);n=rx*ry*normal;tex=uv;tint=vertexColor;p.z-=distance;
 float f=2.9,near=.01,far=60.;
 gl_Position=vec4(p.x*f/aspect,p.y*f,((far+near)/(near-far))*p.z+(2.*far*near)/(near-far),-p.z);
}`;
const fragment=`#version 300 es
precision highp float;
in vec3 n;in vec2 tex;in vec3 tint;in vec3 worldNormal;in vec3 paper;
uniform sampler2D cloth;uniform float roughness,grain,useTexture,opacity,coverCut,renderMode;
out vec4 outColor;
void main(){
 if(useTexture<.5&&tex.x>.5&&tex.y>coverCut)discard;
 vec3 N=normalize(n),L=normalize(vec3(-.5,.8,1.2));
 float diffuse=max(0.,dot(N,L));
 float light=.58+.42*diffuse;
 float threads=sin(tex.x*2600.)*sin(tex.y*2100.);
 float sheen=pow(max(0.,dot(reflect(-L,N),vec3(0,0,1))),35.)*(1.-roughness)*.25;
 vec3 base=mix(tint,texture(cloth,tex).rgb,useTexture);
 vec3 rgb=base*(light+grain*threads*useTexture)+sheen*useTexture;
 if(renderMode>.5){
  // Port of shaders/doll_volume.gdshader: unlit pigment, two tone steps,
  // 0.94 base light, 0.075 paper tooth, and derivative-filtered grain.
  float gameLight=dot(normalize(worldNormal),normalize(vec3(-.55,.8,.65)));
  float level=clamp((gameLight+.45)/1.4,0.,1.);
  float stepped=floor(level*2.)/2.;
  float fleck=fract(sin(dot(floor(paper*220.),vec3(17.13,91.17,43.71)))*43758.5453);
  float fade=1.-smoothstep(.35,1.1,length(fwidth(paper*220.)));
  rgb=base*(.94+.06*stepped)*(1.+(fleck-.5)*.075*fade);
 }
 outColor=vec4(rgb,opacity);
}`;
interface GPU {vao:WebGLVertexArrayObject;buffers:WebGLBuffer[];count:number}
export class SkirtPreview {
 private gl:WebGL2RenderingContext;private program:WebGLProgram;private texture:WebGLTexture;
 private garment?:GPU;private body?:GPU;private mesh?:MeshData;private binding?:GarmentBinding;private avatar?:AvatarAsset;
 private bodyPositions=new Float32Array();private bodyNormals=new Float32Array();private cage=new Float32Array();
 private bench?:GPU;private benchData?:BenchMesh;private constraint?:DrapeConstraint;private design?:SkirtDesign;
 private motion={...defaultMotionOptions};
 private key='';private length=88;private action:PreviewAction='stand';private worn=true;private playing=true;private progress=0;private elapsed=0;private raf=0;private last=0;
 private yaw=.3;private pitch=.07;private zoom=1;private panX=0;private panY=0;private renderMode:PreviewRenderMode=readPreviewRenderMode();private observer:ResizeObserver;private events=new AbortController();private disposed=false;
 private drag?:{id:number;x:number;y:number;button:number};
 private benchSit?:BenchMesh;private benchLie?:BenchMesh;
 onProgress?:(progress:number,playing:boolean)=>void;
 constructor(private canvas:HTMLCanvasElement){
  const gl=canvas.getContext('webgl2',{antialias:true,alpha:true,preserveDrawingBuffer:true});if(!gl)throw Error('当前浏览器没有启用 WebGL 2');this.gl=gl;
  const shader=(type:number,source:string)=>{const s=gl.createShader(type)!;gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s)??'3D shader error');return s;};
  this.program=gl.createProgram()!;const vs=shader(gl.VERTEX_SHADER,vertex),fs=shader(gl.FRAGMENT_SHADER,fragment);gl.attachShader(this.program,vs);gl.attachShader(this.program,fs);gl.linkProgram(this.program);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error('3D 预览初始化失败');
  this.texture=gl.createTexture()!;gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  this.observer=new ResizeObserver(()=>this.draw());this.observer.observe(canvas);const signal=this.events.signal;
  canvas.addEventListener('pointerdown',e=>{if(![0,1,2].includes(e.button))return;this.drag={id:e.pointerId,x:e.clientX,y:e.clientY,button:e.button};canvas.setPointerCapture(e.pointerId);},{signal});
  canvas.addEventListener('pointermove',e=>{if(!this.drag||this.drag.id!==e.pointerId)return;const dx=e.clientX-this.drag.x,dy=e.clientY-this.drag.y;if(this.drag.button===1){this.panX+=dx*.003*this.zoom;this.panY-=dy*.003*this.zoom;}else{this.yaw+=dx*.009;this.pitch=Math.max(-1.25,Math.min(1.25,this.pitch+dy*.008));}this.drag={id:e.pointerId,x:e.clientX,y:e.clientY,button:this.drag.button};this.draw();},{signal});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>{this.drag=undefined;},{signal});
  canvas.addEventListener('contextmenu',e=>e.preventDefault(),{signal});
  canvas.addEventListener('wheel',e=>{e.preventDefault();this.zoom=Math.max(.3,Math.min(3,this.zoom*Math.exp(e.deltaY*.001)));this.draw();},{passive:false,signal});
  document.addEventListener('visibilitychange',()=>{this.last=0;if(document.hidden){cancelAnimationFrame(this.raf);this.raf=0;}else this.schedule();},{signal});
  canvas.dataset.avatar='loading';
  void loadAvatar().then(asset=>{if(this.disposed)return;this.avatar=asset;const m=asset.manifest;this.bodyPositions=new Float32Array(m.vertexCount*3);this.bodyNormals=new Float32Array(m.vertexCount*3);this.cage=new Float32Array(m.cage.vertexCount*3);const bodyUV=new Float32Array(m.vertexCount*2);for(const part of m.parts){if(!['PreviewThigh','Calf','FlatSole','ShoeUpper'].includes(part.name))continue;for(let i=part.vertexOffset;i<part.vertexOffset+part.vertexCount;i++){bodyUV[i*2]=1;bodyUV[i*2+1]=asset.data[m.actions.stand.frames[0].offset+i*3+1];}}this.body=this.upload(this.bodyPositions,this.bodyNormals,bodyUV,new Float32Array(m.colors),new Uint32Array(m.indices),asset.data.subarray(m.actions.stand.frames[0].offset,m.actions.stand.frames[0].offset+m.vertexCount*3));this.bindGarment();canvas.dataset.avatar='ready';this.pose();this.draw();this.schedule();}).catch(error=>{if(this.disposed)return;canvas.dataset.avatar='error';canvas.dispatchEvent(new CustomEvent('skirt-error',{detail:String(error),bubbles:true}));});
 }
 private upload(positions:Float32Array,normals:Float32Array,uvs:Float32Array,colors:Float32Array,indices:Uint32Array,paperPositions=positions):GPU{
  const gl=this.gl,gpu:GPU={vao:gl.createVertexArray()!,buffers:[],count:indices.length};gl.bindVertexArray(gpu.vao);
  for(const [name,size,data] of [['position',3,positions],['normal',3,normals],['uv',2,uvs],['vertexColor',3,colors],['paperPosition',3,paperPositions]] as const){const b=gl.createBuffer()!;gpu.buffers.push(b);gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,name==='position'||name==='normal'?gl.DYNAMIC_DRAW:gl.STATIC_DRAW);const location=gl.getAttribLocation(this.program,name);gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,0,0);}
  const b=gl.createBuffer()!;gpu.buffers.push(b);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,b);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);return gpu;
 }
 private release(gpu?:GPU){if(gpu){gpu.buffers.forEach(b=>this.gl.deleteBuffer(b));this.gl.deleteVertexArray(gpu.vao);}}
 private updateVertices(gpu:GPU,p:Float32Array,n:Float32Array){const gl=this.gl;for(const [i,data] of [p,n].entries()){gl.bindBuffer(gl.ARRAY_BUFFER,gpu.buffers[i]);gl.bufferSubData(gl.ARRAY_BUFFER,0,data);}}
 update(d:SkirtDesign,texture:HTMLCanvasElement){
  const gl=this.gl,p=d.parameters,key=JSON.stringify([p,d.drape]);this.length=p.length_cm;this.design=d;
  if(key!==this.key){this.key=key;this.mesh=buildMesh(p);this.release(this.garment);this.garment=this.upload(this.mesh.positions,this.mesh.normals,this.mesh.uvs,new Float32Array(this.mesh.positions.length),this.mesh.indices);this.bindGarment();this.pose();}
  gl.useProgram(this.program);gl.uniform1f(gl.getUniformLocation(this.program,'roughness'),{cotton:.86,linen:.95,silk:.32,wool:1}[p.fabric]);gl.uniform1f(gl.getUniformLocation(this.program,'grain'),{cotton:.012,linen:.032,silk:.006,wool:.04}[p.fabric]);gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,texture);this.draw();
 }
 private bindGarment(){if(!this.mesh||!this.avatar)return;this.binding=new GarmentBinding(this.mesh,this.avatar.manifest.cage,this.length);this.binding.deform(new Float32Array(this.avatar.manifest.cage.restPositions));this.constraint=new DrapeConstraint(this.mesh,this.binding.positions);}
 setAction(action:PreviewAction){this.action=action;this.release(this.bench);this.bench=undefined;this.benchData=undefined;this.benchSit=undefined;this.benchLie=undefined;if(action==='sit'||action==='lie'){const load=action==='lie'?Promise.all([loadBench(false),loadBench(true)]):loadBench(false).then(b=>[b]);void load.then(([sit,lie])=>{if(this.disposed||this.action!==action)return;this.benchSit=sit;this.benchLie=lie??sit;this.benchData={...sit,positions:sit.positions.slice()};this.bench=this.upload(this.benchData.positions,this.benchData.normals,this.benchData.uvs,this.benchData.colors,this.benchData.indices);this.pose();this.draw();}).catch(error=>this.canvas.dispatchEvent(new CustomEvent('skirt-error',{detail:String(error),bubbles:true})));}this.progress=this.elapsed=this.last=0;this.playing=true;this.pose();this.draw();this.schedule();}
 setMotionOptions(patch:Partial<MotionOptions>){this.motion=motionOptions(this.motion,patch);this.pose();this.draw();}
 getRenderMode(){return this.renderMode;}
 setRenderMode(mode:PreviewRenderMode){this.renderMode=mode;try{localStorage.setItem(MODE_KEY,mode);}catch{/* Preview remains usable with storage disabled. */}this.canvas.dataset.renderMode=mode;this.draw();}
 setWorn(worn:boolean){this.worn=worn;this.pose();this.draw();this.schedule();}
 setPlaying(playing:boolean){this.playing=playing;this.last=0;this.onProgress?.(this.progress,playing);if(!playing){cancelAnimationFrame(this.raf);this.raf=0;}this.schedule();}
 setProgress(progress:number){this.progress=Math.max(0,Math.min(1,progress));this.elapsed=this.progress*(this.action==='display'?5:this.action==='spin'?1/this.motion.speed:1.2);this.setPlaying(false);this.pose();this.draw();}
 private pose(){
  if(!this.mesh||!this.garment)return;
  if(!this.worn||!this.avatar||!this.binding||!this.body){this.updateVertices(this.garment,this.mesh.positions,this.mesh.normals);return;}
  const {manifest:m,data}=this.avatar,n=m.vertexCount*3;
  const sample=(action:AvatarAction,progress:number,index:number)=>{const clip=m.actions[action],s=sampleClip(clip,progress,action==='walk');return data[s.a.offset+index]*(1-s.mix)+data[s.b.offset+index]*s.mix;};
  const base:AvatarAction=this.action==='display'||this.action==='spin'?'stand':this.action;
  let fromAction:AvatarAction=base,toAction:AvatarAction=base,fromProgress=this.progress,toProgress=this.progress,mix=0;
  if(this.action==='lie'){
   if(this.progress<.4){fromAction='stand';fromProgress=0;toAction='sit';toProgress=1;mix=this.progress/.4;}
   else if(this.progress<.55){fromAction='sit';fromProgress=1;toAction='sit';toProgress=1;mix=0;}
   else{fromAction='sit';fromProgress=1;toAction='lie';toProgress=1;mix=(this.progress-.55)/.45;}
  }
  for(let i=0;i<n;i++){this.bodyPositions[i]=sample(fromAction,fromProgress,i)*(1-mix)+sample(toAction,toProgress,i)*mix;this.bodyNormals[i]=sample(fromAction,fromProgress,n+i)*(1-mix)+sample(toAction,toProgress,n+i)*mix;}
  for(let i=0;i<this.cage.length;i++){const at=n*2+i;this.cage[i]=sample(fromAction,fromProgress,at)*(1-mix)+sample(toAction,toProgress,at)*mix;}
  if(this.bench&&this.benchSit&&this.benchLie&&this.benchData){const benchMix=this.action==='lie'?Math.max(0,Math.min(1,(this.progress-.55)/.45)):0;for(let i=0;i<this.benchData.positions.length;i++)this.benchData.positions[i]=this.benchSit.positions[i]*(1-benchMix)+this.benchLie.positions[i]*benchMix;this.updateVertices(this.bench,this.benchData.positions,this.benchData.normals);}
  this.binding.deform(this.cage);if(this.design&&this.constraint){this.constraint.apply(this.binding.positions,this.binding.normals,effectiveDrape(this.design),['stand','display','spin'].includes(this.action)?.15:this.action==='walk'?.35:this.progress,this.action);this.canvas.dataset.warpError=this.constraint.maxWarpError(this.binding.positions).toFixed(6);}this.applyMotion();if(this.constraint&&this.design&&(this.action==='display'||this.action==='spin')){this.constraint.apply(this.binding.positions,this.binding.normals,effectiveDrape(this.design),1e-8,'stand');this.canvas.dataset.warpError=this.constraint.maxWarpError(this.binding.positions).toFixed(6);}this.updateVertices(this.body,this.bodyPositions,this.bodyNormals);this.updateVertices(this.garment,this.binding.positions,this.binding.normals);
  this.canvas.dataset.progress=this.progress.toFixed(3);this.onProgress?.(this.progress,this.playing);
 }
 private applyMotion(){
  if(!this.avatar||!this.binding||!this.mesh)return;
  this.canvas.dataset.action=this.action;
  const p=this.binding.positions,n=this.binding.normals;
  if(this.action==='spin'){
   const phase=spinPhase(this.progress,this.motion.uniformity);
   // Rotate the character, not the inspection camera. Flare follows speed.
   const strength=Math.min(.16,this.motion.speed*this.motion.speed*.09*phase.rate*phase.rate);
   for(let i=0;i<p.length/3;i++){const v=this.mesh.uvs[i*2+1],at=i*3,f=1+strength*v*v;p[at]*=f;p[at+2]*=f;p[at+1]+=strength*v*v*.35;}
   rotateY(p,n,phase.angle);rotateY(this.bodyPositions,this.bodyNormals,phase.angle);
   this.canvas.dataset.spinAngle=String(phase.angle);this.canvas.dataset.spinRate=String(phase.rate*this.motion.speed);
  }
  if(this.action==='display'){
   const phase=displayPhase(this.progress),m=this.avatar.manifest;
   const width=this.design!.parameters.pleat_count*8+1,hem=24*width;
   for(const side of [-1,1]){
    const col=Math.round((side>0?.25:.75)*(width-1)),at=(hem+col)*3;
    const pivot=[side*.24,1.66,0],restHand=[side*.30,1.17,.025];
    const elevation=this.motion.armAngle*Math.PI/180,spread=this.motion.spread*Math.PI/360;
    const hand=[side*(.30+.26*Math.sin(spread)*Math.sin(elevation)),1.17+.42*Math.sin(elevation),.025+.24*Math.cos(spread)*Math.sin(elevation)];
    const lifted=hand.map((x,k)=>restHand[k]+(x-restHand[k])*phase.lift);
    const target=[p[at],p[at+1],p[at+2]].map((x,k)=>x+(lifted[k]-x)*Math.max(phase.grip,phase.lift));
    // Localized hem grips taper toward the pinned waist; the release envelope
    // lets the fabric settle after the hands have let go.
    const delta=target.map((x,k)=>x-p[at+k]);
    for(let i=0;i<p.length/3;i++){const u=this.mesh.uvs[i*2],v=this.mesh.uvs[i*2+1],du=Math.min(Math.abs(u-col/(width-1)),1-Math.abs(u-col/(width-1))),w=Math.exp(-du*du/.026)*v*v;for(let k=0;k<3;k++)p[i*3+k]+=delta[k]*w;}
    const armHand=restHand.map((x,k)=>x+(lifted[k]-x)*Math.max(phase.grip,phase.lift));
    for(const part of m.parts){if(!['CuffBinding','CuffThickness','SleeveLining','Mitten','Thumb','TailoredShell'].includes(part.name))continue;moveArm(this.bodyPositions,this.bodyNormals,part.vertexOffset,part.vertexCount,pivot,restHand,armHand,i=>{const x=this.bodyPositions[i*3],y=this.bodyPositions[i*3+1];if(x*side<=0)return 0;return part.name==='TailoredShell'?Math.max(0,Math.min(1,(Math.abs(x)-.20)/.10))*Math.max(0,Math.min(1,(1.85-y)/.15)):1;});}
   }
   this.canvas.dataset.grip=String(phase.grip);this.canvas.dataset.lift=String(phase.lift);
  }
 }
 private schedule(){if(this.raf||this.disposed||!this.playing||!this.worn||!this.avatar||this.action==='stand'||document.hidden)return;this.raf=requestAnimationFrame(t=>{this.raf=0;if(this.last&&t-this.last<32){this.schedule();return;}const delta=this.last?Math.min(.1,(t-this.last)/1000):0;this.last=t;this.elapsed+=delta;if(this.action==='display')this.progress=(this.elapsed%5)/5;else if(this.action==='spin')this.progress=(this.progress+delta*this.motion.speed)%1;else if(this.action==='walk')this.progress=(this.elapsed%1.2)/1.2;else{const t=this.elapsed%3.6;this.progress=t<1.2?t/1.2:t<1.8?1:t<3?1-(t-1.8)/1.2:0;}this.pose();this.draw();this.schedule();});}
 reset(){this.yaw=.3;this.pitch=.07;this.zoom=1;this.panX=0;this.panY=0;this.draw();}
 draw(){
  if(this.disposed||!this.mesh||!this.garment)return;const gl=this.gl,r=this.canvas.getBoundingClientRect();if(!r.width||!r.height)return;
  const scale=Math.min(devicePixelRatio,2),w=Math.round(r.width*scale),h=Math.round(r.height*scale);if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);
  const dressed=this.worn&&this.avatar&&this.binding&&this.body;
  const arrays=dressed?[this.bodyPositions,this.binding!.positions,...(this.benchData?[this.benchData.positions]:[])]:[this.mesh.positions];const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const data of arrays)for(let i=0;i<data.length;i+=3)for(let j=0;j<3;j++){min[j]=Math.min(min[j],data[i+j]);max[j]=Math.max(max[j],data[i+j]);}
  const center=min.map((v,i)=>(v+max[i])/2);center[0]-=this.panX;center[1]-=this.panY;const radius=Math.max(.1,Math.hypot(...max.map((v,i)=>(v-min[i])/2))),aspect=w/h;
  const distance=radius*Math.sqrt(1+(2.9/Math.min(1,aspect))**2)*1.03*this.zoom;
  for(const [name,value] of Object.entries({yaw:this.yaw,pitch:this.pitch,distance,aspect}))gl.uniform1f(gl.getUniformLocation(this.program,name),value);gl.uniform1f(gl.getUniformLocation(this.program,'renderMode'),this.renderMode==='toon'?1:0);this.canvas.dataset.renderMode=this.renderMode;gl.uniform3fv(gl.getUniformLocation(this.program,'center'),center);gl.bindTexture(gl.TEXTURE_2D,this.texture);
  gl.uniform1f(gl.getUniformLocation(this.program,'opacity'),1);gl.uniform1f(gl.getUniformLocation(this.program,'coverCut'),1.31-this.length/100*(1.11/.88)+.025-(this.action==='lie'?this.progress*.25:0));
  if(dressed){gl.uniform1f(gl.getUniformLocation(this.program,'useTexture'),0);gl.bindVertexArray(this.body!.vao);gl.drawElements(gl.TRIANGLES,this.body!.count,gl.UNSIGNED_INT,0);}
  gl.uniform1f(gl.getUniformLocation(this.program,'useTexture'),1);gl.bindVertexArray(this.garment.vao);gl.drawElements(gl.TRIANGLES,this.garment.count,gl.UNSIGNED_INT,0);
  if(dressed&&this.bench){const alpha=Math.cos(this.yaw)<.2||this.pitch<-.25?.22:1;gl.uniform1f(gl.getUniformLocation(this.program,'opacity'),alpha);this.canvas.dataset.benchOpacity=String(alpha);gl.uniform1f(gl.getUniformLocation(this.program,'useTexture'),0);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.bindVertexArray(this.bench.vao);gl.drawElements(gl.TRIANGLES,this.bench.count,gl.UNSIGNED_INT,0);gl.depthMask(true);gl.disable(gl.BLEND);}this.canvas.dataset.bench=String(Boolean(dressed&&this.bench));
 }
 dispose(){this.disposed=true;cancelAnimationFrame(this.raf);this.events.abort();this.observer.disconnect();this.release(this.garment);this.release(this.body);this.release(this.bench);this.gl.deleteTexture(this.texture);this.gl.deleteProgram(this.program);}
}
