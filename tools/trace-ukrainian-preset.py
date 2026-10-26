"""Build vector-only preset data from the user's reference (Pillow + VTracer)."""
import argparse
import json
import sys
from pathlib import Path
from tempfile import TemporaryDirectory
from xml.etree import ElementTree as ET

from PIL import Image, ImageDraw, ImageFilter, ImageOps

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('source', type=Path)
parser.add_argument('output', type=Path)
parser.add_argument('--vtracer-vendor', type=Path)
args = parser.parse_args()
if args.vtracer_vendor:
    sys.path.insert(0, str(args.vtracer_vendor))
import vtracer

source = Image.open(args.source).convert('RGB')
assert source.size == (423, 584), 'Expected the supplied Ukraine papercuts reference'
# Use one half as a folded-paper master. Chromatic threshold keeps warm white paper,
# while rejecting the blue backing, compression noise and photographic shading.
half = Image.new('L', (212, 562))
for y in range(526):
    for x in range(212):
        r, g, b = source.getpixel((x, y))
        half.putpixel((x, y), 255 if min(r, g, b) > 128 and b - r < 65 else 0)
half = half.filter(ImageFilter.MedianFilter(3))
# The printed caption occludes the roots. Reconstruct only this small bottom strip:
# tree trunk, figure feet, flower stem and a continuous gently arched ground.
draw = ImageDraw.Draw(half)
draw.polygon([(193,510),(211,510),(211,553),(188,553)], fill=255)
draw.polygon([(91,515),(100,515),(99,549),(90,549)], fill=255)
draw.polygon([(121,515),(130,515),(132,548),(123,548)], fill=255)
draw.polygon([(19,510),(25,510),(20,550),(13,550)], fill=255)
draw.polygon([(6,554),(18,546),(80,542),(151,545),(211,539),(211,561),(6,561)], fill=255)
with TemporaryDirectory() as tmp:
    bitmap, svg = Path(tmp)/'paper.png', Path(tmp)/'paper.svg'
    ImageOps.invert(half).convert('RGB').save(bitmap)
    vtracer.convert_image_to_svg_py(str(bitmap),str(svg),colormode='binary',
        mode='spline',filter_speckle=6,corner_threshold=65,length_threshold=3,
        splice_threshold=45,path_precision=2)
    root = ET.parse(svg).getroot()
    paths = [{'d':p.attrib['d'], 'transform':p.attrib.get('transform','')}
             for p in root.iter() if p.tag.endswith('}path')]
args.output.write_text('// Traced from the user-supplied Ukraine papercuts.jpg.\n'
    '// Left half mirrored; caption strip reconstructed, no embedded raster.\n'
    'export const UKRAINIAN_TRACE = '+json.dumps(paths,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
print(f'{len(paths)} vector paths -> {args.output}')
