import { describe, expect, it } from "vitest";
import { addBlock } from "../src/commands.js";
import { createDocument, createPageBlock, createTextBlock } from "../src/factory.js";
import { fromJSON, migrate, toJSON, validate } from "../src/serialization.js";
import { CURRENT_SCHEMA_VERSION } from "../src/types.js";
import { testDeps } from "./helpers.js";

function sample() {
  const deps = testDeps();
  let doc = createDocument({ title: "Leverantörsjämförelse Q3", tags: ["research"] }, deps);
  doc = addBlock(doc, createTextBlock({ markdown: "## A" }, deps), { at: "bottom" }, deps);
  doc = addBlock(
    doc,
    createPageBlock({ url: "https://a.example", title: "A" }, deps),
    { at: "bottom" },
    deps,
  );
  return doc;
}

describe("round-trip (F-IE-1, F-IE-2)", () => {
  it("toJSON → fromJSON ger identiskt dokument", () => {
    const doc = sample();
    const restored = fromJSON(toJSON(doc));
    expect(restored).toEqual(doc);
  });

  it("bevarar blockordningen (5.2: ordningen ÄR scrollordningen)", () => {
    const doc = sample();
    const restored = fromJSON(toJSON(doc));
    expect(restored.blocks.map((b) => b.id)).toEqual(doc.blocks.map((b) => b.id));
  });
});

describe("validering", () => {
  it("avvisar ogiltig JSON", () => {
    expect(() => fromJSON("{ not json")).toThrow(/JSON/i);
  });

  it("avvisar block utan type", () => {
    const bad = JSON.stringify({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      id: "flow_x",
      title: "x",
      createdAt: "2026-08-01T10:00:00.000Z",
      updatedAt: "2026-08-01T10:00:00.000Z",
      tags: [],
      blocks: [{ id: "blk_1" }],
    });
    expect(() => fromJSON(bad)).toThrow(/type/i);
  });

  it("avvisar sidblock utan url", () => {
    const bad = JSON.stringify({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      id: "flow_x",
      title: "x",
      createdAt: "2026-08-01T10:00:00.000Z",
      updatedAt: "2026-08-01T10:00:00.000Z",
      tags: [],
      blocks: [{ id: "blk_1", type: "page", render: {} }],
    });
    expect(() => fromJSON(bad)).toThrow(/url/i);
  });
});

describe("migrering", () => {
  it("kastar tydligt om schemaVersion är nyare än stödd (framtidssäkring)", () => {
    const future = { schemaVersion: CURRENT_SCHEMA_VERSION + 1, id: "x", title: "x", blocks: [] };
    expect(() => migrate(future)).toThrow(/nyare/i);
  });

  it("ett redan aktuellt dokument passerar migrate oförändrat", () => {
    const doc = sample();
    const migrated = validate(migrate(JSON.parse(toJSON(doc))));
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated).toEqual(doc);
  });
});
