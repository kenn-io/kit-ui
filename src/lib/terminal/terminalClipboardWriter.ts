// Gesture-gated clipboard writer for terminal OSC 52 writes.
//
// Terminal processes are treated as native-terminal-equivalent, but a browser
// page must not let terminal *output* write the clipboard at will: authority
// comes only from a recent one-shot trusted DOM gesture (a keyboard gesture,
// or a pointer drag that confirmed selection intent). Terminal data callbacks
// are never input provenance. Each authorization arms exactly one deferred
// clipboard write; consuming, canceling, focus loss, or expiry revokes it.
//
// Write attempts fall through a fixed capability chain — deferred
// ClipboardItem write, direct writeText, legacy copy-event, then the host's
// local (server-side) fallback — and every stage re-checks that the
// authorizing gesture has not been revoked in the meantime, so a canceled
// authorization also stops an in-flight fallback chain before its next stage.

const KEYBOARD_AUTHORIZATION_MS = 10_000;
const POINTER_GESTURE_WATCHDOG_MS = 60_000;
const POINTER_RELEASE_GRACE_MS = 1_000;

export interface TerminalClipboardPort {
  beginDeferredWrite(text: Promise<string>): Promise<void>;
  writeCopyEventText(text: string): boolean;
  writeLocalText(text: string): Promise<void>;
  writeText(text: string): Promise<void>;
}

export interface TerminalClipboardWriter {
  beginPointerGesture(): void;
  cancelAuthorization(): void;
  cancelPointerGesture(): void;
  confirmPointerSelection(): void;
  endPointerGesture(): void;
  authorizeKeyboardGesture(): void;
  write(text: string): Promise<TerminalClipboardWriteResult>;
  dispose(): void;
}

export interface TerminalClipboardWriterOptions {
  onPointerGestureTimeout?: () => void;
}

export type TerminalClipboardWriteResult = "written" | "unauthorized" | "blocked";

interface PendingClipboardWrite {
  resolve(text: string): void;
  reject(reason: unknown): void;
  outcome: Promise<boolean>;
  failed: boolean;
  source: "keyboard" | "pointer-confirmed" | "pointer-prepared";
}

function writeTextThroughCopyEvent(text: string): boolean {
  if (typeof document.execCommand !== "function") return false;

  let handled = false;
  const handleCopy = (event: ClipboardEvent): void => {
    if (!event.clipboardData) return;
    // kit-ui-check-ignore: gesture-authorized OSC 52 fallback for insecure HTTP origins.
    event.clipboardData.setData("text/plain", text);
    event.preventDefault();
    event.stopImmediatePropagation();
    handled = true;
  };
  document.addEventListener("copy", handleCopy, true);
  try {
    // kit-ui-check-ignore: gesture-authorized OSC 52 fallback for insecure HTTP origins.
    return document.execCommand("copy") && handled;
  } finally {
    document.removeEventListener("copy", handleCopy, true);
  }
}

export interface BrowserTerminalClipboardPortOptions {
  /**
   * Last-resort clipboard write through the host application (typically a
   * CSRF-protected loopback endpoint that writes the OS clipboard). When
   * omitted, the local stage always fails and blocked writes surface as
   * `"blocked"`.
   */
  writeLocalText?: (text: string) => Promise<void>;
}

export function createBrowserTerminalClipboardPort(
  options: BrowserTerminalClipboardPortOptions = {},
): TerminalClipboardPort {
  return {
    beginDeferredWrite(text) {
      if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
        throw new DOMException("Deferred clipboard writes are unavailable", "NotSupportedError");
      }
      const payload = text.then((value) => new Blob([value], { type: "text/plain" }));
      // ClipboardItem does not consistently observe a rejected deferred payload.
      // Keep the rejection intact so the write is canceled, but mark it handled.
      void payload.catch(() => undefined);
      const item = new ClipboardItem({ "text/plain": payload });
      return navigator.clipboard.write([item]);
    },
    writeLocalText(text) {
      if (!options.writeLocalText) {
        return Promise.reject(
          new DOMException("Local clipboard fallback is unavailable", "NotSupportedError"),
        );
      }
      return options.writeLocalText(text);
    },
    writeCopyEventText(text) {
      return writeTextThroughCopyEvent(text);
    },
    writeText(text) {
      if (!navigator.clipboard?.writeText) {
        return Promise.reject(
          new DOMException("Clipboard writes are unavailable", "NotSupportedError"),
        );
      }
      // kit-ui-check-ignore: gesture-authorized OSC 52 browser clipboard write.
      return navigator.clipboard.writeText(text);
    },
  };
}

