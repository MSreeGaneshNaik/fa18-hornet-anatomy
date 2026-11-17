// Truth model for the F404-GE-400 (F/A-18A). Pure functions, shared by the build and the page.
// From the supplied drawing: 16,000 lbf full afterburner. Widely quoted for the -400: 10,600 lbf military, airflow 142 lb/s,
// pressure ratio about 25. Fuel consumption 0.81 / 1.74 lb/(lbf.h) is the figure published for the later -402, used here
// because the drawing gives none. Bypass 0.34, 3 fan + 7 HP compressor stages, 1 HP + 1 LP turbine,
// length 154 in, diameter 35 in. Everything marked "model" below is a stated approximation.
const SPEC = { mil: 10600, max: 16000, sfcMil: 0.81, sfcMax: 1.74, airflow: 142, bypass: 0.34, opr: 25, lengthIn: 154, diaIn: 35, ceiling: 50000 };
const MIL_AT = 0.7; // lever position of the military detent (0 idle, 1 full afterburner)

// International Standard Atmosphere.
function isa(feet) {
  const h = feet * 0.3048;
  const T0 = 288.15;
  const p0 = 101325;
  let T;
  let p;
  if (h <= 11000) {
    T = T0 - 0.0065 * h;
    p = p0 * Math.pow(T / T0, 5.25588);
  } else {
    T = 216.65;
    p = 22632.1 * Math.exp(-(h - 11000) / 6341.62);
  }
  const rho = p / (287.053 * T);
  return { T, p, rho, sigma: rho / 1.225, delta: p / p0 };
}

// One engine, static (the aircraft is tied down). lever 0..1, altitude in feet.
function engine(lever, feet) {
  lever = Math.min(1, Math.max(0, lever));
  const air = isa(feet);
  const dry = Math.min(1, lever / MIL_AT); // 0 idle .. 1 military
  const ab = Math.max(0, (lever - MIL_AT) / (1 - MIL_AT)); // 0 .. 1 afterburner
  const idle = 0.05 * SPEC.mil; // model: ground idle about 5% of military thrust
  const seaLevel = ab > 0 ? SPEC.mil + (SPEC.max - SPEC.mil) * ab : idle + (SPEC.mil - idle) * Math.pow(dry, 1.6); // model: lever-to-thrust curve
  const lapse = Math.pow(air.sigma, 0.7); // model: static thrust lapse with density
  const thrust = seaLevel * lapse;
  const sfc = ab > 0 ? SPEC.sfcMil + (SPEC.sfcMax - SPEC.sfcMil) * ab : SPEC.sfcMil;
  const fuel = sfc * thrust; // lb/h
  // The variable exhaust nozzle: wide open at idle, closed down at military, opening again with afterburner.
  const nozzle = ab > 0 ? 0.12 + 0.88 * ab : Math.pow(1 - dry, 1.5);
  const n2 = 64 + 36 * Math.pow(dry, 0.75); // model: core speed, % of maximum
  const n1 = 28 + 72 * Math.pow(dry, 0.9); // model: fan speed, % of maximum
  // model: nozzle pressure ratio; cold air at altitude raises the corrected speed and with it the ratio
  const npr = (1.08 + 2.3 * Math.pow(dry, 1.4)) * Math.pow(288.15 / air.T, 0.9);
  return { air, dry, ab, thrust, seaLevel, lapse, fuel, sfc, nozzle, n1, n2, npr, share: thrust / SPEC.max };
}

const detentOf = (lever) => (lever <= 0.01 ? "IDLE" : Math.abs(lever - MIL_AT) < 0.012 ? "MIL" : lever >= 0.995 ? "MAX A/B" : lever > MIL_AT ? "A/B" : "DRY");
// ---- sheets: what each part is. Figures here are published ones unless a sheet says "model". ----
const MODULES = {};
const EX = {};      // module key → where it goes when the aircraft is taken apart (metres, in its parent's frame)
const HOMEPOS = {}; // module key → assembled position
const ORDER = [];   // take-apart order
function part(key, info, ex = [0, 0, 0], parent) {
  const g = mod(key, parent);
  MODULES[key] = info; EX[key] = V3(...ex); HOMEPOS[key] = V3(); ORDER.push(key);
  return g;
}
const JET = { length: 17.07, span: 11.43, height: 4.66 };
