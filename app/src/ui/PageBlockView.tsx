import { useEffect, useRef } from "react";
import {
  HEIGHT_STEP_PX,
  type BlockHeightStep,
  type PageBlock,
} from "@tabflow/domain";
import { useServices } from "../state/services";
import type { SidblockHandle } from "../ports";
import { BlockChrome } from "./BlockChrome";

function heightPx(h: PageBlock["height"]): number {
  return typeof h === "number" ? h : HEIGHT_STEP_PX[h];
}

const STEPS: BlockHeightStep[] = ["small", "medium", "large"];

/**
 * Sidblock (F-SID/F-SNAP). Huvudet bär ALL chrome (Spike E1: inget DOM kan ligga
 * ovanpå en native-vy). Innehållsytan nedanför renderas av den injicerade
 * SidblockRenderer:n via en imperativ handle — samma port för Spår A och B.
 */
export function PageBlockView({
  block,
  isFirst,
  isLast,
}: {
  block: PageBlock;
  isFirst: boolean;
  isLast: boolean;
}) {
  const { actions, renderer, tabs } = useServices();
  const contentRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<SidblockHandle | null>(null);

  // Skapa/förstör renderar-handtaget en gång per block-id.
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;
    const handle = renderer.render(block, {
      container,
      getContentRect: () => container.getBoundingClientRect(),
    });
    handle.setLifecycle("active");
    handleRef.current = handle;
    return () => {
      handle.dispose();
      handleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block.id, renderer]);

  // Synka blockets data till handtaget vid varje ändring.
  useEffect(() => {
    handleRef.current?.update(block);
  }, [block]);

  const snap = block.render.snapshot;
  const isLive = block.render.display === "live";

  async function doSnapshot() {
    const handle = handleRef.current;
    if (!handle) return;
    const artifact = await handle.snapshot();
    actions.applySnapshot(block.id, artifact);
    actions.setDisplay(block.id, "snapshot");
  }

  return (
    <div className="block page-block">
      <div className="block-head page-head">
        <span className="favicon" aria-hidden>
          {block.favicon ? <img src={block.favicon} alt="" width={16} height={16} /> : "🌐"}
        </span>
        <span className="page-title" title={block.url}>
          {block.title}
        </span>
        <span className={"badge " + (isLive ? "live" : "snap")}>
          {isLive ? "LIVE" : "SNAPSHOT"}
          {!isLive && snap?.capturedAt ? " · " + fmt(snap.capturedAt) : ""}
        </span>

        <div className="page-tools">
          <select
            aria-label="Höjd"
            value={typeof block.height === "number" ? "custom" : block.height}
            onChange={(e) => {
              const v = e.target.value;
              if (v !== "custom") actions.setHeight(block.id, v as BlockHeightStep);
            }}
          >
            {STEPS.map((s) => (
              <option key={s} value={s}>
                {s === "small" ? "Liten" : s === "medium" ? "Medel" : "Stor"}
              </option>
            ))}
            {typeof block.height === "number" && <option value="custom">{block.height}px</option>}
          </select>
          {snap && (
            <button
              title="Växla live/snapshot"
              onClick={() => actions.setDisplay(block.id, isLive ? "snapshot" : "live")}
            >
              {isLive ? "▣" : "▶"}
            </button>
          )}
          <button title="Skapa snapshot" onClick={doSnapshot}>
            📷
          </button>
          <button title="Öppna som flik" onClick={() => tabs.open(block.url)}>
            ↗
          </button>
        </div>
        <BlockChrome block={block} isFirst={isFirst} isLast={isLast} />
      </div>

      {!block.collapsed && (
        <div
          ref={contentRef}
          className="page-content"
          style={{ height: heightPx(block.height) }}
        />
      )}
    </div>
  );
}

function fmt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" });
}
