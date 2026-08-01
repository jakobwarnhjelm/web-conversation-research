import {
  createPageBlock,
  createTextBlock,
  type Block,
  type FlowDocument,
  type IdGenerator,
  type PageBlock,
} from "@tabflow/domain";
import { normalizeUrl } from "./url";

/**
 * Hela notebooken som redigerbar text (F-TXT, F-DOK).
 *
 * Formatet är avsiktligt format-fritt: **markdown-snuttar varvat med webbreferenser**,
 * där en rad som bara innehåller en URL blir ett sidblock och allt annat samlas ihop
 * till textblock. Det gör dokumentet klistrbart — man kan skriva anteckningar och
 * länkar i vilken editor som helst och klistra in alltihop.
 *
 * En rad räknas som en referens bara om den har schema eller inleds med `www.`, så
 * att vanlig prosa som råkar nämna "example.com" inte plötsligt blir ett sidblock.
 */
const URL_LINE = /^(https?:\/\/\S+|www\.\S+)$/i;

export function documentToText(doc: FlowDocument): string {
  const parts = doc.blocks
    .map((b) => (b.type === "text" ? b.markdown.trim() : b.url))
    .filter((s) => s.length > 0);
  return parts.join("\n\n") + "\n";
}

export function textToBlocks(
  text: string,
  previous: readonly Block[],
  deps: { ids: IdGenerator },
  options: { pageMode?: "live" | "snapshot" } = {},
): Block[] {
  // Befintliga sidblock återanvänds per URL så att snapshots, höjd och etikett
  // överlever en textredigering. Utan detta skulle varje sparning kasta fångster.
  const reusable = new Map<string, PageBlock[]>();
  for (const b of previous) {
    if (b.type !== "page") continue;
    const bucket = reusable.get(b.url);
    if (bucket) bucket.push(b);
    else reusable.set(b.url, [b]);
  }

  const out: Block[] = [];
  let buffer: string[] = [];

  const flushText = () => {
    const markdown = buffer.join("\n").trim();
    buffer = [];
    if (markdown) out.push(createTextBlock({ markdown }, deps));
  };

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!URL_LINE.test(trimmed)) {
      buffer.push(line);
      continue;
    }
    const url = normalizeUrl(trimmed);
    if (!url) {
      buffer.push(line);
      continue;
    }
    flushText();
    const existing = reusable.get(url)?.shift();
    out.push(existing ?? createPageBlock({ url, mode: options.pageMode }, deps));
  }
  flushText();

  return out;
}
