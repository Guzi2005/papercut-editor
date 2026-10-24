import {buildMesh,type MeshData} from './geometry';
import type {SkirtDesign} from './model';
import {loadAvatar,GarmentBinding,sampleClip,type AvatarAsset,type PreviewAction} from './avatar';
export type {PreviewAction} from './avatar';
const vertex=`#version 300 es
precision highp float;
in vec3 position;in vec3 normal;in vec2 uv;in vec3 vertexColor;
uniform float yaw,pitch,distance,aspect;uniform vec3 center;
out vec3 n;out vec2 tex;out vec3 tint;
void main(){
 float cy=cos(yaw),sy=sin(yaw),cx=cos(pitch),sx=sin(pitch);
 mat3 ry=mat3(cy,0,-sy,0,1,0,sy,0,cy),rx=mat3(1,0,0,0,cx,sx,0,-sx,cx);
 vec3 p=rx*ry*(position-center);n=rx*ry*normal;tex=uv;tint=vertexColor;p.z-=distance;
 float f=2.9,near=.01,far=60.;
 gl_Position=vec4(p.x*f/aspect,p.y*f,((far+near)/(near-far))*p.z+(2.*far*near)/(near-far),-p.z);
}`;
const fragment=`#version 300 es
precision highp float;
in vec3 n;in vec2 tex;in vec3 tint;
uniform sampler2D cloth;uniform float roughness,grain,useTexture;
out vec4 outColor;
void main(){
 vec3 N=normalize(n),L=normalize(vec3(-.5,.8,1.2));
 float light=.58+.42*max(0.,dot(N,L));
 float threads=sin(tex.x*2600.)*sin(tex.y*2100.);
 float sheen=pow(max(0.,dot(reflect(-L,N),vec3(0,0,1))),35.)*(1.-roughness)*.25;
 vec3 rgb=mix(tint,texture(cloth,tex).rgb,useTexture)*(light+grain*threads*useTexture)+sheen*useTexture;
 outColor=vec4(rgb,1.);
}`;
interface GPU {vao:WebGLVertexArrayObject;buffers:WebGLBuffer[];count:number}
export class SkirtPreview {
 private gl:WebGL2RenderingContext;private program:WebGLProgram;private texture:WebGLTexture;
 private garment?:GPU;private body?:GPU;private mesh?:MeshData;private binding?:GarmentBinding;private avatar?:AvatarAsset;
 private bodyPositions=new Float32Array();private bodyNormals=new Float32Array();private cage=new Float32Array();
 private key='';private length=88;private action:PreviewAction='stand';private worn=true;private playing=true;private progress=0;private elapsed=0;private raf=0;private last=0;
 private yaw=.3;private pitch=.07;private zoom=1;private observer:ResizeObserver;private events=new AbortController();private disposed=false;
 private drag?:{id:number;x:number;y:number};
 onProgress?:(progress:number,playing:boolean)=>void;
 constructor(private canvas:HTMLCanvasElement){
  const gl=canvas.getContext('webgl2',{antialias:true,alpha:true,preserveDrawingBuffer:true});if(!gl)throw Error('当前浏览器没有启用 WebGL 2');this.gl=gl;
  const shader=(type:number,source:string)=>{const s=gl.createShader(type)!;gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s)??'3D shader error');return s;};
  this.program=gl.createProgram()!;const vs=shader(gl.VERTEX_SHADER,vertex),fs=shader(gl.FRAGMENT_SHADER,fragment);gl.attachShader(this.program,vs);gl.attachShader(this.program,fs);gl.linkProgram(this.program);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error('3D 预览初始化失败');
  this.texture=gl.createTexture()!;gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  this.observer=new ResizeObserver(()=>this.draw());this.observer.observe(canvas);const signal=this.events.signal;
  canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;this.drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);},{signal});
  canvas.addEventListener('pointermove',e=>{if(!this.drag||this.drag.id!==e.pointerId)return;this.yaw+=(e.clientX-this.drag.x)*.009;this.pitch=Math.max(-1.25,Math.min(1.25,this.pitch+(e.clientY-this.drag.y)*.008));this.drag={id:e.pointerId,x:e.clientX,y:e.clientY};this.draw();},{signal});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>{this.drag=undefined;},{signal});
  canvas.addEventListener('wheel',e=>{e.preventDefault();this.zoom=Math.max(.3,Math.min(3,this.zoom*Math.exp(e.deltaY*.001)));this.draw();},{passive:false,signal});
  document.addEventListener('visibilitychange',()=>{this.last=0;if(document.hidden){cancelAnimationFrame(this.raf);this.raf=0;}else this.schedule();},{signal});
  canvas.dataset.avatar='loading';
  void loadAvatar().then(asset=>{if(this.disposed)return;this.avatar=asset;const m=asset.manifest;this.bodyPositions=new Float32Array(m.vertexCount*3);this.bodyNormals=new Float32Array(m.vertexCount*3);this.cage=new Float32Array(m.cage.vertexCount*3);this.body=this.upload(this.bodyPositions,this.bodyNormals,new Float32Array(m.vertexCount*2),new Float32Array(m.colors),new Uint32Array(m.indices));if(this.mesh)this.binding=new GarmentBinding(this.mesh,m.cage,this.length);canvas.dataset.avatar='ready';this.pose();this.draw();this.schedule();}).catch(error=>{if(this.disposed)return;canvas.dataset.avatar='error';canvas.dispatchEvent(new CustomEvent('skirt-error',{detail:String(error),bubbles:true}));});
 }
 private upload(positions:Float32Array,normals:Float32Array,uvs:Float32Array,colors:Float32Array,indices:Uint32Array):GPU{
  const gl=this.gl,gpu:GPU={vao:gl.createVertexArray()!,buffers:[],count:indices.length};gl.bindVertexArray(gpu.vao);
  for(const [name,size,data] of [['position',3,positions],['normal',3,normals],['uv',2,uvs],['vertexColor',3,colors]] as const){const b=gl.createBuffer()!;gpu.buffers.push(b);gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,name==='position'||name==='normal'?gl.DYNAMIC_DRAW:gl.STATIC_DRAW);const location=gl.getAttribLocation(this.program,name);gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,0,0);}
  const b=gl.createBuffer()!;gpu.buffers.push(b);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,b);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);return gpu;
 }
 private release(gpu?:GPU){if(gpu){gpu.buffers.forEach(b=>this.gl.deleteBuffer(b));this.gl.deleteVertexArray(gpu.vao);}}
 private updateVertices(gpu:GPU,p:Float32Array,n:Float32Array){const gl=this.gl;for(const [i,data] of [p,n].entries()){gl.bindBuffer(gl.ARRAY_BUFFER,gpu.buffers[i]);gl.bufferSubData(gl.ARRAY_BUFFER,0,data);}}
 update(d:SkirtDesign,texture:HTMLCanvasElement){
  const gl=this.gl,p=d.parameters,key=JSON.stringify(p);this.length=p.length_cm;
  if(key!==this.key){this.key=key;this.mesh=buildMesh(p);this.release(this.garment);this.garment=this.upload(this.mesh.positions,this.mesh.normals,this.mesh.uvs,new Float32Array(this.mesh.positions.length),this.mesh.indices);if(this.avatar)this.binding=new GarmentBinding(this.mesh,this.avatar.manifest.cage,this.length);this.pose();}
  gl.useProgram(this.program);gl.uniform1f(gl.getUniformLocation(this.program,'roughness'),{cotton:.86,linen:.95,silk:.32,wool:1}[p.fabric]);gl.uniform1f(gl.getUniformLocation(this.program,'grain'),{cotton:.012,linen:.032,silk:.006,wool:.04}[p.fabric]);gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,texture);this.draw();
 }
 setAction(action:PreviewAction){this.action=action;this.progress=this.elapsed=this.last=0;this.playing=true;this.pose();this.draw();this.schedule();}
 setWorn(worn:boolean){this.worn=worn;this.pose();this.draw();this.schedule();}
 setPlaying(playing:boolean){this.playing=playing;this.last=0;this.onProgress?.(this.progress,playing);if(!playing){cancelAnimationFrame(this.raf);this.raf=0;}this.schedule();}
 setProgress(progress:number){this.progress=Math.max(0,Math.min(1,progress));this.elapsed=this.progress*1.2;this.setPlaying(false);this.pose();this.draw();}
 private pose(){
  if(!this.mesh||!this.garment)return;
  if(!this.worn||!this.avatar||!this.binding||!this.body){this.updateVertices(this.garment,this.mesh.positions,this.mesh.normals);return;}
  const {manifest:m,data}=this.avatar,{a,b,mix}=sampleClip(m.actions[this.action],this.progress,this.action==='walk'),n=m.vertexCount*3;
  for(let i=0;i<n;i++){this.bodyPositions[i]=data[a.offset+i]*(1-mix)+data[b.offset+i]*mix;this.bodyNormals[i]=data[a.offset+n+i]*(1-mix)+data[b.offset+n+i]*mix;}
  for(let i=0;i<this.cage.length;i++)this.cage[i]=data[a.offset+n*2+i]*(1-mix)+data[b.offset+n*2+i]*mix;
  this.binding.deform(this.cage);this.updateVertices(this.body,this.bodyPositions,this.bodyNormals);this.updateVertices(this.garment,this.binding.positions,this.binding.normals);
  this.canvas.dataset.progress=this.progress.toFixed(3);this.onProgress?.(this.progress,this.playing);
 }
 private schedule(){if(this.raf||this.disposed||!this.playing||!this.worn||!this.avatar||this.action==='stand'||document.hidden)return;this.raf=requestAnimationFrame(t=>{this.raf=0;if(this.last&&t-this.last<32){this.schedule();return;}const delta=this.last?Math.min(.1,(t-this.last)/1000):0;this.last=t;this.elapsed+=delta;if(this.action==='walk')this.progress=(this.elapsed%1.2)/1.2;else{const t=this.elapsed%3.6;this.progress=t<1.2?t/1.2:t<1.8?1:t<3?1-(t-1.8)/1.2:0;}this.pose();this.draw();this.schedule();});}
 reset(){this.yaw=.3;this.pitch=.07;this.zoom=1;this.draw();}
 draw(){
  if(this.disposed||!this.mesh||!this.garment)return;const gl=this.gl,r=this.canvas.getBoundingClientRect();if(!r.width||!r.height)return;
  const scale=Math.min(devicePixelRatio,2),w=Math.round(r.width*scale),h=Math.round(r.height*scale);if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);
  const dressed=this.worn&&this.avatar&&this.binding&&this.body;
  const arrays=dressed?[this.bodyPositions,this.binding!.positions]:[this.mesh.positions];const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const data of arrays)for(let i=0;i<data.length;i+=3)for(let j=0;j<3;j++){min[j]=Math.min(min[j],data[i+j]);max[j]=Math.max(max[j],data[i+j]);}
  const center=min.map((v,i)=>(v+max[i])/2),radius=Math.max(.1,Math.hypot(...max.map((v,i)=>(v-min[i])/2))),aspect=w/h;
  const distance=radius*Math.sqrt(1+(2.9/Math.min(1,aspect))**2)*1.03*this.zoom;
  for(const [name,value] of Object.entries({yaw:this.yaw,pitch:this.pitch,distance,aspect}))gl.uniform1f(gl.getUniformLocation(this.program,name),value);gl.uniform3fv(gl.getUniformLocation(this.program,'center'),center);gl.bindTexture(gl.TEXTURE_2D,this.texture);
  if(dressed){gl.uniform1f(gl.getUniformLocation(this.program,'useTexture'),0);gl.bindVertexArray(this.body!.vao);gl.drawElements(gl.TRIANGLES,this.body!.count,gl.UNSIGNED_INT,0);}
  gl.uniform1f(gl.getUniformLocation(this.program,'useTexture'),1);gl.bindVertexArray(this.garment.vao);gl.drawElements(gl.TRIANGLES,this.garment.count,gl.UNSIGNED_INT,0);
 }
 dispose(){this.disposed=true;cancelAnimationFrame(this.raf);this.events.abort();this.observer.disconnect();this.release(this.garment);this.release(this.body);this.gl.deleteTexture(this.texture);this.gl.deleteProgram(this.program);}
}
