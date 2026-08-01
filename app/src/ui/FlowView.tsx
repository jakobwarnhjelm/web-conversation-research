import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { HEIGHT_STEP_PX, type Block, type FlowDocument } from "@tabflow/domain";
import { TextBlockView } from "./TextBlockView";
import { PageBlockView } from "./PageBlockView";
import { InsertZone } from "./InsertZone";
import { useServices } from "../state/services";

const HEAD_PX = 40;
const INSERT_PX = 16;

/** Grov höjdgissning för virtualiseraren (F-LAZY-7). Exakt mätning sker via measureElement. */
function estimate(b: Block): number {
  if (b.collapsed) return HEAD_PX + INSERT_PX + 12;
  if (b.type === "page") {
    const h = typeof b.height === "number" ? b.height : HEIGHT_STEP_PX[b.height];
    return HEAD_PX + h + INSERT_PX;
  }
  return 140 + INSERT_PX;
}

/**
 * FlowView (avsnitt 6.1): den virtualiserade scroll-containern. Bara block inom vy
 * (+ overscan-marginal) monteras (F-LAZY-1/2). Varje rad mäts dynamiskt så att både
 * fasta sidblock-höjder och variabel textblock-höjd hanteras med stabil scroll.
 */
export function FlowView({ doc }: { doc: FlowDocument }) {
  const { actions } = useServices();
  const parentRef = useRef<HTMLDivElement>(null);
  const blocks = doc.blocks;

  const virtualizer = useVirtualizer({
    count: blocks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => estimate(blocks[i]),
    overscan: 4, // ≈ förhämtningsmarginal (F-LAZY-3)
    getItemKey: (i) => blocks[i].id,
  });

  if (blocks.length === 0) {
    return (
      <div className="flow-scroll" ref={parentRef}>
        <div className="empty-state">
          <h2>Tomt flöde</h2>
          <p>Börja med ett textblock eller en sida.</p>
          <div className="empty-actions">
            <button onClick={() => actions.addText({ at: "top" }, "# Ny anteckning\n")}>
              + Textblock
            </button>
            <button
              onClick={() => {
                const url = prompt("URL till sidan:");
                if (url) actions.addPage(url, { at: "top" });
              }}
            >
              + Sida
            </button>
          </div>
        </div>
      </div>
    );
  }

  const items = virtualizer.getVirtualItems();

  return (
    <div className="flow-scroll" ref={parentRef}>
      <div className="flow-inner" style={{ height: virtualizer.getTotalSize() }}>
        {items.map((vi) => {
          const block = blocks[vi.index];
          return (
            <div
              key={vi.key}
              data-index={vi.index}
              ref={virtualizer.measureElement}
              className="flow-row"
              style={{ transform: `translateY(${vi.start}px)` }}
            >
              <InsertZone position={{ at: "before", blockId: block.id }} />
              {block.type === "text" ? (
                <TextBlockView
                  block={block}
                  isFirst={vi.index === 0}
                  isLast={vi.index === blocks.length - 1}
                />
              ) : (
                <PageBlockView
                  block={block}
                  isFirst={vi.index === 0}
                  isLast={vi.index === blocks.length - 1}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="flow-footer">
        <button onClick={() => actions.addText({ at: "bottom" }, "")}>+ Text</button>
        <button
          onClick={() => {
            const url = prompt("URL till sidan:");
            if (url) actions.addPage(url, { at: "bottom" });
          }}
        >
          + Sida
        </button>
      </div>
    </div>
  );
}
