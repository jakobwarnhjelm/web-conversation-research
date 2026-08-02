import {
  type BlockHeight,
  type PageBlock,
  type RenderDisplay,
  type SnapshotArtifact,
} from "@tabflow/domain";
import type {
  BlobStore,
  CaptureOptions,
  LifecycleState,
  SidblockHandle,
  SidblockHost,
  SidblockRenderer,
  SnapshotService,
} from "@tabflow/app/ports";
import { bridge, type Bounds, type SyncItem } from "../bridge";

/**
 * Spår B-renderare (M4): varje sidblock som visar live backas av en riktig
 * `WebContentsView` i main-processen.
 *
 * Spike E1 avgjorde arbetsfördelningen: renderaren äger layouten och main äger
 * vyerna. Handtaget här håller därför ingen vy — det anmäler blockets URL och
 * var på skärmen innehållet ska ligga, och en delad brygga skickar hela mängden
 * som ett anrop per frame. Ett anrop per block och frame skulle bli en storm av
 * IPC vid scroll.
 *
 * DOM-containern används bara till det som INTE kan ligga under native-lagret:
 * snapshot-bilden och platshållartexterna. Så fort blocket visar live måste den
 * vara tom, för allt som ritas där hamnar bakom vyn ändå (spikens fynd).
 */

interface Registration {
  url: string;
  /** Vill blocket ha ett levande native-lager just nu? */
  live: boolean;
  getContentRect: () => DOMRectReadOnly;
  getClipRect: () => DOMRectReadOnly;
}

class ViewBridge {
  private entries = new Map<string, Registration>();
  private frame = 0;
  private inFlight = false;
  private dirty = false;

  set(blockId: string, reg: Registration): void {
    this.entries.set(blockId, reg);
    this.schedule();
  }

  remove(blockId: string): void {
    if (this.entries.delete(blockId)) this.schedule();
  }

  schedule(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      void this.flush();
    });
  }

  private async flush(): Promise<void> {
    // Ett sync-anrop i taget. Scroll producerar frames snabbare än IPC hinner
    // svara, och då ska den senaste layouten vinna — inte köa upp gamla frames.
    if (this.inFlight) {
      this.dirty = true;
      return;
    }
    this.inFlight = true;
    try {
      const items: SyncItem[] = [];
      for (const [blockId, reg] of this.entries) {
        items.push({ blockId, url: reg.url, bounds: reg.live ? clip(reg) : null });
      }
      await bridge().views.sync(items);
    } catch (e) {
      console.error("[tabflow] views.sync misslyckades", e);
    } finally {
      this.inFlight = false;
      if (this.dirty) {
        this.dirty = false;
        this.schedule();
      }
    }
  }
}

/** Blockets rect skuret mot scroll-ytan. null = ingenting synligt att visa. */
function clip(reg: Registration): Bounds | null {
  const r = reg.getContentRect();
  const c = reg.getClipRect();
  const top = Math.max(r.top, c.top);
  const bottom = Math.min(r.bottom, c.bottom);
  const left = Math.max(r.left, c.left);
  const right = Math.min(r.right, c.right);
  const width = Math.round(right - left);
  const height = Math.round(bottom - top);
  if (width <= 1 || height <= 1) return null;
  return { x: Math.round(left), y: Math.round(top), width, height };
}

const sharedBridge = new ViewBridge();

/**
 * Fångst utan monterat block, för "Fånga alla". Sidan laddas i ett dolt fönster i
 * main-processen, som köar anropen så att en lång anteckning inte startar ett
 * tjugotal renderprocesser samtidigt.
 */
export class IpcSnapshotService implements SnapshotService {
  async capture(url: string, options?: CaptureOptions): Promise<SnapshotArtifact> {
    const r = await bridge().capture(null, url, options);
    return {
      imageRef: r.imageRef,
      textHtmlRef: r.textHtmlRef,
      singleFileRef: r.singleFileRef,
      fullPage: r.fullPage,
      capturedAt: r.capturedAt,
    };
  }
}

export class WebviewRenderer implements SidblockRenderer {
  readonly kind = "electron-webview";
  constructor(private blobs: BlobStore) {}
  render(block: PageBlock, host: SidblockHost): SidblockHandle {
    return new WebviewHandle(block, host, this.blobs);
  }
}

class WebviewHandle implements SidblockHandle {
  private el: HTMLDivElement;
  private objUrl: string | null = null;
  private lifecycle: LifecycleState = "warm";
  private disposed = false;

  constructor(
    private block: PageBlock,
    private host: SidblockHost,
    private blobs: BlobStore,
  ) {
    this.el = document.createElement("div");
    this.el.style.cssText = "width:100%;height:100%;position:relative;overflow:hidden;";
    host.container.appendChild(this.el);
    this.publish();
    void this.paint();
  }

  update(block: PageBlock): void {
    this.block = block;
    this.publish();
    void this.paint();
  }

  async refresh(): Promise<void> {
    if (this.wantsLive()) {
      await bridge().views.reload(this.block.id);
      return;
    }
    await this.snapshot();
  }

