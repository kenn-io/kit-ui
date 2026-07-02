import { defineConfig } from "@playwright/test";

// Browser tests drive the demo gallery — component behavior only
// verifiable in a real browser (focus traps, measurement loops,
// computed-color contrast). See docs/testing.md.
export default defineConfig({
  testDir: "tests/browser",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:4198",
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: "bunx vite --port 4198 --strictPort",
    url: "http://localhost:4198",
    reuseExistingServer: !process.env.CI,
  },
});
