import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@tabflow/app/App";
import type { AppRuntime } from "@tabflow/app/runtime";
import { IndexedDBBlobStore } from "@tabflow/app/adapters/IndexedDBBlobStore";
import "@tabflow/app/styles.css";
import { ChromeStorageDocumentStore } from "./adapters/ChromeStorageDocumentStore";
import { ChromeSnapshotRenderer } from "./adapters/ChromeSnapshotRenderer";
import { ChromeTabController } from "./adapters/ChromeTabController";

/** Spår A-runtime: IndexedDB-blobar, chrome.storage-dokument, snapshot-renderare. */
function createChromeRuntime(): AppRuntime {
  const blobs = new IndexedDBBlobStore();
  return {
    blobs,
    renderer: new ChromeSnapshotRenderer(blobs),
    store: new ChromeStorageDocumentStore(),
    tabs: new ChromeTabController(),
  };
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App runtime={createChromeRuntime()} />
  </StrictMode>,
);
