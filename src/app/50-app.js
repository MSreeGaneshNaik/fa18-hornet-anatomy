// ============================================================================
// 50 · CONTROLLER — what is selected, the engine state, the take-apart, the camera.
// ============================================================================
const MENU = [
  ["Aircraft", [["whole", "Whole aircraft", null], ["nose", "Radar and radome", ["radar", "radome"]], ["gun", "Cannon", ["gun"]], ["pit", "Cockpit and seat", ["cockpit", "seat", "canopy"]], ["wings", "Wings", ["wingS", "wingP"]], ["tail", "Fins and stabilators", ["finS", "finP", "stabS", "stabP"]], ["fuel", "Fuel and intakes", ["tanks", "ducts"]], ["engs", "Engines, installed", ["engS", "engP"]], ["sys", "Avionics and systems", ["systems"]], ["legs", "Landing gear", ["gear"]], ["arms", "Missiles and pylons", ["storesS", "storesP", "aim7S", "aim7P"]], ["ext", "Probes, antennas and lights", ["extras"]]]],
  ["F404 engine", [["dF404", "Whole engine", null], ["dF404.fan", "Fan", null], ["dF404.comp", "Compressor", null], ["dF404.comb", "Combustor", null], ["dF404.turb", "Turbines", null], ["dF404.ab", "Afterburner", null], ["dF404.noz", "Exhaust nozzle", null], ["dF404.agb", "Accessory gearbox", null], ["dF404.ext", "Fuel, oil and air lines", null], ["dF404.har", "Wiring harness", null]]],
];
const MENU_ITEMS = {}, MOD_TO_ITEM = {};
const C = { sel: "whole", hover: null, explode: false, exAmt: 0, running: true, pwr: 0, lever: MIL_AT, feet: 0, feetNow: 0, spool: 0, light: 0, fold: false, foldAmt: 0, puffAge: 0, canopy: false, canopyAmt: 0, load: 0, probe: false, probeAmt: 0, fire: false, gunSpin: 0, gunFlash: 0, gunGas: 0, gunFeed: 0, rounds: GUN.rounds, t: 0, now: null, tour: !REDUCED, tourT: 0 };
const UI = { insets: { top: 54, bottom: 86 }, sync() {}, tick() {} };
const VIEW = { jet: { az: -52 * DEG, el: 23 * DEG }, eng: { az: -24 * DEG, el: 17 * DEG } };
const sceneOf = (id) => (String(id).startsWith("dF404") ? "eng" : "jet");
const jetKeys = () => ORDER.filter((k) => !k.startsWith("dF404"));
function buildMenuIndex() {
  for (const [, items] of MENU) for (const [id, label, mods] of items) {
    const eng = sceneOf(id) === "eng";
    MENU_ITEMS[id] = { id, label, eng, mods: mods || (id === "whole" ? jetKeys().filter((k) => k !== "deck") : id === "dF404" ? SHOW.dF404.asm : [id]) };
    if (mods) for (const k of mods) MOD_TO_ITEM[k] = id;
    if (eng && id !== "dF404") MOD_TO_ITEM[id] = id;
  }
}
function selectItem(id) {
  if (!MENU_ITEMS[id]) return;
  const was = sceneOf(C.sel);
  C.sel = id; CAM.user = false; if (id === "pit") C.canopy = true;
  if (sceneOf(id) !== was) { CAM.fly = null; CAM.az = VIEW[sceneOf(id)].az; CAM.el = VIEW[sceneOf(id)].el; CAM.snap = true; C.explode = false; C.exAmt = 0; }
  UI.sync();
}
function setExplode(on) { C.explode = on; C.tour = false; if (on && sceneOf(C.sel) === "jet") C.running = false; CAM.user = false; UI.sync(); }
function setRunning(on) { if (on && !C.running) C.puffAge = 0; C.running = on; C.tour = false; if (on && sceneOf(C.sel) === "jet") C.explode = false; UI.sync(); }
// The cannon only runs with the aircraft taken apart. Out of rounds: the switch reloads the drum and fires again.
function setFire(on) {
  if (on && !(C.explode && sceneOf(C.sel) === "jet")) return;
  if (on && C.rounds < 1) { C.rounds = GUN.rounds; C.gunFeed = 0; }
  C.fire = on; C.tour = false;
  if (on && C.sel !== "gun") selectItem("gun"); else UI.sync();
}
function setLever(v) { C.lever = clamp(v, 0, 1); if (Math.abs(C.lever - MIL_AT) < 0.012) C.lever = MIL_AT; C.tour = false; UI.sync(); }
const TOUR = [[0, MIL_AT], [3, MIL_AT], [5, 1], [12, 1], [14, MIL_AT], [17, 0], [20, 0], [23, MIL_AT]];
function tourLever(t) { t %= TOUR[TOUR.length - 1][0]; for (let i = 1; i < TOUR.length; i++) if (t <= TOUR[i][0]) return lerp(TOUR[i - 1][1], TOUR[i][1], (t - TOUR[i - 1][0]) / (TOUR[i][0] - TOUR[i - 1][0])); return MIL_AT; }

