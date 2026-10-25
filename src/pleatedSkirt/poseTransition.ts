import {rotateY} from './motion';

export interface TransitionPose {
 bodyPositions:Float32Array;
 bodyNormals:Float32Array;
 garmentPositions:Float32Array;
 garmentNormals:Float32Array;
 rootAngle:number;
}

interface PoseSnapshot {
 bodyPositions:Float32Array;
 bodyNormals:Float32Array;
 garmentPositions:Float32Array;
 garmentNormals:Float32Array;
 worldBodyPositions:Float32Array;
 worldBodyNormals:Float32Array;
 worldGarmentPositions:Float32Array;
 worldGarmentNormals:Float32Array;
 rootAngle:number;
}

const TWO_PI=Math.PI*2;
const shortestDelta=(from:number,to:number)=>{
 let delta=(to-from)%TWO_PI;
 if(delta>Math.PI)delta-=TWO_PI;
 else if(delta<-Math.PI)delta+=TWO_PI;
 return delta;
};
const normalizeNormals=(data:Float32Array)=>{
 for(let i=0;i+2<data.length;i+=3){
  const x=data[i],y=data[i+1],z=data[i+2],length=Math.hypot(x,y,z);
  if(length>1e-12){data[i]=x/length;data[i+1]=y/length;data[i+2]=z/length;}
 }
};

/** Blends a displayed pose into a new target pose without changing either source pose. */
export class PoseTransition {
 private snapshot:PoseSnapshot|null=null;
 private elapsed=0;
 private lastTargetRoot?:number;
 private targetRoot=0;
 private readonly duration:number;
 constructor(duration=.45){this.duration=Number.isFinite(duration)?Math.max(0,duration):.45;}
 get active(){return this.snapshot!==null;}
 get weight(){
  if(!this.snapshot)return 1;
  const t=this.duration>0?Math.max(0,Math.min(1,this.elapsed/this.duration)):1;
  return t*t*(3-2*t);
 }
 start(source:TransitionPose){
  const worldBodyPositions=new Float32Array(source.bodyPositions);
  const worldBodyNormals=new Float32Array(source.bodyNormals);
  const worldGarmentPositions=new Float32Array(source.garmentPositions);
  const worldGarmentNormals=new Float32Array(source.garmentNormals);
  const bodyPositions=worldBodyPositions.slice(),bodyNormals=worldBodyNormals.slice();
  const garmentPositions=worldGarmentPositions.slice(),garmentNormals=worldGarmentNormals.slice();
  rotateY(bodyPositions,bodyNormals,-source.rootAngle);
  rotateY(garmentPositions,garmentNormals,-source.rootAngle);
  this.snapshot={bodyPositions,bodyNormals,garmentPositions,garmentNormals,worldBodyPositions,worldBodyNormals,worldGarmentPositions,worldGarmentNormals,rootAngle:source.rootAngle};
  this.elapsed=0;
  this.lastTargetRoot=undefined;
 }
 advance(deltaSeconds:number){
  if(!this.snapshot||!Number.isFinite(deltaSeconds)||deltaSeconds<0)return;
  this.elapsed+=deltaSeconds;
  if(this.duration<=0||this.elapsed>=this.duration)this.cancel();
 }
 cancel(){this.snapshot=null;this.elapsed=0;this.lastTargetRoot=undefined;}
 apply(target:TransitionPose):number{
  const snapshot=this.snapshot;
  if(!snapshot)return target.rootAngle;
  if(target.bodyPositions.length!==snapshot.bodyPositions.length||target.bodyNormals.length!==snapshot.bodyNormals.length||target.garmentPositions.length!==snapshot.garmentPositions.length||target.garmentNormals.length!==snapshot.garmentNormals.length){
   this.cancel();return target.rootAngle;
  }
  const weight=this.weight;
  // Pick the shortest entry direction once, then follow a moving target's winding.
  // Re-picking the shortest arc every frame would snap when a fast spin passes pi.
  this.targetRoot=this.lastTargetRoot===undefined?snapshot.rootAngle+shortestDelta(snapshot.rootAngle,target.rootAngle):this.targetRoot+shortestDelta(this.lastTargetRoot,target.rootAngle);
  this.lastTargetRoot=target.rootAngle;
  if(weight===0){
   target.bodyPositions.set(snapshot.worldBodyPositions);target.bodyNormals.set(snapshot.worldBodyNormals);
   target.garmentPositions.set(snapshot.worldGarmentPositions);target.garmentNormals.set(snapshot.worldGarmentNormals);
   normalizeNormals(target.bodyNormals);normalizeNormals(target.garmentNormals);
   return snapshot.rootAngle;
  }
  rotateY(target.bodyPositions,target.bodyNormals,-target.rootAngle);
  rotateY(target.garmentPositions,target.garmentNormals,-target.rootAngle);
  for(const [out,from] of [[target.bodyPositions,snapshot.bodyPositions],[target.garmentPositions,snapshot.garmentPositions]] as const){
   for(let i=0;i<out.length;i++)out[i]=from[i]+(out[i]-from[i])*weight;
  }
  for(const [out,from] of [[target.bodyNormals,snapshot.bodyNormals],[target.garmentNormals,snapshot.garmentNormals]] as const){
   for(let i=0;i+2<out.length;i+=3){
    const sx=from[i],sy=from[i+1],sz=from[i+2],tx=out[i],ty=out[i+1],tz=out[i+2];
    const x=sx+(tx-sx)*weight,y=sy+(ty-sy)*weight,z=sz+(tz-sz)*weight,length=Math.hypot(x,y,z);
    if(length>1e-12){out[i]=x/length;out[i+1]=y/length;out[i+2]=z/length;}
    else{
     const sourceLength=Math.hypot(sx,sy,sz),targetLength=Math.hypot(tx,ty,tz);
     if(sourceLength>1e-12){out[i]=sx/sourceLength;out[i+1]=sy/sourceLength;out[i+2]=sz/sourceLength;}
     else if(targetLength>1e-12){out[i]=tx/targetLength;out[i+1]=ty/targetLength;out[i+2]=tz/targetLength;}
     else{out[i]=0;out[i+1]=1;out[i+2]=0;}
    }
   }
  }
  const yaw=snapshot.rootAngle+(this.targetRoot-snapshot.rootAngle)*weight;
  rotateY(target.bodyPositions,target.bodyNormals,yaw);
  rotateY(target.garmentPositions,target.garmentNormals,yaw);
  return yaw;
 }
}
