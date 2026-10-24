import type {SkirtDesign} from './model';
import {effectiveDrape} from './drape';
import type {MotionOptions} from './motion';
import {defaultShapeSettings,type ShapeSettings} from './shape';
const TAU=Math.PI*2;
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
export const smooth=(x:number)=>{x=clamp(x,0,1);return x*x*(3-2*x);};
/** Reduced skirt-bone dynamics. Fixed integration in seconds, independent of
 * render frequency. Angular acceleration drives torsion; centrifugal loading
 * competes with gravity/stiffness and has its own damped radial response. */
export class SkirtInertia {
 private tick=0;private key='';private previousOmega=0;
 angle=0;omega=0;lag=new Float64Array(25);lagVelocity=new Float64Array(25);
 opening=new Float64Array(25);openingVelocity=new Float64Array(25);
 sample(time:number,design:SkirtDesign,motion:MotionOptions){
  const d=effectiveDrape(design),key=JSON.stringify([design.parameters,design.silhouette,design.shape,d]);
  const goal=Math.max(0,Math.floor(time*120+1e-7));
  if(key!==this.key||goal<this.tick){this.key=key;this.tick=0;this.angle=0;this.omega=0;this.previousOmega=0;for(const a of [this.lag,this.lagVelocity,this.opening,this.openingVelocity])a.fill(0);}
  const dt=1/120,p=design.parameters,mass=.65+d.weight+p.thickness_mm*.12,stiffness=(10+26*d.bending)/mass*(88/p.length_cm);
  while(this.tick<goal){
   const t=++this.tick*dt,phase=t*motion.speed,a=.85*(1-motion.uniformity);
   this.omega=TAU*motion.speed*(1-a*Math.cos(TAU*phase))*smooth(t/.8);
   const acceleration=(this.omega-this.previousOmega)/dt;this.angle+=(this.omega+this.previousOmega)*.5*dt;this.previousOmega=this.omega;
   for(let row=1;row<=24;row++){
    const v=row/24,k=stiffness/(.4+.6*v),damping=2*Math.sqrt(k)*(.35+.35*d.bending);
    const torque=-acceleration*v*.65-this.omega*v*(.15+.2*d.weight);
    this.lagVelocity[row]+=(-k*this.lag[row]-damping*this.lagVelocity[row]+torque)*dt;
    this.lag[row]=clamp(this.lag[row]+this.lagVelocity[row]*dt,-.85,.85);
    const radius=(p.waist_cm+(p.hem_cm-p.waist_cm)*v)/TAU/100;
    const centrifugal=this.omega*this.omega*radius;
    const equilibrium=clamp(centrifugal/(9.81*(.65+d.weight*.35)+centrifugal)*(1.2-.55*d.bending)*(.6+.4*d.opening),0,.92);
    const radialK=(14+12*d.bending)/mass;
    this.openingVelocity[row]+=(radialK*(equilibrium-this.opening[row])-2*Math.sqrt(radialK)*.65*this.openingVelocity[row])*dt;
    this.opening[row]=clamp(this.opening[row]+this.openingVelocity[row]*dt,0,.96);
   }
  }
  return this;
 }
}

/** Natural envelope consumes the same longitudinal arc length as the fitted
 * material. A gravity-biased resting profile is not the fully spread pattern. */
