// Coalesces bursts of work requests into one callback per animation frame.
// A ResizeObserver burst or repeated settings writes then cost one refit and
// one repaint, not one per notification.
//
// The scheduled flag, not the frame handle, is the source of truth: test
// environments stub requestAnimationFrame to run callbacks synchronously,
// where the handle would only be assigned after the callback already ran.

export interface AnimationFrameScheduler {
  /** Request one run on the next frame. Returns false when already scheduled. */
  schedule(): boolean;
  /** Drop any pending run. */
  cancel(): void;
}

export function createAnimationFrameScheduler(onFrame: () => void): AnimationFrameScheduler {
  let scheduled = false;
  let handle: number | undefined;
  return {
    schedule() {
      if (scheduled) return false;
      scheduled = true;
      const id = requestAnimationFrame(() => {
        if (!scheduled) return;
        scheduled = false;
        handle = undefined;
        onFrame();
      });
      if (scheduled) handle = id;
      return true;
    },
    cancel() {
      if (!scheduled) return;
      scheduled = false;
      if (handle !== undefined) {
        cancelAnimationFrame(handle);
        handle = undefined;
      }
    },
  };
}
