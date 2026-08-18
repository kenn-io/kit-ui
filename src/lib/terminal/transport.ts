import {
  decodeTerminalControlMessage,
  type TerminalControlMessage,
} from "./terminal-control-message.js";

// Transport-neutral contract between a terminal pane and whatever carries its
// bytes. The pane never sees URLs, sockets, or wire encodings: it hands the
// transport raw input bytes and typed control messages, and receives raw
// output bytes and typed control messages back. Hosts implement this over a
// websocket (see webSocketTerminalTransport), an Effect-based socket layer,
// or anything else that can move bytes.

/** Control messages the terminal pane sends to the session's host. */
export type TerminalOutboundControlMessage =
  | { type: "resize"; cols: number; rows: number }
  | { type: "claim_resize"; cols: number; rows: number }
  | { type: "refresh"; cols: number; rows: number }
  | { type: "resize_active"; active: boolean };

export interface TerminalTransportCapabilities {
  /**
   * Whether the session host delivers a `replay_ready` control message after
   * replaying retained output on a fresh attachment. A pane connecting to
   * such a host withholds resize/refresh controls until the boundary arrives.
   * This replaces URL sniffing: the transport, which knows what it is
   * connected to, declares the capability explicitly.
   */
  readonly supportsReplayBoundary: boolean;
}

/** Per-attempt parameters the pane provides when a connection is opened. */
export interface TerminalConnectRequest {
  /** Current terminal geometry, or null when replay must precede any resize. */
  readonly size: { cols: number; rows: number } | null;
  /** Whether this attachment requests a replay boundary from the host. */
  readonly replayBoundary: boolean;
  /** Whether this pane currently holds resize authority for the session. */
  readonly resizeActive: boolean;
}

export interface TerminalTransportHandlers {
  onOpen(): void;
  onData(data: Uint8Array): void;
  onControl(message: TerminalControlMessage): void;
  /**
   * The connection ended. `opened` distinguishes a lost connection from one
   * that never became usable — the reconnect machine retries the former with
   * backoff and treats the latter as permanent when nothing ever opened.
   * Called exactly once, after which no other handler fires.
   */
  onClose(info: { opened: boolean }): void;
}

export interface TerminalTransportConnection {
  send(data: Uint8Array): void;
  sendControl(message: TerminalOutboundControlMessage): void;
  close(): void;
}

export interface TerminalTransport {
  readonly capabilities: TerminalTransportCapabilities;
  /**
   * Open one connection attempt. Returns null when the transport cannot
   * currently produce a connection (e.g. no target is configured); the
   * session machine then parks instead of retrying.
   */
  connect(
    request: TerminalConnectRequest,
    handlers: TerminalTransportHandlers,
  ): TerminalTransportConnection | null;
}

const DEFAULT_OPEN_TIMEOUT_MS = 10_000;

export interface WebSocketTerminalTransportOptions {
  /**
   * Build the websocket URL for one connection attempt, including whatever
   * query parameters the host protocol derives from the request. Returning
   * null or undefined parks the session (no retry).
   */
  url(request: TerminalConnectRequest): string | null | undefined;
  capabilities: TerminalTransportCapabilities;
  /** Time allowed for the socket to open before the attempt is abandoned. */
  openTimeoutMs?: number;
  /** Socket factory, for tests and custom constructors. Defaults to global WebSocket. */
  webSocket?: (url: string) => WebSocket;
  /** Decode one inbound text frame. Defaults to the kit control-message JSON. */
  decodeControl?: (data: string) => TerminalControlMessage | null;
  /** Encode one outbound control message to a text frame. Defaults to JSON. */
  encodeControl?: (message: TerminalOutboundControlMessage) => string;
}

/**
 * A TerminalTransport over a browser WebSocket: binary frames carry terminal
 * bytes, text frames carry JSON control messages.
 */
export function webSocketTerminalTransport(
  options: WebSocketTerminalTransportOptions,
): TerminalTransport {
  const decodeControl = options.decodeControl ?? decodeTerminalControlMessage;
  const encodeControl =
    options.encodeControl ?? ((message: TerminalOutboundControlMessage) => JSON.stringify(message));
  const openTimeoutMs = options.openTimeoutMs ?? DEFAULT_OPEN_TIMEOUT_MS;
  const createWebSocket = options.webSocket ?? ((url: string) => new globalThis.WebSocket(url));

  return {
    capabilities: options.capabilities,
    connect(request, handlers) {
      const url = options.url(request);
      if (url === null || url === undefined) return null;

      let socket: WebSocket;
      try {
        socket = createWebSocket(url);
      } catch {
        return null;
      }
      socket.binaryType = "arraybuffer";

      let opened = false;
      let closed = false;
      let openTimeout: ReturnType<typeof setTimeout> | undefined;
      const listeners = new AbortController();

      function finish(): void {
        if (closed) return;
        closed = true;
        if (openTimeout !== undefined) {
          clearTimeout(openTimeout);
          openTimeout = undefined;
        }
        listeners.abort();
        handlers.onClose({ opened });
      }

      openTimeout = setTimeout(() => {
        openTimeout = undefined;
        socket.close();
        finish();
      }, openTimeoutMs);

      function handleOpen(): void {
        if (closed || opened) return;
        opened = true;
        if (openTimeout !== undefined) {
          clearTimeout(openTimeout);
          openTimeout = undefined;
        }
        handlers.onOpen();
      }

      socket.addEventListener("open", handleOpen, { signal: listeners.signal });
      // A constructor-injected socket may already be open (readyState OPEN is
      // 1 per spec); it will never fire another open event.
      if (socket.readyState === 1) {
        queueMicrotask(handleOpen);
      }
      socket.addEventListener(
        "message",
        (event: MessageEvent) => {
          if (closed) return;
          const data: unknown = event.data;
          if (typeof data === "string") {
            const message = decodeControl(data);
            if (message !== null) handlers.onControl(message);
            return;
          }
          if (data instanceof ArrayBuffer) {
            handlers.onData(new Uint8Array(data));
            return;
          }
          if (data instanceof Uint8Array) {
            handlers.onData(data);
          }
        },
        { signal: listeners.signal },
      );
      socket.addEventListener("close", finish, { signal: listeners.signal });
      socket.addEventListener(
        "error",
        () => {
          if (opened) return;
          // A socket that errors before opening may not fire close in every
          // browser; treat it as a failed attempt.
          socket.close();
          finish();
        },
        { signal: listeners.signal },
      );

      return {
        send(data) {
          if (closed || !opened) return;
          socket.send(data);
        },
        sendControl(message) {
          if (closed || !opened) return;
          socket.send(encodeControl(message));
        },
        close() {
          socket.close();
          finish();
        },
      };
    },
  };
}
