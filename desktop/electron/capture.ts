/**
 * Snapshot-fångst för Spår B (F-SNAP-1, dubbel artefakt).
 *
 * Två vägar, och skillnaden är ärlig mot `fullPage`-flaggan i domänen:
 *   - Blocket är redan live → fånga den vy användaren tittar på. Snabbt, men bara
 *     det som ryms i blockets rect, alltså `fullPage: false`.
 *   - Blocket har ingen levande vy → ladda URL:en i ett dolt fönster som storleks-
 *     ändras till hela dokumenthöjden och fånga där. Ger `fullPage: true` (F-SNAP-8).
 *
 * Här slipper Spår B det som stoppar Spår A: ingen flik behöver bli aktiv, inget
 * flimmer, ingen host-behörighet. Dödsstöt 2 finns helt enkelt inte i Electron.
 */
import { BrowserWindow, WebContents, WebContentsView } from "electron";
import { GRAB_READABLE_EXPR } from "./readable";
import { GUEST_PARTITION, GUEST_USER_AGENT } from "./guest";
import { putBlob, reserveBlobRef } from "./storage";

export interface CaptureResult {
  imageRef: string;
  textHtmlRef: string;
  /** Helsidearkiv (MHTML) med inline:ade resurser, F-SNAP-9. null om det misslyckades. */
  singleFileRef: string | null;
  title: string;
  capturedAt: string;
  fullPage: boolean;
}

const CAPTURE_WIDTH = 1280;
const CAPTURE_MIN_HEIGHT = 800;
/** Tak så att en oändligt scrollande sida inte äter minnet. */
const CAPTURE_MAX_HEIGHT = 8000;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Extracted {
  title: string;
  textHtml: string;
  url: string;
}

async function extract(wc: WebContents, fallbackUrl: string): Promise<Extracted> {
  try {
    return (await wc.executeJavaScript(GRAB_READABLE_EXPR, false)) as Extracted;
  } catch (e) {
    console.error("[tabflow] extraktion misslyckades", (e as Error).message);
    return {
      title: wc.getTitle() || fallbackUrl,
      textHtml:
        `<!doctype html><html lang="sv"><head><meta charset="utf-8">` +
        `<title>${wc.getTitle() || fallbackUrl}</title></head><body>` +
        `<p>(textextraktion misslyckades för ${fallbackUrl})</p></body></html>`,
      url: fallbackUrl,
    };
  }
}

/**
 * Helsidearkiv (F-SNAP-9). Chromiums egen MHTML-serialisering packar HTML, CSS,
 * bilder och typsnitt i EN fil — samma idé som SingleFile, men inbyggd. Det är
 * det enda av de tre artefakterna som bevarar sidan som den faktiskt såg ut.
 */
async function archive(wc: WebContents): Promise<string | null> {
  try {
    const { ref, path } = reserveBlobRef("multipart/related");
    await wc.savePage(path, "MHTML");
    return ref;
  } catch (e) {
    console.error("[tabflow] MHTML-arkivering misslyckades", (e as Error).message);
    return null;
  }
}

async function store(
  png: Buffer,
  ex: Extracted,
  singleFileRef: string | null,
  fullPage: boolean,
): Promise<CaptureResult> {
  const imageRef = await putBlob(png, "image/png");
  const textHtmlRef = await putBlob(Buffer.from(ex.textHtml, "utf8"), "text/html");
  return {
    imageRef,
    textHtmlRef,
    singleFileRef,
    title: ex.title,
    capturedAt: new Date().toISOString(),
    fullPage,
  };
}

/** Fånga en vy som redan visas i flödet. */
export async function captureLiveView(view: WebContentsView, url: string): Promise<CaptureResult> {
  const wc = view.webContents;
  const image = await wc.capturePage();
  const ex = await extract(wc, url);
  const single = await archive(wc);
  return await store(image.toPNG(), ex, single, false);
}

/** Ladda en URL i ett dolt fönster och fånga hela sidhöjden. */
export async function captureUrlOffscreen(url: string): Promise<CaptureResult> {
  const win = new BrowserWindow({
    show: false,
    width: CAPTURE_WIDTH,
    height: CAPTURE_MIN_HEIGHT,
    webPreferences: {
      partition: GUEST_PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  try {
    win.webContents.setUserAgent(GUEST_USER_AGENT);
    await win.loadURL(url);
    await delay(600); // låt webbtypsnitt, bilder och sen layout landa

    const measured = (await win.webContents
      .executeJavaScript(
        "Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0)",
        false,
      )
      .catch(() => CAPTURE_MIN_HEIGHT)) as number;

    const height = Math.min(Math.max(Math.round(measured) || CAPTURE_MIN_HEIGHT, CAPTURE_MIN_HEIGHT), CAPTURE_MAX_HEIGHT);
    const fullPage = height >= measured;
    win.setContentSize(CAPTURE_WIDTH, height);
    await delay(400); // omlayout efter storleksändringen

    const image = await win.webContents.capturePage();
    const ex = await extract(win.webContents, url);
    const single = await archive(win.webContents);
    return await store(image.toPNG(), ex, single, fullPage);
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}
