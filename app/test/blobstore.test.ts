// @vitest-environment node
// Node-miljö: global Blob (undici) round-trippar rent genom fake-indexeddb, till
// skillnad från jsdom:s Blob. Butiken kräver ingen DOM.
import { describe, expect, it } from "vitest";
import { IndexedDBBlobStore } from "../src/adapters/IndexedDBBlobStore";

describe("IndexedDBBlobStore (5.3)", () => {
  it("put → get returnerar samma innehåll", async () => {
    const store = new IndexedDBBlobStore("test-db-1");
    const ref = await store.put(new Blob(["hej text-html"], { type: "text/html" }));
    const back = await store.get(ref);
    expect(back).not.toBeNull();
    expect(await back!.text()).toBe("hej text-html");
  });

  it("ger unika ref:er för varje put (viktigt i batch)", async () => {
    const store = new IndexedDBBlobStore("test-db-2");
    const a = await store.put(new Blob(["a"]));
    const b = await store.put(new Blob(["b"]));
    expect(a).not.toBe(b);
  });

  it("delete tar bort blobben", async () => {
    const store = new IndexedDBBlobStore("test-db-3");
    const ref = await store.put(new Blob(["x"]));
    await store.delete(ref);
    expect(await store.get(ref)).toBeNull();
  });

  it("get på okänd ref ger null", async () => {
    const store = new IndexedDBBlobStore("test-db-4");
    expect(await store.get("blob_saknas")).toBeNull();
  });
});
