<script lang="ts" module>
  import type { TerminalTransport } from "./transport.js";

  export interface TerminalPaneSettings {
    /** Configured font stack; concrete families are kept ahead of the default stack. */
    fontFamily?: string;
    fontSize?: number;
    scrollback?: number;
    lineHeight?: number;
    letterSpacing?: number;
    cursorBlink?: boolean;
    fontLigatures?: boolean;
  }

  export type TerminalPaneErrorKind =
    | "clipboard-write-blocked"
    | "connect-failed"
    | "terminal-start-failed";

  export interface TerminalPaneError {
    kind: TerminalPaneErrorKind;
    cause?: unknown;
  }

  /**
   * Optional switch/startup timing hook. `record` returns whether the phase
   * was actually recorded, so a pane bound to a superseded interaction can
   * skip follow-up phases (first paint) entirely.
   */
  export interface TerminalPaneInstrumentation {
    record(
      phase: "terminal-constructed" | "socket-open" | "fonts-ready" | "first-bytes" | "first-paint",
      detail?: Record<string, unknown>,
    ): boolean;
  }

  export interface TerminalPaneProps {
    /** Carries the session's bytes and control messages. Required. */
    transport: TerminalTransport;
    settings?: TerminalPaneSettings | undefined;
    /**
     * When false the pane renders `detachedMessage` and never connects —
     * hosts pass false when the target process already exited and the
     * server would reject the attachment.
     */
    attachable?: boolean | undefined;
    detachedMessage?: string | undefined;
    reconnectOnExit?: boolean | undefined;
    active?: boolean | undefined;
    renderingEnabled?: boolean | undefined;
    autoFocus?: boolean | undefined;
    cursorWheelInput?: boolean;
    disabled?: boolean;
    onExit?: ((code: number) => void) | undefined;
    onConnectionChange?: ((connected: boolean) => void) | undefined;
    onError?: ((error: TerminalPaneError) => void) | undefined;
    instrumentation?: TerminalPaneInstrumentation | undefined;
    /**
     * Last-resort clipboard write through the host (e.g. a CSRF-protected
     * loopback endpoint), used when the browser denies every in-page write.
     * See createTerminalClipboardServerFallback.
     */
    clipboardServerFallback?: ((text: string) => Promise<void>) | undefined;
  }
</script>

