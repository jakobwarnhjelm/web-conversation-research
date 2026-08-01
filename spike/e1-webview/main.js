// SPIKE E1 — engångskod. Fulaste möjliga. Målet är LÄRANDE, inte produktion.
//
// Fråga: kan flera live WebContentsView samexistera med ett virtualiserat scrollflöde?
//   - positioneras rätt vid scroll (setBounds mot placeholder-rect)
//   - kan DOM-chrome (verktygsrad) ligga OVANPÅ dem?  (F-BLK-6 / F-UX-3)
//   - kan offscreen-vyer disposas (guest-process frigörs) och återskapas? (F-LAZY-5)
//   - håller taket 3 live-vyer med LRU-avlastning? (F-PERF-4 / F-LAZY-4)
//
// Renderaren äger scroll + virtualisering (spacer-divar). Main-processen äger
// själva native-vyerna och deras livscykel. Det är själva delningen som testas.

const { app, BrowserWindow, WebContentsView, ipcMain, desktopCapturer } = require("electron");
const path = require("path");
const fs = require("fs");

const LIVE_CAP = 3; // F-PERF-4 default-tak
const HEADER_PX = 56; // renderarens header; native-vyer klipps under den

/** @type {Map<string, {view: import('electron').WebContentsView, lastActive: number}>} */
const views = new Map();
let mainWindow = null;
let activeTick = 0; // monotont, driver LRU

function log(...a) {
  // syns i terminalen där du kör `npm start`
  console.log("[spike-main]", ...a);
}

function disposeView(blockId, reason) {
  const entry = views.get(blockId);
  if (!entry) return false;
  views.delete(blockId);
  try {
    mainWindow?.contentView.removeChildView(entry.view);
  } catch (e) {
    log("removeChildView error", e.message);
  }
  // Frigör guest-processen på riktigt (inte bara dölj) — F-LAZY-5.
  try {
    entry.view.webContents.close();
  } catch (e) {
    try {
      entry.view.webContents.destroy();
    } catch {
      /* ignore */
    }
  }
  log(`dispose ${blockId} (${reason}); live=${views.size}`);
  return true;
}

function evictLruIfNeeded() {
  while (views.size >= LIVE_CAP) {
    let oldestId = null;
    let oldest = Infinity;
    for (const [id, e] of views) {
      if (e.lastActive < oldest) {
        oldest = e.lastActive;
        oldestId = id;
      }
    }
    if (oldestId == null) break;
    disposeView(oldestId, "LRU-evict (tak nått)");
  }
}

function ensureView(blockId, url) {
  let entry = views.get(blockId);
  if (entry) {
    entry.lastActive = ++activeTick;
    return entry;
  }
  evictLruIfNeeded();
  const view = new WebContentsView({
    webPreferences: {
      contextIsolation: true, // avsnitt 9: säkerhet i webviews
      nodeIntegration: false,
    },
  });
  mainWindow.contentView.addChildView(view);
  view.webContents.loadURL(url).catch((e) => log("loadURL error", blockId, e.message));
  entry = { view, lastActive: ++activeTick };
  views.set(blockId, entry);
  log(`create ${blockId} -> ${url.slice(0, 40)}; live=${views.size}`);
  return entry;
}

// Klipp en placeholder-rect mot flödesytan (under headern, inom fönstret).
function clip(bounds, winHeight) {
  let { x, y, width, height } = bounds;
  const top = Math.max(y, HEADER_PX);
  const bottom = Math.min(y + height, winHeight);
  const visibleH = Math.max(0, Math.round(bottom - top));
  return { x: Math.round(x), y: Math.round(top), width: Math.round(width), height: visibleH };
}

