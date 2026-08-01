// Bakar ihop Vite-bygget till EN fil med all JS och CSS inline:ad.
//
// Behövs för publicering på värdar som bara tar emot ett dokument, och för att
// en strikt CSP där ute blockerar externa förfrågningar — inga /assets-hämtningar
// får finnas kvar. Filen innehåller inte <html>/<head>/<body>; den är sidinnehåll
// som får en wrapper av publiceringsverktyget.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(root, "dist");
const out = path.join(dist, "tabflow-single.html");

const html = await fs.readFile(path.join(dist, "index.html"), "utf8");

const assets = [...html.matchAll(/(?:src|href)="([^"]*\/assets\/[^"]+)"/g)].map((m) => m[1]);
const css = [];
const js = [];
for (const ref of assets) {
  const file = path.join(dist, ref.replace(/^[./]*/, ""));
  const body = await fs.readFile(file, "utf8");
  (ref.endsWith(".css") ? css : js).push(body);
}
if (!js.length) throw new Error("hittade ingen JS-bundle i dist/index.html");

// Appens CSS förutsätter att den äger html/body/#root. Under en wrapper måste
// #root få höjd på egen hand, annars kollapsar det virtualiserade flödet till noll.
const layoutFix = `
#root { position: fixed; inset: 0; height: 100%; display: flex; flex-direction: column; }
body { margin: 0; }
`;

const page = [
  "<style>",
  css.join("\n"),
  layoutFix,
  "</style>",
  '<div id="root"></div>',
  '<script type="module">',
  js.join("\n"),
  "</script>",
  "",
].join("\n");

await fs.writeFile(out, page, "utf8");
const kb = Math.round(Buffer.byteLength(page) / 1024);
console.log(`[single-file] ${path.relative(root, out)} — ${kb} kB, ${css.length} CSS + ${js.length} JS inline:ade`);
