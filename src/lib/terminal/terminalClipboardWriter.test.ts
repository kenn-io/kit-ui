import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import {
  createBrowserTerminalClipboardPort,
  createTerminalClipboardWriter,
  type TerminalClipboardPort,
  type TerminalClipboardWriter,
  type TerminalClipboardWriterOptions,
} from "./terminalClipboardWriter.js";

const writers: TerminalClipboardWriter[] = [];
const originalExecCommand = Object.getOwnPropertyDescriptor(document, "execCommand");

function makeTestWriter(
  port: TerminalClipboardPort,
  options: TerminalClipboardWriterOptions = {},
): TerminalClipboardWriter {
  const writer = createTerminalClipboardWriter(port, options);
  writers.push(writer);
  return writer;
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createPort(): {
  port: TerminalClipboardPort;
  deferredWrites: Array<Promise<string>>;
  writeCopyEventText: ReturnType<typeof vi.fn>;
  writeLocalText: ReturnType<typeof vi.fn>;
  writeText: ReturnType<typeof vi.fn>;
} {
  const deferredWrites: Array<Promise<string>> = [];
  const writeCopyEventText = vi.fn(() => false);
  const writeLocalText = vi.fn(async () => undefined);
  const writeText = vi.fn(async () => undefined);
  return {
    deferredWrites,
    writeCopyEventText,
    writeLocalText,
    writeText,
    port: {
      beginDeferredWrite(text) {
        deferredWrites.push(text);
        return text.then(() => undefined);
      },
      writeCopyEventText,
      writeLocalText,
      writeText,
    },
  };
}

afterEach(() => {
  for (const writer of writers.splice(0)) writer.dispose();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  if (originalExecCommand) {
    Object.defineProperty(document, "execCommand", originalExecCommand);
  } else {
    Reflect.deleteProperty(document, "execCommand");
  }
});

describe("browser terminal clipboard port", () => {
  it("writes through a copy event when the Clipboard API is unavailable", async () => {
    vi.stubGlobal("navigator", {});
    const setData = vi.fn();
    const execCommand = vi.fn((command: string) => {
      expect(command).toBe("copy");
      const event = new Event("copy", { bubbles: true, cancelable: true }) as ClipboardEvent;
      Object.defineProperty(event, "clipboardData", { value: { setData } });
      const defaultAllowed = document.dispatchEvent(event);
      expect(defaultAllowed).toBe(false);
      return true;
    });
    Object.defineProperty(document, "execCommand", { configurable: true, value: execCommand });
    const writer = makeTestWriter(createBrowserTerminalClipboardPort());

    writer.authorizeKeyboardGesture();
    await expect(writer.write("remote selection")).resolves.toBe("written");

    expect(execCommand).toHaveBeenCalledTimes(1);
    expect(setData).toHaveBeenCalledWith("text/plain", "remote selection");
  });

  it("handles an expired deferred payload without leaking an unhandled rejection", async () => {
    const payload = deferred<string>();
    const write = vi.fn(async () => undefined);

    vi.stubGlobal("navigator", { clipboard: { write } });
    vi.stubGlobal(
      "ClipboardItem",
      class {
        constructor(_items: Record<string, Promise<Blob>>) {}
      },
    );

    await createBrowserTerminalClipboardPort().beginDeferredWrite(payload.promise);
    payload.reject(new DOMException("Terminal clipboard authorization expired", "AbortError"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(write).toHaveBeenCalledTimes(1);
  });

  it("rejects local writes when the host provides no server fallback", async () => {
    await expect(createBrowserTerminalClipboardPort().writeLocalText("text")).rejects.toMatchObject(
      {
        name: "NotSupportedError",
      },
    );
  });

  it("routes local writes through the host-provided server fallback", async () => {
    const writeLocalText = vi.fn(async () => undefined);
    await createBrowserTerminalClipboardPort({ writeLocalText }).writeLocalText("text");
    expect(writeLocalText).toHaveBeenCalledWith("text");
  });
});

describe("terminal clipboard writer", () => {
  it("does not authorize a terminal write from an unconfirmed pointer gesture", async () => {
    const { port, deferredWrites, writeLocalText, writeText } = createPort();
    const writer = makeTestWriter(port);

    writer.beginPointerGesture();
    const copied = writer.write("focus-click character");
    writer.endPointerGesture();

    await expect(copied).resolves.toBe("unauthorized");
    await expect(deferredWrites[0]).rejects.toMatchObject({ name: "AbortError" });
    expect(writeText).not.toHaveBeenCalled();
    expect(writeLocalText).not.toHaveBeenCalled();
  });

  it("keeps one confirmed pointer authorization alive through a long drag", async () => {
    vi.useFakeTimers();
    const { port, deferredWrites, writeLocalText, writeText } = createPort();
    const writer = makeTestWriter(port);

    writer.beginPointerGesture();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(deferredWrites).toHaveLength(1);
    writer.confirmPointerSelection();
    writer.endPointerGesture();
    const copied = writer.write("pointer selection");

    await expect(copied).resolves.toBe("written");
    await expect(deferredWrites[0]).resolves.toBe("pointer selection");
    expect(writeText).not.toHaveBeenCalled();
    expect(writeLocalText).not.toHaveBeenCalled();

    await expect(writer.write("second write")).resolves.toBe("unauthorized");
    expect(writeText).not.toHaveBeenCalled();
    expect(writeLocalText).not.toHaveBeenCalled();
  });

  it("does not reauthorize a consumed pointer gesture on release", async () => {
    const { port, deferredWrites, writeLocalText, writeText } = createPort();
    const writer = makeTestWriter(port);

    writer.beginPointerGesture();
    writer.confirmPointerSelection();
    await expect(writer.write("first write")).resolves.toBe("written");
    writer.endPointerGesture();

    await expect(writer.write("second write")).resolves.toBe("unauthorized");
    await expect(deferredWrites[0]).resolves.toBe("first write");
    expect(writeText).not.toHaveBeenCalled();
    expect(writeLocalText).not.toHaveBeenCalled();
  });

  it("revokes an active pointer authorization when the gesture is canceled", async () => {
    const { port, deferredWrites, writeLocalText, writeText } = createPort();
    const writer = makeTestWriter(port);

    writer.beginPointerGesture();
    writer.cancelPointerGesture();

    await expect(writer.write("late write")).resolves.toBe("unauthorized");
    await expect(deferredWrites[0]).rejects.toMatchObject({ name: "AbortError" });
    expect(writeText).not.toHaveBeenCalled();
    expect(writeLocalText).not.toHaveBeenCalled();
  });

  it("revokes a released pointer authorization when the gesture is canceled", async () => {
    const { port, deferredWrites, writeLocalText, writeText } = createPort();
    const writer = makeTestWriter(port);

    writer.beginPointerGesture();
    writer.endPointerGesture();
    writer.cancelPointerGesture();

    await expect(writer.write("late write")).resolves.toBe("unauthorized");
    await expect(deferredWrites[0]).rejects.toMatchObject({ name: "AbortError" });
    expect(writeText).not.toHaveBeenCalled();
    expect(writeLocalText).not.toHaveBeenCalled();
  });

  it("revokes keyboard authorization created inside a canceled pointer gesture", async () => {
    const { port, writeLocalText, writeText } = createPort();
    const writer = makeTestWriter(port);

    writer.beginPointerGesture();
    writer.confirmPointerSelection();
    await expect(writer.write("pointer write")).resolves.toBe("written");
    writer.authorizeKeyboardGesture();
    writer.cancelPointerGesture();

    await expect(writer.write("late write")).resolves.toBe("unauthorized");
    expect(writeText).not.toHaveBeenCalled();
    expect(writeLocalText).not.toHaveBeenCalled();
  });

  it("revokes a pointer authorization when its watchdog expires", async () => {
    vi.useFakeTimers();
    const { port, deferredWrites, writeLocalText, writeText } = createPort();
    const onPointerGestureTimeout = vi.fn();
    const writer = makeTestWriter(port, { onPointerGestureTimeout });

    writer.beginPointerGesture();
    await vi.advanceTimersByTimeAsync(60_001);

    expect(onPointerGestureTimeout).toHaveBeenCalledTimes(1);
    await expect(writer.write("late write")).resolves.toBe("unauthorized");
    await expect(deferredWrites[0]).rejects.toMatchObject({ name: "AbortError" });
    expect(writeText).not.toHaveBeenCalled();
    expect(writeLocalText).not.toHaveBeenCalled();

    writer.authorizeKeyboardGesture();
    await expect(writer.write("later keyboard write")).resolves.toBe("written");
  });

  it("clears a rejected authorization so a later gesture can retry", async () => {
    const firstWrite = deferred<void>();
    const deferredWrites: Array<Promise<string>> = [];
    const writer = makeTestWriter({
      beginDeferredWrite(text) {
        deferredWrites.push(text);
        return deferredWrites.length === 1 ? firstWrite.promise : text.then(() => undefined);
      },
      writeCopyEventText: vi.fn(() => false),
      writeLocalText: vi.fn(async () => undefined),
      writeText: vi.fn(async () => undefined),
    });

    writer.authorizeKeyboardGesture();
    firstWrite.reject(new DOMException("denied", "NotAllowedError"));
    await firstWrite.promise.catch(() => undefined);
    writer.authorizeKeyboardGesture();

    await expect(writer.write("retried selection")).resolves.toBe("written");
    await expect(deferredWrites[1]).resolves.toBe("retried selection");
  });

  it("keeps keyboard authorization alive while trusted key gestures continue", async () => {
    vi.useFakeTimers();
    const { port, deferredWrites, writeLocalText, writeText } = createPort();
    const writer = makeTestWriter(port);

    writer.authorizeKeyboardGesture();
    await vi.advanceTimersByTimeAsync(4_000);
    writer.authorizeKeyboardGesture();
    await vi.advanceTimersByTimeAsync(4_000);

    await expect(writer.write("keyboard selection")).resolves.toBe("written");
    await expect(deferredWrites[0]).resolves.toBe("keyboard selection");
    expect(writeText).not.toHaveBeenCalled();
    expect(writeLocalText).not.toHaveBeenCalled();
  });

  it("revokes keyboard authorization when terminal focus is lost", async () => {
    const { port, deferredWrites, writeLocalText, writeText } = createPort();
    const writer = makeTestWriter(port);

    writer.authorizeKeyboardGesture();
    writer.cancelAuthorization();

    await expect(writer.write("late terminal write")).resolves.toBe("unauthorized");
    await expect(deferredWrites[0]).rejects.toMatchObject({ name: "AbortError" });
    expect(writeText).not.toHaveBeenCalled();
    expect(writeLocalText).not.toHaveBeenCalled();
  });

  it("revokes pending keyboard authorization when the writer is disposed", async () => {
    const { port, deferredWrites, writeLocalText, writeText } = createPort();
    const writer = createTerminalClipboardWriter(port);

    writer.authorizeKeyboardGesture();
    writer.dispose();

    await expect(deferredWrites[0]).rejects.toMatchObject({ name: "AbortError" });
    expect(writeText).not.toHaveBeenCalled();
    expect(writeLocalText).not.toHaveBeenCalled();
  });

  it("does not shorten keyboard authorization for an unrelated pointer release", async () => {
    vi.useFakeTimers();
    const { port, deferredWrites, writeLocalText, writeText } = createPort();
    const writer = makeTestWriter(port);

    writer.authorizeKeyboardGesture();
    await vi.advanceTimersByTimeAsync(2_000);
    writer.endPointerGesture();
    await vi.advanceTimersByTimeAsync(2_000);

    await expect(writer.write("keyboard selection")).resolves.toBe("written");
    await expect(deferredWrites[0]).resolves.toBe("keyboard selection");
    expect(writeText).not.toHaveBeenCalled();
    expect(writeLocalText).not.toHaveBeenCalled();
  });

  it("expires an idle keyboard authorization before a later OSC 52 write", async () => {
    vi.useFakeTimers();
    const pending = deferred<void>();
    const writeText = vi.fn(async () => undefined);
    const port: TerminalClipboardPort = {
      beginDeferredWrite(text) {
        void text.catch(() => undefined);
        return pending.promise;
      },
      writeCopyEventText: vi.fn(() => false),
      writeLocalText: vi.fn(async () => undefined),
      writeText,
    };
    const writer = makeTestWriter(port);

    writer.authorizeKeyboardGesture();
    await vi.advanceTimersByTimeAsync(10_001);

    await expect(writer.write("late write")).resolves.toBe("unauthorized");
    expect(writeText).not.toHaveBeenCalled();
    pending.resolve();
  });

  it("does not start a direct fallback after focus loss during a deferred write", async () => {
    const deferredWrite = deferred<void>();
    const deferredWrites: Array<Promise<string>> = [];
    const writeText = vi.fn(async () => undefined);
    const writeLocalText = vi.fn(async () => undefined);
    const writer = makeTestWriter({
      beginDeferredWrite(text) {
        deferredWrites.push(text);
        return deferredWrite.promise;
      },
      writeCopyEventText: vi.fn(() => false),
      writeLocalText,
      writeText,
    });

    writer.authorizeKeyboardGesture();
    const copied = writer.write("stale terminal write");
    await expect(deferredWrites[0]).resolves.toBe("stale terminal write");
    writer.cancelAuthorization();
    deferredWrite.reject(new DOMException("denied", "NotAllowedError"));

    await expect(copied).resolves.toBe("unauthorized");
    expect(writeText).not.toHaveBeenCalled();
    expect(writeLocalText).not.toHaveBeenCalled();
  });

  it("does not start a loopback fallback after focus loss during a direct write", async () => {
    const directWrite = deferred<void>();
    const writeText = vi.fn(() => directWrite.promise);
    const writeLocalText = vi.fn(async () => undefined);
    const writer = makeTestWriter({
      beginDeferredWrite() {
        throw new DOMException("unsupported", "NotSupportedError");
      },
      writeCopyEventText: vi.fn(() => false),
      writeLocalText,
      writeText,
    });

    writer.authorizeKeyboardGesture();
    const copied = writer.write("stale terminal write");
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith("stale terminal write"));
    writer.cancelAuthorization();
    directWrite.reject(new DOMException("denied", "NotAllowedError"));

    await expect(copied).resolves.toBe("unauthorized");
    expect(writeLocalText).not.toHaveBeenCalled();
  });

  it("does not invoke the copy-event fallback after focus loss during a Clipboard API write", async () => {
    const directWrite = deferred<void>();
    const writeText = vi.fn(() => directWrite.promise);
    vi.stubGlobal("navigator", {
      clipboard: {
        write: vi.fn(async () => {
          throw new DOMException("denied", "NotAllowedError");
        }),
        writeText,
      },
    });
    vi.stubGlobal(
      "ClipboardItem",
      class {
        constructor(_items: Record<string, Promise<Blob>>) {}
      },
    );
    const execCommand = vi.fn(() => false);
    Object.defineProperty(document, "execCommand", { configurable: true, value: execCommand });
    const writer = makeTestWriter(createBrowserTerminalClipboardPort());

    writer.authorizeKeyboardGesture();
    const copied = writer.write("stale terminal write");
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith("stale terminal write"));
    writer.cancelAuthorization();
    directWrite.reject(new DOMException("denied", "NotAllowedError"));

    await expect(copied).resolves.toBe("unauthorized");
    expect(execCommand).not.toHaveBeenCalled();
  });

  it("falls back to writeText when deferred clipboard setup is unavailable", async () => {
    const writeText = vi.fn(async () => undefined);
    const writer = makeTestWriter({
      beginDeferredWrite() {
        throw new DOMException("unsupported", "NotSupportedError");
      },
      writeCopyEventText: vi.fn(() => false),
      writeLocalText: vi.fn(async () => undefined),
      writeText,
    });

    writer.beginPointerGesture();
    writer.confirmPointerSelection();

    await expect(writer.write("fallback")).resolves.toBe("written");
    expect(writeText).toHaveBeenCalledWith("fallback");
  });

  it("falls back to the local host clipboard when browser writes fail", async () => {
    const writeLocalText = vi.fn(async () => undefined);
    const writer = makeTestWriter({
      beginDeferredWrite() {
        throw new DOMException("unsupported", "NotSupportedError");
      },
      writeCopyEventText: vi.fn(() => false),
      writeLocalText,
      writeText: vi.fn(async () => {
        throw new DOMException("denied", "NotAllowedError");
      }),
    });

    writer.authorizeKeyboardGesture();

    await expect(writer.write("firefox selection")).resolves.toBe("written");
    expect(writeLocalText).toHaveBeenCalledWith("firefox selection");
  });

  it("reports failure only after browser and local writes fail", async () => {
    const deferredWrite = deferred<void>();
    const writer = makeTestWriter({
      beginDeferredWrite(text) {
        void text.catch(() => undefined);
        return deferredWrite.promise;
      },
      writeCopyEventText: vi.fn(() => false),
      writeLocalText: vi.fn(async () => {
        throw new Error("local clipboard unavailable");
      }),
      writeText: vi.fn(async () => {
        throw new DOMException("denied", "NotAllowedError");
      }),
    });

    writer.beginPointerGesture();
    writer.confirmPointerSelection();
    const copied = writer.write("blocked");
    deferredWrite.reject(new DOMException("denied", "NotAllowedError"));

    await expect(copied).resolves.toBe("blocked");
  });
});
