# Terminal

Reusable terminal presentation, imported from the dedicated subpath
`@kenn-io/kit-ui/terminal` — deliberately **not** re-exported from the package
root: the pane peers on `@xterm/*` (declared as optional peer dependencies at
the versions the reference host pins) and only terminal-embedding apps should
pull that graph in. Everything in the subpath is framework-plain TypeScript —
no Effect, no app runtime; hosts with an effect system adapt at the
`TerminalTransport` boundary.

```svelte
<script lang="ts">
  import { XtermTerminalPane, webSocketTerminalTransport } from "@kenn-io/kit-ui/terminal";

  const transport = webSocketTerminalTransport({
    url: (request) => buildTerminalUrl(request), // host owns URL + query params
    capabilities: { supportsReplayBoundary: false },
  });
</script>

<XtermTerminalPane
  {transport}
  settings={{ fontFamily: settings.fontFamily, fontSize: settings.fontSize }}
  onExit={(code) => handleExit(code)}
  onError={(error) => flash(error.kind)}
/>
```

## XtermTerminalPane

An xterm.js terminal bound to one `TerminalTransport`. The pane owns
rendering (WebGL with built-in fallback), input, paste sanitization,
gesture-gated OSC 52 clipboard writes, resize authority, tmux drag
autoscroll, link handling, and reconnect presentation. It never sees URLs or
sockets.

### Props

| Prop                      | Type                                 | Default                 | Notes                                                                                                                                        |
| ------------------------- | ------------------------------------ | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `transport`               | `TerminalTransport`                  | required                | Carries bytes and control messages; see below                                                                                                |
| `settings`                | `TerminalPaneSettings`               | `{}`                    | fontFamily/fontSize/scrollback/lineHeight/letterSpacing/cursorBlink/fontLigatures; the default font stack comes from the `--font-mono` token |
| `attachable`              | `boolean`                            | `true`                  | `false` renders `detachedMessage` and never connects (the host knows the process already exited)                                             |
| `detachedMessage`         | `string`                             | `"Session unavailable"` | Banner written when not attachable                                                                                                           |
| `reconnectOnExit`         | `boolean`                            | `true`                  | Whether a process-exit control message reconnects (restart) or parks (stop)                                                                  |
| `active`                  | `boolean`                            | `true`                  | Painted split leaves are active; inactive panes hold no resize authority                                                                     |
| `renderingEnabled`        | `boolean`                            | `true`                  | `false` parks the WebGL renderer (retained pane pooling) while keeping the parsed buffer and socket                                          |
| `autoFocus`               | `boolean`                            | `true`                  | Focus on creation only when the mount-time focus context is still current and not a dialog/menu/input                                        |
| `cursorWheelInput`        | `boolean`                            | `false`                 | Send wheel gestures as cursor keys to TUIs that own no scrollback                                                                            |
| `disabled`                | `boolean`                            | `false`                 | Blocks stdin, paste, and clipboard authority                                                                                                 |
| `onExit`                  | `(code: number) => void`             | —                       | Fired on the `exited` control message                                                                                                        |
| `onConnectionChange`      | `(connected: boolean) => void`       | —                       | Socket-level connectivity                                                                                                                    |
| `onError`                 | `(error: TerminalPaneError) => void` | —                       | `clipboard-write-blocked`, `connect-failed`, `terminal-start-failed`; hosts surface these however they surface errors                        |
| `instrumentation`         | `TerminalPaneInstrumentation`        | —                       | Optional startup/switch timing hook (`terminal-constructed`, `socket-open`, `fonts-ready`, `first-bytes`, `first-paint`)                     |
| `clipboardServerFallback` | `(text: string) => Promise<void>`    | —                       | Host loopback clipboard write used when the browser denies every in-page path; see `createTerminalClipboardServerFallback`                   |

Exported methods (via `bind:this`): `focus()`, `sendInput(data)`,
`sendPastedInput(data, suffix?)`.

### Security invariants carried by the pane

- Browser paste is owned once at the container boundary, sanitized
  (`sanitizeTerminalPasteText`), and sent as one payload; single-line paste is
  never delegated to xterm. The path works on insecure HTTP origins.
- OSC 52 writes are bounded, write-only, validated synchronously, and only
  honored after a recent one-shot trusted DOM gesture (keyboard, or a pointer
  drag that confirmed selection intent). Terminal output is never input
  provenance. Authority is revoked on outside pointerdown, focus transfer,
  pane inactivity/disable, window blur, or document hide — revocation also
  stops an in-flight fallback chain between stages.
