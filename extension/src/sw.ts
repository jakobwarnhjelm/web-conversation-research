/**
 * Service worker (Spår A, avsnitt 6.3). Två roller:
 *  1. Kontextmeny "Lägg till i TabFlow" → fånga aktiv flik → skapa sidblock med snapshot.
 *  2. Meddelande "captureUrl" → (om)fånga en URL för flow-sidans 📷/förnya (F-SID-6).
 *
 * All fångst producerar dubbel artefakt (F-SNAP-1): bild via captureVisibleTab +
 * text-HTML via injicerad grabReadable. SW saknar DOM, så extraktionen körs i sidan.
 */
import {
  addBlock,
  attachSnapshot,
  createDocument,
  createPageBlock,
  type FlowDocument,
} from "@tabflow/domain";
import { IndexedDBBlobStore } from "@tabflow/app/adapters/IndexedDBBlobStore";
import { ChromeStorageDocumentStore } from "./adapters/ChromeStorageDocumentStore";
import { grabReadable } from "./injected";
import type { CaptureResult, Request } from "./messages";

const blobs = new IndexedDBBlobStore();
const store = new ChromeStorageDocumentStore();

const ids = {
  block: () => "blk_" + crypto.randomUUID().slice(0, 8),
  document: () => "flow_" + crypto.randomUUID().slice(0, 8),
};
const clock = { now: () => new Date().toISOString() };

const MENU_ID = "tabflow-add";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Lägg till i TabFlow",
    contexts: ["page", "selection", "link"],
  });
});

// Klick på verktygsfältsikonen öppnar flow-sidan som en egen full-page-flik (6.3).
chrome.action.onClicked.addListener(() => {
  void chrome.tabs.create({ url: chrome.runtime.getURL("flow.html") });
});

// --- Fångst-primitiv -------------------------------------------------------

async function extractFromTab(tabId: number): Promise<{ title: string; textHtml: string; url: string }> {
  const [res] = await chrome.scripting.executeScript({ target: { tabId }, func: grabReadable });
  return res.result as { title: string; textHtml: string; url: string };
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return await (await fetch(dataUrl)).blob();
}

/** Fångar en flik som redan är synlig i sitt fönster. Returnerar lagrade referenser. */
async function captureVisibleTab(tab: chrome.tabs.Tab): Promise<CaptureResult> {
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId!, { format: "png" });
  const extracted = await extractFromTab(tab.id!);
  const imageRef = await blobs.put(await dataUrlToBlob(dataUrl));
  const textHtmlRef = await blobs.put(new Blob([extracted.textHtml], { type: "text/html" }));
  return { imageRef, textHtmlRef, title: extracted.title || tab.title || tab.url || "Sida", capturedAt: clock.now() };
}

function waitForComplete(tabId: number, timeoutMs = 15000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("Timeout vid sidladdning"));
    }, timeoutMs);
    const listener = (id: number, info: chrome.tabs.TabChangeInfo) => {
      if (id === tabId && info.status === "complete") {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

/**
 * (Om)fångar en URL som INTE är öppen: öppnar den i en aktiv flik, fångar, stänger.
 * Detta är enskild-block-varianten av batch-fångsten (dödsstöt 2) — flikväxlingen
 * flimrar och kan kräva bredare host-behörighet än activeTab. Spikas före F-SNAPWF.
 */
async function captureByUrl(url: string): Promise<CaptureResult> {
  const [prev] = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = await chrome.tabs.create({ url, active: true });
  try {
    await waitForComplete(tab.id!);
    const result = await captureVisibleTab(tab);
    return result;
  } finally {
    if (tab.id != null) await chrome.tabs.remove(tab.id);
    if (prev?.id != null) await chrome.tabs.update(prev.id, { active: true });
  }
}

// --- Målsätta dokument + skapa block ---------------------------------------

async function targetDocument(): Promise<FlowDocument> {
  const list = await store.list();
  if (list[0]) {
    const doc = await store.load(list[0].id);
    if (doc) return doc;
  }
  return createDocument({ title: "Inkorg" }, { ids, clock });
}

async function addCapturedBlock(cap: CaptureResult, url: string): Promise<void> {
  let doc = await targetDocument();
  const block = createPageBlock({ url, title: cap.title, mode: "snapshot" }, { ids });
  doc = addBlock(doc, block, { at: "bottom" }, { clock });
  doc = attachSnapshot(
    doc,
    block.id,
    { imageRef: cap.imageRef, textHtmlRef: cap.textHtmlRef, singleFileRef: null, fullPage: false, capturedAt: cap.capturedAt },
    { clock },
  );
  await store.save(doc);
}

async function flashBadge(text: string, color: string) {
  await chrome.action.setBadgeBackgroundColor({ color });
  await chrome.action.setBadgeText({ text });
  setTimeout(() => void chrome.action.setBadgeText({ text: "" }), 2500);
}

// --- Event-kopplingar ------------------------------------------------------

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id) return;
  try {
    const cap = await captureVisibleTab(tab);
    await addCapturedBlock(cap, tab.url ?? "");
    await flashBadge("✓", "#3fb950");
  } catch (e) {
    console.error("[tabflow] fångst misslyckades", e);
    await flashBadge("!", "#f85149");
  }
});

chrome.runtime.onMessage.addListener((req: Request, _sender, sendResponse) => {
  if (req?.type === "tabflow:captureUrl") {
    captureByUrl(req.url)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true; // asynkront svar
  }
  return false;
});
