import { describe, expect, it } from "vitest";
import { normalizeUrl } from "../src/ui/AddPageButton";

describe("normalizeUrl", () => {
  it("lägger till https:// när schemat saknas", () => {
    expect(normalizeUrl("example.com")).toBe("https://example.com/");
    expect(normalizeUrl("  www.google.se  ")).toBe("https://www.google.se/");
  });

  it("behåller ett befintligt http- eller https-schema", () => {
    expect(normalizeUrl("http://example.com/a?b=1")).toBe("http://example.com/a?b=1");
    expect(normalizeUrl("https://sv.wikipedia.org/wiki/Webbläsare")).toContain("wikipedia.org");
  });

  it("avvisar tomt, ofullständigt och icke-webbschema", () => {
    expect(normalizeUrl("")).toBeNull();
    expect(normalizeUrl("   ")).toBeNull();
    expect(normalizeUrl("localhost")).toBeNull(); // saknar punkt → inte en värdadress
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("file:///etc/passwd")).toBeNull();
  });
});
