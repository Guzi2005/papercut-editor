import cv2, numpy as np, math, json, os
from skimage.morphology import skeletonize
from scipy import ndimage as ndi

K = 4
AXO = 227.75  # fold in original pixels, after straightening the scan
TILT = -2.5
ROT_O = cv2.getRotationMatrix2D((AXO, 172), TILT, 1.0)
ROT_K = cv2.getRotationMatrix2D((AXO * K, 172 * K), TILT, 1.0)
DET_AX = 225
up = np.load('/tmp/red_up.npy')
H, W = up.shape
red = (up > 0.5).astype(np.uint8)
white = (up < 0.5).astype(np.uint8)
white[:, DET_AX * K:] = 0
n, lab, st, cen = cv2.connectedComponentsWithStats(white, connectivity=4)

S = 960 / (2 * AXO)
OY = (780 - 344 * S) / 2
fmt = lambda v: ('%.1f' % v).rstrip('0').rstrip('.')
def cv(x, y): return (20 + x * S, OY + y * S)  # original px -> canvas
def straighten(pts): return [tuple(ROT_O @ np.array([x, y, 1.0])) for x, y in pts]
def mirror_pts(pts): return [(2 * AXO - x, y) for x, y in pts]

def poly_d(pts, smooth=True):
    """Closed path through original-px points; quadratic midpoints give a clean knife curve."""
    c = [cv(x, y) for x, y in pts]
    if not smooth:
        return 'M ' + ' L '.join(f'{fmt(x)} {fmt(y)}' for x, y in c) + ' Z'
    m = lambda a, b: ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
    s = m(c[-1], c[0]); d = f'M {fmt(s[0])} {fmt(s[1])}'
    for i, p in enumerate(c):
        q = m(p, c[(i + 1) % len(c)]); d += f' Q {fmt(p[0])} {fmt(p[1])} {fmt(q[0])} {fmt(q[1])}'
    return d + ' Z'

# ---------------- motif generators (original px) ----------------

