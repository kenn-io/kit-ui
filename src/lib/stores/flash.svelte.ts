export interface FlashState {
  message: string;
  durationMs: number;
  /** Increments per showFlash call; keys each banner and its countdown. */
  id: number;
}

/** Backpressure for event bursts: beyond this, the oldest flash is dropped
 * so the fixed-position stack can't grow off-screen. */
const MAX_FLASHES = 5;
const DEFAULT_DURATION_MS = 4000;

let flashes = $state<FlashState[]>([]);
const timers = new Map<number, ReturnType<typeof setTimeout>>();
let nextId = 0;

export function showFlash(msg: string, durationMs = DEFAULT_DURATION_MS): void {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    durationMs = DEFAULT_DURATION_MS;
  }
  nextId += 1;
  const id = nextId;
  const overflow = flashes.length - (MAX_FLASHES - 1);
  for (let i = 0; i < overflow; i += 1) {
    dismissFlash(flashes[0]!.id);
  }
  flashes = [...flashes, { message: msg, durationMs, id }];
  timers.set(
    id,
    setTimeout(() => dismissFlash(id), durationMs),
  );
}

/** All currently visible flashes, oldest first. */
export function getFlashes(): FlashState[] {
  return flashes;
}

/** The most recent flash (or null). Kept for single-flash consumers. */
export function getFlash(): FlashState | null {
  return flashes[flashes.length - 1] ?? null;
}

export function getFlashMessage(): string | null {
  return getFlash()?.message ?? null;
}

/** Dismiss one flash by id, or every flash when called without one.
 * Non-number arguments dismiss everything too, so the pre-stacking usage
 * `onclick={dismissFlash}` (which passes the event) keeps working. */
export function dismissFlash(id?: number): void {
  if (typeof id !== "number") {
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
    flashes = [];
    return;
  }
  const timer = timers.get(id);
  if (timer !== undefined) {
    clearTimeout(timer);
    timers.delete(id);
  }
  flashes = flashes.filter((flash) => flash.id !== id);
}
