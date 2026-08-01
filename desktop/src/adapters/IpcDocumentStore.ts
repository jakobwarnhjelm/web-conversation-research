import { fromJSON, toJSON, type FlowDocument } from "@tabflow/domain";
import type { DocumentStore, DocumentSummary } from "@tabflow/app/ports";
import { bridge } from "../bridge";

/**
 * DocumentStore mot filsystemet. Domänen äger serialiseringsformatet — main
 * tar emot färdig JSON och en sammanfattning för indexet, och tolkar aldrig
 * dokumentets innehåll.
 */
export class IpcDocumentStore implements DocumentStore {
  async list(): Promise<DocumentSummary[]> {
    return await bridge().docs.list();
  }

  async load(id: string): Promise<FlowDocument | null> {
    const raw = await bridge().docs.load(id);
    return raw ? fromJSON(raw) : null;
  }

  async save(doc: FlowDocument): Promise<void> {
    const summary: DocumentSummary = {
      id: doc.id,
      title: doc.title,
      updatedAt: doc.updatedAt,
      tags: doc.tags,
    };
    await bridge().docs.save(summary, toJSON(doc, false));
  }

  async delete(id: string): Promise<void> {
    await bridge().docs.delete(id);
  }
}
