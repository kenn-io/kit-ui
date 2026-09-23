export declare const DEFAULT_REFRESH_INTERVAL_MS: number;
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
export declare function createRefreshScheduler(refresh: () => void, intervalMs?: number): RefreshScheduler;
/** "Updated Xm ago" label for a refresh control. `now` is passed in so the
 * caller can drive re-evaluation from its own clock tick. */
export declare function formatRefreshAge(lastUpdatedAt: number | null, now: number): string;
