// Shared bits the kit expects from the host app.
const DS = THREE.DoubleSide;
const T = {};
function stripesTex(cols, a = 0.45, lw = 1.4, w = 1024, h = 512, extra) {
  return TEX(w, h, (P) => { for (let i = 0; i < cols; i++) P.vline((i + 0.5) / cols, a, lw); if (extra) extra(P); });
}
// The drawing's line work, redrawn from its traced polylines as a distance field: each texel holds how far it is from the nearest
// line (6 texels = black, on the line = white). The skin shader turns that back into hairlines with a sharp edge at any zoom.
// Built the same way as every line texture (see TEX): stroked at twelve widths, widest first, each a step brighter.
const SDF_R = 6;   // also written into the skin shader in 20-render.js
function bpTex(V) {
  const bin = atob(V.d), byWeight = new Map();
  let i = 0;
  const rd = () => { let r = 0, sh = 0, b; do { b = bin.charCodeAt(i++); r |= (b & 127) << sh; sh += 7; } while (b & 128); return r; }, unzig = (v) => (v >>> 1) ^ -(v & 1);
  while (i < bin.length) {
    const n = rd(), wt = rd();
    let p = byWeight.get(wt); if (!p) byWeight.set(wt, (p = new Path2D()));
    let x = 0, y = 0;
    const q = [];
    for (let k = 0; k < n; k++) { x += unzig(rd()); y += unzig(rd()); q.push(x / 2, y / 2); }
    p.moveTo(q[0], q[1]);
    if (n === 1) p.lineTo(q[0] + 0.01, q[1]);                           // a lone point: a dot
    else if (n === 2) p.lineTo(q[2], q[3]);
    else {                                                             // a smooth curve: each point pulls the line toward it, the line passes through the midpoints
      for (let k = 1; k < n - 2; k++) p.quadraticCurveTo(q[2 * k], q[2 * k + 1], (q[2 * k] + q[2 * k + 2]) / 2, (q[2 * k + 1] + q[2 * k + 3]) / 2);
      p.quadraticCurveTo(q[2 * n - 4], q[2 * n - 3], q[2 * n - 2], q[2 * n - 1]);
    }
  }
  let wdt = 2 * SDF_R;
  return TEX(V.w, V.h, (P) => {                                          // TEX calls this once per width, widest first
    const g = P.g; g.lineCap = g.lineJoin = "round";
    g.strokeStyle = `rgb(0,${Math.round(255 * (1 - (wdt / 2 - 0.25) / SDF_R))},0)`;
    for (const [wt, p] of byWeight) { g.lineWidth = wdt + Math.min(wt, 4) * 0.22; g.stroke(p); }   // the drawing's heavier lines stay slightly heavier
    wdt--;
  }, { wrap: false });
}
// kind "side": looked at from the side (station, height). kind "top": looked at from above (station, half-width, starboard positive).
// dx, dz: where the geometry's origin sits in the aircraft, for parts built in a moved group.
function projUV(geo, kind, dx = 0, dz = 0) {
  const V = BP[kind], p = geo.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const st = 8.5 - (p.getX(i) + dx);
    if (kind === "side") { uv[2 * i] = (V.ox - V.k * st - V.x0) / V.w; uv[2 * i + 1] = 1 - (V.oy - V.k * p.getY(i) - V.y0) / V.h; }
    else { uv[2 * i] = (V.ox + V.k * st - V.x0) / V.w; uv[2 * i + 1] = 1 - (V.oy - V.k * (p.getZ(i) + dz) - V.y0) / V.h; }
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return geo;
}
// Clear glass (canopy, windscreen): drawn after the ink pass as a see-through film that darkens toward its edges,
// tested against the scene's depth so whatever stands in front of it still hides it.
const GLASS = [];
const GLASS_VERT = /* glsl */`varying vec3 vN; varying float vVZ;
void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vVZ = -mv.z; gl_Position = projectionMatrix * mv; }`;
const GLASS_FRAG = /* glsl */`uniform sampler2D tDepth; uniform vec2 uRes; uniform vec3 uTint, uRim; uniform float uA, uNear, uFar, uSpec; varying vec3 vN; varying float vVZ;
void main(){
  float vis = 0.0;                                                     // how much of this pixel the scene leaves uncovered
  for (int k = 0; k < 4; k++) { vec2 o = vec2(k < 2 ? -0.25 : 0.25, (k == 0 || k == 2) ? -0.25 : 0.25); float sd = texture2D(tDepth, (gl_FragCoord.xy + o) / uRes).r; vis += vVZ > uNear + sd * (uFar - uNear) + 0.006 ? 0.0 : 0.25; }
  if (vis <= 0.0) discard;
  vec3 n = normalize(vN);
  float rim = pow(1.0 - abs(n.z), 2.2);
  float spec = uSpec * pow(max(dot(n * sign(n.z), normalize(vec3(-0.35, 0.75, 0.56))), 0.0), 60.0);
  float a = clamp(uA * (0.13 + 0.87 * rim), 0.0, 1.0);
  vec3 c = mix(uTint, uRim, rim * 0.65);
  float nz = abs(n.z), edge = smoothstep(0.0, max(fwidth(nz) * 1.5, 1e-3), nz);   // the glass fades out over its last pixel where it turns edge-on, so its outline is smooth without multisampling
  gl_FragColor = vec4(c * a + vec3(spec), clamp(a + spec, 0.0, 1.0)) * vis * edge;
}`;
function addGlass(parent, geo) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: GLASS_VERT, fragmentShader: GLASS_FRAG, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { tDepth: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uTint: { value: new THREE.Color() }, uRim: { value: new THREE.Color() }, uA: { value: 1 }, uNear: { value: 0.1 }, uFar: { value: 1000 }, uSpec: { value: 0 } },
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  });
  const m = new THREE.Mesh(geo, mat); m.layers.set(FX_LAYER); m.frustumCulled = false; m.renderOrder = 4; parent.add(m); GLASS.push(m);
  return m;
}
// Called by the pipeline once a frame, just before the see-through pass.
function journeyFX(camera, pipe) {
  for (const m of GLASS) {
    const u = m.material.uniforms;
    u.uRes.value.set(pipe.cw, pipe.ch); u.tDepth.value = pipe.rtN.depthTexture; u.uNear.value = camera.near; u.uFar.value = camera.far;
    u.uTint.value.copy(PAL.dark3d ? PAL.ink : PAL.glass); u.uRim.value.copy(PAL.ink); u.uA.value = PAL.dark3d ? 0.5 : 0.85; u.uSpec.value = PAL.dark3d ? 0.5 : 0.0;
  }
}
const $ = (s, r = document) => r.querySelector(s);
const fmt = (n, d = 0) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
// Lathe about the X axis: profile [r, x, smooth?] with x running forward.
// The profile may be listed in either direction: it is turned so the solid faces outward (or inward with o.inside,
// which is how the canopy glass is drawn so the cockpit shows through its near side).
const lx = (prof, o = {}) => {
  let area = 0;
  for (let k = 0; k < prof.length; k++) { const p = prof[k], q = prof[(k + 1) % prof.length]; area += p[0] * q[1] - q[0] * p[1]; }
  if (area !== 0 && (area < 0) !== !!o.inside) prof = prof.slice().reverse();
  return turn(prof, o).rotateZ(-Math.PI / 2);
};
const X = (station) => 8.5 - station;   // fuselage station in metres aft of the nose tip → world x (nose at +x)
// Afterburner and dry-exhaust plume colours: [core, body, deep, smoke, soot, alpha], inks on paper · glows in the dark.
FX_SETS.AB = { light: ["#fff8e6", "#ffbe52", "#f4702c", "#e2603c", "#7a66dd", 1.0], dark: ["#fffbee", "#ffc35a", "#ff7a2a", "#c23a1c", "#7460f0", 1.0] };
FX_SETS.DRY = { light: ["#f4f8ff", "#8fb0fa", "#6585e6", "#cfdcf8", "#6585e6", 0.92], dark: ["#f6faff", "#a8c4ff", "#6a88ee", "#33407a", "#33407a", 0.95] };
// Muzzle flash and tracers of the cannon.
FX_SETS.GUN = { light: ["#fff7dc", "#ffc24a", "#f07a26", "#d9622c", "#d9622c", 1.0], dark: ["#fffbea", "#ffcf66", "#ff8a2a", "#b8441c", "#b8441c", 1.0] };
// Exhaust smoke: [lightest puffs, body, shadow, thinning far end, -, alpha].
FX_SETS.SMOKE = { light: ["#f4f2ed", "#c6c2ba", "#9f9b93", "#e0ddd6", "#9f9b93", 0.86], dark: ["#bdb8af", "#807c75", "#56534e", "#2d2c2a", "#2d2c2a", 0.78] };
// Smoke volumes behind a pair (or one) of nozzles: a near trail, a far billow, a low roll and a start-up puff.
function smokeSet(parent, exit, scale, show) {
  const mk = (len, r0, rmax, o) => { const fx = makeFX("SMOKE", 1, { len, r0, rmax, freq: 1.0, flow: 0.9, dens: 1, ...o }); fx.rotation.z = -Math.PI / 2 - (o.rise || 0); parent.add(fx); return fx; };
  const S = scale;
  LIVE.smoke.push({ show, exit, S,
    trail: mk(13 * S, 1.5 * S, 2.6 * S, { freq: 1.25, flow: 2.6, dens: 0.55, rise: 0.05 }),
    far: mk(13 * S, 2.6 * S, 4.2 * S, { freq: 0.8, flow: 1.3, dens: 0.42, rise: 0.09 }),
    low: mk(10 * S, 0.9 * S, 1.6 * S, { freq: 1.5, flow: 3.2, dens: 0.5, rise: -0.05 }),
    puff: mk(5 * S, 0.9 * S, 3.0 * S, { freq: 1.1, flow: 0.6, dens: 1.5, rise: 0.12 }) });
}
