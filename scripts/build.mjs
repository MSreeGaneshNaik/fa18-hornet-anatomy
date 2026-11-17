// Assembles src/ into one standalone page: dist/hornet.html (every src/**/NN-*.js in NN order as one module script).
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join, basename } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
const srcDir = join(root, "src");
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
const jsFiles = walk(srcDir).filter((f) => /^\d\d-.*\.js$/.test(basename(f))).sort((a, b) => basename(a).localeCompare(basename(b)));
const js = jsFiles.map((f) => `// ---- ${basename(f)} ----\n` + readFileSync(f, "utf8")).join("\n");
const page = (f) => readFileSync(join(srcDir, "page", f), "utf8");
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>F/A-18 Hornet Anatomy</title>
<meta name="description" content="Interactive 3D technical drawing of the F/A-18A Hornet and its F404-GE-400 engines: orbit it, light the afterburners, fire the cannon, take it apart.">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..900&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<style>
${page("style.css")}
</style>
</head>
<body>
${page("body.html")}
<script type="module">
${js}
</script>
</body>
</html>
`;
mkdirSync(join(root, "dist"), { recursive: true });
writeFileSync(join(root, "dist", "hornet.html"), html);
// dist/film.html: the same page plus the director (film/director.js), which renders the launch film on this machine's GPU.
const panel = `<div id="filmPanel"><b>Film</b><label>Soundtrack <input type="file" id="filmAudio" accept="audio/*"></label><button id="filmGo" type="button">Render 3840 × 2160</button><span id="filmStatus">idle</span><a id="filmSave" hidden>Save MP4</a><a id="filmPoster" hidden>Save poster</a></div>
<style>#filmPanel{position:fixed;z-index:9999;left:12px;top:12px;display:flex;gap:14px;align-items:center;padding:12px 16px;background:#14171a;color:#eef1f4;font:500 14px/1.2 Archivo,system-ui,sans-serif;border-radius:10px}#filmPanel button,#filmPanel a{font:inherit;font-weight:700;color:#14171a;background:#e8b84a;border:0;border-radius:8px;padding:12px 18px;text-decoration:none;cursor:pointer}#filmPanel a[hidden]{display:none}</style>`;
const sfx = Object.fromEntries(["heavy", "medium"].map((k) => [k, readFileSync(join(root, "film", "sfx", `impactSoft_${k}_001.ogg`)).toString("base64")]));
const director = readFileSync(join(root, "film", "director.js"), "utf8").replace("/*SFX*/{}/*SFX*/", JSON.stringify(sfx));
const film = html.replace("</body>", () => `${panel}\n<script type="module">\n${director}\n</script>\n</body>`).replace("<title>F/A-18 Hornet Anatomy</title>", "<title>F/A-18 Hornet Anatomy · film</title>");
writeFileSync(join(root, "dist", "film.html"), film);
console.log("wrote dist/hornet.html and dist/film.html", (html.length / 1024).toFixed(1) + " KB:", jsFiles.map((f) => basename(f)).join(", "));
