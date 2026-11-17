// ============================================================================
// 45 · CURVED SURFACES — wings, fins and tailplanes as aerofoils instead of flat
// plates, and the leading-edge extension as a lens that thins to a sharp edge.
// ============================================================================
// Half-thickness of a symmetric NACA four-digit section (closed trailing edge) at chord fraction x, per unit of thickness ratio.
const nacaT = (x) => 5 * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x * x * x - 0.1036 * x * x * x * x);
// A smooth curve through a table of [x, value] points.
function tableAt(P, x) {
  const n = P.length; x = clamp(x, P[0][0], P[n - 1][0]);
  let i = 1; while (i < n - 1 && P[i][0] < x) i++;
  const a = P[i - 1], b = P[i], h = b[0] - a[0], t = (x - a[0]) / h, t2 = t * t, t3 = t2 * t;
  const slope = (j) => { const p = P[Math.max(0, j - 1)], q = P[Math.min(n - 1, j + 1)]; return (q[1] - p[1]) / (q[0] - p[0]); };
  return (2 * t3 - 3 * t2 + 1) * a[1] + (t3 - 2 * t2 + t) * slope(i - 1) * h + (-2 * t3 + 3 * t2) * b[1] + (t3 - t2) * slope(i) * h;
}
// A smooth-shaded sheet through rows of points.
function gridGeo(rows) {
  const n = rows.length, m = rows[0].length, pos = [], idx = [];
  for (const r of rows) for (const p of r) pos.push(p.x, p.y, p.z);
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < m - 1; j++) { const a = i * m + j, b = a + m; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// One chordwise slice of a lifting surface, from span z0 to z1 (metres out, or up a fin).
//   le(z), te(z): stations of the leading and trailing edge · a(z), b(z): where this slice starts and ends (default: the whole chord)
//   y: height of the chord plane · tc: thickness ratio · s: side · tip: length of span over which the tip rounds off
//   bias: how much of that rounding is taken off the leading edge (0 to 1) · lift: stands this far proud of the surface (for strips painted on it)
function foilGeo(o) {
  const F = (v) => (typeof v === "function" ? v : () => v), A = o.a || o.le, Bn = o.b || o.te, Y = F(o.y ?? 0), TC = F(o.tc ?? 0.05);
  const s = o.s ?? 1, nx = o.nx ?? 14, nz = o.nz ?? 8, lift = o.lift ?? 0, tip = o.tip ?? 0, bias = o.bias ?? 0.5, zEnd = o.z1 - tip;
  const zs = [];
  for (let k = 0; k <= nz; k++) zs.push([o.z0 + ((zEnd - o.z0) * k) / nz, 1]);
  if (tip > 0) for (const u of [0.3, 0.55, 0.75, 0.88, 0.96, 1]) zs.push([zEnd + tip * u, Math.pow(Math.max(0, 1 - Math.pow(u, 4)), 0.25)]);
  const up = [], lo = [];
  let wrap = true;
  for (const [z, kf] of zs) {
    const le0 = o.le(z), te0 = o.te(z), c0 = te0 - le0, le = le0 + (1 - kf) * c0 * bias, te = te0 - (1 - kf) * c0 * (1 - bias), c = Math.max(te - le, 1e-4);
    const xa = (clamp(A(z), le, te) - le) / c, xb = (clamp(Bn(z), le, te) - le) / c;
    if (xa > 1e-4) wrap = false;
    const ru = [], rl = [];
    for (let i = 0; i <= nx; i++) {
      const f = i / nx, x = xa + (xb - xa) * (xa < 1e-4 ? 1 - Math.cos((Math.PI / 2) * f) : f), ht = Math.max(0, TC(z) * c * nacaT(x)) + (kf > 0 ? lift : 0);
      ru.push(V3(X(le + x * c), Y(z) + ht, s * z)); rl.push(V3(X(le + x * c), Y(z) - ht, s * z));
    }
    up.push(ru); lo.push(rl);
  }
  const geos = [], last = zs.length - 1;
  if (wrap) geos.push(gridGeo(zs.map((_, k) => lo[k].slice().reverse().concat(up[k].slice(1)))));     // one skin round the leading edge
  else geos.push(gridGeo(up), gridGeo(lo), gridGeo(zs.map((_, k) => [lo[k][0], up[k][0]])));         // upper, lower and the forward cut face
  geos.push(gridGeo(zs.map((_, k) => [up[k][nx], lo[k][nx]])));                                       // aft face
  geos.push(gridGeo([up[0], lo[0]]));                                                                 // root rib
  if (!tip) geos.push(gridGeo([up[last], lo[last]]));                                                 // tip rib
  return mergeGeos(geos);
}
// Leading-edge extension: outer edge from the drawing's top view, thick at the fuselage and thinning to a sharp edge.
const LEX_EDGE = [[3.45, 0.45], [3.6, 0.56], [4.0, 0.72], [4.5, 0.83], [5.0, 0.92], [5.5, 0.99], [6.0, 1.04], [7.0, 1.2], [8.0, 1.31], [8.72, 1.37], [9.2, 1.37]];
function lexGeo(s, yc = 2.39, t0 = 0.11) {
  const NS = 56, NU = 7, top = [], bot = [];
  for (let i = 0; i <= NS; i++) {
    const st = 3.45 + ((9.2 - 3.45) * i) / NS, ze = Math.max(0.452, tableAt(LEX_EDGE, st)), rt = [], rb = [];
    for (let j = 0; j <= NU; j++) { const u = j / NU, z = 0.45 + u * (ze - 0.45), t = t0 * Math.pow(1 - u, 0.7) + 0.004; rt.push(V3(X(st), yc + t / 2, s * z)); rb.push(V3(X(st), yc - t / 2, s * z)); }
    top.push(rt); bot.push(rb);
  }
  return mergeGeos([gridGeo(top), gridGeo(bot), gridGeo(top.map((r, i) => [r[NU], bot[i][NU]])), gridGeo([top[NS], bot[NS]])]);
}