<script lang="ts">
  import { Terminal } from "@xterm/xterm";
  import type { ILinkHandler } from "@xterm/xterm";
  import { FitAddon } from "@xterm/addon-fit";
  import { LigaturesAddon } from "@xterm/addon-ligatures/lib/addon-ligatures.mjs";
  import { WebLinksAddon } from "@xterm/addon-web-links";
  import { WebglAddon } from "@xterm/addon-webgl";
  import "@xterm/xterm/css/xterm.css";
  import { createAnimationFrameScheduler } from "./animationFrameScheduler.js";
  import { createTerminalPastePayload } from "./bracketedPaste.js";
  import { parseOsc52ClipboardWrite } from "./osc52Clipboard.js";
  import {
    createBrowserTerminalClipboardPort,
    createTerminalClipboardWriter,
    type TerminalClipboardWriter,
  } from "./terminalClipboardWriter.js";
  import { buildTerminalFontFamily, primaryTerminalFontFamily } from "./terminalFontFamily.js";
  import { createInitialFocusIntent } from "./terminal-focus.js";
  import {
    clearSharedTerminalTextureAtlas,
    registerTerminalTextureAtlasParticipant,
  } from "./sharedTerminalTextureAtlas.js";
  import {
    createTmuxMouseDragAutoscroll,
    type TmuxMouseDragAutoscroll,
  } from "./tmuxMouseDragAutoscroll.js";
  import {
    createTerminalSessionController,
    type TerminalMessageDecision,
    type TerminalSessionController,
  } from "./terminal-session.js";
  import { currentTerminalGeometryIntent } from "./terminalGeometryIntent.js";
  import type { TerminalControlMessage } from "./terminal-control-message.js";

  let {
    transport,
    settings = undefined,
    attachable = true,
    detachedMessage = "Session unavailable",
    reconnectOnExit = true,
    active = true,
    renderingEnabled = true,
    autoFocus = true,
    cursorWheelInput = false,
    disabled = false,
    onExit,
    onConnectionChange,
    onError,
    instrumentation,
    clipboardServerFallback,
  }: TerminalPaneProps = $props();

  const terminalLinkUsesMetaKey = /Mac/.test(navigator.platform);
  const terminalLinkModifierLabel = terminalLinkUsesMetaKey ? "Cmd" : "Ctrl";

  let containerEl: HTMLElement;
  let terminal: Terminal | null = $state(null);
  let hoveredTerminalLink: string | null = $state(null);
  let fitAddon: FitAddon | null = null;
  let ligaturesAddon: LigaturesAddon | null = null;
  let webglAddon: WebglAddon | null = null;
  let rendererParked = false;
  let terminalSession: TerminalSessionController | null = null;
  let connectionGeneration = 0;
  let unregisterTextureAtlasParticipant: (() => void) | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let requestTerminalRefresh = (): void => {};
  let requestTerminalResize = (): void => {};
  let requestFirstPaint = (): void => {};
  let publishClipboardWrite = (_text: string): void => {};
  // What the PTY was last told. Resends are skipped against this, so a
  // ResizeObserver burst costs one frame, not one per callback.
  let sentCols = 0;
  let sentRows = 0;
  let sentResizeActive: boolean | null = null;
  let claimedGeometryIntentGeneration = 0;
  let resizeReady = true;
  let appliedTerminalFontFamily = "";
  let appliedFontSize = 0;
  let appliedScrollback = 0;
  let appliedLineHeight = 0;
  let appliedLetterSpacing = 0;
  let appliedCursorBlink = true;
  let appliedFontLigatures = false;
  let disposed = false;
  let sawFirstBytes = false;
  let clipboardFailureReported = false;
  let connectFailureReported = false;
  let activePointerId: number | null = null;
  let pointerOrigin: { clientX: number; clientY: number } | null = null;
  let explicitFocusRequested = false;
  const encoder = new TextEncoder();
  let clipboardWriter: TerminalClipboardWriter | undefined;
  let mouseDragAutoscroll: TmuxMouseDragAutoscroll | undefined;
  // Captured at mount, before the async font-load race in start() below,
  // so a later focus steal is detected even though start() itself cannot
  // observe when focus moved during the wait.
  const focusIntent = createInitialFocusIntent();

  export function focus(): void {
    if (terminal !== null) {
      terminal.focus();
      return;
    }
    explicitFocusRequested = true;
  }

  export function sendInput(data: string): boolean {
    if (disabled || !terminal || !terminalSession?.isConnected()) return false;
    terminal.input(data, true);
    return true;
  }

  export function sendPastedInput(data: string, suffix = ""): boolean {
    if (disabled || !terminal || !terminalSession?.isConnected()) return false;
    claimTerminalResize();
    terminalSession.send(
      encoder.encode(
        `${createTerminalPastePayload(data, terminal.modes.bracketedPasteMode)}${suffix}`,
      ),
    );
    return true;
  }

  const TERMINAL_SMOOTH_SCROLL_DURATION = 0;
  const TERMINAL_MINIMUM_CONTRAST_RATIO = 4.5;
  const TERMINAL_FONT_WAIT_MS = 300;
  const TERMINAL_FONT_LOAD_GLYPHS = "0MWim@#";
  const TERMINAL_SEQUENCE_CANCEL = new Uint8Array([0x18]);
  const POINTER_SELECTION_INTENT_MIN_PX = 4;
  const CLIPBOARD_WRITE_QUEUE_LIMIT = 16;

  function reportClipboardFailure(): void {
    if (disposed || clipboardFailureReported) return;
    clipboardFailureReported = true;
    onError?.({ kind: "clipboard-write-blocked" });
  }

  function cancelPendingTerminalSequence(callback: (() => void) | undefined = undefined): void {
    terminal?.write(TERMINAL_SEQUENCE_CANCEL, callback);
  }

  function handleOsc52Clipboard(data: string): boolean {
    const result = parseOsc52ClipboardWrite(data);
    if (result.status === "rejected") return true;
    if (disposed || disabled || !terminalSession?.isConnected()) return true;

    publishClipboardWrite(result.text);
    return true;
  }

  function openTerminalLink(event: MouseEvent, uri: string): void {
    if (!terminalLinkModifierPressed(event)) return;

    let url: URL;
    try {
      url = new URL(uri);
    } catch {
      return;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return;

    window.open(url.href, "_blank", "noopener,noreferrer");
  }

  function terminalLinkModifierPressed(event: MouseEvent): boolean {
    return terminalLinkUsesMetaKey ? event.metaKey : event.ctrlKey;
  }

  function showTerminalLink(_event: MouseEvent, uri: string): void {
    hoveredTerminalLink = uri;
  }

  function hideTerminalLink(): void {
    hoveredTerminalLink = null;
  }

  const terminalLinkHandler: ILinkHandler = {
    activate: openTerminalLink,
    hover: showTerminalLink,
    leave: hideTerminalLink,
  };

  function handleTerminalPointerDown(event: PointerEvent): void {
    if (disposed || disabled) return;
    if (event.button !== 0) {
      if (
        (event.button === 1 || event.button === 2) &&
        event.isTrusted &&
        terminal?.modes.mouseTrackingMode !== "none"
      ) {
        claimTerminalResize();
      }
      return;
    }
    // xterm focuses its hidden textarea from mousedown, but its touch gesture
    // path only handles scrolling. Focus synchronously while the touch/pen
    // activation is live so mobile browsers can open their software keyboard.
    if (active && (event.pointerType === "touch" || event.pointerType === "pen")) {
      terminal?.focus();
    }
    if (!event.isTrusted) return;
    claimTerminalResize();
    if (activePointerId !== null) {
      cancelTerminalPointerGesture();
    }
    // Over an active link, pointer capture retargets mouseup to the container
    // and prevents xterm's linkifier from activating it. Modified non-link
    // gestures still need the normal clipboard and drag lifecycle below.
    if (hoveredTerminalLink !== null && terminalLinkModifierPressed(event)) return;
    activePointerId = event.pointerId;
    pointerOrigin = { clientX: event.clientX, clientY: event.clientY };
    clipboardWriter?.beginPointerGesture();
    try {
      containerEl.setPointerCapture(event.pointerId);
    } catch {
      // The watchdog and global cancellation handlers still bound the gesture.
    }
  }

  function handleTerminalPointerEnd(event: PointerEvent): void {
    if (!event.isTrusted || activePointerId !== event.pointerId) return;
    activePointerId = null;
    pointerOrigin = null;
    releaseTerminalPointerCapture(event.pointerId);
    clipboardWriter?.endPointerGesture();
    mouseDragAutoscroll?.endPointerGesture();
  }

  function releaseTerminalPointerCapture(pointerId: number): void {
    try {
      if (containerEl.hasPointerCapture(pointerId)) {
        containerEl.releasePointerCapture(pointerId);
      }
    } catch {
      // Capture may already be gone after focus or visibility loss.
    }
  }

  function cancelTerminalPointerGesture(pointerId: number | undefined = undefined): void {
    if (pointerId !== undefined && activePointerId !== pointerId) return;
    const capturedPointerId = activePointerId;
    activePointerId = null;
    pointerOrigin = null;
    if (capturedPointerId !== null) {
      releaseTerminalPointerCapture(capturedPointerId);
    }
    clipboardWriter?.cancelPointerGesture();
    mouseDragAutoscroll?.endPointerGesture();
  }

  function handleTerminalPointerCancel(event: PointerEvent): void {
    cancelTerminalPointerGesture(event.pointerId);
  }

  function handleTerminalLostPointerCapture(event: PointerEvent): void {
    if (activePointerId !== event.pointerId) return;
    activePointerId = null;
    pointerOrigin = null;
    clipboardWriter?.cancelPointerGesture();
    mouseDragAutoscroll?.endPointerGesture();
  }

  function cancelTerminalClipboardAuthorization(): void {
    cancelTerminalPointerGesture();
    clipboardWriter?.cancelAuthorization();
  }

  function handleTerminalFocusOut(event: FocusEvent): void {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && containerEl.contains(nextTarget)) return;
    // Pointer capture can briefly produce a focusout without a destination.
    // A concrete external target is an actual focus transfer and must revoke.
    if (nextTarget === null && activePointerId !== null) return;
    cancelTerminalClipboardAuthorization();
  }

  function handleDocumentPointerDown(event: PointerEvent): void {
    const target = event.target;
    if (target instanceof Node && containerEl.contains(target)) return;
    cancelTerminalClipboardAuthorization();
  }

  function handleWindowBlur(): void {
    cancelTerminalClipboardAuthorization();
  }

  function handleDocumentVisibilityChange(): void {
    if (document.visibilityState !== "visible") {
      cancelTerminalClipboardAuthorization();
    }
  }

  $effect(() => {
    if (active && !disabled) return;
    cancelTerminalClipboardAuthorization();
  });

  function handleTerminalKeyDown(event: KeyboardEvent): void {
    if (disposed || disabled || event.isComposing || !event.isTrusted) return;
    claimTerminalResize();
    clipboardWriter?.authorizeKeyboardGesture();
  }

  function handleTerminalCompositionStart(event: CompositionEvent): void {
    if (disposed || disabled || !event.isTrusted) return;
    claimTerminalResize();
  }

  function isBrowserPasteShortcut(event: KeyboardEvent): boolean {
    const pasteModifierPressed = terminalLinkUsesMetaKey ? event.metaKey : event.ctrlKey;
    return !event.altKey && pasteModifierPressed && event.key.toLowerCase() === "v";
  }

  function handleInsecureTerminalRightMouse(event: MouseEvent): void {
    if (window.isSecureContext || event.button !== 2) return;
    event.stopPropagation();
  }

  function handleTerminalWheel(event: WheelEvent): void {
    if (
      disposed ||
      disabled ||
      event.deltaY === 0 ||
      event.ctrlKey ||
      event.shiftKey ||
      !terminal ||
      !terminalSession?.isConnected()
    ) {
      return;
    }

    const activeBuffer = terminal.buffer.active;
    if (terminal.modes.mouseTrackingMode !== "none") {
      claimTerminalResize();
      return;
    }
    if (!cursorWheelInput) return;
    if (activeBuffer.type !== "normal" || activeBuffer.baseY > 0) return;

    event.preventDefault();
    event.stopPropagation();
    claimTerminalResize();
    const cursorPrefix = terminal.modes.applicationCursorKeysMode ? "O" : "[";
    const cursorDirection = event.deltaY < 0 ? "A" : "B";
    terminalSession.send(encoder.encode(`\x1b${cursorPrefix}${cursorDirection}`));
  }

  function hasPointerSelectionIntent(event: PointerEvent): boolean {
    if (pointerOrigin === null) return false;
    const cell = containerEl
      .querySelector<HTMLElement>(".xterm-helper-textarea")
      ?.getBoundingClientRect();
    if (!cell || cell.width <= 0 || cell.height <= 0) return false;

    const deltaX = event.clientX - pointerOrigin.clientX;
    const deltaY = event.clientY - pointerOrigin.clientY;
    const pixelsMovedSquared = deltaX * deltaX + deltaY * deltaY;
    const columnsMoved = deltaX / cell.width;
    const rowsMoved = deltaY / cell.height;
    return (
      pixelsMovedSquared >= POINTER_SELECTION_INTENT_MIN_PX ** 2 &&
      columnsMoved * columnsMoved + rowsMoved * rowsMoved >= 1
    );
  }

  function handleWindowPointerMove(event: PointerEvent): void {
    if (disposed || disabled || !terminal) return;
    if (activePointerId === event.pointerId && hasPointerSelectionIntent(event)) {
      clipboardWriter?.confirmPointerSelection();
      pointerOrigin = null;
    }
    const screen = containerEl.querySelector<HTMLElement>(".xterm-screen");
    const bounds = (screen ?? containerEl).getBoundingClientRect();
    mouseDragAutoscroll?.updatePointer({
      clientX: event.clientX,
      clientY: event.clientY,
      bounds,
      cols: terminal.cols,
      rows: terminal.rows,
    });
  }

  function defaultTerminalFontFamily(): string {
    const rootFontFamily = getComputedStyle(document.documentElement)
      .getPropertyValue("--font-mono")
      .trim();
    return rootFontFamily || "monospace";
  }

  const terminalFontFamily = $derived.by(() => {
    const configured = (settings?.fontFamily ?? "").trim();
    return buildTerminalFontFamily(configured, defaultTerminalFontFamily());
  });
  const terminalFontSize = $derived(settings?.fontSize ?? 14);
  const terminalScrollback = $derived(settings?.scrollback ?? 1000);
  const terminalLineHeight = $derived(settings?.lineHeight ?? 1);
  const terminalLetterSpacing = $derived(settings?.letterSpacing ?? 0);
  const terminalCursorBlink = $derived(settings?.cursorBlink ?? true);
  const terminalFontLigatures = $derived(settings?.fontLigatures ?? false);

  function terminalSupportsReplayBoundary(): boolean {
    return transport.capabilities.supportsReplayBoundary;
  }

  function sendResize(cols: number, rows: number, claim: boolean = false): boolean {
    return sendControl(claim ? "claim_resize" : "resize", cols, rows);
  }

  function sendRefresh(cols: number, rows: number): boolean {
    return sendControl("refresh", cols, rows);
  }

  function claimTerminalResize(): boolean {
    const size = resizeAuthorityRegionSize();
    if (!resizeReady || !size || !terminal || !terminalSession?.isConnected()) return false;

    if (terminal.cols !== size.cols || terminal.rows !== size.rows) {
      fitAddon?.fit();
      terminal.refresh(0, Math.max(0, terminal.rows - 1));
    }
    terminalSession.sendControl({
      type: "claim_resize",
      cols: terminal.cols,
      rows: terminal.rows,
    });
    sentCols = terminal.cols;
    sentRows = terminal.rows;
    return true;
  }

  function sendResizeActive(nextActive: boolean): boolean {
    if (sentResizeActive === nextActive) return false;
    if (terminalSession?.isConnected()) {
      terminalSession.sendControl({ type: "resize_active", active: nextActive });
      sentResizeActive = nextActive;
      return true;
    }
    return false;
  }

  function sendControl(
    type: "claim_resize" | "resize" | "refresh",
    cols: number,
    rows: number,
  ): boolean {
    if (!resizeReady || !terminalSession?.isConnected()) return false;
    terminalSession.sendControl({ type, cols, rows });
    return true;
  }

  function refreshVisibleTerminal(): void {
    const size = resizeAuthorityRegionSize();
    if (!size || !terminal) return;

    fitAddon?.fit();
    const fittedSize = { cols: terminal.cols, rows: terminal.rows };
    terminal.refresh(0, Math.max(0, fittedSize.rows - 1));
    // The server resizes on a refresh's dimensions too, so a delivered refresh
    // counts as the size the PTY now has.
    if (sendRefresh(fittedSize.cols, fittedSize.rows)) {
      sentCols = fittedSize.cols;
      sentRows = fittedSize.rows;
    }
  }

  function redrawTerminalTextureAtlas(): void {
    if (!terminal) return;

    clearSharedTerminalTextureAtlas(terminal);
    terminal.refresh(0, Math.max(0, terminal.rows - 1));
  }

  function shouldUseBuiltinRenderer(): boolean {
    const userAgent = navigator.userAgent.toLowerCase();
    return userAgent.includes("firefox/") || userAgent.includes("android");
  }

  function recreateWebglAddon(): void {
    if (!terminal) return;
    webglAddon?.dispose();
    webglAddon = null;
    if (rendererParked) return;
    if (shouldUseBuiltinRenderer()) {
      scheduleTerminalResize();
      return;
    }
    try {
      const wgl = new WebglAddon({ customGlyphs: true });
      wgl.onContextLoss(() => {
        wgl.dispose();
        if (webglAddon === wgl) webglAddon = null;
        scheduleTerminalResize();
      });
      terminal.loadAddon(wgl);
      webglAddon = wgl;
      scheduleTerminalResize();
    } catch {
      // WebGL unavailable; xterm's built-in renderer remains active.
    }
  }

  function syncRendererState(): void {
    if (!terminal) return;
    const shouldPark = !renderingEnabled;
    if (rendererParked === shouldPark) return;
    rendererParked = shouldPark;
    if (shouldPark) {
      webglAddon?.dispose();
      webglAddon = null;
      return;
    }
    recreateWebglAddon();
    scheduleTerminalRefresh();
  }

  function syncLigaturesAddon(): void {
    if (!terminal) return;
    ligaturesAddon?.dispose();
    ligaturesAddon = null;
    if (terminalFontLigatures) {
      ligaturesAddon = new LigaturesAddon();
      terminal.loadAddon(ligaturesAddon);
    }
    recreateWebglAddon();
  }

  function scheduleTerminalRefresh(): void {
    requestTerminalRefresh();
  }

  function scheduleTerminalResize(): void {
    requestTerminalResize();
  }

  /**
   * The size this terminal's region actually is, or null when it has none.
   *
   * A parked terminal sits in a `display:none` node, whose content box is zero,
   * so the fit addon proposes nothing usable for it — measuring that is what
   * used to resize a live tmux pane to one row. The measurement itself is the
   * geometry check. Painted state is applied separately because
   * `visibility:hidden` retains dimensions.
   */
  function terminalRegionSize(): { cols: number; rows: number } | null {
    if (!fitAddon || !terminal || !containerEl.isConnected) return null;

    const proposed = fitAddon.proposeDimensions();
    if (!proposed) return null;
    if (!Number.isFinite(proposed.cols) || !Number.isFinite(proposed.rows)) return null;
    if (proposed.cols < 1 || proposed.rows < 1) return null;

    return { cols: proposed.cols, rows: proposed.rows };
  }

  function resizeAuthorityRegionSize(): { cols: number; rows: number } | null {
    if (!active) return null;
    return terminalRegionSize();
  }

  /**
   * Push the region's size whenever it differs from what the PTY was last told.
   *
   * Painted state is not focus: every visible split leaf is active and owns its
   * own size. Requiring it here prevents a visibility-hidden tab, whose geometry
   * remains measurable, from resizing the PTY. Sending only on a real change
   * keeps a ResizeObserver burst from turning into a burst of resize frames.
   */
  function resizeVisibleTerminal(): void {
    const size = terminalRegionSize();
    const resizeActive = active && size !== null;
    const authorityChanged = sendResizeActive(resizeActive);
    if (!resizeActive || !size || !terminal) return;

    fitAddon?.fit();
    const fittedSize = { cols: terminal.cols, rows: terminal.rows };
    const dimensionsChanged = fittedSize.cols !== sentCols || fittedSize.rows !== sentRows;
    terminal.refresh(0, Math.max(0, fittedSize.rows - 1));
    // Report the dimensions fit() actually applied. It takes its own fresh
    // measurement, so the region can cross a row or column boundary after the
    // authority preflight above but before xterm is resized.
    // Re-send unchanged dimensions when reclaiming authority because another
    // attachment may have resized the PTY while this region had no geometry.
    if (!authorityChanged && !dimensionsChanged) return;
    // Recorded only once the socket carried it — a resize computed before the
    // socket opened would otherwise be suppressed forever as already sent.
    const geometryIntentGeneration = dimensionsChanged ? currentTerminalGeometryIntent() : null;
    const claim =
      geometryIntentGeneration !== null &&
      geometryIntentGeneration !== claimedGeometryIntentGeneration;
    if (sendResize(fittedSize.cols, fittedSize.rows, claim)) {
      if (claim) {
        claimedGeometryIntentGeneration = geometryIntentGeneration;
      }
      sentCols = fittedSize.cols;
      sentRows = fittedSize.rows;
    }
  }

  function handleTerminalPaste(event: ClipboardEvent): void {
    if (disabled) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (!terminalSession?.isConnected()) return;

    const pastedText =
      event.clipboardData?.getData("text/plain") || event.clipboardData?.getData("text") || "";
    if (pastedText === "") return;

    if (!sendPastedInput(pastedText)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function handleTerminalData(data: Uint8Array): TerminalMessageDecision {
    if (!terminal) return "continue";
    if (!sawFirstBytes) {
      sawFirstBytes = true;
      if (instrumentation?.record("first-bytes", { byteLength: data.byteLength })) {
        terminal.write(data, () => {
          requestFirstPaint();
        });
      } else {
        terminal.write(data);
      }
    } else {
      terminal.write(data);
    }
    return "continue";
  }

  function handleTerminalControl(message: TerminalControlMessage): TerminalMessageDecision {
    if (!terminal) return "continue";
    if (message.type === "replay_ready" && terminalSupportsReplayBoundary()) {
      const generation = connectionGeneration;
      cancelPendingTerminalSequence(() => {
        if (disposed || generation !== connectionGeneration || !terminalSession?.isConnected())
          return;
        resizeReady = true;
        scheduleTerminalRefresh();
      });
      return "continue";
    }
    if (message.type !== "exited") return "continue";

    cancelPendingTerminalSequence();
    onExit?.(message.code ?? 0);
    if (reconnectOnExit) {
      terminal.write("\r\n\x1b[90m[Process exited — reconnecting...]\x1b[0m\r\n");
      return "restart";
    }
    terminal.write("\r\n\x1b[90m[Process exited]\x1b[0m\r\n");
    return "stop";
  }

  function createTerminalSession(): TerminalSessionController {
    return createTerminalSessionController({
      transport,
      connectRequest: () => {
        mouseDragAutoscroll?.reset();
        const replayBoundary = terminalSupportsReplayBoundary();
        sentResizeActive = null;
        resizeReady = !replayBoundary;
        return {
          size: replayBoundary || !terminal ? null : { cols: terminal.cols, rows: terminal.rows },
          replayBoundary,
          resizeActive: resizeAuthorityRegionSize() !== null,
        };
      },
      onOpen: () => {
        connectionGeneration += 1;
        onConnectionChange?.(true);
        instrumentation?.record("socket-open");
        sendResizeActive(resizeAuthorityRegionSize() !== null);
        const size = resizeAuthorityRegionSize();
        if (resizeReady && size && (size.cols !== sentCols || size.rows !== sentRows)) {
          scheduleTerminalRefresh();
        }
      },
      onData: handleTerminalData,
      onControl: handleTerminalControl,
      onDisconnected: () => {
        onConnectionChange?.(false);
        cancelPendingTerminalSequence();
        clipboardWriter?.cancelAuthorization();
        mouseDragAutoscroll?.reset();
      },
      onStateChange: (state) => {
        if (state !== "failed" || disposed || connectFailureReported) return;
        connectFailureReported = true;
        onError?.({ kind: "connect-failed" });
      },
    });
  }

  function cleanup(): void {
    disposed = true;
    pointerOrigin = null;
    clipboardWriter?.dispose();
    clipboardWriter = undefined;
    mouseDragAutoscroll?.dispose();
    mouseDragAutoscroll = undefined;
    terminalSession?.dispose();
    terminalSession = null;
    resizeObserver?.disconnect();
    resizeObserver = null;
    refreshScheduler.cancel();
    resizeScheduler.cancel();
    firstPaintScheduler.cancel();
    requestTerminalRefresh = () => {};
    requestTerminalResize = () => {};
    requestFirstPaint = () => {};
    publishClipboardWrite = () => {};
    containerEl?.removeEventListener("paste", handleTerminalPaste, true);
    if (terminal) {
      unregisterTextureAtlasParticipant?.();
      unregisterTextureAtlasParticipant = null;
      ligaturesAddon?.dispose();
      ligaturesAddon = null;
      webglAddon?.dispose();
      webglAddon = null;
      terminal.dispose();
      terminal = null;
    }
  }

  $effect(() => {
    if (!terminal) return;
    if (
      terminalFontFamily === appliedTerminalFontFamily &&
      terminalFontSize === appliedFontSize &&
      terminalScrollback === appliedScrollback &&
      terminalLineHeight === appliedLineHeight &&
      terminalLetterSpacing === appliedLetterSpacing &&
      terminalCursorBlink === appliedCursorBlink &&
      terminalFontLigatures === appliedFontLigatures
    ) {
      return;
    }
    const ligaturesChanged = terminalFontLigatures !== appliedFontLigatures;
    appliedTerminalFontFamily = terminalFontFamily;
    appliedFontSize = terminalFontSize;
    appliedScrollback = terminalScrollback;
    appliedLineHeight = terminalLineHeight;
    appliedLetterSpacing = terminalLetterSpacing;
    appliedCursorBlink = terminalCursorBlink;
    appliedFontLigatures = terminalFontLigatures;
    terminal.options.fontFamily = terminalFontFamily;
    terminal.options.fontSize = terminalFontSize;
    terminal.options.scrollback = terminalScrollback;
    terminal.options.lineHeight = terminalLineHeight;
    terminal.options.letterSpacing = terminalLetterSpacing;
    terminal.options.cursorBlink = terminalCursorBlink;
    terminal.options.disableStdin = disabled;
    if (ligaturesChanged) {
      syncLigaturesAddon();
    }
    redrawTerminalTextureAtlas();
    fitAddon?.fit();
    if (active) scheduleTerminalRefresh();
  });

  $effect(syncRendererState);

  $effect(() => {
    if (!terminal) return;
    terminal.options.disableStdin = disabled;
  });

  $effect(() => {
    if (!terminal) return;
    // Authority requires painted state plus geometry, never focus: every
    // painted split leaf stays eligible, while hidden and parked terminals do
    // not dictate a size for the pane the user is actually looking at.
    sendResizeActive(resizeAuthorityRegionSize() !== null);
    if (active) scheduleTerminalRefresh();
  });

  const refreshScheduler = createAnimationFrameScheduler(() => {
    if (!disposed) refreshVisibleTerminal();
  });
  const resizeScheduler = createAnimationFrameScheduler(() => {
    if (!disposed) resizeVisibleTerminal();
  });
  // First paint is recorded one frame after the scheduler's own frame, so the
  // measure lands after the browser actually painted the written bytes.
  const firstPaintScheduler = createAnimationFrameScheduler(() => {
    requestAnimationFrame(() => {
      if (!disposed) instrumentation?.record("first-paint");
    });
  });

  const clipboardWriteQueue: string[] = [];
  let clipboardPumpActive = false;

  async function pumpClipboardWrites(): Promise<void> {
    if (clipboardPumpActive) return;
    clipboardPumpActive = true;
    try {
      while (clipboardWriteQueue.length > 0) {
        if (disposed || !clipboardWriter) return;
        const text = clipboardWriteQueue.shift()!;
        try {
          const outcome = await clipboardWriter.write(text);
          if (outcome === "blocked") reportClipboardFailure();
        } catch {
          reportClipboardFailure();
        }
      }
    } finally {
      clipboardPumpActive = false;
    }
  }

  function startTerminal(): void {
    const term = new Terminal({
      theme: {
        background: "#0d1117",
        foreground: "#c9d1d9",
        cursor: "#58a6ff",
      },
      // The ligatures addon registers a character joiner, which xterm
      // exposes as proposed API. This is constructor-only and must be on
      // before a user enables ligatures at runtime.
      allowProposedApi: true,
      allowTransparency: false,
      cursorBlink: terminalCursorBlink,
      drawBoldTextInBrightColors: true,
      fontFamily: terminalFontFamily,
      fontSize: terminalFontSize,
      scrollback: terminalScrollback,
      letterSpacing: terminalLetterSpacing,
      lineHeight: terminalLineHeight,
      linkHandler: terminalLinkHandler,
      minimumContrastRatio: TERMINAL_MINIMUM_CONTRAST_RATIO,
      rescaleOverlappingGlyphs: true,
      scrollOnEraseInDisplay: true,
      smoothScrollDuration: TERMINAL_SMOOTH_SCROLL_DURATION,
      vtExtensions: {
        kittyKeyboard: true,
      },
      disableStdin: disabled,
    });
    terminal = term;
    unregisterTextureAtlasParticipant = registerTerminalTextureAtlasParticipant(terminal);

    term.open(containerEl);
    term.attachCustomKeyEventHandler((event) => !isBrowserPasteShortcut(event));
    term.parser.registerOscHandler(52, handleOsc52Clipboard);
    instrumentation?.record("terminal-constructed");
    containerEl.addEventListener("paste", handleTerminalPaste, true);

    const fit = new FitAddon();
    fitAddon = fit;
    term.loadAddon(fit);
    term.loadAddon(
      new WebLinksAddon(openTerminalLink, {
        hover: showTerminalLink,
        leave: hideTerminalLink,
      }),
    );

    if (terminalFontLigatures) {
      ligaturesAddon = new LigaturesAddon();
      term.loadAddon(ligaturesAddon);
    }
    rendererParked = !renderingEnabled;
    recreateWebglAddon();

    appliedTerminalFontFamily = terminalFontFamily;
    appliedFontSize = terminalFontSize;
    appliedScrollback = terminalScrollback;
    appliedLineHeight = terminalLineHeight;
    appliedLetterSpacing = terminalLetterSpacing;
    appliedCursorBlink = terminalCursorBlink;
    appliedFontLigatures = terminalFontLigatures;
    fit.fit();

    // Renderer autofocus runs only at terminal creation. Explicit host
    // requests use focus() above, but reveal- or enable-driven re-runs of the
    // active effect must not steal focus from controls. The font-load wait is
    // async, so creation autofocus only moves focus when the mount-time context
    // is still current and isn't a dialog/menu/input.
    const focusExplicitly = explicitFocusRequested;
    explicitFocusRequested = false;
    if (active && !disabled && (focusExplicitly || (autoFocus && focusIntent.shouldFocus())))
      term.focus();

    term.onData((data: string) => {
      if (disabled) return;
      if (terminalSession?.isConnected()) {
        terminalSession.send(encoder.encode(data));
        mouseDragAutoscroll?.observeTerminalData(data);
      }
    });

    term.onBinary((data: string) => {
      if (disabled) return;
      if (terminalSession?.isConnected()) {
        const buf = new Uint8Array(data.length);
        for (let i = 0; i < data.length; i++) {
          buf[i] = data.charCodeAt(i) & 0xff;
        }
        terminalSession.send(buf);
      }
    });
  }

  function startOwnedTerminal(): void {
    startTerminal();
    resizeObserver = new ResizeObserver(() => scheduleTerminalResize());
    resizeObserver.observe(containerEl);
    if (!attachable) {
      terminal?.write(`\r\n\x1b[90m[${detachedMessage}]\x1b[0m\r\n`);
      return;
    }
    const session = createTerminalSession();
    terminalSession = session;
    session.start();
  }

  async function start(): Promise<void> {
    clipboardWriter = createTerminalClipboardWriter(
      createBrowserTerminalClipboardPort(
        clipboardServerFallback ? { writeLocalText: clipboardServerFallback } : {},
      ),
      { onPointerGestureTimeout: cancelTerminalPointerGesture },
    );
    mouseDragAutoscroll = createTmuxMouseDragAutoscroll({
      send(data) {
        if (disabled || !terminalSession?.isConnected()) return;
        terminalSession.send(encoder.encode(data));
      },
    });
    requestTerminalRefresh = () => void refreshScheduler.schedule();
    requestTerminalResize = () => void resizeScheduler.schedule();
    requestFirstPaint = () => void firstPaintScheduler.schedule();
    publishClipboardWrite = (text) => {
      if (clipboardWriteQueue.length >= CLIPBOARD_WRITE_QUEUE_LIMIT) {
        reportClipboardFailure();
        return;
      }
      clipboardWriteQueue.push(text);
      void pumpClipboardWrites();
    };

    const fontSet = document.fonts;
    if (typeof fontSet?.load !== "function") {
      instrumentation?.record("fonts-ready", { unsupported: true });
      startOwnedTerminal();
      return;
    }

    // Loading only the selected terminal face avoids making xterm wait
    // for unrelated page fonts. The bound keeps terminal construction
    // moving when the face is slow or unavailable; a late completion
    // then repairs the fallback metrics once, provided the pane lives.
    const fontDescriptor = `${terminalFontSize}px ${primaryTerminalFontFamily(terminalFontFamily)}`;
    const fontCompletion: Promise<"loaded" | "failed"> = (async () => {
      try {
        await fontSet.load(fontDescriptor, TERMINAL_FONT_LOAD_GLYPHS);
        return "loaded";
      } catch {
        return "failed";
      }
    })();
    const fontResult = await Promise.race([
      fontCompletion,
      new Promise<"timed-out">((resolve) => {
        setTimeout(() => resolve("timed-out"), TERMINAL_FONT_WAIT_MS);
      }),
    ]);
    if (disposed) return;
    instrumentation?.record(
      "fonts-ready",
      fontResult === "failed"
        ? { error: true }
        : fontResult === "timed-out"
          ? { timedOut: true }
          : undefined,
    );
    startOwnedTerminal();

    if (fontResult === "timed-out" && (await fontCompletion) === "loaded") {
      if (disposed || !terminal) return;
      clearSharedTerminalTextureAtlas(terminal);
      // New metrics mean a new measurement; resizeVisibleTerminal re-fits,
      // repaints, and pushes the size only if the region now works out
      // differently.
      resizeVisibleTerminal();
    }
  }

  function attachTerminalPane(node: HTMLElement) {
    containerEl = node;
    void start().catch((cause: unknown) => {
      if (!disposed) onError?.({ kind: "terminal-start-failed", cause });
    });
    return cleanup;
  }
</script>

<svelte:window
  onblur={handleWindowBlur}
  onpointermove={handleWindowPointerMove}
  onpointerup={handleTerminalPointerEnd}
  onpointercancel={handleTerminalPointerCancel}
/>
<svelte:document
  onpointerdowncapture={handleDocumentPointerDown}
  onvisibilitychange={handleDocumentVisibilityChange}
/>

<div
  class="kit-terminal-pane"
  {@attach attachTerminalPane}
  onpointerdowncapture={handleTerminalPointerDown}
  onlostpointercapture={handleTerminalLostPointerCapture}
  onkeydowncapture={handleTerminalKeyDown}
  oncompositionstartcapture={handleTerminalCompositionStart}
  onmousedowncapture={handleInsecureTerminalRightMouse}
  onmouseupcapture={handleInsecureTerminalRightMouse}
  onwheelcapture={handleTerminalWheel}
  onfocusout={handleTerminalFocusOut}
>
  {#if hoveredTerminalLink}
    <div class="kit-terminal-pane__link-tooltip">
      <span>{hoveredTerminalLink}</span>
      <small>{terminalLinkModifierLabel}+Click to open link</small>
    </div>
  {/if}
</div>

<style>
  .kit-terminal-pane {
    position: relative;
    width: 100%;
    height: 100%;
    background: var(--terminal-bg, #0d1117);
  }

  .kit-terminal-pane__link-tooltip {
    position: absolute;
    z-index: 5;
    bottom: var(--space-4);
    left: var(--space-4);
    display: flex;
    max-width: calc(100% - (2 * var(--space-4)));
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-2) var(--space-3);
    overflow: hidden;
    color: var(--text-primary);
    font-family: var(--font-sans);
    font-size: var(--font-size-sm);
    line-height: 1.25;
    pointer-events: none;
    background: var(--bg-surface);
    border: var(--border-width) solid var(--border-default);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-md);
  }

  .kit-terminal-pane__link-tooltip span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .kit-terminal-pane__link-tooltip small {
    color: var(--text-muted);
    font-size: inherit;
  }

  .kit-terminal-pane :global(.xterm),
  .kit-terminal-pane :global(.xterm-viewport),
  .kit-terminal-pane :global(.xterm-screen) {
    background: var(--terminal-bg, #0d1117);
  }
</style>
