import { useEffect, useMemo, useState } from "react";
import {
  addBlock,
  createDocument,
  createPageBlock,
  createTextBlock,
  type FlowDocument,
} from "@tabflow/domain";
import { MemoryBlobStore } from "./adapters/MemoryBlobStore";
import { LocalStorageDocumentStore } from "./adapters/LocalStorageDocumentStore";
import { MockSnapshotRenderer } from "./adapters/MockSnapshotRenderer";
import { BrowserTabController } from "./adapters/BrowserTabController";
import { ServicesProvider, type AppServices } from "./state/services";
import { useDocument } from "./state/useDocument";
import { FlowView } from "./ui/FlowView";
import { systemClock, uuidIds } from "./lib/env";

function demoDocument(): FlowDocument {
  const deps = { ids: uuidIds, clock: systemClock };
  let doc = createDocument({ title: "Leverantörsjämförelse Q3", tags: ["research"] }, deps);
  doc = addBlock(
    doc,
    createTextBlock(
      { markdown: "# Leverantörsjämförelse\nMina anteckningar varvat med sidorna nedan." },
      deps,
    ),
    { at: "bottom" },
    deps,
  );
  doc = addBlock(
    doc,
    createTextBlock({ markdown: "## Leverantör A\nStark på pris, **svag på support**." }, deps),
    { at: "bottom" },
    deps,
  );
  doc = addBlock(
    doc,
    createPageBlock({ url: "https://example.com/leverantor-a", title: "Leverantör A – Start" }, deps),
    { at: "bottom" },
    deps,
  );
  doc = addBlock(
    doc,
    createTextBlock({ markdown: "## Leverantör B\nDyrare, men bättre SLA." }, deps),
    { at: "bottom" },
    deps,
  );
  doc = addBlock(
    doc,
    createPageBlock({ url: "https://example.org/leverantor-b", title: "Leverantör B – Priser" }, deps),
    { at: "bottom" },
    deps,
  );
  return doc;
}

export default function App() {
  const services = useMemo(() => {
    const blobs = new MemoryBlobStore();
    return {
      blobs,
      renderer: new MockSnapshotRenderer(blobs),
      tabs: new BrowserTabController(),
      store: new LocalStorageDocumentStore(),
    };
  }, []);

  const [initial, setInitial] = useState<FlowDocument | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await services.store.list();
      const loaded = list[0] ? await services.store.load(list[0].id) : null;
      const doc = loaded ?? demoDocument();
      if (!loaded) await services.store.save(doc);
      if (!cancelled) setInitial(doc);
    })();
    return () => {
      cancelled = true;
    };
  }, [services]);

  if (!initial) return <div className="loading">Laddar…</div>;
  return <Workspace initial={initial} services={services} />;
}

function Workspace({
  initial,
  services,
}: {
  initial: FlowDocument;
  services: { blobs: MemoryBlobStore; renderer: MockSnapshotRenderer; tabs: BrowserTabController; store: LocalStorageDocumentStore };
}) {
  const { doc, actions } = useDocument(initial, services.store);
  const ctx: AppServices = {
    actions,
    renderer: services.renderer,
    blobs: services.blobs,
    tabs: services.tabs,
  };

  return (
    <ServicesProvider value={ctx}>
      <header className="app-header">
        <div className="brand">TabFlow</div>
        <input
          className="doc-title"
          value={doc.title}
          onChange={(e) => actions.rename(e.target.value)}
          aria-label="Dokumentets titel"
        />
        <div className="doc-meta">{doc.blocks.length} block</div>
      </header>
      <FlowView doc={doc} />
    </ServicesProvider>
  );
}
