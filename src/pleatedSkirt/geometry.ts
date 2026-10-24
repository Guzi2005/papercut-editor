import {type Parameters, type UV, type CanvasView} from './model';
const TAU=Math.PI*2;
export interface MeshData {positions:Float32Array;normals:Float32Array;uvs:Float32Array;indices:Uint32Array}
export function surfacePoint(p:Parameters,u:number,v:number):[number,number,number] {
  const circumference=(p.waist_cm+(p.hem_cm-p.waist_cm)*v)/100;
  const fold=((u*p.pleat_count)%1+1)%1;
  const wave=Math.cos(TAU*fold)*(1-p.sharpness)+(Math.abs(2*fold-1)*2-1)*p.sharpness;
  const amplitude=Math.min(p.pleat_depth_cm/100,circumference/p.pleat_count*.45)*(.15+.85*v);
  const r=circumference/TAU+amplitude*wave;
  return [Math.sin(TAU*u)*r,p.length_cm/100*(1-v),-Math.cos(TAU*u)*r];
}
function normal(p:Parameters,u:number,v:number):[number,number,number] {
  const e=1e-5,a=surfacePoint(p,u-e,v),b=surfacePoint(p,u+e,v),c=surfacePoint(p,u,v-e),d=surfacePoint(p,u,v+e);
  const t=b.map((n,i)=>n-a[i]),s=d.map((n,i)=>n-c[i]);
  const n=[t[1]*s[2]-t[2]*s[1],t[2]*s[0]-t[0]*s[2],t[0]*s[1]-t[1]*s[0]];
  const l=Math.hypot(...n);return n.map(x=>x/l) as [number,number,number];
}
export function buildMesh(p:Parameters):MeshData {
  const columns=p.pleat_count*8,rows=24,width=columns+1,shell=width*(rows+1);
  const positions:number[]=[],normals:number[]=[],uvs:number[]=[],indices:number[]=[];
  for(let side=0;side<2;side++)for(let j=0;j<=rows;j++)for(let i=0;i<=columns;i++) {
    const u=i/columns,v=j/rows,point=surfacePoint(p,u,v),n=normal(p,u,v),sign=side===0?1:-1;
    positions.push(...point.map((x,k)=>x+n[k]*p.thickness_mm/2000*sign));normals.push(...n.map(x=>x*sign));uvs.push(u,v);
  }
  for(let side=0;side<2;side++)for(let j=0;j<rows;j++)for(let i=0;i<columns;i++) {
    const a=side*shell+j*width+i,b=a+1,c=a+width,d=c+1;
    indices.push(...(side===0?[a,b,c,b,d,c]:[a,c,b,b,c,d]));
  }
  // Independent rim vertices keep the thin cut edge crisp; neither opening is capped.
  for(const j of [0,rows]) {
    const start=positions.length/3;
    for(let i=0;i<=columns;i++)for(let side=0;side<2;side++) {
      const k=side*shell+j*width+i;positions.push(...positions.slice(k*3,k*3+3));
      normals.push(0,j===0?1:-1,0);uvs.push(i/columns,j/rows);
    }
    for(let i=0;i<columns;i++){const a=start+i*2,b=a+1,c=a+2,d=a+3;indices.push(...(j===0?[a,b,c,b,d,c]:[a,c,b,b,c,d]));}
  }
  return {positions:new Float32Array(positions),normals:new Float32Array(normals),uvs:new Float32Array(uvs),indices:new Uint32Array(indices)};
}

/** Unit-square presentation maps; the stored UV never depends on canvas choice. */
export function uvToCanvas([u,v]:UV,view:CanvasView):UV {
  if(view==='front'){const half=.19+.25*v;return [.5+(u-.5)*2*half,.12+.76*v];}
  // Both views use the same concentric radii and isotropic scale. The sector
  // is exactly half an annulus, translated up to centre it on the page.
  const sweep=view==='ring'?TAU:Math.PI;
  const a=(u-.5)*sweep,r=.12+.31*v;
  return [.5+Math.sin(a)*r,(view==='ring'?.5:.285)+Math.cos(a)*r];
}
export function canvasToUV([x,y]:UV,view:CanvasView):UV|null {
  let u:number,v:number;
  if(view==='front'){v=(y-.12)/.76;u=(x-.5)/(2*(.19+.25*v))+.5;}
  else {
    const dx=x-.5,dy=y-(view==='ring'?.5:.285);
    const r=Math.hypot(dx,dy),a=Math.atan2(dx,dy),sweep=view==='ring'?TAU:Math.PI;
    u=a/sweep+.5;v=(r-.12)/.31;
  }
  const e=1e-7;return u>=-e&&u<=1+e&&v>=-e&&v<=1+e?[Math.max(0,Math.min(1,u)),Math.max(0,Math.min(1,v))]:null;
}
