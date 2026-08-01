import type { BlobStore } from "../ports";

/**
 * BlobStore ovanpå IndexedDB (Spår A, avsnitt 5.3). Bilder och text-HTML-snapshots
 * lagras här; dokument-JSON håller bara referenserna. Object-URL:er spåras så att
 * releaseUrl faktiskt återkallar dem (F-LAZY-5, undviker minnesläckor).
 */
const DB_NAME = "tabflow";
const STORE = "blobs";

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export class IndexedDBBlobStore implements BlobStore {
  private dbp: Promise<IDBDatabase>;
  private seq = 0;

  constructor(dbName = DB_NAME) {
    this.dbp = new Promise((resolve, reject) => {
      const open = indexedDB.open(dbName, 1);
      open.onupgradeneeded = () => {
        if (!open.result.objectStoreNames.contains(STORE)) open.result.createObjectStore(STORE);
      };
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
  }

  private async tx(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const db = await this.dbp;
    return db.transaction(STORE, mode).objectStore(STORE);
  }

  async put(blob: Blob): Promise<string> {
    // Unikt ref: tid + räknare + slump, robust även vid snabba anrop i batch.
    const ref = `blob_${Date.now().toString(36)}_${this.seq++}_${Math.floor(Math.random() * 1e6).toString(36)}`;
    const store = await this.tx("readwrite");
    await reqToPromise(store.put(blob, ref));
    return ref;
  }

  async get(ref: string): Promise<Blob | null> {
    const store = await this.tx("readonly");
    const res = await reqToPromise(store.get(ref));
    return (res as Blob | undefined) ?? null;
  }

  async delete(ref: string): Promise<void> {
    const store = await this.tx("readwrite");
    await reqToPromise(store.delete(ref));
  }

  async objectUrl(ref: string): Promise<string | null> {
    const blob = await this.get(ref);
    return blob ? URL.createObjectURL(blob) : null;
  }

  releaseUrl(url: string): void {
    URL.revokeObjectURL(url);
  }
}
