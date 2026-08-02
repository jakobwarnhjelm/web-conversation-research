/**
 * Main-processen för Spår B. Äger fönstret, de native sidvyerna, filsystems-
 * lagringen och fångsten. Renderaren (samma React-UI som app/) når allt detta
 * enbart genom den smala bryggan i preload.ts — ingen nodeIntegration.
 */
import { BrowserWindow, app, ipcMain, shell } from "electron";
import path from "node:path";
import { captureLiveView, captureUrlOffscreen, type CaptureResult } from "./capture";
import { clearGuestSession, hardenGuestSession } from "./guest";
import {
  blobFilePath,
  deleteBlob,
  deleteDocument,
  getBlob,
  initStorage,
  listDocuments,
  loadDocument,
  putBlob,
  saveDocument,
  type DocumentSummary,
} from "./storage";
import { ViewManager, type SyncItem } from "./views";

// Namnet styr var userData hamnar. Sätts explicit så att en körning från källkod
// och en installerad TabFlow delar samma dokument och blobbar.
app.setName("TabFlow");

let win: BrowserWindow | null = null;
let views: ViewManager | null = null;

function createWindow(): void {
  win = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 720,
    minHeight: 480,
    backgroundColor: "#0d1117",
    title: "TabFlow",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // preload behöver require av electron-modulen
    },
  });

  views = new ViewManager(win);

  // Appens egen renderare får aldrig navigera bort eller öppna fönster.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });

  // Bara i utveckling. Renderaren bär hela window.tabflow-bryggan, så en miljö-
  // variabel får aldrig kunna styra in fjärrkod i den i ett installerat bygge.
  const devUrl = app.isPackaged ? undefined : process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    void win.loadURL(devUrl);
  } else {
    void win.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  }

  win.on("closed", () => {
    views?.disposeAll();
    views = null;
    win = null;
  });
}

function requireViews(): ViewManager {
  if (!views) throw new Error("Inget fönster är öppet");
  return views;
}

function registerIpc(): void {
  ipcMain.handle("tabflow:views:sync", (_e, items: SyncItem[]) => requireViews().sync(items ?? []));

  ipcMain.handle("tabflow:views:reload", async (_e, blockId: string) => {
    await requireViews().reload(blockId);
  });

  ipcMain.handle(
    "tabflow:capture",
    async (
      _e,
      arg: { blockId: string | null; url: string; archive?: boolean },
    ): Promise<CaptureResult> => {
      const options = { archive: arg.archive === true };
      // Utan block-id (batchfångst) finns ingen levande vy att fånga — då laddas
      // sidan i ett dolt fönster, vilket ändå gäller för allt som inte är i vy.
      const live = arg.blockId ? (views?.peek(arg.blockId) ?? null) : null;
      return live
        ? await captureLiveView(live, arg.url, options)
        : await captureUrlOffscreen(arg.url, options);
    },
  );

  ipcMain.handle("tabflow:session:clear", async () => {
    await clearGuestSession();
    // Vyerna håller kvar den gamla sessionen tills de byggs om.
    views?.disposeAll();
  });

  ipcMain.handle("tabflow:docs:list", () => listDocuments());
  ipcMain.handle("tabflow:docs:load", (_e, id: string) => loadDocument(id));
  ipcMain.handle("tabflow:docs:save", (_e, arg: { summary: DocumentSummary; json: string }) =>
    saveDocument(arg.summary, arg.json),
  );
  ipcMain.handle("tabflow:docs:delete", (_e, id: string) => deleteDocument(id));

  ipcMain.handle("tabflow:blobs:put", (_e, arg: { bytes: Uint8Array; mime: string }) =>
    putBlob(arg.bytes, arg.mime),
  );
  ipcMain.handle("tabflow:blobs:get", (_e, ref: string) => getBlob(ref));
  ipcMain.handle("tabflow:blobs:delete", (_e, ref: string) => deleteBlob(ref));

  // Snapshot-artefakterna är riktiga filer. "Öppna" lämnar dem till systemet
  // (text-HTML i webbläsaren, PNG i bildvisaren); "visa" pekar ut dem i Finder.
  ipcMain.handle("tabflow:blobs:open", async (_e, ref: string) => {
    const err = await shell.openPath(blobFilePath(ref));
    if (err) throw new Error(err);
  });
  ipcMain.handle("tabflow:blobs:reveal", (_e, ref: string) => {
    shell.showItemInFolder(blobFilePath(ref));
  });

  ipcMain.handle("tabflow:shell:open", (_e, url: string) => {
    if (/^https?:/i.test(url)) void shell.openExternal(url);
  });
}

void app.whenReady().then(async () => {
  await initStorage();
  // Måste ske innan någon gästvy hinner skapas.
  hardenGuestSession();

  registerIpc();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
