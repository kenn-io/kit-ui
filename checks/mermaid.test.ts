import { describe, expect, test } from "bun:test";
import { mermaidCodeFence } from "../src/lib/utils/markdown-mermaid.js";

// The DOM/rendering half of the module (viewer controls, lightbox, theme
// re-render, budgets) is covered against real mermaid in
// tests/browser/mermaid.spec.ts — this pins the pure fence interceptor.

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
