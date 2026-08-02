import { useEffect, useRef, useState } from "react";
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Skapa/förstör renderar-handtaget en gång per block-id.
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;
    const handle = renderer.render(block, {
      container,
      getContentRect: () => container.getBoundingClientRect(),
      getClipRect: () => scrollParent(container).getBoundingClientRect(),
    });
    handle.setLifecycle("active");
    handleRef.current = handle;
    return () => {
      handle.dispose();
      handleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block.id, renderer]);

  // Håll ett ev. native-lager (Spår B) i takt med flödet. Spike E1: en WebContentsView
  // följer inte med scrollen av sig själv och klipps inte av scroll-containern, så
  // varje scroll/omlayout måste knuffa renderaren. No-op i Spår A och i mock-renderaren.
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;
    const scroller = scrollParent(container);
    let frame = 0;
    const push = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        handleRef.current?.syncBounds();
      });
    };
    push();
    scroller.addEventListener("scroll", push, { passive: true });
    window.addEventListener("resize", push);
    const ro = new ResizeObserver(push);
    ro.observe(container);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      scroller.removeEventListener("scroll", push);
      window.removeEventListener("resize", push);
      ro.disconnect();
    };
  }, [block.id, block.collapsed, block.height]);

  // Synka blockets data till handtaget vid varje ändring.
  useEffect(() => {
    handleRef.current?.update(block);
  }, [block]);

  const snap = block.render.snapshot;
  const isLive = block.render.display === "live";

  // Fångst kan misslyckas i alla spår — nekad sida, nätverksfel, stängd vy. Felet
  // hör hemma på blocket det gäller, inte i konsolen.
  async function doSnapshot(archive: boolean) {
    const handle = handleRef.current;
    if (!handle || busy) return;
    setMenuOpen(false);
    setBusy(true);
    setError(null);
    try {
      const artifact = await handle.snapshot({ archive });
      actions.applySnapshot(block.id, artifact);
      actions.setDisplay(block.id, "snapshot");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
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
          <button title="Skapa snapshot" onClick={() => void doSnapshot(false)} disabled={busy}>
            {busy ? "…" : "📷"}
          </button>
          <button
            title="Fler sätt att spara"
            aria-haspopup="true"
            aria-expanded={menuOpen}
            disabled={busy}
            onClick={() => setMenuOpen((v) => !v)}
          >
            ▾
          </button>
          <button title="Öppna som flik" onClick={() => tabs.open(block.url)}>
            ↗
          </button>
        </div>
        <BlockChrome block={block} isFirst={isFirst} isLast={isLast} />
      </div>

      {/* Ligger i flödet, inte som överlägg: Spike E1 visade att inget DOM kan ritas
          ovanpå en native-vy, så menyn skjuter ned innehållet i stället för att täcka det. */}
      {menuOpen && (
        <div className="snap-menu">
          <button onClick={() => void doSnapshot(false)}>
            <strong>Spara kopia</strong>
            <span>Bild och textversion.</span>
          </button>
          <button onClick={() => void doSnapshot(true)}>
            <strong>Spara kopia med helsidearkiv</strong>
            <span>
              Bevarar sidan exakt som den ser ut — även det du är inloggad för. Arkivfilen
              kan innehålla känsliga uppgifter.
            </span>
          </button>
          <button className="snap-menu-close" onClick={() => setMenuOpen(false)} title="Stäng">
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className="block-error" role="alert">
          Snapshot misslyckades: {error}
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

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

/** Närmaste vertikalt scrollande förälder — den yta innehållet måste klippas mot. */
function scrollParent(el: HTMLElement): HTMLElement {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if (oy === "auto" || oy === "scroll") return p;
  }
  return document.documentElement;
}

function fmt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" });
}
