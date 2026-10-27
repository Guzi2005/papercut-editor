"""Trace only the six toy silhouettes from the supplied Chinese Toys reference.

Requires Pillow, numpy and VTracer. Original reference is never modified.
Colored fragments are deliberately excluded. Paper construction and painted decoration
are authored semantically in chineseToysPreset.ts; the trace provides outer edges only.
"""
import argparse
import json
import re
import sys
from pathlib import Path
from tempfile import TemporaryDirectory
from xml.etree import ElementTree as ET
import numpy as np
from PIL import Image, ImageDraw, ImageOps, ImageFilter

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('source', type=Path)
parser.add_argument('output', type=Path)
parser.add_argument('--vtracer-vendor', type=Path)
args = parser.parse_args()
if args.vtracer_vendor:
    sys.path.insert(0, str(args.vtracer_vendor))
import vtracer

palette = ['#2F51BD','#F77130','#FA5BB2','#DB3430','#2D2835','#EDE4E3',
           '#F4EA92','#B7D7B7','#346765','#8EC3D4','#82558B','#9F9170']
rgb = np.array([tuple(bytes.fromhex(c[1:])) for c in palette], dtype=np.int32)
source = Image.open(args.source).convert('RGB')
assert source.size == (500,500)
arr = np.array(source,dtype=np.int32)
labels = ((arr[:,:,None,:]-rgb[None,None,:,:])**2).sum(axis=3).argmin(axis=2)
labels[(arr[:,:,2]>arr[:,:,0]*1.5)&(arr[:,:,2]>arr[:,:,1]*1.4)&(arr[:,:,0]<90)] = 0
labels=np.array(Image.fromarray(labels.astype('uint8')).filter(ImageFilter.ModeFilter(3)))

def box(x0,y0,x1,y1):
    return [(x0,y0),(x1,y0),(x1,y1),(x0,y1)]

# Object ownership masks follow the visible silhouettes; they are not exported.
parts = [
 ('horse','泥马与骑手','toys',[(39,343),(75,343),(77,381),(115,381),(115,489),(11,489),(11,408),(29,408),(33,379)]),
 ('rooster','泥鸡','toys',box(129,382,191,444)),
 ('black_horse','黑泥马','toys',box(197,369,253,424)),
 ('blue_lion','蓝泥狮','toys',box(150,430,248,499)),
 ('yellow_lion','黄泥狮','toys',box(263,362,408,474)),
 ('doll','彩绘泥娃娃','toys',box(417,369,495,496)),
]
cords = [
 [[38,0],[38,18]],[[40,46],[38,62]],[[36,93],[34,117]],[[34,155],[34,178]],[[34,207],[34,230]],[[33,252],[32,270]],
 [[98,0],[98,18]],[[99,41],[98,56]],[[98,92],[98,113]],[[97,142],[96,156]],[[94,188],[94,200]],
 [[157,33],[155,46]],[[155,74],[155,90]],[[154,115],[154,130]],
 [[218,0],[218,18]],[[217,47],[217,58]],[[217,82],[216,99]],[[216,132],[216,141]],
 [[277,0],[277,4]],[[276,33],[276,49]],[[276,77],[276,90]],[[274,117],[274,132]],
 [[335,22],[334,51]],[[335,81],[336,96]],[[394,0],[394,23]],[[394,46],[393,62]],
 [[455,0],[455,23]],[[454,51],[454,67]],[[453,96],[454,112]],
]
def trace(mask, directory):
    ImageOps.invert(Image.fromarray(mask.astype('uint8')*255)).convert('RGB').save(directory/'part.png')
    vtracer.convert_image_to_svg_py(str(directory/'part.png'),str(directory/'part.svg'),
        colormode='binary',mode='spline',filter_speckle=5,
        corner_threshold=65,length_threshold=2.5,splice_threshold=45,path_precision=2)
    root=ET.parse(directory/'part.svg').getroot()
    result=[]
    for p in root.iter():
        if p.tag.endswith('}path'):
            t=[float(n) for n in re.findall(r'-?\d+(?:\.\d+)?',p.attrib.get('transform','translate(0,0)'))]
            result.append({'d':p.attrib['d'],'offset':t})
    return result

out=[]
with TemporaryDirectory() as tmp:
    directory=Path(tmp)
    for ident,name,group,region in parts:
        mask=Image.new('L',(500,500)); draw=ImageDraw.Draw(mask)
        draw.polygon(region,fill=255)
        owned=(np.array(mask)>0)&(labels!=0)&(labels!=1)
        out.append({'id':ident,'name':name,'outline':trace(owned,directory)})
args.output.write_text('// Reference: user-supplied Chinese Toys illustration, 500 × 500.\n'
    '// Six toy silhouettes only. Paper and paint are reconstructed in chineseToysPreset.ts.\n'
    'export const CHINESE_TOY_PARTS = '+json.dumps(out,ensure_ascii=False,separators=(',',':'))+';\n'
    'export const CHINESE_TOY_CORDS = '+json.dumps(cords,separators=(',',':'))+';\n',encoding='utf-8')
print(f'{len(out)} toy silhouettes; no traced colored fragments')
