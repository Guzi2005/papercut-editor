/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Point, SymmetryMode, KnifeTipShape } from '../types/papercut';

/**
 * Formats a number to 2 decimal places for clean SVG output
 */
export function f(n: number): string {
  return Number(n.toFixed(2)).toString();
}

/**
 * Generates a classic folk Willow Leaf (柳叶纹) SVG path between two points.
 * Pointed at both ends, bulges in the belly, with adjustable curvature and sharpness.
 */
export function generateWillowLeafPath(
  p1: Point,
  p2: Point,
  bellyWidth: number,
  curvature: number = 0,
  sharpness: number = 1.6
): string {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);

  if (len < 1) {
    return '';
  }

  // Normal unit vector (perpendicular to stroke direction)
  const nx = -dy / len;
  const ny = dx / len;

  // Midpoint
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;

  // Tangent unit vector
  const tx = dx / len;
  const ty = dy / len;

  // Scale belly width relative to length (capped so very short strokes don't look deformed)
  const effectiveWidth = Math.min(bellyWidth, len * 0.9);

  // Curvature offsets the midline
  const curveOffset = curvature * effectiveWidth * 0.7;

  // Side 1 belly point & Side 2 belly point
  const halfW = effectiveWidth / 2;
  const side1X = mx + nx * (halfW + curveOffset);
  const side1Y = my + ny * (halfW + curveOffset);

  const side2X = mx - nx * (halfW - curveOffset);
  const side2Y = my - ny * (halfW - curveOffset);

  // Sharpness controls how close the bezier handles stay to the tip
  const tHandle = 0.38 / Math.max(0.8, sharpness * 0.5);

  // Side 1 bezier control points
  const c1x = p1.x + tx * (len * tHandle) + nx * (halfW + curveOffset) * 0.6;
  const c1y = p1.y + ty * (len * tHandle) + ny * (halfW + curveOffset) * 0.6;

  const c2x = p2.x - tx * (len * tHandle) + nx * (halfW + curveOffset) * 0.6;
  const c2y = p2.y - ty * (len * tHandle) + ny * (halfW + curveOffset) * 0.6;

  // Side 2 bezier control points (returning)
  const c3x = p2.x - tx * (len * tHandle) - nx * (halfW - curveOffset) * 0.6;
  const c3y = p2.y - ty * (len * tHandle) - ny * (halfW - curveOffset) * 0.6;

  const c4x = p1.x + tx * (len * tHandle) - nx * (halfW - curveOffset) * 0.6;
  const c4y = p1.y + ty * (len * tHandle) - ny * (halfW - curveOffset) * 0.6;

  return `M ${f(p1.x)} ${f(p1.y)} C ${f(c1x)} ${f(c1y)}, ${f(c2x)} ${f(c2y)}, ${f(p2.x)} ${f(p2.y)} C ${f(c3x)} ${f(c3y)}, ${f(c4x)} ${f(c4y)}, ${f(p1.x)} ${f(p1.y)} Z`;
}

/**
 * Perpendicular distance from point P to line segment AB
 */
export function perpendicularDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lineLenSq = dx * dx + dy * dy;
  if (lineLenSq === 0) {
    return Math.hypot(p.x - a.x, p.y - a.y);
  }
  const num = Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x);
  return num / Math.sqrt(lineLenSq);
}

/**
 * Douglas-Peucker Path Simplification Algorithm (道格拉斯-普克折线抽稀净化)
 * Recursively reduces redundant and jittery points, stripping away hand trembles
 * while strictly preserving the key curvature apex and inflection points.
 */
export function douglasPeucker(points: Point[], epsilon: number): Point[] {
  if (points.length <= 2 || epsilon <= 0) {
    return points;
  }

  let dmax = 0;
  let index = 0;
  const last = points.length - 1;

  for (let i = 1; i < last; i++) {
    const d = perpendicularDistance(points[i], points[0], points[last]);
    if (d > dmax) {
      index = i;
      dmax = d;
    }
  }

  if (dmax > epsilon) {
    // Recursively simplify sub-polylines
    const recResults1 = douglasPeucker(points.slice(0, index + 1), epsilon);
    const recResults2 = douglasPeucker(points.slice(index), epsilon);

    // Concatenate without duplicating the apex point
    return recResults1.slice(0, -1).concat(recResults2);
  } else {
    return [points[0], points[last]];
  }
}

/**
 * Fits smooth Catmull-Rom to Cubic Bezier curve through simplified anchor points
 * Transforms simplified vertices into decisive, elegant, folk-art vector curves.
 */
export function fitSmoothBezierCurve(points: Point[], tension: number = 0.35): string {
  const n = points.length;
  if (n < 2) return '';
  if (n === 2) {
    return `L ${f(points[1].x)} ${f(points[1].y)}`;
  }

  let d = '';
  for (let i = 0; i < n - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i < n - 2 ? points[i + 2] : p2;

    // Catmull-Rom control points converted to cubic bezier
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;

    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    d += ` C ${f(cp1x)} ${f(cp1y)}, ${f(cp2x)} ${f(cp2y)}, ${f(p2.x)} ${f(p2.y)}`;
  }

  return d;
}

