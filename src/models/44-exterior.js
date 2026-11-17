// ============================================================================
// 44 · CANOPY, STORES AND EXTERIOR FITTINGS — everything here is placed from the
// McDonnell Douglas F/A-18A three-view: stations in metres aft of the nose tip,
// heights above the deck, half-widths out from the centreline.
// ============================================================================

// ---------------- canopy ----------------
// One table drives the glass, its frame and the opening cut in the fuselage, so they cannot disagree:
// [station, half-width of the opening, height of the crown]. Windscreen 3.0 to the bow at 4.2, clamshell 4.2 to 6.9.
const CANOPY = [[3.0, 0, 2.5], [3.15, 0.17, 2.62], [3.3, 0.25, 2.71], [3.6, 0.34, 2.86], [3.9, 0.4, 2.97], [4.2, 0.43, 3.05], [4.6, 0.45, 3.17], [5.0, 0.46, 3.23], [5.5, 0.455, 3.215], [6.0, 0.42, 3.15], [6.5, 0.375, 3.07], [6.9, 0.34, 3.0]];
const CAN0 = 3.0, CAN1 = 6.9, BOW = 4.2, CAN_K = 2.3;
function canopyAt(st) {
  const P = CANOPY, n = P.length; st = clamp(st, P[0][0], P[n - 1][0]);
  let i = 1; while (i < n - 1 && P[i][0] < st) i++;
  const a = P[i - 1], b = P[i], h = b[0] - a[0], t = (st - a[0]) / h, t2 = t * t, t3 = t2 * t;
  const slope = (k, j) => { const p = P[Math.max(0, j - 1)], q = P[Math.min(n - 1, j + 1)]; return (q[k] - p[k]) / (q[0] - p[0]); };
  const herm = (k) => (2 * t3 - 3 * t2 + 1) * a[k] + (t3 - 2 * t2 + t) * slope(k, i - 1) * h + (-2 * t3 + 3 * t2) * b[k] + (t3 - t2) * slope(k, i) * h;
  return { w: Math.max(0, herm(1)), top: herm(2) };
}
// The rim: where the opening's edge lies on the fuselage skin at this station.
function rimAt(st) {
  const C0 = canopyAt(st), S = fusAt(st), n = S.nu ?? S.n, w = Math.min(C0.w, S.w * 0.98);
  const y = S.c + S.hu * Math.pow(Math.max(0, 1 - Math.pow(w / S.w, n)), 1 / n);
  return { w, y, top: Math.max(C0.top, y + 0.002), t: Math.acos(Math.pow(w / S.w, n / 2)) };
}
function canopyPt(st, th, scale = 1) {
  const R = rimAt(st), cs = Math.cos(th), sn = Math.sin(th), e = 2 / CAN_K;
  return V3(X(st), R.y + (R.top - R.y) * scale * Math.pow(Math.abs(sn), e), R.w * scale * Math.sign(cs) * Math.pow(Math.abs(cs), e));
}
function canopyGeo(st0, st1, nx = 40, nt = 30) {
  const pos = [], idx = [];
  for (let i = 0; i <= nx; i++) { const st = st0 + ((st1 - st0) * i) / nx; for (let j = 0; j <= nt; j++) { const p = canopyPt(st, (Math.PI * j) / nt); pos.push(p.x, p.y, p.z); } }
  for (let i = 0; i < nx; i++) for (let j = 0; j < nt; j++) { const a = i * (nt + 1) + j, b = a + nt + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// A frame hoop across the canopy at one station, and the rail along one side of the rim.
function canopyArch(st, r = 0.016) { const pts = []; for (let j = 0; j <= 32; j++) pts.push(canopyPt(st, (Math.PI * j) / 32)); return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 72, r, 8, false); }
function canopyRim(st0, st1, s, r = 0.014) { const pts = []; for (let k = 0; k <= 36; k++) { const st = st0 + ((st1 - st0) * k) / 36, R = rimAt(st); pts.push(V3(X(st), R.y + 0.004, s * R.w)); } return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 96, r, 8, false); }
// The upper fuselage skin either side of the canopy opening.
function canopyCut(g, a, b, dress) {
  const nx = Math.ceil((b - a) / 0.05), tS = (st) => rimAt(st).t, Q = Math.PI / 4;
  dress(g, loft(fusAt, a, b, { t0: 0, t1: Q, nt: 8, nx }), "side"); dress(g, loft(fusAt, a, b, { t0: Q, t1: tS, nt: 12, nx }), "top");
  dress(g, loft(fusAt, a, b, { t0: (st) => Math.PI - tS(st), t1: Math.PI - Q, nt: 12, nx }), "top"); dress(g, loft(fusAt, a, b, { t0: Math.PI - Q, t1: Math.PI, nt: 8, nx }), "side");
}
// A patch lying on the fuselage skin (door, vent, light strip): the skin's own shape, lifted a few millimetres.
function skinPatch(g, st0, st1, t0, t1, role, lift = 0.006) {
  const sec = (st) => { const S = fusAt(st); return { ...S, w: S.w + lift, hu: S.hu + lift, hl: S.hl + lift }; };
  return add(g, loft(sec, st0, st1, { t0, t1, nt: Math.max(4, Math.ceil(Math.abs(t1 - t0) / 0.02)), nx: Math.max(4, Math.ceil((st1 - st0) / 0.025)) }), role, { side: DS });
}
// A strip lying on the fuselage side between two heights (for things the drawing places by height, like the formation lights).
function skinBand(g, st0, st1, h0, h1, s, role, lift = 0.004) {
  const rows = [];
  for (let i = 0; i <= 12; i++) {
    const st = st0 + ((st1 - st0) * i) / 12, S = fusAt(st), row = [];
    for (const y of [h0, (h0 + h1) / 2, h1]) { const up = y >= S.c, n = up ? S.nu ?? S.n : S.n, k = Math.abs(y - S.c) / (up ? S.hu : S.hl); row.push(V3(X(st), y, s * (S.w * Math.pow(Math.max(0, 1 - Math.pow(k, n)), 1 / n) + lift))); }
    rows.push(row);
  }
  return add(g, gridGeo(rows), role, { side: DS });
}
// A blade antenna: side profile [station, height] from its foot, 12 mm thick, standing up (dir 1) or hanging down (dir -1).
function bladeGeo(a, b, a2, b2, h, y, z = 0, dir = 1) {
  return prismGeo([[X(a), 0], [X(b), 0], [X(b2), h], [X(a2), h]], -0.006, 0.006).rotateX((-dir * Math.PI) / 2).translate(0, y, z);
}

