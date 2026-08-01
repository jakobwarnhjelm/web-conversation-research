import { useState } from "react";
import type { InsertPosition } from "@tabflow/domain";
import { useServices } from "../state/services";
import { AddPageButton } from "./AddPageButton";

/** Infoga-block-affordans mellan block (F-BLK-3, F-UX-3): en "+"-zon vid hover. */
export function InsertZone({ position }: { position: InsertPosition }) {
  const { actions } = useServices();
  const [hovered, setHovered] = useState(false);
  const [typing, setTyping] = useState(false);

  // Zonen får inte fällas ihop medan man skriver en URL i den — då försvinner
  // fältet så fort muspekaren lämnar den smala remsan.
  const open = hovered || typing;

  return (
    <div
      className={"insert-zone" + (open ? " open" : "")}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="insert-line" />
      {open && (
        <div className="insert-actions" role="group" aria-label="Infoga block">
          <button onClick={() => actions.addText(position, "")}>+ Text</button>
          <AddPageButton position={position} onActiveChange={setTyping} />
        </div>
      )}
    </div>
  );
}
