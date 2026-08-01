import { fromJSON, toJSON, type FlowDocument } from "@tabflow/domain";
import type { DocumentStore, DocumentSummary } from "../ports";

/**
 * DocumentStore ovanpå localStorage för M1/dev. Byts mot chrome.storage.local /
 * IndexedDB (Spår A) resp. filsystem (Spår B). Dokument-JSON hålls lätt eftersom
 * binärt innehåll ligger i BlobStore (5.2).
 */
const DOC_PREFIX = "tabflow:doc:";
const INDEX_KEY = "tabflow:index";

export class LocalStorageDocumentStore implements DocumentStore {
  async list(): Promise<DocumentSummary[]> {
    return this.readIndex();
  }

  async load(id: string): Promise<FlowDocument | null> {
    const raw = localStorage.getItem(DOC_PREFIX + id);
    if (!raw) return null;
    return fromJSON(raw);
  }

  async save(doc: FlowDocument): Promise<void> {
    // Skriv dokumentet först, uppdatera indexet sen: om det avbryts finns dokumentet
    // kvar men saknas i listan, hellre än en indexpost utan dokument (5.3, atomicitet).
    localStorage.setItem(DOC_PREFIX + doc.id, toJSON(doc, false));
    const index = this.readIndex().filter((d) => d.id !== doc.id);
    index.push({ id: doc.id, title: doc.title, updatedAt: doc.updatedAt, tags: doc.tags });
    index.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  }

  async delete(id: string): Promise<void> {
    localStorage.removeItem(DOC_PREFIX + id);
    localStorage.setItem(
      INDEX_KEY,
      JSON.stringify(this.readIndex().filter((d) => d.id !== id)),
    );
  }

  private readIndex(): DocumentSummary[] {
    try {
      const raw = localStorage.getItem(INDEX_KEY);
      return raw ? (JSON.parse(raw) as DocumentSummary[]) : [];
    } catch {
      return [];
    }
  }
}
