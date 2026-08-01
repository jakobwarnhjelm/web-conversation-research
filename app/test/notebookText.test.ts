import { describe, expect, it } from "vitest";
import {
  addBlock,
  createCounterIdGenerator,
  createDocument,
  createPageBlock,
  createTextBlock,
  attachSnapshot,
  type FlowDocument,
} from "@tabflow/domain";
import { documentToText, textToBlocks } from "../src/lib/notebookText";

const clock = { now: () => "2026-01-01T00:00:00.000Z" };
const deps = () => ({ ids: createCounterIdGenerator(), clock });

function docWith(...urls: string[]): FlowDocument {
  const d = deps();
  let doc = createDocument({ title: "T" }, d);
  doc = addBlock(doc, createTextBlock({ markdown: "# Rubrik\nBrödtext." }, d), { at: "bottom" }, d);
  for (const url of urls) {
    doc = addBlock(doc, createPageBlock({ url }, d), { at: "bottom" }, d);
  }
  return doc;
}

describe("documentToText", () => {
  it("skriver textblock som markdown och sidblock som en URL-rad", () => {
    const text = documentToText(docWith("https://example.com/"));
    expect(text).toBe("# Rubrik\nBrödtext.\n\nhttps://example.com/\n");
  });
});

describe("textToBlocks", () => {
  it("gör URL-rader till sidblock och resten till textblock", () => {
    const blocks = textToBlocks(
      "Anteckning ett.\n\nhttps://example.com/\n\nAnteckning två.",
      [],
      deps(),
    );
    expect(blocks.map((b) => b.type)).toEqual(["text", "page", "text"]);
    expect(blocks[1]).toMatchObject({ type: "page", url: "https://example.com/" });
  });

  it("lämnar prosa i fred även när den nämner en domän", () => {
    const blocks = textToBlocks("Vi jämförde example.com och deras priser.", [], deps());
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("text");
  });

  it("accepterar www-rader och normaliserar dem", () => {
    const blocks = textToBlocks("www.google.se", [], deps());
    expect(blocks[0]).toMatchObject({ type: "page", url: "https://www.google.se/" });
  });

  it("behåller snapshot och block-id när URL:en finns kvar", () => {
    const d = deps();
    let doc = docWith("https://example.com/");
    const pageId = doc.blocks[1].id;
    doc = attachSnapshot(
      doc,
      pageId,
      {
        imageRef: "img_1",
        textHtmlRef: "txt_1",
        singleFileRef: null,
        fullPage: false,
        capturedAt: clock.now(),
      },
      d,
    );

    // Skriv om texten: ny rubrik, men samma referens kvar.
    const blocks = textToBlocks("# Ny rubrik\n\nhttps://example.com/", doc.blocks, d);
    const page = blocks.find((b) => b.type === "page");
    expect(page?.id).toBe(pageId);
    expect(page).toMatchObject({ render: { snapshot: { imageRef: "img_1" } } });
  });

  it("tur och retur genom text bevarar strukturen", () => {
    const doc = docWith("https://example.com/", "https://sv.wikipedia.org/wiki/Test");
    const blocks = textToBlocks(documentToText(doc), doc.blocks, deps());
    expect(blocks.map((b) => b.type)).toEqual(doc.blocks.map((b) => b.type));
  });
});
