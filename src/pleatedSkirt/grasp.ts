import type {MotionOptions} from './motion';
import {smooth} from './skirtDynamics';
export function graspPhase(t:number){
 return {reach:smooth(t/.18),lift:smooth((t-.22)/.22),held:t>=.18&&t<.65,
  recovery:smooth((t-.70)/.22),release:t<.65?1:Math.exp(-9*(t-.65)*5)*(1+9*(t-.65)*5)*(1-smooth((t-.9)/.1))};
}
const length=(a:number[],b:number[])=>Math.hypot(...a.map((v,k)=>v-b[k]));
/** Side fabric nearest the resting hand is grasped before the hands slide apart. No cloth
 * movement during reaching; the lower hanging material is carried by that
 * grip, rather than attracting a distant hem to a stationary hand. */
export function graspSkirt(p:Float32Array,rest:Float32Array,width:number,t:number,options:MotionOptions){
 const phase=graspPhase(t),columns=width-1,hands:{side:number;target:number[];row:number;column:number;contact:boolean}[]=[];
 for(const side of [-1,1]){
  const col=Math.round((side>0?.25:.75)*columns),shoulder=[side*.24,1.66,0],restHand=[side*.30,1.17,.025];
  let gripRow=1,nearest=Infinity;
  for(let row=1;row<=24;row++){const at=(row*width+col)*3,point=Array.from(rest.subarray(at,at+3)),distance=length(restHand,point);if(distance<nearest&&length(shoulder,point)<=.55){nearest=distance;gripRow=row;}}
  const at=(gripRow*width+col)*3,grip=Array.from(rest.subarray(at,at+3));
  const lift=phase.lift*phase.release,spread=options.spread*Math.PI/360,angle=options.armAngle*Math.PI/180;
  const delta=[side*.18*Math.sin(angle)*Math.sin(spread)*lift,.07*Math.sin(angle)*lift,.08*Math.sin(angle)*Math.cos(spread)*lift];
  if(t>=.22&&lift>1e-8){
   const source=p.slice();
   for(let column=0;column<columns;column++){
    const du=Math.min(Math.abs(column-col),columns-Math.abs(column-col))/columns,w=Math.exp(-du*du/.012);
    const chain:number[][]=[],sizes:number[]=[];
    for(let row=0;row<=gripRow;row++){const a=(row*width+column)*3;chain.push(Array.from(source.subarray(a,a+3)));if(row)sizes.push(length(chain[row-1],chain[row]));}
    const root=chain[0].slice(),end=chain.at(-1)!.map((x,k)=>x+delta[k]*w),total=sizes.reduce((a,b)=>a+b,0),distance=length(root,end);
    if(distance>total*(1-1e-8))for(let k=0;k<3;k++)end[k]=root[k]+(end[k]-root[k])*total*(1-1e-8)/distance;
    for(let pass=0;pass<32;pass++){
     chain[gripRow]=end.slice();
     for(let row=gripRow-1;row>=0;row--){const d=length(chain[row],chain[row+1])||1;chain[row]=chain[row+1].map((v,k)=>v+(chain[row][k]-v)*sizes[row]/d);}
     chain[0]=root.slice();
     for(let row=1;row<=gripRow;row++){const d=length(chain[row],chain[row-1])||1;chain[row]=chain[row-1].map((v,k)=>v+(chain[row][k]-v)*sizes[row-1]/d);}
    }
    for(let row=1;row<=gripRow;row++)p.set(chain[row],(row*width+column)*3);
    const shift=chain[gripRow].map((v,k)=>v-source[(gripRow*width+column)*3+k]);
    for(let row=gripRow+1;row<=24;row++){const a=(row*width+column)*3;for(let k=0;k<3;k++)p[a+k]=source[a+k]+shift[k];}
   }
  }
  const actual=Array.from(p.subarray(at,at+3));
  let target=t<.22?restHand.map((x,k)=>x+(grip[k]-x)*phase.reach):actual;
  if(t>=.65){const releaseHand=actual.slice();releaseHand[0]+=side*.04*smooth((t-.65)/.05);target=releaseHand.map((x,k)=>x+(restHand[k]-x)*phase.recovery);}
  hands.push({side,target,row:gripRow,column:col,contact:phase.held});
 }
 for(const hand of hands)if(hand.contact){const a=(hand.row*width+hand.column)*3;hand.target=Array.from(p.subarray(a,a+3));}
 return hands;
}