function applyFrame(dt) {
  C.t += dt;
  const k = (s) => 1 - Math.exp(-dt / (REDUCED ? 0.001 : s));
  if (C.tour && C.running) { C.tourT += dt; C.lever = tourLever(C.tourT); }
  const scene = sceneOf(C.sel);
  // take-apart
  const target = C.explode ? 1 : 0;
  C.exAmt += (target - C.exAmt) * k(0.55); if (Math.abs(C.exAmt - target) < 1e-3) C.exAmt = target;
  const moving = ORDER.filter((key) => EX[key].lengthSq() > 0), n = moving.length;
  moving.forEach((key, i) => { const e = sceneOf(key) === scene ? ease(clamp(C.exAmt * 1.5 - (0.5 * i) / n, 0, 1)) : 0; MODS[key].group.position.copy(EX[key]).multiplyScalar(e); });
  for (const key of ORDER) { const top = MODS[key].group; if (top.parent === SCENE) top.visible = sceneOf(key) === scene; }
  // canopy: swings up on its aft hinge
  C.canopyAmt += ((C.canopy ? 1 : 0) - C.canopyAmt) * k(0.5);
  // stores, probe, ladder, radome
  for (const groups of LIVE.loads) groups.forEach((grp, i) => { grp.visible = i === C.load; });
  C.probeAmt += ((C.probe ? 1 : 0) - C.probeAmt) * k(0.6);
  if (LIVE.probe) {                                                      // doors open first, then the probe swings out; the reverse to stow
    const a = clamp(C.probeAmt, 0, 1), open = ease(clamp(a / 0.45, 0, 1)), out = ease(clamp((a - 0.3) / 0.7, 0, 1));
    LIVE.probe.swing.quaternion.setFromAxisAngle(LIVE.probe.axis, out * 27 * DEG);
    for (const d of LIVE.probe.doors) d.g.quaternion.setFromAxisAngle(d.axis, -d.sgn * open * 82 * DEG);
  }
  if (LIVE.ladder) { const a = ease(clamp(C.canopyAmt, 0, 1)) * (1 - ease(clamp(C.exAmt * 4, 0, 1))); LIVE.ladder.visible = a > 0.02; LIVE.ladder.rotation.set(0.12 * a, 0, (-(1 - a) * Math.PI) / 2); }
  if (LIVE.radome) LIVE.radome.rotation.y = -ease(clamp(C.exAmt * 1.6 - 0.3, 0, 1)) * 105 * DEG;
  if (LIVE.canopy) LIVE.canopy.rotation.z = ease(clamp(C.canopyAmt, 0, 1)) * 36 * DEG * (1 - ease(clamp(C.exAmt, 0, 1)));   // lifted clear in take-apart, so it stays level there
  // cannon: barrels spin up, then rounds leave at the true rate while the motion is drawn about eight times slower
  if (C.fire && !(C.explode && scene === "jet")) { C.fire = false; UI.sync(); }
  if (LIVE.gun) {
    const G = LIVE.gun, want = C.fire && C.rounds > 0 ? 1 : 0;
    C.gunSpin += (want - C.gunSpin) * k(want ? 0.1 : 0.45); if (!want && C.gunSpin < 1e-3) C.gunSpin = 0;
    const firing = want && C.gunSpin > 0.85 && C.exAmt > 0.97 ? 1 : 0;
    if (firing) { C.rounds = Math.max(0, C.rounds - (GUN.rate / 60) * dt); if (C.rounds <= 0) { C.fire = false; UI.sync(); } }
    C.gunFlash += (firing - C.gunFlash) * k(firing ? 0.04 : 0.09); if (!firing && C.gunFlash < 1e-3) C.gunFlash = 0;
    C.gunGas += (firing - C.gunGas) * k(firing ? 0.5 : 1.4); if (!firing && C.gunGas < 1e-3) C.gunGas = 0;
    const spinRate = REDUCED ? 0 : GUN.showTurn * C.gunSpin, before = Math.floor(C.gunFeed);
    G.spin.rotation.x += spinRate * dt; G.helix.rotation.x -= spinRate * dt * 0.1;
    if (firing) C.gunFeed += ((spinRate * 6) / TAU) * dt;                       // one round for every barrel that passes the firing position
    G.layout(C.gunFeed, C.rounds, C.gunFeed);
    if (firing && Math.floor(C.gunFeed) > before) { const tr = G.tracers[G.next++ % G.tracers.length]; tr.d = 0; }
    for (const tr of G.tracers) {
      const u = tr.fx.material.uniforms, live = tr.d >= 0 && tr.d < GUN.range;
      if (live) { tr.d += GUN.speed * dt; tr.fx.position.set(G.muzzle.x + 0.4 + tr.d, G.muzzle.y + tr.d * tr.dy, tr.d * tr.dz); u.uTime.value += dt; }
      u.uInt.value = live ? smooth(0, 1.2, tr.d) * (1 - smooth(GUN.range * 0.8, GUN.range, tr.d)) : 0; if (!live) tr.d = -1;
    }
    const fu = G.flash.material.uniforms, gu = G.gas.material.uniforms, flick = REDUCED ? 1 : 0.86 + 0.14 * Math.sin(C.t * 61) * Math.sin(C.t * 23.7);
    fu.uInt.value = C.gunFlash * flick; fu.uTime.value += dt * (REDUCED ? 0 : 1); fu.uLen.value = 1.1 + 0.4 * C.gunFlash; fu.uFront.value = 10; fu.uCut.value = 0;
    gu.uInt.value = C.gunGas * 0.8; gu.uTime.value += dt * (REDUCED ? 0 : 1);
    if (!REDUCED) MODS.gun.group.position.x -= 0.007 * C.gunFlash * (0.5 + 0.5 * Math.sin(C.t * 83));   // recoil shudder
  }
  // wing fold
  C.foldAmt += ((C.fold ? 1 : 0) - C.foldAmt) * k(0.5);
  for (const f of LIVE.fold) f.g.rotation.x = -f.s * ease(C.foldAmt) * 100 * DEG;
  // engine: the spool follows the lever with a lag, the afterburner lights and goes out
  C.pwr += ((C.running ? 1 : 0) - C.pwr) * k(0.9); if (C.pwr < 1e-3 && !C.running) C.pwr = 0;
  C.spool += (C.lever - C.spool) * k(0.75);
  C.feetNow += (C.feet - C.feetNow) * k(0.5);
  const now = (C.now = engine(C.spool, C.feetNow));
  C.light += ((now.ab > 0 ? Math.pow(now.ab, 0.7) : 0) * (C.running ? 1 : 0) - C.light) * k(0.3);
  const nz = now.nozzle * clamp(C.pwr, 0, 1);                            // shut down, the nozzles sit closed down, as the drawing shows them
  for (const f of LIVE.flaps) { const rh = lerp(f.h[0], f.h[1], nz), rt = lerp(f.t[0], f.t[1], nz); f.m.position.set(f.x, f.oy + rh * Math.cos(f.a), f.oz + rh * Math.sin(f.a)); f.m.rotation.set(f.a, 0, Math.atan2(rh - rt, f.dx)); f.m.scale.x = Math.hypot(f.dx, rh - rt) / f.dx; }
  for (const p of LIVE.petals) { const re = lerp(p.lo, p.hi, now.nozzle); p.m.rotation.set(p.m.userData.a, 0, Math.asin(clamp((p.r0 - re) / p.L, -0.5, 0.5))); }
  const w1 = (0.6 + 5 * (now.n1 / 100)) * C.pwr, w2 = (0.8 + 7 * (now.n2 / 100)) * C.pwr;
  if (!REDUCED) for (const r of LIVE.rotors) r.g.rotation.x += (r.spool === 1 ? w1 : w2) * dt;
  const dens = 0.45 + 0.55 * Math.sqrt(now.air.sigma), swell = 1 + 0.45 * (1 - now.air.sigma);
  for (const f of LIVE.fx) {
    const on = (f.show ? "eng" : "jet") === scene ? C.pwr : 0, re = f.show ? lerp(0.3, 0.44, now.nozzle) : lerp(NOZ.eLo, NOZ.eHi, nz);
    const b = f.burner.material.uniforms, d = f.dry.material.uniforms;
    // a flame at every setting: blue and short at idle, growing to military; the orange afterburner takes over above it
    b.uInt.value = on * smooth(0, 0.08, C.light) * (0.45 + 0.55 * C.light); d.uInt.value = on * (0.6 + 0.4 * now.dry) * (1 - 0.85 * C.light);
    for (const u of [b, d]) { u.uTime.value += dt * (REDUCED ? 0 : 1); u.uR0.value = re * swell; u.uFront.value = 10; u.uCut.value = 0; }
    b.uLen.value = (4.5 + 5.5 * C.light) * swell; b.uDens.value = 3.0 * dens * (0.5 + 0.5 * C.light);
    d.uLen.value = 1.6 + 4.4 * now.dry; d.uDens.value = 3.4 * dens * (0.5 + 0.5 * now.dry); d.uDiam.value = 1.7 * smooth(0.4, 1, now.dry);
  }
  // smoke: thickest at dry power, thinner in the cold thin air, burned back a little by the afterburner
  C.puffAge += dt;
  const puff = smooth(0, 0.35, C.puffAge) * Math.exp(-Math.max(0, C.puffAge - 0.35) / 1.5) * (C.running ? 1 : 0);
  for (const s of LIVE.smoke) {
    const on = (s.show ? "eng" : "jet") === scene ? 1 : 0, amt = C.pwr * clamp(0.16 + 0.95 * now.share, 0, 1) * dens;   // smoke follows thrust
    const gap = (0.4 + 4.4 * C.light + 0.5 * now.dry) * s.S;                                   // the smoke starts where the flame ends
    const set = (fx, level, x, y, r0) => { const u = fx.material.uniforms; u.uInt.value = on * level; u.uTime.value += dt * (REDUCED ? 0 : 1); u.uR0.value = r0; fx.position.set(s.exit.x - x, s.exit.y + y, s.exit.z); };
    set(s.trail, amt * 0.9, gap, 0.1 * s.S, Math.min(2.5, (0.85 + 1.05 * now.share) * swell) * s.S);
    set(s.far, amt * 0.75, gap + 6 * s.S, 0.7 * s.S, Math.min(4.0, (1.5 + 1.4 * now.share) * swell) * s.S);
    set(s.low, amt * 0.6 * (s.show ? 0.5 : 1), gap * 0.8, -0.75 * s.S, (0.5 + 0.5 * now.share) * s.S);
    set(s.puff, puff, (0.4 + 2.4 * C.puffAge) * s.S, 0.25 * C.puffAge * s.S, Math.min(2.6, 0.8 + 0.55 * C.puffAge) * s.S);
  }
}

