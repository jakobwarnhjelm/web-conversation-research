import { useEffect, useRef, useState } from "react";
import type { InsertPosition } from "@tabflow/domain";
import { useServices } from "../state/services";
import { normalizeUrl } from "../lib/url";

/**
 * "+ Sida" med inbäddad URL-inmatning.
 *
 * Medvetet INTE `window.prompt`: Electron implementerar inte prompt() alls utan
 * kastar "prompt() is and will not be supported", så en dialogbaserad variant gör
 * det omöjligt att lägga till sidor i Spår B. Ett eget fält fungerar i alla spår.
 */
export function AddPageButton({
  position,
  label = "+ Sida",
  onActiveChange,
}: {
  position: InsertPosition;
  label?: string;
  onActiveChange?: (active: boolean) => void;
}) {
  const { actions } = useServices();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onActiveChange?.(open);
    if (open) inputRef.current?.focus();
  }, [open, onActiveChange]);

  function close() {
    setValue("");
    setOpen(false);
  }

  function submit() {
    const url = normalizeUrl(value);
    if (!url) {
      inputRef.current?.focus();
      return;
    }
    actions.addPage(url, position);
    close();
  }

  if (!open) return <button onClick={() => setOpen(true)}>{label}</button>;

  return (
    <form
      className="add-page-form"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <input
        ref={inputRef}
        type="text"
        value={value}
        placeholder="example.com"
        aria-label="URL till sidan"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            close();
          }
        }}
      />
      <button type="submit" disabled={!normalizeUrl(value)}>
        Lägg till
      </button>
      <button type="button" onClick={close}>
        Avbryt
      </button>
    </form>
  );
}

