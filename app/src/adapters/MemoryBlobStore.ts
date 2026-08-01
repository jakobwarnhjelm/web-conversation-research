import type { BlobStore } from "../ports";

/**
 * In-memory BlobStore för M1/dev. I Spår A byts denna mot en IndexedDB-adapter,
 * i Spår B mot en filsystem-adapter (avsnitt 5.3). Object-URL:er spåras så att
 * releaseUrl faktiskt kan återkallas (F-LAZY-5).
 */
export class MemoryBlobStore implements BlobStore {
  private blobs = new Map<string, Blob>();
  private seq = 0;

  async put(blob: Blob): Promise<string> {
    const ref = `blob_${++this.seq}`;
    this.blobs.set(ref, blob);
    return ref;
  }

  async get(ref: string): Promise<Blob | null> {
    return this.blobs.get(ref) ?? null;
  }

  async delete(ref: string): Promise<void> {
    this.blobs.delete(ref);
  }

  async objectUrl(ref: string): Promise<string | null> {
    const blob = this.blobs.get(ref);
    return blob ? URL.createObjectURL(blob) : null;
  }

  releaseUrl(url: string): void {
    URL.revokeObjectURL(url);
  }
}
