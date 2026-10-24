import type {MeshData} from './geometry';

export type AvatarAction='stand'|'walk'|'sit'|'lie';
export type PreviewAction=AvatarAction|'display'|'spin';
export interface AvatarFrame {offset:number;bounds:{min:number[];max:number[]}}
export interface AvatarClip {fps:number;frames:AvatarFrame[]}
export interface AvatarManifest {
  version:number;vertexCount:number;frameStride:number;indices:number[];colors:number[];
  parts:{name:string;vertexOffset:number;vertexCount:number}[];
  actions:Record<AvatarAction,AvatarClip>;
  cage:{vertexCount:number;columns:number;rowsY:number[];restPositions:number[]};
}
export interface AvatarAsset {manifest:AvatarManifest;data:Float32Array}
let pending:Promise<AvatarAsset>|undefined;
export function loadAvatar():Promise<AvatarAsset>{
  return pending??=Promise.all([
    fetch('/pleated-avatar/manifest.json').then(r=>{if(!r.ok)throw Error('角色资料载入失败');return r.json() as Promise<AvatarManifest>;}),
    fetch('/pleated-avatar/frames.bin').then(r=>{if(!r.ok)throw Error('角色动作载入失败');return r.arrayBuffer();}),
  ]).then(([manifest,buffer])=>{
    const data=new Float32Array(buffer);
    if(manifest.version!==1||manifest.vertexCount<1||manifest.vertexCount>100000||manifest.colors.length!==manifest.vertexCount*3)throw Error('角色资料格式无效');
    for(const clip of Object.values(manifest.actions))for(const frame of clip.frames){if(frame.offset<0||frame.offset+manifest.frameStride>data.length)throw Error('角色动作数据不完整');}
    return {manifest,data};
  }).catch(e=>{pending=undefined;throw e;});
}

export function sampleClip(clip:AvatarClip,progress:number,loop=false){
  const t=Math.max(0,Math.min(1,progress))*(loop?clip.frames.length:clip.frames.length-1),i=Math.min(clip.frames.length-1,Math.floor(t));
  return {a:clip.frames[i],b:clip.frames[loop?(i+1)%clip.frames.length:Math.min(i+1,clip.frames.length-1)],mix:t-i};
}

function framesForGrid(positions:ArrayLike<number>,columns:number,rows:number):Float32Array{
  // Each cell stores two tangent axes and the outward normal. Translation is
  // kept in positions. Identical seam frames prevent a crease at u=0/1.
  const result=new Float32Array(positions.length*3),stride=columns+1;
  for(let row=0;row<rows;row++)for(let col=0;col<=columns;col++){
    const c=col%columns,left=(row*stride+(c+columns-1)%columns)*3,right=(row*stride+(c+1)%columns)*3;
    const low=(Math.max(0,row-1)*stride+c)*3,high=(Math.min(rows-1,row+1)*stride+c)*3;
    let ux=positions[right]-positions[left],uy=positions[right+1]-positions[left+1],uz=positions[right+2]-positions[left+2];
    let len=Math.hypot(ux,uy,uz)||1;ux/=len;uy/=len;uz/=len;
    const dx=positions[high]-positions[low],dy=positions[high+1]-positions[low+1],dz=positions[high+2]-positions[low+2],dot=ux*dx+uy*dy+uz*dz;
    let vx=dx-dot*ux,vy=dy-dot*uy,vz=dz-dot*uz;len=Math.hypot(vx,vy,vz)||1;vx/=len;vy/=len;vz/=len;
    const at=(row*stride+col)*9;
    result.set([ux,uy,uz,vx,vy,vz,uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx],at);
  }
  return result;
}

/** A deformation cage sampled from the game's existing LongSkirt correctives.
 * Fitting uses the game's stylized reference proportions (88cm/68cm reference);
 * the standalone mesh and exported garment retain their exact metric geometry.
 * No collision or cloth simulation is implied by this preview retargeting. */
