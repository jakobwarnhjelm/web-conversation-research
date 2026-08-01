import { useEffect, useState } from "react";
import {
  addBlock,
  createDocument,
  createPageBlock,
  createTextBlock,
  type FlowDocument,
} from "@tabflow/domain";
import { ServicesProvider, type AppServices } from "./state/services";
import { useDocument } from "./state/useDocument";
import { FlowView } from "./ui/FlowView";
import { SourceEditor } from "./ui/SourceEditor";
import { systemClock, uuidIds } from "./lib/env";
import type { AppRuntime } from "./runtime";

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

/** App tar en injicerad runtime (dev/Spår A/Spår B). Ingen hårdkodad adapter här. */
export default function App({ runtime }: { runtime: AppRuntime }) {
  const [initial, setInitial] = useState<FlowDocument | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await runtime.store.list();
      const loaded = list[0] ? await runtime.store.load(list[0].id) : null;
      const doc = loaded ?? (runtime.seedDocument ?? demoDocument)();
      if (!loaded) await runtime.store.save(doc);
      if (!cancelled) setInitial(doc);
    })();
    return () => {
      cancelled = true;
    };
  }, [runtime]);

  if (!initial) return <div className="loading">Laddar…</div>;
  return <Workspace initial={initial} runtime={runtime} />;
}

function Workspace({ initial, runtime }: { initial: FlowDocument; runtime: AppRuntime }) {
  const { doc, actions } = useDocument(initial, runtime.store, {
    defaultPageMode: runtime.defaultPageMode,
  });
  const [sourceMode, setSourceMode] = useState(false);
  const ctx: AppServices = {
    actions,
    renderer: runtime.renderer,
    blobs: runtime.blobs,
    tabs: runtime.tabs,
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
        <button
          className={"mode-toggle" + (sourceMode ? " on" : "")}
          onClick={() => setSourceMode((v) => !v)}
          title="Redigera hela notebooken som text"
        >
          {sourceMode ? "Flöde" : "Text"}
        </button>
        <div className="doc-meta">{doc.blocks.length} block</div>
      </header>
      {sourceMode ? (
        <SourceEditor doc={doc} onClose={() => setSourceMode(false)} />
      ) : (
        <FlowView doc={doc} />
      )}
    </ServicesProvider>
  );
}
