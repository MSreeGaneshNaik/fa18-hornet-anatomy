// ============================================================================
// FILM — a 45-second cut of the drawing, made by the page itself.
// Every frame is drawn on this machine's GPU (the WebGL drawing, plus vector type on a 2D canvas), handed to the browser's
// hardware H.264 encoder and muxed to an MP4 with the soundtrack. Nothing is rendered anywhere else.
//
//   await FILM.run({ audio })                    3840 × 2160 at 60 fps → FILM.result.blob (video/mp4)
//   await FILM.run({ w: 960, h: 540, ss: 1, aa: false, encode: false, only: [0, 60, 200] })   stills of chosen frames
//
// The cut is locked to the soundtrack, 134 beats a minute: an eight-bar build, the drop, fifteen bars at full power,
// the track's own ending, then the title held in silence. Times below are in seconds of film.
// ============================================================================
const H = window.HORNET, F = H.film;
const DEG = Math.PI / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v)), lerp = (a, b, t) => a + (b - a) * t;
const outQuart = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 4), outCubic = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3), inOut = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };

const P = 60 / 134, BAR = 4 * P, DUR = 45;
const DROP = 8 * BAR, RIDE_END = DROP + 15 * BAR, FINAL = RIDE_END + 2.0625;
const lb = (n) => n * BAR, rb = (n) => DROP + n * BAR, k = (n) => DROP - n * P;          // bars of the build, bars of the ride, beats before the drop
// where the soundtrack hits during the build (beats before the drop) and the ending (seconds after the ride)
const BUILD_HITS = [k(14), k(12), k(10), k(8), k(7), k(5), k(3), k(2.5), k(2), k(1.37), k(1), k(0.52), k(0.28)];
const STABS = [0, 0.28, 0.486, 0.705, 0.872, 1.385, 1.664, 1.78].map((s) => RIDE_END + s);
// the soundtrack as an edit of the full track: [seconds into the track, length], laid end to end. Track times are measured
// against the drop, which the page finds for itself (decoders disagree by a few milliseconds about where an MP3 starts).
const TRACK_DROP = 58.659, EDIT = [[TRACK_DROP - 32 * P, 23 * BAR], [TRACK_DROP + 316 * P, 2.32]];
const INK = { dark: "#eef1f4", light: "#14171a" }, GROUND = { dark: "#14171a", light: "#f6f6f3" };

