/**
 * Filsystemslagring för Spår B (portarna BlobStore/DocumentStore, avsnitt 5.3).
 *
 * Dokument-JSON i `<userData>/documents/<id>.json` med ett index bredvid; binärt
 * innehåll i `<userData>/blobs/<ref>`. Referensen bär filändelsen, så MIME-typen
 * kan härledas vid läsning utan sidovagn.
 */
import { app } from "electron";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export interface DocumentSummary {
  id: string;
  title: string;
  updatedAt: string;
  tags: string[];
}

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "text/html": "html",
  "application/json": "json",
};
const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  html: "text/html",
  json: "application/json",
};

function root(): string {
  return path.join(app.getPath("userData"), "tabflow");
}
const blobDir = () => path.join(root(), "blobs");
const docDir = () => path.join(root(), "documents");
const indexFile = () => path.join(root(), "documents", "index.json");

export async function initStorage(): Promise<void> {
  await fs.mkdir(blobDir(), { recursive: true });
  await fs.mkdir(docDir(), { recursive: true });
}

// --- Blobbar ---------------------------------------------------------------

/** `ref` är filnamnet. Det valideras vid läsning så en trasig referens inte kan
 *  ta sig utanför blob-katalogen. */
function blobPath(ref: string): string {
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9]+$/.test(ref)) throw new Error(`Ogiltig blobreferens: ${ref}`);
  return path.join(blobDir(), ref);
}

export async function putBlob(bytes: Uint8Array, mime: string): Promise<string> {
  const ext = EXT_BY_MIME[mime] ?? "bin";
  const ref = `${randomUUID()}.${ext}`;
  await fs.writeFile(blobPath(ref), bytes);
  return ref;
}

export async function getBlob(ref: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  try {
    const bytes = await fs.readFile(blobPath(ref));
    const ext = ref.split(".").pop() ?? "";
    return { bytes, mime: MIME_BY_EXT[ext] ?? "application/octet-stream" };
  } catch {
    return null;
  }
}

export async function deleteBlob(ref: string): Promise<void> {
  await fs.rm(blobPath(ref), { force: true });
}

// --- Dokument --------------------------------------------------------------

function docPath(id: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error(`Ogiltigt dokument-id: ${id}`);
  return path.join(docDir(), `${id}.json`);
}

export async function listDocuments(): Promise<DocumentSummary[]> {
  try {
    return JSON.parse(await fs.readFile(indexFile(), "utf8")) as DocumentSummary[];
  } catch {
    return [];
  }
}

export async function loadDocument(id: string): Promise<string | null> {
  try {
    return await fs.readFile(docPath(id), "utf8");
  } catch {
    return null;
  }
}

/** Tar dokumentet som redan serialiserad JSON — domänens `toJSON` äger formatet. */
export async function saveDocument(summary: DocumentSummary, json: string): Promise<void> {
  await fs.writeFile(docPath(summary.id), json, "utf8");
  const index = (await listDocuments()).filter((d) => d.id !== summary.id);
  index.push(summary);
  index.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  await fs.writeFile(indexFile(), JSON.stringify(index, null, 2), "utf8");
}

export async function deleteDocument(id: string): Promise<void> {
  await fs.rm(docPath(id), { force: true });
  const index = (await listDocuments()).filter((d) => d.id !== id);
  await fs.writeFile(indexFile(), JSON.stringify(index, null, 2), "utf8");
}
