import { useEffect, useRef, useState } from "react";
import type { InsertPosition } from "@tabflow/domain";
import { useServices } from "../state/services";

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

/** Tillåter "example.com" lika väl som full URL, men bara http(s) släpps igenom. */
export function normalizeUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(candidate);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}
