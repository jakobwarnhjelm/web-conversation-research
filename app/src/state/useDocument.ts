import { useEffect, useMemo, useRef, useState } from "react";
import {
  addBlock,
  attachSnapshot,
  createPageBlock,
  createTextBlock,
  duplicateBlock,
  moveBlockBy,
  removeBlock,
  renameDocument,
  setCollapsed,
  setPageDisplay,
  setPageHeight,
  setPageLabel,
  updateTextMarkdown,
  type BlockHeight,
  type FlowDocument,
  type InsertPosition,
  type RenderDisplay,
  type SnapshotArtifact,
} from "@tabflow/domain";
import type { DocumentStore } from "../ports";
import { systemClock, uuidIds } from "../lib/env";

const deps = { ids: uuidIds, clock: systemClock };

export interface DocumentActions {
  addText(position: InsertPosition, markdown?: string): void;
  addPage(url: string, position: InsertPosition): void;
  remove(blockId: string): void;
  duplicate(blockId: string): void;
  moveBy(blockId: string, delta: number): void;
  collapse(blockId: string, collapsed: boolean): void;
  updateMarkdown(blockId: string, markdown: string): void;
  setHeight(blockId: string, height: BlockHeight): void;
  setLabel(blockId: string, label: string | null): void;
  setDisplay(blockId: string, display: RenderDisplay): void;
  applySnapshot(blockId: string, artifact: SnapshotArtifact): void;
  rename(title: string): void;
}

/**
 * Äger ett FlowDocument i minnet och autosparar (F-UX-7) med kort debounce.
 * Alla mutationer går genom domänens rena kommandon — UI:t känner inte till schemat.
 */
export function useDocument(
  initial: FlowDocument,
  store: DocumentStore,
): { doc: FlowDocument; actions: DocumentActions } {
  const [doc, setDoc] = useState(initial);

  // Autospar: spara senaste doc ~400 ms efter sista ändring.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void store.save(doc), 400);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [doc, store]);

  const actions = useMemo<DocumentActions>(
    () => ({
      addText: (position, markdown) =>
        setDoc((d) => addBlock(d, createTextBlock({ markdown }, deps), position, deps)),
      addPage: (url, position) =>
        setDoc((d) => addBlock(d, createPageBlock({ url }, deps), position, deps)),
      remove: (id) => setDoc((d) => removeBlock(d, id, deps)),
      duplicate: (id) => setDoc((d) => duplicateBlock(d, id, deps)),
      moveBy: (id, delta) => setDoc((d) => moveBlockBy(d, id, delta, deps)),
      collapse: (id, collapsed) => setDoc((d) => setCollapsed(d, id, collapsed, deps)),
      updateMarkdown: (id, md) => setDoc((d) => updateTextMarkdown(d, id, md, deps)),
      setHeight: (id, h) => setDoc((d) => setPageHeight(d, id, h, deps)),
      setLabel: (id, label) => setDoc((d) => setPageLabel(d, id, label, deps)),
      setDisplay: (id, display) => setDoc((d) => setPageDisplay(d, id, display, deps)),
      applySnapshot: (id, art) => setDoc((d) => attachSnapshot(d, id, art, deps)),
      rename: (title) => setDoc((d) => renameDocument(d, title, deps)),
    }),
    [],
  );

  return { doc, actions };
}
