import type {PapercutProject,Layer} from '../types/papercut';
import {IDENTITY,multiply,transformPathD,type Matrix} from './pathTransform';
export type VectorAsset={id:string;name:string;documentId:string;width:number;height:number;importer?:string};

/** Editable, flat SVG geometry. Unsupported compositing fails explicitly instead of flattening to a bitmap. */
export function importVectorAsset(text:string,asset:VectorAsset):PapercutProject {
  const xml=new DOMParser().parseFromString(text,'image/svg+xml');
  if(xml.querySelector('parsererror')||xml.documentElement.localName!=='svg')throw new Error('SVG 解析失败');
  const root=xml.documentElement;
  const vb=(root.getAttribute('viewBox')||`0 0 ${root.getAttribute('width')} ${root.getAttribute('height')}`).trim().split(/[ ,]+/).map(Number);
  if(vb.length!==4||vb[0]!==0||vb[1]!==0||vb[2]!==asset.width||vb[3]!==asset.height)throw new Error('SVG 的 viewBox 必须与资产配置的尺寸一致，并从 0,0 开始');
  const layers:Record<string,Layer>={},order:string[]=[];let serial=0;
  function visit(el:Element,parent:Matrix,inherited:Record<string,string>,alpha:number,hidden=false){
    if(['title','desc','metadata'].includes(el.localName))return;
    if(!['svg','g','path','rect','circle','ellipse','polygon','polyline','line'].includes(el.localName))throw new Error(`暂不支持 SVG 的 ${el.localName}；请保留原稿或在原工具中转为路径`);
    const attrs={...inherited};
    for(const key of ['fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','fill-opacity','stroke-opacity','fill-rule','display','visibility'])if(el.hasAttribute(key))attrs[key]=el.getAttribute(key)!;
    for(const declaration of (el.getAttribute('style')||'').split(';')){const [k,v]=declaration.split(':');if(k?.trim()&&v)attrs[k.trim()]=v.trim();}
    if(['stroke-dasharray','stroke-dashoffset','vector-effect','class','transform'].some(k=>k==='transform'?!!attrs[k]:el.hasAttribute(k)||!!attrs[k]))throw new Error('此 SVG 含尚未支持的描边或 CSS 样式，请先转为普通路径');
    if(['mask','clip-path','filter','transform-origin'].some(k=>el.hasAttribute(k)||attrs[k])||attrs['mix-blend-mode']||attrs['fill-rule']==='evenodd'||Object.values(attrs).some(v=>v.includes('url(')))throw new Error('此 SVG 含遮罩、滤镜或特殊填充，请使用对应的 .weave.json 原稿');
    const opacity=alpha*Number(el.getAttribute('opacity')||attrs.opacity||1);delete attrs.opacity;
    hidden=hidden||attrs.display==='none';
    if(!Number.isFinite(opacity)||opacity<0||opacity>1)throw new Error('无效的不透明度');
    let m=parent;const transform=el.getAttribute('transform')||'';
    const matches=[...transform.matchAll(/([A-Za-z]+)\(([^)]+)\)/g)];
    if(transform.replace(/([A-Za-z]+)\(([^)]+)\)/g,'').trim())throw new Error('无法解析 SVG 变换');
    for(const match of matches){
      const v=match[2].trim().split(/[ ,]+/).map(Number);let t:Matrix;
      if(v.some(n=>!Number.isFinite(n)))throw new Error('无效的变换坐标');
      switch(match[1]){
        case 'translate':t=[1,0,0,1,v[0],v[1]||0];break;
        case 'scale':t=[v[0],0,0,v[1]??v[0],0,0];break;
        case 'matrix':if(v.length!==6)throw new Error('无效 matrix');t=v as Matrix;break;
        case 'rotate':{const a=v[0]*Math.PI/180,c=Math.cos(a),s=Math.sin(a),x=v[1]||0,y=v[2]||0;t=[c,s,-s,c,x-c*x+s*y,y-s*x-c*y];break;}
        default:throw new Error(`不支持 ${match[1]} 变换`);
      }
      m=multiply(m,t);
    }
    if(el.localName==='g'||el.localName==='svg'){
      if(opacity!==1)throw new Error('半透明 SVG 分组需保留 .weave.json 原稿，不能拆成独立透明部件');
      for(const child of el.children)visit(child,m,attrs,opacity,hidden);return;
    }
    const n=(k:string,f=0)=>{const value=el.hasAttribute(k)?Number(el.getAttribute(k)):f;if(!Number.isFinite(value))throw new Error('几何坐标必须是数字');return value;};
    let d=el.getAttribute('d')||'';
    if(el.localName==='rect'){
      const x=n('x'),y=n('y'),w=n('width'),h=n('height'),rx=Math.min(w/2,n('rx',n('ry'))),ry=Math.min(h/2,n('ry',rx));
      d=rx&&ry?`M${x+rx} ${y}H${x+w-rx}A${rx} ${ry} 0 0 1 ${x+w} ${y+ry}V${y+h-ry}A${rx} ${ry} 0 0 1 ${x+w-rx} ${y+h}H${x+rx}A${rx} ${ry} 0 0 1 ${x} ${y+h-ry}V${y+ry}A${rx} ${ry} 0 0 1 ${x+rx} ${y}Z`:`M${x} ${y}H${x+w}V${y+h}H${x}Z`;
    }else if(el.localName==='ellipse'||el.localName==='circle'){
      const x=n('cx'),y=n('cy'),rx=n('rx',n('r')),ry=n('ry',n('r'));d=`M${x-rx} ${y}A${rx} ${ry} 0 1 0 ${x+rx} ${y}A${rx} ${ry} 0 1 0 ${x-rx} ${y}Z`;
    }else if(['polygon','polyline'].includes(el.localName)){
      const points=(el.getAttribute('points')||'').trim().split(/[ ,]+/).map(Number);if(points.length%2||points.some(n=>!Number.isFinite(n)))throw new Error('无效 points');
      d=points.reduce((s,n,i)=>s+(i%2===0?(i?' L':'M'):' ')+n,'')+(el.localName==='polygon'?' Z':'');
    }else if(el.localName==='line')d=`M${n('x1')} ${n('y1')}L${n('x2')} ${n('y2')}`;
    const fill=el.localName==='line'?'none':attrs.fill||'#000000',stroke=attrs.stroke||'none',id=`svg_${++serial}`,transformed=transformPathD(d,m);
    const l:Layer={id,name:el.getAttribute('data-name')||el.getAttribute('id')||`${asset.name} · ${serial}`,kind:'doodle',color:fill==='none'?stroke:fill,texture:'smooth',opacity,blendMode:'normal',visible:!hidden&&attrs.visibility!=='hidden',locked:false,baseShape:{type:'freeform',d:''},cutouts:[],positiveElements:[],drawings:[],unclippedDrawings:true,grain:0};
    if(fill!=='none') {l.kind='paper';l.baseShape.d=transformed;if(Number(attrs['fill-opacity']??1)!==1){l.kind='doodle';l.baseShape.d='';l.drawings!.push({id:id+'_fill',brushType:'pen',d:transformed,color:fill,opacity:Number(attrs['fill-opacity']),strokeWidth:0,fill:true});}}
    if(stroke!=='none'){
      const sx=Math.hypot(m[0],m[1]),sy=Math.hypot(m[2],m[3]);
      if(Math.abs(sx-sy)>0.0001||Math.abs(m[0]*m[2]+m[1]*m[3])>0.0001)throw new Error('非均匀缩放的描边需先转为轮廓');
      l.drawings!.push({id:id+'_stroke',brushType:'pen',d:transformed,color:stroke,opacity:Number(attrs['stroke-opacity']??1),strokeWidth:Number(attrs['stroke-width']??1)*sx,strokeLinecap:(attrs['stroke-linecap']||'butt') as 'round',strokeLinejoin:(attrs['stroke-linejoin']||'miter') as 'round'});
    }
    layers[id]=l;order.push(id);
  }
  visit(root,IDENTITY,{},1);
  return {id:asset.documentId,name:asset.name,width:asset.width,height:asset.height,layers,groups:[],rootOrder:order.map(id=>({type:'layer',id})),items:[],paperMode:'vector',backgroundColor:'#fff8dd',backgroundStyle:'clean_white',canvasBg:{kind:'transparent',display:'light'}};
}