// ---- type: a headline lands on the beat as a solid label — ink-coloured tape, ground-coloured letters — so it reads over any
// picture. It arrives a touch large and settles; the line under it follows a moment later on tape of the ground colour. ----
const FACE = "Archivo, system-ui, sans-serif";
function fitFont(g, text, weight, maxW, maxPx) { let px = maxPx; g.font = `${weight} ${px}px ${FACE}`; const w = g.measureText(text).width; if (w > maxW) px = Math.floor((px * maxW) / w); return px; }
function drawTitle(g, W, HH, o, age, theme) {
  if (age < 0) return;
  const u = HH / 2160, M = 0.052 * W, base = HH - 0.1 * HH, a = clamp(age / 0.045, 0, 1), sc = 1 + 0.07 * Math.exp(-age * 26);
  const ink = theme === "void" ? INK.dark : INK[theme], ground = theme === "void" ? "#000000" : GROUND[theme];
  const small = o.small ? Math.round(74 * u) : 0, px = fitFont(g, o.big, 900, (o.maxW || 0.64) * W, (o.px || 224) * u);
  const padX = 0.17 * px, up = 0.86 * px, down = 0.16 * px, yBig = base - (small ? small * 1.75 + 0.2 * px : 0);
  g.save();
  g.textBaseline = "alphabetic"; g.textAlign = "left"; g.globalAlpha = a;
  g.font = `900 ${px}px ${FACE}`; g.letterSpacing = `${(-0.022 * px).toFixed(1)}px`;
  const wBig = g.measureText(o.big).width;
  g.translate(M, yBig); g.scale(sc, sc);
  g.fillStyle = ink; g.fillRect(0, -up, wBig + 2 * padX, up + down);
  g.fillStyle = ground; g.fillText(o.big, padX, 0);
  g.restore();
  if (o.small) {
    const a2 = clamp((age - 0.08) / 0.08, 0, 1); if (a2 <= 0) return;
    g.save(); g.textBaseline = "alphabetic"; g.globalAlpha = a2;
    g.font = `600 ${small}px ${FACE}`; g.letterSpacing = "0px";
    const w2 = g.measureText(o.small).width, pad = 0.34 * small, y = yBig + down + small * 1.34;
    g.fillStyle = ground; g.fillRect(M, y - small * 0.98, w2 + 2 * pad, small * 1.42);
    g.fillStyle = ink; g.fillText(o.small, M + pad, y);
    g.restore();
  }
}
// what is written, and when. A title holds until its `to`.
const TITLES = [
  { at: lb(1), to: lb(2), big: "NO HANGAR.", theme: "void" },
  { at: lb(2), to: lb(3), big: "NO CLEARANCE.", theme: "void" },
  { at: lb(3), to: lb(4), big: "NO BUDGET.", theme: "void" },
  { at: lb(4), to: lb(6), big: "ONE HTML FILE.", theme: "void" },
  { at: lb(6), to: k(3), big: "300 KILOBYTES.", theme: "void" },
  { at: rb(0) + P, to: rb(2), big: "THE F/A-18 HORNET", small: "Every part drawn in code. No model files.", theme: "dark" },
  { at: rb(2), to: rb(4), big: "32,000 LBF", small: "Two F404-GE-400s, idle to full afterburner.", theme: "dark" },
  { at: rb(4), to: rb(6), big: "EVERY PART COMES APART", small: "Skin, tanks, gear, radar, both engines.", theme: "light" },
  { at: rb(6), to: rb(7), big: "RADAR UNDER THE RADOME", theme: "light" },
  { at: rb(7), to: rb(8), big: "A COCKPIT THAT OPENS", theme: "light" },
  { at: rb(8), to: rb(10), big: "6,000 ROUNDS A MINUTE", small: "M61A1 cannon, 578 in the drum.", theme: "dark" },
  { at: rb(10), to: rb(11), big: "WINGS FOLD. PROBE EXTENDS.", theme: "light" },
  { at: rb(11), to: rb(12), big: "FIVE WEAPON LOADS", theme: "light" },
  { at: rb(12), to: rb(14), big: "THE ENGINE, MODULE BY MODULE", small: "Fan to nozzle, every stage of the F404.", theme: "light" },
  { at: rb(14), to: rb(15), big: "AND IT RUNS.", theme: "dark" },
  { at: FINAL, to: DUR + 1, big: "F/A-18 HORNET ANATOMY", small: "msreeganeshnaik.github.io/fa18-hornet-anatomy", px: 210, maxW: 0.7, theme: "dark" },
];

// ---- cameras ----
const basis = (az, el) => { const a = az * DEG, e = el * DEG, d = [Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)]; const r = [d[2], 0, -d[0]], rl = Math.hypot(r[0], r[2]) || 1; r[0] /= rl; r[2] /= rl; const up = [d[1] * r[2] - d[2] * r[1], d[2] * r[0] - d[0] * r[2], d[0] * r[1] - d[1] * r[0]]; return { r, up }; };
function framed(view, aspect) {        // the camera that frames the current selection from view.az, view.el, tightened and slid like a still
  const f = F.focus(view.az, view.el), h = f.h / (view.zoom || 1), { r, up } = basis(view.az, view.el), px = (view.pan || [0, 0])[0] * h * aspect, py = (view.pan || [0, 0])[1] * h;
  return { az: view.az, el: view.el, h, c: [f.c[0] - r[0] * px - up[0] * py, f.c[1] - r[1] * px - up[1] * py, f.c[2] - r[2] * px - up[2] * py] };
}
// the two drawings the film opens on, set by hand in pixels per metre on a 2160-high frame, so the plan can hand over to the aircraft exactly
const SIDE = { s: 168, at: 0.44, cx: -0.05, cy: 2.25 }, TOP = { s: 120, at: 0.455, cx: -0.05, cz: 0 };
const sideCam = (zoom = 1) => ({ az: 0, el: 0, h: 2160 / SIDE.s / zoom, c: [SIDE.cx, SIDE.cy + ((SIDE.at - 0.5) * 2160) / SIDE.s / zoom, 0] });
const planCam = (zoom = 1) => ({ az: 0, el: 89.9, h: 2160 / TOP.s / zoom, c: [TOP.cx, 1.8, TOP.cz + ((0.5 - TOP.at) * 2160) / TOP.s / zoom] });

