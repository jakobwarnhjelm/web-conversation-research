import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { MemoryBlobStore } from "./adapters/MemoryBlobStore";
import { LocalStorageDocumentStore } from "./adapters/LocalStorageDocumentStore";
import { MockSnapshotRenderer } from "./adapters/MockSnapshotRenderer";
import { BrowserTabController } from "./adapters/BrowserTabController";
import type { AppRuntime } from "./runtime";
import "./styles.css";

/** Dev-runtime: mock-renderare + localStorage, körs i vanlig webbläsare. */
function createDevRuntime(): AppRuntime {
  const blobs = new MemoryBlobStore();
  return {
    blobs,
    renderer: new MockSnapshotRenderer(blobs),
    store: new LocalStorageDocumentStore(),
    tabs: new BrowserTabController(),
  };
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App runtime={createDevRuntime()} />
  </StrictMode>,
);
