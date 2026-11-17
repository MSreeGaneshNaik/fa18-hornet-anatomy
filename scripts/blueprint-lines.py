"""Builds src/data/12-blueprint.js: the line work of the McDonnell Douglas F/A-18A three-view (side and top views), traced into vector
polylines. Each line of the scan is thinned to its centreline, followed pixel by pixel, straightened, and stored with how heavy
the drawing made it. The page redraws them as clean hairlines and projects them onto the skin."""
import base64, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage
from skimage.morphology import skeletonize

START = os.getcwd()
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import sys
if len(sys.argv) < 2: sys.exit("usage: python3 scripts/blueprint-lines.py path/to/three-view.jpg   (the source drawing is not kept in this repository)")
im = Image.open(os.path.abspath(sys.argv[1]) if os.path.isabs(sys.argv[1]) else os.path.join(START, sys.argv[1])).convert("L")
K = 2   # traced at twice the scan's resolution

def mask(x0, y0, x1, y1, erase):
    g = im.crop((x0, y0, x1, y1))
    big = g.resize((g.width * 4, g.height * 4), Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.2))      # the grey edges of the scan place each line to a fraction of a pixel
    cover = Image.fromarray(((np.asarray(big) < 132) * 255).astype(np.uint8)).resize((g.width * K, g.height * K), Image.BOX)
    m = np.asarray(cover) > 127
    lab, n = ndimage.label(m, structure=np.ones((3, 3)))                                                 # drop specks of scan noise
    size = ndimage.sum(m, lab, range(1, n + 1)); m &= np.isin(lab, 1 + np.flatnonzero(size >= 10))
    pm = Image.fromarray((m * 255).astype(np.uint8)); d = ImageDraw.Draw(pm)
    for poly in erase: d.polygon([((px - x0) * K, (py - y0) * K) for px, py in poly], fill=0)
    return np.asarray(pm) > 0, m

NB = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
def trace(sk):
    """Skeleton pixels to paths: from every end or junction along the line to the next end or junction; then the closed loops."""
    pts = set(map(tuple, np.argwhere(sk)))
    nb = {p: [(p[0] + dy, p[1] + dx) for dy, dx in NB if (p[0] + dy, p[1] + dx) in pts] for p in pts}
    # a diagonal step is dropped where a straight step reaches the same pixel through a shared neighbour (keeps junctions simple)
    for p, ns in nb.items():
        straight = {q for q in ns if q[0] == p[0] or q[1] == p[1]}
        nb[p] = [q for q in ns if q in straight or not any((abs(q[0] - r[0]) + abs(q[1] - r[1])) == 1 for r in straight)]
    node = {p for p, ns in nb.items() if len(ns) != 2}
    used, paths = set(), []
    for a in node:
        for b in nb[a]:
            if (a, b) in used: continue
            path, prev, cur = [a, b], a, b
            used.add((a, b))
            while cur not in node:
                nxt = [q for q in nb[cur] if q != prev]
                if not nxt: break
                prev, cur = cur, nxt[0]; path.append(cur)
            used.add((cur, prev))
            paths.append(path)
    seen = {p for path in paths for p in path}
    for p in pts:
        if p in seen or p in node: continue
        path, prev, cur = [p], None, p
        while True:
            nxt = [q for q in nb[cur] if q != prev and (q not in seen or q == p)]
            seen.add(cur)
            if not nxt: break
            prev, cur = cur, nxt[0]
            path.append(cur)
            if cur == p: break
        if len(path) > 2: paths.append(path)
    for p in node:
        if not nb[p]: paths.append([p])                      # a lone dot (rivet, fastener)
    return paths, nb

def simplify(P, tol):
    """Douglas-Peucker."""
    if len(P) < 3: return P
    P = np.asarray(P, float); keep = np.zeros(len(P), bool); keep[0] = keep[-1] = True
    stack = [(0, len(P) - 1)]
    while stack:
        i, j = stack.pop()
        if j - i < 2: continue
        a, b = P[i], P[j]; ab = b - a; L = np.hypot(*ab)
        seg = P[i + 1:j] - a
        d = np.abs(seg[:, 0] * ab[1] - seg[:, 1] * ab[0]) / L if L > 1e-9 else np.hypot(seg[:, 0], seg[:, 1])
        k = int(np.argmax(d))
        if d[k] > tol: keep[i + 1 + k] = True; stack += [(i, i + 1 + k), (i + 1 + k, j)]
    return P[keep]

def silhouette(full):
    """The aircraft as one filled shape: fill everything the lines enclose, shave off thin things (label pointers, lettering), keep the biggest piece."""
    filled = ndimage.binary_fill_holes(ndimage.binary_dilation(full, iterations=1))
    opened = ndimage.binary_opening(filled, structure=ndimage.generate_binary_structure(2, 1), iterations=5)
    lab, n = ndimage.label(opened)
    size = ndimage.sum(opened, lab, range(1, n + 1))
    return lab == 1 + int(np.argmax(size))

