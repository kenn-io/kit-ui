import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { createAnimationFrameScheduler } from "./animationFrameScheduler.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFrames(): { flush(): void; canceled: number[] } {
  const callbacks = new Map<number, FrameRequestCallback>();
  const canceled: number[] = [];
  let nextHandle = 1;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const handle = nextHandle++;
    callbacks.set(handle, callback);
    return handle;
  });
  vi.stubGlobal("cancelAnimationFrame", (handle: number) => {
    callbacks.delete(handle);
    canceled.push(handle);
  });
  return {
    flush() {
      const pending = [...callbacks.entries()];
      callbacks.clear();
      for (const [, callback] of pending) callback(0);
    },
    canceled,
  };
}

describe("animation frame scheduler", () => {
  it("coalesces a burst of requests into one frame callback", () => {
    const frames = stubFrames();
    const onFrame = vi.fn();
    const scheduler = createAnimationFrameScheduler(onFrame);

    expect(scheduler.schedule()).toBe(true);
    expect(scheduler.schedule()).toBe(false);
    expect(scheduler.schedule()).toBe(false);
    frames.flush();

    expect(onFrame).toHaveBeenCalledTimes(1);
    expect(scheduler.schedule()).toBe(true);
    frames.flush();
    expect(onFrame).toHaveBeenCalledTimes(2);
  });

  it("cancel drops the pending frame", () => {
    const frames = stubFrames();
    const onFrame = vi.fn();
    const scheduler = createAnimationFrameScheduler(onFrame);

    scheduler.schedule();
    scheduler.cancel();
    frames.flush();

    expect(onFrame).not.toHaveBeenCalled();
    expect(frames.canceled).toHaveLength(1);
  });

  it("allows rescheduling from inside the frame callback", () => {
    const frames = stubFrames();
    let runs = 0;
    const scheduler = createAnimationFrameScheduler(() => {
      runs += 1;
      if (runs === 1) expect(scheduler.schedule()).toBe(true);
    });

    scheduler.schedule();
    frames.flush();
    frames.flush();

    expect(runs).toBe(2);
  });
});
