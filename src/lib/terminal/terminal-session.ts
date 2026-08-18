import type {
  TerminalConnectRequest,
  TerminalOutboundControlMessage,
  TerminalTransport,
  TerminalTransportConnection,
} from "./transport.js";
import type { TerminalControlMessage } from "./terminal-control-message.js";

// Reconnect state machine driving a TerminalTransport.
//
// A lost connection is never resumed: without replay, resuming a raw PTY
// stream after missed bytes can leave the terminal parser in a corrupted
// state. Instead the machine models an explicit `resetRequired` transition
// between a lost (previously opened) connection and its replacement, telling
// the pane to clear pending parser state before the fresh attachment redraws.
// `connected -> disconnected -> connected` with preserved parse state is not
// a legal sequence.
//
// Retry policy, preserved from the original Effect implementation's covered
// semantics:
// - A connection that closes after opening reconnects on a short fixed delay,
//   and every successful open resets the retry backoff.
// - Reconnect attempts that fail before opening retry with exponential
//   backoff capped at 30 seconds.
// - A "restart" message decision (process exited, restart wanted) reconnects
//   after a longer fixed delay; "stop" parks the machine as `exited`.
// - A machine whose connection NEVER opened fails permanently (`failed`) —
//   an unattachable target must not be hammered with retries.
//
// Transports must not invoke handlers synchronously from within connect();
// the machine finishes wiring the attempt when connect() returns.

export type TerminalSessionState =
  | "idle"
  | "connecting"
  | "connected"
  | "resetRequired"
  | "exited"
  | "failed";

export type TerminalMessageDecision = "continue" | "restart" | "stop";

export interface TerminalSessionOptions {
  readonly transport: TerminalTransport;
  /**
   * Whether the session target can be attached at all. When false the
   * machine never connects (e.g. the process already exited and the host
   * would reject the attachment).
   */
  readonly attachable?: boolean;
  /** Per-attempt connection parameters; called immediately before each attempt. */
  readonly connectRequest: () => TerminalConnectRequest;
  readonly onOpen?: () => void;
  /** Raw terminal output bytes. */
  readonly onData: (data: Uint8Array) => TerminalMessageDecision;
  /** Typed control messages (exited, replay_ready). */
  readonly onControl: (message: TerminalControlMessage) => TerminalMessageDecision;
  readonly onDisconnected?: () => void;
  readonly onStateChange?: (state: TerminalSessionState) => void;
  /** Delay before reconnecting after a connection that had opened closes. */
  readonly reconnectDelayMs?: number;
  /** Delay before reconnecting after a "restart" decision. */
  readonly restartDelayMs?: number;
  /** First backoff delay for reconnect attempts that fail before opening. */
  readonly initialBackoffMs?: number;
  /** Backoff cap for reconnect attempts that fail before opening. */
  readonly maxBackoffMs?: number;
}

export interface TerminalSessionController {
  start(): void;
  dispose(): void;
  send(data: Uint8Array): void;
  sendControl(message: TerminalOutboundControlMessage): void;
  isConnected(): boolean;
  state(): TerminalSessionState;
}

export function createTerminalSessionController(
  options: TerminalSessionOptions,
): TerminalSessionController {
  const reconnectDelayMs = options.reconnectDelayMs ?? 1_000;
  const restartDelayMs = options.restartDelayMs ?? 2_000;
  const initialBackoffMs = options.initialBackoffMs ?? 1_000;
  const maxBackoffMs = options.maxBackoffMs ?? 30_000;

  let state: TerminalSessionState = "idle";
  let started = false;
  let disposed = false;
  let connection: TerminalTransportConnection | null = null;
  let connected = false;
  let everOpened = false;
  let consecutiveNeverOpened = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  function setState(next: TerminalSessionState): void {
    if (state === next) return;
    state = next;
    options.onStateChange?.(state);
  }

  function scheduleAttempt(delayMs: number): void {
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      attempt();
    }, delayMs);
  }

  function attempt(): void {
    if (disposed) return;
    setState("connecting");
    const request = options.connectRequest();

    let finished = false;
    // Set by a message decision before the machine closes its own connection,
    // so the resulting onClose routes to the decision's outcome instead of
    // the transport-loss path.
    let pendingOutcome: "restart" | "stop" | null = null;

    function applyDecision(decision: TerminalMessageDecision): void {
      if (decision === "continue" || finished || pendingOutcome !== null) return;
      pendingOutcome = decision;
      connection?.close();
    }

    const created = options.transport.connect(request, {
      onOpen() {
        if (disposed || finished) return;
        everOpened = true;
        consecutiveNeverOpened = 0;
        connected = true;
        setState("connected");
        options.onOpen?.();
      },
      onData(data) {
        if (disposed || finished) return;
        applyDecision(options.onData(data));
      },
      onControl(message) {
        if (disposed || finished) return;
        applyDecision(options.onControl(message));
      },
      onClose({ opened }) {
        if (finished) return;
        finished = true;
        connection = null;
        connected = false;
        options.onDisconnected?.();
        if (disposed) return;
        if (pendingOutcome === "stop") {
          setState("exited");
          return;
        }
        if (pendingOutcome === "restart") {
          setState("resetRequired");
          scheduleAttempt(restartDelayMs);
          return;
        }
        if (opened) {
          setState("resetRequired");
          scheduleAttempt(reconnectDelayMs);
          return;
        }
        if (!everOpened) {
          // Never-opened attachments fail permanently: the target is not
          // attachable, and retrying would hammer the host.
          setState("failed");
          return;
        }
        consecutiveNeverOpened += 1;
        const backoff = Math.min(
          initialBackoffMs * 2 ** (consecutiveNeverOpened - 1),
          maxBackoffMs,
        );
        scheduleAttempt(backoff);
      },
    });
    if (created === null) {
      // The transport has no target right now; park without retrying.
      setState("idle");
      return;
    }
    connection = created;
  }

  return {
    start() {
      if (started || disposed) return;
      started = true;
      if (options.attachable === false) return;
      attempt();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (retryTimer !== undefined) {
        clearTimeout(retryTimer);
        retryTimer = undefined;
      }
      const active = connection;
      connection = null;
      connected = false;
      active?.close();
    },
    send(data) {
      if (!connected || connection === null) return;
      connection.send(data);
    },
    sendControl(message) {
      if (!connected || connection === null) return;
      connection.sendControl(message);
    },
    isConnected() {
      return connected;
    },
    state() {
      return state;
    },
  };
}
