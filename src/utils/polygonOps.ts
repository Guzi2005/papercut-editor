import clipping,{type MultiPolygon} from 'polygon-clipping';

type Operation='union'|'difference'|'intersection'|'xor';
/** Curve sampling can produce almost coincident edges; retry on a subpixel grid before failing. */
function rounded(shape:MultiPolygon,grid:number):MultiPolygon {
  return shape.map(poly=>poly.map(ring=>ring.map(p=>[Math.round(p[0]/grid)*grid,Math.round(p[1]/grid)*grid] as [number,number]).filter((p,i,list)=>!i||p[0]!==list[i-1][0]||p[1]!==list[i-1][1])).filter(ring=>ring.length>=3)).filter(poly=>poly.length);
}
export function polygonOperation(operation:Operation,...shapes:MultiPolygon[]):MultiPolygon {
  if(!shapes.length)return [];
  const call=(input:MultiPolygon[])=>clipping[operation](input[0],...input.slice(1));
  try{return call(shapes);}catch(original){
    for(const grid of [.0001,.001,.01]){
      const input=shapes.map(shape=>rounded(shape,grid));
      try{return call(input);}catch{
        try{return input.slice(1).reduce((result,shape)=>clipping[operation](result,shape),input[0]);}catch{/* Try the next precision. */}
      }
    }
    throw original;
  }
}
