import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  addBlock,
  createDocument,
  createPageBlock,
  createTextBlock,
  type FlowDocument,
} from "@tabflow/domain";
import App from "./App";
import { IndexedDBBlobStore } from "./adapters/IndexedDBBlobStore";
import { LocalStorageDocumentStore } from "./adapters/LocalStorageDocumentStore";
import { MockSnapshotRenderer } from "./adapters/MockSnapshotRenderer";
import { BrowserTabController } from "./adapters/BrowserTabController";
import { systemClock, uuidIds } from "./lib/env";
import type { AppRuntime } from "./runtime";
import "./styles.css";

/**
 * Webb-runtime. Allt ligger lokalt i webbläsaren — localStorage för dokumentet,
 * IndexedDB för bilder — så den kan publiceras som en statisk sida utan konto,
 * server eller inloggning. Inget lämnar datorn.
 */
function createWebRuntime(): AppRuntime {
  const blobs = new IndexedDBBlobStore();
  return {
    blobs,
    renderer: new MockSnapshotRenderer(blobs),
    store: new LocalStorageDocumentStore(),
    tabs: new BrowserTabController(),
    seedDocument,
  };
}

function seedDocument(): FlowDocument {
  const deps = { ids: uuidIds, clock: systemClock };
  let doc = createDocument({ title: "Min research", tags: ["demo"] }, deps);

  const text = (markdown: string) => {
    doc = addBlock(doc, createTextBlock({ markdown }, deps), { at: "bottom" }, deps);
  };
  const page = (url: string, title: string) => {
    doc = addBlock(doc, createPageBlock({ url, title }, deps), { at: "bottom" }, deps);
  };

  text(
    "# TabFlow\n" +
      "En **anteckningsbok där webbsidor är block**. Skriv i Markdown, lägg in " +
      "referenser där de hör hemma, och läs alltihop som ett enda flöde.\n\n" +
      "Allt sparas lokalt i din webbläsare. Ingen inloggning, ingen server — " +
      "stäng fliken och kom tillbaka, det ligger kvar.",
  );
  text(
    "## Prova\n" +
      "- **Klicka i den här texten** för att redigera den. Esc eller Cmd+Enter renderar.\n" +
      "- **Text** uppe till höger visar hela anteckningsboken som råtext: " +
      "markdown-snuttar varvat med URL-rader. Klistra in en länklista och spara.\n" +
      "- Håll musen mellan två block för att skjuta in nytt.\n" +
      "- **↗** öppnar sidan, **📷** sparar en kopia i blocket.",
  );
  page("https://sv.wikipedia.org/wiki/Anteckningsbok", "Anteckningsbok – Wikipedia");
  text(
    "## Vad du inte får här\n" +
      "Den här versionen kör i en vanlig webbläsare, och en webbläsare får inte " +
      "bädda in andras sidor — de flesta sajter förbjuder det uttryckligen. Därför " +
      "visas referenser som kort, och 📷 sparar en platshållarkopia.\n\n" +
      "I skrivbordsversionen är samma block ett **riktigt, levande webbläsarfönster**, " +
      "och 📷 arkiverar hela sidan med bilder och stil.",
  );
  return doc;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App runtime={createWebRuntime()} />
  </StrictMode>,
);