/**
 * 画世界Pro / HiPaint 真实柳叶笔引擎 (Zero-Diameter Realtime Willow Leaf Pen)
 * - 搭载 Douglas-Peucker 算法：自动净化运笔手抖与毛刺，生成如刀裁剪纸般的优雅国风弧线！
 * - 柳叶笔本身不具有预设直径/粗细，形体完全由运笔弧度实时决定！
 * - 运笔无需手动绕圈闭合，起笔至当前落笔实时连弦成形、瞬间填满！
 * - 支持两种经典民俗剪纸构形：
 *   1. 'chord' (画世界经典单弧成叶): 笔尖划过一侧弧线，尾部实时与起点连线闭合成尖锐柳叶切片
 *   2. 'symmetric' (对称双弧): 笔迹作为一侧弧形，实时以起终连线为轴对称镜像出饱满双弧柳叶
 */
export function generateRealtimeWillowLeaf(
  rawPoints: Point[],
  mode: 'chord' | 'symmetric' = 'chord',
  stabilizer: number = 0.55,
  tolerance: number = 4.0 // Douglas-Peucker epsilon threshold
): string {
  if (rawPoints.length < 2) return '';

  // 1. Filter micro-jitter points
  const points: Point[] = [rawPoints[0]];
  for (let i = 1; i < rawPoints.length; i++) {
    const prev = points[points.length - 1];
    const dist = Math.hypot(rawPoints[i].x - prev.x, rawPoints[i].y - prev.y);
    if (dist >= 2.5) {
      points.push(rawPoints[i]);
    }
  }

  const n = points.length;
  if (n < 2) return '';

  const p0 = points[0];
  const pn = points[n - 1];
  const chordDist = Math.hypot(pn.x - p0.x, pn.y - p0.y);

  if (chordDist < 3 && n <= 3) return '';

  // 2. Moving average smoothing
  const smoothed: Point[] = [p0];
  const weight = Math.min(0.85, Math.max(0, stabilizer));
  for (let i = 1; i < n - 1; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const next = points[i + 1];
    smoothed.push({
      x: cur.x * (1 - weight) + (prev.x + next.x) * 0.5 * weight,
      y: cur.y * (1 - weight) + (prev.y + next.y) * 0.5 * weight,
    });
  }
  smoothed.push(pn);

  // 3. Douglas-Peucker simplification (净化手部颤抖与微波纹)
  const effectiveEpsilon = Math.max(0, tolerance);
  const simplified =
    effectiveEpsilon > 0.5 && smoothed.length > 3
      ? douglasPeucker(smoothed, effectiveEpsilon)
      : smoothed;

  const numPoints = simplified.length;

  // 4. Mode 'chord': 画世界Pro 经典单弧实时连弦成叶 (基于平滑贝塞尔拟合)
  if (mode === 'chord') {
    let d = `M ${f(p0.x)} ${f(p0.y)}`;
    d += fitSmoothBezierCurve(simplified, 0.36);
    // Connect to current stroke tip and close straight back to origin
    d += ` L ${f(pn.x)} ${f(pn.y)} L ${f(p0.x)} ${f(p0.y)} Z`;
    return d;
  }

  // 5. Mode 'symmetric': 对称双弧柳叶 (以起终点弦为对称轴)
  if (mode === 'symmetric') {
    if (chordDist < 3) {
      return generateRealtimeWillowLeaf(rawPoints, 'chord', stabilizer, tolerance);
    }

    const tx = (pn.x - p0.x) / chordDist;
    const ty = (pn.y - p0.y) / chordDist;

    // Mirrored points across chord line
    const mirrored: Point[] = [];
    for (let i = numPoints - 2; i > 0; i--) {
      const pt = simplified[i];
      const vx = pt.x - p0.x;
      const vy = pt.y - p0.y;
      const proj = vx * tx + vy * ty;
      const projX = p0.x + tx * proj;
      const projY = p0.y + ty * proj;

      const perpX = pt.x - projX;
      const perpY = pt.y - projY;

      mirrored.push({
        x: projX - perpX,
        y: projY - perpY,
      });
    }

    // Forward curve
    let d = `M ${f(p0.x)} ${f(p0.y)}`;
    d += fitSmoothBezierCurve(simplified, 0.36);
    d += ` L ${f(pn.x)} ${f(pn.y)}`;

    // Return along mirrored points with smooth bezier curve
    if (mirrored.length > 0) {
      const returnPoints = [pn, ...mirrored, p0];
      d += fitSmoothBezierCurve(returnPoints, 0.36);
    }

    d += ` L ${f(p0.x)} ${f(p0.y)} Z`;
    return d;
  }

  return '';
}

/**
 * Generates a Crescent Moon (月牙纹) cutout path.
 * Signature folk papercut motif with one deep curved back and one inner curved belly.
 */
export function generateCrescentPath(
  p1: Point,
  p2: Point,
  width: number,
  curvature: number = 0.6
): string {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return '';

  const nx = -dy / len;
  const ny = dx / len;
  const tx = dx / len;
  const ty = dy / len;

  const effectiveWidth = Math.min(width * 1.2, len * 0.85);
  const outerBelly = effectiveWidth * (1 + Math.abs(curvature) * 0.5);
  const innerBelly = effectiveWidth * (0.2 + Math.abs(curvature) * 0.3);

  // Outer arch control points
  const o1x = p1.x + tx * (len * 0.3) + nx * outerBelly;
  const o1y = p1.y + ty * (len * 0.3) + ny * outerBelly;
  const o2x = p2.x - tx * (len * 0.3) + nx * outerBelly;
  const o2y = p2.y - ty * (len * 0.3) + ny * outerBelly;

  // Inner arch control points (follows the same side so it forms a crescent)
  const i1x = p2.x - tx * (len * 0.35) + nx * innerBelly;
  const i1y = p2.y - ty * (len * 0.35) + ny * innerBelly;
  const i2x = p1.x + tx * (len * 0.35) + nx * innerBelly;
  const i2y = p1.y + ty * (len * 0.35) + ny * innerBelly;

  return `M ${f(p1.x)} ${f(p1.y)} C ${f(o1x)} ${f(o1y)}, ${f(o2x)} ${f(o2y)}, ${f(p2.x)} ${f(p2.y)} C ${f(i1x)} ${f(i1y)}, ${f(i2x)} ${f(i2y)}, ${f(p1.x)} ${f(p1.y)} Z`;
}

