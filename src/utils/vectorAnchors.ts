import type {CutoutPath,Point} from '../types/papercut';
import {parseVectorPath,serializeVectorPath,moveVectorNode} from './vectorPath';
import {strokeOutline,type StrokeStyle} from './strokePath';
import {applySymmetry} from './symmetry';

/** Legacy baked copies without source metadata are edited as full curves, never rebuilt as a polygon. */
export function editableStroke(cutout:CutoutPath):StrokeStyle|undefined {
  if(!cutout.stroke||!cutout.points?.length)return;
  return cutout.symmetrySource||cutout.d===strokeOutline(cutout.points,cutout.stroke)?cutout.stroke:undefined;
}

export function cutoutAnchors(cutout:CutoutPath):Point[]{
  if(editableStroke(cutout))return cutout.points!.map(p=>({...p}));
  try{return parseVectorPath(cutout.symmetrySource?.d??cutout.d).flatMap(c=>c.nodes.map(({x,y})=>({x,y})));}
  catch{return [];}
}

export function reviseCutoutAnchors(cutout:CutoutPath,anchors:Point[]):Partial<CutoutPath>{
  const stroke=editableStroke(cutout);
  let sourceD:string,vectorNodeModes:CutoutPath['vectorNodeModes'];
  if(stroke)sourceD=strokeOutline(anchors,stroke);
  else {
    const path=parseVectorPath(cutout.symmetrySource?.d??cutout.d);let i=0;
    path.forEach(c=>c.nodes.forEach(n=>{if(anchors[i])moveVectorNode(n,anchors[i]);i++;}));
    vectorNodeModes=path.map((c,ci)=>c.nodes.map((n,ni)=>cutout.vectorNodeModes?.[ci]?.[ni]??n.mode??'corner'));
    sourceD=serializeVectorPath(path);
  }
  const symmetrySource=cutout.symmetrySource?{...cutout.symmetrySource,d:sourceD}:undefined;
  return {d:symmetrySource?applySymmetry(sourceD,symmetrySource.matrices):sourceD,symmetrySource,
    ...(stroke?{points:anchors}:{points:undefined,geomType:undefined,stroke:undefined,vectorNodeModes})};
}
