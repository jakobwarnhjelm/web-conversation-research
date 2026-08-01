/**
 * Läsbarhetsextraktion som körs INNE i en sidas kontext (F-SNAP-3).
 *
 * VIKTIGT: `grabReadable` måste vara HELT SJÄLVSTÄNDIG. Den serialiseras med
 * `.toString()` och skickas till `webContents.executeJavaScript()`, så den kan inte
 * referera importer eller yttre variabler. Samma medvetna duplicering som Spår A
 * gör i extension/src/injected.ts; app/src/lib/extractReadable.ts är portvarianten
 * som tar ett färdigt Document.
 */
export function grabReadable(): { title: string; textHtml: string; url: string } {
  const url = location.href;

  const DROP = new Set([
    "script", "style", "noscript", "template", "svg", "canvas", "iframe",
    "object", "embed", "form", "button", "input", "select", "textarea",
    "nav", "footer", "header", "aside", "dialog",
  ]);
  const BLOCK = new Set([
    "h1", "h2", "h3", "h4", "h5", "h6", "p", "ul", "ol", "li", "blockquote", "pre", "figcaption",
  ]);
  const INLINE = new Set(["a", "strong", "em", "b", "i", "code", "br"]);

  const escText = (s: string) =>
    s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string);
  const escAttr = (s: string) =>
    s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
  const safeHref = (raw: string | null): string | null => {
    if (!raw) return null;
    const v = raw.trim();
    return /^(https?:|mailto:|tel:)/i.test(v) ? v : null;
  };

  const serialize = (node: Node): string => {
    if (node.nodeType === 3) return escText(node.nodeValue || "");
    if (node.nodeType !== 1) return "";
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    if (DROP.has(tag)) return "";
    if (el.hasAttribute("hidden") || el.getAttribute("aria-hidden") === "true") return "";
    const children = Array.from(el.childNodes).map(serialize).join("");
    if (tag === "br") return "<br>";
    if (tag === "a") {
      const href = safeHref(el.getAttribute("href"));
      const inner = children.trim();
      if (!inner) return "";
      return href ? `<a href="${escAttr(href)}">${inner}</a>` : inner;
    }
    if (BLOCK.has(tag) || INLINE.has(tag)) {
      const inner = children.trim();
      if (!inner && tag !== "li") return "";
      return `<${tag}>${inner}</${tag}>`;
    }
    return children; // okänd tagg: packa upp
  };

  const root =
    document.querySelector("main") ||
    document.querySelector("article") ||
    document.body ||
    document.documentElement;
  const title =
    (document.querySelector("title")?.textContent || "").trim() ||
    (document.querySelector("h1")?.textContent || "").trim() ||
    url;

  let body = serialize(root).replace(/\n{3,}/g, "\n\n").trim();
  if (!body) body = "<p>(inget läsbart innehåll extraherat)</p>";

  const textHtml =
    `<!doctype html>\n<html lang="sv">\n<head>\n<meta charset="utf-8">\n` +
    `<meta name="tabflow:source" content="${escAttr(url)}">\n` +
    `<title>${escText(title)}</title>\n` +
    `<style>body{max-width:44rem;margin:2rem auto;padding:0 1rem;font:16px/1.6 system-ui,sans-serif}a{color:#1f6feb}</style>\n` +
    `</head>\n<body>\n<h1>${escText(title)}</h1>\n` +
    `<p><a href="${escAttr(url)}">${escText(url)}</a></p>\n<hr>\n${body}\n</body>\n</html>\n`;

  return { title, textHtml, url };
}

/** Källkoden som ett IIFE-uttryck, redo för executeJavaScript. */
export const GRAB_READABLE_EXPR = `(${grabReadable.toString()})()`;
