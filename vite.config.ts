import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite-plus";

// The library itself is consumed as source (package.json `exports` points at
// src/lib). `vite dev` / `vite build` serve and bundle the demo app.
export default defineConfig({
  plugins: [svelte()],
});
