// ============================================================================
// 70 · MAIN — boot, pointer handling, picking, the frame loop.
// ============================================================================
let camera;
const _sc = new THREE.Vector3();
const SPHERES = { jet: new THREE.Sphere(new THREE.Vector3(0, 2, 0), 26), eng: new THREE.Sphere(new THREE.Vector3(60, 1.5, 0), 9) };
const PICK = [], HI = {};
function boot() {
  try { const t = localStorage.getItem("hornet-theme"); if (t) document.documentElement.dataset.theme = t; } catch (e) {}
  readPalette();
  const canvas = $("#cv"), fig = $("#fig");
  try { PIPE.init(canvas); }
  catch (e) { fig.insertAdjacentHTML("beforeend", `<div class="nogl">This drawing needs WebGL, which this browser has turned off.</div>`); return; }
  buildHornet(); buildF404();
  buildMenuIndex();
  for (const k in MODS) for (const m of MODS[k].meshes) if (m.layers.mask === 1 && !m.userData.noBox) PICK.push(m);
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 600);
  buildUI();
  const resize = () => { const r = fig.getBoundingClientRect(); PIPE.resize(Math.max(1, Math.round(r.width)), Math.max(1, Math.round(r.height)), Math.min(window.devicePixelRatio || 1, 3)); };
  new ResizeObserver(resize).observe(fig); resize();
  const retheme = () => { readPalette(); ALL_MATS.forEach(applyRole); FX_LIST.forEach(applyFXColors); UI.sync(); };
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", retheme);
  new MutationObserver(retheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let pending = null;
  const ndcOf = (ev) => { const r = canvas.getBoundingClientRect(); return new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1); };
  const pick = (ev) => { ndc.copy(ndcOf(ev)); ray.setFromCamera(ndc, camera); return ray.intersectObjects(PICK.filter((m) => isShown(m)), false)[0]?.object || null; };
  canvas.addEventListener("pointermove", (ev) => { pending = ev; });
  const ptrs = new Map(); let dragged = 0, lastPinch = null;
  const onMove = (ev) => {
    const p = ptrs.get(ev.pointerId); if (!p) return;
    const dx = ev.clientX - p.x, dy = ev.clientY - p.y; p.x = ev.clientX; p.y = ev.clientY;
    dragged += Math.abs(dx) + Math.abs(dy);
    if (dragged < 3) return;
    ev.preventDefault();
    if (ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (lastPinch) { panBy(mx - lastPinch.x, my - lastPinch.y); if (d > 0 && lastPinch.d > 0) zoomBy(lastPinch.d / d, ndcOf({ clientX: mx, clientY: my })); }
      lastPinch = { d, x: mx, y: my }; return;
    }
    const pan = CAM.dragMode === "pan" ? !(p.shift || ev.shiftKey) : p.b === 1 || p.b === 2 || p.shift || ev.shiftKey;
    if (pan) panBy(dx, dy); else orbitBy(dx, dy);
    canvas.classList.add("dragging");
  };
  const onUp = (ev) => {
    ptrs.delete(ev.pointerId); if (ptrs.size < 2) lastPinch = null;
    if (!ptrs.size) { canvas.classList.remove("dragging"); window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); window.removeEventListener("pointercancel", onUp); }
  };
  canvas.addEventListener("pointerdown", (ev) => {
    if (!CAM.free) { if (ev.pointerType !== "touch") fig.focus({ preventScroll: true }); dragged = 0; return; }
    ev.preventDefault(); fig.focus({ preventScroll: true });
    if (!ptrs.size) { window.addEventListener("pointermove", onMove, { passive: false }); window.addEventListener("pointerup", onUp); window.addEventListener("pointercancel", onUp); }
    ptrs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY, b: ev.button, shift: ev.shiftKey });
    dragged = 0;
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; lastPinch = { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
  });
  canvas.addEventListener("dragstart", (ev) => ev.preventDefault());
  canvas.addEventListener("contextmenu", (ev) => { if (CAM.free) ev.preventDefault(); });
  canvas.addEventListener("wheel", (ev) => {
    if (!CAM.free && !ev.ctrlKey) return;
    ev.preventDefault();
    const k = ev.deltaMode === 1 ? 40 : ev.deltaMode === 2 ? 800 : 1;
    zoomBy(Math.exp(ev.deltaY * k * (ev.ctrlKey ? 0.01 : 0.0015)), ndcOf(ev));
  }, { passive: false });
  canvas.addEventListener("dblclick", () => { if (CAM.free) resetView(); });
  canvas.addEventListener("pointerleave", () => { pending = null; C.hover = null; canvas.classList.remove("can-click"); });
  canvas.addEventListener("click", (ev) => {
    if (dragged > 4) return;
    const o = pick(ev); if (!o) return;
    const id = MOD_TO_ITEM[o.userData.mod]; if (id) selectItem(id);
  });
  const doHover = () => {
    if (!pending) return;
    const o = pick(pending); pending = null;
    const key = o ? o.userData.mod : null;
    canvas.classList.toggle("can-click", !!(key && MOD_TO_ITEM[key]));
    C.hover = key;
  };
  let visible = true, last = performance.now();
  new IntersectionObserver((e) => { visible = e[0].isIntersecting; if (visible) { last = performance.now(); requestAnimationFrame(frame); } }, { threshold: 0.01 }).observe(fig);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { last = performance.now(); requestAnimationFrame(frame); } });
  function frame(now) {
    if (busy || !visible || document.hidden) return;
    const dt = clamp((now - last) / 1000, 0, 0.05); last = now;
    doHover();
    applyFrame(dt);
    frameCamera(dt);
    const sel = MENU_ITEMS[C.sel];
    for (const k in MODS) {
      const tgt = C.hover === k ? 1 : sel.id !== "whole" && sel.id !== "dF404" && sel.mods.includes(k) ? 0.3 : 0;
      HI[k] = (HI[k] || 0) + (tgt - (HI[k] || 0)) * Math.min(1, dt * 10);
      if (HI[k] < 0.002 && tgt === 0) { if (HI[k] !== 0) { HI[k] = 0; MODS[k].mats.forEach((m) => (m.uniforms.uHi.value = 0)); } continue; }
      MODS[k].mats.forEach((m) => (m.uniforms.uHi.value = HI[k]));
    }
    draw();
    UI.tick();
    requestAnimationFrame(frame);
  }
  function draw() {
    const aspect = PIPE.w / PIPE.h, h = CAM.h / 2;
    camera.top = h; camera.bottom = -h; camera.left = -h * aspect; camera.right = h * aspect;
    camBasis();
    const sph = SPHERES[sceneOf(C.sel)];
    const toC = _sc.copy(sph.center).sub(CAM.target).dot(CAM_DIR), K = toC + sph.radius + 5;
    camera.position.copy(CAM.target).addScaledVector(CAM_DIR, K);
    camera.near = 1; camera.far = 2 * sph.radius + 10;
    camera.up.set(0, 1, 0);
    camera.lookAt(_sc.copy(camera.position).sub(CAM_DIR));
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    PIPE.render(SCENE, camera);
  }
  requestAnimationFrame(frame);
  const snap = () => { C.spool = C.lever; C.pwr = C.running ? 1 : 0; C.exAmt = C.explode ? 1 : 0; C.feetNow = C.feet; C.foldAmt = C.fold ? 1 : 0; C.canopyAmt = C.canopy ? 1 : 0; C.probeAmt = C.probe ? 1 : 0; C.puffAge = 9; const n = engine(C.spool, 0); C.light = C.running && n.ab > 0 ? Math.pow(n.ab, 0.7) : 0; CAM.snap = true; };
  // ---- Stills: one frame at any size, drawn by this machine's GPU and saved as a PNG ----
  // HORNET.render({ w, h, ss, line, name, theme, cam, zoom, pan, save })   6016 × 3384 by default (6K, 16:9)
  //   ss    supersampling of geometry and ink, 1 to 2, on top of 4× MSAA and the edge-smoothing pass
  //   line  ink line weight in output pixels (by default the same share of the picture as on the page: 2 px at 6K)
  //   cam   { az, el, h, target: [x, y, z] } in degrees and metres; left out, the view frames the selected part
  //   zoom, pan  tighten the framing and slide it, pan as fractions of the picture [right, up]
  let busy = false;
  const gpuName = () => { const gl = PIPE.renderer.getContext(), e = gl.getExtension("WEBGL_debug_renderer_info"); return String(e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)); };
  async function render(o = {}) {
    if (busy) throw new Error("a still is already rendering");
    busy = true;
    const W = Math.round(o.w || 6016), H = Math.round(o.h || 3384), t0 = performance.now(), gl = PIPE.renderer.getContext();
    const keep = { insets: UI.insets, aa: PIPE.aa, theme: document.documentElement.dataset.theme, cam: { az: CAM.az, el: CAM.el, h: CAM.h, target: CAM.target.clone(), user: CAM.user, fly: CAM.fly } };
    let blob = null, err = 0, ss = 1;
    try {
      if (o.theme) { document.documentElement.dataset.theme = o.theme; retheme(); }
      if (PIPE.aa !== (o.aa !== false)) PIPE.setAA(o.aa !== false);
      PIPE.still = { ss: o.ss || 2, line: o.line || Math.max(1, W / 3000) }; UI.insets = { top: 0, bottom: 0 };       // no interface over a still: frame to the whole picture
      PIPE.resize(W, H, 1); ss = PIPE.ss;
      snap();
      for (let i = 0, n = o.settle ?? 90; i < n; i++) applyFrame(1 / 60);     // let springs, flames and smoke reach a steady state
      CAM.fly = null;
      if (o.cam) { CAM.az = o.cam.az * DEG; CAM.el = o.cam.el * DEG; CAM.user = false; }
      camBasis(); SCENE.updateMatrixWorld(true);
      const f = focusFrame(); CAM.target.copy(f.c); CAM.h = f.h; CAM.snap = false;
      if (o.cam && o.cam.h) CAM.h = o.cam.h;
      if (o.cam && o.cam.target) CAM.target.fromArray(o.cam.target);
      if (o.zoom) CAM.h /= o.zoom;
      if (o.pan) CAM.target.addScaledVector(CAM_RIGHT, -o.pan[0] * CAM.h * (W / H)).addScaledVector(CAM_UP, -o.pan[1] * CAM.h);
      for (const k in MODS) { HI[k] = 0; MODS[k].mats.forEach((m) => (m.uniforms.uHi.value = 0)); }     // no hover or selection tint in a still
      while (gl.getError());
      draw(); gl.finish();
      err = gl.getError();
      if (gl.isContextLost()) throw new Error("the GPU dropped the WebGL context at " + W + " × " + H + " × " + ss);
      blob = await new Promise((res) => canvas.toBlob(res, "image/png"));     // asked for in the same task as the draw, so the frame is still in the buffer
    } finally {
      PIPE.still = null; UI.insets = keep.insets;
      if (keep.theme) document.documentElement.dataset.theme = keep.theme; else delete document.documentElement.dataset.theme;
      if (o.theme) retheme();
      if (PIPE.aa !== keep.aa) PIPE.setAA(keep.aa);
      resize();
      Object.assign(CAM, { az: keep.cam.az, el: keep.cam.el, h: keep.cam.h, user: keep.cam.user, fly: keep.cam.fly }); CAM.target.copy(keep.cam.target);
      busy = false; last = performance.now(); requestAnimationFrame(frame);
    }
    if (!blob) throw new Error("the browser could not encode the frame");
    const name = (o.name || "hornet-" + W + "x" + H) + ".png";
    HORNET.lastStill = blob;
    if (o.save !== false) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000); }
    return { name, w: W, h: H, ss, drawnAt: [Math.round(W * ss), Math.round(H * ss)], bytes: blob.size, ms: Math.round(performance.now() - t0), glError: err, gpu: gpuName() };
  }
  // A pose is the state of every switch; a still is a pose plus a camera. HORNET.still("01-afterburner") renders one of STILLS.
  function pose(p = {}) {
    C.tour = false;
    selectItem(p.sel || "whole");
    setRunning(!!p.running); setExplode(!!p.explode);
    C.lever = p.lever ?? MIL_AT; C.feet = p.feet || 0; C.fold = !!p.fold; C.canopy = !!p.canopy; C.probe = !!p.probe; C.load = p.load || 0;
    C.fire = false; C.rounds = GUN.rounds; C.gunFeed = 0;       // a full drum, so a firing pose is always caught mid-burst
    if (p.fire) setFire(true);
    UI.sync();
  }
  async function still(id, o = {}) {
    const s = typeof id === "number" ? STILLS[id] : STILLS.find((x) => x.name === id);
    if (!s) throw new Error("no still named " + id);
    pose(s.pose);
    return render({ name: s.name, theme: s.theme, cam: s.cam, zoom: s.zoom, pan: s.pan, settle: s.settle, ...o });
  }
  window.HORNET = { fusAt, rimAt, LOADS, LIVE, setFire, C, CAM, MODS, MENU_ITEMS, selectItem, setExplode, setRunning, setLever, resetView, zoomBy, orbitBy, snap, render, pose, still, STILLS, gpu: gpuName };
  // ---- Film: the same drawing, one frame at a time. A director script (film/director.js) poses the aircraft, steps the
  // animation by exactly one frame's worth of time, places the camera and takes the canvas; nothing depends on the wall clock.
  const film = {
    on: false, keep: null,
    begin(o = {}) {
      if (busy) throw new Error("busy");
      busy = true; this.on = true;
      this.keep = { insets: UI.insets, aa: PIPE.aa, theme: document.documentElement.dataset.theme, cam: { az: CAM.az, el: CAM.el, h: CAM.h, target: CAM.target.clone(), user: CAM.user, fly: CAM.fly } };
      UI.insets = { top: 0, bottom: 0 };
      if (PIPE.aa !== (o.aa !== false)) PIPE.setAA(o.aa !== false);
      PIPE.still = { ss: o.ss || 2, line: o.line || Math.max(1, (o.w || 3840) / 3000) };
      PIPE.resize(Math.round(o.w || 3840), Math.round(o.h || 2160), 1);
      CAM.fly = null; CAM.user = true;
      return { w: PIPE.cw, h: PIPE.ch, ss: PIPE.ss, gpu: gpuName() };
    },
    theme(t) { if (document.documentElement.dataset.theme !== t) { document.documentElement.dataset.theme = t; retheme(); } },
    pose(p) { pose(p); snap(); applyFrame(1e-6); CAM.snap = false; CAM.user = true; },     // one tiny step puts every part where the pose says
    step(dt) { applyFrame(dt); },
    // where the camera would sit to frame the selected part from this angle: { c: [x, y, z], h }
    focus(az, el) { CAM.az = az * DEG; CAM.el = el * DEG; camBasis(); SCENE.updateMatrixWorld(true); const f = focusFrame(); return { c: f.c.toArray(), h: f.h }; },
    frame(cam) {
      CAM.az = cam.az * DEG; CAM.el = cam.el * DEG; CAM.h = cam.h; CAM.target.fromArray(cam.c);
      for (const k in MODS) { if (HI[k]) { HI[k] = 0; MODS[k].mats.forEach((m) => (m.uniforms.uHi.value = 0)); } }
      draw();
      return canvas;
    },
    end() {
      const k = this.keep; if (!k) return;
      PIPE.still = null; UI.insets = k.insets;
      if (k.theme) document.documentElement.dataset.theme = k.theme; else delete document.documentElement.dataset.theme;
      retheme();
      if (PIPE.aa !== k.aa) PIPE.setAA(k.aa);
      resize();
      Object.assign(CAM, { az: k.cam.az, el: k.cam.el, h: k.cam.h, user: k.cam.user, fly: k.cam.fly }); CAM.target.copy(k.cam.target);
      this.on = false; this.keep = null; busy = false; last = performance.now(); requestAnimationFrame(frame);
    },
  };
  HORNET.film = film;
  // Opened as …/?relay by another window, the page renders stills on request and hands each PNG straight back to that window
  // (postMessage), so finished renders can go from this GPU to an upload form without touching the disk. Only GitHub and this site may ask.
  if (/[?&]relay\b/.test(location.search) && window.opener) {
    const ok = (o) => o === "https://github.com" || o === location.origin;
    addEventListener("message", async (e) => {
      if (!ok(e.origin) || !e.data || e.data.hornet !== "still") return;
      try { const info = await still(e.data.name, { ...(e.data.opts || {}), save: false }); e.source.postMessage({ hornet: "done", info, blob: HORNET.lastStill }, e.origin); }
      catch (err) { e.source.postMessage({ hornet: "error", name: e.data.name, message: String((err && err.message) || err) }, e.origin); }
    });
    for (const o of ["https://github.com", location.origin]) try { window.opener.postMessage({ hornet: "ready", stills: STILLS.map((x) => x.name), gpu: gpuName() }, o); } catch (e) {}
  }
}
boot();
