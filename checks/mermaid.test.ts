import { describe, expect, test } from "bun:test";
import { mermaidCodeFence, mermaidSourceByteLength } from "../src/lib/utils/markdown-mermaid.js";

// The DOM/rendering half of the module (viewer controls, lightbox, theme
// re-render, secure-config lock, load-failure retry, per-root budget
// caps) is covered in tests/browser/mermaid.spec.ts — this pins the
// pure helpers: the fence interceptor and the UTF-8 byte counter the
// budget pass uses.

describe("mermaidCodeFence", () => {
  test("routes mermaid fences to pre.mermaid blocks", () => {
    expect(mermaidCodeFence("graph TD\nA-->B", "mermaid")).toBe(
      '<pre class="mermaid">graph TD\nA--&gt;B</pre>',
    );
  });

  test("escapes user-authored fence markup", () => {
    const html = mermaidCodeFence('graph TD\nA["<img src=x onerror=alert(1)>"]', "mermaid");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  test("falls through for every other language", () => {
    expect(mermaidCodeFence("graph TD", "ts")).toBeUndefined();
    expect(mermaidCodeFence("graph TD", "text")).toBeUndefined();
    // The pipeline lowercases fence info before codeFence runs
    // (codeFenceLanguage), so the interceptor matches exactly.
    expect(mermaidCodeFence("graph TD", "Mermaid")).toBeUndefined();
  });
});

describe("mermaidSourceByteLength", () => {
  // The budget pass uses this instead of TextEncoder so over-budget
  // sources don't allocate an encoded copy — pin exact parity.
  const cases = [
    "",
    "graph TD\nA-->B",
    "héllo wörld", // 2-byte sequences
    "日本語のダイアグラム", // 3-byte sequences
    "emoji 🧜‍♀️🎉 pairs", // astral surrogate pairs + ZWJ
    "lone high \ud83d end", // unpaired high surrogate → U+FFFD
    "lone low \ude00 end", // unpaired low surrogate → U+FFFD
    "\ud83dtrailing-high-then-bmpé",
    "\ud83d", // high surrogate at end of string
  ];

  test("matches TextEncoder for ASCII, multibyte, and lone surrogates", () => {
    for (const source of cases) {
      expect(mermaidSourceByteLength(source)).toBe(new TextEncoder().encode(source).byteLength);
    }
  });

  test("cap short-circuits with a value above the cap", () => {
    const source = "x".repeat(1000);
    expect(mermaidSourceByteLength(source, 10)).toBe(11);
    expect(mermaidSourceByteLength(source, 1000)).toBe(1000);
    expect(mermaidSourceByteLength(source, 999)).toBe(1000);
  });
});
