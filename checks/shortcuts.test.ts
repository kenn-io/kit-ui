import { describe, expect, test } from "bun:test";
import {
  createShortcutManager,
  formatShortcutKeys,
  parseShortcut,
  shortcutMatches,
} from "../src/lib/utils/shortcuts.js";

const ev = (key: string, mods: Partial<Record<"meta" | "ctrl" | "alt" | "shift", boolean>> = {}) => ({
  key,
  metaKey: mods.meta ?? false,
  ctrlKey: mods.ctrl ?? false,
  altKey: mods.alt ?? false,
  shiftKey: mods.shift ?? false,
});

describe("parseShortcut", () => {
  test("mod+k", () => {
    expect(parseShortcut("mod+k")).toEqual({
      key: "k", mod: true, shift: false, alt: false, ctrl: false, meta: false,
    });
  });

  test("aliases", () => {
    expect(parseShortcut("esc").key).toBe("escape");
    expect(parseShortcut("mod+plus").key).toBe("+");
    expect(parseShortcut("shift+space").key).toBe(" ");
    expect(parseShortcut("option+up")).toMatchObject({ alt: true, key: "arrowup" });
  });
});

describe("shortcutMatches", () => {
  test("mod resolves per platform", () => {
    const parsed = parseShortcut("mod+k");
    expect(shortcutMatches(parsed, ev("k", { meta: true }), true)).toBe(true);
    expect(shortcutMatches(parsed, ev("k", { ctrl: true }), true)).toBe(false);
    expect(shortcutMatches(parsed, ev("k", { ctrl: true }), false)).toBe(true);
    expect(shortcutMatches(parsed, ev("k", { meta: true }), false)).toBe(false);
  });

  test("strict modifiers: extras don't match", () => {
    const parsed = parseShortcut("g");
    expect(shortcutMatches(parsed, ev("g"), true)).toBe(true);
    expect(shortcutMatches(parsed, ev("g", { shift: true }), true)).toBe(false);
    expect(shortcutMatches(parsed, ev("g", { meta: true }), true)).toBe(false);
  });

  test("explicit ctrl on mac stays ctrl", () => {
    const parsed = parseShortcut("ctrl+k");
    expect(shortcutMatches(parsed, ev("k", { ctrl: true }), true)).toBe(true);
    expect(shortcutMatches(parsed, ev("k", { meta: true }), true)).toBe(false);
  });

  test("case-insensitive key", () => {
    expect(shortcutMatches(parseShortcut("mod+shift+p"), ev("P", { meta: true, shift: true }), true)).toBe(true);
  });
});

describe("formatShortcutKeys", () => {
  test("platform labels", () => {
    expect(formatShortcutKeys("mod+k", true)).toEqual(["⌘", "K"]);
    expect(formatShortcutKeys("mod+k", false)).toEqual(["Ctrl", "K"]);
    expect(formatShortcutKeys("mod+shift+p", true)).toEqual(["⇧", "⌘", "P"]);
    expect(formatShortcutKeys("escape", true)).toEqual(["Esc"]);
    expect(formatShortcutKeys("alt+down", false)).toEqual(["Alt", "↓"]);
  });
});

describe("createShortcutManager", () => {
  const kbd = (key: string, mods = {}, target: EventTarget | null = null) =>
    ({ ...ev(key, mods), target, preventDefault() {} }) as unknown as KeyboardEvent;

  test("registers, fires, unregisters", () => {
    const m = createShortcutManager(true);
    let fired = 0;
    const off = m.register("mod+k", () => { fired += 1; });
    expect(m.handleKeydown(kbd("k", { meta: true }))).toBe(true);
    expect(fired).toBe(1);
    off();
    expect(m.handleKeydown(kbd("k", { meta: true }))).toBe(false);
  });

  test("scope stacking suspends lower scopes", () => {
    const m = createShortcutManager(true);
    let root = 0;
    let modal = 0;
    m.register("g", () => { root += 1; });
    m.register("g", () => { modal += 1; }, { scope: "modal" });

    m.handleKeydown(kbd("g"));
    expect([root, modal]).toEqual([1, 0]);

    const pop = m.pushScope("modal");
    m.handleKeydown(kbd("g"));
    expect([root, modal]).toEqual([1, 1]);

    pop();
    m.handleKeydown(kbd("g"));
    expect([root, modal]).toEqual([2, 1]);
  });

  test("pop is order-safe when scopes close out of order", () => {
    const m = createShortcutManager(true);
    const popA = m.pushScope("a");
    const popB = m.pushScope("b");
    popA(); // out of order — b must stay active
    expect(m.activeScope()).toBe("b");
    popB();
    expect(m.activeScope()).toBe("root");
  });

  test("plain keys don't fire in inputs; mod combos do", () => {
    const m = createShortcutManager(true);
    let plain = 0;
    let combo = 0;
    m.register("g", () => { plain += 1; });
    m.register("mod+k", () => { combo += 1; });
    const input = { tagName: "INPUT", isContentEditable: false };
    expect(m.handleKeydown(kbd("g", {}, input as unknown as EventTarget))).toBe(false);
    expect(m.handleKeydown(kbd("k", { meta: true }, input as unknown as EventTarget))).toBe(true);
    expect([plain, combo]).toEqual([0, 1]);
  });

  test("allowInInput opts a plain key back in", () => {
    const m = createShortcutManager(true);
    let fired = 0;
    m.register("escape", () => { fired += 1; }, { allowInInput: true });
    const input = { tagName: "INPUT", isContentEditable: false };
    expect(m.handleKeydown(kbd("Escape", {}, input as unknown as EventTarget))).toBe(true);
    expect(fired).toBe(1);
  });
});