// ---- the shots. look "lines": the same drawing with its fills crushed to black, so only the ink is left, on a black ground.
// pose: every switch, settled, and what the camera frames. start: what is then wound back, so the shot plays the change.
// each: what moves during the shot. view + drift: the framing and its slow move; cam: a camera written out by hand. ----
const OFF = { sel: "whole" }, BURNER = { sel: "whole", running: true, lever: 1 };
const SHOTS = [
  // the build: bare line drawings and a claim
  { t0: 0, t1: lb(2), look: "lines", pose: OFF, cam: (t) => sideCam(1 + 0.03 * (t / lb(2))), reveal: (t) => outCubic(t / 1.55) },
  { t0: lb(2), t1: lb(3), look: "lines", pose: OFF, cam: (t) => planCam(0.86 + 0.03 * ((t - lb(2)) / BAR)), reveal: (t) => outCubic((t - lb(2)) / 0.3) },
  { t0: lb(3), t1: lb(4), look: "lines", pose: OFF, view: { az: 90, el: 0, zoom: 1.5, pan: [0, 0.1] }, drift: { zoom: 0.04 }, reveal: (t) => outCubic((t - lb(3)) / 0.3) },
  { t0: lb(4), t1: k(14), look: "lines", pose: OFF, view: { az: 42, el: 18, zoom: 1.35, pan: [0, 0.08] }, drift: { az: -5 } },
  { t0: k(14), t1: k(12), look: "lines", pose: { sel: "pit" }, view: { az: 58, el: 24, zoom: 0.8, pan: [0, 0.1] }, drift: { zoom: 0.05 } },
  { t0: k(12), t1: k(10), look: "lines", pose: { sel: "engs" }, view: { az: -66, el: 14, zoom: 0.62, pan: [0, 0.08] }, drift: { zoom: 0.05 } },
  { t0: k(10), t1: k(8), look: "lines", pose: { sel: "wings" }, view: { az: -30, el: 52, zoom: 1.02, pan: [0, 0.06] }, drift: { az: 4 } },
  { t0: k(8), t1: k(7), look: "lines", pose: { sel: "nose" }, view: { az: 40, el: 14, zoom: 0.5, pan: [0, 0.1] } },
  { t0: k(7), t1: k(5), look: "lines", pose: { sel: "legs" }, view: { az: 28, el: 6, zoom: 0.75, pan: [0, 0.12] }, drift: { zoom: 0.05 } },
  { t0: k(5), t1: k(3), look: "lines", pose: { sel: "tail" }, view: { az: -58, el: 20, zoom: 0.9, pan: [0, 0.08] }, drift: { zoom: 0.05 } },
  { t0: k(3), t1: DROP, look: "lines", pose: OFF, cam: (t) => planCam(lerp(0.9, 1, inOut((t - k(3)) / (3 * P)))) },     // the plan pushes in to exactly where the aircraft will stand up
  // the drop: the drawing stands up and lights both engines
  { t0: rb(0), t1: rb(2), theme: "dark", pose: BURNER, view: { az: -52, el: 21, zoom: 1.24, pan: [0.02, 0.08] }, drift: { az: 9, zoom: 0.05 }, whip: 0.7 },
  { t0: rb(2), t1: rb(3), theme: "dark", pose: { sel: "engs", running: true, lever: 1 }, start: (C) => { C.lever = C.spool = 0.06; C.light = 0; }, each: (C, s) => { C.lever = C.spool = lerp(0.06, 1, inOut(s / 1.3)); }, view: { az: -68, el: 14, zoom: 0.7, pan: [0, 0.06] }, drift: { az: 4, zoom: 0.08 } },
  { t0: rb(3), t1: rb(4), theme: "dark", pose: BURNER, view: { az: 6, el: 4, zoom: 1.25, pan: [-0.04, 0.14] }, drift: { az: -4, zoom: 0.04 } },
  { t0: rb(4), t1: rb(6), theme: "light", pose: { sel: "whole", explode: true }, start: (C) => { C.exAmt = 0; }, view: { az: -52, el: 27, zoom: 1.42, pan: [0.02, 0.07] }, drift: { az: 10, zoom: -0.03 } },
  { t0: rb(6), t1: rb(7), theme: "light", pose: { sel: "nose", explode: true }, start: (C) => { C.exAmt = 0.25; }, view: { az: 50, el: 18, zoom: 0.52, pan: [0, 0.1] }, drift: { az: -5, zoom: 0.05 } },
  { t0: rb(7), t1: rb(8), theme: "light", pose: { sel: "pit", canopy: true }, start: (C) => { C.canopyAmt = 0; }, view: { az: 58, el: 26, zoom: 0.8, pan: [-0.03, 0.12] }, drift: { az: -6, zoom: 0.05 } },
  { t0: rb(8), t1: rb(10), theme: "dark", pose: { sel: "whole", explode: true, fire: true }, pre: 1.3, view: { az: 38, el: 16, zoom: 0.6, pan: [0.04, 0.12] }, drift: { az: -7, zoom: 0.1 } },
  { t0: rb(10), t1: rb(11), theme: "light", pose: { sel: "whole", fold: true, probe: true, canopy: true }, start: (C) => { C.foldAmt = 0; C.probeAmt = 0; C.canopyAmt = 0.3; }, view: { az: 128, el: 18, zoom: 1.2, pan: [0, 0.07] }, drift: { az: 6, zoom: 0.03 } },
  { t0: rb(11), t1: rb(12), theme: "light", pose: { sel: "arms", load: 0 }, each: (C, s) => { C.load = [0, 1, 3, 4][Math.min(3, Math.floor(s / P + 1e-6))]; }, view: { az: 62, el: 10, zoom: 0.85, pan: [0, 0.1] }, drift: { az: -5, zoom: 0.04 } },
  { t0: rb(12), t1: rb(14), theme: "light", pose: { sel: "dF404", explode: true }, start: (C) => { C.exAmt = 0; }, view: { az: -24, el: 20, zoom: 1.1, pan: [0, 0.1] }, drift: { az: 9, zoom: -0.03 } },
  { t0: rb(14), t1: rb(15), theme: "dark", pose: { sel: "dF404", running: true, lever: 1 }, view: { az: -30, el: 14, zoom: 1.1, pan: [0.08, 0.1] }, drift: { az: 5, zoom: 0.05 } },
  // the track's ending: one aircraft at full power, a new angle on every stab
  { t0: RIDE_END, t1: FINAL, theme: "dark", pose: BURNER, cuts: STABS, views: [{ az: -52, el: 21, zoom: 1.5 }, { az: 0, el: 89.9, zoom: 1.3 }, { az: -84, el: 9, zoom: 2.3, pan: [0, -0.05] }, { az: 0, el: 3, zoom: 1.35 }, { az: 128, el: 22, zoom: 1.5 }, { az: -30, el: 56, zoom: 1.4 }, { az: 24, el: 10, zoom: 2.1, pan: [-0.2, 0] }, { az: -52, el: 21, zoom: 1.9 }] },
  // the last stab cuts the engines; the title holds while they spool down in silence
  { t0: FINAL, t1: DUR + 1, theme: "dark", pose: { sel: "whole", running: false }, frameOn: BURNER, start: (C) => { C.spool = 1; C.pwr = 1; C.light = 1; }, view: { az: 9, el: 5, zoom: 1.22, pan: [-0.05, 0.15] }, drift: { az: -3, zoom: 0.03 } },
];

