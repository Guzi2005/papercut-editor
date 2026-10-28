import {sampleClip,type AvatarClip} from './avatar';

/** Cloth support is evaluated in pelvis space, then returned to the baked pose.
 * Reading the baked joints keeps support and body on the same trajectory. */
export function restFrame(clip:AvatarClip,progress:number){
 const {a,b,mix}=sampleClip(clip,progress);
 const joint=(name:string,fallback:number[])=>fallback.map((v,i)=>{
  const x=a.joints?.[name]?.[i]??v,y=b.joints?.[name]?.[i]??v;return x+(y-x)*mix;
 });
 const hip=joint('hip',[0,1.14,0]),waist=joint('waist',[0,1.31,0]);
 return {hip,angle:Math.atan2(-(waist[0]-hip[0]),waist[1]-hip[1])};
}
export function transformRestCloth(p:Float32Array,frame:ReturnType<typeof restFrame>,inverse=false){
 const {hip,angle}=frame,c=Math.cos(angle),s=Math.sin(angle);
 for(let i=0;i<p.length;i+=3){
  if(inverse){const x=p[i]-hip[0],y=p[i+1]-hip[1];p[i]=c*x+s*y;p[i+1]=-s*x+c*y+1.14;p[i+2]-=hip[2];}
  else{const x=p[i],y=p[i+1]-1.14;p[i]=c*x-s*y+hip[0];p[i+1]=s*x+c*y+hip[1];p[i+2]+=hip[2];}
 }
}

/** Gravity stays vertical while the pelvis rolls. Only cloth over the seat is
 * supported; the front overhang can fall below its edge. */
export function settleRecliningCloth(p:Float32Array,width:number,rows:number,angle:number,weight:number,project:()=>void){
 const recline=Math.sin(angle)**2;
 if(recline<1e-6)return;
 for(let row=1;row<=rows;row++)for(let col=0;col<width-1;col++){
  const at=(row*width+col)*3,v=row/rows;
  p[at+1]-=recline*v*v*(.55+.5*weight);
 }
 for(let pass=0;pass<8;pass++){
  project();
  for(let row=1;row<=rows;row++)for(let col=0;col<width-1;col++){
   const at=(row*width+col)*3;
   if(Math.abs(p[at])<1.84&&p[at+2]>-.79&&p[at+2]<.205)p[at+1]=Math.max(.735,p[at+1]);
  }
 }
 project();
}
