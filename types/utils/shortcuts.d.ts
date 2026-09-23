/**
 * Keyboard shortcut system: combo parsing/matching as pure functions
 * (unit-tested in checks/shortcuts.test.ts), a scope-stacked manager, and
 * an app-level singleton wired up by `initShortcuts()`.
 *
 * Combo syntax: `"mod+k"`, `"shift+/"`, `"g"`, `"escape"`, `"mod+shift+p"`.
 * `mod` is ⌘ on Apple platforms and Ctrl elsewhere. Matching is strict:
 * modifiers the combo doesn't name must not be pressed.
 */
export interface ParsedShortcut {
    /** Lowercased KeyboardEvent.key value ("k", "escape", "arrowdown", " "). */
    key: string;
    /** Platform primary modifier (⌘/Ctrl). */
    mod: boolean;
    shift: boolean;
    alt: boolean;
    /** Explicit ctrl (distinct from mod, e.g. "ctrl+k" on a Mac). */
    ctrl: boolean;
    /** Explicit meta. */
    meta: boolean;
}
export declare function isMacPlatform(): boolean;
/** Parse a combo string. Throws on malformed combos (missing key,
 * unknown modifier) so typos fail at registration instead of silently
 * never firing — write the literal `+` key as `"plus"`. */
export declare function parseShortcut(combo: string): ParsedShortcut;
/** The subset of KeyboardEvent this module reads — makes matching testable
 * without constructing real events. */
export interface ShortcutKeyEvent {
    key: string;
    metaKey: boolean;
    ctrlKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
}
export declare function shortcutMatches(parsed: ParsedShortcut, event: ShortcutKeyEvent, isMac: boolean): boolean;
/** Display keys for KbdBadge: `formatShortcutKeys("mod+k")` → `["⌘", "K"]`
 * on a Mac, `["Ctrl", "K"]` elsewhere. */
export declare function formatShortcutKeys(combo: string, isMac?: boolean): string[];
export interface ShortcutOptions {
    /** The shortcut fires only while this scope is topmost. Omit for the
     * root scope — pushing any scope (a modal, a palette) suspends it. */
    scope?: string;
    /** Fire even when a text input/textarea/contenteditable has focus.
     * Modifier combos (mod/ctrl/alt/meta) always fire in inputs. */
    allowInInput?: boolean;
    /** Human-readable action, e.g. for a shortcut-help dialog. `| undefined`
     * so exactOptionalPropertyTypes consumers can forward a possibly-undefined
     * value (same contract as RegisteredShortcut below). */
    description?: string | undefined;
}
export interface RegisteredShortcut {
    combo: string;
    scope: string;
    description?: string | undefined;
}
export declare const ROOT_SCOPE = "root";
export interface ShortcutManager {
    /** Register a combo; returns the unregister function. */
    register(combo: string, handler: (event: KeyboardEvent) => void, options?: ShortcutOptions): () => void;
    /** Push a scope (modal opened, palette opened); returns the pop
     * function. While pushed, only shortcuts registered with this scope
     * fire — everything below the top of the stack is suspended. */
    pushScope(scope: string): () => void;
    activeScope(): string;
    /** Feed a keydown; returns true when a shortcut handled it. */
    handleKeydown(event: KeyboardEvent): boolean;
    /** Registered shortcuts (for help dialogs). */
    list(): RegisteredShortcut[];
}
export declare function createShortcutManager(isMac?: boolean): ShortcutManager;
/** App-level singleton most apps should use. */
export declare const appShortcuts: ShortcutManager;
/** Wire the singleton to `window` keydown. Call once at app startup (like
 * `initTheme`); returns the detach function. SSR-safe no-op. Idempotent:
 * while already wired, repeat calls return a no-op detach instead of
 * stacking listeners (only the wiring call's detach unwires). */
export declare function initShortcuts(): () => void;
