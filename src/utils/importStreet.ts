import type { Layer, PapercutProject } from '../types/papercut';
import { transformPathD, multiply, IDENTITY, type Matrix } from './pathTransform';

// This adapter deliberately accepts the geometry used by cafe_street.svg, not arbitrary SVG.
export function importStreet(text: string): PapercutProject {
  const xml = new DOMParser().parseFromString(text, 'image/svg+xml');
  if (xml.querySelector('parsererror')) throw new Error('街景 SVG 无法解析');
  const layers: Record<string, Layer> = {};
  const groups: PapercutProject['groups'] = [];
  let serial = 0;
  const special: Record<string,string> = {'594 125':'左侧树木','1438 125':'右侧树木','1130 125':'中央树木','787 309':'左遮阳伞','1252 330':'右遮阳伞','64 119':'左窗饰','316 103':'右窗饰','1520 110':'右侧建筑','-8 874':'左前景植物','1605 874':'右前景植物'};
  const newGroup = (name: string) => { const g = {id:`street_group_${groups.length}`, name, collapsed:true, visible:true, locked:false, layerIds:[] as string[]}; groups.push(g); return g; };
  let current = newGroup('天空与远景');
  function visit(el: Element, parent: Matrix, group: typeof current) {
    let matrix = parent;
    const transform = el.getAttribute('transform') || '';
    for (const match of transform.matchAll(/(translate|scale)\(([^)]+)\)/g)) {
      const v=match[2].trim().split(/[ ,]+/).map(Number);
      const m: Matrix = match[1]==='translate' ? [1,0,0,1,v[0],v[1]||0] : [v[0],0,0,v[1]??v[0],0,0];
      matrix=multiply(matrix,m);
    }
    if (el.localName==='g' || el.localName==='svg') { for(const child of el.children) visit(child,matrix,group); return; }
    const n=(key:string)=>Number(el.getAttribute(key)||0);
    let d='';
    if(el.localName==='path') d=el.getAttribute('d')||'';
    else if(el.localName==='rect') {
      const x=n('x'),y=n('y'),w=n('width'),h=n('height');
      if(n('rx')||n('ry')) throw new Error('该 SVG 含圆角矩形，请扩展导入器后重试');
      d=`M${x} ${y}H${x+w}V${y+h}H${x}Z`;
    } else if(el.localName==='ellipse') {
      const x=n('cx'),y=n('cy'),rx=n('rx'),ry=n('ry');
      d=`M${x-rx} ${y}A${rx} ${ry} 0 1 0 ${x+rx} ${y}A${rx} ${ry} 0 1 0 ${x-rx} ${y}Z`;
    } else throw new Error(`不支持的街景元素：${el.localName}`);
    const id=`street_${String(++serial).padStart(4,'0')}`;
    const fill=el.getAttribute('fill')||'#000000', stroke=el.getAttribute('stroke');
    const path=transformPathD(d,matrix);
    const layer: Layer={id,name:`${group.name} · ${serial}`,kind:fill==='none'?'doodle':'paper',color:fill==='none'?(stroke||'#000000'):fill,
      texture:'smooth',grain:0,opacity:Number(el.getAttribute('opacity')??1),blendMode:'normal',visible:true,locked:false,
      baseShape:{type:'freeform',d:fill==='none'?'':path},cutouts:[],positiveElements:[],drawings:[],unclippedDrawings:true};
    if(stroke) layer.drawings=[{id:`${id}_stroke`,brushType:'pen',d:path,color:stroke,opacity:1,
      strokeWidth:Number(el.getAttribute('stroke-width')||1)*Math.sqrt(Math.abs(matrix[0]*matrix[3]-matrix[1]*matrix[2])),
      strokeLinecap:(el.getAttribute('stroke-linecap')||'butt') as 'round',strokeLinejoin:(el.getAttribute('stroke-linejoin')||'miter') as 'round'}];
    layers[id]=layer;group.layerIds.push(id);
  }
  for(const child of xml.documentElement.children) {
    if(child.localName==='g') {
      const key=/translate\(([^)]+)\)/.exec(child.getAttribute('transform')||'')?.[1]||'';
      visit(child,IDENTITY,newGroup(special[key]||'街景装饰'));
      current=newGroup('街景色块与线条');
    } else visit(child,IDENTITY,current);
  }
  const populated=groups.filter(g=>g.layerIds.length);
  const items=populated.filter(g=>Object.values(special).includes(g.name)).map(g=>{
    const origin=Object.keys(special).find(key=>special[key]===g.name)!.split(' ').map(Number);
    return {id:g.id.replace('group','item'),name:g.name,partIds:[...g.layerIds],pivot:{x:origin[0],y:origin[1]},sockets:[]};
  });
  return {id:'airswiper_cafe_street',name:'羽毛咖啡馆 · 街景',width:1600,height:900,layers,groups:populated,
    rootOrder:populated.map(g=>({type:'group',id:g.id})),items,backgroundColor:'#f7edbe',backgroundStyle:'clean_white',
    paperMode:'vector',shadowStrength:0,canvasBg:{kind:'transparent',display:'light'}};
}