/**
 * Generates a Teardrop / Water Drop (水滴纹) cutout path.
 * Sharp pointed head at p1, rounded spherical belly at p2.
 */
export function generateTeardropPath(
  p1: Point,
  p2: Point,
  width: number
): string {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return '';

  const nx = -dy / len;
  const ny = dx / len;
  const tx = dx / len;
  const ty = dy / len;

  const r = Math.min(width * 0.6, len * 0.4);

  // Base of the round dome
  const domeCenter = { x: p2.x - tx * r, y: p2.y - ty * r };
  const leftShoulder = { x: domeCenter.x + nx * r, y: domeCenter.y + ny * r };
  const rightShoulder = { x: domeCenter.x - nx * r, y: domeCenter.y - ny * r };
  const domeTip = { x: p2.x, y: p2.y };

  // Control points from sharp point p1 to left shoulder
  const c1x = p1.x + tx * (len * 0.4) + nx * (r * 0.2);
  const c1y = p1.y + ty * (len * 0.4) + ny * (r * 0.2);

  // Round dome control points
  const d1x = leftShoulder.x + tx * (r * 0.55);
  const d1y = leftShoulder.y + ty * (r * 0.55);
  const d2x = domeTip.x + nx * (r * 0.55);
  const d2y = domeTip.y + ny * (r * 0.55);

  const d3x = domeTip.x - nx * (r * 0.55);
  const d3y = domeTip.y - ny * (r * 0.55);
  const d4x = rightShoulder.x + tx * (r * 0.55);
  const d4y = rightShoulder.y + ty * (r * 0.55);

  // Returning control points to sharp point p1
  const c4x = p1.x + tx * (len * 0.4) - nx * (r * 0.2);
  const c4y = p1.y + ty * (len * 0.4) - ny * (r * 0.2);

  return `M ${f(p1.x)} ${f(p1.y)} Q ${f(c1x)} ${f(c1y)}, ${f(leftShoulder.x)} ${f(leftShoulder.y)} C ${f(d1x)} ${f(d1y)}, ${f(d2x)} ${f(d2y)}, ${f(domeTip.x)} ${f(domeTip.y)} C ${f(d3x)} ${f(d3y)}, ${f(d4x)} ${f(d4y)}, ${f(rightShoulder.x)} ${f(rightShoulder.y)} Q ${f(c4x)} ${f(c4y)}, ${f(p1.x)} ${f(p1.y)} Z`;
}

/**
 * Generates a Diamond / Rhombus (菱形纹) punch cutout.
 * Signature folk papercut motif (方胜纹、金刚菱).
 */
export function generateDiamondPath(
  p1: Point,
  p2: Point,
  width: number
): string {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return '';

  const nx = -dy / len;
  const ny = dx / len;
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;

  const halfW = Math.min(width * 0.5, len * 0.6);

  const leftX = mx + nx * halfW;
  const leftY = my + ny * halfW;
  const rightX = mx - nx * halfW;
  const rightY = my - ny * halfW;

  return `M ${f(p1.x)} ${f(p1.y)} L ${f(leftX)} ${f(leftY)} L ${f(p2.x)} ${f(p2.y)} L ${f(rightX)} ${f(rightY)} Z`;
}

/**
 * Generates a Comb-Tooth / Sawtooth Ribbon (梳齿排刀 / 锯齿纹).
 * Creates a rhythmic array of parallel tapered willow cuts along a drag stroke.
 * Essential for folk animal fur, mane, rooster feathers, floral sunbursts, and garment fringe.
 */
export function generateCombRibbonPath(
  p1: Point,
  p2: Point,
  toothLength: number = 32,
  spacing: number = 14,
  toothAngleDeg: number = 65
): string {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const totalLen = Math.hypot(dx, dy);
  if (totalLen < 5) return '';

  const tx = dx / totalLen;
  const ty = dy / totalLen;
  const nx = -ty;
  const ny = tx;

  // Convert tooth angle
  const rad = (toothAngleDeg * Math.PI) / 180;
  const toothDirX = tx * Math.cos(rad) + nx * Math.sin(rad);
  const toothDirY = ty * Math.cos(rad) + ny * Math.sin(rad);

  const count = Math.max(2, Math.floor(totalLen / Math.max(6, spacing)));
  const stepLen = totalLen / count;

  const paths: string[] = [];

  for (let i = 0; i <= count; i++) {
    const baseX = p1.x + tx * (i * stepLen);
    const baseY = p1.y + ty * (i * stepLen);

    // Natural slight size tapering at start & end of the stroke
    const taper = Math.sin((i / count) * Math.PI);
    const curLen = Math.max(6, toothLength * (0.4 + 0.6 * taper));
    const curWidth = Math.max(3, curLen * 0.28);

    const tipX = baseX + toothDirX * curLen;
    const tipY = baseY + toothDirY * curLen;

    const leaf = generateWillowLeafPath(
      { x: baseX, y: baseY },
      { x: tipX, y: tipY },
      curWidth,
      0.1,
      1.8
    );
    if (leaf) paths.push(leaf);
  }

  return paths.join(' ');
}

