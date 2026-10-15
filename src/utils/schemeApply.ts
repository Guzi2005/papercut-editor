import type {Layer,PapercutProject} from '../types/papercut';
import {normalizeHex} from './color';
import {getLayerEffectiveState} from './drawingGroups';
import {recolorLiveStampLayer} from './liveStamps';

/** All replacements read the original colour, so swaps never cascade through another mapping. */
export function mapLayerColors(layer:Layer,mapping:Record<string,string>):Layer {
  const normalized=Object.fromEntries(Object.entries(mapping).flatMap(([from,to])=>{const f=normalizeHex(from),t=normalizeHex(to);return f&&t?[[f,t]]:[];}));
  const pick=(hex:string)=>normalized[normalizeHex(hex)??hex]??hex;
  const piece=<T extends {isHole:boolean;fillColor?:string}>(p:T)=>p.isHole?p:{...p,fillColor:pick(p.fillColor??layer.color)};
  const next={...layer,color:pick(layer.color),cutouts:layer.cutouts.map(piece),positiveElements:layer.positiveElements.map(piece),drawings:layer.drawings?.map(d=>({...d,color:pick(d.color)})),pattern:layer.pattern?{...layer.pattern,color:pick(layer.pattern.color)}:undefined,stroke:layer.stroke?{...layer.stroke,color:pick(layer.stroke.color)}:undefined,surface:layer.surface?{...layer.surface,color:pick(layer.surface.color)}:undefined};
  return layer.liveStamps?.length?recolorLiveStampLayer(layer,next,normalized):next;
}
export function applySchemeColors(project:PapercutProject,mapping:Record<string,string>,ids:string[]):PapercutProject {
  const layers={...project.layers};
  for(const id of new Set(ids)){const layer=layers[id];if(layer&&!getLayerEffectiveState(project,id).locked)layers[id]=mapLayerColors(layer,mapping);}
  return {...project,layers};
}
