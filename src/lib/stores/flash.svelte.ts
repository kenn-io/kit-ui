export interface FlashState {
  message: string;
  durationMs: number;
  /** Increments per showFlash call; keys each banner and its countdown. */
  id: number;
}

let flashes = $state<FlashState[]>([]);
const timers = new Map<number, ReturnType<typeof setTimeout>>();
let nextId = 0;

export function showFlash(msg: string, durationMs = 4000): void {
  nextId += 1;
  const id = nextId;
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

/** Dismiss one flash by id, or every flash when called without one. */
export function dismissFlash(id?: number): void {
  if (id === undefined) {
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
