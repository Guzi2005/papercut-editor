import type {DrapeValues} from './drape';
import {projectCapsule,projectEllipsoid} from './bodySupport';

type Point=readonly number[];
interface Path {points:Point[];lengths:number[]}
function path(points:Point[]):Path {return {points,lengths:points.slice(1).map((b,i)=>{const a=points[i];return Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]);})};}
function pointAt({points,lengths}:Path,distance:number):number[]{
 for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],length=lengths[i-1];if(distance<=length){const t=length>0?distance/length:0;return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];}distance-=length;}
 const end=points.at(-1)!;return [end[0],end[1]-distance,end[2]];
}
/** Waist-to-hem material paths drape over the lap and gather behind the pelvis.
 * Each path is sampled by its material arc length, not the height of a cone. */
export function seatedEnvelope(p:Float32Array,rest:Float32Array,width:number,rows:number,d:DrapeValues,blend:number,kneeDrop=0){
 const cols=width-1;
 for(let col=0;col<cols;col++){
  const u=col/cols,angle=u*Math.PI*2,front=(1-Math.cos(angle))*.5,rear=1-front,side=Math.sin(angle),root=col*3;
  const waist=[p[root],p[root+1],p[root+2]],radial=Math.abs(rest[(rows*width+col)*3])/Math.max(.001,Math.abs(side));
  const sideRoom=Math.min(.21,Math.max(0,radial-.28))*(.3+.4*d.bending);
  const hipX=side*(.29+sideRoom*.3),kneeX=side*(.29+sideRoom),seat=1.04;
  const frontPath=path([waist,[hipX,1.255-kneeDrop*.45,.29],[kneeX,1.255-kneeDrop,.50],[kneeX,1.18-kneeDrop,.66],[kneeX,1.05-kneeDrop,.69]]);
  // More bending resistance produces larger, rounder folds; soft fabric packs tightly.
  const fold=.025+.055*d.bending,backX=side*(.30+sideRoom);
  const rearPath=path([waist,[hipX,1.12,-.23],[backX,seat+fold,-.27],[backX,seat+fold*.45,-.12],[backX,seat+fold,-.34],[backX,seat+.025,-.23],[backX,seat+.015,-.38],[backX,seat-.10,-.39]]);
  const lateralPath=path([waist,[hipX,1.13,.01],[backX,seat+.04,.03],[backX,seat-.10,.04]]);
  const sideWeight=Math.pow(Math.abs(side),4),frontWeight=Math.pow(front,2),rearWeight=Math.pow(rear,2),total=sideWeight+frontWeight+rearWeight;
  let material=0;
  for(let row=1;row<=rows;row++){
   const at=(row*width+col)*3,prior=at-width*3;material+=Math.hypot(rest[at]-rest[prior],rest[at+1]-rest[prior+1],rest[at+2]-rest[prior+2]);
   const f=pointAt(frontPath,material),b=pointAt(rearPath,material),s=pointAt(lateralPath,material);
   const v=row/rows,fullness=Math.min(.17,Math.max(0,radial-.3))*v;
   for(let k=0;k<3;k++){let target=(f[k]*frontWeight+b[k]*rearWeight+s[k]*sideWeight)/total;if(k===0)target+=side*fullness;if(k===2)target+=(front-rear)*fullness*.35;p[at+k]=p[at+k]*(1-blend)+target*blend;}
  }
 }
}

/** Keep a finite cloth envelope around the buttocks, thighs, knees and calves.
 * Geometric contacts complement material-length projection; no self-collision. */
export function supportSeatedBody(p:Float32Array,width:number,rows:number,strength:number,kneeDrop=0){
 for(let row=1;row<=rows;row++)for(let col=0;col<width-1;col++){
  const at=(row*width+col)*3;
  projectEllipsoid(p,at,[0,1.17,-.015],[.295,.15,.245],strength);
  for(const side of [-1,1]){
   projectCapsule(p,at,[side*.15,1.14,.035],[side*.15,1.14-kneeDrop,.52],.135,strength);
   projectCapsule(p,at,[side*.15,1.12-kneeDrop,.52],[side*.15,.66-kneeDrop,.52],.107,strength);
  }
 }
}
