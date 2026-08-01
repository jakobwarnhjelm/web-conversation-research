import type { FlowDocument } from "@tabflow/domain";
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
  /**
   * Läge för nya sidblock. Spår B har levande vyer och sätter "live"; Spår A och
   * dev-attrappen kan bara visa stillbilder och lämnar default ("snapshot").
   */
  defaultPageMode?: "live" | "snapshot";
  /** Dokument att skapa när lagringen är tom. Låter varje spår välja sitt startinnehåll. */
  seedDocument?: () => FlowDocument;
}
