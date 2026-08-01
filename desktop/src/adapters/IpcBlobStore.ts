import type { BlobStore } from "@tabflow/app/ports";
import { bridge } from "../bridge";

/**
 * BlobStore mot filsystemet via main-processen. Bytes går över IPC och blir en
 * riktig `blob:`-URL i renderaren — samma livscykel som övriga spår, så
 * `releaseUrl` betyder något och F-LAZY-5 gäller även här.
 */
export class IpcBlobStore implements BlobStore {
  async put(blob: Blob): Promise<string> {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return await bridge().blobs.put(bytes, blob.type || "application/octet-stream");
  }

  async get(ref: string): Promise<Blob | null> {
    const res = await bridge().blobs.get(ref);
    if (!res) return null;
    // IPC ger en Uint8Array vars buffer typas som ArrayBufferLike; kopiera till en
    // egen ArrayBuffer så den duger som BlobPart.
    const copy = new Uint8Array(res.bytes.byteLength);
    copy.set(res.bytes);
    return new Blob([copy.buffer], { type: res.mime });
  }

  async delete(ref: string): Promise<void> {
    await bridge().blobs.delete(ref);
  }

  async objectUrl(ref: string): Promise<string | null> {
    const blob = await this.get(ref);
    return blob ? URL.createObjectURL(blob) : null;
  }

  releaseUrl(url: string): void {
    URL.revokeObjectURL(url);
  }
}
