import type { BlobStore, DocumentStore, SidblockRenderer, TabController } from "./ports";

/**
 * Allt spårspecifikt samlat på ett ställe. `App` tar en `AppRuntime` och känner
 * aldrig till om den kör i webbläsaren (dev), en Chrome-extension (Spår A) eller
 * Electron (Spår B). Varje spår levererar sin egen fabrik.
 */
export interface AppRuntime {
  blobs: BlobStore;
  renderer: SidblockRenderer;
  store: DocumentStore;
  tabs: TabController;
}
