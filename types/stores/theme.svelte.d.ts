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
export declare const KIT_THEMES: readonly KitThemeInfo[];
/** Restores the persisted preferences and applies the `dark` /
 * `high-contrast` classes to `<html>`. Call once at app startup. Safe to
 * call during SSR (no-op until the browser takes over). */
export declare function initTheme(options?: ThemeOptions): void;
/** Tears down the system-preference listener (tests, HMR, embeds). */
export declare function cleanupTheme(): void;
export declare function getThemeMode(): ThemeMode;
export declare function setThemeMode(next: ThemeMode): void;
/** The resolved appearance: in system mode this tracks the OS preference. */
export declare function isDark(): boolean;
export declare function getHighContrast(): boolean;
export declare function setHighContrast(value: boolean): void;
/** The active pluggable theme name, or null for the built-in default. */
export declare function getThemeName(): string | null;
/**
 * Activates a pluggable theme by setting `data-kit-theme` on `<html>`
 * (composes with the dark / high-contrast classes). Pass a name from
 * `KIT_THEMES`, any custom theme an app defines, or `null` to return to
 * the default light/dark pair. Persists under `${storageKey}-name`.
 */
export declare function setThemeName(name: string | null): void;
