import type {AvatarManifest} from './avatar';
import {moveArm} from './motion';

export interface Stance {left:{x:number;z:number;arm:number};right:{x:number;z:number;arm:number}}
export const defaultStance=():Stance=>({left:{x:-.15,z:.045,arm:0},right:{x:.15,z:.045,arm:0}});
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
export function limitStance(value:Stance):Stance {
 const result=defaultStance();
 for(const [key,side] of [['left',-1],['right',1]] as const){const v=value[key],fallback=result[key];result[key]={x:Number.isFinite(v.x)?side*clamp(v.x*side,.055,.42):fallback.x,z:Number.isFinite(v.z)?clamp(v.z,-.25,.32):fallback.z,arm:Number.isFinite(v.arm)?clamp(v.arm,0,110):fallback.arm};}
 return result;
}
export function stanceDrop(s:Stance){
 let drop=0;for(const [key,side] of [['left',-1],['right',1]] as const){const foot=s[key],r=Math.hypot(foot.x-side*.15,foot.z-.045);drop=Math.max(drop,1-Math.sqrt(Math.max(.2,1-r*r)));}return drop+.003*(drop>0?1:0);
}
/** Two equal leg segments keep their length while the pelvis settles for wider steps. */
export function stanceLeg(s:Stance,side:number){
 const foot=side<0?s.left:s.right,drop=stanceDrop(s),hip=[side*.15,1.16-drop,.045],ankle=[foot.x,.16,foot.z];
 const v=ankle.map((x,k)=>x-hip[k]),distance=Math.hypot(...v),axis=v.map(x=>x/distance);
 let bend=[0,0,1].map((x,k)=>x-axis[k]*axis[2]);const length=Math.hypot(...bend)||1;bend=bend.map(x=>x/length);
 const height=Math.sqrt(Math.max(0,.25-distance*distance/4));const knee=hip.map((x,k)=>x+v[k]/2+bend[k]*height);
 return {hip,knee,ankle,drop};
}
export function poseStance(p:Float32Array,n:Float32Array,parts:AvatarManifest['parts'],s:Stance){
 const drop=stanceDrop(s);for(let i=1;i<p.length;i+=3)p[i]-=drop;
 for(const side of [-1,1]){
  const leg=stanceLeg(s,side),restHip=[side*.15,1.16-drop,.045],restKnee=[side*.15,.66-drop,.045],restAnkle=[side*.15,.16-drop,.045];
  for(const part of parts){const at=part.vertexOffset*3;if(p[at]*side<0)continue;
   if(part.name==='PreviewThigh')moveArm(p,n,part.vertexOffset,part.vertexCount,restHip,restKnee,leg.knee);
   if(part.name==='Calf'){
    const delta=leg.knee.map((x,k)=>x-restKnee[k]);for(let i=part.vertexOffset;i<part.vertexOffset+part.vertexCount;i++)for(let k=0;k<3;k++)p[i*3+k]+=delta[k];
    moveArm(p,n,part.vertexOffset,part.vertexCount,leg.knee,restAnkle.map((x,k)=>x+delta[k]),leg.ankle);
   }
   if(part.name==='FlatSole'||part.name==='ShoeUpper')for(let i=part.vertexOffset;i<part.vertexOffset+part.vertexCount;i++)for(let k=0;k<3;k++)p[i*3+k]+=leg.ankle[k]-restAnkle[k];
  }
  const angle=(side<0?s.left.arm:s.right.arm)*Math.PI/180;if(!angle)continue;
  const pivot=[side*.24,1.66-drop,0],hand=[side*.30,1.17-drop,.025],dx=.06,dy=-.49;
  const target=[pivot[0]+side*(dx*Math.cos(angle)-dy*Math.sin(angle)),pivot[1]+dx*Math.sin(angle)+dy*Math.cos(angle),.025];
  for(const part of parts){if(!['CuffBinding','CuffThickness','SleeveLining','Mitten','Thumb','TailoredShell'].includes(part.name))continue;
   moveArm(p,n,part.vertexOffset,part.vertexCount,pivot,hand,target,i=>{const x=p[i*3],y=p[i*3+1]+drop;if(x*side<=0)return 0;return part.name==='TailoredShell'?clamp((Math.abs(x)-.20)/.10,0,1)*clamp((1.85-y)/.15,0,1):1;});
  }
 }
}