// ---------------- stores ----------------
// Wing pylons at two stations a side (front view: 2.33 m and 3.47 m out), fuselage Sparrow stations, wingtip rails.
const PYLON_Z = [2.33, 3.47];
// What the drawing's side panels allow, in its own words. `on` lists the pylons used: 0 inboard, 1 outboard.
const LOADS = [
  { key: "aim9", label: "dual AIM-9", note: "Dual AIM-9 launcher (outboard pylon only)", on: [1] },
  { key: "aim7", label: "AIM-7F Sparrow", note: "AIM-7F Sparrow (outboard pylon only)", on: [1] },
  { key: "agm78", label: "AGM-78 Standard ARM", note: "AGM-78 Standard ARM (four wing stations)", on: [0, 1] },
  { key: "agm65", label: "AGM-65 Maverick", note: "AGM-65 Maverick (four wing stations)", on: [0, 1] },
  { key: "agm84", label: "AGM-84 Harpoon", note: "AGM-84 Harpoon (outboard pylons only)", on: [1] },
  { key: "none", label: "pylons empty", note: "Pylons empty, as in the front view", on: [] },
];
// Bodies to published sizes: length, radius, nose length; fins as [start, end (m aft of the nose), span beyond the body, leading-edge sweep].
const STORE = {
  aim9: { len: 2.87, r: 0.0635, nose: 0.12, dome: true, fins: [[0.42, 0.72, 0.125, 0.22], [2.25, 2.85, 0.25, 0.33]], bands: [0.3, 1.1] },
  aim7: { len: 3.66, r: 0.1015, nose: 0.62, fins: [[1.5, 2.15, 0.41, 0.5], [3.2, 3.62, 0.3, 0.26]], bands: [0.7, 1.35, 2.3] },
  agm78: { len: 4.57, r: 0.1715, nose: 0.8, fins: [[1.4, 3.7, 0.11, 0.5], [3.95, 4.5, 0.37, 0.33]], bands: [0.9, 3.8] },
  agm65: { len: 2.49, r: 0.1525, nose: 0.2, dome: true, fins: [[0.95, 2.3, 0.21, 1.1], [2.32, 2.46, 0.2, 0.05]], bands: [0.28, 0.8] },
  agm84: { len: 3.85, r: 0.1715, nose: 0.5, fins: [[1.55, 2.1, 0.285, 0.3], [3.4, 3.78, 0.285, 0.22]], bands: [0.6, 1.45, 2.5] },
};
// One missile with its nose at (x, y, z), pointing forward.
function storeGeo(B, T, x, y, z, roll = Math.PI / 4) {
  const prof = T.dome ? [[0, 0], [T.r * 0.6, -T.nose * 0.22, 1], [T.r * 0.92, -T.nose * 0.6, 1], [T.r, -T.nose, 1]] : [[0, 0], [T.r * 0.4, -T.nose * 0.3, 1], [T.r * 0.74, -T.nose * 0.62, 1], [T.r, -T.nose, 1]];
  prof.push([T.r, -T.len + 0.04], [T.r * 0.82, -T.len], [0, -T.len]);
  B.add(lx(prof, { seg: 22 }).translate(x, y, z), "white");
  for (const d of T.bands) B.add(lx([[T.r, -d], [T.r + 0.003, -d], [T.r + 0.003, -d - 0.03], [T.r, -d - 0.03], [T.r, -d]], { seg: 22 }).translate(x, y, z), "grey");
  for (const [a, b, span, sweep] of T.fins) for (let k = 0; k < 4; k++) {
    const geo = prismGeo([[-a, T.r * 0.9], [-a - sweep, T.r + span], [-b, T.r + span], [-b, T.r * 0.9]], -0.007, 0.007);
    B.add(geo.rotateX(Math.PI / 2 - roll - (k / 4) * TAU).translate(x, y, z), "light");
  }
}
// A wing pylon whose top edge runs from station a along the underside of the wing at height yTop.
function pylonGeo(B, a, z, s, yTop, depth = 0.36, len = 2.35) {
  B.add(prismGeo([[X(a), 0], [X(a + 0.42), -depth], [X(a + len - 0.4), -depth], [X(a + len), -depth * 0.35], [X(a + len), 0]], -0.045, 0.045).rotateX(-Math.PI / 2).translate(0, yTop, s * z), "light");
  B.add(boxGeo(1.0, 0.05, 0.11, X(a + len / 2), yTop - depth - 0.025, s * z), "grey");                               // ejector rack
  for (const d of [-0.36, 0.36]) for (const sg of [-1, 1]) B.add(boxGeo(0.05, 0.05, 0.03, X(a + len / 2 + d), yTop - depth - 0.06, s * z + sg * 0.07), "dark");   // sway braces
  for (const d of [0.5, 1.0, 1.5]) B.add(new THREE.CylinderGeometry(0.012, 0.012, 0.094, 8).rotateX(Math.PI / 2).translate(X(a + d), yTop - 0.1, s * z), "dark");  // attachment bolts
}
function buildStores(s, tag, side, LE) {
  // wing stores hang from the pylons in the wing's own drooped frame
  within((part("stores" + tag, { name: side + " wing stores", by: "from the drawing's side panels", desc: "The loads the drawing shows for the wing pylons. The Stores switch (key L) steps through them, and each goes only where the drawing puts it: the dual AIM-9 launcher, the Sparrow and the Harpoon on the outboard pylon only, the Standard ARM and the Maverick on all four wing stations.", kv: [["Wing pylons", "2 a side, 2.33 m and 3.47 m out"], ["Dual AIM-9 launcher", "outboard pylon only"], ["AIM-7F Sparrow", "outboard pylon only"], ["AGM-78 Standard ARM", "four wing stations"], ["AGM-65 Maverick", "four wing stations"], ["AGM-84 Harpoon", "outboard pylons only"], ["Stations in all", "9: 2 wingtip, 4 wing, 2 fuselage, 1 centreline"]] }, [0, -0.3, s * 2.6]), "stores" + tag), (g0) => {
    const g = dihedral(g0, s), groups = [];
    for (const L of LOADS) {
      const grp = new THREE.Group(); g.add(grp); groups.push(grp);
      const B = bulk();
      for (const i of L.on) {
        const z = PYLON_Z[i], a = LE(z) + 0.35, mid = a + 1.175, yb = 2.325 - 0.36 - 0.05;
        if (L.key === "aim9") {
          B.add(boxGeo(0.5, 0.09, 0.6, X(mid), yb - 0.045, s * z), "grey");                                          // adapter beam
          for (const d of [-0.26, 0.26]) {
            B.add(boxGeo(2.0, 0.06, 0.055, X(mid + 0.1), yb - 0.12, s * z + d), "light");                            // launch rail
            storeGeo(B, STORE.aim9, X(mid + 0.1 - 1.35), yb - 0.15 - STORE.aim9.r - 0.008, s * z + d);
          }
        } else {
          const T = STORE[L.key];
          for (const d of [-0.3, 0.3]) B.add(boxGeo(0.06, 0.03, T.r * 1.2, X(mid + d), yb - 0.008, s * z), "dark");   // lugs
          storeGeo(B, T, X(mid - T.len * 0.47), yb - T.r - 0.02, s * z);
        }
      }
      B.flush(grp);
    }
    LIVE.loads.push(groups);
  });
  // AIM-7F on the fuselage station, tucked under the corner of the intake trunk
  within((part("aim7" + tag, { name: side + " AIM-7F Sparrow", by: "fuselage station", desc: "A semi-active radar missile carried half-sunk against the lower corner of the fuselage beside the main gear, where it adds almost no drag. The radar in the nose lights the target and the missile homes on the reflection.", kv: [["Carried", "fuselage corner station, one a side"], ["Length", "3.66 m"], ["Diameter", "203 mm"], ["Wing span", "1.02 m"]] }, [0, -0.45, s * 0.7]), "aim7" + tag), (g) => {
    const B = bulk(), T = STORE.aim7;
    storeGeo(B, T, X(8.6), 1.05, s * 0.92);
    for (const st of [9.7, 11.1]) B.add(boxGeo(0.12, 0.05, 0.1, X(st), 1.165, s * 0.92), "dark");                     // ejector feet against the belly
    B.flush(g);
  });
}