/**
 * Freehand Knife Carver (笔刀：自由刻刀)
 * Creates a tapered, organic bezier knife stroke with sharp entrance and exit tips.
 * Supports pressure sensitivity and different knife tip shapes (round, flat, chisel, slash).
 */
export function generateFreehandKnifePath(
  points: Point[],
  width: number,
  tipShape: KnifeTipShape = 'round',
  usePressure = false
): string {
  if (points.length < 2) return '';
  if (points.length === 2) {
    return generateWillowLeafPath(points[0], points[1], width);
  }

  const leftPoints: Point[] = [];
  const rightPoints: Point[] = [];
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const cur = points[i];
    let tx = 0;
    let ty = 0;

    if (i === 0) {
      tx = points[1].x - cur.x;
      ty = points[1].y - cur.y;
    } else if (i === n - 1) {
      tx = cur.x - points[i - 1].x;
      ty = cur.y - points[i - 1].y;
    } else {
      tx = points[i + 1].x - points[i - 1].x;
      ty = points[i + 1].y - points[i - 1].y;
    }

    const len = Math.hypot(tx, ty) || 1;
    const nx = -ty / len;
    const ny = tx / len;

    // Tapering factor at ends depending on tipShape
    let factor = Math.sin((i / (n - 1)) * Math.PI);
    if (tipShape === 'flat') {
      // Flat knife: broader entrance and exit
      factor = Math.max(0.45, Math.pow(factor, 0.3));
    } else if (tipShape === 'chisel') {
      // Chisel: asymmetric angle
      factor = Math.max(0.3, Math.pow(factor, 0.45));
    } else if (tipShape === 'slash') {
      // Slash: ultra-pinched willow ends
      factor = Math.pow(factor, 0.85);
    } else {
      // Round
      factor = Math.pow(factor, 0.55);
    }

    // Pressure factor if enabled
    let pressureFactor = 1;
    if (usePressure && cur.pressure !== undefined && cur.pressure > 0) {
      pressureFactor = 0.35 + cur.pressure * 1.3;
    }

    const w = (width / 2) * factor * pressureFactor;

    if (tipShape === 'chisel') {
      // Skew chisel cut
      const skew = (i === 0 ? 0.3 : i === n - 1 ? -0.3 : 0) * w;
      leftPoints.push({ x: cur.x + nx * (w + skew), y: cur.y + ny * (w + skew) });
      rightPoints.push({ x: cur.x - nx * (w - skew), y: cur.y - ny * (w - skew) });
    } else {
      leftPoints.push({ x: cur.x + nx * w, y: cur.y + ny * w });
      rightPoints.push({ x: cur.x - nx * w, y: cur.y - ny * w });
    }
  }

  // Construct closed outline
  let d = `M ${f(leftPoints[0].x)} ${f(leftPoints[0].y)}`;
  for (let i = 1; i < leftPoints.length; i++) {
    d += ` L ${f(leftPoints[i].x)} ${f(leftPoints[i].y)}`;
  }
  for (let i = rightPoints.length - 1; i >= 0; i--) {
    d += ` L ${f(rightPoints[i].x)} ${f(rightPoints[i].y)}`;
  }
  d += ' Z';

  return d;
}

/**
 * Freehand Drawing Stroke (手绘笔刷线条：铅笔/钢笔/喷枪)
 * Generates a smooth quadratic bezier spline path along stroke points.
 */
