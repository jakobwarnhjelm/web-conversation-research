import {
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
} from "@tabflow/app/ports";
import type { CaptureResult } from "../messages";

/**
 * Spår A-renderare: visar den lagrade grafiska kopian (IndexedDB) inline och ger
 * "Visa textversion" (F-SNAP-5). Ingen iframe av främmande sidor (Store-krav, 10.3).
 * `snapshot()` ber service workern (om)fånga URL:en (F-SID-6) — dvs dödsstöt-2-vägen.
 */
export class ChromeSnapshotRenderer implements SidblockRenderer {
  readonly kind = "chrome-snapshot";
  constructor(private blobs: BlobStore) {}
  render(block: PageBlock, host: SidblockHost): SidblockHandle {
    return new ChromeHandle(block, host, this.blobs);
  }
}

class ChromeHandle implements SidblockHandle {
  private el: HTMLDivElement;
  private objUrl: string | null = null;
  private lifecycle: LifecycleState = "warm";

  constructor(
    private block: PageBlock,
    host: SidblockHost,
    private blobs: BlobStore,
  ) {
    this.el = document.createElement("div");
    this.el.style.cssText = "width:100%;height:100%;position:relative;overflow:auto;";
    host.container.appendChild(this.el);
    void this.paint();
  }

  update(block: PageBlock): void {
    this.block = block;
    void this.paint();
  }
  async refresh(): Promise<void> {
    await this.snapshot();
  }
  setDisplay(_d: RenderDisplay): void {
    void this.paint();
  }
  setLifecycle(state: LifecycleState): void {
    this.lifecycle = state;
    if (state === "unloaded") this.release();
    void this.paint();
  }
  syncBounds(): void {
    /* Spår A: ingen native-vy. */
  }
  setHeight(_h: BlockHeight): void {}

  async snapshot(): Promise<SnapshotArtifact> {
    const resp = (await chrome.runtime.sendMessage({
      type: "tabflow:captureUrl",
      url: this.block.url,
    })) as { ok: boolean; result?: CaptureResult; error?: string };
    if (!resp?.ok || !resp.result) throw new Error(resp?.error ?? "Fångst misslyckades");
    const r = resp.result;
    return {
      imageRef: r.imageRef,
      textHtmlRef: r.textHtmlRef,
      singleFileRef: null,
      fullPage: false,
      capturedAt: r.capturedAt,
    };
  }

  dispose(): void {
    this.release();
    this.el.remove();
  }

  private release() {
    if (this.objUrl) {
      this.blobs.releaseUrl(this.objUrl);
      this.objUrl = null;
    }
  }

  private async paint() {
    const { render } = this.block;
    if (this.lifecycle === "unloaded") {
      this.el.innerHTML = ph("Avlastad — scrolla in för att ladda");
      return;
    }
    if (render.display === "live") {
      this.el.innerHTML = ph("▶ Live-läge finns i Spår B (Electron)");
      return;
    }
    if (render.snapshot) {
      const url = await this.blobs.objectUrl(render.snapshot.imageRef);
      this.release();
      if (url) {
        this.objUrl = url;
        this.el.innerHTML =
          `<img src="${url}" alt="Snapshot" style="display:block;width:100%;height:auto" />` +
          `<button class="tf-textver" style="position:sticky;bottom:8px;margin:8px;` +
          `background:#161b22;color:#e6edf3;border:1px solid #2a3038;border-radius:6px;` +
          `padding:4px 10px;cursor:pointer">Visa textversion</button>`;
        const btn = this.el.querySelector(".tf-textver");
        const ref = render.snapshot.textHtmlRef;
        btn?.addEventListener("click", async () => {
          const turl = await this.blobs.objectUrl(ref);
          if (turl) void chrome.tabs.create({ url: turl });
        });
        return;
      }
    }
    this.el.innerHTML = ph("Fånga via kontextmenyn på sidan, eller 📷 i huvudet");
  }
}

function ph(msg: string): string {
  return (
    `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;` +
    `color:#6e7681;text-align:center;padding:16px;background:` +
    `repeating-linear-gradient(45deg,#0f151d,#0f151d 10px,#131a24 10px,#131a24 20px)">${msg}</div>`
  );
}
