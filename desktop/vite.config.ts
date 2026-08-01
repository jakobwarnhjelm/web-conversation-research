import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Renderaren är samma React-UI som app/ — bara adaptrarna är Electron-specifika.
// base:"./" gör att den byggda index.html fungerar när main-processen laddar den
// från fil (file://) i produktionsläget.
export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@tabflow/domain": r("../domain/src/index.ts"),
      "@tabflow/app": r("../app/src"),
    },
  },
  server: { port: 5174, strictPort: true },
  build: {
    target: "esnext",
    outDir: "dist/renderer",
    emptyOutDir: true,
  },
});
