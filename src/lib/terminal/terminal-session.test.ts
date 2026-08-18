import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import {
  createTerminalSessionController,
  type TerminalMessageDecision,
  type TerminalSessionController,
  type TerminalSessionState,
} from "./terminal-session.js";
import { webSocketTerminalTransport, type TerminalConnectRequest } from "./transport.js";
import type { TerminalControlMessage } from "./terminal-control-message.js";

class ControlledWebSocket extends EventTarget {
  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;
  binaryType: BinaryType = "arraybuffer";
  readyState = 0;
  readonly sent: Array<string | ArrayBufferLike | Blob | ArrayBufferView> = [];
  closeCount = 0;

  constructor(readonly url: string) {
    super();
  }

  close(): void {
    this.closeCount += 1;
    this.readyState = this.CLOSED;
  }

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
    this.sent.push(data);
  }

  open(): void {
    this.readyState = this.OPEN;
    this.dispatchEvent(new Event("open"));
  }

  message(data: string | ArrayBuffer): void {
    this.dispatchEvent(new MessageEvent("message", { data }));
  }

  peerClose(code = 1006): void {
    this.readyState = this.CLOSED;
    this.dispatchEvent(new CloseEvent("close", { code }));
  }
}

interface Harness {
  controller: TerminalSessionController;
  sockets: ControlledWebSocket[];
  states: TerminalSessionState[];
  disconnects: () => number;
  seen: Array<Uint8Array | TerminalControlMessage>;
}

interface HarnessOptions {
  url?: (request: TerminalConnectRequest) => string | null;
  attachable?: boolean;
  onData?: (data: Uint8Array) => TerminalMessageDecision;
  onControl?: (message: TerminalControlMessage) => TerminalMessageDecision;
  openTimeoutMs?: number;
}