- Detected and OSC 8 links open only with the platform modifier, only
  http(s), and always with `noopener,noreferrer`.

## TerminalTransport

The transport-neutral boundary. Implementations move raw bytes and typed
control messages; the pane and reconnect machine are transport-blind.

```ts
interface TerminalTransport {
  readonly capabilities: { supportsReplayBoundary: boolean };
  connect(
    request: TerminalConnectRequest,
    handlers: TerminalTransportHandlers,
  ): TerminalTransportConnection | null;
}
```

- `TerminalConnectRequest` carries per-attempt parameters: initial `size`
  (null when a replay boundary must precede any resize), `replayBoundary`,
  and `resizeActive`.
- Handlers: `onOpen`, `onData(Uint8Array)`, `onControl(message)`,
  `onClose({ opened })` — exactly once, last.
- Outbound control messages: `resize`, `claim_resize`, `refresh`,
  `resize_active`. Inbound: `exited` (optional code), `replay_ready`.
- `supportsReplayBoundary` is an explicit capability, not URL sniffing: a
  capable host queues `replay_ready` after replaying retained output, and the
  pane withholds resize/refresh controls until the boundary has parsed.
- Transports must not invoke handlers synchronously from inside `connect()`.

`webSocketTerminalTransport({ url, capabilities, ... })` is the provided
implementation: binary frames are terminal bytes, text frames are JSON
control messages, with an open timeout (default 10s) and an injectable socket
constructor for tests.

## Reconnect machine

`createTerminalSessionController` drives a transport with an explicit state
machine: `idle → connecting → connected → resetRequired → …`, plus terminal
states `exited` and `failed`. A lost connection is never resumed — resuming a
raw PTY stream after missed bytes can corrupt the parser — so the machine
signals `resetRequired` between a lost (previously opened) connection and its
replacement, and the pane clears pending parser state before the fresh
attachment redraws.

Retry policy:

- close after open → reconnect on a fixed short delay (default 1s); every
  successful open resets backoff
- attempts failing before open — including the very first, so a transient
  startup or network race never strands a fresh terminal → exponential
  backoff capped at 30s, indefinitely by default
- message decision `restart` (process exited, reconnect wanted) → fixed 2s
  delay; `stop` → parks as `exited`
- `preOpenRetryLimit` optionally bounds consecutive pre-open retries;
  exhausting it parks as permanent `failed` (for hosts that must not hammer
  an unattachable target). `attachable: false` and a transport with no
  target never connect at all (`idle`)

## Utilities in the subpath

| Module                       | Exports                                                                                             |
| ---------------------------- | --------------------------------------------------------------------------------------------------- |
| `bracketedPaste`             | Paste sanitization and bracketed-paste payload construction                                         |
| `osc52Clipboard`             | Bounded, validating OSC 52 write parser (rejects reads, non-`c` selections, oversize, bad UTF-8)    |
| `terminalClipboardWriter`    | Gesture-gated clipboard capability machine + browser port                                           |
| `terminalClipboardFallback`  | `createTerminalClipboardServerFallback({ url, fetch })` — host-decorated JSON POST                  |
| `tmuxMouseDragAutoscroll`    | Clamped edge wheel/drag reports for tmux SGR drags leaving the pane                                 |
| `sharedTerminalTextureAtlas` | Repaint siblings after clearing xterm's shared WebGL atlas                                          |
| `terminalFontFamily`         | Font stack merging; primary-face extraction for `document.fonts.load`                               |
| `terminalGeometryIntent`     | Short-lived "user is deliberately resizing" window shared across panes                              |
| `terminal-focus`             | Initial-focus intent that never steals focus from dialogs/menus/inputs                              |
| `terminal-layout`            | Pane split-tree and workflow-tab tree algebra, persistence parsing/normalizing                      |
| `terminal-drag`              | Token-based drag payloads for sessions/tabs; `bindExternalTerminalDragEnd` hooks a host drag system |
| `embeddedWebSocket`          | Resolve a ws path against an embedder-provided base URL (host owns how the base reaches the page)   |
| `animationFrameScheduler`    | Coalesce work bursts to one callback per frame                                                      |

## Selectors

Stable class names: `kit-terminal-pane` (container),
`kit-terminal-pane__link-tooltip` (hovered-link disclosure).