// ---------------- camera (orthographic, as on the Apollo sheet) ----------------
const CAM = { target: V3(0, 2, 0), h: 14, az: VIEW.jet.az, el: VIEW.jet.el, user: false, free: true, fly: null, keys: new Set(), dragMode: "orbit", snap: true };
const _bx = new THREE.Box3(), _bt = new THREE.Box3();
function boxOf(keys) {
  _bx.makeEmpty();
  for (const k of keys) for (const m of MODS[k].meshes) {
    if (!isShown(m) || m.layers.mask !== 1 || m.userData.noBox) continue;
    m.updateWorldMatrix(true, false);
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    if (m.geometry.boundingBox.isEmpty() || !(m.geometry.boundingBox.min.x === m.geometry.boundingBox.min.x)) continue;
    _bt.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld); _bx.union(_bt);
  }
  return _bx;
}
const CAM_DIR = V3(), CAM_RIGHT = V3(), CAM_UP = V3();
function camBasis() {
  CAM_DIR.set(Math.sin(CAM.az) * Math.cos(CAM.el), Math.sin(CAM.el), Math.cos(CAM.az) * Math.cos(CAM.el));
  CAM_RIGHT.crossVectors(UP, CAM_DIR).normalize(); CAM_UP.crossVectors(CAM_DIR, CAM_RIGHT).normalize();
}
function focusFrame() {
  const it = MENU_ITEMS[C.sel], b = boxOf(it.mods);
  if (b.isEmpty()) return { c: CAM.target.clone(), h: CAM.h };
  if (it.id === "whole" && C.pwr > 0.02) b.min.x -= 6 + 4 * C.light;        // room for the plumes
  if (it.id === "dF404" && C.pwr > 0.02) b.min.x -= 1 + 3.5 * C.light;
  const c = b.getCenter(V3());
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < 8; i++) {
    const p = V3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).sub(c), x = p.dot(CAM_RIGHT), y = p.dot(CAM_UP);
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  const aspect = PIPE.w / PIPE.h, H = PIPE.h || 1, free = clamp((H - UI.insets.top - UI.insets.bottom) / H, 0.5, 1);
  c.addScaledVector(CAM_RIGHT, (x0 + x1) / 2).addScaledVector(CAM_UP, (y0 + y1) / 2);
  const h = (Math.max(y1 - y0, (x1 - x0) / aspect) * 1.14) / free;
  c.addScaledVector(CAM_UP, -((UI.insets.bottom - UI.insets.top) / 2) * (h / H));
  return { c, h: Math.max(h, 0.6) };
}
function flyStep(dt) {
  const K = CAM.keys; if (!K.size) return;
  camBasis();
  const fast = K.has("shift") ? 3 : 1, v = CAM.h * 0.6 * dt * fast;
  if (K.has("a")) CAM.target.addScaledVector(CAM_RIGHT, -v);
  if (K.has("d")) CAM.target.addScaledVector(CAM_RIGHT, v);
  if (K.has("q")) CAM.target.y -= v;
  if (K.has("e")) CAM.target.y += v;
  if (K.has("w")) CAM.h = clamp(CAM.h * Math.exp(-1.2 * dt * fast), 0.3, 80);
  if (K.has("s")) CAM.h = clamp(CAM.h * Math.exp(1.2 * dt * fast), 0.3, 80);
  if (K.has("arrowleft")) CAM.az -= 1.3 * dt * fast;
  if (K.has("arrowright")) CAM.az += 1.3 * dt * fast;
  if (K.has("arrowup")) CAM.el = clamp(CAM.el + 0.9 * dt * fast, -0.4, 1.5);
  if (K.has("arrowdown")) CAM.el = clamp(CAM.el - 0.9 * dt * fast, -0.4, 1.5);
  CAM.user = true; CAM.fly = null;
}
function frameCamera(dt) {
  flyStep(dt); camBasis();
  if (CAM.snap) { const f = focusFrame(); CAM.target.copy(f.c); CAM.h = f.h; CAM.snap = false; return; }
  if (CAM.user) return;
  const f = focusFrame(), k = 1 - Math.exp(-dt * (REDUCED ? 60 : 2.6));
  CAM.target.lerp(f.c, k); CAM.h = lerp(CAM.h, f.h, k);
  if (CAM.fly) { CAM.az = lerp(CAM.az, CAM.fly.az, k); CAM.el = lerp(CAM.el, CAM.fly.el, k); if (Math.abs(CAM.az - CAM.fly.az) + Math.abs(CAM.el - CAM.fly.el) < 1e-4) CAM.fly = null; }
}
function resetView() { const v = VIEW[sceneOf(C.sel)]; CAM.user = false; CAM.fly = { az: v.az, el: v.el }; UI.sync(); }
function zoomBy(f, ndc) {
  camBasis();
  const h0 = CAM.h, h1 = clamp(h0 * f, 0.3, 80), aspect = PIPE.w / PIPE.h;
  if (ndc) { const s = 1 - h1 / h0; CAM.target.addScaledVector(CAM_RIGHT, ndc.x * (h0 / 2) * aspect * s).addScaledVector(CAM_UP, ndc.y * (h0 / 2) * s); }
  CAM.h = h1; CAM.user = true; CAM.fly = null;
}
function orbitBy(dx, dy) { CAM.az -= dx * 0.006; CAM.el = clamp(CAM.el + dy * 0.005, -0.4, 1.5); CAM.user = true; CAM.fly = null; }
function panBy(dx, dy) { camBasis(); const wpp = CAM.h / PIPE.h; CAM.target.addScaledVector(CAM_RIGHT, -dx * wpp).addScaledVector(CAM_UP, dy * wpp); CAM.user = true; CAM.fly = null; }
