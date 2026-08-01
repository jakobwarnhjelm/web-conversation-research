import { useState } from "react";
import type { InsertPosition } from "@tabflow/domain";
import { useServices } from "../state/services";

/** Infoga-block-affordans mellan block (F-BLK-3, F-UX-3): en "+"-zon vid hover. */
export function InsertZone({ position }: { position: InsertPosition }) {
  const { actions } = useServices();
  const [open, setOpen] = useState(false);

  return (
    <div
      className={"insert-zone" + (open ? " open" : "")}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div className="insert-line" />
      {open && (
        <div className="insert-actions" role="group" aria-label="Infoga block">
          <button onClick={() => actions.addText(position, "")}>+ Text</button>
          <button
            onClick={() => {
              const url = prompt("URL till sidan:");
              if (url) actions.addPage(url, position);
            }}
          >
            + Sida
          </button>
        </div>
      )}
    </div>
  );
}
