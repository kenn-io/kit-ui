import { defineConfig } from "@playwright/test";

// Browser tests drive the demo gallery — component behavior only
// verifiable in a real browser (focus traps, measurement loops,
// computed-color contrast). See docs/testing.md.
//
// Override the port when another checkout/worktree already holds 4198:
// reuseExistingServer would otherwise silently test that checkout's code.
const port = Number(process.env.KIT_UI_TEST_PORT ?? 4198);

export default defineConfig({
  testDir: "tests/browser",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: `bunx vite --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
  },
});
