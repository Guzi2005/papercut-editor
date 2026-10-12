import type {PapercutProject} from '../types/papercut';
import type {StampDefinition} from './stamps';
import {createBlankCanvas} from './presetTemplates';
import {transformPathD,scaleAbout} from './pathTransform';
import {flattenLayerIds,isLayerRendered} from './projectOps';
import {layerContent} from './layerContent';
import {normalizeHex} from './color';
import clipping from 'polygon-clipping';
import {shapeOf,multiD} from './pathfinder';

export function createStampDocument(def:StampDefinition):PapercutProject {
  const p=createBlankCanvas({width:256,height:256,mode:'cut',name:`图章原稿 · ${def.name}`,canvasBg:{kind:'transparent',display:'light'}});
  const l=p.layers.layer_base_paper;
  l.name='图案';l.baseShape={type:'freeform',d:''};l.texture='smooth';l.grain=0;l.unclippedDrawings=true;
  l.cutouts=def.parts.map((part,i)=>({id:`motif_${i}`,name:`色块 ${i+1}`,d:transformPathD(part.d,scaleAbout(2.56,0,0)),fillColor:part.color,isHole:false,type:'custom_polygon',createdAt:i+1}));
  return p;
}

/** Preserve the tile's whitespace, centre and scale, including freehand strokes. */
export function stampFromDocument(p:PapercutProject,def:StampDefinition):StampDefinition {
  const clip=shapeOf(`M 0 0 H ${p.width} V ${p.height} H 0 Z`);
  const parts=flattenLayerIds(p).filter(id=>isLayerRendered(p,id)&&p.layers[id].opacity>0).flatMap(id=>layerContent(p.layers[id]).pieces).flatMap((part,i)=>{
    const shape=clipping.intersection(shapeOf(part.d),clip);if(!shape.length)return [];
    return [{id:`part_${i}`,d:transformPathD(multiD(shape),[100/p.width,0,0,100/p.height,0,0]),color:normalizeHex(part.color)??'#000000'}];
  });
  if(parts.length>200)throw new Error('当前图案超过 200 个色块，请合并或精简后再应用。原稿仍保留。');
  if(!parts.length)throw new Error('图案画布内还没有可用的图形。');
  return {...def,parts};
}
