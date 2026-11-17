// ============================================================================
// 60 · UI — parts index, sheets, console and readouts.
// ============================================================================
const el = (tag, attrs = {}, html = "") => { const e = document.createElement(tag); for (const k in attrs) e.setAttribute(k, attrs[k]); e.innerHTML = html; return e; };
const put = (node, text) => { if (node && node._t !== text) { node._t = text; node.textContent = text; } };
const kvHtml = (kv) => kv.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join("");
const CAPS = {
  whole: "An F/A-18A chained to the deck for an engine run. Drag to orbit, scroll to zoom, right-drag to pan. Ignite runs both engines at the throttle and altitude below, with a puff of smoke as they light. The flame and the smoke both grow with thrust: a blue flame from idle to military power, the orange afterburner above it. A real F404 shows almost no flame or smoke below afterburner; both are drawn here so the thrust can be seen; Take apart opens the aircraft into its assemblies, and clicking any part frames it and opens its sheet.",
  gun: "The gun system on its pallet: the gun above, the 578-round drum below, and a closed loop of chute between them. Take the aircraft apart, then press Fire cannon (or G). The six barrels spin up, live rounds climb the starboard chute, the empty cases come back down the port chute into the drum, and the counter runs down at the real 100 rounds a second. The barrels and rounds are drawn about eight times slower than life so the eye can follow them; the tracers are slowed far more.",
  arms: "The stores the drawing shows. The wingtip rails carry AIM-9L Sidewinders and the fuselage corner stations AIM-7F Sparrows. The Stores switch (key L) steps the wing pylons through the loads in the drawing's side panels, each only on the stations it allows: the dual AIM-9 launcher, the Sparrow and the Harpoon on the outboard pylons, the Standard ARM and the Maverick on all four.",
  ext: "The fittings the drawing labels. P opens the two doors on the starboard side of the nose and swings the refuelling probe out of its bay, and stows it again; opening the canopy drops the boarding ladder from under the port wing extension; taking the aircraft apart swings the radome open on its starboard hinge.",
  dF404: "One F404 on its stand with a third of each casing cut away. The rotors turn with the throttle: the fan and its turbine on one shaft, the compressor and its turbine on the other. Take apart separates the modules.",
};
function buildUI() {
  const menu = $("#menu");
  MENU.forEach(([title, items], si) => {
    const sec = el("section", { class: si === 0 ? "open" : "" });
    const head = el("button", { type: "button", class: "sec-head", "aria-expanded": String(si === 0), "aria-controls": `sec${si}` }, `<span>${title}</span><b>${String(si + 1).padStart(2, "0")}</b><i aria-hidden="true"></i>`);
    const body = el("div", { class: "sec-items", id: `sec${si}`, role: "group", "aria-label": title }), inner = el("div", { class: "sec-in" });
    items.forEach(([id, label], i) => { const b = el("button", { type: "button", "data-item": id, "aria-pressed": "false" }, `<em>${String(i + 1).padStart(2, "0")}</em>${label}`); b.addEventListener("click", () => selectItem(id)); inner.appendChild(b); });
    head.addEventListener("click", () => { const on = !sec.classList.contains("open"); menu.querySelectorAll("section").forEach((s) => { s.classList.remove("open"); s.querySelector(".sec-head").setAttribute("aria-expanded", "false"); }); if (on) { sec.classList.add("open"); head.setAttribute("aria-expanded", "true"); selectItem(items[0][0]); } });
    body.appendChild(inner); sec.append(head, body); menu.appendChild(sec);
  });
  $("#glance").innerHTML = [["56 ft", "Length", "17.07 m"], ["37 ft 6 in", "Wingspan", "11.43 m"], ["15 ft 3½ in", "Height", "4.66 m"], ["23,050 lb", "Empty weight", "10,455 kg"], ["49,224 lb", "Maximum weight", "22,328 kg"], ["32,000 lbf", "Thrust, both, full burner", "2 × 16,000 · F404-GE-400"], ["1,305 mph", "Maximum speed", "2,100 km/h"], ["50,000 ft", "Service ceiling", "15,240 m"], ["2,303 miles", "Range", "3,706 km"], ["9", "External weapon stations", "plus one M61 20 mm cannon"], ["578", "Rounds, 20 mm", "M61A1"], ["1", "Crew", ""]].map(([b, s, sm]) => `<div><b>${b}</b><span>${s}</span><small>${sm}</small></div>`).join("");
  $("#engTable").innerHTML = `<thead><tr><th>F404-GE-400</th><th>Military</th><th>Full afterburner</th></tr></thead><tbody>${[["Thrust, one engine", "10,600 lbf · 47.2 kN", "16,000 lbf · 71.2 kN"], ["Specific fuel consumption", "0.81 lb/(lbf·h)", "1.74 lb/(lbf·h)"], ["Fuel flow, one engine", "8,590 lb/h", "27,840 lb/h"], ["Share of maximum thrust", "66%", "100%"], ["Nozzle", "closed down", "open"]].map((r) => `<tr>${r.map((c, i) => (i ? `<td>${c}</td>` : `<th>${c}</th>`)).join("")}</tr>`).join("")}</tbody>`;
  $("#math").innerHTML = `<p><b>What is computed.</b> Thrust at sea level follows the lever between the published idle-to-military and military-to-afterburner figures; fuel flow is thrust × specific fuel consumption. Outside air comes from the International Standard Atmosphere. The 16,000 lbf maximum is the figure on the drawing; the 10,600 lbf military rating is the one usually quoted for this engine, and the fuel-consumption figures are those published for the later F404-GE-402, since the drawing gives none.</p><p><b>What is a model.</b> Static thrust falls with altitude as density ratio<sup>0.7</sup>; idle thrust is taken as 5% of military; the nozzle schedule, spool speeds and the lag between lever and thrust are drawn to behave like the engine, not measured from it.</p>`;
  $("#sources").innerHTML = ["McDonnell Douglas F/A-18A Hornet three-view drawing: the outline of every surface, measured off its top, side and front views; the panel lines, doors, vents and markings on the skin, which are the drawing's own side-view and top-view line work, traced into clean vector lines and laid onto the model; and its specification block (dimensions, weights, thrust, speed, ceiling, range, armament)", "General Electric F404 published data: military thrust, airflow, pressure ratio, bypass ratio, stage counts, dimensions; fuel consumption as published for the F404-GE-402", "General Dynamics Ordnance and Tactical Systems: M61A1 gun data and the F/A-18C/D gun system (rounds, rate of fire, feed, drive, muzzle velocity, recoil, dispersion)", "International Standard Atmosphere (ISO 2533)"].map((s) => `<li>${s}</li>`).join("");
  // controls
  const thr = $("#thr"), thrMini = $("#thrMini"), alt = $("#alt");
  for (const r of [thr, thrMini]) r.addEventListener("input", () => setLever(Number(r.value) / 100));
  alt.addEventListener("input", () => { C.feet = Number(alt.value); UI.sync(); });
  for (const b of document.querySelectorAll("[data-lever]")) b.addEventListener("click", () => { setLever(Number(b.dataset.lever) / 100); if (!C.running) setRunning(true); });
  for (const id of ["ign", "ign2"]) $("#" + id).addEventListener("click", () => setRunning(!C.running));
  $("#apart").addEventListener("click", () => setExplode(!C.explode));
  $("#fold").addEventListener("click", () => { C.fold = !C.fold; UI.sync(); });
  $("#canopy").addEventListener("click", () => { C.canopy = !C.canopy; UI.sync(); });
  $("#fire").addEventListener("click", () => setFire(!C.fire));
  $("#stores").addEventListener("click", () => { C.load = (C.load + 1) % LOADS.length; C.tour = false; UI.sync(); });
  $("#probe").addEventListener("click", () => { C.probe = !C.probe; UI.sync(); });
  $("#free").addEventListener("click", () => { CAM.free = !CAM.free; UI.sync(); });
  for (const b of document.querySelectorAll(".dragmode button")) b.addEventListener("click", () => { CAM.dragMode = b.dataset.mode; UI.sync(); });
  $("#zin").addEventListener("click", () => zoomBy(0.8)); $("#zout").addEventListener("click", () => zoomBy(1.25)); $("#zreset").addEventListener("click", resetView);
  $("#aa").addEventListener("click", () => { PIPE.setAA(!PIPE.aa); UI.sync(); });
  $("#theme").addEventListener("click", () => { const dark = !PAL.dark3d; document.documentElement.dataset.theme = dark ? "dark" : "light"; try { localStorage.setItem("hornet-theme", dark ? "dark" : "light"); } catch (e) {} setTimeout(UI.sync, 30); });
  const fig = $("#fig");
  fig.addEventListener("keydown", (ev) => {
    const key = ev.key.toLowerCase();
    if (key === " " || key === "enter") { ev.preventDefault(); setRunning(!C.running); }
    else if (key === "[") setLever(C.lever - 0.05); else if (key === "]") setLever(C.lever + 0.05);
    else if (key === "x") setExplode(!C.explode); else if (key === "f") { C.fold = !C.fold; UI.sync(); } else if (key === "c") { C.canopy = !C.canopy; UI.sync(); } else if (key === "g") setFire(!C.fire); else if (key === "l") { C.load = (C.load + 1) % LOADS.length; UI.sync(); } else if (key === "p") { C.probe = !C.probe; UI.sync(); } else if (key === "r") resetView(); else if (key === "escape") selectItem(sceneOf(C.sel) === "eng" ? "dF404" : "whole");
    else if (CAM.free && ["w", "a", "s", "d", "q", "e", "arrowleft", "arrowright", "arrowup", "arrowdown", "shift"].includes(key)) { ev.preventDefault(); CAM.keys.add(key); }
  });
  fig.addEventListener("keyup", (ev) => CAM.keys.delete(ev.key.toLowerCase()));
  fig.addEventListener("blur", () => CAM.keys.clear());

  UI.sync = () => {
    const it = MENU_ITEMS[C.sel], eng = it.eng;
    document.querySelectorAll("#menu button[data-item]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.item === C.sel)));
    document.querySelectorAll("#menu section").forEach((s, i) => { const on = (i === 1) === eng; s.classList.toggle("open", on); s.querySelector(".sec-head").setAttribute("aria-expanded", String(on)); });
    put($("#figTitle"), eng ? "F404-GE-400 · on the stand" + (C.explode ? " · taken apart" : "") : "F/A-18A Hornet · engine run" + (C.explode ? " · taken apart" : ""));
    $("#apart").setAttribute("aria-pressed", String(C.explode)); put($("#apart"), C.explode ? "Put together" : "Take apart");
    $("#canopy").setAttribute("aria-pressed", String(C.canopy)); put($("#canopy"), C.canopy ? "Close canopy" : "Open canopy"); $("#canopy").hidden = eng;
    $("#stores").hidden = eng; put($("#stores"), "Stores: " + LOADS[C.load].label); $("#stores").title = LOADS[C.load].note;
    $("#probe").hidden = eng; $("#probe").setAttribute("aria-pressed", String(C.probe)); put($("#probe"), C.probe ? "Stow probe" : "Extend probe");
    $("#fire").hidden = eng || !C.explode; $("#fire").setAttribute("aria-pressed", String(C.fire)); $("#fire").classList.toggle("hot", C.fire); put($("#fire"), C.fire ? "Cease fire" : C.rounds < 1 ? "Reload and fire" : "Fire cannon");
    $("#fold").setAttribute("aria-pressed", String(C.fold)); put($("#fold"), C.fold ? "Spread wings" : "Fold wings"); $("#fold").hidden = eng;
    for (const id of ["ign", "ign2"]) { const b = $("#" + id); b.classList.toggle("on", C.running); b.classList.toggle("off", !C.running); put(b.querySelector("span"), C.running ? "Shut down" : "Ignite"); }
    $("#free").setAttribute("aria-pressed", String(CAM.free)); put($("#free b"), CAM.free ? "On" : "Off");
    fig.classList.toggle("free", CAM.free); fig.classList.toggle("pan", CAM.dragMode === "pan");
    document.querySelectorAll(".dragmode button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === CAM.dragMode)));
    put($("#aa b"), PIPE.aa ? "On" : "Off"); $("#aa").setAttribute("aria-pressed", String(!!PIPE.aa));
    put($("#theme b"), PAL.dark3d ? "Dark" : "Light");
    put($("#caption"), CAPS[C.sel] || CAPS[eng ? "dF404" : "whole"]);
    put($("#engName"), eng ? "one F404-GE-400" : "two F404-GE-400");
    // sheet for the selection
    const keys = it.id === "whole" ? ["keel"] : it.id === "dF404" ? ["dF404"] : it.mods, M = MODULES[keys[0]];
    const head = it.id === "whole" ? { name: "McDonnell Douglas F/A-18A Hornet", by: "McDonnell Douglas · Northrop · General Electric", desc: "A carrier strike fighter: one airframe that flies both the fighter and the attack mission, with two engines, folding wings, an arrestor hook and landing gear built for the deck. Pick a part in the index, or click it in the drawing, to frame it and read its sheet." } : M;
    const kv = it.id === "whole" ? [["Length", "56 ft · 17.07 m"], ["Wingspan", "37 ft 6 in · 11.43 m"], ["Height", "15 ft 3½ in · 4.66 m"], ["Empty weight", "23,050 lb · 10,455 kg"], ["Maximum weight", "49,224 lb · 22,328 kg"], ["Powerplants", "2 × GE F404-GE-400, 16,000 lbf each"], ["Armament", "one M61 20 mm cannon · nine external stations"], ["Maximum speed", "1,305 mph"], ["Service ceiling", "50,000 ft"], ["Range", "2,303 miles"], ["Crew", "1"]] : keys.flatMap((k) => MODULES[k].kv);
    const half = Math.ceil(kv.length / 2);
    $("#detail").innerHTML = `<div class="d-head"><h3>Selected · ${it.label}</h3><h2>${head.name}</h2>${head.by ? `<span class="d-by">${head.by}</span>` : ""}<p>${head.desc}</p>${keys.slice(1).map((k) => `<p><b>${MODULES[k].name}.</b> ${MODULES[k].desc}</p>`).join("")}</div><div class="d-cols"><dl class="kv">${kvHtml(kv.slice(0, half))}</dl><dl class="kv">${kvHtml(kv.slice(half))}</dl></div>`;
    UI.tick(true);
  };
  UI.tick = () => {
    const now = C.now; if (!now) return;
    const eng = MENU_ITEMS[C.sel].eng, n = eng ? 1 : 2, thrust = now.thrust * n * C.pwr, fuel = now.fuel * n * C.pwr;
    const state = C.pwr < 0.02 ? "shut down" : detentOf(C.spool);
    put($("#thrOut"), detentOf(C.lever)); put($("#thrMiniOut"), detentOf(C.lever)); put($("#altOut"), C.feet < 1 ? "Sea level" : fmt(C.feet) + " ft");
    const lv = String(Math.round(C.lever * 200) / 2); for (const r of [$("#thr"), $("#thrMini")]) if (document.activeElement !== r && r.value !== lv) r.value = lv;
    put($("#thrustBig").firstChild, fmt(Math.round(thrust / 10) * 10)); put($("#thrustSub"), fmt(thrust * 0.00444822, 1) + " kN · " + Math.round((thrust / (SPEC.max * n)) * 100) + "% of sea-level maximum");
    $("#twBar b").style.width = clamp((thrust / (SPEC.max * n)) * 100, 0, 100) + "%";
    put($("#engStatus"), C.pwr < 0.02 ? "Shut down" : C.light > 0.05 ? "Afterburner" : "Running"); $("#engStatus").className = "status" + (C.pwr > 0.02 ? (C.light > 0.05 ? " warn" : " go") : "");
    $("#liveKV").innerHTML = kvHtml([["Fuel flow", fmt(Math.round(fuel / 10) * 10) + " lb/h"], ["Nozzle", now.nozzle < 0.03 ? "closed down" : Math.round(now.nozzle * 100) + "% open"], ["Fan speed N1", Math.round(now.n1 * C.pwr) + "%"], ["Core speed N2", Math.round(now.n2 * C.pwr) + "%"], ["Outside air", Math.round(now.air.T - 273.15) + " °C · " + fmt(now.air.p / 100) + " hPa"], ["Air density", Math.round(now.air.sigma * 100) + "% of sea level"]]);
    const hov = C.hover && MODULES[C.hover];
    put($("#hint"), hov ? hov.name + " · click to frame it" : CAM.free ? "Drag to orbit · scroll to zoom · click a part" : "Hover or click a part to read it");
    if (!eng && C.explode && (C.fire || C.gunSpin > 0.01 || C.rounds < GUN.rounds || C.sel === "gun")) { const left = Math.ceil(C.rounds), gs = C.fire ? "FIRING" : left < 1 ? "DRUM EMPTY" : "GUN SAFE"; if (UI.gunKey !== gs + left) { UI.gunKey = gs + left; $("#readout").innerHTML = `${gs} · ${left} of ${GUN.rounds} rounds<small>${fmt(GUN.rate)} shots a minute · motion drawn slowed</small>`; } return; }
    UI.gunKey = null;
    $("#readout").innerHTML = `${state.toUpperCase()} · ${fmt(Math.round(thrust / 10) * 10)} lbf<small>${C.explode ? "taken apart" : (n === 2 ? "both engines" : "one engine") + " · " + (C.feetNow < 50 ? "sea level" : fmt(Math.round(C.feetNow / 100) * 100) + " ft")}</small>`;
  };
  UI.sync();
}