def willow(center, halfw, sharp=0.7, skew=1.0):
    """柳叶刀口: tapered slit along a centreline, pointed at both ends."""
    n = len(center); L = [0.0]
    for i in range(1, n): L.append(L[-1] + math.dist(center[i], center[i - 1]))
    left, right = [], []
    for i, (x, y) in enumerate(center):
        t = L[i] / L[-1]
        w = halfw * (math.sin(math.pi * t ** skew) ** sharp)
        a, b = center[max(0, i - 1)], center[min(n - 1, i + 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]; ln = math.hypot(dx, dy) or 1
        nx, ny = -dy / ln, dx / ln
        left.append((x + nx * w, y + ny * w)); right.append((x - nx * w, y - ny * w))
    return left + right[::-1][1:-1]

def redness_at(x, y):
    return float(cv2.getRectSubPix(up, (1, 1), (x * K, y * K))[0, 0])

def leaf(tip, mid, root, hw, n=28):
    c = (2 * mid[0] - (tip[0] + root[0]) / 2, 2 * mid[1] - (tip[1] + root[1]) / 2)
    ts = np.linspace(0, 1, n + 1)
    B = np.array([((1 - t) ** 2 * tip[0] + 2 * (1 - t) * t * c[0] + t * t * root[0],
                   (1 - t) ** 2 * tip[1] + 2 * (1 - t) * t * c[1] + t * t * root[1]) for t in ts])
    # snap the hand-read curve onto the whitest line of the actual cut in the reference
    snapped = []
    for k in range(2, n - 1):
        d = B[k + 1] - B[k - 1]; d /= np.linalg.norm(d); nrm = np.array([-d[1], d[0]])
        offs = np.arange(-1.6, 1.61, 0.1)
        cost = [redness_at(*(B[k] + nrm * o)) + 0.05 * abs(o) for o in offs]
        snapped.append((ts[k], B[k] + nrm * offs[int(np.argmin(cost))]))
    T = np.array([t for t, _ in snapped]); Pp = np.array([p for _, p in snapped])
    cx_, cy_ = np.polyfit(T, Pp[:, 0], 2), np.polyfit(T, Pp[:, 1], 2)
    center = [(np.polyval(cx_, t), np.polyval(cy_, t)) for t in ts]
    return willow(center, hw, sharp=0.6, skew=1.4)

def fit_centerline(mask):
    sk = skeletonize(mask)
    ys, xs = np.nonzero(sk)
    pts = np.stack([xs, ys], 1).astype(float)
    if len(pts) < 4:
        ys, xs = np.nonzero(mask); pts = np.stack([xs, ys], 1).astype(float)
    mu = pts.mean(0); u, s, vt = np.linalg.svd(pts - mu); d = vt[0]; nrm = np.array([-d[1], d[0]])
    t = (pts - mu) @ d; o = (pts - mu) @ nrm
    deg = 2 if len(pts) > 12 else 1
    cf = np.polyfit(t, o, deg)
    dt = ndi.distance_transform_edt(mask)
    hw = np.percentile(dt[sk], 80) if sk.any() else 1.0
    ext = hw * 1.6 + (t.max() - t.min()) * 0.08
    ts = np.linspace(t.min() - ext, t.max() + ext, 24)
    c = [tuple((mu + d * tt + nrm * np.polyval(cf, tt)) / K) for tt in ts]
    return c, hw / K

def fan_scale(bx, by, r, ang, needles=7):
    """松针鳞: a white dome cut away around a red mound whose thin needles stand in it.
    (bx, by) is the arc centre, ang the dome's facing in degrees (-90 = straight up)."""
    ux, uy = math.cos(math.radians(ang)), math.sin(math.radians(ang))
    vx, vy = -uy, ux
    loc = lambda p, q: (bx + vx * p + ux * q, by + vy * p + uy * q)
    hd = 0.32 * r
    ext = math.asin(hd / r)
    pts = [loc(-r * math.cos(-ext + (math.pi + 2 * ext) * k / 28), r * math.sin(-ext + (math.pi + 2 * ext) * k / 28)) for k in range(29)]
    r0 = r * 0.4
    hw = 0.95
    pts.append(loc(r0, -hd))
    for j in range(needles):
        th = math.radians(20 + 140 * j / (needles - 1))
        cx, cy = math.cos(th), math.sin(th)
        # distance from the hub (0, -hd) to the dome edge along this needle
        bq = -hd * cy; d = -bq + math.sqrt(bq * bq - (hd * hd - r * r))
        rt = d * (0.84 - 0.08 * abs(math.cos(th)))
        nx, ny = -cy, cx
        pts.append(loc(cx * r0 - nx * hw, cy * r0 - hd - ny * hw))
        pts.append(loc(cx * rt - nx * 0.18, cy * rt - hd - ny * 0.18))
        pts.append(loc(cx * rt + nx * 0.18, cy * rt - hd + ny * 0.18))
        pts.append(loc(cx * r0 + nx * hw, cy * r0 - hd + ny * hw))
    pts.append(loc(-r0, -hd))
    return pts

def crescent(cx, cy, r, a0, a1, thick, n=28):
    """月牙: outer arc with an inner arc that thins to a point at both ends."""
    o, i = [], []
    for k in range(n + 1):
        t = k / n; a = math.radians(a0 + (a1 - a0) * t)
        rr = r - thick * math.sin(math.pi * t) ** 0.8
        o.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
        i.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
    return o + i[::-1][1:-1]

def comb(hub, tips, r_in, wt):
    """梳齿: flat-ended teeth cut in from the paper edge, converging on a solid hub."""
    polys = []
    for tx, ty in tips:
        dx, dy = tx - hub[0], ty - hub[1]; L = math.hypot(dx, dy); ux, uy = dx / L, dy / L; nx, ny = -uy, ux
        b = (hub[0] + ux * r_in * 0.5, hub[1] + uy * r_in * 0.5)
        w0 = wt * 0.55
        polys.append([(b[0] + nx * w0, b[1] + ny * w0), (tx + nx * wt / 2, ty + ny * wt / 2),
                      (tx - nx * wt / 2, ty - ny * wt / 2), (b[0] - nx * w0, b[1] - ny * w0)])
    return polys

def petal_ring(cx, cy, r, w, petals=5, rot=-90, bridge=16):
    """梅花: the outline of each petal cut as an arc, with paper bridges at the notches."""
    out = []
    step = 360 / petals
    for k in range(petals):
        a0 = rot + k * step
        pc = (cx + math.cos(math.radians(a0)) * r * 0.55, cy + math.sin(math.radians(a0)) * r * 0.55)
        pr = r * 0.5
        arc_o, arc_i = [], []
        for t in range(13):
            a = math.radians(a0 - 100 + bridge / 2 + (200 - bridge) * t / 12)
            arc_o.append((pc[0] + math.cos(a) * (pr + w / 2), pc[1] + math.sin(a) * (pr + w / 2)))
            arc_i.append((pc[0] + math.cos(a) * (pr - w / 2), pc[1] + math.sin(a) * (pr - w / 2)))
        out.append(arc_o + arc_i[::-1])
    return out

def circle_pts(cx, cy, r, n=20):
    return [(cx + math.cos(2 * math.pi * k / n) * r, cy + math.sin(2 * math.pi * k / n) * r) for k in range(n)]

# ---------------- assignments ----------------

WILLOW = [42, 45, 48, 49]
PAINT_ONLY = [3, 4, 10, 11, 18, 20, 25, 33, 19, 27, 34]
# (tip, middle, root, half width): the long fin cuts, read off the reference by hand
LEAVES = [
    ((114.4, 55), (101.6, 90), (109, 119), 1.25), ((144, 42), (122, 84), (122, 113), 1.5),
    ((157, 55), (137, 85), (131.6, 115), 1.5), ((168, 63), (151, 90), (143, 113), 1.5),
    ((167, 109), (156, 120), (141, 131), 1.1), ((179, 115), (162, 130), (143, 140), 1.35),
    ((192, 122), (170, 141), (148, 149), 1.5), ((201, 137), (176, 153), (147, 158), 1.6),
    ((53, 112), (64.5, 133), (74.5, 161), 1.05), ((52.5, 132), (62.5, 146), (70.5, 164), 1.05),
    ((65.5, 106), (73.5, 129), (81.5, 157), 1.15), ((72, 107), (83, 132), (92, 159), 1.25),
]
SCALES = [46, 47, 52, 55, 54, 61, 59, 60, 64, 65, 66]
FLOWER_BITS = [26, 35, 16, 36, 41, 43, 44]
EXTRA_SCALES = [(95.5, 118.5, 242.0, 263.0)]  # merged into the side gap in the trace

cuts = {'柳叶纹': [], '松针鳞': [], '月牙纹': [], '梅花': [], '镂空': []}
paint = np.zeros_like(red)

for i in WILLOW:
    m = lab == i
    c, hw = fit_centerline(m)
    cuts['柳叶纹'].append(willow(c, max(hw * 1.05, 0.9)))
    paint |= cv2.dilate(m.astype(np.uint8), np.ones((5, 5), np.uint8))

def ransac_circle(P, iters=1500, tol=0.7):
    rng = np.random.default_rng(3); best = None
    for _ in range(iters):
        a, b, c = P[rng.choice(len(P), 3, replace=False)]
        d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]))
        if abs(d) < 1e-6: continue
        ux = ((a @ a) * (b[1] - c[1]) + (b @ b) * (c[1] - a[1]) + (c @ c) * (a[1] - b[1])) / d
        uy = ((a @ a) * (c[0] - b[0]) + (b @ b) * (a[0] - c[0]) + (c @ c) * (b[0] - a[0])) / d
        r = math.dist((ux, uy), a)
        if not 7 < r < 16: continue
        inl = np.abs(np.hypot(P[:, 0] - ux, P[:, 1] - uy) - r) < tol
        if best is None or inl.sum() > best[0]: best = (inl.sum(), ux, uy, r, inl)
    return best

