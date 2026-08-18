import { describe, expect, it } from "vite-plus/test";

import { embeddedWebSocketUrl } from "./embeddedWebSocket.js";

describe("embeddedWebSocketUrl", () => {
  it("joins the requested path and query onto the embedder base URL", () => {
    expect(
      embeddedWebSocketUrl(
        "/ws/v1/workspaces/ws-1/terminal?cols=80",
        "wss://embed.example/bridge/",
      ),
    ).toBe("wss://embed.example/bridge/ws/v1/workspaces/ws-1/terminal?cols=80");
  });

  it("returns null without a usable websocket base URL", () => {
    expect(embeddedWebSocketUrl("/ws/v1/terminal", undefined)).toBeNull();
    expect(embeddedWebSocketUrl("/ws/v1/terminal", null)).toBeNull();
    expect(embeddedWebSocketUrl("/ws/v1/terminal", "   ")).toBeNull();
    expect(embeddedWebSocketUrl("/ws/v1/terminal", "https://embed.example/bridge")).toBeNull();
    expect(embeddedWebSocketUrl("/ws/v1/terminal", "not a url")).toBeNull();
  });
});