export function generateFreehandDrawPath(points: Point[]): string {
  if (points.length < 2) return '';
  if (points.length === 2) {
    return `M ${f(points[0].x)} ${f(points[0].y)} L ${f(points[1].x)} ${f(points[1].y)}`;
  }

  let d = `M ${f(points[0].x)} ${f(points[0].y)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const xc = (points[i].x + points[i + 1].x) / 2;
    const yc = (points[i].y + points[i + 1].y) / 2;
    d += ` Q ${f(points[i].x)} ${f(points[i].y)}, ${f(xc)} ${f(yc)}`;
  }
  d += ` L ${f(points[points.length - 1].x)} ${f(points[points.length - 1].y)}`;
  return d;
}

/**
 * Transforms an SVG path data string with a 2D affine matrix [a, b, c, d, e, f]
 */
export function transformSvgPath(
  pathD: string,
  transformPoint: (x: number, y: number) => { x: number; y: number }
): string {
  // Regex to match SVG commands and coordinates
  return pathD.replace(
    /([a-df-z])|(-?\d*\.?\d+(?:e[-+]?\d+)?)/gi,
    (match, command, number) => {
      if (command) return command;
      return match;
    }
  ).replace(/([MLHVCSQTAZ])([^MLHVCSQTAZ]*)/gi, (match, cmd, argsStr) => {
    const upper = cmd.toUpperCase();
    if (upper === 'Z') return 'Z';

    const numbers = (argsStr.trim().match(/-?\d*\.?\d+(?:e[-+]?\d+)?/g) || []).map(Number);
    if (upper === 'M' || upper === 'L' || upper === 'T') {
      const transformed: string[] = [];
      for (let i = 0; i < numbers.length; i += 2) {
        const pt = transformPoint(numbers[i], numbers[i + 1]);
        transformed.push(`${f(pt.x)} ${f(pt.y)}`);
      }
      return `${upper} ${transformed.join(' ')}`;
    } else if (upper === 'C') {
      const transformed: string[] = [];
      for (let i = 0; i < numbers.length; i += 6) {
        const c1 = transformPoint(numbers[i], numbers[i + 1]);
        const c2 = transformPoint(numbers[i + 2], numbers[i + 3]);
        const pt = transformPoint(numbers[i + 4], numbers[i + 5]);
        transformed.push(`${f(c1.x)} ${f(c1.y)}, ${f(c2.x)} ${f(c2.y)}, ${f(pt.x)} ${f(pt.y)}`);
      }
      return `C ${transformed.join(', ')}`;
    } else if (upper === 'Q' || upper === 'S') {
      const transformed: string[] = [];
      for (let i = 0; i < numbers.length; i += 4) {
        const c1 = transformPoint(numbers[i], numbers[i + 1]);
        const pt = transformPoint(numbers[i + 2], numbers[i + 3]);
        transformed.push(`${f(c1.x)} ${f(c1.y)}, ${f(pt.x)} ${f(pt.y)}`);
      }
      return `${upper} ${transformed.join(', ')}`;
    }
    return match;
  });
}

/**
 * Applies Symmetry transformations to a path (e.g. 左右折叠, 四折, 团花)
 */
export function applySymmetryToPath(
  pathD: string,
  mode: SymmetryMode,
  cx: number,
  cy: number
): string {
  if (!pathD || mode === 'none') return pathD;

  const results: string[] = [pathD];

  if (mode === 'mirror_v') {
    // 左右垂直对折
    const mirrored = transformSvgPath(pathD, (x, y) => ({
      x: 2 * cx - x,
      y: y,
    }));
    results.push(mirrored);
  } else if (mode === 'mirror_h') {
    // 上下水平对折
    const mirrored = transformSvgPath(pathD, (x, y) => ({
      x: x,
      y: 2 * cy - y,
    }));
    results.push(mirrored);
  } else if (mode === 'quad') {
    // 四方对折 (X, Y, and both)
    const mx = transformSvgPath(pathD, (x, y) => ({ x: 2 * cx - x, y: y }));
    const my = transformSvgPath(pathD, (x, y) => ({ x: x, y: 2 * cy - y }));
    const mxy = transformSvgPath(pathD, (x, y) => ({ x: 2 * cx - x, y: 2 * cy - y }));
    results.push(mx, my, mxy);
  } else if (mode === 'radial_6' || mode === 'radial_8') {
    // 六折或八折团花 (Rotations + folding reflection)
    const folds = mode === 'radial_6' ? 6 : 8;
    const angleStep = (2 * Math.PI) / folds;

    // First reflect across central vertical axis to simulate folded paper
    const folded = transformSvgPath(pathD, (x, y) => ({
      x: 2 * cx - x,
      y: y,
    }));

    for (let i = 1; i < folds; i++) {
      const angle = i * angleStep;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      const rotate = (x: number, y: number) => {
        const dx = x - cx;
        const dy = y - cy;
        return {
          x: cx + dx * cosA - dy * sinA,
          y: cy + dx * sinA + dy * cosA,
        };
      };

      results.push(transformSvgPath(pathD, rotate));
      results.push(transformSvgPath(folded, rotate));
    }
    // Also include the original folded mirror
    results.push(folded);
  }

  return results.join(' ');
}

/**
 * Rebuilds polygon with rounded corners using quadratic bezier curves
 */
export function rebuildSmoothPolygonWithRoundness(pts: Point[], roundness: number): string {
  const n = pts.length;
  if (n < 3) return rebuildPathFromPoints(pts, false);

  let d = '';
  for (let i = 0; i < n; i++) {
    const pPrev = pts[(i - 1 + n) % n];
    const pCur = pts[i];
    const pNext = pts[(i + 1) % n];

    const d1x = pPrev.x - pCur.x;
    const d1y = pPrev.y - pCur.y;
    const len1 = Math.hypot(d1x, d1y) || 1;

    const d2x = pNext.x - pCur.x;
    const d2y = pNext.y - pCur.y;
    const len2 = Math.hypot(d2x, d2y) || 1;

    const r = Math.min(roundness * 0.9, Math.min(len1, len2) * 0.48);

    const startX = pCur.x + (d1x / len1) * r;
    const startY = pCur.y + (d1y / len1) * r;

    const endX = pCur.x + (d2x / len2) * r;
    const endY = pCur.y + (d2y / len2) * r;

    if (i === 0) {
      d = `M ${f(startX)} ${f(startY)}`;
    } else {
      d += ` L ${f(startX)} ${f(startY)}`;
    }
    d += ` Q ${f(pCur.x)} ${f(pCur.y)}, ${f(endX)} ${f(endY)}`;
  }
  d += ' Z';
  return d;
}

/**
 * Generates basic geometric shapes with anchor points for node manipulation
 */
export function generateGeomShape(
  type: 'rect' | 'circle' | 'triangle' | 'star' | 'diamond' | 'polyline',
  p1: Point,
  p2: Point,
  options?: {
    starPoints?: number;
    starRoundness?: number;
    starIrregularity?: number;
    polylinePoints?: Point[];
  }
): { d: string; points: Point[] } {
  const minX = Math.min(p1.x, p2.x);
  const maxX = Math.max(p1.x, p2.x);
  const minY = Math.min(p1.y, p2.y);
  const maxY = Math.max(p1.y, p2.y);
  const width = Math.max(8, maxX - minX);
  const height = Math.max(8, maxY - minY);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  if (type === 'polyline') {
    const pts = options?.polylinePoints && options.polylinePoints.length >= 2
      ? options.polylinePoints
      : [p1, p2];
    if (pts.length < 2) return { d: '', points: pts };
    const d = `M ${pts.map((p) => `${f(p.x)} ${f(p.y)}`).join(' L ')} Z`;
    return { d, points: pts };
  }

  if (type === 'rect') {
    const points: Point[] = [
      { x: minX, y: minY }, // TL
      { x: maxX, y: minY }, // TR
      { x: maxX, y: maxY }, // BR
      { x: minX, y: maxY }, // BL
    ];
    const d = `M ${f(points[0].x)} ${f(points[0].y)} L ${f(points[1].x)} ${f(points[1].y)} L ${f(points[2].x)} ${f(points[2].y)} L ${f(points[3].x)} ${f(points[3].y)} Z`;
    return { d, points };
  }

  if (type === 'circle') {
    // 8 anchor nodes around the ellipse allowing organic papercut deformation
    const rx = width / 2;
    const ry = height / 2;
    const points: Point[] = [];
    const count = 8;
    for (let i = 0; i < count; i++) {
      const angle = (i * 2 * Math.PI) / count - Math.PI / 2;
      points.push({
        x: cx + rx * Math.cos(angle),
        y: cy + ry * Math.sin(angle),
      });
    }
    const d = rebuildSmoothPolygon(points);
    return { d, points };
  }

  if (type === 'triangle') {
    const points: Point[] = [
      { x: cx, y: minY }, // Top peak
      { x: maxX, y: maxY }, // Bottom right
      { x: minX, y: maxY }, // Bottom left
    ];
    const d = `M ${f(points[0].x)} ${f(points[0].y)} L ${f(points[1].x)} ${f(points[1].y)} L ${f(points[2].x)} ${f(points[2].y)} Z`;
    return { d, points };
  }

  if (type === 'diamond') {
    const points: Point[] = [
      { x: cx, y: minY }, // Top
      { x: maxX, y: cy }, // Right
      { x: cx, y: maxY }, // Bottom
      { x: minX, y: cy }, // Left
    ];
    const d = `M ${f(points[0].x)} ${f(points[0].y)} L ${f(points[1].x)} ${f(points[1].y)} L ${f(points[2].x)} ${f(points[2].y)} L ${f(points[3].x)} ${f(points[3].y)} Z`;
    return { d, points };
  }

  if (type === 'star') {
    // Customizable star (points: 3~16, roundness: 0~25, irregularity: 0~100)
    const numPoints = Math.max(3, Math.min(16, options?.starPoints || 5));
    const roundness = Math.max(0, Math.min(25, options?.starRoundness || 0));
    const irregularity = Math.max(0, Math.min(100, options?.starIrregularity || 0)) / 100;

    const rOuter = Math.min(width, height) / 2;
    const rInner = rOuter * 0.42;
    const totalVertices = numPoints * 2;
    const points: Point[] = [];

    for (let i = 0; i < totalVertices; i++) {
      let baseAngle = (i * Math.PI) / numPoints - Math.PI / 2;
      let baseR = i % 2 === 0 ? rOuter : rInner;

      if (irregularity > 0) {
        // Deterministic organic perturbation based on vertex index
        const angleJitter = Math.sin(i * 3.7 + 1.2) * (Math.PI / numPoints) * 0.35 * irregularity;
        const radiusJitter = 1 + Math.cos(i * 2.3 + 0.5) * 0.28 * irregularity;
        baseAngle += angleJitter;
        baseR *= radiusJitter;
      }

      points.push({
        x: cx + baseR * Math.cos(baseAngle),
        y: cy + baseR * Math.sin(baseAngle),
      });
    }

    if (roundness > 0) {
      const d = rebuildSmoothPolygonWithRoundness(points, roundness);
      return { d, points };
    }

    const d = `M ${points.map((p) => `${f(p.x)} ${f(p.y)}`).join(' L ')} Z`;
    return { d, points };
  }

  return { d: '', points: [] };
}

/**
 * Rebuilds a smooth or sharp closed SVG path from anchor points
 */
export function rebuildPathFromPoints(points: Point[], isSmooth: boolean = false): string {
  if (!points || points.length < 2) return '';
  if (points.length === 2) {
    return `M ${f(points[0].x)} ${f(points[0].y)} L ${f(points[1].x)} ${f(points[1].y)} Z`;
  }

  if (!isSmooth) {
    const parts = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${f(p.x)} ${f(p.y)}`);
    return `${parts.join(' ')} Z`;
  }

  return rebuildSmoothPolygon(points);
}