function setup(shot, aspect, fps) {
  F.theme(shot.theme || "dark");
  if (shot.frameOn) F.pose(shot.frameOn);                            // frame on one pose, play another
  else F.pose(shot.pose);
  if (shot.view) shot.base = framed(shot.view, aspect);              // framed on the settled pose, so the picture holds whatever is still moving
  if (shot.views) shot.bases = shot.views.map((v) => framed(v, aspect));
  if (shot.frameOn) F.pose(shot.pose);
  if (shot.start) shot.start(H.C);
  for (let i = 0, n = Math.round((shot.pre || 0) * fps); i < n; i++) F.step(1 / fps);
}
function camOf(shot, t) {
  if (shot.cam) return shot.cam(t);
  if (shot.cuts) { let i = 0; while (i + 1 < shot.cuts.length && t >= shot.cuts[i + 1] - 1e-6) i++; const b = shot.bases[i], s = t - shot.cuts[i]; return { ...b, h: (b.h / (1 + 0.5 * s)) * (1 + 0.05 * Math.exp(-s * 30)) }; }
  const u = (t - shot.t0) / (Math.min(shot.t1, DUR) - shot.t0), b = shot.base, d = shot.drift || {}, punch = 1 + 0.035 * Math.exp(-(t - shot.t0) * 22);
  const end = { az: b.az + (d.az || 0) * u, el: b.el + (d.el || 0) * u, h: (b.h / (1 + (d.zoom || 0) * u)) * punch, c: b.c };
  if (!shot.whip) return end;
  const e = outQuart((t - shot.t0) / shot.whip), p = planCam(1);                 // from straight above, round to the hero angle
  return { az: lerp(p.az, end.az, e), el: lerp(p.el, end.el, e), h: lerp(p.h, end.h, e), c: [0, 1, 2].map((i) => lerp(p.c[i], end.c[i], e)) };
}
const pulse = (t, list, rate) => { let v = 0; for (const h of list) if (t >= h) v = Math.max(v, Math.exp(-(t - h) * rate)); return v; };