// ---------------- fittings the drawing labels ----------------
function buildExtras() {
  within((part("extras", { name: "Probes, antennas and lights", by: "as labelled on the drawing", desc: "The small things on the outside, each where the drawing puts it: the refuelling probe on the starboard side of the nose, lying in its bay under two doors, pitot tubes under the nose, the gun bay's gas vents, blade antennas above and below, formation strip lights, the ECM fairings beside the intakes, the chaff and flare dispensers under them and the boarding ladder under the port wing extension.", kv: [["Refuelling probe", "starboard, stows in a bay under two doors · key P"], ["Boarding ladder", "port side, drops when the canopy opens"], ["Pitot tubes", "2, under the nose"], ["Antennas", "UHF/IFF/data link above, UHF/data link and TACAN below"], ["Gun gas vents", "louvres, both sides of the lower nose"], ["Formation strip lights", "nose, fuselage and fins"], ["ECM fairings", "beside each intake"], ["Chaff/flare dispensers", "under each intake"]] }), "extras"), (g) => {
    const B = bulk();
    const belly = (st, z = 0) => { const S = fusAt(st); return S.c - S.hl * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(z) / S.w, S.n)), 1 / S.n); };
    const crown = (st) => { const S = fusAt(st); return S.c + S.hu; };
    for (const s of [-1, 1]) {
      const T = (t) => (s > 0 ? t : Math.PI - t);                    // the same angle on the port side
      const span = (a, b) => (s > 0 ? [a, b] : [Math.PI - b, Math.PI - a]);
      // pitot tube: a stand-off and a tube pointing forward
      const [py, pz] = sectionPt(fusAt(2.6), T(-0.42)), root = V3(X(2.6), py, pz), foot = V3(X(2.6), py - 0.09, pz + s * 0.07);
      B.add(rodGeo(root, foot, 0.013, 8), "grey"); B.add(rodGeo(foot, V3(X(2.34), foot.y, foot.z), 0.011, 8, 0.005), "silver");
      // gun bay gas vents: three louvred openings low on the nose
      for (let i = 0; i < 3; i++) { const a = 3.07 + i * 0.19; skinPatch(g, a, a + 0.16, ...span(-0.68, -0.52), "dark"); for (let k = 0; k < 3; k++) skinPatch(g, a + 0.025 + k * 0.045, a + 0.04 + k * 0.045, ...span(-0.68, -0.52), "light", 0.007); }
      // formation strip lights: forward fuselage and aft fuselage
      within("fwdTop", (gt) => skinBand(gt, 1.83, 2.68, 1.937, 2.022, s, "gold")); within("aftTop", (gt) => skinBand(gt, 12.76, 13.6, 1.775, 1.83, s, "gold"));
      // ECM fairing on the outside of each intake, chaff and flare dispenser under it
      B.add(lx([[0, 0.22], [0.045, 0.1, 1], [0.05, -0.1, 1], [0, -0.26]], { seg: 14 }).translate(X(8.5), 1.62, s * 1.29), "grey");
      B.add(boxGeo(0.3, 0.02, 0.16, X(9.0), belly(9.0, 0.62) - 0.006, s * 0.62), "dark");
      for (let i = 0; i < 6; i++) B.add(boxGeo(0.03, 0.006, 0.03, X(8.9 + (i % 3) * 0.1), belly(9.0, 0.62) - 0.018, s * (0.58 + Math.floor(i / 3) * 0.08)), "light");
    }
    // antennas: UHF/IFF/data link above (the tall blade is on the spine already), UHF/data link and TACAN below
    within("ctrTop", (gt) => add(gt, bladeGeo(8.62, 8.8, 8.72, 8.82, 0.07, crown(8.7) + 0.36, 0), "light"));
    B.add(bladeGeo(3.55, 3.85, 3.72, 3.87, 0.16, belly(3.7) + 0.01, 0, -1), "light");
    B.add(bladeGeo(6.15, 6.4, 6.28, 6.42, 0.13, belly(6.3) + 0.01, 0, -1), "light");
    // centreline pylon: the ninth station
    B.add(prismGeo([[X(9.6), 0], [X(9.85), -0.16], [X(11.2), -0.16], [X(11.5), -0.05], [X(11.5), 0]], -0.05, 0.05).rotateX(-Math.PI / 2).translate(0, belly(10.5) + 0.02, 0), "light");
    B.flush(g);
    // Refuelling probe, starboard side of the nose. Stowed, it lies in a bay just under the skin with two doors closed over it;
    // the doors swing open on their outer edges and the probe swings out about its aft end. It is never hidden: when it is
    // stowed the doors show where it is, and with the aircraft taken apart it can be seen lying in its bay.
    const top = MODS.fwdTop.group, PT = 1.0, PA = 1.86, PB = 2.98;                 // angle round the section, and the bay's stations
    const onSkin = (st, th, sink = 0) => { const [y, z] = sectionPt(fusAt(st), th), q = V3(X(st), y, z), c = V3(X(st), fusAt(st).c, 0); return q.add(c.sub(q).normalize().multiplyScalar(sink)); };
    const pivotPt = onSkin(PB, PT, 0.075), tipPt = onSkin(PA, PT, 0.075), along = tipPt.clone().sub(pivotPt), reach = along.length();
    along.normalize();
    const outward = onSkin((PA + PB) / 2, PT).sub(V3(X((PA + PB) / 2), fusAt((PA + PB) / 2).c, 0)).normalize();
    const swing = new THREE.Group(); swing.position.copy(pivotPt); top.add(swing);
    const lay = new THREE.Group(); lay.quaternion.setFromUnitVectors(V3(1, 0, 0), along); swing.add(lay);     // the probe is built along +x and laid along the bay
    const P = bulk();
    P.add(rodGeo(V3(0, 0, 0), V3(reach - 0.14, 0, 0), 0.028, 12), "light");
    P.add(rodGeo(V3(reach - 0.14, 0, 0), V3(reach - 0.03, 0, 0), 0.034, 14, 0.022), "silver");                  // nozzle
    P.add(aim(torusGeo(0.034, 0.006, 16), V3(reach - 0.14, 0, 0), V3(1, 0, 0)), "grey");
    P.add(aim(new THREE.CylinderGeometry(0.013, 0.013, 0.04, 10), V3(reach - 0.015, 0, 0), V3(1, 0, 0)), "dark");
    P.add(sphereGeo(0.045, 0, 0, 0, 12, 8), "grey");                                                           // pivot knuckle
    within("fwdTop", () => P.flush(lay));
    within("fwdTop", (gt) => skinPatch(gt, PA - 0.03, PB + 0.03, PT - 0.125, PT + 0.125, "dark", 0.0025));       // the bay, seen when the doors are open
    // two doors, each hinged along its outer edge
    const doors = [];
    for (const sgn of [-1, 1]) {
      const edge = PT + sgn * 0.12, h0 = onSkin(PB + 0.02, edge), h1 = onSkin(PA - 0.02, edge), axis = h1.clone().sub(h0).normalize();
      const door = new THREE.Group(); door.position.copy(h0); top.add(door);
      const sec = (st) => { const S = fusAt(st); return { ...S, w: S.w + 0.006, hu: S.hu + 0.006, hl: S.hl + 0.006 }; };
      const geo = loft(sec, PA - 0.02, PB + 0.02, { t0: Math.min(PT, edge), t1: Math.max(PT, edge), nt: 8, nx: 44 }).translate(-h0.x, -h0.y, -h0.z);
      within("fwdTop", () => add(door, geo, "light", { side: DS }));
      doors.push({ g: door, axis, sgn });
    }
    LIVE.probe = { swing, axis: along.clone().cross(outward).normalize(), doors };
    // boarding ladder under the port wing extension
    const ladder = new THREE.Group(); ladder.position.set(X(6.1), 2.19, -0.8); g.add(ladder); LIVE.ladder = ladder;
    const L = bulk();
    for (const dx of [-0.15, 0.15]) L.add(rodGeo(V3(dx, 0, 0), V3(dx, -1.62, 0), 0.016, 8), "light");
    for (let i = 0; i < 5; i++) L.add(rodGeo(V3(-0.15, -0.3 - i * 0.3, 0), V3(0.15, -0.3 - i * 0.3, 0), 0.012, 8), "grey");
    L.add(rodGeo(V3(0.15, -0.75, 0), V3(0.5, -0.25, 0.18), 0.012, 8), "grey");                                       // brace to the fuselage
    L.add(boxGeo(0.34, 0.03, 0.05, 0, -0.01, 0), "grey");
    L.flush(ladder);
  });
}