def vectorise(m, full, name):
    """Lines to polylines, keeping only what is drawn ON the aircraft's skin. Dropped: the aircraft's own outline (the model draws its
    own edges), anything outside the aircraft (labels), and label pointers, which are followed in from outside for as long as they run straight."""
    sil = silhouette(full)
    inside = ndimage.distance_transform_edt(sil)            # how far inside the silhouette
    outside = ndimage.distance_transform_edt(~sil)          # how far outside
    edt = ndimage.distance_transform_edt(m)
    paths, nb = trace(skeletonize(m))
    P = []
    for path in paths:
        closed = len(path) > 2 and path[0] == path[-1]
        ends_free = len(nb[path[0]]) == 1 or len(nb[path[-1]]) == 1
        if 1 < len(path) < 6 and ends_free and not (len(nb[path[0]]) == 1 and len(nb[path[-1]]) == 1): continue   # a spur off the side of a line
        ys, xs = np.array([p[0] for p in path]), np.array([p[1] for p in path])
        P.append(dict(path=path, closed=closed, r=float(np.median(edt[ys, xs])), out=outside[ys, xs], ins=inside[ys, xs], drop=None))
    # 1 · outside the aircraft, and the aircraft's own outline
    for q in P:
        if (q["out"] > 8).sum() >= 6 or (q["out"] > 0).mean() > 0.5: q["drop"] = "outside"
        elif (q["ins"] < 7).mean() > 0.7: q["drop"] = "outline"
        elif q["r"] >= 3.7 and (q["ins"] < 12).mean() > 0.5: q["drop"] = "outline"
    # 2 · label pointers: carry on from each outside line through the junctions it crosses, while it keeps straight
    def heading(path, at_start, n=14):
        a = np.array(path[0] if at_start else path[-1], float); b = np.array(path[min(n, len(path) - 1)] if at_start else path[max(-n - 1, -len(path))], float)
        v = b - a; L = np.hypot(*v); return v / L if L > 0 else None
    def straight(path):
        a, b = np.array(path[0], float), np.array(path[-1], float); ab = b - a; L = np.hypot(*ab)
        if L < 4: return True
        s = np.array(path, float) - a
        return np.abs(s[:, 0] * ab[1] - s[:, 1] * ab[0]).max() / L < 2.2
    ends = {}
    for k, q in enumerate(P):
        if len(q["path"]) > 1: ends.setdefault(q["path"][0], []).append((k, True)); ends.setdefault(q["path"][-1], []).append((k, False))
    keys = np.array(list(ends.keys()))
    for q in [q for q in P if q["drop"] == "outside" and len(q["path"]) > 12 and straight(q["path"])]:
        for at_start in (True, False):
            e = q["path"][0] if at_start else q["path"][-1]
            if outside[e] > 6: continue                                   # this end is not the one that reaches the aircraft
            d = heading(q["path"], at_start); d = None if d is None else -d      # direction of travel into the aircraft
            for _ in range(40):
                if d is None: break
                near = keys[np.hypot(keys[:, 0] - e[0], keys[:, 1] - e[1]) < 7]
                best = None
                for key in map(tuple, near):
                    for k, st in ends[key]:
                        c = P[k]
                        if c["drop"] or not straight(c["path"]): continue
                        h = heading(c["path"], st)
                        if h is not None and float(h @ d) > 0.975 and (best is None or float(h @ d) > best[0]): best = (float(h @ d), k, st)
                if not best: break
                _, k, st = best; P[k]["drop"] = "pointer"
                e = P[k]["path"][-1] if st else P[k]["path"][0]; d = heading(P[k]["path"], st)
    out = []
    for q in P:
        if q["drop"]: continue
        path, closed = q["path"], q["closed"]
        extra = int(round(min(max(q["r"] - 2.3, 0), 2.0) * 2))               # heavier than a plain line by this much, in half pixels (kept modest)
        xy = np.array([(p[1] + 0.5, p[0] + 0.5) for p in path], float)
        if len(xy) >= 7:                                                     # take the pixel stair-steps and scan wobble out; ends stay where they join other lines
            sm = ndimage.gaussian_filter1d(xy[:-1] if closed else xy, 3.0, axis=0, mode="wrap" if closed else "nearest")
            if closed: xy = np.vstack([sm, sm[:1]])
            else: sm[0], sm[-1] = xy[0], xy[-1]; xy = sm
        xy = [tuple(v) for v in xy]
        if closed and len(xy) > 8:                                           # simplify a loop as two halves so it stays closed
            h = len(xy) // 2; pts = list(simplify(xy[:h + 1], 0.6)) + list(simplify(xy[h:], 0.6))[1:]
        else: pts = list(simplify(xy, 0.6))
        out.append((extra, [(int(round(x * 2)), int(round(y * 2))) for x, y in pts]))      # stored in half pixels
    # a picture of what was kept (black) and dropped (red: outside, orange: outline, blue: pointer), for checking
    pv = Image.new("RGB", (m.shape[1], m.shape[0]), "white"); d = ImageDraw.Draw(pv)
    col = {None: (0, 0, 0), "outside": (255, 150, 150), "outline": (255, 170, 0), "pointer": (0, 90, 255)}
    for q in P:
        pts = [(p[1], p[0]) for p in q["path"]]
        if len(pts) > 1: d.line(pts, fill=col[q["drop"]], width=2 if q["drop"] else 1)
    pv.save(f"/home/claude/bp/keep_{name}.png")
    print(name, "kept", len(out), "dropped", {k: sum(1 for q in P if q["drop"] == k) for k in ("outside", "outline", "pointer")})
    return out

