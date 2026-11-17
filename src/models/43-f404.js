// ============================================================================
// 43 · F404-GE-400 on its stand, built to the plumbing. A third of every casing
// is cut away so the rotors show; assemblies separate when it is taken apart.
// Engine frame: axis along x, front face at +x; s is metres aft of the front face.
// ============================================================================
const SHOW = {};
function buildF404() {
  const K = "dF404", Y = 1.55, L0 = 1.95;
  const root = part(K, { name: "General Electric F404-GE-400", by: "GE Aircraft Engines · Lynn, Massachusetts", desc: "The Hornet's engine on a maintenance stand, with a third of each casing cut away. A low-bypass, two-spool afterburning turbofan designed to be simple: about a third fewer parts than the J79 it replaced for the same thrust. Ignite runs it at the throttle and altitude below; Take apart separates its modules, and clicking a module frames it.", kv: [["Thrust, military", "10,600 lbf · 47.2 kN"], ["Thrust, afterburning", "16,000 lbf · 71.2 kN"], ["Length", "3.91 m · 154 in"], ["Diameter", "0.89 m · 35 in"], ["Stages", "3 fan · 7 compressor · 1 + 1 turbine"], ["Bypass ratio", "0.34"], ["Pressure ratio", "about 25 : 1"], ["Airflow", "142 lb/s · 64 kg/s"]] });
  root.position.set(60, 0, 0); root.visible = false;
  const eng = new THREE.Group(); eng.position.y = Y; root.add(eng);
  SHOW[K] = { key: K, group: root, asm: [] };
  const xe = (s) => L0 - s;
  const at = (s, r, a) => V3(xe(s), r * Math.cos(a), r * Math.sin(a));
  const lathe = (prof, o) => lx(prof.map(([r, s, sm]) => [r, xe(s), sm]), o);
  const KEEP = (TAU * 2) / 3;                       // 240° of each casing stays; the upper near third is cut away
  const A0 = Math.PI / 2, A1 = A0 + KEEP;           // clock angles (0 = up, 90° = toward the viewer's side) where casing remains
  const casing = (g, outer, t, role = "metal", o = {}) => {
    const cut = turnCut(band(outer.map(([r, s]) => [r, xe(s)]), 0, -t), 0, KEEP, { seg: 80 });
    add(g, cut.shell.rotateZ(-Math.PI / 2), role, { side: DS, ...o });
    add(g, cut.cap.rotateZ(-Math.PI / 2), "light", { side: DS, map: T.hatch });
  };
  // blades: chord along the axis, twisted about their own radius, set round the hub
  const bladeRing = (B, s, chord, rh, rt, n, twist, thick = 0.006, a0 = 0, a1 = TAU, role = "silver") => {
    for (let k = 0; k < n; k++) {
      const a = a0 + ((a1 - a0) * (a1 - a0 > 6.2 ? k : k + 0.5)) / n;
      B.add(boxGeo(chord, rt - rh, thick, 0, (rh + rt) / 2, 0).rotateY(twist).rotateX(a).translate(xe(s), 0, 0), role);
    }
  };
  const sub = (key, name, desc, ex, kv) => { const g = part(`${K}.${key}`, { name, desc, kv, by: "F404 module" }, ex, eng); SHOW[K].asm.push(`${K}.${key}`); return `${K}.${key}`; };
  const rotor = (g, spool) => { const r = new THREE.Group(); g.add(r); LIVE.rotors.push({ g: r, spool }); return r; };

  // ---------------- fan module ----------------
  within(sub("fan", "Fan module", "Three stages on the low-pressure spool. Variable inlet guide vanes in the front frame steer the air onto the first rotor, which is why the engine tolerates the disturbed air of hard manoeuvring without stalling.", [1.25, 0, 0], [["Stages", "3"], ["Inlet diameter", "0.71 m · 28 in"], ["Driven by", "low-pressure turbine"], ["Guide vanes", "variable"]]), (g) => {
    const B = bulk();
    casing(g, [[0.372, 0.0], [0.372, 0.53]], 0.012);
    for (const s of [0.0, 0.14, 0.53]) add(g, turnCut(band([[0.372, xe(s)], [0.372, xe(s + 0.024)]], 0.022, 0), 0, KEEP, { seg: 80 }).shell.rotateZ(-Math.PI / 2), "light", { side: DS });
    for (const s of [0.012, 0.152, 0.542]) for (let k = 0; k < 40; k++) { const a = A0 + (KEEP * (k + 0.5)) / 40; B.add(aim(new THREE.CylinderGeometry(0.006, 0.006, 0.03, 6), at(s, 0.385, a), V3(1, 0, 0)), "dark"); }
    add(g, lathe([[0.0, -0.1], [0.05, -0.06, 1], [0.1, 0.02, 1], [0.12, 0.13]], { seg: 40 }), "light");                          // bullet nose
    bladeRing(B, 0.07, 0.1, 0.12, 0.36, 18, 0.12, 0.008, 0, TAU, "light");                                                     // inlet guide vanes / front-frame struts
    for (const [s, n, tw] of [[0.265, 22, -0.1], [0.4, 26, -0.1]]) bladeRing(B, s, 0.045, 0.2, 0.37, n, tw, 0.005, A0, A1, "grey");   // fan stators, held by what is left of the case
    B.flush(g);
    const R = rotor(g, 1), RB = bulk();
    add(R, lathe([[0.12, 0.14], [0.15, 0.2, 1], [0.19, 0.32, 1], [0.23, 0.44, 1], [0.25, 0.52]], { seg: 48 }), "light");
    for (const [s, ch, rh, n] of [[0.2, 0.085, 0.145, 26], [0.335, 0.07, 0.195, 32], [0.46, 0.06, 0.235, 38]]) bladeRing(RB, s, ch, rh, 0.362, n, 0.62, 0.006);
    RB.flush(R);
  });

  // ---------------- compressor module ----------------
  within(sub("comp", "High-pressure compressor", "Seven stages squeeze the core air to 26 times the outside pressure overall. The inlet guide vanes and the first two stator rows turn on spindles, moved together by a ring and lever arms so the compressor stays matched from idle to full speed.", [0.55, 0, 0], [["Stages", "7"], ["Variable rows", "inlet guide vanes + 2 stators"], ["Driven by", "high-pressure turbine"], ["Overall pressure ratio", "26 : 1"]]), (g) => {
    const B = bulk();
    // fan frame: struts across both streams and the splitter that divides them
    casing(g, [[0.372, 0.555], [0.395, 0.66]], 0.014);
    add(g, lathe([[0.3, 0.56], [0.315, 0.56], [0.315, 0.67], [0.3, 0.67], [0.3, 0.56]], { seg: 56 }), "light");
    bladeRing(B, 0.61, 0.09, 0.14, 0.3, 10, 0.05, 0.012, 0, TAU, "light");
    bladeRing(B, 0.61, 0.09, 0.315, 0.38, 8, 0.05, 0.012, A0, A1, "light");
    add(g, lathe([[0.14, 0.55], [0.14, 0.67], [0.1, 0.67]], { seg: 32 }), "light");
    // compressor case, split along its length on the real engine
    casing(g, [[0.312, 0.675], [0.305, 0.8], [0.292, 1.0], [0.285, 1.24]], 0.012, "metal");
    for (const s of [0.675, 0.86, 1.05, 1.228]) add(g, turnCut(band([[0.31 - (s - 0.675) * 0.045, xe(s)], [0.31 - (s - 0.675) * 0.045, xe(s + 0.014)]], 0.02, 0), 0, KEEP, { seg: 80 }).shell.rotateZ(-Math.PI / 2), "light", { side: DS });
    // stators in the case; the first three rows have lever arms on the outside, tied to a unison ring
    for (let i = 0; i < 7; i++) {
      const s = 0.69 + i * 0.076, rt = 0.3 - i * 0.004, rh = 0.155 + i * 0.0105;
      bladeRing(B, s + 0.045, 0.02, rh + 0.004, rt, 30 + i * 4, -0.5, 0.004, A0, A1, "grey");
      if (i < 3) {
        const rr = 0.325 - i * 0.004;
        add(g, turn([[rr, -0.006], [rr + 0.012, -0.006], [rr + 0.012, 0.006], [rr, 0.006], [rr, -0.006]], { seg: 60, phi0: 0, phi: KEEP }).rotateZ(-Math.PI / 2).translate(xe(s + 0.02), 0, 0), "silver");
        for (let k = 0; k < 22; k++) { const a = A0 + (KEEP * (k + 0.5)) / 22; B.add(rodGeo(at(s + 0.045, rr - 0.012, a), at(s + 0.02, rr + 0.004, a), 0.004, 5), "dark"); }
      }
    }
    // the two actuators that move the unison rings
    for (const a of [A0 + 0.55, A0 + 1.9]) { B.add(rodGeo(at(0.74, 0.35, a), at(0.9, 0.35, a), 0.016, 10), "grey"); B.add(rodGeo(at(0.66, 0.35, a), at(0.75, 0.35, a), 0.007, 6), "silver"); }
    B.flush(g);
    const R = rotor(g, 2), RB = bulk();
    add(R, lathe([[0.15, 0.68], [0.232, 1.22], [0.2, 1.24]], { seg: 48 }), "light");
    for (let i = 0; i < 7; i++) bladeRing(RB, 0.69 + i * 0.076, 0.036, 0.155 + i * 0.0105, 0.298 - i * 0.004, 34 + i * 5, 0.66 - i * 0.02, 0.004);
    RB.flush(R);
  });

  // ---------------- combustor ----------------
  within(sub("comb", "Combustor", "One ring-shaped flame tube with 18 fuel nozzles round its dome. Only about a fifth of the air burns; the rest enters through rows of holes to cool the walls and dilute the gas to a temperature the turbine can live with.", [0, 0, 0], [["Type", "annular, machined ring"], ["Fuel nozzles", "18"], ["Igniters", "2"], ["Fuel", "JP-5 at sea, JP-8 ashore"]]), (g) => {
    const B = bulk();
    casing(g, [[0.285, 1.245], [0.31, 1.3], [0.31, 1.62], [0.32, 1.68]], 0.012);
    casing(g, [[0.4, 0.665], [0.405, 1.2], [0.41, 1.68]], 0.01, "light");                                  // bypass duct round the core
    for (const s of [0.668, 1.2, 1.67]) add(g, turnCut(band([[0.41, xe(s)], [0.41, xe(s + 0.014)]], 0.02, 0), 0, KEEP, { seg: 80 }).shell.rotateZ(-Math.PI / 2), "light", { side: DS });
    add(g, lathe([[0.19, 1.26], [0.24, 1.3, 1], [0.275, 1.36, 1], [0.275, 1.58], [0.255, 1.66], [0.235, 1.66], [0.2, 1.58], [0.2, 1.36, 1], [0.19, 1.26]], { seg: 64 }), "metal", { map: TEX(1024, 256, (P) => { for (const v of [0.3, 0.42, 0.56, 0.7]) P.rivets(v, 60, 0.75, 3.2); P.hline(0.36, 0.35, 2); P.hline(0.63, 0.35, 2); }) });
    add(g, torusGeo(0.345, 0.014, 60, KEEP).rotateZ(Math.PI / 2).rotateX(A0).translate(xe(1.3), 0, 0), "silver");   // fuel manifold
    for (let k = 0; k < 18; k++) { const a = (k / 18) * TAU; if (a < A0 || a > A1) continue; B.add(rodGeo(at(1.3, 0.335, a), at(1.31, 0.262, a), 0.008, 6), "grey"); B.add(aim(new THREE.CylinderGeometry(0.014, 0.014, 0.02, 6), at(1.3, 0.312, a), at(0, 1, a).setX(0)), "dark"); }
    for (const a of [A0 + 0.35, A0 + 2.3]) { B.add(rodGeo(at(1.4, 0.3, a), at(1.4, 0.44, a), 0.012, 8), "light"); B.add(aim(new THREE.CylinderGeometry(0.02, 0.02, 0.03, 6), at(1.4, 0.44, a), at(0, 1, a).setX(0)), "dark"); }
    B.flush(g);
  });

  // ---------------- turbines ----------------
  within(sub("turb", "Turbines", "Two single-stage turbines, one behind the other. The first takes just enough energy from the gas to turn the compressor at about 16,800 rpm; the second turns the fan. Both rows of blades are air-cooled from inside.", [-0.62, 0, 0], [["High-pressure", "1 stage → compressor"], ["Low-pressure", "1 stage → fan"], ["Blades", "air-cooled"], ["Shafts", "two, concentric"]]), (g) => {
    const B = bulk();
    casing(g, [[0.32, 1.685], [0.335, 1.75], [0.345, 1.92], [0.345, 2.06]], 0.012);
    casing(g, [[0.41, 1.685], [0.42, 2.06]], 0.01, "light");
    bladeRing(B, 1.71, 0.03, 0.22, 0.318, 40, -0.7, 0.005, A0, A1, "grey"); bladeRing(B, 1.815, 0.03, 0.215, 0.335, 44, 0.7, 0.005, A0, A1, "grey");
    // exhaust frame and cone
    bladeRing(B, 1.98, 0.1, 0.17, 0.345, 8, 0.05, 0.012, A0 - 0.3, A1, "light");
    add(g, lathe([[0.17, 1.92], [0.17, 2.02], [0.15, 2.1, 1], [0.09, 2.26, 1], [0.03, 2.38, 1], [0.0, 2.42]], { seg: 40 }), "light");
    B.flush(g);
    const H = rotor(g, 2), HB = bulk();
    add(H, lathe([[0.1, 1.72], [0.225, 1.735], [0.225, 1.775], [0.1, 1.79]], { seg: 40 }), "light");
    bladeRing(HB, 1.755, 0.036, 0.225, 0.316, 64, -0.62, 0.005, 0, TAU, "gold"); HB.flush(H);
    const Lr = rotor(g, 1), LB = bulk();
    add(Lr, lathe([[0.1, 1.84], [0.215, 1.855], [0.215, 1.905], [0.1, 1.92]], { seg: 40 }), "light");
    bladeRing(LB, 1.88, 0.045, 0.215, 0.338, 56, -0.55, 0.005, 0, TAU, "gold"); LB.flush(Lr);
  });

  // ---------------- afterburner ----------------
  within(sub("ab", "Afterburner", "Core gas and bypass air mix here, and for full power fuel is sprayed into the stream from a ring of bars and lit. V-shaped gutters hold the flame in a gale; a perforated liner, cooled by bypass air, keeps it off the duct and damps the screech. Thrust rises 51% and fuel flow more than triples.", [-1.3, 0, 0], [["Thrust gain", "10,600 → 16,000 lbf (+51%)"], ["Fuel flow", "8,590 → 27,840 lb/h"], ["Flame holder", "V-gutter rings"], ["Liner", "perforated, bypass-cooled"]]), (g) => {
    const B = bulk();
    casing(g, [[0.42, 2.065], [0.435, 2.3], [0.445, 3.1]], 0.012);
    for (const s of [2.068, 2.6, 3.085]) add(g, turnCut(band([[0.44, xe(s)], [0.44, xe(s + 0.014)]], 0.022, 0), 0, KEEP, { seg: 80 }).shell.rotateZ(-Math.PI / 2), "light", { side: DS });
    casing(g, [[0.39, 2.36], [0.405, 3.08]], 0.006, "light", { map: TEX(2048, 512, (P) => { for (let v = 0.05; v < 1; v += 0.05) P.rivets(v, 110, 0.7, 2.6); for (const v of [0.25, 0.5, 0.75]) P.hline(v, 0.4, 2); }) });
    // spray bars reach in from the duct; fuel reaches them through a manifold outside
    for (let k = 0; k < 24; k++) { const a = (k / 24) * TAU; if (a < A0 || a > A1) continue; B.add(rodGeo(at(2.16, 0.43, a), at(2.17, 0.19, a), 0.006, 6), "silver"); }
    add(g, torusGeo(0.46, 0.012, 60, KEEP).rotateZ(Math.PI / 2).rotateX(A0).translate(xe(2.16), 0, 0), "silver");
    // flame holder: two gutter rings joined by radial gutters, carried on the exhaust cone
    for (const r of [0.3, 0.19]) add(g, turn([[r - 0.018, -0.03], [r, 0.02], [r + 0.018, -0.03]], { seg: 64 }).rotateZ(-Math.PI / 2).translate(xe(2.24), 0, 0), "metal", { side: DS });
    for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; B.add(rodGeo(at(2.25, 0.1, a), at(2.25, 0.315, a), 0.012, 6), "metal"); }
    B.flush(g);
  });

  // ---------------- exhaust nozzle ----------------
  within(sub("noz", "Variable exhaust nozzle", "Overlapping flaps and seals form a throat that the control unit sizes all the time: wide open at idle so the engine starts easily, shut down at military power, and opening again in step with afterburner fuel so the turbine never feels the extra back-pressure.", [-2.15, 0, 0], [["Type", "convergent-divergent, variable"], ["Actuators", "4, hydraulic, on engine oil"], ["At idle", "open"], ["At military", "closed down"]]), (g) => {
    const B = bulk();
    add(g, lathe([[0.445, 3.1], [0.47, 3.11], [0.47, 3.2], [0.455, 3.22], [0.44, 3.22], [0.44, 3.1]], { seg: 72 }), "light");
    for (let k = 0; k < 36; k++) B.add(aim(new THREE.CylinderGeometry(0.006, 0.006, 0.016, 6), at(3.15, 0.47, (k / 36) * TAU), at(0, 1, (k / 36) * TAU).setX(0)), "dark");
    add(g, lathe([[0.43, 3.1], [0.34, 3.45]], { seg: 56 }), "dark", { side: DS });                             // convergent flaps, seen inside
    const N = 14, r0 = 0.455, L = 0.7, hx = xe(3.22);
    for (let k = 0; k < N; k++) {
      const a = (k / N) * TAU, w = ((TAU * r0) / N) * 1.12;
      const petal = add(g, boxGeo(L, 0.014, w, -L / 2, 0, 0), k % 2 ? "metal" : "light", { map: T.petal, p: [hx, r0 * Math.cos(a), r0 * Math.sin(a)] });
      petal.userData.a = a; LIVE.petals.push({ m: petal, L, r0, lo: 0.29, hi: 0.44 });
    }
    for (const d of [10, 80, 150, 220]) { const a = A0 + d * DEG; B.add(rodGeo(at(2.88, 0.466, a), at(3.09, 0.468, a), 0.022, 10), "grey"); B.add(rodGeo(at(3.09, 0.47, a), at(3.3, 0.462, a), 0.009, 6), "silver"); B.add(boxGeo(0.05, 0.05, 0.05).rotateX(a).translate(xe(2.88), 0.468 * Math.cos(a), 0.468 * Math.sin(a)), "dark"); }
    B.flush(g);
    const fxp = { r0: 0.42, rmax: 2.4, freq: 1.1, flow: 30, hot: 5.5, attack: 0.3, decay: 0.6 };
    const burner = makeFX("AB", 0, { ...fxp, len: 11, spread: 0.9, pow: 1.1, dens: 3.0, diam: 1.8, fade: 0.36, coolK: 0.55, hot: 2.2, freq: 1.5, soot: 0.7 });
    const dry = makeFX("DRY", 0, { ...fxp, len: 6.5, spread: 0.55, pow: 1.1, dens: 1.2, diam: 1.2, fade: 0.3, coolK: 0.6, hot: 2.4, freq: 1.5 });
    for (const fx of [burner, dry]) { fx.position.set(xe(3.9), 0, 0); fx.rotation.z = -Math.PI / 2; g.add(fx); }
    LIVE.fx.push({ burner, dry, r0: 0.42, show: K });
  });

  // ---------------- accessory gearbox ----------------
  within(sub("agb", "Accessory gearbox", "Hung under the compressor and driven from the high-pressure shaft through a tower shaft. It turns the pumps that keep the engine running and the power take-off shaft that drives the aircraft's own gearbox.", [0, -0.36, 0], [["Drive", "tower shaft from the HP spool"], ["Carries", "fuel pump and control, afterburner pump, lube pump, alternator, nozzle hydraulic pump"], ["Power take-off", "to the airframe gearbox"]]), (g) => {
    const B = bulk(), y = -0.6;
    add(g, boxGeo(0.72, 0.2, 0.34, xe(0.98), y, 0), "light");
    B.add(rodGeo(at(0.72, 0.4, Math.PI), V3(xe(0.76), y + 0.1, 0), 0.03, 10), "grey");
    boltCircle(B, V3(xe(0.98), y + 0.1, 0), UP, 0.12, 10, 0.008, 0.012);
    const pad = (s, z, r, len, role, dir = 1) => { B.add(aim(new THREE.CylinderGeometry(r, r, len, 20).translate(0, len / 2, 0), V3(xe(s), y, z), V3(0, 0, dir)), role); B.add(aim(new THREE.CylinderGeometry(r * 1.18, r * 1.18, 0.02, 20), V3(xe(s), y, z + dir * 0.01), V3(0, 0, dir)), "grey"); boltCircle(B, V3(xe(s), y, z + dir * 0.02), V3(0, 0, dir), r * 1.05, 8, 0.006, 0.01); };
    pad(0.72, 0.17, 0.085, 0.2, "metal"); pad(0.96, 0.17, 0.07, 0.24, "grey"); pad(1.2, 0.17, 0.06, 0.16, "metal");
    pad(0.76, -0.17, 0.075, 0.18, "grey", -1); pad(1.02, -0.17, 0.09, 0.2, "metal", -1); pad(1.24, -0.17, 0.05, 0.14, "silver", -1);
    B.add(boxGeo(0.2, 0.16, 0.14, xe(0.96), y - 0.02, 0.48), "light");                                         // main fuel control on the pump
    B.add(rodGeo(V3(xe(0.62), y, 0), V3(xe(0.38), y, 0), 0.03, 12), "silver");                                // power take-off shaft
    B.add(aim(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 14), V3(xe(0.38), y, 0), V3(1, 0, 0)), "grey");
    B.flush(g);
  });

  // ---------------- external plumbing ----------------
  within(sub("ext", "Fuel, oil and air lines", "The plumbing on the outside of the bypass duct: main fuel to the manifold, afterburner fuel to the spray bars, the oil tank and its lines, hydraulic lines to the nozzle actuators, and a bleed-air duct that taps the compressor for the aircraft's air conditioning and for starting the other engine.", [0, -0.25, 0.9], [["Oil tank", "on the fan case"], ["Bleed air", "from the compressor"], ["Nozzle hydraulics", "engine oil as the fluid"]]), (g) => {
    const B = bulk(), a = (deg) => A0 + deg * DEG;
    // oil tank strapped to the fan case
    add(g, lathe([[0.03, 0.2], [0.075, 0.23, 1], [0.085, 0.3, 1], [0.085, 0.5, 1], [0.075, 0.57, 1], [0.03, 0.6]], { seg: 24 }).translate(0, 0.46 * Math.cos(a(35)), 0.46 * Math.sin(a(35))), "light");
    for (const s of [0.3, 0.5]) B.add(torusGeo(0.088, 0.006, 20).rotateZ(Math.PI / 2).translate(xe(s), 0.46 * Math.cos(a(35)), 0.46 * Math.sin(a(35))), "grey");
    B.add(aim(new THREE.CylinderGeometry(0.022, 0.022, 0.03, 10), at(0.4, 0.55, a(35)), at(0, 1, a(35)).setX(0)), "dark");
    duct(B, [at(0.57, 0.5, a(40)), at(0.75, 0.5, a(62)), at(0.9, 0.56, a(84)), at(0.98, 0.62, a(90))], 0.014, { role: "silver", bolts: 6, clamps: [0.4] });
    // electronic control unit, fuel-cooled, on the fan case
    add(g, boxGeo(0.3, 0.07, 0.22).rotateX(a(12)).translate(xe(0.32), 0.405 * Math.cos(a(12)), 0.405 * Math.sin(a(12))), "light");
    // main fuel line from the control to the manifold, with a shut-off valve
    const v1 = valve(B, at(1.12, 0.46, a(50)), V3(-1, 0, 0), 0.03);
    duct(B, [V3(xe(0.96), -0.52, 0.5), at(1.0, 0.5, a(58)), at(1.08, 0.46, a(50)), at(1.3, 0.425, a(48))], 0.016, { role: "silver", bolts: 6, clamps: [0.3] });
    // afterburner fuel line to the spray-bar manifold
    duct(B, [V3(xe(1.2), -0.6, 0.34), at(1.4, 0.5, a(78)), at(1.8, 0.47, a(70)), at(2.14, 0.475, a(68))], 0.018, { role: "silver", bolts: 6, clamps: [0.35, 0.6, 0.85] });
    // bleed air duct with bellows
    duct(B, [at(1.12, 0.42, a(20)), at(1.12, 0.52, a(18)), at(0.95, 0.56, a(14)), at(0.7, 0.56, a(12))], 0.036, { role: "metal", bellows: [0.45], bolts: 10 });
    // hydraulic lines to two of the nozzle actuators
    duct(B, [V3(xe(1.24), -0.6, 0.3), at(1.6, 0.46, a(92)), at(2.4, 0.462, a(80)), at(2.86, 0.468, a(80))], 0.009, { role: "silver", flanges: false, clamps: [0.2, 0.4, 0.6, 0.8] });
    duct(B, [V3(xe(1.24), -0.6, 0.3), at(1.6, 0.46, a(100)), at(2.4, 0.462, a(96)), at(2.52, 0.464, a(112)), at(2.64, 0.466, a(130)), at(2.76, 0.468, a(148)), at(2.86, 0.468, a(150))], 0.009, { role: "silver", flanges: false, clamps: [0.2, 0.4, 0.6, 0.8] });
    SHOW[K].v1 = v1;
    // fuel-oil cooler and fuel filter on the duct, fed from the control
    B.add(aim(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 18), at(1.52, 0.458, a(66)), V3(1, 0, 0)), "light");
    for (const ds of [-0.13, 0.13]) B.add(aim(new THREE.CylinderGeometry(0.056, 0.056, 0.02, 18), at(1.52 + ds, 0.458, a(66)), V3(1, 0, 0)), "grey");
    B.add(aim(new THREE.CylinderGeometry(0.04, 0.04, 0.16, 16), at(0.84, 0.484, a(76)), at(0, 1, a(76)).setX(0)), "light");
    B.add(aim(new THREE.CylinderGeometry(0.046, 0.046, 0.03, 6), at(0.84, 0.574, a(76)), at(0, 1, a(76)).setX(0)), "dark");
    duct(B, [at(1.38, 0.5, a(66)), at(1.2, 0.5, a(60)), at(1.0, 0.52, a(70)), at(0.88, 0.53, a(76))], 0.011, { role: "silver", bolts: 6 });
    // anti-ice air from the compressor to the front frame, with its valve
    const v2 = valve(B, at(0.5, 0.398, a(234)), V3(-1, 0, 0), 0.026);
    duct(B, [at(1.06, 0.425, a(228)), at(0.8, 0.42, a(232)), at(0.5, 0.398, a(234)), at(0.08, 0.392, a(232))], 0.014, { role: "metal", bolts: 6, clamps: [0.3, 0.75] });
    // ignition exciter and the nozzle position transmitter
    add(g, boxGeo(0.2, 0.06, 0.14).rotateX(a(56)).translate(xe(1.86), 0.446 * Math.cos(a(56)), 0.446 * Math.sin(a(56))), "light");
    B.add(aim(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 12), at(3.0, 0.474, a(36)), V3(1, 0, 0)), "light");
    // lube lines to the bearing sumps and the scavenge return
    for (const [s0, d] of [[0.6, 108], [1.25, 112], [1.95, 116]]) duct(B, [V3(xe(0.76), -0.6, -0.1), at(0.9, 0.48, a(d + 20)), at(s0, 0.47, a(d)), at(s0, 0.42, a(d))], 0.007, { role: "silver", flanges: false, clamps: [0.5] });
    // engine mounts: thrust lugs on the fan frame, hanger link aft
    for (const ang of [a(-6), a(186)]) B.add(boxGeo(0.12, 0.1, 0.05).rotateX(ang).translate(xe(0.61), 0.43 * Math.cos(ang), 0.43 * Math.sin(ang)), "grey");
    // drains
    for (const s of [0.9, 1.5, 2.3]) B.add(rodGeo(at(s, 0.42, Math.PI), at(s + 0.02, 0.5, Math.PI), 0.006, 6), "silver");
    B.flush(g);
  });

  // ---------------- wiring harness ----------------
  within(sub("har", "Wiring harness", "The control unit reads the engine through this harness: fan and core speed, inlet temperature, compressor discharge pressure, the exhaust-gas thermocouples and the flame sensor in the afterburner. It also carries the two igniter leads.", [0, 0.2, 1.5], [["Reads", "N1, N2, T1, PS3, EGT, flame"], ["Igniter leads", "2"], ["Control", "electrical unit trimming a hydromechanical fuel control"]]), (g) => {
    const B = bulk(), a = (deg) => A0 + deg * DEG;
    bundle(B, [at(0.46, 0.44, a(14)), at(0.8, 0.424, a(26)), at(1.3, 0.426, a(30)), at(2.0, 0.438, a(30)), at(2.8, 0.46, a(34))], 6, 0.005, 0.014, { tie: 0.12, clamps: 0.4 });
    const leads = [[0.56, a(60), 0.376], [1.02, a(40), 0.405], [1.4, a(20), 0.408], [1.95, a(45), 0.419], [2.2, a(50), 0.43], [2.7, a(48), 0.44]];
    for (const [s, ang, r] of leads) { const tip = sensor(B, at(s, r, ang), at(0, 1, ang).setX(0), 0.014); cable(B, [at(s + 0.02, 0.44, a(30)), at(s + 0.02, 0.48, (a(30) + ang) / 2), tip], 0.005, { clip: 0.09, connector: false }); }
    cable(B, [at(0.47, 0.44, a(14)), at(0.4, 0.46, a(12)), at(0.36, 0.46, a(12))], 0.01, { clip: 0.1 });
    // exhaust-gas thermocouples: eight probes round the turbine frame on their own ring harness
    add(g, torusGeo(0.445, 0.005, 60, KEEP).rotateZ(Math.PI / 2).rotateX(A0).translate(xe(1.97), 0, 0), "dark");
    for (let k = 0; k < 8; k++) { const ang = A0 + (KEEP * (k + 0.5)) / 8; sensor(B, at(1.97, 0.425, ang), at(0, 1, ang).setX(0), 0.01); }
    // igniter leads from the exciter to the two plugs
    for (const ang of [A0 + 0.35, A0 + 2.3]) cable(B, [at(1.86, 0.5, a(56)), at(1.6, 0.47, (a(56) + ang) / 2), at(1.4, 0.45, ang)], 0.007, { clip: 0.12 });
    B.flush(g);
  });

  // ---------------- stand ----------------
  within((part(K + ".stand", { name: "Maintenance stand", by: "engine trailer", desc: "A rail stand holds the engine by its mounts so that any module can be unbolted and rolled away without disturbing the rest.", kv: [["Engine dry weight", "about a tonne"]] }, [0, 0, 0], root), K + ".stand"), (g) => {
    const B = bulk();
    add(g, prismGeo([[-3.1, -1.1], [3.1, -1.1], [3.1, 1.1], [-3.1, 1.1]], -0.1, 0), "light", { map: T.plateTop });
    for (const z of [-0.62, 0.62]) { B.add(boxGeo(5.6, 0.1, 0.1, 0, 0.3, z), "grey"); for (const x of [-2.5, 2.5]) { B.add(rodGeo(V3(x, 0.14, z), V3(x, 0.26, z), 0.03, 8), "dark"); B.add(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 18).rotateX(Math.PI / 2).translate(x, 0.1, z), "paint"); } }
    for (const x of [-2.4, 0, 2.4]) B.add(boxGeo(0.1, 0.08, 1.24, x, 0.3, 0), "grey");
    for (const [s, r] of [[0.61, 0.41], [3.16, 0.475]]) for (const z of [-1, 1]) { B.add(rodGeo(V3(xe(s), 0.35, z * 0.62), V3(xe(s), Y - 0.05, z * (r + 0.06)), 0.035, 10), "grey"); B.add(rodGeo(V3(xe(s), Y, z * (r + 0.08)), V3(xe(s), Y, z * r), 0.025, 10), "silver"); B.add(boxGeo(0.12, 0.12, 0.08, xe(s), Y, z * (r + 0.09)), "light"); }
    B.flush(g);
  });
  smokeSet(root, V3(xe(3.9), Y, 0), 0.62, K);
  SHOW[K].asm.push(K + ".stand");
}
