import { describe, expect, it } from "vitest";
import {
  addBlock,
  attachSnapshot,
  duplicateBlock,
  moveBlock,
  moveBlockBy,
  removeBlock,
  setCollapsed,
  setPageDisplay,
  setPageHeight,
  setPageLabel,
  updateTextMarkdown,
} from "../src/commands.js";
import {
  createDocument,
  createPageBlock,
  createTextBlock,
} from "../src/factory.js";
import { SnapshotArtifact } from "../src/types.js";
import { testDeps } from "./helpers.js";

function seeded() {
  const deps = testDeps();
  let doc = createDocument({ title: "Test" }, deps);
  const t1 = createTextBlock({ markdown: "# A" }, deps);
  const p1 = createPageBlock({ url: "https://a.example" }, deps);
  const t2 = createTextBlock({ markdown: "# B" }, deps);
  doc = addBlock(doc, t1, { at: "bottom" }, deps);
  doc = addBlock(doc, p1, { at: "bottom" }, deps);
  doc = addBlock(doc, t2, { at: "bottom" }, deps);
  return { deps, doc, ids: { t1: t1.id, p1: p1.id, t2: t2.id } };
}

describe("addBlock / insert positions", () => {
  it("infogar överst, underst och relativt ett ankare (F-BLK-3)", () => {
    const { deps, doc, ids } = seeded();
    const top = createTextBlock({ markdown: "top" }, deps);
    const afterP1 = createTextBlock({ markdown: "mid" }, deps);

    let d = addBlock(doc, top, { at: "top" }, deps);
    expect(d.blocks[0].id).toBe(top.id);

    d = addBlock(d, afterP1, { at: "after", blockId: ids.p1 }, deps);
    const order = d.blocks.map((b) => b.id);
    expect(order.indexOf(afterP1.id)).toBe(order.indexOf(ids.p1) + 1);
  });

  it("kastar om ankarblocket saknas", () => {
    const { deps, doc } = seeded();
    const x = createTextBlock({ markdown: "x" }, deps);
    expect(() => addBlock(doc, x, { at: "after", blockId: "nope" }, deps)).toThrow(
      /ankarblock/i,
    );
  });

  it("muterar inte originaldokumentet (renhet)", () => {
    const { deps, doc } = seeded();
    const before = doc.blocks.length;
    const x = createTextBlock({ markdown: "x" }, deps);
    addBlock(doc, x, { at: "bottom" }, deps);
    expect(doc.blocks.length).toBe(before);
  });

  it("uppdaterar updatedAt", () => {
    const { deps, doc } = seeded();
    const x = createTextBlock({ markdown: "x" }, deps);
    const d = addBlock(doc, x, { at: "bottom" }, deps);
    expect(d.updatedAt).not.toBe(doc.updatedAt);
  });
});

describe("moveBlock", () => {
  it("flyttar till absolut index och bevarar övriga ordning", () => {
    const { deps, doc, ids } = seeded();
    const d = moveBlock(doc, ids.t2, 0, deps);
    expect(d.blocks.map((b) => b.id)).toEqual([ids.t2, ids.t1, ids.p1]);
  });

  it("moveBlockBy(+1)/(-1) förflyttar relativt", () => {
    const { deps, doc, ids } = seeded();
    const d = moveBlockBy(doc, ids.t1, 1, deps);
    expect(d.blocks.map((b) => b.id)).toEqual([ids.p1, ids.t1, ids.t2]);
  });

  it("clampar out-of-range index utan att krascha", () => {
    const { deps, doc, ids } = seeded();
    const d = moveBlock(doc, ids.t1, 99, deps);
    expect(d.blocks[d.blocks.length - 1].id).toBe(ids.t1);
  });
});

describe("removeBlock / duplicateBlock / collapse", () => {
  it("tar bort ett block", () => {
    const { deps, doc, ids } = seeded();
    const d = removeBlock(doc, ids.p1, deps);
    expect(d.blocks.find((b) => b.id === ids.p1)).toBeUndefined();
  });

  it("duplicerar direkt efter originalet med nytt id (F-BLK-5)", () => {
    const { deps, doc, ids } = seeded();
    const d = duplicateBlock(doc, ids.p1, deps);
    const i = d.blocks.findIndex((b) => b.id === ids.p1);
    const copy = d.blocks[i + 1];
    expect(copy.id).not.toBe(ids.p1);
    expect(copy.type).toBe("page");
  });

  it("kollapsar/expanderar", () => {
    const { deps, doc, ids } = seeded();
    const d = setCollapsed(doc, ids.t1, true, deps);
    expect(d.blocks.find((b) => b.id === ids.t1)?.collapsed).toBe(true);
  });
});

describe("typvakter", () => {
  it("setPageHeight på ett textblock kastar WRONG_BLOCK_TYPE", () => {
    const { deps, doc, ids } = seeded();
    expect(() => setPageHeight(doc, ids.t1, "large", deps)).toThrow(/fel typ/i);
  });

  it("updateTextMarkdown på ett sidblock kastar", () => {
    const { deps, doc, ids } = seeded();
    expect(() => updateTextMarkdown(doc, ids.p1, "x", deps)).toThrow(/fel typ/i);
  });
});

describe("sidblock-fält och snapshot", () => {
  const snap: SnapshotArtifact = {
    imageRef: "blob_img",
    textHtmlRef: "blob_txt",
    singleFileRef: null,
    fullPage: false,
    capturedAt: "2026-08-01T10:05:00.000Z",
  };

  it("sätter höjd och etikett (F-SID-3, F-SID-5)", () => {
    const { deps, doc, ids } = seeded();
    let d = setPageHeight(doc, ids.p1, 640, deps);
    d = setPageLabel(d, ids.p1, "Deras prissida", deps);
    const p = d.blocks.find((b) => b.id === ids.p1);
    expect(p).toMatchObject({ height: 640, label: "Deras prissida" });
  });

  it("fäster dubbel-artefakt och sätter capturedAt (F-SNAP-1)", () => {
    const { deps, doc, ids } = seeded();
    const d = attachSnapshot(doc, ids.p1, snap, deps);
    const p = d.blocks.find((b) => b.id === ids.p1);
    expect(p?.type).toBe("page");
    if (p?.type === "page") {
      expect(p.render.snapshot).toEqual(snap);
      expect(p.capturedAt).toBe(snap.capturedAt);
    }
  });

  it("växlar visad artefakt live/snapshot utan att röra snapshot-datan (F-SNAPWF-8)", () => {
    const { deps, doc, ids } = seeded();
    let d = attachSnapshot(doc, ids.p1, snap, deps);
    d = setPageDisplay(d, ids.p1, "snapshot", deps);
    const p = d.blocks.find((b) => b.id === ids.p1);
    if (p?.type === "page") {
      expect(p.render.display).toBe("snapshot");
      expect(p.render.snapshot).toEqual(snap); // snapshot finns kvar
    }
  });
});
