/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Layer, LayerGroup, LayerPattern, PapercutItem, PapercutProject, CutoutPath } from '../types/papercut';

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