for i in PAINT_ONLY:
    paint |= cv2.dilate((lab == i).astype(np.uint8), np.ones((5, 5), np.uint8))
cuts['柳叶纹'] += [leaf(*l) for l in LEAVES]

scales = []
for i in SCALES:
    m = (lab == i).astype(np.uint8)
    cnt = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)[0][0][:, 0, :] / K
    _, ux, uy, rr, inl = ransac_circle(cnt.astype(float))
    arc = cnt[inl]
    angs = np.arctan2(arc[:, 1] - uy, arc[:, 0] - ux)
    face = math.degrees(math.atan2(np.sin(angs).mean(), np.cos(angs).mean()))
    scales.append((ux, uy, rr + 0.3, -90 + (ux - 156) * 0.4))
    paint |= cv2.dilate(m, np.ones((5, 5), np.uint8))
scales.append((106.5, 258.5, 11.0, -110))
yy, xx = np.mgrid[0:H, 0:W]
for bx, by, rr, ang in scales:
    cuts['松针鳞'].append(fan_scale(bx, by, rr, ang, 7 if rr > 10.5 else 6))
    ux, uy = math.cos(math.radians(ang)), math.sin(math.radians(ang))
    dx, dy = xx / K - bx, yy / K - by
    paint |= ((dx * dx + dy * dy < (rr + 1.2) ** 2) & (dx * ux + dy * uy > -0.8)).astype(np.uint8)
