// ============================================================================
// 46 · EXHAUST NOZZLE AND TAILPIPE of the installed engines.
// Outside, from the supplied three-view (stations in the engine's own frame, 0.53 m more than the aircraft's):
//   ribbed shroud band 16.28–16.48 · actuator ring 16.48–16.53 · twelve outer flaps 16.53–17.10, base radius 0.43, exit radius 0.275 as drawn.
// Inside, which the drawing does not show, from the F404's known layout: primary flaps closing to a throat, divergent flaps opening
// to the exit, afterburner liner, flameholder, spray bars, exhaust cone, turbine outlet struts and the last turbine wheel.
// ============================================================================
const NOZ = { N: 12, band: 16.28, ring: 16.48, hinge: 16.53, throat: 16.83, exit: 17.1, rRing: 0.43, rIn: 0.385, tLo: 0.21, tHi: 0.34, eLo: 0.275, eHi: 0.44 };
// A flap: a plate from its hinge (x = 0) aft to x = -dx, tapering from width w0 to w1 and curved to the nozzle's radius; local +y points away from the axis.
function flapGeo(dx, w0, w1, r0, r1, thick = 0.012, rib = 0) {
  const g = new THREE.BoxGeometry(dx, thick, 1, 5, 1, 6).translate(-dx / 2, 0, 0), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const f = -p.getX(i) / dx, z = p.getZ(i) * lerp(w0, w1, f), r = lerp(r0, r1, f);
    p.setZ(i, z); p.setY(i, p.getY(i) + Math.sqrt(Math.max(r * r - z * z, 0)) - r);
  }
  g.computeVertexNormals();
  if (!rib) return g;
  return mergeGeos([g, boxGeo(dx * 0.86, rib, 0.016, -dx * 0.5, thick / 2 + rib / 2, 0), boxGeo(0.05, rib * 1.6, 0.05, -0.03, thick / 2 + rib * 0.8, 0)]);   // stiffening rib and hinge lug
}
function buildNozzle(g, o, s) {
  const N = NOZ.N, pitch = (r) => (TAU * r) / N, B = bulk();
  const ring = (a, b, r0, r1, role) => B.add(lx([[r0, X(a)], [r1, X(a)], [r1, X(b)], [r0, X(b)], [r0, X(a)]], { seg: 48 }).translate(0, o.y, o.z), role);
  const around = (geo, a) => geo.rotateX(a).translate(0, o.y, o.z);                       // something built at the top of the engine, turned round to angle a
  // ---- outside, as the drawing shows it
  add(g, lx([[0.437, X(NOZ.band)], [0.43, X(NOZ.ring)]], { seg: 48 }).translate(0, o.y, o.z), "metal", { side: DS });      // shroud band
  for (let k = 0; k < 30; k++) B.add(around(boxGeo(0.17, 0.01, 0.052, X((NOZ.band + NOZ.ring) / 2), 0.435, 0), (k / 30) * TAU), "light");   // its slats
  ring(NOZ.ring, NOZ.hinge, 0.4, 0.452, "grey");                                                                          // actuator ring
  for (let k = 0; k < N; k++) B.add(around(boxGeo(0.04, 0.02, 0.07, X(NOZ.hinge - 0.02), 0.458, 0), (k / N) * TAU), "dark");   // hinge brackets
  // ---- flaps: twelve of each, with a seal under every gap; all hinged, all driven by the nozzle position
  const flap = (geo, role, k, half, x0, x1, h, t, map) => {
    const a = ((k + (half ? 0.5 : 0)) / N) * TAU, m = add(g, geo, role, { map, p: [X(x0), o.y + h[0] * Math.cos(a), o.z + h[0] * Math.sin(a)] });
    LIVE.flaps.push({ m, a, oy: o.y, oz: o.z, x: X(x0), dx: x1 - x0, h, t });
  };
  const eT = [NOZ.eLo, NOZ.eHi], tT = [NOZ.tLo, NOZ.tHi], dxO = NOZ.exit - NOZ.hinge, dxP = NOZ.throat - NOZ.ring, dxD = NOZ.exit - 0.015 - NOZ.throat;
  const outer = flapGeo(dxO, pitch(0.43) * 0.9, pitch(NOZ.eLo + 0.012) * 0.94, 0.43, NOZ.eLo, 0.012, 0.012);
  const outerSeal = flapGeo(dxO, 0.06, pitch(NOZ.eHi) - pitch(NOZ.eLo) * 0.94 + 0.03, 0.42, NOZ.eLo, 0.006);
  const prim = flapGeo(dxP, pitch(NOZ.rIn) * 0.9, pitch(NOZ.tLo) * 0.94, NOZ.rIn, NOZ.tLo, 0.01);
  const primSeal = flapGeo(dxP, 0.05, pitch(NOZ.tHi) - pitch(NOZ.tLo) * 0.94 + 0.03, NOZ.rIn, NOZ.tLo, 0.006);
  const div = flapGeo(dxD, pitch(NOZ.tLo) * 0.94, pitch(NOZ.eLo - 0.014) * 0.94, NOZ.tLo, NOZ.eLo, 0.01);
  const divSeal = flapGeo(dxD, pitch(NOZ.tHi) - pitch(NOZ.tLo) * 0.94 + 0.03, pitch(NOZ.eHi) - pitch(NOZ.eLo) * 0.94 + 0.03, NOZ.tLo, NOZ.eLo, 0.006);
  for (let k = 0; k < N; k++) {
    flap(outer, "metal", k, 0, NOZ.hinge, NOZ.exit, [0.43, 0.43], [eT[0] + 0.014, eT[1] + 0.014], T.petal);
    flap(outerSeal, "grey", k, 1, NOZ.hinge, NOZ.exit, [0.422, 0.422], [eT[0] + 0.006, eT[1] + 0.006]);
    flap(prim, "dark", k, 0, NOZ.ring, NOZ.throat, [NOZ.rIn, NOZ.rIn], tT);
    flap(primSeal, "grey", k, 1, NOZ.ring, NOZ.throat, [NOZ.rIn + 0.008, NOZ.rIn + 0.008], [tT[0] + 0.008, tT[1] + 0.008]);
    flap(div, "metal", k, 0, NOZ.throat, NOZ.exit - 0.015, tT, [eT[0] - 0.014, eT[1] - 0.014], T.petal);
    flap(divSeal, "grey", k, 1, NOZ.throat, NOZ.exit - 0.015, [tT[0] + 0.008, tT[1] + 0.008], [eT[0] - 0.006, eT[1] - 0.006]);
  }
  // ---- inside the tailpipe
  add(g, lx([[0.375, X(15.22)], [0.375, X(NOZ.ring)]], { seg: 48 }).translate(0, o.y, o.z), "light", { side: DS, map: T.liner });   // afterburner liner with its cooling holes
  ring(15.2, 15.23, 0.375, 0.43, "grey");                                                                                  // liner support ring
  for (let k = 0; k < 24; k++) B.add(around(rodGeo(V3(X(15.2), 0.385, 0), V3(X(15.2), 0.15, 0), 0.007, 6), (k / 24) * TAU), "silver");   // fuel spray bars
  B.add(torusGeo(0.245, 0.02, 40, TAU, 6).rotateZ(Math.PI / 2).translate(X(15.34), o.y, o.z), "dark");                       // flameholder: ring gutter…
  B.add(torusGeo(0.115, 0.014, 28, TAU, 6).rotateZ(Math.PI / 2).translate(X(15.34), o.y, o.z), "dark");
  for (let k = 0; k < 12; k++) B.add(around(boxGeo(0.05, 0.25, 0.026, X(15.345), 0.24, 0), ((k + 0.5) / 12) * TAU), "dark"); // …and radial gutters
  B.add(lx([[0.17, X(14.62)], [0.155, X(14.8), 1], [0.07, X(15.1), 1], [0, X(15.2)]], { seg: 28, inside: true }).translate(0, o.y, o.z), "light");   // exhaust cone
  for (let k = 0; k < 12; k++) B.add(around(boxGeo(0.14, 0.215, 0.012, X(14.68), 0.2775, 0), (k / 12) * TAU), "grey");       // turbine outlet struts
  B.flush(g);
  // ---- the last turbine wheel and the fan, which turn with the low-pressure spool
  const rot = new THREE.Group(); rot.position.set(0, o.y, o.z); g.add(rot); LIVE.rotors.push({ g: rot, spool: 1 });
  const R = bulk();
  R.add(lx([[0, X(14.46)], [0.17, X(14.46)], [0.17, X(14.56)], [0, X(14.56)]], { seg: 28 }), "metal");
  for (let k = 0; k < 44; k++) R.add(boxGeo(0.07, 0.215, 0.007).rotateY(0.6).translate(X(14.51), 0.2775, 0).rotateX((k / 44) * TAU), "silver");
  for (let k = 0; k < 22; k++) R.add(boxGeo(0.11, 0.33, 0.008).rotateY(-0.55).translate(X(13.36), 0.265, 0).rotateX((k / 22) * TAU), "silver");   // fan blades behind the spinner
  R.flush(rot);
}