export function createTerminalClipboardWriter(
  port: TerminalClipboardPort,
  options: TerminalClipboardWriterOptions = {},
): TerminalClipboardWriter {
  let expirationTimer: ReturnType<typeof setTimeout> | undefined;
  let pointerWatchdogTimer: ReturnType<typeof setTimeout> | undefined;
  let pending: PendingClipboardWrite | null = null;
  let pointerGestureActive = false;
  let pointerAuthorizationPending = false;
  let pointerGestureAuthorizationConsumed = false;
  let disposed = false;
  let revocationGeneration = 0;

  function clearExpiration(): void {
    if (expirationTimer === undefined) return;
    clearTimeout(expirationTimer);
    expirationTimer = undefined;
  }

  function clearPointerWatchdog(): void {
    if (pointerWatchdogTimer === undefined) return;
    clearTimeout(pointerWatchdogTimer);
    pointerWatchdogTimer = undefined;
  }

  function expirePending(): void {
    clearExpiration();
    const expired = pending;
    pending = null;
    pointerAuthorizationPending = false;
    expired?.reject(new DOMException("Terminal clipboard authorization expired", "AbortError"));
  }

  function scheduleExpiration(delayMs: number): void {
    clearExpiration();
    expirationTimer = setTimeout(() => {
      expirationTimer = undefined;
      expirePending();
    }, delayMs);
  }

  function arm(source: PendingClipboardWrite["source"]): void {
    if (disposed) return;
    if (pending && !pending.failed) {
      pending.source = source;
      return;
    }
    if (pending) expirePending();

    let resolve!: (text: string) => void;
    let reject!: (reason: unknown) => void;
    const text = new Promise<string>((resolveText, rejectText) => {
      resolve = resolveText;
      reject = rejectText;
    });
    void text.catch(() => undefined);

    let outcome: Promise<boolean>;
    try {
      outcome = port.beginDeferredWrite(text).then(
        () => true,
        () => false,
      );
    } catch {
      outcome = Promise.resolve(false);
    }
    const armed: PendingClipboardWrite = {
      resolve,
      reject,
      outcome,
      failed: false,
      source,
    };
    pending = armed;
    void outcome.then((written) => {
      if (!written) armed.failed = true;
    });
  }

  const writeDirect = (text: string): Promise<boolean> =>
    port.writeText(text).then(
      () => true,
      () => false,
    );

  const writeLocal = (text: string): Promise<boolean> =>
    port.writeLocalText(text).then(
      () => true,
      () => false,
    );

  function cancelPointerGesture(): void {
    if (!pointerGestureActive && !pointerAuthorizationPending) return;
    revocationGeneration += 1;
    clearPointerWatchdog();
    pointerGestureActive = false;
    pointerGestureAuthorizationConsumed = false;
    if (pointerAuthorizationPending) expirePending();
  }

  function timeoutPointerGesture(): void {
    pointerWatchdogTimer = undefined;
    cancelPointerGesture();
    options.onPointerGestureTimeout?.();
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    revocationGeneration += 1;
    clearPointerWatchdog();
    pointerGestureActive = false;
    pointerAuthorizationPending = false;
    pointerGestureAuthorizationConsumed = false;
    expirePending();
  }

  return {
    beginPointerGesture() {
      if (disposed) return;
      clearPointerWatchdog();
      pointerGestureActive = true;
      pointerGestureAuthorizationConsumed = false;
      clearExpiration();
      arm("pointer-prepared");
      pointerAuthorizationPending = pending !== null;
      pointerWatchdogTimer = setTimeout(timeoutPointerGesture, POINTER_GESTURE_WATCHDOG_MS);
    },
    cancelAuthorization() {
      revocationGeneration += 1;
      clearPointerWatchdog();
      pointerGestureActive = false;
      pointerGestureAuthorizationConsumed = false;
      expirePending();
    },
    cancelPointerGesture,
    confirmPointerSelection() {
      if (disposed || !pointerGestureActive) return;
      if (pending?.source === "pointer-prepared") pending.source = "pointer-confirmed";
    },
    endPointerGesture() {
      if (disposed || !pointerGestureActive) return;
      clearPointerWatchdog();
      pointerGestureActive = false;
      const selectionConfirmed =
        pointerGestureAuthorizationConsumed || pending?.source === "pointer-confirmed";
      if (!selectionConfirmed) {
        if (pending?.source === "pointer-prepared") expirePending();
        pointerAuthorizationPending = false;
        pointerGestureAuthorizationConsumed = false;
        return;
      }
      if (!pointerGestureAuthorizationConsumed) arm("pointer-confirmed");
      pointerAuthorizationPending = pending !== null;
      pointerGestureAuthorizationConsumed = false;
      if (pending) scheduleExpiration(POINTER_RELEASE_GRACE_MS);
    },
    authorizeKeyboardGesture() {
      if (disposed) return;
      arm("keyboard");
      if (pending) {
        pointerAuthorizationPending = pointerGestureActive;
        scheduleExpiration(KEYBOARD_AUTHORIZATION_MS);
      }
    },
    async write(text) {
      if (disposed) return "unauthorized";

      clearExpiration();
      const authorized = pending;
      if (authorized?.source === "pointer-prepared") return "unauthorized";
      pending = null;
      if (!authorized) return "unauthorized";
      const writeGeneration = revocationGeneration;
      if (pointerGestureActive && pointerAuthorizationPending) {
        pointerGestureAuthorizationConsumed = true;
      }
      pointerAuthorizationPending = false;

      authorized.resolve(text);
      const deferredWritten = await authorized.outcome;
      if (disposed || writeGeneration !== revocationGeneration) return "unauthorized";
      if (deferredWritten) return "written";
      const directWritten = await writeDirect(text);
      if (disposed || writeGeneration !== revocationGeneration) return "unauthorized";
      if (directWritten) return "written";
      let copyEventWritten = false;
      try {
        copyEventWritten = port.writeCopyEventText(text);
      } catch {
        // Continue to the local fallback when the browser rejects legacy copy.
      }
      if (disposed || writeGeneration !== revocationGeneration) return "unauthorized";
      if (copyEventWritten) return "written";
      const localWritten = await writeLocal(text);
      if (disposed || writeGeneration !== revocationGeneration) return "unauthorized";
      return localWritten ? "written" : "blocked";
    },
    dispose,
  };
}
