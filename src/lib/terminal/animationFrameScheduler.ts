// Coalesces bursts of work requests into one callback per animation frame.
// A ResizeObserver burst or repeated settings writes then cost one refit and
// one repaint, not one per notification.

export interface AnimationFrameScheduler {
  /** Request one run on the next frame. Returns false when already scheduled. */
  schedule(): boolean;
  /** Drop any pending run. */
  cancel(): void;
}

export function createAnimationFrameScheduler(onFrame: () => void): AnimationFrameScheduler {
  let handle: number | undefined;
  return {
    schedule() {
      if (handle !== undefined) return false;
      handle = requestAnimationFrame(() => {
        handle = undefined;
        onFrame();
      });
      return true;
    },
    cancel() {
      if (handle === undefined) return;
      cancelAnimationFrame(handle);
      handle = undefined;
    },
  };
}
