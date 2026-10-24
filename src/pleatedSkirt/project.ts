import type {PapercutProject,Layer} from '../types/papercut';
import {createBlankCanvas} from '../utils/presetTemplates';
import {createDesign,parseDesign,type SkirtDesign} from './model';
import {generateSvgMarkup,rasterizeSvg} from '../utils/svgExporter';

/** Each garment gets its own ordinary native document, with editable vector layers. */
export function createSkirtProject(value:SkirtDesign=createDesign()):PapercutProject {
  const d=parseDesign(value),p=createBlankCanvas({name:'百褶裙 · 纹样原稿',width:1024,height:1024,mode:'create'});
  const layer:Layer={id:d.component_id,name:'裙面纹样',kind:'doodle',unclippedDrawings:true,color:'#2E58D6',texture:'smooth',opacity:1,blendMode:'normal',visible:true,locked:false,baseShape:{type:'full',d:'M0 0 H1024 V1024 H0 Z'},cutouts:[],positiveElements:[],drawings:[]};
  return {...p,pleatedSkirt:d,layers:{[layer.id]:layer},groups:[],rootOrder:[{type:'layer',id:layer.id}],paperMode:'vector',canvasBg:{kind:'transparent',display:'grid'},items:[{id:d.item_id,name:'百褶裙',partIds:[layer.id],pivot:{x:512,y:0},sockets:[],wardrobeCategory:'clothes'}]};
}
export function skirtOverlaySvg(p:PapercutProject){return generateSvgMarkup(p,{includeBackground:false,includeShadow:false,includePaperTexture:true});}
export function rasterizeSkirtOverlay(p:PapercutProject){return rasterizeSvg(skirtOverlaySvg(p),1024,1024);}

/** Only refresh our own guide; a user's photo and its placement belong to them. */
export function withSkirtGuide(p:PapercutProject,src:string):PapercutProject {
  if(p.reference&&p.reference.generatedBy!=='pleated-skirt-guide')return p;
  if(p.reference?.src===src)return p;
  const reference=p.reference?{...p.reference,src}:{src,generatedBy:'pleated-skirt-guide' as const,opacity:1,visible:true,onTop:false,x:0,y:0,width:p.width,height:p.height};
  return {...p,reference};
}
