import { useEffect, useRef, useState } from "react";
import type { FlowDocument } from "@tabflow/domain";
import { documentToText } from "../lib/notebookText";
import { useServices } from "../state/services";

/**
 * Hela notebooken som en textyta (F-TXT). Markdown-snuttar varvat med URL-rader;
 * en rad som bara är en URL blir ett sidblock.
 *
 * Sidblock med snapshots återanvänds per URL vid sparning, så att en textredigering
 * inte kastar fångat innehåll. Flyttar man om raderna följer snapshoten med.
 */
export function SourceEditor({ doc, onClose }: { doc: FlowDocument; onClose: () => void }) {
  const { actions } = useServices();
  const [text, setText] = useState(() => documentToText(doc));
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  function save() {
    actions.replaceFromText(text);
    onClose();
  }

  return (
    <div className="source-editor">
      <div className="source-bar">
        <span className="source-hint">
          Markdown-snuttar varvat med webbreferenser. En rad som bara innehåller en URL blir
          ett sidblock. Tom rad separerar snuttar.
        </span>
        <div className="source-actions">
          <button onClick={onClose}>Avbryt</button>
          <button className="primary" onClick={save}>
            Spara
          </button>
        </div>
      </div>
      <textarea
        ref={ref}
        className="source-text"
        value={text}
        spellCheck={false}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
        }}
        aria-label="Notebooken som text"
      />
    </div>
  );
}
