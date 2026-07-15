import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

// The library itself is consumed as source (package.json `exports` points at
// src/lib). `vite dev` / `vite build` serve and bundle the demo app.
export default defineConfig({
  plugins: [svelte()],
  build: {
    // The gallery intentionally bundles every component plus optional heavy
    // peers (Mermaid and Shiki); the published library is consumed as source.
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      onLog(level, log, defaultHandler) {
        // Mermaid keeps its imperative viewer icons lazy for consumers. The
        // gallery also dogfoods those icons through normal components, so they
        // cannot form separate chunks in this one demo build.
        if (
          level === "warn" &&
          log.code === "INEFFECTIVE_DYNAMIC_IMPORT" &&
          log.message.includes("src/lib/utils/markdown-mermaid.ts")
        ) {
          return;
        }
        defaultHandler(level, log);
      },
    },
  },
});