function makeHarness(options: HarnessOptions = {}): Harness {
  const sockets: ControlledWebSocket[] = [];
  const states: TerminalSessionState[] = [];
  const seen: Array<Uint8Array | TerminalControlMessage> = [];
  let disconnects = 0;
  const transport = webSocketTerminalTransport({
    url: options.url ?? (() => "wss://example.invalid/terminal"),
    capabilities: { supportsReplayBoundary: false },
    openTimeoutMs: options.openTimeoutMs ?? 60_000,
    webSocket: (url) => {
      const socket = new ControlledWebSocket(url);
      sockets.push(socket);
      return socket as unknown as WebSocket;
    },
  });
  const controller = createTerminalSessionController({
    transport,
    attachable: options.attachable,
    connectRequest: () => ({
      size: { cols: 80, rows: 24 },
      replayBoundary: false,
      resizeActive: true,
    }),
    onData:
      options.onData ??
      ((data) => {
        seen.push(data);
        return "continue";
      }),
    onControl:
      options.onControl ??
      ((message) => {
        seen.push(message);
        return "continue";
      }),
    onDisconnected: () => {
      disconnects += 1;
    },
    onStateChange: (state) => states.push(state),
  });
  controller.start();
  return { controller, sockets, states, disconnects: () => disconnects, seen };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("terminal socket interruption", () => {
  it("closes a connecting socket when the controller is disposed", () => {
    const { controller, sockets } = makeHarness();

    expect(sockets).toHaveLength(1);
    expect(sockets[0]?.readyState).toBe(0);

    controller.dispose();

    expect(sockets[0]?.closeCount).toBe(1);
  });
});

describe("terminal socket reconnect", () => {
  it("reconnects on a fixed delay after an unexpected close", () => {
    const harness = makeHarness();
    harness.sockets[0]?.open();
    expect(harness.controller.isConnected()).toBe(true);
    harness.sockets[0]?.peerClose();

    expect(harness.sockets).toHaveLength(1);
    expect(harness.controller.isConnected()).toBe(false);
    expect(harness.disconnects()).toBe(1);
    vi.advanceTimersByTime(999);
    expect(harness.sockets).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(harness.sockets).toHaveLength(2);

    harness.controller.dispose();
  });

  it("marks the session resetRequired between a lost connection and its replacement", () => {
    const harness = makeHarness();
    harness.sockets[0]?.open();
    harness.sockets[0]?.peerClose();

    expect(harness.states).toEqual(["connecting", "connected", "resetRequired"]);
    vi.advanceTimersByTime(1_000);
    expect(harness.states).toEqual(["connecting", "connected", "resetRequired", "connecting"]);

    harness.controller.dispose();
  });

  it("resets reconnect backoff after every successful open", () => {
    const harness = makeHarness();
    harness.sockets[0]?.open();
    harness.sockets[0]?.peerClose();
    vi.advanceTimersByTime(1_000);
    harness.sockets[1]?.open();
    harness.sockets[1]?.peerClose();
    vi.advanceTimersByTime(999);
    expect(harness.sockets).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(harness.sockets).toHaveLength(3);

    harness.controller.dispose();
  });

  it("resets reconnect backoff after repeated clean closes", () => {
    const harness = makeHarness();
    harness.sockets[0]?.open();
    expect(harness.controller.isConnected()).toBe(true);
    harness.sockets[0]?.peerClose(1000);
    expect(harness.controller.isConnected()).toBe(false);
    vi.advanceTimersByTime(1_000);
    harness.sockets[1]?.open();
    expect(harness.controller.isConnected()).toBe(true);
    harness.sockets[1]?.peerClose(1000);
    expect(harness.controller.isConnected()).toBe(false);
    vi.advanceTimersByTime(999);
    expect(harness.sockets).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(harness.sockets).toHaveLength(3);

    harness.controller.dispose();
  });

  it("retries never-opened reconnect attempts with capped exponential backoff", () => {
    const harness = makeHarness();
    harness.sockets[0]?.open();
    harness.sockets[0]?.peerClose();
    vi.advanceTimersByTime(1_000);
    expect(harness.sockets).toHaveLength(2);

    // First never-opened failure: 1s backoff.
    harness.sockets[1]?.peerClose();
    vi.advanceTimersByTime(999);
    expect(harness.sockets).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(harness.sockets).toHaveLength(3);

    // Second consecutive never-opened failure: 2s backoff.
    harness.sockets[2]?.peerClose();
    vi.advanceTimersByTime(1_999);
    expect(harness.sockets).toHaveLength(3);
    vi.advanceTimersByTime(1);
    expect(harness.sockets).toHaveLength(4);

    // Third: 4s backoff.
    harness.sockets[3]?.peerClose();
    vi.advanceTimersByTime(3_999);
    expect(harness.sockets).toHaveLength(4);
    vi.advanceTimersByTime(1);
    expect(harness.sockets).toHaveLength(5);

    harness.controller.dispose();
  });

  it("caps never-opened reconnect backoff at thirty seconds", () => {
    const harness = makeHarness();
    harness.sockets[0]?.open();
    harness.sockets[0]?.peerClose();
    vi.advanceTimersByTime(1_000);

    // Six consecutive never-opened failures reach the 30s cap (1,2,4,8,16,30).
    for (let failure = 0; failure < 6; failure += 1) {
      harness.sockets.at(-1)?.peerClose();
      vi.advanceTimersByTime(Math.min(1_000 * 2 ** failure, 30_000));
    }
    const socketsAtCap = harness.sockets.length;
    harness.sockets.at(-1)?.peerClose();
    vi.advanceTimersByTime(29_999);
    expect(harness.sockets).toHaveLength(socketsAtCap);
    vi.advanceTimersByTime(1);
    expect(harness.sockets).toHaveLength(socketsAtCap + 1);

    harness.controller.dispose();
  });

  it("does not drop outbound frames while the socket is connected", () => {
    const harness = makeHarness();
    harness.sockets[0]?.open();
    expect(harness.controller.isConnected()).toBe(true);

    const encoder = new TextEncoder();
    for (let index = 0; index < 300; index += 1) {
      harness.controller.send(encoder.encode(`frame-${index}`));
    }
    expect(harness.sockets[0]?.sent ?? []).toHaveLength(300);

    harness.controller.dispose();
  });

  it("encodes control messages as JSON text frames", () => {
    const harness = makeHarness();
    harness.sockets[0]?.open();

    harness.controller.sendControl({ type: "resize", cols: 120, rows: 40 });
    harness.controller.sendControl({ type: "resize_active", active: true });

    expect(harness.sockets[0]?.sent).toEqual([
      '{"type":"resize","cols":120,"rows":40}',
      '{"type":"resize_active","active":true}',
    ]);

    harness.controller.dispose();
  });
});

describe("terminal process restart", () => {
  it("normalizes browser ArrayBuffer frames before delivering them", () => {
    const harness = makeHarness();
    harness.sockets[0]?.open();

    const frame = Uint8Array.from([0x1b, 0x5b, 0x3f, 0x31, 0x68]);
    harness.sockets[0]?.message(frame.buffer);

    expect(harness.seen).toHaveLength(1);
    expect(harness.seen[0]).toBeInstanceOf(Uint8Array);
    expect(harness.seen[0]).toEqual(frame);

    harness.controller.dispose();
  });

  it("drains frames delivered immediately before close", () => {
    const seen: Array<string | TerminalControlMessage> = [];
    const harness = makeHarness({
      onData: (data) => {
        seen.push(new TextDecoder().decode(data));
        return "continue";
      },
      onControl: (message) => {
        seen.push(message);
        return message.type === "exited" ? "restart" : "continue";
      },
    });
    harness.sockets[0]?.open();

    harness.sockets[0]?.message(
      Uint8Array.from("final output", (char) => char.charCodeAt(0)).buffer as ArrayBuffer,
    );
    harness.sockets[0]?.message('{"type":"exited","code":0}');
    harness.sockets[0]?.peerClose(1000);

    expect(seen).toEqual(["final output", { type: "exited", code: 0 }]);
    vi.advanceTimersByTime(2_000);
    expect(harness.sockets).toHaveLength(2);

    harness.controller.dispose();
  });

  it("waits two seconds before reconnecting after an exited frame", () => {
    const harness = makeHarness({
      onControl: (message) => (message.type === "exited" ? "restart" : "continue"),
    });
    harness.sockets[0]?.open();
    harness.sockets[0]?.message('{"type":"exited"}');

    vi.advanceTimersByTime(1_999);
    expect(harness.sockets).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(harness.sockets).toHaveLength(2);

    harness.controller.dispose();
  });

  it("parks the session as exited when the message decision is stop", () => {
    const harness = makeHarness({
      onControl: (message) => (message.type === "exited" ? "stop" : "continue"),
    });
    harness.sockets[0]?.open();
    harness.sockets[0]?.message('{"type":"exited","code":1}');

    expect(harness.controller.state()).toBe("exited");
    vi.advanceTimersByTime(120_000);
    expect(harness.sockets).toHaveLength(1);

    harness.controller.dispose();
  });
});

describe("terminal session attach failures", () => {
  it("fails permanently when the first connection never opens", () => {
    const harness = makeHarness();
    harness.sockets[0]?.peerClose();

    expect(harness.controller.state()).toBe("failed");
    vi.advanceTimersByTime(120_000);
    expect(harness.sockets).toHaveLength(1);
    expect(harness.disconnects()).toBe(1);
  });

  it("abandons a connection that does not open within the open timeout", () => {
    const harness = makeHarness({ openTimeoutMs: 10_000 });

    vi.advanceTimersByTime(9_999);
    expect(harness.controller.state()).toBe("connecting");
    vi.advanceTimersByTime(1);

    expect(harness.sockets[0]?.closeCount).toBe(1);
    expect(harness.controller.state()).toBe("failed");
  });

  it("never connects when the session is not attachable", () => {
    const harness = makeHarness({ attachable: false });

    vi.advanceTimersByTime(120_000);
    expect(harness.sockets).toHaveLength(0);
    expect(harness.controller.state()).toBe("idle");
  });

  it("parks without retrying when the transport has no target", () => {
    const harness = makeHarness({ url: () => null });

    vi.advanceTimersByTime(120_000);
    expect(harness.sockets).toHaveLength(0);
    expect(harness.controller.state()).toBe("idle");
  });
});