app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    backgroundColor: "#0e1116",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, "index.html"));

  // Renderaren skickar hela mängden synliga sidblock varje scroll-frame.
  // Vi skapar/uppdaterar dem, och disposar allt som inte längre är med.
  ipcMain.handle("view:sync", (_e, payload) => {
    const { visible, winHeight } = payload; // visible: [{blockId, url, bounds}]
    const wanted = new Set(visible.map((v) => v.blockId));

    // Dispose vyer som lämnat warm-fönstret (F-LAZY-2/5).
    for (const id of [...views.keys()]) {
      if (!wanted.has(id)) disposeView(id, "utanför warm-fönster");
    }

    const disposed = [];
    for (const v of visible) {
      const c = clip(v.bounds, winHeight);
      if (c.height <= 1) {
        // helt bakom header/utanför -> ingen mening att hålla vyn live
        if (disposeView(v.blockId, "helt klippt")) disposed.push(v.blockId);
        continue;
      }
      const entry = ensureView(v.blockId, v.url);
      // Vyn kan ha blivit LRU-evicad om taket slog till innan den skapades:
      if (views.has(v.blockId)) entry.view.setBounds(c);
    }

    return {
      liveIds: [...views.keys()],
      liveCount: views.size,
      processCount: app.getAppMetrics().length,
      disposed,
    };
  });

  ipcMain.handle("view:metrics", () => ({
    liveIds: [...views.keys()],
    liveCount: views.size,
    processCount: app.getAppMetrics().length,
  }));

  // Headless smoke-drivare (SPIKE_SMOKE=1): scrolla igenom flödet, logga live-antal
  // och processantal vid varje steg, kontrollera att taket hålls, avsluta. Bevisar
  // mekaniken (skapa/positionera/dispose/LRU) utan en riktig skärm.
  if (process.env.SPIKE_SMOKE === "1") {
    mainWindow.webContents.on("did-finish-load", async () => {
      const wc = mainWindow.webContents;
      const scrollHeight = await wc.executeJavaScript(
        "document.getElementById('scroller').scrollHeight",
      );
      let maxLive = 0;
      const disposedSeen = new Set();
      for (let p = 0; p <= 1.0001; p += 0.1) {
        const y = Math.round(scrollHeight * p);
        await wc.executeJavaScript(`document.getElementById('scroller').scrollTop = ${y}`);
        await new Promise((r) => setTimeout(r, 350)); // låt rAF+IPC+load hinna
        const metrics = { liveIds: [...views.keys()], liveCount: views.size };
        maxLive = Math.max(maxLive, metrics.liveCount);
        for (const id of metrics.liveIds) disposedSeen.add(id);
        log(`smoke scrollTop=${y} live=${metrics.liveCount} [${metrics.liveIds.join(",")}]`);
      }
      log(`SMOKE RESULT: maxLive=${maxLive} (tak=${LIVE_CAP}), distinctViewsSkapade=${disposedSeen.size}`);
      log(`SMOKE VERDICT cap-hålls: ${maxLive <= LIVE_CAP ? "JA" : "NEJ"}`);
      log(`SMOKE VERDICT dispose-sker: ${disposedSeen.size > maxLive ? "JA (fler skapade än samtidigt live)" : "OKLART"}`);
      setTimeout(() => app.quit(), 300);
    });
  }

  // Skärmbild av hela OS-skärmen (inkl. native-lager) för att avgöra om DOM-
  // verktygsraden ligger ovanpå eller bakom WebContentsView:en. SPIKE_SHOT=1.
  if (process.env.SPIKE_SHOT === "1") {
    mainWindow.webContents.on("did-finish-load", async () => {
      const wc = mainWindow.webContents;
      await wc.executeJavaScript("document.getElementById('scroller').scrollTop = 900");
      await new Promise((r) => setTimeout(r, 1200)); // låt vy skapas + rita klart
      const sources = await desktopCapturer.getSources({
        types: ["screen"],
        thumbnailSize: { width: 1200, height: 900 },
      });
      if (sources[0]) {
        const png = sources[0].thumbnail.toPNG();
        const out = path.join(__dirname, "spike-shot.png");
        fs.writeFileSync(out, png);
        log(`SHOT sparad: ${out} (${png.length} bytes)`);
      } else {
        log("SHOT: ingen skärmkälla hittades");
      }
      setTimeout(() => app.quit(), 300);
    });
  }
});

app.on("window-all-closed", () => app.quit());
