// Headless check: serves dist/hornet.html, maps the three.js CDN to node_modules, runs a list of actions and saves screenshots
// plus the console output. This uses the SwiftShader software renderer, so it is for checking, not for finished pictures:
// those come from scripts/render.mjs on a real GPU.
// usage: node scripts/shot.mjs actions.json|'[["wait",3000],["shot","main","#fig"]]' [--w=1320] [--h=1000] [--dpr=1] [--dark] [--chrome=/path]
//   actions: ["wait", ms]  ["eval", js]  ["shot", name, selector?]  ["click", selector]
import { chromium } from "playwright";
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2);
const first = args[0] || '[["wait",4000],["shot","main","#fig"]]';
const actions = JSON.parse(existsSync(first) ? readFileSync(first, "utf8") : first);
const opt = Object.fromEntries(args.slice(1).filter((a) => a.startsWith("--")).map((a) => { const [k, v] = a.slice(2).split("="); return [k, v ?? true]; }));
mkdirSync(root + "shots", { recursive: true });

const launch = { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl", "--no-sandbox"] };
if (opt.chrome) launch.executablePath = opt.chrome;
const browser = await chromium.launch(launch);
const ctx = await browser.newContext({ viewport: { width: +(opt.w || 1320), height: +(opt.h || 1000) }, deviceScaleFactor: +(opt.dpr || 1), colorScheme: opt.dark ? "dark" : "light" });
const page = await ctx.newPage();
const logs = [];
page.on("console", (m) => { if (m.type() !== "log") logs.push(`[${m.type()}] ${m.text()}`); });
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}\n${(e.stack || "").split("\n").slice(0, 4).join("\n")}`));
await page.route("**/*", (route) => {
  const url = route.request().url();
  if (url.startsWith("https://local.test/")) return route.fulfill({ contentType: "text/html", body: readFileSync(root + "dist/hornet.html", "utf8") });
  const m = url.match(/cdn\.jsdelivr\.net\/npm\/three@[\d.]+\/(.*)$/);
  if (m) return route.fulfill({ contentType: "application/javascript", headers: { "access-control-allow-origin": "*" }, body: readFileSync(root + "node_modules/three/" + m[1]) });
  if (/fonts\.(googleapis|gstatic)\.com/.test(url)) return route.fulfill({ contentType: "text/css", body: "" });
  return route.continue();
});
await page.goto("https://local.test/index.html");
for (const [op, a, b] of actions) {
  if (op === "wait") await page.waitForTimeout(a);
  else if (op === "eval") { const r = await page.evaluate(a).catch((e) => "ERR " + e.message); if (r !== undefined) console.log("eval:", typeof r === "string" ? r : JSON.stringify(r)); }
  else if (op === "shot") {
    try {
      const clip = b ? await page.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; }, b) : undefined;
      await page.screenshot({ path: root + "shots/" + a + ".png", clip, timeout: 90000, animations: "disabled" });
      console.log("shot", a);
    } catch (e) { console.log("shot failed", a, e.message.split("\n")[0]); }
  } else if (op === "click") await page.click(a);
}
console.log(logs.length ? logs.slice(0, 12).join("\n") : "console: clean");
await browser.close();
