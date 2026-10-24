import type {SkirtDesign,Stroke} from './model';
import {newId} from './model';
import {oppositeU} from './projection';
const SEAM_EPS=1e-9;
/**
 * Split an unwrapped UV span into contiguous [u0,u1] pieces inside [0,1].
 * A drag that crosses the back seam (u=1 -> u=0) becomes two patches that
 * meet at the seam instead of one patch spanning the whole front.
 */
export function splitSeamSpan(start:number,end:number):[number,number][]{
 const lo=Math.min(start,end),hi=Math.max(start,end);
 if(hi-lo>=1-SEAM_EPS)return [[0,1]];
 const pieces:[number,number][]=[];
 for(let k=Math.floor(lo);k<=Math.floor(hi);k++){
  const a=Math.max(lo,k),b=Math.min(hi,k+1);
  if(b-a>SEAM_EPS)pieces.push([a-k,b-k]);
 }
 return pieces;
}
function mirrorStroke(stroke:Stroke,out:Stroke[]){
 let segment:Stroke={...stroke,id:newId(),points:[]};
 for(const [u,v] of stroke.points){
  const point:[number,number]=[oppositeU(u),v],last=segment.points.at(-1);
  if(last&&Math.abs(last[0]-point[0])>.5){
   const a=last[0],b=point[0]+(point[0]<a?1:-1),edge=point[0]<a?1:0,t=(edge-a)/(b-a),y=last[1]+(v-last[1])*t;
   if(last[0]!==edge||last[1]!==y)segment.points.push([edge,y]);
   out.push(segment);
   segment={...stroke,id:newId(),points:[]};
   const seam:[number,number]=[1-edge,y];
   if(seam[0]!==point[0]||seam[1]!==point[1])segment.points.push(seam);
  }
  segment.points.push(point);
 }
 if(segment.points.length)out.push(segment);
}
/** Split mirrored marks at the UV back seam instead of drawing across it. */
export function mirrorNewMarks(d:SkirtDesign,strokeStart:number,patchStart:number):SkirtDesign{
 const next=structuredClone(d);
 const strokes:Stroke[]=[];
 for(const stroke of d.strokes.slice(Math.max(0,strokeStart)))mirrorStroke(stroke,strokes);
 next.strokes.push(...strokes);
 for(const patch of d.patches.slice(Math.max(0,patchStart))){
  const start=oppositeU(patch.u1),width=patch.u1-patch.u0;
  for(const [u0,u1] of splitSeamSpan(start,start+width)){
   if(u1-u0<=SEAM_EPS)continue;
   next.patches.push({...patch,id:newId(),u0,u1});
  }
 }
 return next;
}
/** Only a live pen/patch gesture mirrors the draft; sliders must stay unstamped. */
export function mirrorGesture(d:SkirtDesign,mirror:boolean,drawing:boolean,strokeStart:number,patchStart:number):SkirtDesign{
 return mirror&&drawing&&d.canvas_view==='front'?mirrorNewMarks(d,strokeStart,patchStart):d;
}
