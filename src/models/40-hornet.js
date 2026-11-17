// ============================================================================
// 40 · F/A-18A HORNET — airframe and what is inside it. Metres; nose toward +x,
// up +y, starboard +z. Stations are metres aft of the nose tip: X(station).
// ============================================================================
// Fuselage cross-sections: [station, half-width, height above the reference line, depth below it, reference y, squareness]
const FUS = [
  [0, 0.004, 0.004, 0.004, 1.61, 2], [0.03, 0.026, 0.028, 0.028, 1.61, 2], [0.08, 0.051, 0.055, 0.055, 1.611, 2], [0.15, 0.078, 0.085, 0.085, 1.612, 2], [0.3, 0.126, 0.137, 0.137, 1.613, 2],
  [0.5, 0.18, 0.195, 0.195, 1.615, 2], [0.75, 0.238, 0.258, 0.258, 1.633, 2], [1.0, 0.29, 0.315, 0.315, 1.655, 2],
  [1.5, 0.4, 0.42, 0.41, 1.7, 2], [2.0, 0.47, 0.51, 0.48, 1.74, 2.1], [2.5, 0.5, 0.63, 0.51, 1.76, 2.3], [2.9, 0.53, 0.725, 0.535, 1.775, 2.5, 3.2],
  [3.3, 0.58, 0.78, 0.6, 1.82, 3.2, 5], [5.8, 0.6, 0.8, 0.61, 1.82, 3.2, 5], [7.0, 0.66, 0.88, 0.59, 1.82, 3.2, 4], [8.0, 0.72, 0.82, 0.58, 1.8, 3.2],
  [9.0, 1.2, 0.8, 0.68, 1.76, 3.3], [10.0, 1.2, 0.77, 0.7, 1.75, 3.2], [11.6, 1.13, 0.75, 0.7, 1.75, 3.2], [13.0, 1.06, 0.69, 0.63, 1.75, 3.1],
  [14.4, 1.01, 0.63, 0.57, 1.75, 3.0], [15.3, 0.98, 0.57, 0.5, 1.76, 3.0], [15.85, 0.955, 0.49, 0.45, 1.775, 3.2],
];
// Between the stations of the table every dimension follows a smooth curve that never overshoots (monotone cubic), so the skin
// has no flats or waists where one station hands over to the next.
const FUS_TAN = [1, 2, 3, 4, 5, 6].map((k) => {
  const n = FUS.length, x = FUS.map((r) => r[0]), y = FUS.map((r) => r[k] ?? r[5]), d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((y[i + 1] - y[i]) / (x[i + 1] - x[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) { m[i] = 0; continue; }
    const h0 = x[i] - x[i - 1], h1 = x[i + 1] - x[i], w1 = 2 * h1 + h0, w2 = h1 + 2 * h0;
    m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
  }
  return { y, m };
});
function fusAt(st) {
  st = clamp(st, FUS[0][0], FUS[FUS.length - 1][0]);
  let i = 1; while (i < FUS.length - 1 && FUS[i][0] < st) i++;
  const x0 = FUS[i - 1][0], h = FUS[i][0] - x0, t = (st - x0) / h, t2 = t * t, t3 = t2 * t;
  const f = (k) => { const { y, m } = FUS_TAN[k - 1]; return (2 * t3 - 3 * t2 + 1) * y[i - 1] + (t3 - 2 * t2 + t) * h * m[i - 1] + (-2 * t3 + 3 * t2) * y[i] + (t3 - t2) * h * m[i]; };
  return { w: f(1), hu: f(2), hl: f(3), c: f(4), n: f(5), nu: f(6), z0: 0 };   // nu: squareness of the upper half, where it differs
}
function sectionPt(S, t) {
  const cs = Math.cos(t), sn = Math.sin(t), e = 2 / (sn > 0 ? S.nu ?? S.n : S.n);
  return [S.c + (sn >= 0 ? S.hu : S.hl) * Math.sign(sn) * Math.pow(Math.abs(sn), e), (S.z0 || 0) + S.w * Math.sign(cs) * Math.pow(Math.abs(cs), e)];
}
// Skin lofted through sections from station x0 to x1; t0..t1 is the part of each section drawn (0 = starboard waterline, 90° = top).
function loft(secAt, x0, x1, o = {}) {
  const nx = o.nx ?? Math.max(4, Math.ceil((x1 - x0) / 0.1)), nt = o.nt ?? 64, t0 = o.t0 ?? 0, t1 = o.t1 ?? TAU;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= nx; i++) {
    const st = x0 + ((x1 - x0) * i) / nx, S = secAt(st);
    const a0 = typeof t0 === "function" ? t0(st) : t0, a1 = typeof t1 === "function" ? t1(st) : t1;
    for (let j = 0; j <= nt; j++) { const [y, z] = sectionPt(S, a0 + ((a1 - a0) * j) / nt); pos.push(X(st), y, z); uv.push(j / nt, i / nx); }
  }
  for (let i = 0; i < nx; i++) for (let j = 0; j < nt; j++) { const a = i * (nt + 1) + j, b = a + nt + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// A flat bulkhead filling one section (or its lower / upper half).
function bulkhead(secAt, st, t0 = 0, t1 = TAU, n = 48) {
  const S = secAt(st), pos = [X(st), S.c, S.z0 || 0], idx = [];
  for (let j = 0; j <= n; j++) { const [y, z] = sectionPt(S, t0 + ((t1 - t0) * j) / n); pos.push(X(st), y, z); }
  for (let j = 1; j <= n; j++) idx.push(0, j, j + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
const wingPts = (pts, s) => pts.map(([st, z]) => [X(st), z * s]);
// A group offset inside a module, so a whole assembly can be placed without rewriting its coordinates.
const sub = (g0, dx, dy, dz = 0) => { const g = new THREE.Group(); g.position.set(dx, dy, dz); g0.add(g); return g; };
// Wing anhedral: the panel hangs 3.2 degrees down from its root, which sits 2.2 m above the deck.
const dihedral = (g0, s) => { const piv = new THREE.Group(); piv.position.set(0, 2.2, s * 0.45); piv.rotation.x = s * 3.2 * DEG; g0.add(piv); return sub(piv, 0, -2.38, -s * 0.45); };
// The cockpit and seat were laid out 0.5 m further forward and 0.08 m lower; PIT moves them under the drawing's canopy.
const PIT = { dx: -0.5, dy: 0.08 };
const LIVE = { petals: [], rotors: [], fold: [], fx: [], exits: [], smoke: [], loads: [], flaps: [] };

function buildJetTextures() {
  // skin: frames across, longerons along, rivet rows and a few access doors
  T.skin = TEX(2048, 1024, (P) => {
    for (let i = 1; i < 10; i++) { P.hline(i / 10, 0.5, 2); P.rivets(i / 10 + 0.012, 90, 0.35, 1.3); }
    for (const u of [0.07, 0.18, 0.32, 0.43, 0.57, 0.68, 0.82, 0.93]) P.vline(u, 0.4, 1.6);
    for (const [u, v, du, dv] of [[0.09, 0.22, 0.07, 0.14], [0.2, 0.55, 0.1, 0.12], [0.6, 0.32, 0.06, 0.2], [0.84, 0.62, 0.07, 0.16], [0.34, 0.74, 0.07, 0.1], [0.7, 0.06, 0.09, 0.1]]) { P.rect(u, v, du, dv, 0.55, 1.8); P.dot(u + 0.008, v + 0.012, 2.2, 0.5); P.dot(u + du - 0.008, v + dv - 0.012, 2.2, 0.5); }
  });
  T.deck = TEX(2048, 2048, (P) => {
    for (let i = 0; i <= 8; i++) { P.hline(i / 8, 0.28, 2); P.vline(i / 8, 0.28, 2); }
    for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) { const u = (i + 0.5) / 16, v = (j + 0.5) / 16; P.ring(u, v, 7, 0.5, 2); for (let k = 0; k < 5; k++) P.polyline([[u, v], [u + (7 / 2048) * Math.cos((k / 5) * TAU), v + (7 / 2048) * Math.sin((k / 5) * TAU)]], 0.45, 1.5); }
  }, { wrap: false });
  T.tank = TEX(512, 512, (P) => { for (const v of [0.2, 0.5, 0.8]) { P.hline(v - 0.015, 0.5, 2); P.hline(v + 0.015, 0.5, 2); } P.rect(0.04, 0.04, 0.92, 0.92, 0.3, 1.5); P.ring(0.78, 0.5, 16, 0.6, 2); });
  T.panel = TEX(512, 256, (P) => { for (const [u, w] of [[0.06, 0.26], [0.37, 0.26], [0.68, 0.26]]) { P.paint(u, 0.3, w, 0.55, 0.9); P.rect(u, 0.3, w, 0.55, 0.8, 2); } for (let i = 0; i < 14; i++) P.dot(0.07 + i * 0.066, 0.14, 4, 0.7); }, { wrap: false });
  T.radar = TEX(512, 512, (P) => { for (let i = 1; i < 16; i++) P.hline(i / 16, 0.5, 1.5); for (let i = 1; i < 16; i++) P.vline(i / 16, 0.25, 1.2); });
  T.hatch = TEX(256, 256, (P) => { for (let i = -8; i < 16; i++) P.polyline([[i / 8, 0], [i / 8 + 1, 1]], 0.85, 2.2); }, { aniso: 4 });
  T.plateTop = TEX(1024, 1024, (P) => { P.rect(0.03, 0.03, 0.94, 0.94, 0.5, 2); P.rect(0.06, 0.06, 0.88, 0.88, 0.25, 1.5); for (let i = 1; i < 12; i++) { P.hline(i / 12, 0.14, 1.2); P.vline(i / 12, 0.14, 1.2); } }, { wrap: false });
  T.bpSide = bpTex(BP.side); T.bpTop = bpTex(BP.top);
  T.liner = TEX(1024, 512, (P) => { for (let v = 0.06; v < 1; v += 0.11) P.rivets(v, 48, 0.6, 2.4); for (let v = 0.115; v < 1; v += 0.11) P.hline(v, 0.4, 1.2); });
  T.petal = TEX(256, 256, (P) => { P.vline(0.5, 0.45, 2); P.hline(0.3, 0.3, 1.5); P.hline(0.7, 0.3, 1.5); P.rivets(0.94, 6, 0.5, 2); });
}

function buildHornet() {
  buildJetTextures();
  const skin = { map: T.skin, side: DS, inkA: 0.55 };
  const TOP = [0, Math.PI], LOW = [Math.PI, TAU];
  // The skin carries the drawing's own lines: its side view on the flanks, its top view on the upper surfaces. The belly, which the drawing does not show, keeps a plain frame pattern.
  const skinS = { map: T.bpSide, side: DS, inkA: 0.9, proj: "side" }, skinT = { map: T.bpTop, side: DS, inkA: 0.9, proj: "top" }, Q4 = Math.PI / 4;
  const SECT = [[0, Q4, "side"], [Q4, 3 * Q4, "top"], [3 * Q4, (4 * Math.PI) / 3, "side"], [(4 * Math.PI) / 3, (5 * Math.PI) / 3, "belly"], [(5 * Math.PI) / 3, TAU, "side"]];
  const dress = (g, geo, kind, role = "white") => (kind === "belly" ? add(g, geo, role, skin) : add(g, projUV(geo, kind), role, kind === "side" ? skinS : skinT));
  const shell = (g, x0, x1, [t0, t1], role = "white") => { for (const [a, b, kind] of SECT) { const u0 = Math.max(a, t0), u1 = Math.min(b, t1); if (u1 - u0 > 1e-6) dress(g, loft(fusAt, x0, x1, { t0: u0, t1: u1, nt: Math.max(4, Math.ceil(((u1 - u0) / Math.PI) * 40)) }), kind, role); } };

  // ---------------- flight deck, chocks and chains ----------------
  within((part("deck", { name: "Flight deck", by: "tie-down grid", desc: "The aircraft is chocked and chained to the deck's pad-eyes for a high-power engine run, so every pound of thrust ends up in the plume.", kv: [["Tie-downs", "main gear and nose gear"], ["Pad-eye spacing", "about 2.4 m (drawn)"]] }), "deck"), (g) => {
    add(g, prismGeo([[-13, -9], [13, -9], [13, 9], [-13, 9]], -0.3, 0), "deck", { map: T.deck });
    add(g, prismGeo([[-13.2, -9.2], [13.2, -9.2], [13.2, 9.2], [-13.2, 9.2]], -0.6, -0.3), "grey");
    const B = bulk();
    for (const s of [-1, 1]) {
      for (const dx of [-0.52, 0.52]) B.add(prismGeo([[X(10.9) + dx - 0.16, s * 1.55 - 0.16], [X(10.9) + dx + 0.16, s * 1.55 - 0.16], [X(10.9) + dx + 0.16, s * 1.55 + 0.16], [X(10.9) + dx - 0.16, s * 1.55 + 0.16]], 0, 0.14), "paint");
      for (const [dx, dz] of [[1.9, 1.6], [-1.9, 1.6]]) { B.add(rodGeo(V3(X(10.9), 0.5, s * 1.5), V3(X(10.9) + dx, 0.02, s * (1.5 + dz)), 0.022, 6), "dark"); B.add(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 12).translate(X(10.9) + dx, 0.015, s * (1.5 + dz)), "grey"); }
      B.add(rodGeo(V3(X(5.4), 0.55, s * 0.05), V3(X(5.4) + 1.6, 0.02, s * 1.3), 0.022, 6), "dark");
      B.add(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 12).translate(X(5.4) + 1.6, 0.015, s * 1.3), "grey");
    }
    B.flush(g);
    smokeSet(g, V3(X(16.57), 1.81, 0), 1, null);
  });

  // ---------------- lower fuselage: the keel everything else hangs on ----------------
  within((part("keel", { name: "Lower fuselage", by: "McDonnell Douglas · Northrop", desc: "The lower half of the fuselage from the radar bulkhead to the engine bay: nose-wheel well, intake cheeks, main-gear wells and the keel between the engines. Northrop built the centre and aft fuselage, McDonnell Douglas the forward fuselage and wings.", kv: [["Length overall", "17.07 m · 56 ft"], ["Height", "4.66 m · 15 ft 3.5 in"], ["Structure", "aluminium, with graphite-epoxy skins"]] }), "keel"), (g) => {
    shell(g, 1.5, 5.9, LOW); shell(g, 5.9, 11.6, LOW); shell(g, 11.6, 15.85, LOW);
    add(g, bulkhead(fusAt, 1.5), "light", { side: DS });
    for (const st of [5.9, 11.6]) add(g, bulkhead(fusAt, st, Math.PI, TAU), "light", { side: DS });
    { // aft closure frame, with an opening for each tailpipe
      const S = fusAt(15.85), sh = new THREE.Shape();
      for (let k = 0; k < 72; k++) { const [y, z] = sectionPt(S, (k / 72) * TAU); if (k) sh.lineTo(z, y); else sh.moveTo(z, y); }
      for (const sgn of [-1, 1]) { const h = new THREE.Path(); h.absarc(sgn * 0.5, 1.81, 0.447, 0, TAU, true); sh.holes.push(h); }
      add(g, new THREE.ShapeGeometry(sh, 24).rotateY(-Math.PI / 2).translate(X(15.85), 0, 0), "grey", { side: DS });
    }
    const B = bulk();
    // frames and longerons inside the shell
    for (const st of [2.3, 3.1, 3.9, 4.7, 6.8, 7.7, 8.6, 9.5, 10.4, 12.4, 13.3, 14.2, 15.1]) {
      const S = fusAt(st), ring = [];
      for (let j = 0; j <= 24; j++) { const [y, z] = sectionPt({ ...S, w: S.w * 0.965, hl: S.hl * 0.965 }, Math.PI + (Math.PI * j) / 24); ring.push(V3(X(st), y, z)); }
      B.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ring), 48, 0.022, 5, false), "grey");
    }
    for (const s of [-1, 1]) B.add(rodGeo(V3(X(1.6), 1.6, s * 0.34), V3(X(5.8), 1.72, s * 0.55), 0.02, 6), "grey");
    B.add(boxGeo(8.4, 0.24, 0.04, X(10.75), 1.37, 0), "grey");                       // keel web between the engine bays
    // intakes: lip, inner wall and the splitter plate that keeps the boundary layer out
    for (const s of [-1, 1]) {
      const lip = (st) => { const k = smooth(8.8, 9.7, st); return { w: lerp(0.33, 0.24, k), hu: lerp(0.42, 0.3, k), hl: lerp(0.42, 0.3, k), c: lerp(1.6, 1.62, k), n: 3, z0: s * lerp(0.95, 0.88, k) }; };
      add(g, projUV(loft(lip, 8.1, 9.7, { nt: 40, nx: 36 }), "side"), "white", skinS);
      add(g, bulkhead(lip, 8.85, 0, TAU, 28), "dark", { side: DS });
    }
    // arrestor hook
    B.add(rodGeo(V3(X(14.9), 1.3, 0), V3(X(16.42), 1.41, 0), 0.045, 8), "grey");
    B.add(boxGeo(0.2, 0.07, 0.09).rotateZ(-0.073).translate(X(16.48), 1.405, 0), "dark");
    B.flush(g);
  });

  // ---------------- landing gear ----------------
  within((part("gear", { name: "Landing gear", by: "Cleveland Pneumatic", desc: "Built for carrier landings at a sink rate no land-based fighter is asked to take. The twin-wheel nose gear carries the catapult launch bar; each main leg is a levered trailing arm that folds aft and rotates 90° to lie flat in the fuselage.", kv: [["Nose gear", "twin wheels, launch bar"], ["Main gear", "single wheel, levered arm"], ["Track", "3.11 m"], ["Wheelbase", "5.42 m"]] }), "gear"), (g) => {
    const B = bulk();
    const tyre = (x, y, z, r, w) => {
      const prof = [[r * 0.45, -w / 2], [r * 0.82, -w / 2, 1], [r, -w * 0.3, 1], [r, w * 0.3, 1], [r * 0.82, w / 2, 1], [r * 0.45, w / 2]];
      B.add(turn(prof, { seg: 36 }).rotateX(Math.PI / 2).translate(x, y, z), "paint");
      B.add(turn([[0, -w * 0.42], [r * 0.5, -w * 0.42], [r * 0.5, w * 0.42], [0, w * 0.42]], { seg: 24 }).rotateX(Math.PI / 2).translate(x, y, z), "light");
      boltCircle(B, V3(x, y, z + w * 0.42), V3(0, 0, 1), r * 0.32, 8, 0.012, 0.012); boltCircle(B, V3(x, y, z - w * 0.42), V3(0, 0, -1), r * 0.32, 8, 0.012, 0.012);
    };
    const nx = X(5.4);
    const belly = (st, z) => { const S = fusAt(st); return S.c - S.hl * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(z) / S.w, S.n)), 1 / S.n); };
    // a door plate hanging from a hinge line on the belly, splayed outboard
    const door = (st, len, h, z, splay, s) => B.add(boxGeo(len, h, 0.016, 0, -h / 2, 0).rotateX(-s * splay * DEG).translate(X(st), belly(st, z) + 0.035, s * z), "white");
    tyre(nx, 0.28, 0.17, 0.28, 0.14); tyre(nx, 0.28, -0.17, 0.28, 0.14);
    B.add(rodGeo(V3(nx, 0.28, -0.26), V3(nx, 0.28, 0.26), 0.04, 10), "grey");
    B.add(rodGeo(V3(nx, 0.28, 0), V3(nx, 0.82, 0), 0.045, 12), "silver"); B.add(rodGeo(V3(nx, 0.78, 0), V3(nx, 1.4, 0), 0.07, 14), "light");
    B.add(rodGeo(V3(nx, 1.0, 0), V3(nx - 0.75, 1.42, 0), 0.03, 8), "grey"); B.add(rodGeo(V3(nx, 0.36, 0), V3(nx + 0.62, 0.09, 0), 0.028, 8), "grey");
    B.add(boxGeo(0.14, 0.05, 0.16, nx + 0.66, 0.08, 0), "dark");
    for (const s of [-1, 1]) { B.add(rodGeo(V3(nx + 0.06, 0.5, s * 0.06), V3(nx + 0.2, 0.68, s * 0.06), 0.012, 6), "grey"); B.add(rodGeo(V3(nx + 0.2, 0.68, s * 0.06), V3(nx + 0.06, 0.88, s * 0.06), 0.012, 6), "grey"); door(5.6, 0.8, 0.22, 0.25, 24, s); }
    B.add(boxGeo(0.016, 0.4, 0.24, nx + 0.078, 1.2, 0), "white"); B.add(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 14).rotateZ(Math.PI / 2).translate(nx + 0.105, 1.08, 0), "glass");
    for (const s of [-1, 1]) {
      const ax = V3(X(10.9), 0.38, s * 1.55), knee = V3(X(10.5), 0.95, s * 1.36), top = V3(X(10.45), 1.46, s * 1.16);
      tyre(ax.x, ax.y, ax.z, 0.38, 0.24);
      B.add(rodGeo(V3(ax.x, ax.y, s * 1.38), ax, 0.05, 10), "grey");
      B.add(rodGeo(V3(ax.x, ax.y, s * 1.4), knee, 0.06, 12), "light");
      B.add(rodGeo(knee, top, 0.075, 14), "light");
      B.add(rodGeo(V3(X(10.72), 0.62, s * 1.4), V3(X(11.25), 1.37, s * 1.05), 0.04, 10), "silver");
      B.add(rodGeo(knee, V3(X(10.0), 1.43, s * 1.14), 0.03, 8), "grey");
      door(10.55, 1.1, 0.4, 1.17, 42, s); door(11.3, 0.6, 0.22, 0.6, 0, s);
    }
    B.flush(g);
  });

  // ---------------- radar ----------------
  within((part("radar", { name: "AN/APG-65 radar", by: "Hughes Aircraft", desc: "A pulse-Doppler radar behind the radome: a flat slotted-array antenna on a gimbal, with its transmitter, receiver and processor on a rack that slides forward on rails for servicing.", kv: [["Type", "multimode pulse-Doppler, X band"], ["Antenna", "flat slotted array, gimballed"], ["Later aircraft", "AN/APG-73"]] }), "radar"), (g0) => { const g = sub(g0, 0, -0.27);
    const B = bulk();
    add(g, lx([[0, X(1.04)], [0.27, X(1.04)], [0.27, X(1.08)], [0, X(1.08)]], { seg: 48 }).translate(0, 1.962, 0), "light", { map: T.radar });
    B.add(lx([[0, X(1.08)], [0.09, X(1.08)], [0.11, X(1.24)], [0, X(1.24)]], { seg: 20 }).translate(0, 1.962, 0), "grey");
    for (const s of [-1, 1]) B.add(rodGeo(V3(X(1.16), 1.965, s * 0.09), V3(X(1.5), 1.965, s * 0.24), 0.022, 8), "grey");
    B.add(boxGeo(0.34, 0.2, 0.2, X(1.33), 1.965, 0), "grey");
    for (const [y, z, h, w] of [[2.06, -0.14, 0.17, 0.22], [2.06, 0.12, 0.17, 0.22], [1.85, -0.15, 0.2, 0.24], [1.85, 0.13, 0.2, 0.22]]) { B.add(boxGeo(0.58, h, w, X(1.86), y, z), "dark"); B.add(new THREE.CylinderGeometry(0.02, 0.02, 0.05, 8).rotateZ(Math.PI / 2).translate(X(2.17), y, z), "grey"); }
    cable(B, [[X(1.2), 2.06, 0.05], [X(1.4), 2.2, 0.1], [X(1.6), 2.2, 0.14]], 0.012, { clip: 0.2 });
    B.flush(g);
  });
  within((part("radome", { name: "Radome", by: "hinges to starboard", desc: "A glass-fibre cone that lets the radar look through it. It is hinged on the starboard side: take the aircraft apart and it swings open to uncover the antenna, as the drawing shows.", kv: [["Material", "glass-fibre composite"], ["Length", "about 1.5 m"], ["Opens", "hinged to starboard"]] }, [0, 0, 0]), "radome"), (g) => {
    const hz = fusAt(1.5).w, hy = fusAt(1.5).c, hinge = new THREE.Group(); hinge.position.set(X(1.5), hy, hz); g.add(hinge); LIVE.radome = hinge;
    add(hinge, projUV(loft(fusAt, 0, 1.5, { nt: 48, nx: 60 }), "side").translate(-X(1.5), -hy, -hz), "light", skinS);
    for (const dy of [-0.16, 0.16]) add(hinge, boxGeo(0.07, 0.06, 0.016, 0, dy, 0.004), "grey");                 // two hinge lugs
  });

  // ---------------- cannon ----------------
  within((part("gun", { name: "M61A1 Vulcan gun system", by: "General Electric · now General Dynamics", desc: "A six-barrel 20 mm rotary cannon on the centreline above the radar. A hydraulic motor turns the barrel cluster and each barrel fires once a turn, so six barrels at 1,000 turns a minute give 6,000 shots a minute while each barrel fires only 1,000. The feed has no links: live rounds climb one chute from the drum and the empty cases come back down the other into the same drum, so nothing is thrown overboard. Take the aircraft apart and the Fire cannon switch runs it.", kv: [["Calibre", "20 × 102 mm, electrically primed"], ["Barrels", "6, each fires once a turn"], ["Rate of fire", "4,000 or 6,000 shots a minute"], ["Ammunition", "578 rounds · 5.8 s at the high rate"], ["Feed", "rotary, linkless, closed loop"], ["Drive", "hydraulic"], ["Muzzle velocity", "1,030 m/s · 3,380 ft/s"], ["Gun weight", "112.5 kg · 248 lb"], ["Average recoil", "14.2 kN · 3,200 lbf at 6,000 a minute"], ["Dispersion", "8 mrad circle holds 80% of shots"]] }, [0, 1.15, 0]), "gun"), (g0) => buildGun(sub(g0, -0.25, -0.14)));

  // ---------------- cockpit ----------------
  // Everything here stays inside the tub and under the canopy: the sill is at y 2.46, half-width 0.44.
  within((part("cockpit", { name: "Cockpit", by: "single seat · F/A-18A", desc: "The first fighter cockpit built around screens: two display indicators either side, a map display low in the centre and the up-front control panel under the head-up display. The stick and the two throttles carry the radar and weapon switches, so one pilot can fly the fighter and the attack mission without taking a hand off either.", kv: [["Displays", "2 display indicators · map display · HUD"], ["Up-front control", "radios, autopilot and navigation entry"], ["Controls", "HOTAS, quadruplex fly-by-wire"], ["Left console", "throttles, fuel, flight-control panel"], ["Right console", "electrics, lighting, environmental"], ["Crew", "1"]] }), "cockpit"), (g0) => { const g = sub(g0, PIT.dx, PIT.dy);
    const B = bulk();
    const bx = (s0, s1, y0, y1, z0, z1, role) => B.add(boxGeo(s1 - s0, y1 - y0, Math.abs(z1 - z0), X((s0 + s1) / 2), (y0 + y1) / 2, (z0 + z1) / 2), role);
    const knob = (st, y, z, r = 0.012, h = 0.018, role = "dark") => B.add(new THREE.CylinderGeometry(r, r, h, 10).translate(X(st), y + h / 2, z), role);
    const dial = (st, y, z, r) => { B.add(new THREE.CylinderGeometry(r + 0.006, r + 0.006, 0.012, 16).rotateZ(Math.PI / 2).translate(X(st + 0.006), y, z), "grey"); B.add(new THREE.CylinderGeometry(r, r, 0.004, 16).rotateZ(Math.PI / 2).translate(X(st + 0.014), y, z), "glass"); };
    // tub: floor, side walls, front and seat bulkheads, and the sill the canopy closes on
    bx(3.02, 5.46, 1.76, 1.79, -0.42, 0.42, "grey");
    for (const s of [-1, 1]) { bx(3.05, 5.44, 1.79, 2.45, s * 0.43, s * 0.45, "light"); bx(3.95, 5.44, 2.45, 2.476, s * 0.43, s * 0.45, "grey"); }
    bx(3.03, 3.06, 1.79, 2.45, -0.44, 0.44, "light"); bx(5.42, 5.46, 1.79, 2.5, -0.44, 0.44, "light");
    for (let i = 0; i < 9; i++) bx(3.3 + i * 0.25, 3.31 + i * 0.25, 1.79, 1.795, -0.24, 0.24, "light");        // floor ribs
    // main instrument panel
    add(g, boxGeo(0.04, 0.5, 0.78, X(3.5), 2.21, 0), "paint", { map: T.panel });
    const face = 3.52;
    const screen = (y, z, w, h) => {
      bx(face, face + 0.012, y - h / 2 - 0.014, y + h / 2 + 0.014, z - w / 2 - 0.014, z + w / 2 + 0.014, "grey");
      bx(face + 0.012, face + 0.017, y - h / 2, y + h / 2, z - w / 2, z + w / 2, "glass");
      for (let i = 0; i < 5; i++) for (const sg of [-1, 1]) {
        B.add(boxGeo(0.006, 0.008, 0.012, X(face + 0.016), y + sg * (h / 2 + 0.007), z + (i - 2) * w * 0.2), "dark");
        B.add(boxGeo(0.006, 0.012, 0.008, X(face + 0.016), y + (i - 2) * h * 0.2, z + sg * (w / 2 + 0.007)), "dark");
      }
    };
    screen(2.3, -0.235, 0.15, 0.15); screen(2.3, 0.235, 0.15, 0.15); screen(2.1, 0, 0.14, 0.14);              // left and right display indicators, colour map display
    bx(face, face + 0.02, 2.31, 2.42, -0.095, 0.095, "grey");                                               // up-front control
    bx(face + 0.02, face + 0.024, 2.385, 2.41, -0.08, 0.08, "glass");
    for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) B.add(boxGeo(0.006, 0.014, 0.02, X(face + 0.023), 2.33 + r * 0.02, -0.06 + c * 0.03), "dark");
    for (const [y, z, r] of [[2.03, 0.16, 0.028], [2.03, 0.235, 0.028], [2.1, 0.3, 0.024], [2.03, 0.31, 0.02], [2.11, 0.17, 0.02]]) dial(face, y, z, r);   // standby instruments
    bx(face, face + 0.014, 2.02, 2.12, -0.36, -0.24, "grey"); bx(face + 0.014, face + 0.018, 2.035, 2.105, -0.345, -0.255, "glass");   // engine and fuel display
    B.add(rodGeo(V3(X(face), 2.2, -0.36), V3(X(face + 0.07), 2.2, -0.36), 0.008, 6), "grey"); B.add(sphereGeo(0.018, X(face + 0.075), 2.2, -0.36, 10, 8), "paint");   // landing-gear handle
    for (let i = 0; i < 4; i++) knob(face + 0.004, 1.99, -0.14 + i * 0.045, 0.01, 0.012);
    bx(3.36, 3.53, 2.5, 2.585, -0.07, 0.07, "grey");                                                        // head-up display unit and its two combiner glasses
    for (const st of [3.47, 3.52]) B.add(boxGeo(0.005, 0.13, 0.13).rotateZ(0.45).translate(X(st), 2.65, 0), "glass");
    for (const s of [-1, 1]) B.add(rodGeo(V3(X(3.48), 2.585, s * 0.068), V3(X(3.55), 2.71, s * 0.068), 0.004, 5), "grey");
    // stick, pedals
    B.add(new THREE.CylinderGeometry(0.05, 0.065, 0.06, 14).translate(X(3.98), 1.82, 0), "paint");
    B.add(rodGeo(V3(X(3.98), 1.84, 0), V3(X(3.93), 2.13, 0), 0.012, 8), "grey");
    B.add(boxGeo(0.04, 0.12, 0.04).rotateZ(-0.25).translate(X(3.915), 2.19, 0), "dark"); B.add(sphereGeo(0.012, X(3.89), 2.24, 0.012, 8, 6), "paint");
    for (const s of [-1, 1]) { B.add(boxGeo(0.02, 0.13, 0.1).rotateZ(-0.35).translate(X(3.64), 1.93, s * 0.16), "grey"); B.add(rodGeo(V3(X(3.62), 1.9, s * 0.16), V3(X(3.5), 1.82, s * 0.16), 0.012, 6), "grey"); }
    // side consoles: throttles and panels on the left, electrics and environment on the right
    for (const s of [-1, 1]) {
      bx(3.75, 5.05, 1.79, 2.13, s * 0.26, s * 0.43, "light");
      for (let i = 0; i < 5; i++) bx(3.8 + i * 0.25, 3.805 + i * 0.25, 2.13, 2.134, s * 0.27, s * 0.42, "grey");                   // panel joints
      bx(3.9, 4.95, 2.2, 2.4, s * 0.424, s * 0.43, "grey");                                                                      // wall panel
      for (let i = 0; i < 6; i++) B.add(boxGeo(0.03, 0.03, 0.008, X(4.0 + i * 0.17), 2.3, s * 0.42), "dark");
    }
    bx(3.92, 4.26, 2.134, 2.15, -0.42, -0.28, "grey");                                                      // throttle quadrant
    for (const z of [-0.375, -0.325]) { B.add(rodGeo(V3(X(4.14), 2.14, z), V3(X(4.07), 2.27, z), 0.009, 6), "grey"); B.add(boxGeo(0.06, 0.05, 0.04, X(4.065), 2.29, z), "dark"); }
    for (let i = 0; i < 6; i++) knob(4.36 + i * 0.11, 2.134, -0.39 + (i % 2) * 0.08, i % 3 ? 0.012 : 0.018, i % 3 ? 0.018 : 0.012);
    for (let i = 0; i < 4; i++) B.add(boxGeo(0.014, 0.022, 0.008, X(4.4 + i * 0.12), 2.145, -0.3), "paint");
    for (let i = 0; i < 9; i++) knob(3.85 + i * 0.13, 2.134, 0.3 + (i % 3) * 0.045, i % 4 ? 0.011 : 0.017, 0.016);
    bx(4.2, 4.42, 2.134, 2.15, 0.3, 0.41, "grey"); bx(4.22, 4.4, 2.15, 2.153, 0.31, 0.4, "glass");
    for (let i = 0; i < 5; i++) B.add(boxGeo(0.014, 0.024, 0.008, X(4.56 + i * 0.09), 2.146, 0.39), "paint");
    B.add(rodGeo(V3(X(4.9), 2.3, 0.415), V3(X(5.08), 2.36, 0.415), 0.01, 6), "paint");                       // canopy handle
    cable(B, [[X(5.3), 2.1, 0.3], [X(5.2), 2.2, 0.36], [X(5.0), 2.14, 0.36]], 0.012, { clip: 0.12 });
    // under the glass, in the drawing's own stations: the coaming under the windscreen and the deck behind the seat
    const act = (geo) => geo.translate(-PIT.dx, -PIT.dy, 0);
    const plan = (a, b, inset, cap = 9) => { const st = []; for (let k = 0; k <= 14; k++) st.push(a + ((b - a) * k) / 14); const half = (v) => Math.max(0.01, Math.min(cap, canopyAt(v).w - inset)); return st.map((v) => [X(v), half(v)]).concat(st.slice().reverse().map((v) => [X(v), -half(v)])); };
    B.add(act(prismGeo(plan(3.03, 3.32, 0.012), 2.49, 2.52)), "paint");
    B.add(act(prismGeo(plan(3.26, 4.03, 0.03, 0.4), 2.55, 2.58)), "paint");                                 // glare shield
    B.add(act(prismGeo(plan(5.96, 6.87, 0.012), 2.5, 2.53)), "light");                                      // deck behind the seat
    B.add(act(boxGeo(0.3, 0.1, 0.24, X(6.3), 2.58, 0.12)), "dark"); B.add(act(boxGeo(0.22, 0.08, 0.16, X(6.3), 2.57, -0.16)), "grey");
    B.add(act(rodGeo(V3(X(6.72), 2.56, 0), V3(X(6.12), 2.66, 0), 0.022, 10)), "silver");                    // canopy actuator
    B.add(act(rodGeo(V3(X(6.12), 2.66, 0), V3(X(5.99), 2.68, 0), 0.012, 8)), "light");
    B.flush(g);
  });
  within((part("seat", { name: "Ejection seat", by: "Martin-Baker", desc: "A rocket-assisted seat that works from a standstill on the deck. Pulling the handle between the knees fires the canopy off, then a catapult tube drives the seat up its rails and a rocket under the bucket carries it clear; the parachute is packed in the head box.", kv: [["Type", "zero-zero, rocket assisted"], ["Model", "SJU-5/6, later the NACES SJU-17"], ["Fired by", "handle between the knees"], ["Parachute", "in the head box"]] }, [0, 1.5, 0]), "seat"), (g0) => { const g = sub(g0, PIT.dx, PIT.dy);
    const B = bulk(), lean = 0.384;
    const bx = (s0, s1, y0, y1, z0, z1, role) => B.add(boxGeo(s1 - s0, y1 - y0, Math.abs(z1 - z0), X((s0 + s1) / 2), (y0 + y1) / 2, (z0 + z1) / 2), role);
    for (const s of [-1, 1]) B.add(rodGeo(V3(X(4.74), 1.82, s * 0.15), V3(X(5.12), 2.76, s * 0.15), 0.018, 8), "grey");            // rails
    B.add(rodGeo(V3(X(4.82), 1.86, 0), V3(X(5.16), 2.7, 0), 0.035, 12), "silver");                                              // catapult tube
    bx(4.3, 4.78, 1.9, 2.0, -0.2, 0.2, "dark");                                                                                 // bucket with the survival kit in it
    for (const s of [-1, 1]) bx(4.3, 4.8, 2.0, 2.1, s * 0.2, s * 0.22, "dark");
    bx(4.32, 4.74, 2.0, 2.05, -0.19, 0.19, "grey");                                                                             // cushion
    bx(4.5, 4.56, 2.05, 2.066, -0.19, 0.19, "light");                                                                           // lap belt
    B.add(boxGeo(0.09, 0.62, 0.36).rotateZ(lean).translate(X(4.85), 2.36, 0), "dark");                                          // backrest
    B.add(boxGeo(0.03, 0.5, 0.3).rotateZ(lean).translate(X(4.795), 2.36, 0), "grey");
    for (const s of [-1, 1]) B.add(boxGeo(0.012, 0.5, 0.045).rotateZ(lean).translate(X(4.775), 2.38, s * 0.08), "light");        // shoulder straps
    B.add(boxGeo(0.2, 0.2, 0.32).rotateZ(lean).translate(X(5.02), 2.66, 0), "dark");                                            // head box
    B.add(boxGeo(0.04, 0.15, 0.2).rotateZ(lean).translate(X(4.92), 2.67, 0), "grey");
    for (const s of [-1, 1]) B.add(boxGeo(0.03, 0.04, 0.02, X(5.06), 2.8, s * 0.1), "light");                                   // canopy breakers
    B.add(torusGeo(0.05, 0.01, 18).rotateZ(Math.PI / 2).translate(X(4.34), 2.09, 0), "paint");                                  // firing handle
    bx(4.5, 4.66, 2.0, 2.1, -0.25, -0.22, "grey");
    B.add(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 10).rotateZ(Math.PI / 2).translate(X(4.56), 1.86, 0), "silver");           // under-seat rocket motor
    cable(B, [[X(4.7), 2.1, 0.21], [X(4.82), 2.0, 0.24], [X(4.95), 2.06, 0.25]], 0.012, { clip: 0.14, connector: false });
    B.flush(g);
  });

  // ---------------- avionics, wiring, hydraulics, secondary power ----------------
  within((part("systems", { name: "Avionics and systems", by: "MUX-bus architecture", desc: "Black boxes fill the bays either side of the nose-wheel well and behind the cockpit, joined by digital data buses. Aft, two airframe-mounted gearboxes each carry a generator and hydraulic pumps off its engine, with the APU between them to start either one.", kv: [["Flight controls", "quad digital fly-by-wire"], ["Hydraulics", "2 systems, 3,000 psi"], ["Electrics", "2 generators on the AMADs"], ["Starting", "APU, air turbine starters"]] }), "systems"), (g) => {
    const B = bulk();
    for (const s of [-1, 1]) {
      for (let i = 0; i < 4; i++) { B.add(boxGeo(0.16, 0.2, 0.1, X(2.24 + i * 0.19), 1.8, s * 0.34), i % 2 ? "dark" : "grey"); B.add(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 8).translate(X(2.24 + i * 0.19), 1.915, s * 0.34), "light"); }
      for (let i = 0; i < 3; i++) B.add(boxGeo(0.17, 0.26, 0.24, X(5.52 + i * 0.2), 1.6, s * 0.3), i === 1 ? "grey" : "dark");
      // harness along each side, hydraulic lines beside it
      bundle(B, [[X(1.7), 1.62, s * 0.3], [X(3.0), 1.6, s * 0.42], [X(5.6), 1.6, s * 0.5], [X(7.6), 1.42, s * 0.42], [X(10.5), 1.4, s * 0.22], [X(12.2), 1.42, s * 0.24]], 5, 0.008, 0.02, { tie: 0.3 });
      cable(B, [[X(6.3), 1.4, s * 0.3], [X(8.4), 1.32, s * 0.34], [X(11.0), 1.34, s * 0.1], [X(12.4), 1.36, s * 0.08]], 0.012, { clip: 0.5, role: "silver" });
      // airframe-mounted accessory drive: gearbox, generator, two hydraulic pumps, starter
      B.add(boxGeo(0.5, 0.3, 0.4, X(12.1), 1.32, s * 0.52), "light");
      B.add(lx([[0, X(11.58)], [0.13, X(11.58)], [0.13, X(11.85)], [0, X(11.85)]], { seg: 18 }).translate(0, 1.32, s * 0.62), "grey");
      B.add(lx([[0, X(11.63)], [0.08, X(11.63)], [0.08, X(11.85)], [0, X(11.85)]], { seg: 14 }).translate(0, 1.27, s * 0.38), "metal");
      B.add(rodGeo(V3(X(12.35), 1.32, s * 0.52), V3(X(12.6), 1.4, s * 0.52), 0.03, 8), "silver");
      B.add(lx([[0, X(11.0)], [0.1, X(11.0)], [0.1, X(11.45)], [0, X(11.45)]], { seg: 16 }).translate(0, 1.27, s * 0.74), "silver");   // hydraulic reservoir
      // stabilator and rudder actuators
      B.add(rodGeo(V3(X(14.4), 1.5, s * 0.92), V3(X(14.95), 1.74, s * 0.955), 0.025, 10), "silver");
    }
    add(g, lx([[0, X(11.5)], [0.17, X(11.5)], [0.19, X(11.7)], [0.19, X(12.25)], [0.12, X(12.5)], [0, X(12.5)]], { seg: 24 }).translate(0, 1.72, 0), "metal");   // APU
    B.add(boxGeo(0.4, 0.34, 0.5, X(6.35), 2.25, 0), "light"); B.add(lx([[0, X(6.2)], [0.08, X(6.2)], [0.08, X(6.5)], [0, X(6.5)]], { seg: 16 }).translate(0, 2.3, 0.36), "metal");   // air-cycle machine
    B.flush(g);
  });

  // ---------------- fuel ----------------
  within((part("tanks", { name: "Fuselage fuel tanks", by: "four bladder cells", desc: "Four self-sealing tanks sit in the centre fuselage between the cockpit and the engines, with the intake ducts running either side. Tanks 2 and 3 are the feed tanks, one for each engine; the wings hold the rest.", kv: [["Fuselage cells", "4"], ["Feed tanks", "2 (one per engine)"], ["Also", "integral wing tanks, 3 external tanks"]] }, [0, 1.25, 0]), "tanks"), (g) => {
    const B = bulk();
    for (const [a, b, w] of [[6.65, 7.3, 0.42], [7.4, 8.8, 0.4], [8.9, 10.3, 0.4], [10.4, 11.4, 0.3]]) {
      add(g, boxGeo(b - a, 0.7, w * 2, X((a + b) / 2), 1.95, 0), "light", { map: T.tank });
      B.add(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 14).translate(X(a + 0.25), 2.32, 0.18), "grey");
      B.add(new THREE.CylinderGeometry(0.035, 0.035, 0.06, 10).translate(X(b - 0.2), 2.33, -0.16), "dark");
    }
    for (const s of [-1, 1]) duct(B, [[X(6.9), 2.35, s * 0.24], [X(8.0), 2.36, s * 0.26], [X(10.0), 2.36, s * 0.26], [X(11.2), 2.35, s * 0.2]], 0.022, { role: "silver", clamps: [0.2, 0.4, 0.6, 0.8], bolts: 6 });
    B.flush(g);
  });
  within((part("ducts", { name: "Intake ducts", by: "fixed-geometry inlets", desc: "Two plain D-shaped inlets under the wing roots, with no moving ramps. Each duct curves inboard and upward past the fuel tanks to the face of its engine, which hides the fan from radar looking in.", kv: [["Type", "fixed, splitter plate"], ["Engine airflow", "142 lb/s each"], ["Run", "about 5.5 m"]] }), "ducts"), (g) => {
    for (const s of [-1, 1]) add(g, tubeGeo([[X(8.9), 1.6, s * 0.9], [X(9.8), 1.62, s * 0.88], [X(11.0), 1.7, s * 0.74], [X(12.0), 1.77, s * 0.56], [X(12.7), 1.79, s * 0.5]], 0.27, { seg: 48, radial: 24 }), "metal", { side: DS, map: stripesTex(1, 0, 1, 256, 256, (P) => { for (let i = 1; i < 14; i++) P.hline(i / 14, 0.4, 2); }) });
  });

  // ---------------- upper skins ----------------
  within((part("fwdTop", { name: "Forward fuselage, upper", by: "McDonnell Douglas", desc: "The upper skin of the nose and cockpit section, cut out for the cockpit and carrying the fixed windscreen. Ahead of it are the gun port and gas vents; the in-flight refuelling probe door is on the starboard side.", kv: [["Windscreen", "fixed, one piece"], ["Gun port", "centreline, ahead of the windscreen"], ["Refuelling", "retractable probe, starboard"]] }, [0, 2.0, 0]), "fwdTop"), (g) => {
    shell(g, 1.5, CAN0, TOP);
    canopyCut(g, CAN0, 5.9, dress);                                                                 // the skin either side of the canopy opening
    addGlass(g, canopyGeo(CAN0, BOW, 24));                                                          // fixed windscreen
    add(g, canopyArch(BOW - 0.014, 0.018), "light");                                                // windscreen bow
    for (const s of [-1, 1]) add(g, canopyRim(CAN0 + 0.015, BOW, s, 0.013), "light");
    const B = bulk();
    B.add(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 14).translate(X(1.75), fusAt(1.75).c + fusAt(1.75).hu - 0.006, 0), "dark");
    B.flush(g);
  });
  within((part("canopy", { name: "Canopy", by: "clamshell, hinged aft", desc: "A one-piece clamshell from the windscreen bow back to the spine, hinged at its aft end. It closes onto a rim that follows the opening in the fuselage, so glass, frame and sill share one outline. Three mirrors sit on its front bow.", kv: [["Type", "clamshell, opens upward and aft"], ["Length", "2.7 m, bow to hinge"], ["Opens", "about 36° (drawn)"], ["Mirrors", "3, on the bow"]] }, [0, 3.2, 0]), "canopy"), (g) => {
    const hx = X(CAN1), hy = rimAt(CAN1).y;
    const pivot = new THREE.Group(); pivot.position.set(hx, hy, 0); g.add(pivot); LIVE.canopy = pivot;
    const inP = (geo) => geo.translate(-hx, -hy, 0);
    addGlass(pivot, inP(canopyGeo(BOW, CAN1, 48)));
    add(pivot, inP(canopyArch(BOW + 0.024, 0.018)), "light"); add(pivot, inP(canopyArch(CAN1 - 0.03, 0.022)), "light");   // front bow and aft frame
    for (const s of [-1, 1]) add(pivot, inP(canopyRim(BOW + 0.01, CAN1 - 0.02, s, 0.016)), "light");                    // side rails on the rim
    const B = bulk(), at = (w, h, d, x, y, z, role) => B.add(boxGeo(w, h, d, x - hx, y - hy, z), role);
    for (const th of [Math.PI / 2, 1.05, Math.PI - 1.05]) { const q = canopyPt(BOW + 0.07, th, 0.93); at(0.012, 0.04, 0.08, q.x, q.y, q.z, "grey"); }   // mirrors
    for (const s of [-1, 1]) { const R = rimAt(CAN1 - 0.06); at(0.1, 0.05, 0.04, X(CAN1 - 0.06), R.y + 0.02, s * (R.w - 0.05), "grey"); }                // hinge lugs
    for (const st of [4.7, 5.3, 5.9]) for (const s of [-1, 1]) { const R = rimAt(st); at(0.06, 0.03, 0.03, X(st), R.y - 0.012, s * (R.w - 0.03), "dark"); }   // latch hooks
    B.flush(pivot);
  });
  const HUMP = [[5.8, 0], [6.4, 0.2], [7, 0.3], [8, 0.36], [9, 0.39], [10, 0.35], [11, 0.265], [11.7, 0.16], [12.6, 0]];   // height of the spine over the upper deck
  const humpAt = (st) => { if (st <= HUMP[0][0] || st >= HUMP[HUMP.length - 1][0]) return 0; let i = 1; while (HUMP[i][0] < st) i++; return lerp(HUMP[i - 1][1], HUMP[i][1], (st - HUMP[i - 1][0]) / (HUMP[i][0] - HUMP[i - 1][0])); };
  const spineAt = (st) => { const F = fusAt(st); return { w: lerp(0.2, 0.34, smooth(5.8, 7, st)) * (1 - 0.45 * smooth(9, 12.6, st)), hu: 0.06 + humpAt(st), hl: 0.12, c: F.c + F.hu - 0.06, n: 2.3 }; };
  within((part("ctrTop", { name: "Centre fuselage, upper", by: "Northrop", desc: "The dorsal skin over the fuel tanks, with the spine fairing that runs aft from the canopy and the speed brake between the fins.", kv: [["Speed brake", "dorsal, between the fins"], ["Under it", "fuel cells 1 to 4"]] }, [0, 2.3, 0]), "ctrTop"), (g) => {
    canopyCut(g, 5.9, CAN1, dress); shell(g, CAN1, 11.6, TOP);
    add(g, projUV(loft(spineAt, CAN1 - 0.02, 12.6, { t0: 0, t1: Math.PI, nt: 24, nx: 40 }), "top"), "white", skinT);
    add(g, bulkhead(spineAt, CAN1 - 0.02, 0, Math.PI, 24), "white", { side: DS });
    const B = bulk();
    // swept blade antenna on the spine: side profile [x, height], 12 mm thick
    B.add(prismGeo([[X(9.65), 0], [X(9.87), 0], [X(9.89), 0.13], [X(9.8), 0.13]], -0.006, 0.006).rotateX(-Math.PI / 2).translate(0, spineAt(9.77).c + spineAt(9.77).hu - 0.012, 0), "light");
    B.flush(g);
  });
  within((part("aftTop", { name: "Aft fuselage, upper", by: "Northrop", desc: "The engine bay cover between the fins. The engines themselves come out downward and aft through doors in the underside; here the cover lifts so the bays can be seen from above.", kv: [["Engine change", "about 20 minutes with 4 people"], ["Carries", "speed brake, fin roots"]] }, [0, 2.3, 0]), "aftTop"), (g) => {
    shell(g, 11.6, 15.85, TOP);
    add(g, boxGeo(1.5, 0.03, 0.6, X(13.4), fusAt(13.4).c + fusAt(13.4).hu + 0.004, 0), "light");
  });

  // ---------------- wings ----------------
  const LE = (z) => 8.72 + 0.5 * (z - 1.37), TE = (z) => 12.72 - 0.045 * (z - 1.4), HL = (z) => TE(z) - lerp(0.85, 0.55, clamp((z - 1.15) / 4.45, 0, 1));   // leading edge swept 26.6 degrees
  for (const s of [1, -1]) {
    const tag = s > 0 ? "S" : "P", side = s > 0 ? "Starboard" : "Port";
    within((part("wing" + tag, { name: side + " wing", by: "McDonnell Douglas", desc: "A thin, moderately swept wing with full-span leading-edge flaps and a long extension running forward to the cockpit. That extension sheds a vortex over the wing that keeps the aircraft controllable beyond 50° angle of attack. The outer panel folds 90° upward at the hinge for parking on deck.", kv: [["Span", "11.43 m · 37 ft 6 in"], ["Wing area", "37.2 m² · 400 sq ft"], ["Folded span", "8.38 m"], ["Controls", "LE flaps, TE flaps, ailerons"]] }, [0, 0.25, s * 2.6]), "wing" + tag), (g0) => { const g = dihedral(g0, s);
      const FZ = 4.07, TIP = 5.6, RZ = 1.37, YW = 2.38;                                   // fold line, tip and root (metres out), height of the chord plane
      const tc = (z) => lerp(0.05, 0.035, clamp((z - RZ) / (TIP - RZ), 0, 1));            // a thin symmetric aerofoil: 5% thick at the root, 3.5% at the tip
      const W = { le: LE, te: TE, y: YW, tc, s }, slat = (z) => LE(z) + 0.47, foil = (parent, o, role) => add(parent, projUV(foilGeo({ ...W, ...o }), "top"), role, skinT);
      add(g, projUV(lexGeo(s).translate(-X(8.72), -2.39, 0).rotateZ(2.2 * DEG).translate(X(8.72), 2.39, 0), "top"), "white", skinT);   // leading-edge extension
      foil(g, { z0: 1.0, z1: RZ, nz: 2, b: HL }, "white");                                 // wing root, inside the fuselage
      foil(g, { z0: RZ, z1: FZ, a: slat, b: HL }, "white");                                // wing box
      foil(g, { z0: RZ, z1: FZ, b: slat }, "light");                                       // leading-edge flap
      foil(g, { z0: 1.0, z1: FZ, a: HL }, "light");                                        // trailing-edge flap
      const B = bulk();
      B.add(lx([[0.01, X(10.25)], [0.06, X(10.45), 1], [0.06, X(11.7), 1], [0.01, X(12.0)]], { seg: 14 }).translate(0, 2.45, s * FZ), "grey");   // fold hinge fairing
      for (const z of [2.1, 3.2]) B.add(boxGeo(0.8, 0.06, 0.07, X(HL(z) + 0.3), 2.33, s * z), "grey");
      for (const z of PYLON_Z) pylonGeo(B, LE(z) + 0.35, z, s, 2.34);                                                                       // wing pylons
      B.flush(g);
      const fold = new THREE.Group(); fold.position.set(0, 2.38, s * FZ); g.add(fold);
      LIVE.fold.push({ g: fold, s });
      const Q = (o, role) => add(fold, projUV(foilGeo({ ...W, z0: FZ, z1: TIP, nz: 5, ...o }), "top").translate(0, -YW, -s * FZ), role, skinT);
      Q({ a: slat, b: HL }, "white"); Q({ b: slat }, "light"); Q({ a: HL }, "light");          // outer panel, its leading-edge flap and the aileron
      add(fold, boxGeo(2.3, 0.1, 0.14, X(11.6), 0, s * (TIP + 0.06 - FZ)), "grey");
      // AIM-9 on the wingtip rail
      const M = bulk(), mz = s * (TIP + 0.185 - FZ), my = -0.02, MX = -0.5;
      add(fold, lx([[0.008, X(9.55)], [0.045, X(9.64), 1], [0.0635, X(9.78), 1], [0.0635, X(12.38)], [0.05, X(12.42)]], { seg: 20 }).translate(MX, my, mz), "white");
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * TAU + Math.PI / 4, c = Math.cos(a), sn = Math.sin(a);
        const fin = (x0, x1, span, sweep) => { const geo = prismGeo([[X(x0), 0.0635], [X(x0 + sweep), 0.0635 + span], [X(x1), 0.0635 + span], [X(x1), 0.0635]], -0.006, 0.006); geo.rotateX(Math.PI / 2 - a); return geo.translate(MX, my, mz); };
        M.add(fin(9.92, 10.12, 0.14, 0.14), "light"); M.add(fin(11.9, 12.38, 0.2, 0.3), "light");
      }
      M.flush(fold);
    });
    within((part("fin" + tag, { name: side + " fin and rudder", by: "Northrop", desc: "Twin fins canted 20° outboard and set well forward, so they stay in clean air when the fuselage blanks the tail at high angle of attack. Both rudders toe in together on take-off to help lift the nose.", kv: [["Cant", "20° outboard"], ["Rudder", "one each fin"], ["Carries", "fuel vent, ECM and position lights"]] }, [0, 2.7, s * 1.5]), "fin" + tag), (g) => {
      const BY = 2.1, c20 = Math.cos(20 * DEG), HT = (4.53 - BY) / c20, HR = (3.815 - BY) / c20;   // root height; fin and rudder heights measured up the canted fin
      const place = (geo) => geo.rotateX(-Math.PI / 2).rotateX(s * 20 * DEG).translate(0, BY, s * 0.9);
      const fle = (h) => 11.5 + ((13.82 - 11.5) * h) / HT, fhl = (h) => 14.1 + (0.38 * h) / HR, fte = (h) => (h <= HR ? 14.59 + (0.24 * h) / HR : 14.83 + (0.11 * (h - HR)) / (HT - HR));
      const Fn = { le: fle, te: fte, y: 0, tc: 0.045, s: 1 }, fin = (o, role) => add(g, projUV(place(foilGeo({ ...Fn, ...o })), "side"), role, role === "gold" ? { side: DS } : skinS);
      fin({ z0: 0, z1: HR, nz: 6, b: fhl }, "white"); fin({ z0: HR, z1: HT, nz: 3, tip: 0.1, bias: 0.3 }, "white");
      fin({ z0: 0, z1: HR, nz: 6, a: fhl }, "light");                                       // rudder
      const h0 = (2.95 - BY) / c20, h1 = (3.75 - BY) / c20, sa = (h) => 13.6 + ((h - h0) / (h1 - h0)) * 0.37;
      fin({ z0: h0, z1: h1, nz: 3, a: sa, b: (h) => sa(h) + 0.08, lift: 0.004 }, "gold");     // formation strip light, slanted as drawn
      const B = bulk();
      for (const [st, h, r, l] of [[14.5, 2.455, 0.045, 0.5], [14.25, 2.185, 0.035, 0.36]]) B.add(lx([[0.005, X(st)], [r, X(st + 0.06), 1], [r, X(st + l - 0.08), 1], [0.006, X(st + l)]], { seg: 12 }).rotateX(0).translate(0, BY + h * c20, s * (0.9 + h * Math.sin(20 * DEG))), "grey");
      B.flush(g);
    });
    within((part("stab" + tag, { name: side + " stabilator", by: "all-moving", desc: "Each tailplane is one slab turning on a single spindle. Together they pitch the aircraft; moved differentially they roll it, backing up the ailerons.", kv: [["Span, both", "6.58 m"], ["Movement", "all-moving, differential"], ["Skin", "graphite-epoxy"]] }, [0, 0, s * 1.5]), "stab" + tag), (g) => {
      add(g, projUV(foilGeo({ le: (z) => 13.7 + ((16.05 - 13.7) * (z - 1)) / 2.25, te: (z) => 16.15 + ((16.98 - 16.15) * (z - 1)) / 2.25, y: 1.77, tc: 0.04, s, z0: 1.0, z1: 3.25, nz: 8, tip: 0.24, bias: 0.25 }), "top"), "white", skinT);
      add(g, rodGeo(V3(X(15.0), 1.77, s * 0.99), V3(X(15.0), 1.77, s * 1.3), 0.034, 12), "silver");
    });
    buildStores(s, tag, side, LE);
    // ---------------- engine, as installed ----------------
    within((part("eng" + tag, { name: side + " F404-GE-400", by: "General Electric", desc: "One of the two afterburning turbofans. It is 3.9 m long and weighs about a tonne; the fan, compressor, combustor, turbines, afterburner and nozzle are separate modules that can be changed one at a time. The detailed drawing in the index takes one apart.", kv: [["Thrust", "10,600 lbf dry · 16,000 lbf afterburning"], ["Nozzle", "12 outer flaps over 12 primary and 12 divergent flaps, each gap sealed"], ["Length", "3.91 m · 154 in"], ["Diameter", "0.89 m · 35 in"], ["Bypass ratio", "0.34"]] }, [-5.4, 0, s * 0.35]), "eng" + tag), (g0) => { const g = sub(g0, 0.53, -0.09, -s * 0.02);
      const o = V3(0, 1.9, s * 0.52), B = bulk(), at = (st, r, a) => V3(X(st), o.y + r * Math.cos(a), o.z + r * Math.sin(a));
      add(g, lx([[0.3, X(13.16)], [0.36, X(13.18)], [0.445, X(13.3)], [0.445, X(13.9)], [0.39, X(14.0)], [0.4, X(14.9)], [0.43, X(15.0)], [0.44, X(15.72)], [0.44, X(16.28)]], { seg: 48 }).translate(0, o.y, o.z), "metal", { side: DS });
      add(g, lx([[0, X(13.2)], [0.1, X(13.2)], [0.0, X(13.05)]], { seg: 20 }).translate(0, o.y, o.z), "light");
      for (const st of [13.3, 13.92, 14.44, 15.0, 15.74]) flange(B, V3(X(st), o.y, o.z), V3(1, 0, 0), 0.4, 0.475, 0.03, 30);
      B.add(boxGeo(0.62, 0.1, 0.34, X(13.75), o.y - 0.465, o.z), "light");
      for (const [st, r, dz] of [[13.55, 0.05, -0.1], [13.9, 0.045, 0.1]]) B.add(lx([[0, X(st)], [r, X(st)], [r, X(st + 0.22)], [0, X(st + 0.22)]], { seg: 12 }).translate(0, o.y - 0.46, o.z + dz), "grey");
      B.add(torusGeo(0.47, 0.014, 40).rotateZ(Math.PI / 2).translate(X(14.5), o.y, o.z), "silver");
      for (const a of [0.5, 2.4]) cable(B, [at(13.4, 0.47, a), at(14.3, 0.45, a + 0.2), at(15.15, 0.455, a)], 0.011, { clip: 0.3 });
      duct(B, [at(13.8, 0.5, -1.6 * s), at(14.4, 0.47, -1.2 * s), at(15.0, 0.47, -1.2 * s)], 0.022, { role: "silver", bolts: 6, clamps: [0.5] });
      B.flush(g);
      buildNozzle(g, o, s);                                             // tailpipe, afterburner and the variable exhaust nozzle
      const fxp = { r0: 0.42, rmax: 2.4, freq: 1.1, flow: 30, hot: 5.5, attack: 0.3, decay: 0.6 };
      const burner = makeFX("AB", 0, { ...fxp, len: 11, spread: 0.9, pow: 1.1, dens: 3.0, diam: 1.8, fade: 0.36, coolK: 0.55, hot: 2.2, freq: 1.5, soot: 0.7 });
      const dry = makeFX("DRY", 0, { ...fxp, len: 6.5, spread: 0.55, pow: 1.1, dens: 1.2, diam: 1.2, fade: 0.3, coolK: 0.6, hot: 2.4, freq: 1.5 });
      for (const fx of [burner, dry]) { fx.position.set(X(NOZ.exit), o.y, o.z); fx.rotation.z = -Math.PI / 2; g.add(fx); }
      LIVE.fx.push({ burner, dry, r0: 0.42 });
    });
  }
  buildExtras();
}