// ---- one frame ----
function frame(g, W, HH, t, st, fps, draw) {
  const shot = SHOTS.find((s) => t >= s.t0 - 1e-6 && t < s.t1 - 1e-6) || SHOTS[SHOTS.length - 1];
  if (st.shot !== shot) { st.shot = shot; setup(shot, W / HH, fps); }
  if (shot.each) shot.each(H.C, t - shot.t0);
  F.step(1 / fps);
  if (!draw) return;                                   // a frame nobody asked for still moves the animation on
  const cam = camOf(shot, t), L = FILM.look;
  F.line(shot.look === "lines" ? (L.line * W) / 3840 : st.line);      // the bare drawing is inked heavier than the shaded one
  if (shot.look === "lines") {
    H.MODS.deck.group.visible = false;
    const cv = F.frame(cam), reveal = shot.reveal ? shot.reveal(t) : 1, gain = L.gain * (1 + L.pulse * Math.max(pulse(t, BUILD_HITS, 9), pulse(t, [lb(1), lb(2), lb(3), lb(4), lb(6)], 8)));
    g.fillStyle = "#000000"; g.fillRect(0, 0, W, HH);
    g.save();
    if (reveal < 1) { g.beginPath(); g.rect(0, 0, W * reveal, HH); g.clip(); }
    g.filter = `brightness(${gain.toFixed(3)}) contrast(${L.contrast})`;      // fills fall to black, ink stays: a line drawing
    g.drawImage(cv, 0, 0, W, HH);
    g.restore();
  } else g.drawImage(F.frame(cam), 0, 0, W, HH);
  for (const ti of TITLES) if (t >= ti.at - 1e-6 && t < ti.to - 1e-6) drawTitle(g, W, HH, ti, t - ti.at, ti.theme);
  const white = (a) => { g.save(); g.globalAlpha = a; g.fillStyle = "#ffffff"; g.fillRect(0, 0, W, HH); g.restore(); };
  const f = t - DROP; if (f >= 0 && f < 0.15) white(0.92 * Math.pow(1 - f / 0.15, 2));           // the drop: one white frame, gone in a tenth of a second
  for (const s of SHOTS) { const c = t - s.t0; if (s.t0 > DROP + 0.01 && c >= 0 && c < 0.07) white(0.2 * (1 - c / 0.07)); }
  const e = t - FINAL; if (e >= 0 && e < 0.12) white(0.6 * Math.pow(1 - e / 0.12, 2));
}

