import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  addBlock,
  createDocument,
  createPageBlock,
  createTextBlock,
  type FlowDocument,
} from "@tabflow/domain";
import App from "@tabflow/app/App";
import type { AppRuntime } from "@tabflow/app/runtime";
import { systemClock, uuidIds } from "@tabflow/app/lib/env";
import "@tabflow/app/styles.css";
import { IpcBlobStore } from "./adapters/IpcBlobStore";
import { IpcDocumentStore } from "./adapters/IpcDocumentStore";
import { ShellTabController } from "./adapters/ShellTabController";
import { WebviewRenderer } from "./adapters/WebviewRenderer";

/** Startdokument med riktiga, levande sidor — det Spår B finns för. */
function seedDocument(): FlowDocument {
  const deps = { ids: uuidIds, clock: systemClock };
  let doc = createDocument({ title: "Mitt flöde", tags: ["research"] }, deps);
  doc = addBlock(
    doc,
    createTextBlock(
      {
        markdown:
          "# Levande flöde\nSidorna nedan är riktiga webbläsarfönster. Tre kan vara vakna " +
          "samtidigt — resten avlastas och väcks när du scrollar tillbaka.",
      },
      deps,
    ),
    { at: "bottom" },
    deps,
  );
  for (const [url, title] of [
    ["https://www.google.se", "Google"],
    ["https://sv.wikipedia.org/wiki/Webbläsare", "Wikipedia — Webbläsare"],
    ["https://news.ycombinator.com", "Hacker News"],
  ] as const) {
    doc = addBlock(doc, createPageBlock({ url, title, mode: "live" }, deps), { at: "bottom" }, deps);
  }
  return doc;
}

function createElectronRuntime(): AppRuntime {
  const blobs = new IpcBlobStore();
  return {
    blobs,
    renderer: new WebviewRenderer(blobs),
    store: new IpcDocumentStore(),
    tabs: new ShellTabController(),
    defaultPageMode: "live",
    seedDocument,
  };
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App runtime={createElectronRuntime()} />
  </StrictMode>,
);
