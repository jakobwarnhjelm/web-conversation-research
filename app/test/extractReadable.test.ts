import { describe, expect, it } from "vitest";
import { extractReadableHtml, ReadableTextHtmlExtractor } from "../src/lib/extractReadable";

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

const SAMPLE = `
<html>
  <head>
    <title>Leverantör A</title>
    <script>window.track('pageview')</script>
    <style>.x{color:red}</style>
  </head>
  <body>
    <nav><a href="/hem">Hem</a></nav>
    <header>Sajtens topp</header>
    <main>
      <h1>Priser hos Leverantör A</h1>
      <p>Vi erbjuder <strong>bra</strong> priser. Se <a href="https://a.example/pris">prislistan</a>.</p>
      <ul><li>Bas</li><li>Pro</li></ul>
      <iframe src="https://ads.example/banner"></iframe>
      <div><span>Inbäddad text i div</span></div>
    </main>
    <footer><a href="/kontakt">Kontakt</a> © 2026</footer>
  </body>
</html>`;

describe("extractReadableHtml (F-SNAP-3)", () => {
  const out = extractReadableHtml(parse(SAMPLE), "https://a.example/pris");

  it("behåller titel, rubriker, text och listor", () => {
    expect(out).toContain("<title>Leverantör A</title>");
    expect(out).toContain("Priser hos Leverantör A");
    expect(out).toContain("<strong>bra</strong>");
    expect(out).toContain("<li>Bas</li>");
    expect(out).toContain("<li>Pro</li>");
  });

  it("behåller säkra länkar med href", () => {
    expect(out).toContain('href="https://a.example/pris"');
    expect(out).toContain(">prislistan</a>");
  });

  it("strippar skript, stilar och tunga inbäddningar", () => {
    expect(out).not.toContain("track('pageview')");
    expect(out).not.toContain("color:red");
    expect(out).not.toContain("<iframe");
    expect(out).not.toContain("ads.example");
  });

  it("strippar nav/header/footer-chrome", () => {
    expect(out).not.toContain("Sajtens topp");
    expect(out).not.toContain("Kontakt");
    expect(out).not.toContain(">Hem<");
  });

  it("packar upp okända element (div/span) men behåller texten", () => {
    expect(out).toContain("Inbäddad text i div");
    // ingen kvarvarande div/span-tagg i brödtexten
    expect(out).not.toMatch(/<div|<span/);
  });

  it("är en fristående HTML-fil med källhänvisning", () => {
    expect(out.startsWith("<!doctype html>")).toBe(true);
    expect(out).toContain('name="tabflow:source"');
  });
});

describe("ReadableTextHtmlExtractor (port)", () => {
  it("extraherar från rå HTML", async () => {
    const ex = new ReadableTextHtmlExtractor();
    const res = await ex.extract({ url: "https://x.example", html: "<h1>Hej</h1><p>Där</p>" });
    expect(res).toContain("Hej");
    expect(res).toContain("Där");
  });

  it("faller inte på tom sida", async () => {
    const ex = new ReadableTextHtmlExtractor();
    const res = await ex.extract({ url: "https://x.example", html: "<body></body>" });
    expect(res).toContain("inget läsbart innehåll");
  });
});
