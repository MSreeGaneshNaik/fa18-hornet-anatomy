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
console.log("wrote dist/hornet.html", (html.length / 1024).toFixed(1) + " KB:", jsFiles.map((f) => basename(f)).join(", "));
