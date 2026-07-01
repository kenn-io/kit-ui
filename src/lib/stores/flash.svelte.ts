export interface FlashState {
  message: string;
  durationMs: number;
  /** Increments per showFlash call; keys the banner's countdown animation so
   * it restarts when a message is replaced mid-flight. */
  id: number;
}

let flash = $state<FlashState | null>(null);
let timer: ReturnType<typeof setTimeout> | null = null;
let nextId = 0;

export function showFlash(msg: string, durationMs = 4000): void {
  if (timer !== null) clearTimeout(timer);
  nextId += 1;
  flash = { message: msg, durationMs, id: nextId };
  timer = setTimeout(() => {
    flash = null;
    timer = null;
  }, durationMs);
}

export function getFlash(): FlashState | null {
  return flash;
}

export function getFlashMessage(): string | null {
  return flash?.message ?? null;
}

export function dismissFlash(): void {
  if (timer !== null) clearTimeout(timer);
  flash = null;
  timer = null;
}