// ---- the soundtrack: the track cut to the film, with soft impacts under the drop and the big cuts (Kenney, CC0), mixed here ----
const SFX_FILES = /*SFX*/{}/*SFX*/;
const HITS = [[DROP, "heavy", 0.3], [rb(4), "medium", 0.2], [rb(8), "medium", 0.2], [rb(12), "medium", 0.2], [FINAL, "heavy", 0.26]];
function findDrop(buf) {               // the drop is where the level first doubles, within a tenth of a second of where it should be
  const sr = buf.sampleRate, a = buf.getChannelData(0), b = buf.numberOfChannels > 1 ? buf.getChannelData(1) : a, w = Math.round(sr * 0.002);
  const level = (t) => { const i = Math.round(t * sr); let e = 0; for (let j = 0; j < w; j++) { const v = (a[i + j] + b[i + j]) / 2; e += v * v; } return Math.sqrt(e / w); };
  if ((TRACK_DROP + 0.2) * sr >= a.length) return TRACK_DROP;
  const before = []; for (let t = TRACK_DROP - 0.14; t < TRACK_DROP - 0.05; t += 0.002) before.push(level(t));
  before.sort((x, y) => x - y); const quiet = before[Math.floor(before.length * 0.6)];
  for (let t = TRACK_DROP - 0.05; t < TRACK_DROP + 0.08; t += 0.001) if (level(t) > 2.1 * quiet && level(t + 0.004) > 2.1 * quiet) return t + 0.001;
  return TRACK_DROP;
}
async function mixAudio(file) {
  const n = Math.round(DUR * 48000), ac = new OfflineAudioContext(2, n, 48000), bytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
  const music = await ac.decodeAudioData(file.slice(0)), fx = {};
  for (const key in SFX_FILES) fx[key] = await ac.decodeAudioData(bytes(SFX_FILES[key]));
  const whole = music.duration > 60, off = whole ? findDrop(music) - TRACK_DROP : 0, X = 0.008;
  const piece = (buf, at, from, len, fadeIn, fadeOut) => {          // a length of the track laid at `at`, with short ramps so the joins make no click
    const src = ac.createBufferSource(), gn = ac.createGain(), lead = Math.min(fadeIn, at); src.buffer = buf; src.connect(gn).connect(ac.destination);
    gn.gain.setValueAtTime(0, at - lead); gn.gain.linearRampToValueAtTime(1, at - lead + fadeIn);
    gn.gain.setValueAtTime(1, at + len - fadeOut); gn.gain.linearRampToValueAtTime(0, at + len + fadeOut);
    src.start(at - lead, from - lead, len + lead + fadeOut);
  };
  const hit = (buf, at, gain) => { const src = ac.createBufferSource(), gn = ac.createGain(); src.buffer = buf; gn.gain.value = gain; src.connect(gn).connect(ac.destination); src.start(at); };
  if (whole) { let at = 0; EDIT.forEach(([from, len], i) => { piece(music, at, from + off, len, i ? X : 0.03, X); at += len; }); }
  else hit(music, 0, 1);                                           // a track that is already cut to length plays as it is
  for (const [at, key, gain] of HITS) if (fx[key]) hit(fx[key], Math.max(0, at - 0.004), gain);
  const out = await ac.startRendering(), L = out.getChannelData(0), R = out.getChannelData(1);
  let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const gainDown = peak > 0.97 ? 0.97 / peak : 1;
  if (gainDown < 1) for (let i = 0; i < n; i++) { L[i] *= gainDown; R[i] *= gainDown; }
  return { L, R, n, peak, trackSeconds: music.duration, dropFoundAt: whole ? off + TRACK_DROP : null, offsetMs: Math.round(off * 1000) };
}
const tick = () => new Promise((r) => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });   // yields without a timer: timers stall in a background window

