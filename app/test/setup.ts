import "fake-indexeddb/auto";

// jsdom saknar object-URL-implementationer; enkel polyfill räcker för adaptertester.
if (typeof URL.createObjectURL !== "function") {
  let n = 0;
  // @ts-expect-error – polyfill i testmiljö
  URL.createObjectURL = () => `blob:mock/${n++}`;
  // @ts-expect-error – polyfill i testmiljö
  URL.revokeObjectURL = () => {};
}