/**
 * Rebuilds smooth closed polygon with Catmull-Rom or cubic bezier tension
 */
function rebuildSmoothPolygon(pts: Point[]): string {
  const n = pts.length;
  if (n < 3) return rebuildPathFromPoints(pts, false);

  let d = `M ${f(pts[0].x)} ${f(pts[0].y)}`;
  for (let i = 0; i < n; i++) {
    const pPrev = pts[(i - 1 + n) % n];
    const pCur = pts[i];
    const pNext = pts[(i + 1) % n];
    const pNextNext = pts[(i + 2) % n];

    // Control points
    const cp1x = pCur.x + (pNext.x - pPrev.x) / 6;
    const cp1y = pCur.y + (pNext.y - pPrev.y) / 6;
    const cp2x = pNext.x - (pNextNext.x - pCur.x) / 6;
    const cp2y = pNext.y - (pNextNext.y - pCur.y) / 6;

    d += ` C ${f(cp1x)} ${f(cp1y)}, ${f(cp2x)} ${f(cp2y)}, ${f(pNext.x)} ${f(pNext.y)}`;
  }
  d += ' Z';
  return d;
}

/**
 * Robust parser to extract actual anchor vertices from SVG path `d`
 */
export function extractAnchorPointsFromD(d: string): Point[] {
  if (!d) return [];
  const coords: Point[] = [];

  const cmdRegex = /([a-df-z])([^a-df-z]*)/gi;
  let match;
  let curX = 0;
  let curY = 0;

  while ((match = cmdRegex.exec(d)) !== null) {
    const cmd = match[1];
    const isRel = cmd === cmd.toLowerCase();
    const uCmd = cmd.toUpperCase();
    const params = (match[2].match(/[-+]?[0-9]*\.?[0-9]+(?:e[-+]?\d+)?/gi) || []).map(Number);

    if (uCmd === 'M' || uCmd === 'L' || uCmd === 'T') {
      for (let i = 0; i < params.length - 1; i += 2) {
        curX = isRel ? curX + params[i] : params[i];
        curY = isRel ? curY + params[i + 1] : params[i + 1];
        coords.push({ x: curX, y: curY });
      }
    } else if (uCmd === 'H') {
      for (let i = 0; i < params.length; i++) {
        curX = isRel ? curX + params[i] : params[i];
        coords.push({ x: curX, y: curY });
      }
    } else if (uCmd === 'V') {
      for (let i = 0; i < params.length; i++) {
        curY = isRel ? curY + params[i] : params[i];
        coords.push({ x: curX, y: curY });
      }
    } else if (uCmd === 'C') {
      for (let i = 0; i < params.length - 5; i += 6) {
        curX = isRel ? curX + params[i + 4] : params[i + 4];
        curY = isRel ? curY + params[i + 5] : params[i + 5];
        coords.push({ x: curX, y: curY });
      }
    } else if (uCmd === 'S' || uCmd === 'Q') {
      for (let i = 0; i < params.length - 3; i += 4) {
        curX = isRel ? curX + params[i + 2] : params[i + 2];
        curY = isRel ? curY + params[i + 3] : params[i + 3];
        coords.push({ x: curX, y: curY });
      }
    } else if (uCmd === 'A') {
      for (let i = 0; i < params.length - 6; i += 7) {
        curX = isRel ? curX + params[i + 5] : params[i + 5];
        curY = isRel ? curY + params[i + 6] : params[i + 6];
        coords.push({ x: curX, y: curY });
      }
    }
  }

  // Remove trailing point if it equals the start point (closed loop)
  if (coords.length > 2) {
    const first = coords[0];
    const last = coords[coords.length - 1];
    if (Math.hypot(first.x - last.x, first.y - last.y) < 1.5) {
      coords.pop();
    }
  }

  // Remove consecutive duplicate points
  const unique: Point[] = [];
  for (let i = 0; i < coords.length; i++) {
    const pt = coords[i];
    if (
      unique.length === 0 ||
      Math.hypot(pt.x - unique[unique.length - 1].x, pt.y - unique[unique.length - 1].y) > 2
    ) {
      unique.push(pt);
    }
  }

  // If there are still too many vertices (e.g. dense freehand), sample to max 12 key points
  if (unique.length > 12) {
    const step = Math.ceil(unique.length / 10);
    const sampled: Point[] = [];
    for (let i = 0; i < unique.length; i += step) {
      sampled.push(unique[i]);
    }
    return sampled;
  }

  return unique;
}

