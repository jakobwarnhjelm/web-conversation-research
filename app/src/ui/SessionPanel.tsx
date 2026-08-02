import { useState } from "react";
import { useServices } from "../state/services";

/**
 * Inloggningar du gör i sidblock lever i en delad session som överlever omstart.
 * Utan den här vägen finns inget sätt att bli av med dem — och en anteckningsbok
 * som tyst samlar på sig sessioner för varje sajt man tittat på är inte rimlig.
 */
export function SessionPanel({ onClose }: { onClose: () => void }) {
  const { guestSession } = useServices();
  const [busy, setBusy] = useState(false);
  const [cleared, setCleared] = useState(false);

  async function clear() {
    if (!guestSession) return;
    setBusy(true);
    try {
      await guestSession.clearAll();
      setCleared(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tool-panel">
      <div className="tool-panel-main">
        <h2>Logga ut från alla sidor</h2>
        {cleared ? (
          <p>Klart. Sidorna i flödet laddas om utloggade.</p>
        ) : (
          <p>
            Tar bort kakor och lagrat sessionstillstånd för alla sidor du varit inloggad på i
            anteckningsboken. Dina anteckningar och sparade kopior påverkas inte.
          </p>
        )}
      </div>
      <div className="tool-panel-actions">
        <button onClick={onClose}>{cleared ? "Stäng" : "Avbryt"}</button>
        {!cleared && (
          <button className="danger" onClick={() => void clear()} disabled={busy}>
            {busy ? "Loggar ut…" : "Logga ut"}
          </button>
        )}
      </div>
    </div>
  );
}
