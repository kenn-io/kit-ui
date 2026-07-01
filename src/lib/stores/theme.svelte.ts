export type ThemeMode = "light" | "dark" | "system";

export interface ThemeOptions {
  /** localStorage key for the persisted mode. The high-contrast flag
   * persists under `${storageKey}-high-contrast`. */
  storageKey?: string;
}

const DEFAULT_STORAGE_KEY = "kit-ui-theme";

let storageKey = DEFAULT_STORAGE_KEY;
let mode = $state<ThemeMode>("system");
let dark = $state(false);
let highContrast = $state(false);
let mediaCleanup: (() => void) | null = null;

function hasDOM(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function readStored(key: string): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    // Storage blocked (private mode, sandboxed iframe)
    return null;
  }
}

function writeStored(key: string, value: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked — the in-memory $state keeps the choice for the session
  }
}

function applyClasses(): void {
  if (!hasDOM()) return;
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.classList.toggle("high-contrast", highContrast);
}

/** Recomputes `dark` from the current mode, (re)arming the OS-preference
 * listener when in system mode, and syncs the root classes. */
function resolveDark(): void {
  mediaCleanup?.();
  mediaCleanup = null;

  if (mode === "system") {
    if (hasDOM() && typeof window.matchMedia === "function") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      dark = mq.matches;
      const handler = (e: MediaQueryListEvent): void => {
        dark = e.matches;
        applyClasses();
      };
      mq.addEventListener("change", handler);
      mediaCleanup = () => mq.removeEventListener("change", handler);
    } else {
      dark = false;
    }
  } else {
    dark = mode === "dark";
  }

  applyClasses();
}

/** Restores the persisted preferences and applies the `dark` /
 * `high-contrast` classes to `<html>`. Call once at app startup. Safe to
 * call during SSR (no-op until the browser takes over). */
export function initTheme(options?: ThemeOptions): void {
  storageKey = options?.storageKey ?? DEFAULT_STORAGE_KEY;

  const storedMode = readStored(storageKey);
  mode =
    storedMode === "light" || storedMode === "dark" || storedMode === "system"
      ? storedMode
      : "system";
  highContrast = readStored(`${storageKey}-high-contrast`) === "true";

  resolveDark();
}

/** Tears down the system-preference listener (tests, HMR, embeds). */
export function cleanupTheme(): void {
  mediaCleanup?.();
  mediaCleanup = null;
}

export function getThemeMode(): ThemeMode {
  return mode;
}

export function setThemeMode(next: ThemeMode): void {
  mode = next;
  writeStored(storageKey, next);
  resolveDark();
}

/** The resolved appearance: in system mode this tracks the OS preference. */
export function isDark(): boolean {
  return dark;
}

export function getHighContrast(): boolean {
  return highContrast;
}

export function setHighContrast(value: boolean): void {
  highContrast = value;
  writeStored(`${storageKey}-high-contrast`, value ? "true" : "false");
  applyClasses();
}
