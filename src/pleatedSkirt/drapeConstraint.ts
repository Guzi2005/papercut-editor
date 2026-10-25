import type {MeshData} from './geometry';
import type {DrapeValues} from './drape';
import {seatedEnvelope,supportSeatedBody} from './seatedDrape';
/** Deterministic, waist-pinned length constraints for the preview surface.
 * Each longitudinal material edge keeps its reference arc length. Fine pleat
 * relaxation provides an art-directed opening control.
 * This is a geometric drape model, not a collision or sewing simulation. */
export class DrapeConstraint {
 private width:number;private rows:number;private shell:number;private rest:Float32Array;
 private warp:Float32Array;private thickness:Float32Array;
 constructor(mesh:MeshData,rest:Float32Array){
  this.width=1;while(this.width<mesh.uvs.length/2&&mesh.uvs[this.width*2+1]===mesh.uvs[1])this.width++;
  this.rows=24;this.shell=this.width*(this.rows+1);this.rest=rest.slice();this.warp=new Float32Array(this.shell);this.thickness=new Float32Array(this.shell);
  for(let j=0;j<=this.rows;j++)for(let i=0;i<this.width;i++){const at=j*this.width+i;if(j)this.warp[at]=this.distance(rest,at,at-this.width);this.thickness[at]=this.distance(rest,at,at+this.shell);}
 }
 private distance(p:Float32Array,a:number,b:number){return Math.hypot(p[a*3]-p[b*3],p[a*3+1]-p[b*3+1],p[a*3+2]-p[b*3+2]);}
 apply(p:Float32Array,n:Float32Array,d:DrapeValues,amount:number,action:string='stand',shapeRest:Float32Array=this.rest){
  if(amount<=0)return;const w=this.width,cols=w-1,rows=this.rows;
  // The legacy corrective cage expands radial offsets around bent knees.
  // Use a monotone garment envelope for seated/lying poses instead, then
  // enforce material lengths below. The cage still owns the waist attachment.
  const source=p.slice(0,this.shell*3),blend=amount*amount*(3-2*amount);
  if(action==='sit')seatedEnvelope(p,shapeRest,w,rows,d,blend);
  for(let row=1;row<=rows;row++)for(let col=0;col<cols;col++){
   const v=row/rows,at=(row*w+col)*3;
   if(action==='lie'){
    const rx=shapeRest[at],ry=shapeRest[at+1],rz=shapeRest[at+2];
    const target=[-1.31+(1.31-ry),rx*(1-.75*v)-.10*v,rz*(1-.40*v)+.24*v];
    for(let k=0;k<3;k++)p[at+k]=source[at+k]*(1-blend)+target[k]*blend;
   }
  }
  const envelope=p.slice(0,this.shell*3);
  for(let row=1;row<=rows;row++)for(let col=0;col<cols;col++){
   const v=row/rows,at=(row*w+col)*3,lo=(row*w+(col+cols-4)%cols)*3,hi=(row*w+(col+4)%cols)*3;
   const open=d.opening*amount*v*.65;
   for(let k=0;k<3;k++)p[at+k]=envelope[at+k]*(1-open)+(envelope[lo+k]+envelope[hi+k])*.5*open;
   p[at+1]-=d.weight*(1-d.bending*.75)*amount*v*v*.22;
  }
  // Compressed material gathers into broad folds on the lap and seat sides.
  // Amplitude comes from local spare arc length, not an arbitrary animated
  // wave; phase is material-locked, so scrubbing and pausing are deterministic.
  // This is a support-aware geometric corrective, not self-collision.
  if(action==='sit'||action==='lie'){
   const seated=action==='sit'?blend:blend*(1-blend);
   const gathered=p.slice(0,this.shell*3);
   for(let row=1;row<rows;row++)for(let col=0;col<cols;col++){
    const index=row*w+col,at=index*3,v=row/rows,u=col/cols;
    const span=this.warp[index],actual=this.distance(gathered,index,index-w);
    const slack=Math.max(0,Math.min(.8,1-actual/Math.max(span,1e-8)));
    const side=Math.pow(Math.abs(Math.sin(u*Math.PI*2)),2);
    const band=Math.pow(Math.sin(Math.PI*v),2);
    const softness=1-d.bending*.7;
    const amplitude=Math.min(.065,Math.sqrt(slack)*(.025+.045*side)*softness)*band*seated;
    const phase=v*Math.PI*(4+2*(1-d.bending))+.65*Math.cos(u*Math.PI*4);
    p[at+1]+=amplitude*Math.sin(phase);
    p[at+2]+=amplitude*.65*Math.cos(phase);
    // Unsupported side fabric hangs lower; stiff fabric bridges more widely.
    p[at+1]-=side*band*seated*d.weight*softness*.09;
   }
  }
  if(action==='sit'){
   // Alternate contact and inextensible material constraints. End on length
   // projection so broad folds consume spare cloth instead of stretching it.
   for(let i=0;i<3;i++){supportSeatedBody(p,w,rows,blend);this.projectLengths(p);}
  }else this.projectLengths(p);
  this.finishSurface(p,n);
 }
 projectLengths(p:Float32Array){const w=this.width,cols=w-1,rows=this.rows;
  // Reconstruct each material column from the target tangent field, starting
  // at the waist. Using target derivatives avoids accumulating a catch-up kink
  // when a bent pose's absolute target is farther away than the cloth allows.
  const target=p.slice(0,this.shell*3);
  for(let row=1;row<=rows;row++)for(let col=0;col<cols;col++){
   const a=(row-1)*w+col,b=row*w+col,ai=a*3,bi=b*3;
   let dx=target[bi]-target[ai],dy=target[bi+1]-target[ai+1],dz=target[bi+2]-target[ai+2],len=Math.hypot(dx,dy,dz);
   if(len<1e-8){dx=this.rest[bi]-this.rest[ai];dy=this.rest[bi+1]-this.rest[ai+1];dz=this.rest[bi+2]-this.rest[ai+2];len=Math.hypot(dx,dy,dz);}
   const t=this.warp[b]/len;p[bi]=p[ai]+dx*t;p[bi+1]=p[ai+1]+dy*t;p[bi+2]=p[ai+2]+dz*t;
  }
 }
 finishSurface(p:Float32Array,n:Float32Array){const w=this.width,cols=w-1,rows=this.rows;
  for(let row=0;row<=rows;row++){const first=row*w*3,last=(row*w+cols)*3;for(let k=0;k<3;k++)p[last+k]=p[first+k];}
  for(let row=0;row<=rows;row++)for(let col=0;col<w;col++){
   const c=col%cols,at=(row*w+col)*3,left=(row*w+(c+cols-1)%cols)*3,right=(row*w+(c+1)%cols)*3,up=(Math.max(0,row-1)*w+c)*3,down=(Math.min(rows,row+1)*w+c)*3;
   const ax=p[right]-p[left],ay=p[right+1]-p[left+1],az=p[right+2]-p[left+2],bx=p[down]-p[up],by=p[down+1]-p[up+1],bz=p[down+2]-p[up+2];let nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx;const len=Math.hypot(nx,ny,nz)||1;nx/=len;ny/=len;nz/=len;n.set([nx,ny,nz],at);
   const inner=at+this.shell*3,t=this.thickness[row*w+col];p.set([p[at]-nx*t,p[at+1]-ny*t,p[at+2]-nz*t],inner);n.set([-nx,-ny,-nz],inner);
  }
  for(const [rim,row] of [[0,0],[1,rows]])for(let col=0;col<w;col++)for(let side=0;side<2;side++){
   const to=(this.shell*2+rim*w*2+col*2+side)*3,from=(side*this.shell+row*w+col)*3;p.set(p.subarray(from,from+3),to);
  }
 }
 maxWarpError(p:Float32Array){let error=0;for(let row=1;row<=this.rows;row++)for(let col=0;col<this.width-1;col++){const at=row*this.width+col;error=Math.max(error,Math.abs(this.distance(p,at,at-this.width)/this.warp[at]-1));}return error;}
}
