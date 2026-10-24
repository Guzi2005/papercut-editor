export interface MotionOptions {armAngle:number;spread:number;speed:number;uniformity:number}
export const defaultMotionOptions:MotionOptions={armAngle:45,spread:90,speed:.4,uniformity:.35};
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
export function motionOptions(current:MotionOptions,patch:Partial<MotionOptions>):MotionOptions{
 const result={...current};for(const key of Object.keys(patch) as (keyof MotionOptions)[]){const value=patch[key];if(value===undefined||!Number.isFinite(value))continue;const [a,b]={armAngle:[0,85],spread:[20,150],speed:[.1,1.5],uniformity:[0,1]}[key];result[key]=clamp(value,a,b);}return result;
}
const smooth=(t:number)=>{t=clamp(t,0,1);return t*t*(3-2*t);};
/** Reach, lift, hold, release, recover. The last pose equals the first. */
export function displayPhase(t:number){return {grip:smooth(t/.12)*(1-smooth((t-.64)/.12)),lift:smooth((t-.12)/.26)*(1-smooth((t-.64)/.28))};}
/** Integral of strictly positive angular speed; one seamless turn per cycle. */
export function spinPhase(t:number,uniformity:number){const a=.85*(1-uniformity);return {angle:Math.PI*2*t-a*Math.sin(Math.PI*2*t),rate:1-a*Math.cos(Math.PI*2*t)};}
export function rotateY(p:Float32Array,n:Float32Array,angle:number){const c=Math.cos(angle),s=Math.sin(angle);for(const data of [p,n])for(let i=0;i<data.length;i+=3){const x=data[i],z=data[i+2];data[i]=c*x+s*z;data[i+2]=-s*x+c*z;}}
/** Rotate a rigid hand/cuff or blended sleeve around a shoulder to its grip. */
export function moveArm(p:Float32Array,n:Float32Array,start:number,count:number,pivot:number[],restHand:number[],hand:number[],weight:(i:number)=>number=()=>1){
 const a=restHand.map((v,k)=>v-pivot[k]),b=hand.map((v,k)=>v-pivot[k]),al=Math.hypot(...a),bl=Math.hypot(...b);for(let k=0;k<3;k++){a[k]/=al;b[k]/=bl;}
 const axis=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],sin=Math.hypot(...axis),cos=Math.max(-1,Math.min(1,a.reduce((sum,v,k)=>sum+v*b[k],0)));if(sin<1e-7)return;for(let k=0;k<3;k++)axis[k]/=sin;
 for(let i=start;i<start+count;i++){const w=weight(i);if(w<=0)continue;for(const [data,position] of [[p,true],[n,false]] as const){const at=i*3,v=[data[at],data[at+1],data[at+2]].map((x,k)=>x-(position?pivot[k]:0)),dot=v.reduce((sum,x,k)=>sum+x*axis[k],0),cross=[axis[1]*v[2]-axis[2]*v[1],axis[2]*v[0]-axis[0]*v[2],axis[0]*v[1]-axis[1]*v[0]];for(let k=0;k<3;k++)data[at+k]=data[at+k]*(1-w)+(v[k]*cos+cross[k]*sin+axis[k]*dot*(1-cos)+(position?pivot[k]:0))*w;}}
}
