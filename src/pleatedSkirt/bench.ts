import type {MeshData} from './geometry';
export type BenchMesh=MeshData & {colors:Float32Array};
interface BenchAsset {version:number;source:string;vertexCount:number;indexCount:number}
let pending:Promise<BenchMesh>|undefined;
/** Actual game geometry, including cushions. Binary arrays avoid a 24 MB JSON parse. */
export async function loadBench(lying:boolean):Promise<BenchMesh>{
 const asset=await (pending??=Promise.all([
  fetch('/pleated-avatar/bench.json').then(r=>{if(!r.ok)throw Error('长椅资料载入失败');return r.json() as Promise<BenchAsset>;}),
  fetch('/pleated-avatar/bench.bin').then(r=>{if(!r.ok)throw Error('长椅模型载入失败');return r.arrayBuffer();}),
 ]).then(([m,buffer])=>{
  const n=m.vertexCount*3;
  if(m.version!==1||!Number.isInteger(m.vertexCount)||m.vertexCount<1||m.vertexCount>500000||!Number.isInteger(m.indexCount)||m.indexCount<1||buffer.byteLength!==(n*3+m.indexCount)*4)throw Error('长椅模型格式无效');
  return {positions:new Float32Array(buffer,0,n),normals:new Float32Array(buffer,n*4,n),colors:new Float32Array(buffer,n*8,n),indices:new Uint32Array(buffer,n*12,m.indexCount),uvs:new Float32Array(m.vertexCount*2)};
 }).catch(e=>{pending=undefined;throw e;}));
 const positions=asset.positions.slice(),offset=lying?[-.90,-1.04,-.18]:[0,.22,-.30];
 for(let i=0;i<positions.length;i++)positions[i]+=offset[i%3];
 return {...asset,positions};
}
