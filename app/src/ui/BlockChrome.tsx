import type { Block } from "@tabflow/domain";
import { useServices } from "../state/services";

/**
 * Diskret verktygsrad per block (F-BLK-6): flytta, kollapsa, duplicera, radera.
 * Enligt Spike E1 ligger den i blockets HUVUD (utanför ev. native-vys rect),
 * aldrig flytande ovanpå innehållet. Tangentbordsnåbar (F-UX-4).
 */
export function BlockChrome({
  block,
  isFirst,
  isLast,
}: {
  block: Block;
  isFirst: boolean;
  isLast: boolean;
}) {
  const { actions } = useServices();
  return (
    <div className="block-chrome" role="toolbar" aria-label="Blockåtgärder">
      <button title="Flytta upp" disabled={isFirst} onClick={() => actions.moveBy(block.id, -1)}>
        ↑
      </button>
      <button title="Flytta ner" disabled={isLast} onClick={() => actions.moveBy(block.id, 1)}>
        ↓
      </button>
      <button
        title={block.collapsed ? "Expandera" : "Kollapsa"}
        aria-pressed={block.collapsed}
        onClick={() => actions.collapse(block.id, !block.collapsed)}
      >
        {block.collapsed ? "▸" : "▾"}
      </button>
      <button title="Duplicera" onClick={() => actions.duplicate(block.id)}>
        ⧉
      </button>
      <button
        title="Radera"
        className="danger"
        onClick={() => actions.remove(block.id)}
      >
        ✕
      </button>
    </div>
  );
}
