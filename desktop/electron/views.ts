/**
 * Livscykel och positionering för levande sidvyer (Spår B, F-LAZY / F-PERF).
 *
 * Detta är produktionsvarianten av det Spike E1 bevisade. Arbetsfördelningen är
 * densamma som i spiken, för det var den som visade sig hålla:
 *   - Renderaren äger scroll, virtualisering och layout. Den skickar hela mängden
 *     monterade sidblock med färdigklippta rektangler varje scroll-frame.
 *   - Main-processen äger de native vyerna: skapar, positionerar, döljer, disposar.
 *
 * Två fynd från spiken är inbyggda här:
 *   1. En WebContentsView klipps INTE av renderarens scroll-container. Renderaren
 *      skickar därför en redan klippt rect, och `bounds: null` betyder "inte synlig".
 *   2. Inget DOM kan ritas ovanpå vyn. Därför döljs vyn helt när blocket visar
 *      snapshot — då är det DOM-bilden som gäller och native-lagret får inte skymma.
 */
import { BrowserWindow, WebContentsView, app, shell } from "electron";
import { GUEST_PARTITION, GUEST_USER_AGENT } from "./guest";

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SyncItem {
  blockId: string;
  url: string;
  /** Färdigklippt rect i DIP, eller null när blocket inte ska visa något live. */
  bounds: Bounds | null;
}

export interface SyncResult {
  liveIds: string[];
  liveCount: number;
  processCount: number;
}

interface Entry {
  view: WebContentsView;
  url: string;
  lastActive: number;
  visible: boolean;
}

/** Tak för samtidigt levande vyer (F-PERF-4). Äldst oanvänd avlastas först. */
export const LIVE_CAP = 3;

export class ViewManager {
  private views = new Map<string, Entry>();
  private tick = 0;

  constructor(private win: BrowserWindow) {}

  get liveCount(): number {
    return this.views.size;
  }

  /** Sanning per frame: exakt de block renderaren skickar får finnas. */
  sync(items: SyncItem[]): SyncResult {
    const wanted = new Set(items.map((i) => i.blockId));
    for (const id of [...this.views.keys()]) {
      if (!wanted.has(id)) this.dispose(id, "avmonterat block");
    }

    for (const item of items) {
      if (!item.bounds) {
        this.hide(item.blockId);
        continue;
      }
      const entry = this.ensure(item.blockId, item.url);
      if (!entry) continue;
      entry.view.setBounds(item.bounds);
      this.show(item.blockId);
    }

    return {
      liveIds: [...this.views.keys()],
      liveCount: this.views.size,
      processCount: app.getAppMetrics().length,
    };
  }

  /** Vyn för ett block, om den lever just nu (används för snapshot av det man ser). */
  peek(blockId: string): WebContentsView | null {
    return this.views.get(blockId)?.view ?? null;
  }

  async reload(blockId: string): Promise<void> {
    const entry = this.views.get(blockId);
    if (!entry) return;
    entry.view.webContents.reload();
  }

  disposeAll(): void {
    for (const id of [...this.views.keys()]) this.dispose(id, "nedstängning");
  }

  // --- privat -------------------------------------------------------------

  private ensure(blockId: string, url: string): Entry | null {
    const existing = this.views.get(blockId);
    if (existing) {
      if (existing.url !== url) {
        // Blockets URL har ändrats — bygg om vyn hellre än att navigera, så att
        // historik och sessionstillstånd inte läcker mellan två olika sidor.
        this.dispose(blockId, "URL ändrad");
      } else {
        existing.lastActive = ++this.tick;
        return existing;
      }
    }

    this.evictIfNeeded();
    const view = new WebContentsView({
      webPreferences: {
        partition: GUEST_PARTITION,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
      },
    });
    const wc = view.webContents;
    wc.setUserAgent(GUEST_USER_AGENT);
    // Popup-försök från en fångad sida ska aldrig öppna fönster i appen (avsnitt 9).
    wc.setWindowOpenHandler(({ url: target }) => {
      if (/^https?:/i.test(target)) void shell.openExternal(target);
      return { action: "deny" };
    });

    this.win.contentView.addChildView(view);
    view.setVisible(false);
    wc.loadURL(url).catch((e) => console.error("[tabflow] loadURL", blockId, e.message));

    const entry: Entry = { view, url, lastActive: ++this.tick, visible: false };
    this.views.set(blockId, entry);
    return entry;
  }

  private evictIfNeeded(): void {
    while (this.views.size >= LIVE_CAP) {
      let oldestId: string | null = null;
      let oldest = Infinity;
      for (const [id, e] of this.views) {
        if (e.lastActive < oldest) {
          oldest = e.lastActive;
          oldestId = id;
        }
      }
      if (oldestId == null) break;
      this.dispose(oldestId, "LRU — taket nått");
    }
  }

  private show(blockId: string): void {
    const entry = this.views.get(blockId);
    if (!entry || entry.visible) return;
    entry.view.setVisible(true);
    entry.visible = true;
  }

  /** Dölj utan att slänga processen — blocket är monterat men inte synligt just nu. */
  private hide(blockId: string): void {
    const entry = this.views.get(blockId);
    if (!entry || !entry.visible) return;
    entry.view.setVisible(false);
    entry.visible = false;
  }

  private dispose(blockId: string, reason: string): void {
    const entry = this.views.get(blockId);
    if (!entry) return;
    this.views.delete(blockId);
    try {
      this.win.contentView.removeChildView(entry.view);
    } catch (e) {
      console.error("[tabflow] removeChildView", (e as Error).message);
    }
    // Frigör guest-processen på riktigt, inte bara dölj den (F-LAZY-5).
    try {
      entry.view.webContents.close();
    } catch {
      try {
        (entry.view.webContents as { destroy?: () => void }).destroy?.();
      } catch {
        /* redan borta */
      }
    }
    console.log(`[tabflow] dispose ${blockId} (${reason}); live=${this.views.size}`);
  }
}