/**
 * Creates standard basic geometric paper base shapes (rect, circle, diamond, arch, character silhouette)
 */
export function createBaseShapePath(
  type: string,
  width: number,
  height: number,
  padding: number = 80
): string {
  const w = width - padding * 2;
  const h = height - padding * 2;
  const x = padding;
  const y = padding;
  const cx = width / 2;
  const cy = height / 2;

  switch (type) {
    case 'circle': {
      const r = Math.min(w, h) / 2;
      return `M ${f(cx - r)} ${f(cy)} A ${f(r)} ${f(r)} 0 1 0 ${f(cx + r)} ${f(cy)} A ${f(r)} ${f(r)} 0 1 0 ${f(cx - r)} ${f(cy)} Z`;
    }
    case 'rect':
      return `M ${f(x)} ${f(y)} H ${f(x + w)} V ${f(y + h)} H ${f(x)} Z`;
    case 'rounded_rect': {
      const r = 32;
      return `M ${f(x + r)} ${f(y)} H ${f(x + w - r)} Q ${f(x + w)} ${f(y)}, ${f(x + w)} ${f(y + r)} V ${f(y + h - r)} Q ${f(x + w)} ${f(y + h)}, ${f(x + w - r)} ${f(y + h)} H ${f(x + r)} Q ${f(x)} ${f(y + h)}, ${f(x)} ${f(y + h - r)} V ${f(y + r)} Q ${f(x)} ${f(y)}, ${f(x + r)} ${f(y)} Z`;
    }
    case 'arch': {
      // Traditional shrine / arch doorway papercut silhouette (like User image 3)
      const r = w / 2;
      return `M ${f(x)} ${f(y + h)} V ${f(y + r)} A ${f(r)} ${f(r)} 0 0 1 ${f(x + w)} ${f(y + r)} V ${f(y + h)} Z`;
    }
    case 'diamond': {
      return `M ${f(cx)} ${f(y)} L ${f(x + w)} ${f(cy)} L ${f(cx)} ${f(y + h)} L ${f(x)} ${f(cy)} Z`;
    }
    default:
      // Full canvas paper sheet
      return `M 0 0 H ${f(width)} V ${f(height)} H 0 Z`;
  }
}