print('scales', [(round(a, 1), round(b, 1), round(c, 1), round(d)) for a, b, c, d in scales])

for i in FLOWER_BITS:
    paint |= cv2.dilate((lab == i).astype(np.uint8), np.ones((5, 5), np.uint8))
for cx, cy, r, w, rot in [(123.0, 142.5, 13.0, 2.4, -60), (85.5, 181.5, 11.0, 2.2, -150)]:
    cuts['梅花'] += petal_ring(cx, cy, r, w, 5, rot)
cuts['梅花'].append(circle_pts(118.5, 149.5, 2.6))
cuts['梅花'].append(circle_pts(89.0, 182.5, 2.3))

for i in [70, 71]:
    paint |= cv2.dilate((lab == i).astype(np.uint8), np.ones((7, 7), np.uint8))
cuts['月牙纹'] += [crescent(130.2, 278.2, 22.3, 181, 333, 6.5), crescent(131.5, 292, 21.1, 209, 331, 3.8),
                 crescent(172.8, 277.8, 20.8, 211, 347, 6.5), crescent(172.5, 291, 21.1, 209, 331, 3.8)]

COMBS = [
    ((73, 252), [(40, 248), (42, 241), (46, 234), (54, 226), (63, 219), (73, 218), (82, 221), (93, 229)], 13, 3.8),
    ((104, 295), [(80, 279), (77, 287), (77, 297), (80, 306), (86, 313), (93, 319)], 10, 3.2),
]
INV_O = cv2.invertAffineTransform(ROT_O)
unstraighten = lambda p: tuple(INV_O @ np.array([p[0], p[1], 1.0]))
# the comb that meets its mirror on the fold, measured on the straightened scan
COMBS.append((unstraighten((200, 276)), [unstraighten(t) for t in [(217, 248), (223, 254), (228.5, 264), (228.5, 271.5), (228.5, 281), (228.5, 289), (219.5, 297.5), (213.5, 301.5)]], 6, 3.0))
erase = np.zeros_like(red); teeth = np.zeros_like(red)
yy, xx = np.mgrid[0:H, 0:W]
for hub, tips, r_in, wt in COMBS:
    angs = [math.atan2(ty - hub[1], tx - hub[0]) for tx, ty in tips]
    ref = angs[len(angs) // 2]
    rel = [((a - ref + math.pi) % (2 * math.pi)) - math.pi for a in angs]
    R = max(math.dist(hub, t) for t in tips)
    A = np.arctan2(yy / K - hub[1], xx / K - hub[0]); A = ((A - ref + np.pi) % (2 * np.pi)) - np.pi
    D = np.hypot(yy / K - hub[1], xx / K - hub[0])
    erase |= ((D > r_in) & (D < R + 2.5) & (A > min(rel) - 0.12) & (A < max(rel) + 0.12)).astype(np.uint8)
    for p in comb(hub, tips, r_in, wt):
        cv2.fillPoly(teeth, [np.array([[x * K, y * K] for x, y in p], np.int32)], 1)
    cv2.circle(teeth, (int(hub[0] * K), int(hub[1] * K)), int(r_in * K * 0.75), 1, -1)

# the stalk that carries the upper comb down to the lower one
cv2.line(teeth, (73 * K, 252 * K), (103 * K, 294 * K), 1, int(3.4 * K))

# ---------------- silhouette + structural holes ----------------
half = red.copy()
half[paint > 0] = 1
half[erase > 0] = 0
half[teeth > 0] = 1
if half.shape[1] < int(AXO * K): half = np.hstack([half, np.zeros((H, int(AXO * K) - half.shape[1]), np.uint8)])
half = (cv2.warpAffine(half.astype(np.float32), ROT_K, (half.shape[1], half.shape[0])) > 0.5).astype(np.uint8)
half = half[:, :int(AXO * K)]
cv2.imwrite('/tmp/shots/halfr.png', (1 - half[240 * K:310 * K, 180 * K:]) * 255)
full = np.hstack([half, half[:, ::-1]])
full = cv2.morphologyEx(full, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
cs, hier = cv2.findContours(full, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
hier = hier[0]
base, holes = [], []
def contour_pts(c, eps):
    pts = c[:, 0, :].astype(float)
    # circular gaussian smoothing so traced edges read as one confident knife stroke
    if len(pts) > 12:
        k = 2
        pts = np.stack([ndi.gaussian_filter1d(pts[:, j], k, mode='wrap') for j in (0, 1)], 1)
    ap = cv2.approxPolyDP(pts.astype(np.float32).reshape(-1, 1, 2), eps, True)[:, 0, :]
    return [((x + 0.5) / K, (y + 0.5) / K) for x, y in ap]
for i, c in enumerate(cs):
    A = cv2.contourArea(c) / K / K
    if hier[i][3] == -1:
        print("outer piece area", round(A)); base.append(contour_pts(c, 1.4)) if A > 50 else None
    elif A > 6:
        holes.append(contour_pts(c, 1.2))

def signed_area(p):
    return sum(p[i][0] * p[(i + 1) % len(p)][1] - p[(i + 1) % len(p)][0] * p[i][1] for i in range(len(p))) / 2
base = [p if signed_area(p) > 0 else p[::-1] for p in base]

out_cuts = []
for motif, lst in cuts.items():
    ds = []
    for p in lst:
        sharp = motif == '松针鳞'
        q = straighten(p)
        ds.append(poly_d(q, smooth=not sharp))
        ds.append(poly_d(mirror_pts(q), smooth=not sharp))
    out_cuts.append((motif, ds))
out_cuts.append(('镂空', [poly_d(p) for p in holes]))

ts = "/**\n * @license\n * SPDX-License-Identifier: Apache-2.0\n */\n\n"
ts += "// Double-fish window flower: one red sheet folded on x = 500. The paper edge is traced from the\n"
ts += "// reference; every motif (柳叶纹, 松针鳞, 梅花) is re-cut as a clean knife shape at its traced spot.\n\n"
ts += "export const FISH_PAPER_EDGE = " + json.dumps(' '.join(poly_d(p) for p in base)) + ";\n\n"
ts += "export const FISH_CUTS: { motif: string; d: string[] }[] = [\n"
for motif, ds in out_cuts:
    ts += f"  {{ motif: {json.dumps(motif, ensure_ascii=False)}, d: {json.dumps(ds)} }},\n"
ts += "];\n"
open('/workspace/src/utils/doubleFishTrace.ts', 'w').write(ts)
print('base', len(base), {m: len(d) for m, d in out_cuts}, 'bytes', os.path.getsize('/workspace/src/utils/doubleFishTrace.ts'))

json.dump({m: lst for m, lst in cuts.items()}, open('/tmp/left_cuts.json', 'w'))
