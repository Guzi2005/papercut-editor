import type { Point } from '../types/papercut';
import { IDENTITY, transformPathD } from './pathTransform';

export type NodeMode = 'corner' | 'smooth' | 'symmetric';
export interface VectorNode extends Point { incoming?: Point; outgoing?: Point; mode?: NodeMode }
export interface VectorContour { nodes: VectorNode[]; closed: boolean; relative: boolean }
export type VectorPath = VectorContour[];
const mix = (a: Point, b: Point, t = .5): Point => ({ x: a.x + (b.x-a.x)*t, y: a.y + (b.y-a.y)*t });
const reflect = (a: Point, center: Point): Point => ({ x: 2*center.x-a.x, y: 2*center.y-a.y });

/** Normalize SVG commands, keeping compound contours and exact cubic handles. Arcs use the shared SVG converter. */
export function parseVectorPath(d: string): VectorPath {
  const normalized = transformPathD(d, { map: (p: Point) => p, approx: IDENTITY });
  const tokens = normalized.match(/[a-z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/gi) ?? [];
  const result: VectorPath = [];
  let i = 0, current: VectorContour | undefined, p: Point = {x:0,y:0}, previous = '', quadratic: Point | undefined;
  const point = (): Point => ({x: Number(tokens[i++]), y: Number(tokens[i++])});
  while (i < tokens.length) {
    const command = tokens[i++], cmd = command.toUpperCase();
    if (cmd === 'M') {
      let n = point();
      if (command === 'm') n = {x:p.x+n.x,y:p.y+n.y};
      current = {nodes:[n], closed:false, relative:command === 'm'};
      result.push(current); p = n;
    } else if (cmd === 'Z' && current) {
      current.closed = true;
      const nodes = current.nodes, last = nodes[nodes.length-1], first = nodes[0];
      if (nodes.length > 1 && Math.hypot(last.x-first.x,last.y-first.y) < 1e-6) {
        first.incoming = last.incoming; nodes.pop();
      }
      p = first;
    } else if (current) {
      const last = current.nodes[current.nodes.length-1];
      let n: VectorNode;
      if (cmd === 'L') n = point();
      else if (cmd === 'C' || cmd === 'S') {
        const c1 = cmd === 'C' ? point() : (['C','S'].includes(previous) && last.incoming ? reflect(last.incoming, p) : {...p});
        const c2 = point(); n = {...point(), incoming:c2}; last.outgoing = c1;
      } else if (cmd === 'Q' || cmd === 'T') {
        const q = cmd === 'Q' ? point() : (['Q','T'].includes(previous) && quadratic ? reflect(quadratic,p) : {...p});
        n = point(); last.outgoing = mix(p,q,2/3); n.incoming = mix(n,q,2/3); quadratic = q;
      } else throw new Error(`无法编辑路径命令 ${command}`);
      current.nodes.push(n); p = n;
    } else throw new Error('路径缺少起点');
    previous = cmd;
  }
  if (result.some(c => c.nodes.some(n => [n,n.incoming,n.outgoing].some(p => p && (!Number.isFinite(p.x)||!Number.isFinite(p.y)))))) throw new Error('路径坐标无效');
  result.forEach(c => c.nodes.forEach(n => {
    n.mode = 'corner';
    if (!n.incoming || !n.outgoing) return;
    const ax=n.incoming.x-n.x, ay=n.incoming.y-n.y, bx=n.outgoing.x-n.x, by=n.outgoing.y-n.y;
    const a=Math.hypot(ax,ay), b=Math.hypot(bx,by);
    if (a*b > 1e-9 && Math.abs(ax*by-ay*bx)/(a*b) < 1e-4 && ax*bx+ay*by < 0) n.mode = Math.abs(a-b) < 1e-4 ? 'symmetric' : 'smooth';
  }));
  return result;
}

const fmt = (p: Point) => `${+p.x.toFixed(5)} ${+p.y.toFixed(5)}`;
export function segmentD(a: VectorNode, b: VectorNode): string {
  return a.outgoing || b.incoming ? `C ${fmt(a.outgoing ?? a)} ${fmt(b.incoming ?? b)} ${fmt(b)}` : `L ${fmt(b)}`;
}
export function serializeVectorPath(path: VectorPath): string {
  let previous: Point = {x:0,y:0};
  return path.map(c => {
    if (!c.nodes.length) return '';
    const first = c.nodes[0];
    const start = c.relative ? `m ${fmt({x:first.x-previous.x,y:first.y-previous.y})}` : `M ${fmt(first)}`;
    const segments = c.nodes.slice(1).map((n,i) => segmentD(c.nodes[i],n));
    if (c.closed && (c.nodes.at(-1)!.outgoing || first.incoming)) segments.push(segmentD(c.nodes.at(-1)!,first));
    previous = c.closed ? first : c.nodes.at(-1)!;
    return [start,...segments,c.closed ? 'Z' : ''].join(' ');
  }).join(' ');
}

export function splitSegment(contour: VectorContour, index: number, parameter = .5): void {
  const a = contour.nodes[index], b = contour.nodes[(index+1)%contour.nodes.length];
  if (!a || !b || (!contour.closed && index === contour.nodes.length-1)) return;
  const t = Math.max(.001, Math.min(.999, parameter));
  let n: VectorNode;
  if (a.outgoing || b.incoming) {
    const ab = mix(a,a.outgoing ?? a,t), bc = mix(a.outgoing ?? a,b.incoming ?? b,t), cd = mix(b.incoming ?? b,b,t);
    const abc = mix(ab,bc,t), bcd = mix(bc,cd,t);
    n = {...mix(abc,bcd,t), incoming:abc, outgoing:bcd, mode:'smooth'};
    a.outgoing = ab; b.incoming = cd;
  } else n = mix(a,b,t);
  contour.nodes.splice(index+1,0,n);
}

export function segmentPoint(a: VectorNode, b: VectorNode, t: number): Point {
  if(!a.outgoing && !b.incoming)return mix(a,b,t);
  const u=1-t, c=a.outgoing ?? a, d=b.incoming ?? b;
  return {x:u*u*u*a.x+3*u*u*t*c.x+3*u*t*t*d.x+t*t*t*b.x,y:u*u*u*a.y+3*u*u*t*c.y+3*u*t*t*d.y+t*t*t*b.y};
}

/** A coarse search followed by local refinement handles loops without assuming a monotonic curve. */
export function nearestSegmentParameter(a: VectorNode, b: VectorNode, point: Point): number {
  const distance=(t:number)=>{const p=segmentPoint(a,b,t);return (p.x-point.x)**2+(p.y-point.y)**2;};
  let best=0, minimum=Infinity;
  for(let i=0;i<=64;i++){const t=i/64,d=distance(t);if(d<minimum){minimum=d;best=t;}}
  let lo=Math.max(0,best-1/64),hi=Math.min(1,best+1/64);
  for(let i=0;i<24;i++){const a=lo+(hi-lo)/3,b=hi-(hi-lo)/3;if(distance(a)<distance(b))hi=b;else lo=a;}
  return Math.max(.001,Math.min(.999,(lo+hi)/2));
}

/** Move the grabbed location exactly by delta, distributing movement between both cubic handles. */
export function bendSegment(a: VectorNode,b: VectorNode,t:number,delta:Point):void {
  const u=1-t,w1=3*u*u*t,w2=3*u*t*t,denom=w1*w1+w2*w2;
  if(denom<1e-9)return;
  // A straight SVG segment has a linear cubic parameterisation, avoiding a jump when dragging begins.
  const c=a.outgoing ?? mix(a,b,1/3),d=b.incoming ?? mix(a,b,2/3);
  a.outgoing={x:c.x+delta.x*w1/denom,y:c.y+delta.y*w1/denom};
  b.incoming={x:d.x+delta.x*w2/denom,y:d.y+delta.y*w2/denom};
  a.mode='corner';b.mode='corner';
}

/** Moving a simple-mode node carries its handles; changing tools never reconstructs its curve. */
export function moveVectorNode(node:VectorNode,position:Point):void {
  const dx=position.x-node.x,dy=position.y-node.y;
  node.x=position.x;node.y=position.y;
  if(node.incoming)node.incoming={x:node.incoming.x+dx,y:node.incoming.y+dy};
  if(node.outgoing)node.outgoing={x:node.outgoing.x+dx,y:node.outgoing.y+dy};
}

export function setNodeMode(c: VectorContour, index: number, mode: NodeMode): void {
  const n = c.nodes[index]; n.mode = mode;
  if (mode === 'corner') return;
  const prev = c.nodes[(index-1+c.nodes.length)%c.nodes.length], next = c.nodes[(index+1)%c.nodes.length];
  const dx = next.x-prev.x, dy = next.y-prev.y, len = Math.hypot(dx,dy) || 1;
  const outLength = Math.hypot((n.outgoing ?? next).x-n.x,(n.outgoing ?? next).y-n.y)/(n.outgoing ? 1 : 3);
  const inLength = mode === 'symmetric' ? outLength : Math.hypot((n.incoming ?? prev).x-n.x,(n.incoming ?? prev).y-n.y)/(n.incoming ? 1 : 3);
  if (c.closed || index > 0) n.incoming = {x:n.x-dx/len*inLength,y:n.y-dy/len*inLength};
  if (c.closed || index < c.nodes.length-1) n.outgoing = {x:n.x+dx/len*outLength,y:n.y+dy/len*outLength};
}

export function moveHandle(n: VectorNode, side: 'incoming'|'outgoing', p: Point, independent = false): void {
  const other = side === 'incoming' ? 'outgoing' : 'incoming';
  const old = n[other]; n[side] = p;
  // Infer constraints from existing geometry after a save/reload.
  if (!independent && old && n.mode !== 'corner') {
    const dx = p.x-n.x, dy = p.y-n.y, length = Math.hypot(dx,dy);
    if (length > 1e-9) {
      const opposite = n.mode === 'symmetric' ? length : Math.hypot(old.x-n.x,old.y-n.y);
      n[other] = {x:n.x-dx/length*opposite,y:n.y-dy/length*opposite};
    }
  }
}
