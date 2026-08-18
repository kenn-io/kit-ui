import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { createTerminalClipboardServerFallback } from "./terminalClipboardFallback.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("terminal clipboard server fallback", () => {
  it("posts text as JSON through the host-provided fetch", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init: RequestInit) => new Response(null, { status: 204 }),
    );
    const write = createTerminalClipboardServerFallback({
      url: "https://forge.local/api/v1/terminal/clipboard",
      fetch: fetchMock,
    });

    await write("copied in Firefox");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://forge.local/api/v1/terminal/clipboard");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ text: "copied in Firefox" }));
  });

  it("uses the global fetch when the host supplies none", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const write = createTerminalClipboardServerFallback({ url: "/clipboard" });

    await write("copied");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects when the server cannot write the local clipboard", async () => {
    const write = createTerminalClipboardServerFallback({
      url: "/clipboard",
      fetch: vi.fn(async () => new Response(null, { status: 503 })),
    });

    await expect(write("blocked")).rejects.toThrow("terminal clipboard fallback failed (503)");
  });
});
