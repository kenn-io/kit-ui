export const DEFAULT_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export interface RefreshScheduler {
  /** Arm the interval without an immediate refresh. */
  scheduleNext: () => void;
  /** Refresh immediately and reset the interval. */
  refreshNow: () => void;
  stop: () => void;
}

/**
 * Timer that invokes `refresh` on a fixed cadence. The owner decides when to
 * arm it (`scheduleNext`) so the first auto-refresh doesn't race the page's
 * initial load; a manual `refreshNow` fires immediately and resets the timer.
 */
export function createRefreshScheduler(
  refresh: () => void,
  intervalMs: number = DEFAULT_REFRESH_INTERVAL_MS,
): RefreshScheduler {
  let timer: ReturnType<typeof setTimeout> | undefined;

  function scheduleNext(): void {
    stop();
    timer = setTimeout(() => {
      refresh();
      scheduleNext();
    }, intervalMs);
  }

  function refreshNow(): void {
    refresh();
    scheduleNext();
  }

  function stop(): void {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  }

  return { scheduleNext, refreshNow, stop };
}

/** "Updated Xm ago" label for a refresh control. `now` is passed in so the
 * caller can drive re-evaluation from its own clock tick. */
export function formatRefreshAge(lastUpdatedAt: number | null, now: number): string {
  if (lastUpdatedAt === null) return "—";
  const diffMin = Math.floor((now - lastUpdatedAt) / 60_000);
  if (diffMin < 1) return "Updated just now";
  if (diffMin < 60) return `Updated ${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Updated ${diffHours}h ago`;
  return `Updated ${Math.floor(diffHours / 24)}d ago`;
}
