import {
  HEIGHT_STEP_PX,
  type BlockHeight,
  type PageBlock,
  type RenderDisplay,
  type SnapshotArtifact,
} from "@tabflow/domain";
import type {
  BlobStore,
  LifecycleState,
  SidblockHandle,
  SidblockHost,
  SidblockRenderer,
} from "../ports";

function heightPx(h: BlockHeight): number {
  return typeof h === "number" ? h : HEIGHT_STEP_PX[h];
}

/**
 * DEV/M1-renderare. Ingen riktig fångst — den producerar en syntetisk "grafisk kopia"
 * (canvas) + en avskalad text-HTML, så hela dubbel-artefakt-flödet (F-SNAP-1) och
 * live/snapshot-växeln (F-SNAPWF-8) går att köra i webbläsaren innan Spår A finns.
 *
 * `ChromeSnapshotRenderer` (M2) och `WebviewRenderer` (M4) implementerar SAMMA port.
 */
export class MockSnapshotRenderer implements SidblockRenderer {
  readonly kind = "mock-snapshot";
  constructor(private blobs: BlobStore) {}

  render(block: PageBlock, host: SidblockHost): SidblockHandle {
    return new MockHandle(block, host, this.blobs);
  }
}

class MockHandle implements SidblockHandle {
  private el: HTMLDivElement;
  private objUrl: string | null = null;
  private lifecycle: LifecycleState = "warm";

  constructor(
    private block: PageBlock,
    host: SidblockHost,
    private blobs: BlobStore,
  ) {
    this.el = document.createElement("div");
    this.el.style.cssText = "width:100%;height:100%;position:relative;overflow:hidden;";
    host.container.appendChild(this.el);
    void this.paint();
  }

  update(block: PageBlock): void {
    this.block = block;
    void this.paint();
  }

  async refresh(): Promise<void> {
    await this.paint();
  }

  setDisplay(_display: RenderDisplay): void {
    // display lästs från blocket i paint(); update() driver ändringen.
    void this.paint();
  }

  setLifecycle(state: LifecycleState): void {
    this.lifecycle = state;
    if (state === "unloaded") this.releaseUrl();
    void this.paint();
  }

  syncBounds(): void {
    /* Spår A/mock: inget native-lager att flytta. */
  }

  setHeight(_h: BlockHeight): void {
    void this.paint();
  }

  async snapshot(): Promise<SnapshotArtifact> {
    const capturedAt = new Date().toISOString();
    const imageRef = await this.blobs.put(await this.renderCanvasBlob(capturedAt));
    const textHtmlRef = await this.blobs.put(this.renderTextHtmlBlob());
    return { imageRef, textHtmlRef, singleFileRef: null, fullPage: false, capturedAt };
  }

  dispose(): void {
    this.releaseUrl();
    this.el.remove();
  }

  // --- privat ---

  private releaseUrl() {
    if (this.objUrl) {
      this.blobs.releaseUrl(this.objUrl);
      this.objUrl = null;
    }
  }

  private async paint() {
    const { render } = this.block;
    if (this.lifecycle === "unloaded") {
      this.el.innerHTML = placeholder("Avlastad — scrolla in för att ladda", this.block);
      return;
    }
    if (render.display === "live") {
      this.el.innerHTML = placeholder("▶ Live-läge (renderas i Spår B / Electron)", this.block);
      return;
    }
    // display === "snapshot"
    if (render.snapshot) {
      const url = await this.blobs.objectUrl(render.snapshot.imageRef);
      this.releaseUrl();
      if (url) {
        this.objUrl = url;
        this.el.innerHTML =
          `<img src="${url}" alt="Snapshot av ${escapeHtml(this.block.title)}" ` +
          `style="display:block;width:100%;height:100%;object-fit:cover;object-position:top" />`;
        return;
      }
    }
    this.el.innerHTML = placeholder("↗ öppnar sidan · 📷 sparar en kopia", this.block);
  }

  private async renderCanvasBlob(capturedAt: string): Promise<Blob> {
    const w = 960;
    const h = Math.max(240, heightPx(this.block.height));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#0f1722";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#1f6feb";
    ctx.fillRect(0, 0, w, 6);
    ctx.fillStyle = "#e6edf3";
    ctx.font = "600 28px system-ui, sans-serif";
    ctx.fillText(truncate(this.block.title, 46), 32, 64);
    ctx.fillStyle = "#8b98a5";
    ctx.font = "16px system-ui, sans-serif";
    ctx.fillText(truncate(this.block.url, 70), 32, 96);
    ctx.fillText(`(mock-snapshot · ${capturedAt})`, 32, h - 24);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
    return blob ?? new Blob([], { type: "image/png" });
  }

  private renderTextHtmlBlob(): Blob {
    // Avskalad, fristående text-HTML (F-SNAP-3): titel, url, läsbart innehåll, inga skript.
    const html =
      `<!doctype html><html lang="sv"><head><meta charset="utf-8">` +
      `<title>${escapeHtml(this.block.title)}</title></head><body>` +
      `<article><h1>${escapeHtml(this.block.title)}</h1>` +
      `<p><a href="${escapeHtml(this.block.url)}">${escapeHtml(this.block.url)}</a></p>` +
      `<p>Avskalad textversion (mock). I Spår A genereras denna via läsbarhetsextraktion ` +
      `av sidans DOM.</p></article></body></html>`;
    return new Blob([html], { type: "text/html" });
  }
}

/**
 * Länkkort. En webbläsare kan inte bädda in främmande sidor (X-Frame-Options och
 * avsnitt 10.3), så ett sidblock utan snapshot visar vad det faktiskt är: en
 * referens man kan öppna. Ärligare än en tom ruta, och användbart i sig.
 */
function placeholder(msg: string, block: PageBlock): string {
  let host = block.url;
  try {
    host = new URL(block.url).hostname.replace(/^www\./, "");
  } catch {
    /* behåll råtexten */
  }
  return (
    `<div style="width:100%;height:100%;display:flex;flex-direction:column;` +
    `align-items:center;justify-content:center;gap:10px;padding:24px;text-align:center;` +
    `background:radial-gradient(120% 100% at 50% 0%,#141c27,#0f151d)">` +
    `<div style="font-size:22px;font-weight:650;color:#e6edf3;max-width:90%;` +
    `overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(block.title)}</div>` +
    `<div style="font-size:12px;color:#58a6ff">${escapeHtml(host)}</div>` +
    `<div style="font-size:11px;color:#6e7681;margin-top:4px">${escapeHtml(msg)}</div></div>`
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}
function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
