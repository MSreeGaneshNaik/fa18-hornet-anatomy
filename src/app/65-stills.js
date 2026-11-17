// ============================================================================
// 65 · STILLS — the set pieces: a pose (every switch), a theme and a camera each.
// HORNET.still(name) renders one at 6016 × 3384 on whatever GPU the browser is using.
// cam: az and el in degrees (az 0 looks from starboard, nose to the right; el 90 looks straight down).
// ============================================================================
const STILLS = [
  { name: "01-afterburner", title: "Both F404s in full afterburner", theme: "dark", pose: { sel: "whole", running: true, lever: 1 }, cam: { az: -52, el: 21 }, zoom: 1.35, pan: [0.05, 0] },
  { name: "02-hornet", title: "F/A-18A Hornet, clean view from ahead", theme: "light", pose: { sel: "whole" }, cam: { az: 42, el: 20 }, zoom: 1.25, pan: [0, -0.03] },
  { name: "03-taken-apart", title: "The whole aircraft taken apart", theme: "light", pose: { sel: "whole", explode: true }, cam: { az: -52, el: 27 }, zoom: 1.4 },
  { name: "04-cockpit", title: "Cockpit and ejection seat, canopy open", theme: "light", pose: { sel: "pit", canopy: true }, cam: { az: 58, el: 26 }, zoom: 0.78, pan: [-0.05, 0.09] },
  { name: "05-cannon", title: "M61A1 cannon firing, aircraft taken apart", theme: "dark", pose: { sel: "whole", explode: true, fire: true }, cam: { az: 38, el: 16 }, zoom: 0.55, settle: 150 },
  { name: "06-nozzles", title: "Exhaust nozzles in afterburner", theme: "dark", pose: { sel: "engs", running: true, lever: 1 }, cam: { az: -68, el: 14 }, zoom: 0.68 },
  { name: "07-plan", title: "Plan view, panel lines from the McDonnell Douglas three-view", theme: "light", pose: { sel: "whole" }, cam: { az: 0, el: 89.6 }, zoom: 1.0 },
  { name: "08-profile", title: "Starboard profile", theme: "light", pose: { sel: "whole" }, cam: { az: 0, el: 0 }, zoom: 1.12, pan: [0, 0.03] },
  { name: "09-stores", title: "Sidewinders, Sparrows and pylons", theme: "light", pose: { sel: "arms", load: 0 }, cam: { az: 62, el: 10 }, zoom: 0.85 },
  { name: "10-on-deck", title: "Wings folded, canopy open, refuelling probe out", theme: "light", pose: { sel: "whole", fold: true, canopy: true, probe: true }, cam: { az: 128, el: 18 }, zoom: 1.2, pan: [0, -0.04] },
  { name: "11-radar", title: "Radome swung open on the APG-65 radar", theme: "light", pose: { sel: "nose", explode: true }, cam: { az: 50, el: 18 }, zoom: 0.5 },
  { name: "12-f404", title: "F404-GE-400 on the stand", theme: "light", pose: { sel: "dF404" }, cam: { az: -24, el: 17 }, zoom: 1.25 },
  { name: "13-f404-apart", title: "F404-GE-400 taken apart", theme: "light", pose: { sel: "dF404", explode: true }, cam: { az: -24, el: 20 }, zoom: 1.08 },
  { name: "14-f404-afterburner", title: "F404-GE-400 in afterburner on the stand", theme: "dark", pose: { sel: "dF404", running: true, lever: 1 }, cam: { az: -30, el: 14 }, zoom: 1.1, pan: [0.08, 0] },
];
