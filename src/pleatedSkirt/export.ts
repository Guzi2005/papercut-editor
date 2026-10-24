import {strToU8,zipSync} from 'fflate';
import {parseDesign,type SkirtDesign,type CanvasView} from './model';
import {templateSVG} from './canvas';
import {paintTexture,pngBytes} from './texture';
export function skirtFiles(design:SkirtDesign,overlay?:CanvasImageSource):Record<string,Uint8Array>{
  const d=parseDesign(design),texture=document.createElement('canvas');texture.width=texture.height=1024;paintTexture(texture,d,overlay);
  const files:Record<string,Uint8Array>={'skirt.json':strToU8(JSON.stringify(d,null,2)),'skirt.png':pngBytes(texture)};
  for(const view of ['front','sector','ring'] as CanvasView[])files[`template-${view}.svg`]=strToU8(templateSVG(d,view));
  files['README.txt']=strToU8('百褶裙设计 v1\n将 skirt.json 与 skirt.png 放在同一目录；Godot 的 components/pleated_skirt.gd 可通过 load_design(路径) 读取。\nJSON 保留参数、身份、拼色片和矢量笔迹；PNG 为固定 UV 展开纹样。SVG 为设计视图，不是裁缝尺寸纸样。\n请同时保存完整 .weave.json 原稿，保留画板图层、矢量笔迹、图章、布料与 Item。单独裙子 JSON 不包含原画板图层。\n半圆环展开为同心圆正投影，无透视和非等比压缩；模板参考来源记录在 JSON 的 source 中。\n');return files;
}
export function skirtZip(d:SkirtDesign,overlay?:CanvasImageSource){return zipSync(skirtFiles(d,overlay),{level:6});}
