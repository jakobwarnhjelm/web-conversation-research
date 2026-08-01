import type { PageSource, TextHtmlExtractor } from "../ports";

/**
 * Läsbarhetsextraktion (F-SNAP-3): rå sid-DOM → avskalad, fristående text-HTML.
 * Behåller rubriker, text, listor, länkar; strippar skript, stilar, spårare och
 * tunga inbäddningar (iframe/canvas/svg/object). Resultatet är en självständig
 * HTML-fil för sökbarhet (F-SNAP-6), textkopiering, tillgänglighet och arkiv.
 *
 * Detta är avsiktligt en enkel, deterministisk heuristik — inte full Mozilla
 * Readability. Den delas mellan Spår A (content script) och Spår B (webview-DOM).
 */

// Element vars innehåll kastas helt.
const DROP = new Set([
  "script", "style", "noscript", "template", "svg", "canvas", "iframe",
  "object", "embed", "form", "button", "input", "select", "textarea",
  "nav", "footer", "header", "aside", "dialog",
]);

// Blocktaggar som behålls.
const BLOCK = new Set([
  "h1", "h2", "h3", "h4", "h5", "h6", "p", "ul", "ol", "li",
  "blockquote", "pre", "figcaption",
]);

// Inline-taggar som behålls.
const INLINE = new Set(["a", "strong", "em", "b", "i", "code", "br"]);
const VOID = new Set(["br"]);

function escapeText(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
}
function escapeAttr(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function safeHref(raw: string | null): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (/^(https?:|mailto:|tel:)/i.test(v)) return v;
  return null; // släpp javascript:, data:, relativa-till-tracker etc.
}

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

function serialize(node: Node): string {
  if (node.nodeType === TEXT_NODE) return escapeText(node.nodeValue ?? "");
  if (node.nodeType !== ELEMENT_NODE) return "";

  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  if (DROP.has(tag)) return "";
  if (el.getAttribute("hidden") !== null || el.getAttribute("aria-hidden") === "true") return "";

  const children = Array.from(el.childNodes).map(serialize).join("");

  if (VOID.has(tag)) return "<br>";

  if (tag === "a") {
    const href = safeHref(el.getAttribute("href"));
    const inner = children.trim();
    if (!inner) return "";
    return href ? `<a href="${escapeAttr(href)}">${inner}</a>` : inner;
  }

  if (BLOCK.has(tag) || INLINE.has(tag)) {
    const inner = children.trim();
    if (!inner && tag !== "li") return "";
    return `<${tag}>${inner}</${tag}>`;
  }

  // Okänd tagg (div/span/section/...): behåll bara innehållet ("unwrap").
  return children;
}

/** Väljer den mest sannolika innehållsroten. */
function pickRoot(doc: Document): Element {
  return (
    doc.querySelector("main") ??
    doc.querySelector("article") ??
    doc.body ??
    doc.documentElement
  );
}

function getTitle(doc: Document, url: string): string {
  const t = doc.querySelector("title")?.textContent?.trim();
  if (t) return t;
  const h1 = doc.querySelector("h1")?.textContent?.trim();
  return h1 || url;
}

/** Kärnfunktionen: Document → fristående text-HTML-sträng. */
export function extractReadableHtml(doc: Document, url: string): string {
  const title = getTitle(doc, url);
  let body = serialize(pickRoot(doc));
  // Trimma bort tomrader/upprepade blanksteg som unwrapping kan lämna.
  body = body.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!body) body = "<p>(inget läsbart innehåll extraherat)</p>";

  return (
    `<!doctype html>\n<html lang="sv">\n<head>\n<meta charset="utf-8">\n` +
    `<meta name="tabflow:source" content="${escapeAttr(url)}">\n` +
    `<title>${escapeText(title)}</title>\n` +
    `<style>body{max-width:44rem;margin:2rem auto;padding:0 1rem;` +
    `font:16px/1.6 system-ui,sans-serif}a{color:#1f6feb}</style>\n</head>\n<body>\n` +
    `<h1>${escapeText(title)}</h1>\n` +
    `<p><a href="${escapeAttr(url)}">${escapeText(url)}</a></p>\n<hr>\n` +
    `${body}\n</body>\n</html>\n`
  );
}

/** Port-implementation. Tar en Document (Spår A/B) eller rå HTML (tester/import). */
export class ReadableTextHtmlExtractor implements TextHtmlExtractor {
  async extract(source: PageSource): Promise<string> {
    let doc = source.document;
    if (!doc) {
      if (source.html == null) throw new Error("PageSource saknar både document och html");
      doc = new DOMParser().parseFromString(source.html, "text/html");
    }
    return extractReadableHtml(doc, source.url);
  }
}
