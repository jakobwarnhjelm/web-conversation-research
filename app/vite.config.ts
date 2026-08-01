import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Domänkärnan konsumeras som källa (avsnitt 12.1: M0 är ren TS utan React-beroende).
      "@tabflow/domain": fileURLToPath(new URL("../domain/src/index.ts", import.meta.url)),
    },
  },
});
