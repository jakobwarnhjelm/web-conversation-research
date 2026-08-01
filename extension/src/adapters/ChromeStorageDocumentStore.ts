import { fromJSON, toJSON, type FlowDocument } from "@tabflow/domain";
import type { DocumentStore, DocumentSummary } from "@tabflow/app/ports";

/**
 * DocumentStore på chrome.storage.local (Spår A, avsnitt 5.3). Delas mellan
 * service workern (som skapar block vid fångst) och flow-sidan (som visar dem) —
 * samma origin, samma storage. Binärt innehåll ligger i IndexedDB, inte här.
 */
const DOC_PREFIX = "tabflow:doc:";
const INDEX_KEY = "tabflow:index";

export class ChromeStorageDocumentStore implements DocumentStore {
  async list(): Promise<DocumentSummary[]> {
    const o = await chrome.storage.local.get(INDEX_KEY);
    return (o[INDEX_KEY] as DocumentSummary[] | undefined) ?? [];
  }

  async load(id: string): Promise<FlowDocument | null> {
    const key = DOC_PREFIX + id;
    const o = await chrome.storage.local.get(key);
    const raw = o[key] as string | undefined;
    return raw ? fromJSON(raw) : null;
  }

  async save(doc: FlowDocument): Promise<void> {
    await chrome.storage.local.set({ [DOC_PREFIX + doc.id]: toJSON(doc, false) });
    const index = (await this.list()).filter((d) => d.id !== doc.id);
    index.push({ id: doc.id, title: doc.title, updatedAt: doc.updatedAt, tags: doc.tags });
    index.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    await chrome.storage.local.set({ [INDEX_KEY]: index });
  }

  async delete(id: string): Promise<void> {
    await chrome.storage.local.remove(DOC_PREFIX + id);
    const index = (await this.list()).filter((d) => d.id !== id);
    await chrome.storage.local.set({ [INDEX_KEY]: index });
  }
}
