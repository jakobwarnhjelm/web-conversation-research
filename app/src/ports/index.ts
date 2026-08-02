/**
 * Portar (avsnitt 6.1–6.2). Detta är gränssnitten som skiljer spåren. UI:t och
 * domänen beror bara på dessa — aldrig på Chrome- eller Electron-API direkt.
 *
 * Designen är INFORMERAD AV SPIKE E1: en `WebContentsView` är ett native-lager
 * som inget DOM kan ritas ovanpå. Därför:
 *   - Renderaren får en `SidblockHost` med (a) en DOM-container för blockets *chrome*
 *     och snapshot-bild, och (b) `getContentRect()` som ger rektangeln där live-innehållet
 *     ska ligga. Spår B driver sin native-vy mot den rekten; chrome ligger utanför.
 *   - `SidblockHandle.syncBounds()` anropas av FlowView vid scroll/omlayout så att en
 *     ev. native-vy följer med. I Spår A är den en no-op.
 */
import type {
  BlockHeight,
  FlowDocument,
  PageBlock,
  RenderDisplay,
  SnapshotArtifact,
} from "@tabflow/domain";

/** Livscykeltillstånd per sidblock (avsnitt 7.1). Driver lazy-loading. */
export type LifecycleState = "unloaded" | "warm" | "active";

export interface CaptureOptions {
  /**
   * Spara även ett helsidearkiv (F-SNAP-9). Av som förval: arkivet bevarar sidan
   * exakt som den såg ut, vilket för en inloggad sida betyder dolda formulärfält,
   * inbäddad JSON om användaren och resurser hämtade med sessionens kakor. Ett
   * spår som inte kan producera arkiv ignorerar flaggan och svarar med null.
   */
  archive?: boolean;
}

/**
 * Fångst utan monterat sidblock. Flödet är virtualiserat, så handtag finns bara
 * för block som råkar vara i vy — en "fånga alla" måste därför gå vid sidan av
 * dem. Valfri: spår som inte kan fånga på egen hand utelämnar den, och
 * gränssnittet döljer då funktionen.
 */
export interface SnapshotService {
  capture(url: string, options?: CaptureOptions): Promise<SnapshotArtifact>;
}

/** Sessionen som inbäddade sidor delar. Bär användarens inloggningar. */
export interface GuestSessionController {
  /** Rensar kakor, lagring och cache — loggar ut från alla sidor. */
  clearAll(): Promise<void>;
}

export interface SidblockHost {
  /** DOM-container i flödet för blockets chrome (huvud) + ev. snapshot-bild. */
  readonly container: HTMLElement;
  /**
   * Rektangel (skärmkoordinater) där live-INNEHÅLLET ska ligga — utanför chrome-remsan.
   * Spår B använder den för `WebContentsView.setBounds()`. Spår A ignorerar den.
   */
  getContentRect(): DOMRectReadOnly;
  /**
   * Den synliga ytan som innehållet måste klippas mot (scroll-containerns rect).
   * Spike E1: native-lager klipper INTE mot en scroll-container av sig själva, så
   * värden måste räknas ut av den som äger layouten. Spår A ignorerar den.
   */
  getClipRect(): DOMRectReadOnly;
}

export interface SidblockRenderer {
  /** Kort etikett för felsökning/telemetri (t.ex. "chrome-snapshot", "electron-webview"). */
  readonly kind: string;
  render(block: PageBlock, host: SidblockHost): SidblockHandle;
}

export interface SidblockHandle {
  /** Blockets data har ändrats (ny snapshot, höjd, display) — läs om från blocket. */
  update(block: PageBlock): void;
  /** Hämta om / förnya (reload live-vy eller re-fetcha snapshot). F-SID-6. */
  refresh(): Promise<void>;
  /** Skapa en snapshot: dubbel artefakt (bild + text-HTML). F-SNAP-1. */
  snapshot(options?: CaptureOptions): Promise<SnapshotArtifact>;
  /** Växla vilken artefakt som visas (live/snapshot) per block. F-SNAPWF-8. */
  setDisplay(display: RenderDisplay): void;
  /** Driver lazy-loading: ladda/avlasta faktiska resurser. F-LAZY-2/5. */
  setLifecycle(state: LifecycleState): void;
  /** Reposition ev. native-vy mot host.getContentRect(). No-op i Spår A. */
  syncBounds(): void;
  setHeight(h: BlockHeight): void;
  /** Frigör faktiska resurser (webview/blob-URL). F-LAZY-5. */
  dispose(): void;
}

/**
 * Lagring av binära artefakter (bilder, text-HTML). Referenser (`ref`) läggs i
 * dokument-JSON; själva blobarna lever här (IndexedDB i Spår A, filsystem i Spår B).
 */
export interface BlobStore {
  put(blob: Blob): Promise<string>; // returnerar ref
  get(ref: string): Promise<Blob | null>;
  delete(ref: string): Promise<void>;
  /** Object-URL för visning. Måste släppas via releaseUrl (F-LAZY-5). */
  objectUrl(ref: string): Promise<string | null>;
  releaseUrl(url: string): void;
}

export interface DocumentSummary {
  id: string;
  title: string;
  updatedAt: string;
  tags: string[];
}

/** Persistens av dokument-JSON. Autospar bygger på save() (F-UX-7). */
export interface DocumentStore {
  list(): Promise<DocumentSummary[]>;
  load(id: string): Promise<FlowDocument | null>;
  save(doc: FlowDocument): Promise<void>;
  delete(id: string): Promise<void>;
}

/** Öppna en URL som en vanlig webbläsarflik (F-SID-4). */
export interface TabController {
  open(url: string): void;
}

/** Extraherar avskalad, fristående text-HTML ur en sid-DOM/HTML (F-SNAP-3). */
export interface PageSource {
  url: string;
  /** Rå HTML eller ett Document; adaptern väljer. */
  html?: string;
  document?: Document;
}

export interface TextHtmlExtractor {
  extract(source: PageSource): Promise<string>;
}
