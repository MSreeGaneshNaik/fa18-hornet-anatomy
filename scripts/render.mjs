// Renders the set-piece stills (src/app/65-stills.js) at 6016 × 3384 on this machine's GPU and saves them as PNGs.
// The page draws each frame itself (HORNET.still); this script only opens it in Chrome, asks, and catches the download.
//
//   node scripts/render.mjs                         every still → docs/images/6k/
//   node scripts/render.mjs 01-afterburner 07-plan  only these
//   --w=6016 --h=3384   picture size            --ss=2      supersampling of geometry and ink (1 to 2)
//   --line=2            ink weight, output px   --out=dir   where the PNGs go
//   --chrome=/path      use this Chrome         --headless  no window (some GPUs only render with one)
//   --software          allow the SwiftShader software renderer (refused otherwise: these are meant to be GPU renders)
import { chromium } from "playwright";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2);
const names = args.filter((a) => !a.startsWith("--"));
const opt = Object.fromEntries(args.filter((a) => a.startsWith("--")).map((a) => { const [k, v] = a.slice(2).split("="); return [k, v ?? true]; }));
const W = +(opt.w || 6016), H = +(opt.h || 3384), out = resolve(root, opt.out || "docs/images/6k");
mkdirSync(out, { recursive: true });

const gpuArgs = opt.software
  ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl", "--no-sandbox"]
  : ["--ignore-gpu-blocklist", "--enable-gpu", "--enable-webgl", "--disable-gpu-watchdog", ...(process.platform === "darwin" ? ["--use-angle=metal"] : [])];
const launch = { headless: !!(opt.headless || opt.software), args: gpuArgs };
if (opt.chrome) launch.executablePath = opt.chrome; else if (!opt.software) launch.channel = "chrome";
const browser = await chromium.launch(launch).catch(() => chromium.launch({ headless: launch.headless, args: gpuArgs }));
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
await page.route("**/*", (route) => {
  const url = route.request().url();
  if (url.startsWith("https://local.test/")) return route.fulfill({ contentType: "text/html", body: readFileSync(join(root, "dist/hornet.html"), "utf8") });
  const m = url.match(/cdn\.jsdelivr\.net\/npm\/three@[\d.]+\/(.*)$/);
  if (m) return route.fulfill({ contentType: "application/javascript", headers: { "access-control-allow-origin": "*" }, body: readFileSync(join(root, "node_modules/three", m[1])) });
  if (/fonts\.(googleapis|gstatic)\.com/.test(url)) return route.fulfill({ contentType: "text/css", body: "" });
  return route.continue();
});
await page.goto("https://local.test/index.html");
await page.waitForFunction("window.HORNET && HORNET.STILLS", null, { timeout: 120000 });
const gpu = await page.evaluate("HORNET.gpu()");
console.log("GPU:", gpu);
if (/swiftshader|llvmpipe|software/i.test(gpu) && !opt.software) { console.error("This is a software renderer, not the GPU. Start Chrome with hardware acceleration on, or pass --software to render anyway."); await browser.close(); process.exit(1); }

const all = await page.evaluate("HORNET.STILLS.map((s) => ({ name: s.name, title: s.title }))");
const list = names.length ? all.filter((s) => names.includes(s.name)) : all;
const log = [];
for (const s of list) {
  const o = { w: W, h: H, ss: +(opt.ss || 2) };
  if (opt.line) o.line = +opt.line;
  if (opt.noaa) o.aa = false;
  const [download, info] = await Promise.all([page.waitForEvent("download", { timeout: 600000 }), page.evaluate(([name, o]) => HORNET.still(name, o), [s.name, o])]);
  await download.saveAs(join(out, info.name));
  log.push({ ...info, title: s.title });
  console.log(`${info.name}  ${info.w} × ${info.h}  drawn at ${info.drawnAt.join(" × ")}  ${(info.bytes / 1e6).toFixed(1)} MB  ${info.ms} ms${info.glError ? "  GL error " + info.glError : ""}`);
}
writeFileSync(join(out, "renders.json"), JSON.stringify({ gpu, rendered: new Date().toISOString().slice(0, 10), stills: log }, null, 2) + "\n");
await browser.close();
