/**
 * Block-kommandon (avsnitt 6.1: "Kommandon: addBlock, moveBlock, ...").
 *
 * Alla kommandon är RENA funktioner: de muterar inte indata utan returnerar ett
 * nytt FlowDocument med uppdaterad `updatedAt`. Det gör dem triviala att testa och
 * att bygga undo/redo på senare.
 */
import {
  errAnchorNotFound,
  errBlockNotFound,
  errWrongBlockType,
} from "./errors.js";
import { cloneBlockWithNewId } from "./factory.js";
import {
  Block,
  BlockHeight,
  Clock,
  FlowDocument,
  IdGenerator,
  InsertPosition,
  PageBlock,
  RenderDisplay,
  SnapshotArtifact,
  TextBlock,
} from "./types.js";

type Deps = { clock: Clock };

function touch(doc: FlowDocument, blocks: Block[], deps: Deps): FlowDocument {
  return { ...doc, blocks, updatedAt: deps.clock.now() };
}

function indexOfBlock(doc: FlowDocument, blockId: string): number {
  const i = doc.blocks.findIndex((b) => b.id === blockId);
  if (i === -1) throw errBlockNotFound(blockId);
  return i;
}

function resolveInsertIndex(doc: FlowDocument, pos: InsertPosition): number {
  switch (pos.at) {
    case "top":
      return 0;
    case "bottom":
      return doc.blocks.length;
    case "index":
      return Math.max(0, Math.min(pos.index, doc.blocks.length));
    case "after":
    case "before": {
      const i = doc.blocks.findIndex((b) => b.id === pos.blockId);
      if (i === -1) throw errAnchorNotFound(pos.blockId);
      return pos.at === "after" ? i + 1 : i;
    }
  }
}

/** Uppdatera ett block på plats (returnerar ny array). Kastar om id saknas. */
function mapBlock(
  doc: FlowDocument,
  blockId: string,
  fn: (b: Block) => Block,
): Block[] {
  const i = indexOfBlock(doc, blockId);
  const next = doc.blocks.slice();
  next[i] = fn(next[i]);
  return next;
}

function asPage(block: Block): PageBlock {
  if (block.type !== "page") throw errWrongBlockType(block.id, "page", block.type);
  return block;
}

function asText(block: Block): TextBlock {
  if (block.type !== "text") throw errWrongBlockType(block.id, "text", block.type);
  return block;
}

// --- Struktur (F-BLK-1..3) -------------------------------------------------

export function addBlock(
  doc: FlowDocument,
  block: Block,
  position: InsertPosition,
  deps: Deps,
): FlowDocument {
  const index = resolveInsertIndex(doc, position);
  const blocks = doc.blocks.slice();
  blocks.splice(index, 0, block);
  return touch(doc, blocks, deps);
}

export function removeBlock(
  doc: FlowDocument,
  blockId: string,
  deps: Deps,
): FlowDocument {
  const i = indexOfBlock(doc, blockId);
  const blocks = doc.blocks.slice();
  blocks.splice(i, 1);
  return touch(doc, blocks, deps);
}

/** Flytta ett block till ett absolut index (clampas). Grund för drag-and-drop och upp/ner. */
export function moveBlock(
  doc: FlowDocument,
  blockId: string,
  toIndex: number,
  deps: Deps,
): FlowDocument {
  const from = indexOfBlock(doc, blockId);
  const clamped = Math.max(0, Math.min(toIndex, doc.blocks.length - 1));
  if (from === clamped) return doc;
  const blocks = doc.blocks.slice();
  const [moved] = blocks.splice(from, 1);
  blocks.splice(clamped, 0, moved);
  return touch(doc, blocks, deps);
}

export function moveBlockBy(
  doc: FlowDocument,
  blockId: string,
  delta: number,
  deps: Deps,
): FlowDocument {
  return moveBlock(doc, blockId, indexOfBlock(doc, blockId) + delta, deps);
}

/** Duplicera ett block direkt efter originalet (F-BLK-5). */
export function duplicateBlock(
  doc: FlowDocument,
  blockId: string,
  deps: Deps & { ids: IdGenerator },
): FlowDocument {
  const i = indexOfBlock(doc, blockId);
  const copy = cloneBlockWithNewId(doc.blocks[i], deps);
  const blocks = doc.blocks.slice();
  blocks.splice(i + 1, 0, copy);
  return touch(doc, blocks, deps);
}

export function setCollapsed(
  doc: FlowDocument,
  blockId: string,
  collapsed: boolean,
  deps: Deps,
): FlowDocument {
  return touch(doc, mapBlock(doc, blockId, (b) => ({ ...b, collapsed })), deps);
}

// --- Textblock (F-TXT) -----------------------------------------------------

export function updateTextMarkdown(
  doc: FlowDocument,
  blockId: string,
  markdown: string,
  deps: Deps,
): FlowDocument {
  return touch(
    doc,
    mapBlock(doc, blockId, (b) => ({ ...asText(b), markdown })),
    deps,
  );
}

// --- Sidblock (F-SID / F-SNAP / F-SNAPWF) ----------------------------------

export function setPageHeight(
  doc: FlowDocument,
  blockId: string,
  height: BlockHeight,
  deps: Deps,
): FlowDocument {
  return touch(
    doc,
    mapBlock(doc, blockId, (b) => ({ ...asPage(b), height })),
    deps,
  );
}

export function setPageLabel(
  doc: FlowDocument,
  blockId: string,
  label: string | null,
  deps: Deps,
): FlowDocument {
  return touch(
    doc,
    mapBlock(doc, blockId, (b) => ({ ...asPage(b), label })),
    deps,
  );
}

/** Växla vilken artefakt som visas (live/snapshot) per block (F-SNAPWF-8). */
export function setPageDisplay(
  doc: FlowDocument,
  blockId: string,
  display: RenderDisplay,
  deps: Deps,
): FlowDocument {
  return touch(
    doc,
    mapBlock(doc, blockId, (b) => {
      const page = asPage(b);
      return { ...page, render: { ...page.render, display } };
    }),
    deps,
  );
}

/**
 * Fäst en färdig snapshot (dubbel artefakt) på ett block (F-SNAP-1, F-SNAPWF-8).
 * Blocket kan behålla mode "live" och ändå ha en snapshot — de utesluter inte varandra.
 */
export function attachSnapshot(
  doc: FlowDocument,
  blockId: string,
  snapshot: SnapshotArtifact,
  deps: Deps,
): FlowDocument {
  return touch(
    doc,
    mapBlock(doc, blockId, (b) => {
      const page = asPage(b);
      return {
        ...page,
        capturedAt: snapshot.capturedAt,
        render: { ...page.render, snapshot },
      };
    }),
    deps,
  );
}

// --- Dokumentmetadata ------------------------------------------------------

export function renameDocument(
  doc: FlowDocument,
  title: string,
  deps: Deps,
): FlowDocument {
  return { ...doc, title, updatedAt: deps.clock.now() };
}

export function setTags(doc: FlowDocument, tags: string[], deps: Deps): FlowDocument {
  return { ...doc, tags: [...tags], updatedAt: deps.clock.now() };
}