// ---- the run ----
const FILM = (window.FILM = { look: { line: 3, gain: 1.15, pulse: 0.45, contrast: 2.2 }, result: null, stills: {}, status: "idle", progress: 0, SHOTS, TITLES, DROP, RIDE_END, FINAL, DUR, mix: mixAudio });
const say = (s) => { FILM.status = s; const el = document.getElementById("filmStatus"); if (el) el.textContent = s; };
FILM.run = async function (o = {}) {
  const W = o.w || 3840, HH = o.h || 2160, fps = o.fps || 60, N = Math.round(DUR * fps), encode = o.encode !== false, t00 = performance.now();
  await document.fonts.load(`900 200px Archivo`); await document.fonts.load(`600 60px Archivo`); await document.fonts.ready;
  const comp = document.createElement("canvas"); comp.width = W; comp.height = HH;
  const g = comp.getContext("2d", { alpha: false }); g.imageSmoothingQuality = "high";
  const info = F.begin({ w: W, h: HH, ss: o.ss || 2, aa: o.aa, line: o.line });
  let enc = null, mux = null, target = null, encErr = null, audioInfo = null, chunks = 0;
  try {
    if (encode) {
      const { Muxer, ArrayBufferTarget } = await import("https://cdn.jsdelivr.net/npm/mp4-muxer@5.2.2/+esm");
      say("mixing the soundtrack");
      const mix = o.audio ? await mixAudio(o.audio) : null;
      target = new ArrayBufferTarget();
      mux = new Muxer({ target, fastStart: "in-memory", firstTimestampBehavior: "offset", video: { codec: "avc", width: W, height: HH, frameRate: fps }, ...(mix ? { audio: { codec: "aac", numberOfChannels: 2, sampleRate: 48000 } } : {}) });
      const cfg = { codec: o.codec || "avc1.640034", width: W, height: HH, bitrate: o.bitrate || 60e6, framerate: fps, hardwareAcceleration: "prefer-hardware", latencyMode: "quality", avc: { format: "avc" } };
      const sup = await VideoEncoder.isConfigSupported(cfg); if (!sup.supported) throw new Error("this browser cannot encode " + cfg.codec + " at " + W + " × " + HH);
      enc = new VideoEncoder({ output: (chunk, meta) => { chunks++; mux.addVideoChunk(chunk, meta); }, error: (e) => { encErr = e; } });
      enc.configure(cfg);
      if (mix) {
        const aenc = new AudioEncoder({ output: (chunk, meta) => mux.addAudioChunk(chunk, meta), error: (e) => { encErr = e; } });
        aenc.configure({ codec: "mp4a.40.2", numberOfChannels: 2, sampleRate: 48000, bitrate: 256000 });
        // An AAC encoder puts its own run-in at the head of the stream (2,112 samples here, measured on the finished file) and
        // players play it, which would leave every hit 44 ms behind the picture. So the sound is fed that much early.
        const lead = o.priming ?? 2112, total = mix.n - lead;
        for (let at = 0, step = 48000; at < total; at += step) {           // a second at a time
          const n = Math.min(step, total - at), planar = new Float32Array(2 * n); planar.set(mix.L.subarray(lead + at, lead + at + n), 0); planar.set(mix.R.subarray(lead + at, lead + at + n), n);
          const ad = new AudioData({ format: "f32-planar", sampleRate: 48000, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((at / 48000) * 1e6), data: planar });
          aenc.encode(ad); ad.close();
        }
        await aenc.flush(); aenc.close();
        audioInfo = { trackSeconds: +mix.trackSeconds.toFixed(2), peak: +mix.peak.toFixed(3), dropFoundAt: mix.dropFoundAt, offsetMs: mix.offsetMs, impacts: HITS.length };
      }
    }
    // the poster: the title card with both engines lit. It is also the film's first frame, so every thumbnail shows it.
    const st = { shot: null, line: o.line || Math.max(1, W / 3000) }, end = SHOTS[SHOTS.length - 1], card = TITLES[TITLES.length - 1];
    F.theme("dark"); F.pose(BURNER); end.base = framed(end.view, W / HH); for (let i = 0; i < Math.round(0.4 * fps); i++) F.step(1 / fps);
    g.drawImage(F.frame({ ...end.base }), 0, 0, W, HH); drawTitle(g, W, HH, card, 1, "dark");
    const poster = await createImageBitmap(comp);
    FILM.poster = await new Promise((r) => comp.toBlob(r, "image/png"));
    const only = o.only ? new Set(o.only) : null, last = only ? Math.max(...only) : N - 1;
    for (let f = 0; f <= last; f++) {
      const t = f / fps, want = !only || only.has(f);
      if (f === 0) { frame(g, W, HH, t, st, fps, false); g.drawImage(poster, 0, 0); }
      else frame(g, W, HH, t, st, fps, want);
      if (enc) {
        if (encErr) throw encErr;
        const vf = new VideoFrame(comp, { timestamp: Math.round((f * 1e6) / fps), duration: Math.round(1e6 / fps) });
        enc.encode(vf, { keyFrame: f % fps === 0 }); vf.close();
        while (enc.encodeQueueSize > 3) await tick();
      }
      if (only && want) FILM.stills[f] = await new Promise((r) => comp.toBlob(r, "image/jpeg", 0.9));
      FILM.progress = (f + 1) / (last + 1);
      if (f % 10 === 0) { say(`frame ${f + 1} of ${last + 1}`); await tick(); }
    }
    if (enc) {
      say("finishing the file");
      await enc.flush(); enc.close(); if (encErr) throw encErr;
      mux.finalize();
      const blob = new Blob([target.buffer], { type: "video/mp4" });
      FILM.result = { blob, url: URL.createObjectURL(blob), bytes: blob.size, frames: N, encoded: chunks, fps, w: W, h: HH, drawnAt: [Math.round(W * info.ss), Math.round(HH * info.ss)], seconds: DUR, ms: Math.round(performance.now() - t00), gpu: info.gpu, audio: audioInfo };
      for (const [id, name, url] of [["filmSave", "fa18-hornet-anatomy-4k.mp4", FILM.result.url], ["filmPoster", "fa18-hornet-anatomy-poster.png", URL.createObjectURL(FILM.poster)]]) { const a = document.getElementById(id); if (a) { a.href = url; a.download = name; a.hidden = false; } }
      say(`done: ${(blob.size / 1e6).toFixed(1)} MB in ${Math.round((performance.now() - t00) / 1000)} s`);
      const { blob: _b, ...summary } = FILM.result; return summary;
    }
    say("stills done"); return { stills: Object.keys(FILM.stills).length, w: W, h: HH, ms: Math.round(performance.now() - t00), gpu: info.gpu };
  } catch (e) { say("failed: " + ((e && e.message) || e)); FILM.error = String((e && e.stack) || e); throw e; } finally { F.end(); }
};
// the panel: choose the soundtrack, render, save
const audioIn = document.getElementById("filmAudio"), go = document.getElementById("filmGo");
if (audioIn) audioIn.addEventListener("change", async () => { const f = audioIn.files[0]; if (f) { FILM.audio = await f.arrayBuffer(); FILM.audioName = f.name; say(`soundtrack: ${f.name}, ${(f.size / 1e6).toFixed(2)} MB`); } });
if (go) go.addEventListener("click", () => { go.disabled = true; FILM.run({ audio: FILM.audio }).catch(() => {}).finally(() => { go.disabled = false; }); });
