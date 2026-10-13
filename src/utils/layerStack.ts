import type { PapercutProject } from '../types/papercut';
import { flattenLayerIds, findGroupOfLayer } from './projectOps';

/** Remove legacy depth containers without changing appearance, item ownership or ids. */
export function flatStack(p: PapercutProject): PapercutProject {
  if(!p.groups.length)return p;
  const ids=flattenLayerIds(p);
  const layers={...p.layers};
  for(const id of ids){
    const g=findGroupOfLayer(p,id),l=layers[id];
    layers[id]={...l,visible:l.visible&&(g?.visible??true),locked:l.locked||(g?.locked??false)};
  }
  return {...p,layers,groups:[],rootOrder:ids.map(id=>({type:'layer',id}))};
}

/** Global bottom-to-top ordering. Moving across an old group never adopts its hidden/locked state. */
export function reorderStack(p:PapercutProject,source:string,target:string,position:'above'|'below'):PapercutProject {
  const ids=flattenLayerIds(p);
  if(source===target||!ids.includes(source)||!ids.includes(target))return p;
  const flat=flatStack(p),order=ids.filter(id=>id!==source);
  order.splice(order.indexOf(target)+(position==='above'?1:0),0,source);
  return {...flat,rootOrder:order.map(id=>({type:'layer',id}))};
}
