/** Deterministic body colliders for seated cloth support.
 * Both helpers edit only the vertex at float-array offset `at` and return the
 * Euclidean distance it actually moved. */

const isNum=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const vertex=(p:Float32Array,at:number)=>p!=null&&Number.isInteger(at)&&at>=0&&at+2<p.length&&isNum(p[at])&&isNum(p[at+1])&&isNum(p[at+2]);
const vector=(v:readonly number[])=>v!=null&&v.length>=3&&isNum(v[0])&&isNum(v[1])&&isNum(v[2]);
const positive=(v:readonly number[])=>vector(v)&&v[0]>0&&v[1]>0&&v[2]>0;
const amount=(strength:number)=>isNum(strength)?Math.min(1,Math.max(0,strength)):0;

export function projectEllipsoid(p:Float32Array,at:number,center:readonly number[],radii:readonly number[],strength=1):number{
 const k=amount(strength);
 if(!k||!vertex(p,at)||!vector(center)||!positive(radii))return 0;
 const x=(p[at]-center[0])/radii[0],y=(p[at+1]-center[1])/radii[1],z=(p[at+2]-center[2])/radii[2];
 const d2=x*x+y*y+z*z;
 if(!(d2<1))return 0;
 let sx:number,sy:number,sz:number;
 if(d2===0){sx=center[0];sy=center[1]+radii[1];sz=center[2];}
 else{const inv=1/Math.sqrt(d2);sx=center[0]+x*inv*radii[0];sy=center[1]+y*inv*radii[1];sz=center[2]+z*inv*radii[2];}
 const dx=(sx-p[at])*k,dy=(sy-p[at+1])*k,dz=(sz-p[at+2])*k;
 p[at]+=dx;p[at+1]+=dy;p[at+2]+=dz;
 return Math.hypot(dx,dy,dz);
}

export function projectCapsule(p:Float32Array,at:number,a:readonly number[],b:readonly number[],radius:number,strength=1):number{
 const k=amount(strength);
 if(!k||!vertex(p,at)||!vector(a)||!vector(b)||!isNum(radius)||radius<=0)return 0;
 const ex=b[0]-a[0],ey=b[1]-a[1],ez=b[2]-a[2],len2=ex*ex+ey*ey+ez*ez;
 let t=0;
 if(len2>0){t=((p[at]-a[0])*ex+(p[at+1]-a[1])*ey+(p[at+2]-a[2])*ez)/len2;t=Math.max(0,Math.min(1,t));}
 const cx=a[0]+ex*t,cy=a[1]+ey*t,cz=a[2]+ez*t;
 const dx=p[at]-cx,dy=p[at+1]-cy,dz=p[at+2]-cz,d2=dx*dx+dy*dy+dz*dz;
 if(!(d2<radius*radius))return 0;
 let ox=0,oy=radius,oz=0;
 if(d2>0){const scale=radius/Math.sqrt(d2);ox=dx*scale;oy=dy*scale;oz=dz*scale;}
 const mx=(ox-dx)*k,my=(oy-dy)*k,mz=(oz-dz)*k;
 p[at]+=mx;p[at+1]+=my;p[at+2]+=mz;
 return Math.hypot(mx,my,mz);
}
