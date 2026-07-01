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

const KEY_ALIASES: Record<string, string> = {
  space: " ",
  esc: "escape",
  return: "enter",
  up: "arrowup",
  down: "arrowdown",
  left: "arrowleft",
  right: "arrowright",
  plus: "+",
};

export function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  const platform = navigator.platform ?? navigator.userAgent ?? "";
  return /Mac|iPhone|iPad|iPod/.test(platform);
}

export function parseShortcut(combo: string): ParsedShortcut {
  const parts = combo.toLowerCase().split("+");
  // "shift+/" style trailing "+" collapses to an empty token; "plus" names
  // the literal + key.
  const rawKey = parts.pop() ?? "";
  const parsed: ParsedShortcut = {
    key: KEY_ALIASES[rawKey] ?? rawKey,
    mod: false,
    shift: false,
    alt: false,
    ctrl: false,
    meta: false,
  };
  for (const part of parts) {
    if (part === "mod" || part === "cmdorctrl") parsed.mod = true;
    else if (part === "shift") parsed.shift = true;
    else if (part === "alt" || part === "option") parsed.alt = true;
    else if (part === "ctrl" || part === "control") parsed.ctrl = true;
    else if (part === "meta" || part === "cmd" || part === "command")
      parsed.meta = true;
  }
  return parsed;
}

/** The subset of KeyboardEvent this module reads — makes matching testable
 * without constructing real events. */
export interface ShortcutKeyEvent {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

export function shortcutMatches(
  parsed: ParsedShortcut,
  event: ShortcutKeyEvent,
  isMac: boolean,
): boolean {
  if (event.key.toLowerCase() !== parsed.key) return false;
  const wantMeta = parsed.meta || (parsed.mod && isMac);
  const wantCtrl = parsed.ctrl || (parsed.mod && !isMac);
  return (
    event.metaKey === wantMeta &&
    event.ctrlKey === wantCtrl &&
    event.altKey === parsed.alt &&
    event.shiftKey === parsed.shift
  );
}

const MAC_LABELS: Record<string, string> = {
  mod: "⌘",
  meta: "⌘",
  ctrl: "⌃",
  alt: "⌥",
  shift: "⇧",
};
const PC_LABELS: Record<string, string> = {
  mod: "Ctrl",
  meta: "Win",
  ctrl: "Ctrl",
  alt: "Alt",
  shift: "Shift",
};
const KEY_LABELS: Record<string, string> = {
  escape: "Esc",
  enter: "↵",
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
  " ": "Space",
};

/** Display keys for KbdBadge: `formatShortcutKeys("mod+k")` → `["⌘", "K"]`
 * on a Mac, `["Ctrl", "K"]` elsewhere. */
export function formatShortcutKeys(
  combo: string,
  isMac: boolean = isMacPlatform(),
): string[] {
  const parsed = parseShortcut(combo);
  const labels = isMac ? MAC_LABELS : PC_LABELS;
  const keys: string[] = [];
  if (parsed.ctrl) keys.push(labels.ctrl!);
  if (parsed.alt) keys.push(labels.alt!);
  if (parsed.shift) keys.push(labels.shift!);
  if (parsed.meta) keys.push(labels.meta!);
  if (parsed.mod) keys.push(labels.mod!);
  keys.push(
    KEY_LABELS[parsed.key] ??
      (parsed.key.length === 1 ? parsed.key.toUpperCase() : parsed.key),
  );
  return keys;
}

export interface ShortcutOptions {
  /** The shortcut fires only while this scope is topmost. Omit for the
   * root scope — pushing any scope (a modal, a palette) suspends it. */
  scope?: string;
  /** Fire even when a text input/textarea/contenteditable has focus.
   * Modifier combos (mod/ctrl/alt/meta) always fire in inputs. */
  allowInInput?: boolean;
  /** Human-readable action, e.g. for a shortcut-help dialog. */
  description?: string;
}

export interface RegisteredShortcut {
  combo: string;
  scope: string;
  description?: string;
}

export const ROOT_SCOPE = "root";

export interface ShortcutManager {
  /** Register a combo; returns the unregister function. */
  register(
    combo: string,
    handler: (event: KeyboardEvent) => void,
    options?: ShortcutOptions,
  ): () => void;
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

interface Entry {
  parsed: ParsedShortcut;
  combo: string;
  handler: (event: KeyboardEvent) => void;
  scope: string;
  allowInInput: boolean;
  description?: string;
}

// Duck-typed (no HTMLElement reference) so the manager stays SSR-safe and
// testable without a DOM.
function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as
    | { tagName?: unknown; isContentEditable?: unknown }
    | null;
  if (!el || typeof el.tagName !== "string") return false;
  if (el.isContentEditable === true) return true;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT"
  );
}

export function createShortcutManager(
  isMac: boolean = isMacPlatform(),
): ShortcutManager {
  const entries = new Set<Entry>();
  const scopeStack: string[] = [ROOT_SCOPE];

  return {
    register(combo, handler, options = {}) {
      const entry: Entry = {
        parsed: parseShortcut(combo),
        combo,
        handler,
        scope: options.scope ?? ROOT_SCOPE,
        allowInInput: options.allowInInput ?? false,
        description: options.description,
      };
      entries.add(entry);
      return () => entries.delete(entry);
    },

    pushScope(scope) {
      scopeStack.push(scope);
      return () => {
        const index = scopeStack.lastIndexOf(scope);
        if (index > 0) scopeStack.splice(index, 1);
      };
    },

    activeScope() {
      return scopeStack[scopeStack.length - 1] ?? ROOT_SCOPE;
    },

    handleKeydown(event) {
      const active = this.activeScope();
      const inInput = isEditableTarget(event.target);
      for (const entry of entries) {
        if (entry.scope !== active) continue;
        if (!shortcutMatches(entry.parsed, event, isMac)) continue;
        const { parsed } = entry;
        const hasModifier = parsed.mod || parsed.ctrl || parsed.alt || parsed.meta;
        if (inInput && !entry.allowInInput && !hasModifier) continue;
        event.preventDefault();
        entry.handler(event);
        return true;
      }
      return false;
    },

    list() {
      return [...entries].map(({ combo, scope, description }) => ({
        combo,
        scope,
        description,
      }));
    },
  };
}

/** App-level singleton most apps should use. */
export const appShortcuts: ShortcutManager = createShortcutManager();

/** Wire the singleton to `window` keydown. Call once at app startup (like
 * `initTheme`); returns the detach function. SSR-safe no-op. */
export function initShortcuts(): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (event: KeyboardEvent): void => {
    appShortcuts.handleKeydown(event);
  };
  window.addEventListener("keydown", listener);
  return () => window.removeEventListener("keydown", listener);
}
