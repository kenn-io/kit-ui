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

const MODIFIER_NAMES = new Set([
  "mod",
  "cmdorctrl",
  "shift",
  "alt",
  "option",
  "ctrl",
  "control",
  "meta",
  "cmd",
  "command",
]);

// US-layout Shift pairs. KeyboardEvent.key reports the *produced*
// character for printable keys, so `shift+/` arrives as key "?" and
// `mod+plus` as "+" (Shift held on layouts where + lives on =). Combos
// written with the base character still have to match those events.
const SHIFTED_KEYS: Record<string, string> = {
  "`": "~",
  "1": "!",
  "2": "@",
  "3": "#",
  "4": "$",
  "5": "%",
  "6": "^",
  "7": "&",
  "8": "*",
  "9": "(",
  "0": ")",
  "-": "_",
  "=": "+",
  "[": "{",
  "]": "}",
  "\\": "|",
  ";": ":",
  "'": '"',
  ",": "<",
  ".": ">",
  "/": "?",
};

const SHIFTED_OUTPUTS = new Set(Object.values(SHIFTED_KEYS));

export function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  const platform = navigator.platform ?? navigator.userAgent ?? "";
  return /Mac|iPhone|iPad|iPod/.test(platform);
}

/** Parse a combo string. Throws on malformed combos (missing key,
 * unknown modifier) so typos fail at registration instead of silently
 * never firing — write the literal `+` key as `"plus"`. */
export function parseShortcut(combo: string): ParsedShortcut {
  const parts = combo.toLowerCase().split("+");
  const rawKey = parts.pop() ?? "";
  const parsed: ParsedShortcut = {
    key: KEY_ALIASES[rawKey] ?? rawKey,
    mod: false,
    shift: false,
    alt: false,
    ctrl: false,
    meta: false,
  };
  if (!parsed.key || MODIFIER_NAMES.has(parsed.key)) {
    throw new Error(`Invalid shortcut "${combo}": missing key (write the literal + key as "plus")`);
  }
  for (const part of parts) {
    if (part === "mod" || part === "cmdorctrl") parsed.mod = true;
    else if (part === "shift") parsed.shift = true;
    else if (part === "alt" || part === "option") parsed.alt = true;
    else if (part === "ctrl" || part === "control") parsed.ctrl = true;
    else if (part === "meta" || part === "cmd" || part === "command") parsed.meta = true;
    else throw new Error(`Invalid shortcut "${combo}": unknown modifier "${part}"`);
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
  const eventKey = event.key.toLowerCase();
  let keyMatches = eventKey === parsed.key;
  let shiftMatches = event.shiftKey === parsed.shift;
  // Printable symbol keys encode Shift in the produced character: Shift+/
  // reports key "?", and "+" arrives with shiftKey set on layouts where it
  // lives on =. Match through the shifted pair and trust the character
  // over the shiftKey flag for these keys.
  const isSymbolKey = parsed.key.length === 1 && !/[a-z ]/.test(parsed.key);
  if (isSymbolKey) {
    if (!keyMatches && parsed.shift && SHIFTED_KEYS[parsed.key] === event.key) {
      // The produced character is the shifted counterpart — Shift proven.
      keyMatches = true;
      shiftMatches = true;
    } else if (keyMatches && !parsed.shift && event.shiftKey && SHIFTED_OUTPUTS.has(parsed.key)) {
      // Only characters that are themselves shifted outputs ("+", "?")
      // may arrive with shiftKey set on layouts that need Shift to
      // produce them. Base characters ("/", ",") keep strict matching —
      // plain "/" must not shadow "shift+/".
      shiftMatches = true;
    }
  }
  if (!keyMatches) return false;
  const wantMeta = parsed.meta || (parsed.mod && isMac);
  const wantCtrl = parsed.ctrl || (parsed.mod && !isMac);
  return (
    event.metaKey === wantMeta &&
    event.ctrlKey === wantCtrl &&
    event.altKey === parsed.alt &&
    shiftMatches
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
export function formatShortcutKeys(combo: string, isMac: boolean = isMacPlatform()): string[] {
  const parsed = parseShortcut(combo);
  const labels = isMac ? MAC_LABELS : PC_LABELS;
  const keys: string[] = [];
  if (parsed.ctrl) keys.push(labels.ctrl!);
  if (parsed.alt) keys.push(labels.alt!);
  if (parsed.shift) keys.push(labels.shift!);
  if (parsed.meta) keys.push(labels.meta!);
  if (parsed.mod) keys.push(labels.mod!);
  keys.push(
    KEY_LABELS[parsed.key] ?? (parsed.key.length === 1 ? parsed.key.toUpperCase() : parsed.key),
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
  const el = target as { tagName?: unknown; isContentEditable?: unknown } | null;
  if (!el || typeof el.tagName !== "string") return false;
  if (el.isContentEditable === true) return true;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT";
}

/** Platform-resolved identity of a combo — what actually has to be
 * pressed. Used for duplicate detection. Shifted-symbol forms
 * canonicalize to the produced character ("shift+/" ≡ "?",
 * "shift+=" ≡ "plus") since shortcutMatches treats them as the same
 * physical keys. */
function resolvedComboKey(parsed: ParsedShortcut, isMac: boolean): string {
  const meta = parsed.meta || (parsed.mod && isMac);
  const ctrl = parsed.ctrl || (parsed.mod && !isMac);
  let key = parsed.key;
  let shift = parsed.shift;
  const shifted = SHIFTED_KEYS[key];
  if (shift && shifted !== undefined) {
    key = shifted;
    shift = false;
  }
  // Shifted-output keys ("+", "?") treat shiftKey as don't-care in
  // matching, so shift must not distinguish them here either —
  // "?" and "shift+?" overlap at runtime.
  if (SHIFTED_OUTPUTS.has(key)) shift = false;
  return `${key}|${meta}|${ctrl}|${parsed.alt}|${shift}`;
}

export function createShortcutManager(isMac: boolean = isMacPlatform()): ShortcutManager {
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
      // Conflict policy: first registered wins (handleKeydown fires the
      // first match and stops). Duplicates are almost always an app bug,
      // so surface them — compared after alias and platform resolution,
      // so "cmd+k"/"meta+k" or "mod+k"/"ctrl+k"-on-PC collide too.
      const resolved = resolvedComboKey(entry.parsed, isMac);
      for (const existing of entries) {
        if (
          existing.scope === entry.scope &&
          resolvedComboKey(existing.parsed, isMac) === resolved
        ) {
          console.warn(
            `[kit-ui shortcuts] "${combo}" resolves to the same keys as the already-registered "${existing.combo}" in scope "${entry.scope}"; the first registration wins`,
          );
          break;
        }
      }
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

let appShortcutsDetach: (() => void) | undefined;

/** Wire the singleton to `window` keydown. Call once at app startup (like
 * `initTheme`); returns the detach function. SSR-safe no-op. Idempotent:
 * while already wired, repeat calls return a no-op detach instead of
 * stacking listeners (only the wiring call's detach unwires). */
export function initShortcuts(): () => void {
  if (typeof window === "undefined") return () => {};
  if (appShortcutsDetach) return () => {};
  const listener = (event: KeyboardEvent): void => {
    appShortcuts.handleKeydown(event);
  };
  window.addEventListener("keydown", listener);
  appShortcutsDetach = () => {
    window.removeEventListener("keydown", listener);
    appShortcutsDetach = undefined;
  };
  return appShortcutsDetach;
}
