import type {Parameters,SkirtDesign} from './model';
export interface DrapeSettings {mode:'auto'|'manual';weight:number;bending:number;opening:number}
export type DrapeValues=Omit<DrapeSettings,'mode'>;
const clamp=(v:number)=>Math.round(Math.max(0,Math.min(1,v))*100)/100;
/** Art-direction defaults, not measured physical constants. */
export function defaultDrape(p:Parameters):DrapeValues {
 const fabric={cotton:[.48,.44,.55],linen:[.55,.72,.35],silk:[.28,.16,.86],wool:[.78,.65,.38]}[p.fabric];
 const thickness=p.thickness_mm/.7,fullness=p.hem_cm/p.waist_cm;
 return {weight:clamp(fabric[0]*Math.sqrt(thickness)*Math.sqrt(p.length_cm/88)),bending:clamp(fabric[1]+Math.log2(thickness)*.12+p.sharpness*.08),opening:clamp(fabric[2]+(fullness-3.4)*.055-p.sharpness*.12)};
}
export function effectiveDrape(d:SkirtDesign):DrapeValues{return d.drape?.mode==='manual'?d.drape:defaultDrape(d.parameters);}
