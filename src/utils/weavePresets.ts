/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Layer, LayerGroup, LayerPattern, PapercutItem, PapercutProject, CutoutPath } from '../types/papercut';
import { FISH_CUTS, FISH_PAPER_EDGE } from './doubleFishTrace';

// All helpers emit clockwise subpaths so compound shapes union cleanly under nonzero fill.
const circle = (cx: number, cy: number, r: number) =>
  `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} Z`;
const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
  `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 1 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 1 ${cx - rx} ${cy} Z`;
const rect = (x: number, y: number, w: number, h: number) => `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
const diamond = (cx: number, cy: number, r: number) =>
  `M ${cx} ${cy - r} L ${cx + r} ${cy} L ${cx} ${cy + r} L ${cx - r} ${cy} Z`;

/** Stacked willow-leaf lobes, the papercut way of drawing a braid. */
function braid(x: number, y0: number, lobes: number, len = 38, step = 28, w = 13): string {
  const parts: string[] = [];
  for (let i = 0; i < lobes; i++) {
    const y1 = y0 + i * step;
    const y2 = y1 + len;
    const cx = x + (i % 2 === 0 ? -2 : 2);
    const mid = (y1 + y2) / 2;
    parts.push(`M ${cx} ${y1} Q ${cx + w} ${mid} ${cx} ${y2} Q ${cx - w} ${mid} ${cx} ${y1} Z`);
  }
  return parts.join(' ');
}

let seq = 0;
const piece = (name: string, d: string, color: string, isHole = false): CutoutPath => ({
  id: `wv_${++seq}`,
  name,
  type: 'custom_polygon',
  d,
  isHole,
  fillColor: isHole ? undefined : color,
  createdAt: seq,
});

function paper(
  id: string,
  name: string,
  color: string,
  base: string,
  extra: { holes?: CutoutPath[]; appliques?: CutoutPath[]; pattern?: LayerPattern; grain?: number; opacity?: number } = {}
): Layer {
  return {
    id,
    name,
    color,
    texture: 'xuan',
    opacity: extra.opacity ?? 1,
    blendMode: 'normal',
    visible: true,
    locked: false,
    grain: extra.grain ?? 0.4,
    baseShape: { type: 'freeform', d: base },
    cutouts: extra.holes || [],
    positiveElements: extra.appliques || [],
    drawings: [],
    pattern: extra.pattern,
  };
}

const C = {
  indigo: '#2E58D6',
  deepIndigo: '#16358F',
  navy: '#1B2352',
  slate: '#6C73A4',
  wisteria: '#A4A9E0',
  mist: '#C6D6F2',
  plum: '#52253A',
  madder: '#BD5A63',
  blush: '#E48C8C',
  skin: '#F2D2B6',
  cotton: '#F6EEE2',
  paper: '#FCFAF6',
  green: '#2F6E59',
  walnut: '#7E5E4F',
  ink: '#15161C',
};

function face(cx: number, cy: number, rx: number, ry: number, id: string, name: string): Layer {
  return paper(id, name, C.skin, ellipse(cx, cy, rx, ry), {
    grain: 0.3,
    appliques: [
      piece('颈', rect(cx - 11, cy + ry - 8, 22, 20), C.skin),
      piece('左眼', ellipse(cx - 21, cy + 6, 4.5, 6), C.ink),
      piece('右眼', ellipse(cx + 21, cy + 6, 4.5, 6), C.ink),
      piece('左腮红', circle(cx - 33, cy + 26, 9), C.blush),
      piece('右腮红', circle(cx + 33, cy + 26, 9), C.blush),
      piece('嘴', `M ${cx - 8} ${cy + 38} Q ${cx} ${cy + 47} ${cx + 8} ${cy + 38} Q ${cx} ${cy + 42} ${cx - 8} ${cy + 38} Z`, C.madder),
    ],
  });
}

export function createWeaveCharactersPreset(): PapercutProject {
  seq = 0;
  const layers: Record<string, Layer> = {};
  const add = (l: Layer) => (layers[l.id] = l);

  // ---------- 远景 ----------
  add(
    paper('wv_rug', '条纹地毯', C.mist, rect(110, 686, 380, 52), {
      pattern: { type: 'stripes', color: C.wisteria, scale: 34, angle: 0, opacity: 0.9 },
      grain: 0.5,
    })
  );
  add(
    paper('wv_banner', '菱花挂布', C.indigo, 'M 820 118 H 944 V 256 L 882 284 L 820 256 Z', {
      holes: [piece('三菱纹', `${diamond(852, 190, 14)} ${diamond(882, 190, 14)} ${diamond(912, 190, 14)}`, C.paper, true)],
      appliques: [piece('挂杆', rect(806, 108, 152, 10), C.walnut)],
    })
  );

  // ---------- 家具 ----------
  add(paper('wv_counter_back', '柜台·后板', C.walnut, rect(486, 520, 328, 180), { grain: 0.55 }));
  add(
    paper('wv_counter_front', '柜台·前挡', C.plum, rect(470, 560, 360, 160), {
      grain: 0.5,
      appliques: [
        piece('台面', rect(458, 546, 384, 18), '#3B1A2A'),
        piece(
          '桌布',
          'M 560 566 H 720 V 664 L 700 652 L 680 664 L 660 652 L 640 664 L 620 652 L 600 664 L 580 652 L 560 664 Z',
          C.cotton
        ),
        piece('桌布菱花', `${diamond(610, 610, 12)} ${diamond(640, 610, 12)} ${diamond(670, 610, 12)}`, C.indigo),
      ],
    })
  );

  // ---------- 辫子眼镜姑娘 ----------
  add(
    paper(
      'wv_girl_hair_back',
      '姑娘·后发',
      C.ink,
      'M 238 300 C 232 236 266 212 300 212 C 334 212 368 236 362 300 L 366 364 L 234 364 Z',
      { grain: 0.25 }
    )
  );
  add(
    paper(
      'wv_girl_robe',
      '姑娘·长袍',
      C.cotton,
      'M 280 352 L 320 352 L 372 378 L 394 522 L 366 528 L 356 452 L 398 680 L 202 680 L 244 452 L 234 528 L 206 522 L 228 378 Z',
      {
        appliques: [
          piece('拼色前襟', 'M 284 410 L 316 410 L 332 668 L 268 668 Z', C.wisteria),
          piece('袖口左', 'M 206 510 L 234 516 L 234 528 L 206 522 Z', C.indigo),
          piece('袖口右', 'M 366 516 L 394 510 L 394 522 L 366 528 Z', C.indigo),
          piece('下摆', 'M 204 660 L 396 660 L 398 680 L 202 680 Z', C.indigo),
          piece('左手', circle(220, 538, 11), C.skin),
          piece('右手', circle(380, 538, 11), C.skin),
          piece('左鞋', 'M 258 680 H 294 V 700 H 250 Q 250 684 258 680 Z', C.navy),
          piece('右鞋', 'M 306 680 H 342 Q 350 684 350 700 H 306 Z', C.navy),
        ],
      }
    )
  );
  add(
    paper('wv_girl_scarf', '姑娘·靛蓝长围巾', C.indigo, `M 262 360 L 286 356 L 278 604 L 252 604 Z M 314 356 L 338 360 L 348 604 L 322 604 Z`, {
      pattern: { type: 'diamond', color: C.paper, scale: 22, angle: 0, opacity: 0.95 },
      appliques: [
        piece('流苏左', 'M 252 604 H 278 L 276 618 L 272 606 L 268 618 L 264 606 L 260 618 L 256 606 L 252 618 Z', C.deepIndigo),
        piece('流苏右', 'M 322 604 H 348 L 348 618 L 344 606 L 340 618 L 336 606 L 332 618 L 328 606 L 324 618 Z', C.deepIndigo),
      ],
    })
  );
  add(face(300, 300, 58, 66, 'wv_girl_face', '姑娘·脸'));
  add(
    paper(
      'wv_girl_bangs',
      '姑娘·刘海',
      C.ink,
      'M 236 314 C 232 250 262 222 300 222 C 338 222 368 250 364 314 L 352 320 C 352 298 346 286 338 280 L 330 290 L 318 278 L 306 292 L 294 278 L 282 292 L 270 278 L 262 286 C 256 292 250 302 248 320 Z',
      {
        grain: 0.25,
        holes: [piece('发缝', 'M 300 226 Q 305 240 300 256 Q 295 240 300 226 Z', C.paper, true)],
      }
    )
  );
  add(
    paper('wv_girl_braids', '姑娘·双辫', C.ink, `${braid(236, 318, 6)} ${braid(364, 318, 6)}`, {
      grain: 0.25,
      appliques: [
        piece('左发绳', diamond(236, 492, 8), C.indigo),
        piece('右发绳', diamond(364, 492, 8), C.indigo),
      ],
    })
  );
  add(
    paper('wv_girl_glasses', '姑娘·眼镜', C.navy, `${circle(279, 306, 15)} ${circle(321, 306, 15)} ${rect(294, 303, 12, 4)}`, {
      grain: 0,
      holes: [piece('左镜片', circle(279, 306, 12), C.paper, true), piece('右镜片', circle(321, 306, 12), C.paper, true)],
    })
  );

  // ---------- 贝雷帽少年 ----------
  add(
    paper(
      'wv_boy_body',
      '少年·外套',
      C.cotton,
      'M 612 388 L 668 388 L 712 420 L 726 562 L 700 568 L 692 482 L 700 700 L 580 700 L 588 482 L 580 568 L 554 562 L 568 420 Z',
      {
        appliques: [
          piece('左襟', 'M 612 388 L 628 388 L 640 470 L 600 700 L 580 700 L 588 482 Z', C.wisteria),
          piece('领带', 'M 634 392 L 646 392 L 650 470 L 640 484 L 630 470 Z', C.navy),
          piece('袖口左', 'M 554 548 L 582 554 L 580 568 L 554 562 Z', C.indigo),
          piece('袖口右', 'M 698 554 L 726 548 L 726 562 L 700 568 Z', C.indigo),
          piece('左手', circle(567, 576, 11), C.skin),
          piece('右手', circle(713, 576, 11), C.skin),
        ],
      }
    )
  );
  add(face(640, 330, 54, 60, 'wv_boy_face', '少年·脸'));
  add(
    paper(
      'wv_boy_hair',
      '少年·短发',
      C.ink,
      'M 584 342 C 580 282 606 264 640 264 C 674 264 700 282 696 342 L 684 356 L 682 320 C 662 306 618 306 598 320 L 596 356 Z',
      { grain: 0.25 }
    )
  );
  add(
    paper(
      'wv_boy_beret',
      '少年·贝雷帽',
      C.indigo,
      'M 572 292 C 570 250 640 232 702 252 C 724 260 722 286 706 294 C 672 302 610 304 572 292 Z M 648 244 L 654 228 L 660 244 Z',
      {
        appliques: [piece('帽檐', 'M 580 290 C 620 300 670 298 706 292 L 706 300 C 670 308 620 309 578 298 Z', C.navy)],
      }
    )
  );

  const group = (id: string, name: string, layerIds: string[]): LayerGroup => ({
    id,
    name,
    collapsed: false,
    visible: true,
    locked: false,
    layerIds,
  });

  const groups = [
    group('wv_grp_back', '远景', ['wv_rug', 'wv_banner']),
    group('wv_grp_furn_back', '家具·后', ['wv_counter_back']),
    group('wv_grp_char_back', '角色·后', ['wv_girl_hair_back']),
    group('wv_grp_char_body', '角色·身体', ['wv_girl_robe', 'wv_girl_scarf', 'wv_boy_body']),
    group('wv_grp_char_head', '角色·头部', ['wv_girl_face', 'wv_boy_face']),
    group('wv_grp_char_front', '角色·前饰', ['wv_girl_bangs', 'wv_girl_braids', 'wv_girl_glasses', 'wv_boy_hair', 'wv_boy_beret']),
    group('wv_grp_fore', '前景', ['wv_counter_front']),
  ];

  const items: PapercutItem[] = [
    {
      id: 'wv_item_girl',
      name: '辫子眼镜姑娘',
      partIds: ['wv_girl_hair_back', 'wv_girl_robe', 'wv_girl_scarf', 'wv_girl_face', 'wv_girl_bangs', 'wv_girl_braids', 'wv_girl_glasses'],
      pivot: { x: 300, y: 700 },
      sockets: [
        { id: 'wv_s_girl_hand', name: 'hand_r', x: 380, y: 538 },
        { id: 'wv_s_girl_head', name: 'head_top', x: 300, y: 214 },
      ],
    },
    {
      id: 'wv_item_boy',
      name: '贝雷帽少年',
      partIds: ['wv_boy_body', 'wv_boy_face', 'wv_boy_hair', 'wv_boy_beret'],
      pivot: { x: 640, y: 700 },
      sockets: [{ id: 'wv_s_boy_hand', name: 'hand_r', x: 713, y: 576 }],
    },
    {
      id: 'wv_item_counter',
      name: '布料柜台',
      partIds: ['wv_counter_back', 'wv_counter_front'],
      pivot: { x: 650, y: 720 },
      sockets: [{ id: 'wv_s_counter_top', name: 'counter_top', x: 650, y: 546 }],
    },
  ];

  return {
    id: 'proj_weave_characters',
    name: '织游角色 · 造型拼装',
    width: 1000,
    height: 800,
    groups,
    layers,
    rootOrder: groups.map((g) => ({ type: 'group' as const, id: g.id })),
    items,
    backgroundColor: '#FCFAF6',
    backgroundStyle: 'rice_paper',
    shadowStrength: 0.45,
  };
}

// ---------- 波兰剪纸 · 夜骑白马的天使 ----------

type P = { x: number; y: number };
const pt = (x: number, y: number): P => ({ x, y });
const fmt = (n: number) => String(Math.round(n * 10) / 10);
const poly = (pts: P[]) => `M ${pts.map((p) => `${fmt(p.x)} ${fmt(p.y)}`).join(' L ')} Z`;

/** A straight paper strip of width w from a to b (reins, straps, stripes). */
function strip(a: P, b: P, w: number, w2 = w): string {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const nx = -(b.y - a.y) / len;
  const ny = (b.x - a.x) / len;
  return poly([
    pt(a.x + (nx * w) / 2, a.y + (ny * w) / 2),
    pt(b.x + (nx * w2) / 2, b.y + (ny * w2) / 2),
    pt(b.x - (nx * w2) / 2, b.y - (ny * w2) / 2),
    pt(a.x - (nx * w) / 2, a.y - (ny * w) / 2),
  ]);
}

/** Strip along a→b whose far edge is cut into saw teeth, like a scissor-fringed mane. */
function sawStrip(a: P, b: P, width: number, teeth: number): string {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const nx = -(b.y - a.y) / len;
  const ny = (b.x - a.x) / len;
  const pts: P[] = [a, b];
  for (let i = teeth * 2; i >= 0; i--) {
    const t = i / (teeth * 2);
    const w = i % 2 === 0 ? width * 0.45 : width;
    pts.push(pt(a.x + (b.x - a.x) * t + nx * w, a.y + (b.y - a.y) * t + ny * w));
  }
  return poly(pts);
}

/** Closed feather: smooth top curve, scalloped lower edge. */
function wing(root: P, tip: P, rootLow: P, ctrl1: P, ctrl2: P, lobes: number, depth: number): string {
  let d = `M ${fmt(root.x)} ${fmt(root.y)} C ${fmt(ctrl1.x)} ${fmt(ctrl1.y)} ${fmt(ctrl2.x)} ${fmt(ctrl2.y)} ${fmt(tip.x)} ${fmt(tip.y)}`;
  const len = Math.hypot(rootLow.x - tip.x, rootLow.y - tip.y) || 1;
  const nx = -(rootLow.y - tip.y) / len;
  const ny = (rootLow.x - tip.x) / len;
  for (let i = 1; i <= lobes; i++) {
    const t0 = (i - 1) / lobes;
    const t1 = i / lobes;
    const tm = (t0 + t1) / 2;
    const cx = tip.x + (rootLow.x - tip.x) * tm + nx * depth;
    const cy = tip.y + (rootLow.y - tip.y) * tm + ny * depth;
    d += ` Q ${fmt(cx)} ${fmt(cy)} ${fmt(tip.x + (rootLow.x - tip.x) * t1)} ${fmt(tip.y + (rootLow.y - tip.y) * t1)}`;
  }
  return `${d} Z`;
}

function sawCircle(cx: number, cy: number, ro: number, ri: number, n: number): string {
  const pts: P[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? ro : ri;
    pts.push(pt(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
  }
  return poly(pts);
}

/** Horizontal wave band: sine top edge, sine bottom edge. */
function waveBand(x0: number, x1: number, y: number, thick: number, amp: number, period: number, phase: number): string {
  const top: P[] = [];
  const bottom: P[] = [];
  for (let x = x0; x <= x1 + 0.1; x += 10) {
    top.push(pt(x, y + Math.sin((x / period) * Math.PI * 2 + phase) * amp));
    bottom.push(pt(x, y + thick + Math.sin((x / period) * Math.PI * 2 + phase + 1.3) * amp * 0.7));
  }
  return poly([...top, ...bottom.reverse()]);
}

/** Thin pointed slit, used for cut feather lines and lace. */
function slit(cx: number, cy: number, len: number, w: number, angleDeg: number): string {
  const a = (angleDeg * Math.PI) / 180;
  const ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux;
  const p1 = pt(cx - (ux * len) / 2, cy - (uy * len) / 2);
  const p2 = pt(cx + (ux * len) / 2, cy + (uy * len) / 2);
  return `M ${fmt(p1.x)} ${fmt(p1.y)} Q ${fmt(cx + vx * w)} ${fmt(cy + vy * w)} ${fmt(p2.x)} ${fmt(p2.y)} Q ${fmt(cx - vx * w)} ${fmt(cy - vy * w)} ${fmt(p1.x)} ${fmt(p1.y)} Z`;
}

/** Five round petals around a centre, cut from one piece of paper. */
function flower(cx: number, cy: number, r: number): string {
  return [0, 1, 2, 3, 4]
    .map((i) => {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      return circle(Math.round((cx + Math.cos(a) * r) * 10) / 10, Math.round((cy + Math.sin(a) * r) * 10) / 10, r * 0.72);
    })
    .join(' ');
}

const FOIL_DOTS: [number, number, number, 'g' | 's' | 'c'][] = [
  [611, 99, 8.8, 's'],
  [687, 103, 9.6, 's'],
  [126, 118, 8.8, 'c'],
  [211, 132, 11.7, 'g'],
  [889, 132, 9.6, 'c'],
  [567, 154, 8.8, 'c'],
  [162, 177, 12.1, 'g'],
  [626, 177, 10.0, 'c'],
  [787, 179, 10.8, 'c'],
  [267, 208, 10, 's'],
  [847, 219, 8.8, 'c'],
  [129, 254, 9.6, 's'],
  [457, 263, 10, 'g'],
  [234, 299, 11.7, 's'],
  [167, 304, 9.6, 's'],
  [876, 309, 10.4, 'g'],
  [109, 328, 10.0, 'g'],
  [310, 350, 10, 'g'],
  [725, 356, 8, 'c'],
  [177, 358, 11.2, 'c'],
  [567, 360, 10, 'g'],
  [765, 366, 8.3, 's'],
  [150, 378, 10.0, 'c'],
  [859, 391, 9.2, 'g'],
  [405, 397, 10, 'g'],
  [657, 397, 10, 'g'],
  [269, 406, 9.6, 'g'],
  [797, 434, 9.6, 's'],
  [595, 437, 10, 's'],
  [678, 439, 8.8, 'c'],
  [741, 447, 8, 'g'],
  [884, 447, 9.6, 's'],
  [117, 450, 11.7, 'g'],
  [500, 477, 10, 'g'],
  [163, 496, 8.3, 'g'],
  [796, 499, 9.6, 's'],
  [671, 517, 11.2, 's'],
  [612, 530, 10, 'g'],
  [109, 535, 8.8, 'g'],
  [411, 535, 8, 'g'],
  [248, 536, 10.4, 's'],
  [408, 537, 10, 'g'],
  [753, 540, 10.4, 'g'],
  [900, 541, 8.8, 'g'],
  [312, 545, 10, 'g'],
  [495, 560, 10.0, 'c'],
  [645, 579, 10.4, 'c'],
  [420, 580, 10.4, 's'],
  [832, 580, 8.8, 's'],
  [380, 594, 10, 'g'],
  [275, 597, 9.2, 'g'],
  [160, 602, 11.2, 'g'],
  [513, 604, 8.3, 'c'],
  [725, 613, 9.2, 's'],
];

const FOIL_COLORS = { g: '#CDB057', s: '#D5D7DA', c: '#C0915A' };

/** Scissor-cut disc: a circle whose radius wanders slightly, drawn with smooth curves. */
function handCutDisc(cx: number, cy: number, r: number, seed: number): string {
  let t = seed * 9301 + 49297;
  const rnd = () => ((t = (t * 9301 + 49297) % 233280) / 233280);
  const n = 11;
  const pts: P[] = [];
  const rot = rnd() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    const rr = r * (0.9 + rnd() * 0.16);
    pts.push(pt(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr));
  }
  const mid = (a: P, b: P) => pt((a.x + b.x) / 2, (a.y + b.y) / 2);
  const start = mid(pts[n - 1], pts[0]);
  let d = `M ${fmt(start.x)} ${fmt(start.y)}`;
  pts.forEach((p, i) => {
    const m = mid(p, pts[(i + 1) % n]);
    d += ` Q ${fmt(p.x)} ${fmt(p.y)} ${fmt(m.x)} ${fmt(m.y)}`;
  });
  return `${d} Z`;
}

/** Printed flower on the headscarf fabric: white outline, blue petals, yellow heart. */
function printedFlower(name: string, cx: number, cy: number, r: number): CutoutPath[] {
  return [
    piece(`${name}·白边`, flower(cx, cy, r * 1.08), '#FFFFFF'),
    piece(`${name}·花瓣`, flower(cx, cy, r * 0.9), '#5A9BE6'),
    piece(`${name}·花心`, circle(cx, cy, r * 0.42), '#F1B93A'),
  ];
}

export function createPolishAngelPreset(): PapercutProject {
  seq = 1000;
  const W = 1000;
  const H = 720;
  const layers: Record<string, Layer> = {};
  const add = (l: Layer) => (layers[l.id] = l);
  const P = {
    night: '#141B2E',
    horse: '#F3F1EC',
    kraft: '#B9A58C',
    red: '#D93A34',
    orange: '#E4572E',
    gold: '#C9A348',
    goldLight: '#D6B45C',
    silver: '#CDD1D6',
    news: '#8FB6E4',
    newsInk: '#3E6FB8',
    maroon: '#5B2340',
    skin: '#F3C9B5',
    flowerBlue: '#2E6BD6',
    leaf: '#3E9E5A',
  };

  // ---------- 背景 ----------
  add(paper('pl_board', '夜空底板', P.night, rect(0, 0, W, H), { grain: 0.35 }));

  // ---------- 白马 ----------
  add(
    paper(
      'pl_tail',
      '马尾',
      P.kraft,
      'M 312 306 C 262 318 226 360 212 430 C 206 462 200 492 196 516 L 214 506 L 216 522 L 232 508 L 238 522 L 250 500 L 258 512 C 262 440 280 372 322 338 Z',
      { grain: 0.7 }
    )
  );
  add(
    paper(
      'pl_horse',
      '马身',
      P.horse,
      'M 305 312 C 380 296 520 300 600 280 L 690 196 L 704 150 L 718 190 L 732 150 L 742 196 C 770 230 792 270 800 300 Q 802 318 784 322 L 748 322 C 730 322 718 300 704 282 L 650 360 C 640 400 640 440 632 470 L 640 668 L 620 668 L 606 490 L 592 490 L 584 668 L 564 668 L 570 478 C 520 492 440 492 400 482 L 404 668 L 384 668 L 372 494 L 356 490 L 318 660 L 298 660 L 322 452 C 300 420 294 360 305 312 Z',
      {
        grain: 0.3,
        appliques: [
          piece('左耳心', 'M 706 160 L 712 186 L 702 186 Z', P.kraft),
          piece('右耳心', 'M 733 160 L 738 190 L 729 188 Z', P.kraft),
          piece('马眼', circle(752, 220, 4.5), P.night),
          piece('鼻孔', ellipse(788, 306, 3, 2.2), '#8C7F76'),
        ],
      }
    )
  );
  add(paper('pl_mane', '马鬃', P.kraft, sawStrip(pt(600, 284), pt(700, 192), 30, 7), { grain: 0.7 }));
  add(
    paper('pl_bridle', '红马具', P.red, '', {
      grain: 0.3,
      appliques: [
        piece('缰绳·前', strip(pt(578, 226), pt(786, 300), 6), P.red),
        piece('缰绳·后', strip(pt(572, 246), pt(780, 314), 6), P.red),
        piece('鼻革', strip(pt(756, 284), pt(802, 294), 7), P.red),
        piece('颊革', strip(pt(730, 204), pt(762, 300), 5), P.red),
        piece('额革', strip(pt(712, 200), pt(744, 194), 5), P.red),
        piece('胸带', strip(pt(560, 300), pt(652, 354), 8), P.red),
        ...[0, 1, 2, 3, 4].map((i) => piece(`流苏 ${i + 1}`, strip(pt(612 + i * 10, 330 + i * 5), pt(608 + i * 10, 372 + i * 5), 4), P.red)),
        ...[0, 1, 2].map((i) => piece(`白缝线 ${i + 1}`, strip(pt(600 + i * 60, 240 + i * 21), pt(630 + i * 60, 251 + i * 21), 2), '#F3F1EC')),
      ],
    })
  );

  // ---------- 天使 ----------
  add(
    paper('pl_wing_silver', '银箔翅膀', P.silver, wing(pt(412, 200), pt(240, 102), pt(416, 222), pt(390, 130), pt(320, 96), 5, 14), {
      grain: 1,
      holes: [slit(330, 132, 60, 3, 18), slit(370, 150, 50, 3, 28)].map((d, i) => piece(`羽缝 ${i + 1}`, d, P.night, true)),
    })
  );
  add(
    paper('pl_wing_gold', '金箔翅膀', P.gold, wing(pt(424, 214), pt(194, 176), pt(426, 266), pt(380, 168), pt(290, 150), 8, 16), {
      grain: 1,
      holes: [slit(270, 196, 70, 3.5, 14), slit(318, 212, 70, 3.5, 20), slit(364, 228, 60, 3.5, 26)].map((d, i) =>
        piece(`羽缝 ${i + 1}`, d, P.night, true)
      ),
    })
  );
  add(
    paper('pl_halo', '金箔光环', P.goldLight, sawCircle(458, 146, 66, 58, 34), {
      grain: 1,
      holes: [piece('光环内圈', circle(458, 146, 51), P.night, true)],
    })
  );

  const stripeColors = ['#2E6BD6', '#F2B63A', '#3E9E5A', '#3AB5B5', '#2E58D6', '#E77FA8', '#3E9E5A', '#F2B63A', '#3AB5B5'];
  add(
    paper('pl_skirt', '彩条长裙', P.orange, 'M 426 292 L 536 292 L 580 548 Q 430 578 290 562 Z', {
      grain: 0.5,
      appliques: stripeColors.map((c, i) => {
        const t = 0.08 + (i / (stripeColors.length - 1)) * 0.84;
        return piece(`彩条 ${i + 1}`, strip(pt(430 + (532 - 430) * t, 300), pt(302 + (570 - 302) * t, 552 - 10 * t), 5, 15), c);
      }),
    })
  );
  const inkLines = Array.from({ length: 9 }, (_, i) => {
    const y = 196 + i * 8;
    const x0 = 432 + (i % 3) * 3;
    const x1 = 500 - ((i * 7) % 11);
    return piece(`铅字行 ${i + 1}`, rect(x0, y, x1 - x0, 2.6), i % 4 === 3 ? '#FFFFFF' : P.newsInk);
  });
  add(
    paper('pl_torso', '报纸上衣', P.news, 'M 426 186 C 440 176 490 176 506 188 L 520 296 L 422 296 Z', {
      grain: 0.4,
      appliques: [...inkLines, piece('束腰', 'M 424 262 H 518 L 522 298 H 420 Z', P.maroon)],
    })
  );
  add(
    paper('pl_arms', '手臂', P.news, 'M 496 198 L 570 214 L 572 236 L 494 232 Z M 492 220 L 566 238 L 566 254 L 490 248 Z', {
      grain: 0.4,
      appliques: [
        piece('袖口·前', strip(pt(560, 212), pt(560, 236), 4), P.newsInk),
        piece('袖口·后', strip(pt(556, 236), pt(556, 253), 4), P.newsInk),
        piece('前手', circle(578, 226, 9), P.skin),
        piece('后手', circle(572, 246, 8), P.skin),
      ],
    })
  );
  add(
    paper(
      'pl_hair',
      '黑发',
      '#0E0C12',
      'M 407 146 C 407 116 430 94 458 94 C 486 94 509 116 509 146 C 509 170 496 190 478 198 L 440 200 C 420 190 407 170 407 146 Z',
      { grain: 0.2 }
    )
  );
  add(
    paper(
      'pl_scarf',
      '花头巾',
      '#D8312C',
      'M 496 124 C 474 116 440 122 418 138 C 410 144 404 152 398 164 C 412 178 426 190 442 198 C 456 194 468 186 476 178 C 472 164 472 146 480 134 C 486 128 492 126 496 124 Z',
      {
        grain: 0.35,
        appliques: [
          piece('白色下沿', 'M 398 164 C 412 178 426 190 442 198 C 456 194 468 186 476 178 L 472 175 C 465 182 454 189 442 193 C 428 186 415 175 402 161 Z', '#FFFFFF'),
          piece('白色前沿', 'M 496 124 C 486 127 478 133 474 142 C 470 152 471 166 476 178 L 480 176 C 475 165 474 153 478 144 C 482 136 488 130 497 128 Z', '#FFFFFF'),
          piece('白色卷纹', 'M 482 124 C 488 118 496 120 494 126 C 491 123 487 123 484 126 Z', '#FFFFFF'),
          ...printedFlower('蓝花 1', 432, 146, 7.4),
          ...printedFlower('蓝花 2', 455, 134, 6.4),
          ...printedFlower('蓝花 3', 452, 162, 5.6),
          ...printedFlower('蓝花 4', 424, 186, 4.4),
          piece('绿叶 1', slit(438, 166, 15, 4, 35), '#5E9E4A'),
          piece('绿叶 2', slit(466, 150, 12, 3.2, -25), '#5E9E4A'),
          piece('绿叶 3', slit(444, 180, 12, 3.2, 10), '#5E9E4A'),
          piece('苹果·白边', circle(413, 168, 12.5), '#FFFFFF'),
          piece('苹果', 'M 413 157 C 423 153 428 163 426 171 C 424 179 417 181 413 177 C 409 181 402 179 400 171 C 398 163 403 153 413 157 Z', '#F2C94C'),
          piece('苹果叶', slit(420, 154, 12, 3.2, -35), '#5E9E4A'),
          piece('结尾', 'M 434 194 C 446 202 452 218 448 242 L 440 244 C 440 222 434 206 428 199 Z', '#EFC23B'),
          ...[[442, 210], [445, 224], [441, 234], [437, 203]].map(([x, y], i) => piece(`结尾红点 ${i + 1}`, circle(x, y, 2), '#D8312C')),
        ],
      }
    )
  );
  add(
    paper(
      'pl_face',
      '侧脸',
      '#EDA6B6',
      'M 480 128 C 492 128 500 138 499 148 L 504 157 L 498 160 C 497 170 490 180 480 186 C 474 176 472 158 474 146 C 475 138 476 132 480 128 Z',
      {
        grain: 0.3,
        appliques: [
          piece('眉', strip(pt(488, 140), pt(496, 139), 1.3), '#3A2230'),
          piece('眼', circle(492, 146, 1.9), '#1A1420'),
          piece('腮红', circle(489, 166, 7), '#EE5A38'),
        ],
      }
    )
  );

  // ---------- 前景 ----------
  add(
    paper('pl_waves', '水波', '#1F46A8', waveBand(0, W, 612, 34, 7, 180, 0), {
      grain: 0.4,
      appliques: [
        piece('中层水波', waveBand(0, W, 640, 26, 6, 150, 1.2), '#3C78C8'),
        piece('浅层水波', waveBand(0, W, 664, 24, 5, 210, 2.4), '#9CB7C9'),
        piece('底层水波', waveBand(0, W, 686, 34, 5, 170, 0.6), '#1F46A8'),
      ],
    })
  );
  add(
    paper('pl_confetti', '金银箔点', P.goldLight, '', {
      grain: 1,
      appliques: FOIL_DOTS.map(([x, y, r, k], i) =>
        piece(`${k === 'g' ? '金' : k === 's' ? '银' : '铜'}箔点 ${i + 1}`, handCutDisc(x, y, r, i + 1), FOIL_COLORS[k])
      ),
    })
  );

  const group = (id: string, name: string, layerIds: string[]): LayerGroup => ({
    id,
    name,
    collapsed: false,
    visible: true,
    locked: false,
    layerIds,
  });
  const groups = [
    group('pl_grp_bg', '背景', ['pl_board']),
    group('pl_grp_horse_back', '白马·后', ['pl_tail']),
    group('pl_grp_horse', '白马', ['pl_horse', 'pl_mane']),
    group('pl_grp_wings', '天使·翅膀', ['pl_wing_silver', 'pl_wing_gold', 'pl_halo']),
    group('pl_grp_angel', '天使', ['pl_skirt', 'pl_torso', 'pl_hair', 'pl_scarf', 'pl_face', 'pl_arms']),
    group('pl_grp_tack', '马具', ['pl_bridle']),
    group('pl_grp_fore', '前景', ['pl_waves', 'pl_confetti']),
  ];

  return {
    id: 'proj_polish_angel',
    name: '波兰剪纸 · 夜骑白马的天使',
    width: W,
    height: H,
    groups,
    layers,
    rootOrder: groups.map((g) => ({ type: 'group' as const, id: g.id })),
    items: [
      {
        id: 'pl_item_horse',
        name: '白马',
        partIds: ['pl_tail', 'pl_horse', 'pl_mane', 'pl_bridle'],
        pivot: { x: 470, y: 668 },
        sockets: [
          { id: 'pl_s_saddle', name: 'saddle', x: 470, y: 300 },
          { id: 'pl_s_mouth', name: 'bit', x: 786, y: 306 },
        ],
      },
      {
        id: 'pl_item_angel',
        name: '天使',
        partIds: ['pl_wing_silver', 'pl_wing_gold', 'pl_halo', 'pl_skirt', 'pl_torso', 'pl_hair', 'pl_scarf', 'pl_face', 'pl_arms'],
        pivot: { x: 470, y: 300 },
        sockets: [{ id: 'pl_s_hands', name: 'hands', x: 576, y: 236 }],
      },
    ],
    backgroundColor: P.night,
    backgroundStyle: 'ebony',
    shadowStrength: 0.4,
  };
}

// ---------- 双鱼窗花（对折剪纸） ----------

/**
 * One sheet of red paper folded down the middle: the traced half is mirrored across the fold, the
 * paper edge is the outer cut, and every white shape inside is a separate cut-out named by motif.
 */
export function createDoubleFishPreset(): PapercutProject {
  seq = 2000;
  const cuts: CutoutPath[] = [];
  FISH_CUTS.forEach(({ motif, d }) => {
    d.forEach((piece, i) => {
      cuts.push({ id: `cf_cut_${cuts.length}`, name: `${motif} ${i + 1}`, type: 'custom_polygon', d: piece, isHole: true, createdAt: cuts.length });
    });
  });

  const layers: Record<string, Layer> = {};
  layers['cf_backing'] = paper('cf_backing', '宣纸衬底', '#F7F4EB', rect(0, 0, 1000, 780), { grain: 0.5 });
  layers['cf_backing'].locked = true;
  layers['cf_red'] = paper('cf_red', '朱红双鱼', '#D8342A', FISH_PAPER_EDGE, {
    grain: 0.35,
    holes: cuts,
  });

  const groups: LayerGroup[] = [
    { id: 'cf_grp_back', name: '衬底', collapsed: false, visible: true, locked: false, layerIds: ['cf_backing'] },
    { id: 'cf_grp_paper', name: '剪纸', collapsed: false, visible: true, locked: false, layerIds: ['cf_red'] },
  ];
  return {
    id: 'proj_double_fish',
    name: '吉庆有余 · 双鱼窗花',
    width: 1000,
    height: 780,
    groups,
    layers,
    rootOrder: groups.map((g) => ({ type: 'group' as const, id: g.id })),
    items: [{ id: 'cf_item', name: '双鱼窗花', partIds: ['cf_red'], pivot: { x: 500, y: 760 }, sockets: [] }],
    backgroundColor: '#F7F4EB',
    backgroundStyle: 'rice_paper',
    shadowStrength: 0.35,
  };
}
