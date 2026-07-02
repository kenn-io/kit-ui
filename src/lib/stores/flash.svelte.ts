export type FlashTone = "neutral" | "info" | "success" | "warning" | "danger";

export interface FlashOptions {
  durationMs?: number;
  /** Semantic accent for the banner (neutral default). */
  tone?: FlashTone;
}

export interface FlashState {
  message: string;
  durationMs: number;
  /** Optional on the public shape (external mocks/wrappers predate it);
   * consumers should read it as `tone ?? "neutral"`. */
  tone?: FlashTone;
  /** Increments per showFlash call; keys each banner and its countdown. */
  id: number;
}

const FLASH_TONES: ReadonlySet<string> = new Set([
  "neutral",
  "info",
  "success",
  "warning",
  "danger",
]);

/** Backpressure for event bursts: beyond this, the oldest flash is dropped
 * so the fixed-position stack can't grow off-screen. */
const MAX_FLASHES = 5;
const DEFAULT_DURATION_MS = 4000;

let flashes = $state<FlashState[]>([]);
const timers = new Map<number, ReturnType<typeof setTimeout>>();
let nextId = 0;

/** Show a flash. The second argument keeps the original duration-only
 * form (`showFlash("Saved", 10000)`) and also accepts an options object
 * (`showFlash("Merged", { tone: "success" })`). */
export function showFlash(msg: string, durationMs?: number): void;
export function showFlash(msg: string, options?: FlashOptions): void;
export function showFlash(msg: string, opts: number | FlashOptions = {}): void {
  let { durationMs = DEFAULT_DURATION_MS, tone = "neutral" }: FlashOptions =
    typeof opts === "number" ? { durationMs: opts } : opts;
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    durationMs = DEFAULT_DURATION_MS;
  }
  // Untyped callers can pass anything; unknown tones render neutral
  // rather than producing an unstyled kit-flash-banner--<garbage> class.
  if (!FLASH_TONES.has(tone)) tone = "neutral";
  nextId += 1;
  const id = nextId;
  const overflow = flashes.length - (MAX_FLASHES - 1);
  for (let i = 0; i < overflow; i += 1) {
    dismissFlash(flashes[0]!.id);
  }
  flashes = [...flashes, { message: msg, durationMs, tone, id }];
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
 * `onclick={dismissFlash}` (which passes the event) keeps working — the
 * unknown overload makes that legal under strict TypeScript as well. */
export function dismissFlash(id?: number): void;
export function dismissFlash(event: unknown): void;
export function dismissFlash(id?: unknown): void {
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
