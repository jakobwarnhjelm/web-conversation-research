import {
  Block,
  BlockHeight,
  Clock,
  CURRENT_SCHEMA_VERSION,
  FlowDocument,
  IdGenerator,
  PageBlock,
  TextBlock,
} from "./types.js";

/** Enkel deterministisk id-generator (räknare). Byt ut i produktion mot t.ex. nanoid. */
export function createCounterIdGenerator(seed = 0): IdGenerator {
  let n = seed;
  return {
    block: () => `blk_${String(++n).padStart(3, "0")}`,
    document: () => `flow_${String(++n).padStart(3, "0")}`,
  };
}

export function createDocument(
  params: { title: string; tags?: string[] },
  deps: { ids: IdGenerator; clock: Clock },
): FlowDocument {
  const ts = deps.clock.now();
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: deps.ids.document(),
    title: params.title,
    createdAt: ts,
    updatedAt: ts,
    tags: params.tags ? [...params.tags] : [],
    blocks: [],
  };
}

export function createTextBlock(
  params: { markdown?: string },
  deps: { ids: IdGenerator },
): TextBlock {
  return {
    id: deps.ids.block(),
    type: "text",
    collapsed: false,
    markdown: params.markdown ?? "",
  };
}

export function createPageBlock(
  params: {
    url: string;
    title?: string;
    favicon?: string | null;
    height?: BlockHeight;
    label?: string | null;
    /** "live" för Spår B-block, "snapshot" annars. Ny snapshot skapas separat. */
    mode?: "live" | "snapshot";
  },
  deps: { ids: IdGenerator },
): PageBlock {
  const mode = params.mode ?? "snapshot";
  return {
    id: deps.ids.block(),
    type: "page",
    collapsed: false,
    url: params.url,
    title: params.title ?? params.url,
    favicon: params.favicon ?? null,
    height: params.height ?? "medium",
    label: params.label ?? null,
    capturedAt: null,
    render: {
      mode,
      // Ett nytt block utan snapshot kan bara visa live; annars är det en tom placeholder
      // tills en snapshot skapats. Vi speglar mode som default-display.
      display: mode,
      snapshot: null,
    },
  };
}

/** Djupklon av ett block med nytt id (F-BLK-5, duplicera). */
export function cloneBlockWithNewId(block: Block, deps: { ids: IdGenerator }): Block {
  const copy: Block = structuredClone(block);
  copy.id = deps.ids.block();
  return copy;
}