def pack(lines):
    b = bytearray()
    def var(v):
        while v >= 128: b.append((v & 127) | 128); v >>= 7
        b.append(v)
    zig = lambda v: (v << 1) ^ (v >> 31)
    for extra, pts in lines:
        var(len(pts)); var(extra)
        px = py = 0
        for x, y in pts: var(zig(x - px)); var(zig(y - py)); px, py = x, y
    return base64.b64encode(bytes(b)).decode()

# side view: px = 1497 - 86.2 * station, py = 411 - 86.2 * height
S, XN, YG = 86.2, 1497, 411
sp = lambda st, h: (XN - S * st, YG - S * h)
side_m, side_full = mask(22, 8, 1506, 332, [
    [sp(8.95, 2.2), sp(13.3, 2.02), sp(13.7, 1.5), sp(13.7, 0.8), sp(8.95, 0.8)],      # wing pylons, launcher and Sparrow drawn in front of the fuselage
    [sp(4.4, 1.18), sp(6.6, 1.18), sp(6.6, 0.0), sp(4.4, 0.0)],                         # nose gear
    [sp(-0.3, 1.2), sp(0.36, 1.2), sp(0.36, 2.0), sp(-0.3, 2.0)],
    [sp(3.3, 2.2), sp(3.3, 2.38), sp(6.0, 2.53), sp(13.0, 2.53), sp(13.3, 2.0), sp(8.95, 2.18)],        # the wing and its extension seen edge-on in front of the fuselage
    [sp(13.5, 1.64), sp(17.2, 1.64), sp(17.2, 1.92), sp(13.5, 1.92)],                                  # the tailplane seen edge-on
    [sp(7.9, 1.2), sp(8.95, 1.2), sp(8.95, 2.0), sp(7.9, 2.0)],                                        # stencil lettering on the intake, too small to trace                       # the very tip of the radome, where the outline would print as a blot
])
# top view: px = 1103 + 85.8 * station, py = 550 - 85.8 * z (starboard up)
T, X0, YC = 85.8, 1103, 550
tp = lambda st, z: (X0 + T * st, YC - T * z)
fin = lambda s: [tp(11.45, s * 0.84), tp(14.7, s * 0.84), tp(15.05, s * 1.84), tp(13.72, s * 1.84)]
top_m, top_full = mask(1094, 44, 2571, 1056, [fin(1), fin(-1), [tp(5.75, -0.93), tp(6.15, -0.93), tp(6.15, -1.2), tp(5.75, -1.2)]])   # and the tip of the LEX label's pointer                                    # the fins, which the drawing shows from above over the tail
side, top = vectorise(side_m, side_full, "side"), vectorise(top_m, top_full, "top")

js = f'''// Line work of the supplied McDonnell Douglas F/A-18A three-view, traced into vector polylines (scripts/blueprint-lines.py).
// w, h: size of the traced view in pixels · k: pixels per metre · ox, oy, x0, y0: where station 0 / height 0 fall · d: the polylines
// (count, weight, then points as deltas in half pixels). side: u from the station, v from the height; top: u from the station, v from the half-width.
const BP = {{
  side: {{ w: {side_m.shape[1]}, h: {side_m.shape[0]}, x0: {22 * K}, y0: {8 * K}, k: {S * K}, ox: {XN * K}, oy: {YG * K}, d: "{pack(side)}" }},
  top: {{ w: {top_m.shape[1]}, h: {top_m.shape[0]}, x0: {1094 * K}, y0: {44 * K}, k: {T * K}, ox: {X0 * K}, oy: {YC * K}, d: "{pack(top)}" }},
}};
'''
open("src/data/12-blueprint.js", "w").write(js)
for name, m, lines in (("side", side_m, side), ("top", top_m, top)):
    pv = Image.new("L", (m.shape[1] * 2, m.shape[0] * 2), 255); d = ImageDraw.Draw(pv)
    for extra, pts in lines:
        if len(pts) == 1: x, y = pts[0]; r = 2 + extra; d.ellipse([x - r, y - r, x + r, y + r], fill=0)
        else: d.line(pts, fill=0, width=2 + extra * 2, joint="curve")
    pv.save(f"/home/claude/bp/vec_{name}.png")
    print(name, m.shape, "polylines", len(lines), "points", sum(len(p) for _, p in lines), "heavy", sum(1 for e, _ in lines if e))
print("js bytes", len(js))
