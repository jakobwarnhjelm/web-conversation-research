import { marked } from "marked";
import DOMPurify from "dompurify";

/**
 * Renderar Markdown → säker HTML (F-TXT-1). Allt innehåll behandlas som otrott
 * (avsnitt 9) → DOMPurify saneras alltid, även för egna anteckningar.
 */
marked.setOptions({ gfm: true, breaks: true });

export function renderMarkdown(md: string): string {
  const raw = marked.parse(md, { async: false }) as string;
  return DOMPurify.sanitize(raw);
}
