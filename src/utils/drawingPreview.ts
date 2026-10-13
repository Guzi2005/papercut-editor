export type DrawingPreviewMode='outline'|'filled';
const KEY='weave-drawing-preview-v1';

export function loadDrawingPreviewMode():DrawingPreviewMode {
  try{return localStorage.getItem(KEY)==='filled'?'filled':'outline';}catch{return 'outline';}
}
export function saveDrawingPreviewMode(mode:DrawingPreviewMode):void {
  try{localStorage.setItem(KEY,mode);}catch{/* Keep the session preference usable when storage is unavailable. */}
}
/** Every carving tool uses the same feedback, independent of its final cut/paste operation. */
export function drawingPreviewStyle(mode:DrawingPreviewMode,color:string,zoom:number){
  const scale=Number.isFinite(zoom)&&zoom>0?zoom:1;
  return mode==='filled'?{fill:color,fillOpacity:1,stroke:'none',strokeWidth:0,strokeDasharray:undefined}
    :{fill:'none',fillOpacity:0,stroke:'#2652D0',strokeWidth:1.8/scale,strokeDasharray:`${5/scale} ${3/scale}`};
}
