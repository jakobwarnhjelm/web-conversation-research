import { useRef, useState } from "react";
import type { FlowDocument, PageBlock } from "@tabflow/domain";
import { useServices } from "../state/services";

/** Måste matcha kön i fångstmotorn; fler arbetare köar bara upp sig i onödan. */
const WORKERS = 2;

/**
 * "Fånga alla" (F-SNAPWF).
 *
 * Går medvetet inte via sidblockens handtag: flödet är virtualiserat, så handtag
 * finns bara för de block som råkar vara i vy. Batchen använder i stället
 * `SnapshotService`, som fångar en URL utan att blocket är monterat.
 *
 * Blocken byter inte till att visa kopian efteråt. Man arkiverar, man byter inte vy.
 */
export function CaptureAllPanel({ doc, onClose }: { doc: FlowDocument; onClose: () => void }) {
  const { actions, snapshots } = useServices();
  const [archive, setArchive] = useState(false);
  const [skipExisting, setSkipExisting] = useState(true);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);
  const cancelled = useRef(false);

  const pages = doc.blocks.filter((b): b is PageBlock => b.type === "page");
  const targets = skipExisting ? pages.filter((b) => !b.render.snapshot) : pages;

  async function run() {
    if (!snapshots || targets.length === 0) return;
    const queue = [...targets];
    cancelled.current = false;
    setRunning(true);
    setFinished(false);
    setDone(0);
    setFailed([]);

    const worker = async () => {
      for (;;) {
        const block = queue.shift();
        if (!block || cancelled.current) return;
        try {
          const artifact = await snapshots.capture(block.url, { archive });
          actions.applySnapshot(block.id, artifact);
        } catch (e) {
          const label = block.title || block.url;
          console.error("[tabflow] fångst misslyckades", label, e);
          setFailed((f) => [...f, label]);
        }
        setDone((d) => d + 1);
      }
    };

    await Promise.all(Array.from({ length: WORKERS }, worker));
    setRunning(false);
    setFinished(true);
  }

  return (
    <div className="tool-panel">
      <div className="tool-panel-main">
        <h2>Spara en kopia av varje sida</h2>

        {!running && !finished && (
          <>
            <p>
              {targets.length === 0
                ? pages.length === 0
                  ? "Anteckningen innehåller inga sidor."
                  : "Alla sidor har redan en kopia."
                : `${targets.length} av ${pages.length} ${pages.length === 1 ? "sida" : "sidor"} kommer att hämtas och sparas. Sidor som inte är öppna laddas i bakgrunden, så det tar en stund.`}
            </p>
            <label>
              <input
                type="checkbox"
                checked={skipExisting}
                onChange={(e) => setSkipExisting(e.target.checked)}
              />
              Hoppa över sidor som redan har en kopia
            </label>
            <label>
              <input
                type="checkbox"
                checked={archive}
                onChange={(e) => setArchive(e.target.checked)}
              />
              Spara även helsidearkiv
              <span className="hint">
                Bevarar sidorna exakt som de ser ut — även det du är inloggad för. Arkivfilerna
                kan innehålla känsliga uppgifter.
              </span>
            </label>
          </>
        )}

        {(running || finished) && (
          <>
            <p>
              {running ? `Sparar… ${done} av ${targets.length}` : `Klart. ${done} sparade.`}
              {failed.length > 0 && ` ${failed.length} misslyckades.`}
            </p>
            <progress value={done} max={targets.length || 1} />
            {failed.length > 0 && (
              <p className="hint">Misslyckades: {failed.slice(0, 5).join(", ")}</p>
            )}
          </>
        )}
      </div>

      <div className="tool-panel-actions">
        {running ? (
          <button
            onClick={() => {
              cancelled.current = true;
            }}
          >
            Avbryt
          </button>
        ) : (
          <>
            <button onClick={onClose}>{finished ? "Stäng" : "Avbryt"}</button>
            {!finished && (
              <button className="primary" onClick={() => void run()} disabled={targets.length === 0}>
                Spara {targets.length > 0 ? targets.length : ""}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
