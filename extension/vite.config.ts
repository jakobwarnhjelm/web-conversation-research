import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Bygger tre artefakter: flow.html (full-page-UI), sw.js (service worker) och
// kopierar public/manifest.json till dist-roten. base:"./" ger relativa sökvägar
// som fungerar under chrome-extension://.
export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@tabflow/domain": r("../domain/src/index.ts"),
      "@tabflow/app": r("../app/src"),
    },
  },
  build: {
    target: "esnext",
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        flow: r("flow.html"),
        sw: r("src/sw.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
