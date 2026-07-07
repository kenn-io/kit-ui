import { defineConfig } from "@playwright/test";
import net from "node:net";

// Browser tests drive the demo gallery — component behavior only
// verifiable in a real browser (focus traps, measurement loops,
// computed-color contrast). See docs/testing.md.
//
// Each run claims an OS-assigned ephemeral port (bind to 0, read the
// assignment, release it for Vite) so parallel checkouts/worktrees can't
// reuse each other's dev server and silently test the wrong code. The
// port is stashed in the environment because Playwright re-evaluates
// this file in worker processes, which inherit env and must agree on it.
// Pin KIT_UI_TEST_PORT to keep a server alive across runs instead.
if (!process.env.KIT_UI_TEST_PORT) {
  const probe = net.createServer();
  await new Promise<void>((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const claimed = (probe.address() as net.AddressInfo).port;
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  process.env.KIT_UI_TEST_PORT = String(claimed);
}
const port = Number(process.env.KIT_UI_TEST_PORT);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "tests/browser",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: `bunx vite --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