  setDisplay(_display: RenderDisplay): void {
    // Blocket är sanningen; update() har redan skrivit det nya värdet.
    this.publish();
    void this.paint();
  }

  setLifecycle(state: LifecycleState): void {
    this.lifecycle = state;
    if (state === "unloaded") this.release();
    this.publish();
    void this.paint();
  }

  syncBounds(): void {
    if (!this.disposed) sharedBridge.schedule();
  }

  setHeight(_h: BlockHeight): void {
    this.syncBounds();
  }

  async snapshot(options?: CaptureOptions): Promise<SnapshotArtifact> {
    const r = await bridge().capture(this.block.id, this.block.url, options);
    return {
      imageRef: r.imageRef,
      textHtmlRef: r.textHtmlRef,
      singleFileRef: r.singleFileRef,
      fullPage: r.fullPage,
      capturedAt: r.capturedAt,
    };
  }

  dispose(): void {
    this.disposed = true;
    sharedBridge.remove(this.block.id);
    this.release();
    this.el.remove();
  }

  // --- privat -------------------------------------------------------------

  private wantsLive(): boolean {
    return this.block.render.display === "live" && this.lifecycle !== "unloaded";
  }

  private publish(): void {
    if (this.disposed) return;
    sharedBridge.set(this.block.id, {
      url: this.block.url,
      live: this.wantsLive(),
      getContentRect: () => this.host.getContentRect(),
      getClipRect: () => this.host.getClipRect(),
    });
  }

  private wireArtifactBar(textHtmlRef: string, singleFileRef: string | null): void {
    const open = (ref: string) => () => {
      void bridge().blobs.open(ref).catch((e) => console.error("[tabflow] kunde inte öppna", e));
    };
    this.el.querySelector(".tf-text")?.addEventListener("click", open(textHtmlRef));
    if (singleFileRef) {
      this.el.querySelector(".tf-archive")?.addEventListener("click", open(singleFileRef));
    }
    this.el.querySelector(".tf-reveal")?.addEventListener("click", () => {
      void bridge().blobs.reveal(singleFileRef ?? textHtmlRef);
    });
  }

  private release(): void {
    if (this.objUrl) {
      this.blobs.releaseUrl(this.objUrl);
      this.objUrl = null;
    }
  }

  private async paint(): Promise<void> {
    if (this.disposed) return;

    if (this.wantsLive()) {
      // Native-lagret täcker den här ytan. Platshållaren syns bara innan vyn
      // hunnit måla, eller när LRU-taket avlastat just det här blocket.
      this.release();
      this.el.innerHTML = ph("▶ Live", this.block.url);
      return;
    }

    if (this.lifecycle === "unloaded") {
      this.el.innerHTML = ph("Avlastad — scrolla in för att ladda", this.block.url);
      return;
    }

    const snap = this.block.render.snapshot;
    if (snap) {
      const url = await this.blobs.objectUrl(snap.imageRef);
      if (this.disposed) {
        if (url) this.blobs.releaseUrl(url);
        return;
      }
      this.release();
      if (url) {
        this.objUrl = url;
        const fit = snap.fullPage
          ? "width:100%;height:auto"
          : "width:100%;height:100%;object-fit:cover;object-position:top";
        this.el.style.overflow = snap.fullPage ? "auto" : "hidden";
        this.el.innerHTML =
          `<img src="${url}" alt="Snapshot av ${escapeHtml(this.block.title)}" style="display:block;${fit}" />` +
          artifactBar(snap.singleFileRef !== null);
        this.wireArtifactBar(snap.textHtmlRef, snap.singleFileRef);
        return;
      }
    }

    this.el.innerHTML = ph("Ingen snapshot än — klicka 📷 i huvudet", this.block.url);
  }
}

/**
 * Snapshotens tre artefakter är riktiga filer på disk. Utan den här remsan går de
 * inte att komma åt från appen — bilden syns, men textversionen och arkivet vore
 * osynliga trots att de fångades.
 */
function artifactBar(hasArchive: boolean): string {
  const btn = (cls: string, text: string) =>
    `<button class="${cls}" style="background:#161b22;color:#e6edf3;border:1px solid #2a3038;` +
    `border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer">${text}</button>`;
  return (
    `<div class="tf-artifacts" style="position:sticky;bottom:0;display:flex;gap:6px;` +
    `padding:8px;background:linear-gradient(transparent,#0d1117cc 40%)">` +
    btn("tf-text", "Visa textversion") +
    (hasArchive ? btn("tf-archive", "Öppna arkiv (hela sidan)") : "") +
    btn("tf-reveal", "Visa i Finder") +
    `</div>`
  );
}

function ph(msg: string, url: string): string {
  return (
    `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;` +
    `flex-direction:column;gap:6px;color:#6e7681;text-align:center;padding:16px;` +
    `background:repeating-linear-gradient(45deg,#0f151d,#0f151d 10px,#131a24 10px,#131a24 20px)">` +
    `<div style="font-size:13px">${escapeHtml(msg)}</div>` +
    `<div style="font-size:11px;opacity:.7">${escapeHtml(url)}</div></div>`
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}
