// ============================================================================
// 41 · M61A1 GUN SYSTEM — the gun above, the drum below, a closed loop of chute
// between them. Gun axis along x at y = GY. The barrel cluster and the drum's
// scoop disc are live groups; the rounds in the chutes are instanced.
// ============================================================================
// Published figures: 578 rounds, 6,000 shots a minute. The rest is how the motion is drawn:
// barrel turn rate (rad/s, about an eighth of life), tracer speed (m/s) and how far they are followed (m).
const GUN = { rounds: 578, rate: 6000, showTurn: 14, speed: 46, range: 30, tracers: 10 };

function buildGun(g) {
  const B = bulk(), GY = 2.24, DY = 1.77, RB = 0.052, CX = X(2.76), FWD = V3(1, 0, 0), AFT = V3(-1, 0, 0);
  const ax = (st, r, a) => V3(X(st), GY + r * Math.cos(a), r * Math.sin(a));          // a point round the gun axis, a = 0 at the top
  const ring = (Bk, st, t, r0, r1, role, y = 0) => Bk.add(lx([[r0, X(st)], [r1, X(st)], [r1, X(st + t)], [r0, X(st + t)], [r0, X(st)]], { seg: 40 }).translate(0, y, 0), role);
  const puck = (Bk, st, t, r, role, y = 0, z = 0, seg = 28) => Bk.add(lx([[0, X(st)], [r, X(st)], [r, X(st + t)], [0, X(st + t)]], { seg }).translate(0, y, z), role);

  // ---- barrel cluster: six barrels, two clamps and the rotor nose turn as one
  const spin = new THREE.Group(); spin.position.set(0, GY, 0); g.add(spin);
  const S = bulk();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU, cy = RB * Math.cos(a), cz = RB * Math.sin(a);
    // bore, muzzle step, slim mid-length, thick breech end
    S.add(lx([[0, X(1.62)], [0.0105, X(1.62)], [0.0105, X(1.56)], [0.0155, X(1.56)], [0.0155, X(1.59)], [0.0185, X(1.6)], [0.0185, X(1.7)], [0.017, X(1.72)], [0.017, X(2.26)], [0.0195, X(2.3)], [0.0195, X(2.6)], [0, X(2.6)]], { seg: 14 }).translate(0, cy, cz), "dark");
    const b = (i / 6 + 1 / 12) * TAU, rad = V3(0, Math.cos(b), Math.sin(b));
    for (const [st, r] of [[1.645, 0.08], [2.0975, 0.078]]) S.add(aim(new THREE.CylinderGeometry(0.0065, 0.0065, 0.008, 6).translate(0, 0.004, 0), V3(X(st), r * rad.y, r * rad.z), rad), "dark");   // clamp bolts
    S.add(boxGeo(0.05, 0.016, 0.03).translate(X(2.535), 0.095, 0).rotateX(a), "grey");                                                                                                           // barrel locking lugs
  }
  puck(S, 1.625, 0.04, 0.08, "grey", 0, 0, 40);                     // muzzle clamp
  puck(S, 2.08, 0.035, 0.078, "grey", 0, 0, 40);                    // mid-barrel clamp
  S.add(lx([[0, X(2.46)], [0.05, X(2.46)], [0.092, X(2.5)], [0.092, X(2.6)], [0, X(2.6)]], { seg: 40 }), "metal");   // rotor nose (stub rotor)
  S.flush(spin);

  // ---- gun housing: the rotor turns inside it; the oval cam track drives each bolt forward and back once a turn
  const H = (prof, role = "metal", seg = 44) => B.add(lx(prof, { seg }).translate(0, GY, 0), role);
  add(g, lx([[0.097, X(2.565)], [0.126, X(2.565)], [0.126, X(2.6)], [0.116, X(2.61)], [0.116, X(2.885)], [0.123, X(2.895)], [0.123, X(2.925)], [0.1, X(2.94)], [0.1, X(2.985)], [0.062, X(3.0)], [0, X(3.0)]], { seg: 48 }).translate(0, GY, 0), "metal");
  boltCircle(B, V3(X(2.565), GY, 0), FWD, 0.112, 12, 0.005, 0.006);
  boltCircle(B, V3(X(2.925), GY, 0), AFT, 0.112, 10, 0.005, 0.006);
  boltCircle(B, V3(X(3.0), GY, 0), AFT, 0.04, 6, 0.004, 0.005);
  for (const st of [2.655, 2.86]) ring(B, st, 0.01, 0.115, 0.1205, "grey", GY);
  B.add(torusGeo(0.1175, 0.0055, 56).rotateZ(Math.PI / 2).rotateY(0.17).translate(X(2.765), GY, 0), "grey");      // cam track
  B.add(boxGeo(0.13, 0.016, 0.085, X(2.76), GY + 0.121, 0), "grey");                                             // access cover
  for (const [dx, dz] of [[-0.055, -0.033], [-0.055, 0.033], [0.055, -0.033], [0.055, 0.033]]) B.add(new THREE.CylinderGeometry(0.005, 0.005, 0.006, 6).translate(X(2.76) + dx, GY + 0.132, dz), "dark");
  puck(B, 2.865, 0.07, 0.018, "light", GY + 0.134, 0.035, 14);                                                   // clearing-sector solenoid
  puck(B, 2.935, 0.012, 0.022, "dark", GY + 0.134, 0.035, 14);

  // ---- mechanical drive unit: hydraulic motor, gear case onto the rear of the housing, flexible shaft down to the drum
  B.add(lx([[0, X(2.865)], [0.03, X(2.865)], [0.042, X(2.875)], [0.042, X(2.97)], [0.034, X(2.98)], [0.034, X(3.005)], [0, X(3.005)]], { seg: 22 }).translate(0, 2.13, -0.185), "light");
  for (const st of [2.9, 2.945]) ring(B, st, 0.008, 0.041, 0.0455, "grey", 2.13).translate(0, 0, -0.185);
  B.add(boxGeo(0.085, 0.09, 0.11, X(2.935), 2.175, -0.115), "grey");
  for (const [dy, dz] of [[-0.03, -0.035], [0.03, -0.035], [-0.03, 0.035], [0.03, 0.035]]) B.add(new THREE.CylinderGeometry(0.005, 0.005, 0.006, 6).rotateZ(Math.PI / 2).translate(X(2.98), 2.175 + dy, -0.115 + dz), "dark");
  B.add(boxGeo(0.06, 0.04, 0.07, X(2.89), 1.94, -0.19), "light");                                                // hydraulic disconnect block on the drum
  for (const dx of [-0.014, 0.014]) duct(B, [[X(2.94) + dx, 2.092, -0.2], [X(2.95) + dx, 2.02, -0.222], [X(2.9) + dx, 1.962, -0.2]], 0.006, { role: "silver", flanges: false });
  cable(B, [[X(2.975), 2.15, -0.1], [X(3.008), 2.02, -0.09], [X(3.002), 1.86, -0.045], [X(2.96), DY, 0]], 0.011, { role: "dark", clip: 0.09, connector: false });

  // ---- pallet: two saddles carry the gun on the drum; two recoil adapters take the kick into the airframe
  B.add(boxGeo(0.03, 0.2, 0.25, X(2.63), 2.07, 0), "grey");
  B.add(boxGeo(0.03, 0.2, 0.2, X(2.89), 2.07, 0.01), "grey");
  for (const s of [-1, 1]) {
    for (const st of [2.63, 2.89]) B.add(boxGeo(0.05, 0.02, 0.05, X(st), 1.985, s * 0.085), "light");            // saddle feet on the drum
    const a = s * 0.75;
    B.add(rodGeo(ax(2.62, 0.15, a), ax(2.76, 0.15, a), 0.02, 14), "silver");                                     // recoil adapter body
    B.add(rodGeo(ax(2.5, 0.15, a), ax(2.62, 0.15, a), 0.011, 10), "light");                                      // its rod
    for (const st of [2.64, 2.74]) B.add(aim(torusGeo(0.021, 0.004, 14), ax(st, 0.15, a), FWD), "grey");
    B.add(boxGeo(0.04, 0.03, 0.045).translate(X(2.745), 0.132, 0).rotateX(a).translate(0, GY, 0), "grey");       // bracket onto the housing
    B.add(boxGeo(0.045, 0.05, 0.034).translate(X(2.495), 0.158, 0).rotateX(a).translate(0, GY, 0), "light");     // airframe lug
    B.add(aim(new THREE.CylinderGeometry(0.008, 0.008, 0.04, 8), ax(2.495, 0.165, a), V3(0, -Math.sin(a), Math.cos(a))), "dark");
  }

  // ---- ammunition drum: 578 rounds, fixed outer drum with partitions, a turning scoop disc at the front
  add(g, lx([[0, X(2.28)], [0.236, X(2.28)], [0.24, X(2.288)], [0.24, X(2.912)], [0.236, X(2.92)], [0, X(2.92)]], { seg: 56 }).translate(0, DY, 0), "light", { map: stripesTex(24, 0.42, 1.4, 1024, 256) });
  for (const st of [2.3, 2.45, 2.6, 2.75, 2.9]) B.add(torusGeo(0.2425, 0.006, 56).rotateZ(Math.PI / 2).translate(X(st), DY, 0), "grey");
  puck(B, 2.92, 0.035, 0.056, "grey", DY, 0, 24); boltCircle(B, V3(X(2.955), DY, 0), AFT, 0.042, 6, 0.005, 0.006);   // drum drive gearbox
  boltCircle(B, V3(X(2.92), DY, 0), AFT, 0.2, 16, 0.005, 0.006);
  const onDrum = (geo, a) => geo.rotateX(a).translate(0, DY, 0);                                                  // place something built at the top of the drum round to angle a
  B.add(onDrum(boxGeo(0.14, 0.012, 0.11, X(2.44), 0.244, 0), 2.5), "grey");                                       // loading door
  for (const dx of [-0.055, 0.055]) B.add(onDrum(new THREE.CylinderGeometry(0.006, 0.006, 0.008, 6).translate(X(2.44) + dx, 0.252, 0), 2.5), "dark");
  const helix = new THREE.Group(); helix.position.set(0, DY, 0); g.add(helix);
  const D = bulk();
  ring(D, 2.262, 0.012, 0.045, 0.205, "grey");
  for (let i = 0; i < 8; i++) D.add(boxGeo(0.016, 0.15, 0.014).translate(X(2.258), 0.125, 0).rotateX((i / 8) * TAU), "light");
  puck(D, 2.246, 0.034, 0.045, "metal");
  boltCircle(D, V3(X(2.246), 0, 0), FWD, 0.03, 6, 0.004, 0.005);
  D.flush(helix);

  // ---- the two chutes: live rounds up the starboard side, empty cases down the port side
  const side = [[1.925, 0.212], [2.02, 0.258], [2.12, 0.258], [2.2, 0.215], [2.228, 0.135]];   // [y, z] from the drum to the gun
  const cvF = curveOf(side.map(([y, z]) => V3(CX, y, z)));
  const cvR = curveOf(side.slice().reverse().map(([y, z]) => V3(CX, y, -z)));
  const M = new THREE.Matrix4(), frameAt = (cv, u) => { const p = cv.getPointAt(u), t = cv.getTangentAt(u), nrm = V3().crossVectors(t, FWD).normalize(); return M.makeBasis(FWD, nrm, t).setPosition(p).clone(); };
  const PITCH = 0.03, W = 0.098;
  const chute = (cv) => {
    const L = cv.getLength(), n = Math.round(L / PITCH);
    for (let i = 0; i <= n; i++) {
      const m = frameAt(cv, i / n);
      B.add(boxGeo(2 * W + 0.004, 0.004, 0.015, 0, 0.026, 0).applyMatrix4(m), "silver");
      B.add(boxGeo(2 * W + 0.004, 0.004, 0.015, 0, -0.026, 0).applyMatrix4(m), "silver");
      for (const s of [-1, 1]) B.add(boxGeo(0.004, 0.056, 0.015, s * W, 0, 0).applyMatrix4(m), "silver");
    }
    for (const s of [-1, 1]) for (const dn of [-0.02, 0.02]) {                                                    // the flexible rails the elements ride on
      const pts = []; for (let i = 0; i <= 24; i++) { const u = i / 24, p = cv.getPointAt(u), t = cv.getTangentAt(u), nrm = V3().crossVectors(t, FWD).normalize(); pts.push(p.addScaledVector(nrm, dn).add(V3(s * (W + 0.003), 0, 0))); }
      B.add(new THREE.TubeGeometry(curveOf(pts), 48, 0.003, 6, false), "grey");
    }
    return n;
  };
  const nF = chute(cvF), nR = chute(cvR);
  for (const [cv, u] of [[cvF, 0], [cvF, 1], [cvR, 0], [cvR, 1]]) {                                               // exit and entrance units on the drum, feeder and case-return units on the gun
    const m = frameAt(cv, u), atGun = (cv === cvF) === (u === 1);
    B.add(boxGeo(0.208, atGun ? 0.072 : 0.066, atGun ? 0.07 : 0.085, 0, 0, atGun ? (u ? 0.012 : -0.012) : (u ? 0.02 : -0.02)).applyMatrix4(m), "grey");
    B.add(aim(new THREE.CylinderGeometry(0.028, 0.028, 0.214, 16), V3(0, atGun ? 0.02 : -0.034, 0).applyMatrix4(m), FWD), "silver");   // sprocket shaft housing
    for (const s of [-1, 1]) B.add(aim(new THREE.CylinderGeometry(0.012, 0.012, 0.01, 6), V3(s * 0.109, atGun ? 0.02 : -0.034, 0).applyMatrix4(m), FWD), "dark");
  }

  // ---- wiring: junction box on the front flange, leads to the solenoid and to the exit unit's round counter
  B.add(boxGeo(0.07, 0.03, 0.07, X(2.6), GY + 0.141, 0), "light");
  cable(B, [[X(2.635), GY + 0.141, 0], [X(2.67), GY + 0.152, 0.012], [X(2.8), GY + 0.153, 0.03], [X(2.862), GY + 0.136, 0.035]], 0.006, { clip: 0.07 });
  cable(B, [[X(2.6), GY + 0.141, 0.035], [X(2.6), 2.3, 0.142], [X(2.636), 2.12, 0.2], [X(2.652), 1.975, 0.236]], 0.006, { clip: 0.09 });
  B.flush(g);

  // ---- rounds in the chutes (instanced): 20 × 102 mm, case and projectile, nose forward
  const caseGeo = lx([[0, 0.018], [0.0102, 0.018], [0.0102, 0.004], [0.0148, -0.008], [0.0148, -0.078], [0.0125, -0.0792], [0.0125, -0.0812], [0.0148, -0.0825], [0.0148, -0.084], [0, -0.084]], { seg: 12 });
  const tipGeo = lx([[0, 0.084], [0.0045, 0.079, 1], [0.0085, 0.06, 1], [0.0098, 0.04, 1], [0.0098, 0.018], [0, 0.018]], { seg: 12 });
  const inst = (geo, role, n) => { const m = add(g, geo, role, { instances: n }); m.frustumCulled = false; m.userData.noBox = true; return m; };
  const cases = inst(caseGeo, "gold", nF), tips = inst(tipGeo, "grey", nF), spent = inst(caseGeo.clone(), "gold", nR);
  const M4 = new THREE.Matrix4(), ZERO = new THREE.Matrix4().makeScale(0, 0, 0), P = V3();
  // phase: rounds moved as drawn; left: rounds remaining; moved: empty cases sent back so far
  const layout = (phase, left, moved) => {
    const f = phase - Math.floor(phase);
    for (let i = 0; i < nF; i++) {
      const u = (i + f) / nF, on = (1 - u) * nF <= left;
      if (on) { cvF.getPointAt(u, P); M4.makeTranslation(P.x, P.y, P.z); }
      cases.setMatrixAt(i, on ? M4 : ZERO); tips.setMatrixAt(i, on ? M4 : ZERO);
    }
    for (let i = 0; i < nR; i++) {
      const u = (i + f) / nR, on = u * nR <= moved;
      if (on) { cvR.getPointAt(u, P); M4.makeTranslation(P.x, P.y, P.z); }
      spent.setMatrixAt(i, on ? M4 : ZERO);
    }
    cases.instanceMatrix.needsUpdate = tips.instanceMatrix.needsUpdate = spent.instanceMatrix.needsUpdate = true;
  };
  layout(0, GUN.rounds, 0);

  // ---- muzzle: flash, gun gas and the tracers that leave it
  const muzzle = V3(X(1.555), GY, 0);
  const flash = makeFX("GUN", 0, { len: 1.4, r0: 0.075, rmax: 0.5, spread: 1.15, pow: 1.0, dens: 20, diam: 0, fade: 0.5, coolK: 0.7, hot: 2.4, freq: 3.2, flow: 46 });
  flash.rotation.z = Math.PI / 2; flash.position.copy(muzzle); g.add(flash);
  const gas = makeFX("SMOKE", 1, { len: 2.8, r0: 0.34, rmax: 0.7, freq: 1.9, flow: 2.6, dens: 0.75 });
  gas.rotation.z = Math.PI / 2 + 0.1; gas.position.set(muzzle.x + 0.9, GY + 0.06, 0); g.add(gas);
  const tracers = [];
  for (let i = 0; i < GUN.tracers; i++) {
    const fx = makeFX("GUN", 0, { len: 1.5, r0: 0.03, rmax: 0.1, spread: 0.12, pow: 1.0, dens: 70, diam: 0, fade: 0.75, coolK: 0.5, hot: 2.2, freq: 2, flow: 30 });
    fx.rotation.z = -Math.PI / 2; g.add(fx);
    const a = i * 2.39996, r = 0.004 * Math.sqrt((i + 0.5) / GUN.tracers);            // inside the gun's 8 mrad dispersion circle
    tracers.push({ fx, d: -1, dy: r * Math.cos(a), dz: r * Math.sin(a) });
  }
  LIVE.gun = { spin, helix, flash, gas, tracers, muzzle, layout, next: 0 };
}