/**
 * Calculates tight bounding box of SVG path data strings.
 * Used for thumbnail auto-crop to remove transparent empty space.
 */
export function getPathBoundingBox(
  dList: string[],
  fallbackWidth = 800,
  fallbackHeight = 800
): { minX: number; minY: number; width: number; height: number } {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let hasPoints = false;

  for (const d of dList) {
    if (!d) continue;
    // Extract tokens: command letters or numeric coordinates
    const tokens = d.match(/([a-df-z])|(-?\d*\.?\d+(?:e[-+]?\d+)?)/gi);
    if (!tokens) continue;

    let curCmd = '';
    let curX = 0;
    let curY = 0;
    let nums: number[] = [];

    const flush = () => {
      if (!curCmd || nums.length === 0) return;
      const cmd = curCmd;
      const isRel = cmd === cmd.toLowerCase();
      const uCmd = cmd.toUpperCase();

      if (uCmd === 'H') {
        for (const val of nums) {
          curX = isRel ? curX + val : val;
          minX = Math.min(minX, curX);
          maxX = Math.max(maxX, curX);
          hasPoints = true;
        }
      } else if (uCmd === 'V') {
        for (const val of nums) {
          curY = isRel ? curY + val : val;
          minY = Math.min(minY, curY);
          maxY = Math.max(maxY, curY);
          hasPoints = true;
        }
      } else if (uCmd === 'M' || uCmd === 'L' || uCmd === 'T') {
        for (let i = 0; i < nums.length - 1; i += 2) {
          curX = isRel ? curX + nums[i] : nums[i];
          curY = isRel ? curY + nums[i + 1] : nums[i + 1];
          minX = Math.min(minX, curX);
          maxX = Math.max(maxX, curX);
          minY = Math.min(minY, curY);
          maxY = Math.max(maxY, curY);
          hasPoints = true;
        }
      } else if (uCmd === 'C') {
        for (let i = 0; i < nums.length - 5; i += 6) {
          const x1 = isRel ? curX + nums[i] : nums[i];
          const y1 = isRel ? curY + nums[i + 1] : nums[i + 1];
          const x2 = isRel ? curX + nums[i + 2] : nums[i + 2];
          const y2 = isRel ? curY + nums[i + 3] : nums[i + 3];
          curX = isRel ? curX + nums[i + 4] : nums[i + 4];
          curY = isRel ? curY + nums[i + 5] : nums[i + 5];
          minX = Math.min(minX, x1, x2, curX);
          maxX = Math.max(maxX, x1, x2, curX);
          minY = Math.min(minY, y1, y2, curY);
          maxY = Math.max(maxY, y1, y2, curY);
          hasPoints = true;
        }
      } else if (uCmd === 'S' || uCmd === 'Q') {
        for (let i = 0; i < nums.length - 3; i += 4) {
          const x1 = isRel ? curX + nums[i] : nums[i];
          const y1 = isRel ? curY + nums[i + 1] : nums[i + 1];
          curX = isRel ? curX + nums[i + 2] : nums[i + 2];
          curY = isRel ? curY + nums[i + 3] : nums[i + 3];
          minX = Math.min(minX, x1, curX);
          maxX = Math.max(maxX, x1, curX);
          minY = Math.min(minY, y1, curY);
          maxY = Math.max(maxY, y1, curY);
          hasPoints = true;
        }
      } else if (uCmd === 'A') {
        for (let i = 0; i < nums.length - 6; i += 7) {
          curX = isRel ? curX + nums[i + 5] : nums[i + 5];
          curY = isRel ? curY + nums[i + 6] : nums[i + 6];
          minX = Math.min(minX, curX);
          maxX = Math.max(maxX, curX);
          minY = Math.min(minY, curY);
          maxY = Math.max(maxY, curY);
          hasPoints = true;
        }
      }
      nums = [];
    };

    for (const token of tokens) {
      if (/^[a-df-z]$/i.test(token)) {
        flush();
        curCmd = token;
      } else {
        nums.push(parseFloat(token));
      }
    }
    flush();
  }

  if (
    !hasPoints ||
    !isFinite(minX) ||
    !isFinite(maxX) ||
    !isFinite(minY) ||
    !isFinite(maxY) ||
    minX >= maxX ||
    minY >= maxY
  ) {
    return { minX: 0, minY: 0, width: fallbackWidth, height: fallbackHeight };
  }

  const w = Math.max(10, maxX - minX);
  const h = Math.max(10, maxY - minY);
  const pad = Math.max(w, h) * 0.05;

  return {
    minX: Math.max(0, minX - pad),
    minY: Math.max(0, minY - pad),
    width: w + pad * 2,
    height: h + pad * 2,
  };
}