export class GarmentBinding {
  positions:Float32Array;normals:Float32Array;
  private corners:Int32Array;private weights:Float32Array;private local:Float32Array;private normalLocal:Float32Array;private radialScale:Float32Array;
  private columns:number;private rows:number;
  constructor(mesh:MeshData,cage:AvatarManifest['cage'],lengthCm:number){
    const count=mesh.positions.length/3;this.positions=new Float32Array(mesh.positions.length);this.normals=new Float32Array(mesh.normals.length);
    this.corners=new Int32Array(count*4);this.weights=new Float32Array(count*4);this.local=new Float32Array(count*3);this.normalLocal=new Float32Array(count*3);this.radialScale=new Float32Array(count);
    this.columns=cage.columns;this.rows=cage.rowsY.length;
    const basis=framesForGrid(cage.restPositions,this.columns,this.rows),top=cage.rowsY.at(-1)!,vertical=(top-cage.rowsY[0])/.88;
    const sx=.28/(.68/(Math.PI*2)),sz=.202/(.68/(Math.PI*2));
    for(let i=0;i<count;i++){
      const at=i*3,x=mesh.positions[at]*sx,y=top-lengthCm/100*vertical+mesh.positions[at+1]*vertical,z=mesh.positions[at+2]*sz;
      const u=mesh.uvs[i*2],column=((.5-u)%1+1)%1*this.columns,c0=Math.min(this.columns-1,Math.floor(column)),cu=column-c0;
      let r=0;while(r<this.rows-2&&y>cage.rowsY[r+1])r++;
      const v=Math.max(0,Math.min(1,(y-cage.rowsY[r])/(cage.rowsY[r+1]-cage.rowsY[r]))),stride=this.columns+1;
      this.corners.set([r*stride+c0,r*stride+c0+1,(r+1)*stride+c0,(r+1)*stride+c0+1],i*4);
      this.weights.set([(1-cu)*(1-v),cu*(1-v),(1-cu)*v,cu*v],i*4);
      const frame=this.interpolate(basis,9,i),p=this.interpolate(cage.restPositions,3,i);
      // Scale around each row's center, rather than subtracting a large radial
      // offset from a compressed sitting cage (which inverted narrow skirts).
      const scale=(x*p[0]+z*p[2])/(p[0]*p[0]+p[2]*p[2]);this.radialScale[i]=scale;
      const delta=[x-p[0]*scale,y-p[1],z-p[2]*scale],n=[mesh.normals[at]/sx,mesh.normals[at+1]/vertical,mesh.normals[at+2]/sz];
      // Interpolated axes are not necessarily orthogonal; invert the basis so
      // binding and sampling the same frame reproduces the original exactly.
      this.local.set(this.solve(frame,delta),at);this.normalLocal.set(this.solve(frame,n),at);
    }
  }
  private interpolate(data:ArrayLike<number>,size:number,index:number){const result=new Array<number>(size).fill(0);for(let k=0;k<4;k++){const at=this.corners[index*4+k]*size,w=this.weights[index*4+k];for(let j=0;j<size;j++)result[j]+=data[at+j]*w;}return result;}
  private solve(m:number[],p:number[]){const cross=(a:number[],b:number[])=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a:number[],b:number[])=>a.reduce((s,n,i)=>s+n*b[i],0),a=m.slice(0,3),b=m.slice(3,6),c=m.slice(6,9),bc=cross(b,c),det=dot(a,bc);if(Math.abs(det)<1e-8)return [0,0,0];return [dot(p,bc)/det,dot(p,cross(c,a))/det,dot(p,cross(a,b))/det];}
  deform(cagePositions:Float32Array){
    const basis=framesForGrid(cagePositions,this.columns,this.rows);
    const centers=new Float32Array(cagePositions.length),stride=this.columns+1;
    for(let row=0;row<this.rows;row++){const mean=[0,0,0];for(let col=0;col<this.columns;col++)for(let j=0;j<3;j++)mean[j]+=cagePositions[(row*stride+col)*3+j]/this.columns;for(let col=0;col<=this.columns;col++)centers.set(mean,(row*stride+col)*3);}
    for(let i=0;i<this.positions.length/3;i++){
      const at=i*3,frame=this.interpolate(basis,9,i),p=this.interpolate(cagePositions,3,i),center=this.interpolate(centers,3,i),scale=this.radialScale[i];
      for(let j=0;j<3;j++){this.positions[at+j]=center[j]+(p[j]-center[j])*scale+frame[j]*this.local[at]+frame[3+j]*this.local[at+1]+frame[6+j]*this.local[at+2];this.normals[at+j]=frame[j]*this.normalLocal[at]+frame[3+j]*this.normalLocal[at+1]+frame[6+j]*this.normalLocal[at+2];}
      const len=Math.hypot(this.normals[at],this.normals[at+1],this.normals[at+2])||1;for(let j=0;j<3;j++)this.normals[at+j]/=len;
    }
    return this;
  }
}
