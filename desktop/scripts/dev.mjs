// Dev-drivare: starta Vite, vänta tills den svarar, kompilera main/preload och
// starta Electron mot dev-servern. Håller beroendelistan fri från concurrently/wait-on.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const URL_ = "http://localhost:5174";
const children = [];

function run(cmd, args, opts = {}) {
  const child = spawn(cmd, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32", ...opts });
  children.push(child);
  return child;
}

function shutdown(code = 0) {
  for (const c of children) {
    if (!c.killed) c.kill();
  }
  process.exit(code);
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

async function waitForServer(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

run("npx", ["vite"]);

if (!(await waitForServer(URL_))) {
  console.error(`[dev] Vite svarade inte på ${URL_} inom 30 s`);
  shutdown(1);
}

const tsc = run("npx", ["tsc", "-p", "tsconfig.electron.json"]);
tsc.on("exit", (code) => {
  if (code !== 0) {
    console.error("[dev] kompilering av main/preload misslyckades");
    shutdown(code ?? 1);
  }
  const electron = run("npx", ["electron", "."], {
    env: { ...process.env, VITE_DEV_SERVER_URL: URL_ },
  });
  electron.on("exit", (c) => shutdown(c ?? 0));
});