export function restOpening(design:SkirtDesign,v:number){
 const d=effectiveDrape(design),fabric=.40+.28*d.bending-.12*d.weight+.10*d.opening;
 const s=design.shape??defaultShapeSettings;
 switch(design.silhouette??'relaxed'){
  case 'a_line':return clamp((fabric+.12+(s.a_line.flare-.5)*.6)*Math.pow(Math.max(v,1/24),(.5-s.a_line.curve)*.9),.16,.95);
  case 'bell':{
   const bump=v<=s.bell.peak?smooth(v/s.bell.peak):1-.55*smooth((v-s.bell.peak)/(1-s.bell.peak));
   return clamp(fabric+.64*s.bell.volume*bump,.2,.98);
  }
  case 'trumpet':return clamp(fabric*(.3+.5*s.trumpet.fit)+.8*s.trumpet.flare*smooth((v-s.trumpet.flare_start)/(1-s.trumpet.flare_start)),.14,.98);
  default:return clamp(fabric+(s.relaxed.fullness-.5)*.4-(s.relaxed.taper-.5)*.25*v,.16,.9);
 }
}
const ellipsePerimeter=(a:number,b:number)=>{
 const h=((a-b)/(a+b))**2;return Math.PI*(a+b)*(1+3*h/(10+Math.sqrt(4-3*h)));
};
/** Keep the row's outline perimeter while moving from body fit to the chosen
 * hem axes. Waist stays fixed, and the change grows gradually toward the hem. */
function ellipseScales(rx:number,rz:number,v:number,hem:ShapeSettings['hem']):[number,number]{
 if(hem.mode==='body')return [1,1];
 const a=hem.mode==='deep'?hem.ratio:1,b=hem.mode==='wide'?hem.ratio:1;
 const perimeter=ellipsePerimeter(rx,rz),scale=perimeter/ellipsePerimeter(a,b),blend=smooth(v);
 const x=rx+(a*scale-rx)*blend,z=rz+(b*scale-rz)*blend,correction=perimeter/ellipsePerimeter(x,z);
 return [x*correction/rx,z*correction/rz];
}
export function naturalEnvelope(p:Float32Array,rest:Float32Array,design:SkirtDesign,width:number,inertia?:SkirtInertia){
 const columns=width-1,capacity=new Float64Array(25);
 // Recover the folded material perimeter; the outline circumference alone
 // omits the cloth hidden inside the pleats.
 for(let row=0;row<=24;row++)for(let col=0;col<columns;col++){
  const a=(row*width+col)*3,b=(row*width+(col+1)%columns)*3;
  capacity[row]+=Math.hypot(rest[a]-rest[b],rest[a+1]-rest[b+1],rest[a+2]-rest[b+2])/TAU;
 }
 const hem=(design.shape??defaultShapeSettings).hem;
 for(let row=1;row<=24;row++){
  const v=row/24,open=inertia?.opening[row]??0;
  const fraction=restOpening(design,v)*(1-open)+open;
  const side=Math.round(columns*.25)*3,back=2;
  const rx=Math.abs(rest[side]+(rest[row*width*3+side]-rest[side])*fraction);
  const rz=Math.abs(rest[back]+(rest[row*width*3+back]-rest[back])*fraction);
  const [sx,sz]=ellipseScales(Math.max(rx,.001),Math.max(rz,.001),v,hem);
  const meanRadius=(Math.abs(rest[row*width*3+side])+Math.abs(rest[row*width*3+back]))*.5;
  // One target radius for the whole row, so the original ellipse does not
  // survive as an angularly varying centrifugal target.
  const circular=Math.max(Math.sqrt(rx*sx*rz*sz),meanRadius*fraction+(capacity[row]-meanRadius)*open);
  for(let col=0;col<columns;col++){
  const at=(row*width+col)*3,waist=col*3;
  let x=(rest[waist]+(rest[at]-rest[waist])*fraction)*sx,z=(rest[waist+2]+(rest[at+2]-rest[waist+2])*fraction)*sz;
  // Circularize the elliptical body fit as centrifugal loading opens pleats.
  const angle=col/columns*TAU;
  x=x*(1-open)+Math.sin(angle)*circular*open;z=z*(1-open)-Math.cos(angle)*circular*open;
  const lag=inertia?.lag[row]??0,c=Math.cos(lag),s=Math.sin(lag);
  p[at]=x*c+z*s;p[at+2]=-x*s+z*c;
  // Raise from force-directed segment slopes, then project material lengths.
  p[at+1]=rest[at+1]+open*v*(design.parameters.length_cm/100)*.8;
  }
 }
}
