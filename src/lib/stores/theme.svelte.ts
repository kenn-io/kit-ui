export type ThemeMode = "light" | "dark" | "system";

export interface ThemeOptions {
  /** localStorage key for the persisted mode. The high-contrast flag
   * persists under `${storageKey}-high-contrast` and the theme name under
   * `${storageKey}-name`. */
  storageKey?: string;
}

/** Descriptor for a pluggable theme, as listed in `KIT_THEMES`. */
export interface KitThemeInfo {
  /** The `data-kit-theme` attribute value. */
  name: string;
  /** Human-readable label (English; localize in the app if needed). */
  label: string;
  /** One-line identity description for pickers. */
  description: string;
}

/**
 * The built-in theme pack shipped in `themes.css` (import it alongside
 * theme.css to use these). Each entry is a full identity — shape,
 * elevation, borders, motion, focus, type, palette — with light and dark
 * variants. `setThemeName` accepts any string, so apps can register their
 * own themes outside this list.
 */
export const KIT_THEMES: readonly KitThemeInfo[] = [
  {
    name: "control-room",
    label: "Control Room",
    description: "Mission console: dense cool steel, signal cyan, DIN lettering",
  },
  {
    name: "terminal",
    label: "Terminal",
    description: "Quiet teletype: mono type, square corners, phosphor mint",
  },
  {
    name: "zine",
    label: "Zine",
    description: "Risograph poster: stark ink borders, hard offset shadows, Helvetica",
  },
  {
    name: "pebble",
    label: "Pebble",
    description: "Soft clay: big radii, diffuse shadows, languid motion",
  },
  {
    name: "gallery",
    label: "Gallery",
    description: "Exhibition catalogue: serif type, paper neutrals, ink navy",
  },
  {
    name: "arctic",
    label: "Arctic",
    description: "Glacier light: airy, near-borderless, geometric type",
  },
  {
    name: "ember",
    label: "Ember",
    description: "Last light: warm humanist type, burnt-orange primary",
  },
  {
    name: "graphite",
    label: "Graphite",
    description: "Machined steel: strong borders, tight radii, safety orange",
  },
];

const DEFAULT_STORAGE_KEY = "kit-ui-theme";

let storageKey = DEFAULT_STORAGE_KEY;
let mode = $state<ThemeMode>("system");
let dark = $state(false);
let highContrast = $state(false);
let themeName = $state<string | null>(null);
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

function removeStored(key: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    // Storage blocked — nothing to clear
  }
}

function applyClasses(): void {
  if (!hasDOM()) return;
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.classList.toggle("high-contrast", highContrast);
  if (themeName) {
    document.documentElement.setAttribute("data-kit-theme", themeName);
  } else {
    document.documentElement.removeAttribute("data-kit-theme");
  }
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
  themeName = readStored(`${storageKey}-name`);

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

/** The active pluggable theme name, or null for the built-in default. */
export function getThemeName(): string | null {
  return themeName;
}

/**
 * Activates a pluggable theme by setting `data-kit-theme` on `<html>`
 * (composes with the dark / high-contrast classes). Pass a name from
 * `KIT_THEMES`, any custom theme an app defines, or `null` to return to
 * the default light/dark pair. Persists under `${storageKey}-name`.
 */
export function setThemeName(name: string | null): void {
  themeName = name;
  if (name) {
    writeStored(`${storageKey}-name`, name);
  } else {
    removeStored(`${storageKey}-name`);
  }
  applyClasses();
}
