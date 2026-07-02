import { describe, expect, test } from "bun:test";
import { checkSource, STANDARD_BREAKPOINTS } from "./rules.mjs";

function svelte(style: string, markup = "", script = ""): string {
  return `<script lang="ts">${script}</script>\n${markup}\n<style>\n${style}\n</style>\n`;
}

describe("nonstandard-breakpoint", () => {
  test("flags widths outside the shared set", () => {
    const src = svelte(`@media (max-width: 720px) { .x { color: var(--text-primary); } }`);
    const findings = checkSource(src, "A.svelte", ["nonstandard-breakpoint"]);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain("720px");
  });

  test.each(STANDARD_BREAKPOINTS)("allows %dpx", (bp) => {
    const src = svelte(`@media (max-width: ${bp}px) { .x { display: none; } }`);
    expect(checkSource(src, "A.svelte", ["nonstandard-breakpoint"])).toHaveLength(0);
  });

  test("allows ±1px complements for non-overlapping ranges", () => {
    const src = svelte(`@media (max-width: 759px) { .x { display: none; } }`);
    expect(checkSource(src, "A.svelte", ["nonstandard-breakpoint"])).toHaveLength(0);
  });

  test("flags rem-based widths", () => {
    const src = svelte(`@media (min-width: 48rem) { .x { display: none; } }`);
    expect(checkSource(src, "A.svelte", ["nonstandard-breakpoint"])).toHaveLength(1);
  });

  test("ignores non-width media features", () => {
    const src = svelte(`@media (hover: none), (pointer: coarse) { .x { opacity: 1; } }`);
    expect(checkSource(src, "A.svelte", ["nonstandard-breakpoint"])).toHaveLength(0);
  });
});

describe("raw-color", () => {
  test("flags hex colors in styles", () => {
    const src = svelte(`.x { color: #ff0000; }`);
    const findings = checkSource(src, "A.svelte", ["raw-color"]);
    expect(findings).toHaveLength(1);
  });

  test("flags rgb()/rgba()", () => {
    const src = svelte(`.x { background: rgba(0, 0, 0, 0.5); }`);
    expect(checkSource(src, "A.svelte", ["raw-color"])).toHaveLength(1);
  });

  test("allows var() fallbacks", () => {
    const src = svelte(`.x { color: var(--accent-green, #22c55e); }`);
    expect(checkSource(src, "A.svelte", ["raw-color"])).toHaveLength(0);
  });

  test("allows color-mix shading with #000/#fff", () => {
    const src = svelte(
      `.x { background: color-mix(in srgb, var(--accent-blue) 88%, #000); color: color-mix(in srgb, var(--accent-red) 20%, #ffffff); }`,
    );
    expect(checkSource(src, "A.svelte", ["raw-color"])).toHaveLength(0);
  });

  test("flags palette hex smuggled through color-mix", () => {
    const src = svelte(`.x { background: color-mix(in srgb, #22c55e 50%, #000); }`);
    const findings = checkSource(src, "A.svelte", ["raw-color"]);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain("color-mix");
  });

  test("allows var() fallback nested inside color-mix", () => {
    const src = svelte(`.x { background: color-mix(in srgb, var(--accent-green, #22c55e) 50%, #000); }`);
    expect(checkSource(src, "A.svelte", ["raw-color"])).toHaveLength(0);
  });

  test("handles multiline color-mix formatting", () => {
    const ok = svelte(`.x {
    background: color-mix(
      in srgb,
      var(--accent-blue, #2563eb) 88%,
      #000
    );
  }`);
    expect(checkSource(ok, "A.svelte", ["raw-color"])).toHaveLength(0);

    const bad = svelte(`.x {
    background: color-mix(
      in srgb,
      #22c55e 50%,
      #fff
    );
  }`);
    const findings = checkSource(bad, "A.svelte", ["raw-color"]);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain("color-mix");
  });

  test("does not scan markup or script", () => {
    const src = svelte(`.x { color: var(--text-primary); }`, `<div data-color="#fff"></div>`);
    expect(checkSource(src, "A.svelte", ["raw-color"])).toHaveLength(0);
  });

  test("scans whole .css files", () => {
    expect(checkSource(`.x { color: #123456; }`, "app.css", ["raw-color"])).toHaveLength(1);
  });
});

describe("hand-rolled components", () => {
  test("modal: fixed + inset 0 overlay", () => {
    const src = svelte(`.overlay { position: fixed; inset: 0; background: var(--overlay-bg); }`);
    const findings = checkSource(src, "A.svelte", ["hand-rolled-modal"]);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain("Modal");
  });

  test("spinner: rotate keyframes", () => {
    const src = svelte(`@keyframes spin { to { transform: rotate(360deg); } }`);
    expect(checkSource(src, "A.svelte", ["hand-rolled-spinner"])).toHaveLength(1);
  });

  test("clipboard: direct writeText", () => {
    const src = svelte(``, ``, `async function copy() { await navigator.clipboard.writeText("x"); }`);
    expect(checkSource(src, "A.svelte", ["hand-rolled-clipboard"])).toHaveLength(1);
  });

  test("clipboard: legacy execCommand", () => {
    const src = svelte(``, ``, `document.execCommand("copy");`);
    expect(checkSource(src, "A.svelte", ["hand-rolled-clipboard"])).toHaveLength(1);
  });

  test("dropdown: combobox role", () => {
    const src = svelte(``, `<button role="combobox" aria-expanded="false">x</button>`);
    expect(checkSource(src, "A.svelte", ["hand-rolled-dropdown"])).toHaveLength(1);
  });

  test("kbd element", () => {
    const src = svelte(``, `<kbd>⌘K</kbd>`);
    expect(checkSource(src, "A.svelte", ["hand-rolled-kbd"])).toHaveLength(1);
  });

  test("splitter: col-resize cursor", () => {
    const src = svelte(`.divider { width: 4px; cursor: col-resize; }`);
    const findings = checkSource(src, "A.svelte", ["hand-rolled-splitter"]);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain("SplitResizeHandle");
  });

  test("segmented: seg-btn / segmented-control classes", () => {
    const src = svelte(``, `<div class="segmented-control"><button class="seg-btn active">All</button></div>`);
    expect(checkSource(src, "A.svelte", ["hand-rolled-segmented"])).toHaveLength(2);
  });

  test("segmented: does not match kit-segmented classes", () => {
    const src = svelte(``, `<div class="kit-segmented"><button class="kit-segmented__btn">All</button></div>`);
    expect(checkSource(src, "A.svelte", ["hand-rolled-segmented"])).toHaveLength(0);
  });

  test("segmented: does not match prose or identifiers", () => {
    const src = `<script>const id = "segmented-control";</script>\n<p>the segmented-control pattern</p>`;
    expect(checkSource(src, "A.svelte", ["hand-rolled-segmented"])).toHaveLength(0);
  });

  test("segmented: matches CSS selectors", () => {
    const src = svelte(`.segmented-control { display: flex; }`);
    expect(checkSource(src, "A.svelte", ["hand-rolled-segmented"])).toHaveLength(1);
  });

  test("table sort: aria-sort attribute", () => {
    const src = svelte(``, `<th aria-sort="ascending"><button>ID</button></th>`);
    const findings = checkSource(src, "A.svelte", ["hand-rolled-table-sort"]);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain("TableHeaderCell");
  });

  test("tooltip: role=tooltip markup", () => {
    const src = svelte(``, `<div class="hint" role="tooltip">Adds 3, removes 1</div>`);
    const findings = checkSource(src, "A.svelte", ["hand-rolled-tooltip"]);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain("Tooltip");
  });

  test("status bar: class and CSS selector", () => {
    const src = svelte(
      `.status-bar { height: var(--status-bar-height); }`,
      `<footer class="status-bar">3 sessions</footer>`,
    );
    expect(checkSource(src, "A.svelte", ["hand-rolled-status-bar"])).toHaveLength(2);
  });

  test("status bar: does not match kit-status-bar retheming", () => {
    const src = svelte(
      `.kit-status-bar { background: var(--bg-inset); }`,
      `<div class="kit-status-bar"></div>`,
    );
    expect(checkSource(src, "A.svelte", ["hand-rolled-status-bar"])).toHaveLength(0);
  });

  test("empty state: class and CSS selector", () => {
    const src = svelte(
      `.empty-state { color: var(--text-muted); }`,
      `<div class="empty-state">No sessions yet</div>`,
    );
    expect(checkSource(src, "A.svelte", ["hand-rolled-empty-state"])).toHaveLength(2);
  });

  test("empty state: does not match kit-empty-state or prose", () => {
    const src = `<script>// the empty-state pattern</script>\n<div class="kit-empty-state"></div>`;
    expect(checkSource(src, "A.svelte", ["hand-rolled-empty-state"])).toHaveLength(0);
  });

  test("icon button: class and CSS selector, both spellings", () => {
    const src = svelte(
      `.icon-btn { width: 28px; } .icon-button:hover { color: red; }`,
      `<button class="icon-btn"></button>`,
    );
    expect(checkSource(src, "A.svelte", ["hand-rolled-icon-button"])).toHaveLength(3);
  });

  test("icon button: does not match kit-icon-button or unrelated names", () => {
    const src = `<button class="kit-icon-button"></button>\n<div class="lexicon-btn"></div>`;
    expect(checkSource(src, "A.svelte", ["hand-rolled-icon-button"])).toHaveLength(0);
  });

  test("icon button: single quotes match, suffixed names don't", () => {
    const src = `<button class='icon-btn'></button>\n<style>.icon-button-group { display: flex; }</style>`;
    expect(checkSource(src, "A.svelte", ["hand-rolled-icon-button"])).toHaveLength(1);
  });

  test("code block: class and CSS selector", () => {
    const src = svelte(
      `.code-block { position: relative; }`,
      `<div class="code-block"><pre>x</pre></div>`,
    );
    expect(checkSource(src, "A.svelte", ["hand-rolled-code-block"])).toHaveLength(2);
  });

  test("code block: does not match kit-code-block or suffixed names", () => {
    const src = `<div class="kit-code-block"></div>\n<style>.code-block-list { gap: 4px; }</style>`;
    expect(checkSource(src, "A.svelte", ["hand-rolled-code-block"])).toHaveLength(0);
  });

  test("top bar: app-header class and region selectors", () => {
    const src = svelte(
      `.header-left { display: flex; }`,
      `<header class="app-header"><div class="header-left"></div></header>`,
    );
    expect(checkSource(src, "A.svelte", ["hand-rolled-top-bar"])).toHaveLength(3);
  });

  test("top bar: does not match kit-top-bar or prose", () => {
    const src = `<script>// the app-header pattern</script>\n<div class="kit-top-bar"></div>`;
    expect(checkSource(src, "A.svelte", ["hand-rolled-top-bar"])).toHaveLength(0);
  });
});

describe("typography rules", () => {
  test("pinned root: px font-size on html", () => {
    const findings = checkSource(
      `html, body { height: 100%; font-size: 13px; }`,
      "app.css",
      ["pinned-root-font-size"],
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain("rem scale");
  });

  test("pinned root: px font-size on :root", () => {
    const findings = checkSource(`:root { font-size: 14px; }`, "app.css", ["pinned-root-font-size"]);
    expect(findings).toHaveLength(1);
  });

  test("pinned root: allows token/percentage roots and non-root px", () => {
    const ok = `html { font-size: 100%; }\nbody { font-size: var(--font-size-root); }\n.chip { font-size: 10px; }`;
    expect(checkSource(ok, "app.css", ["pinned-root-font-size"])).toHaveLength(0);
  });

  test("pinned root: flags rem/var roots that compound the scale", () => {
    const findings = checkSource(
      `html, body { font-size: var(--font-size-root); }`,
      "app.css",
      ["pinned-root-font-size"],
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain("var(--font-size-root)");
  });

  test("pinned root: does not match class names containing html", () => {
    const ok = `.html-view { font-size: 12px; }`;
    expect(checkSource(ok, "app.css", ["pinned-root-font-size"])).toHaveLength(0);
  });

  test("legacy mobile type tokens are flagged", () => {
    const src = svelte(`.title { font-size: var(--font-size-mobile-title); }`);
    const findings = checkSource(src, "A.svelte", ["legacy-mobile-type"]);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain("--font-size-mobile-title");
  });
});

describe("nonstandard-spacing", () => {
  test("flags off-ladder gaps", () => {
    const src = svelte(`.row { display: flex; gap: 5px; }`);
    const findings = checkSource(src, "A.svelte", ["nonstandard-spacing"]);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain("5px");
  });

  test("allows ladder values, hairlines, and tokens", () => {
    const src = svelte(
      `.a { gap: 8px; }\n.b { gap: 1px; }\n.c { gap: var(--space-3); }\n.d { row-gap: 12px; }`,
    );
    expect(checkSource(src, "A.svelte", ["nonstandard-spacing"])).toHaveLength(0);
  });

  test("checks both values of two-axis gap", () => {
    const src = svelte(`.grid { gap: 8px 10px; }`);
    const findings = checkSource(src, "A.svelte", ["nonstandard-spacing"]);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain("10px");
  });
});

describe("legacy-svelte", () => {
  test("flags on: directives and export let", () => {
    const src = `<script>export let value;</script>\n<button on:click={fn}>x</button>`;
    const findings = checkSource(src, "A.svelte", ["legacy-svelte"]);
    expect(findings).toHaveLength(2);
  });

  test("does not flag runes-mode code", () => {
    const src = `<script lang="ts">let { value } = $props();</script>\n<button onclick={fn}>x</button>`;
    expect(checkSource(src, "A.svelte", ["legacy-svelte"])).toHaveLength(0);
  });

  test("skips non-svelte files", () => {
    expect(checkSource(`export let x;`, "a.ts", ["legacy-svelte"])).toHaveLength(0);
  });
});

describe("suppression and plumbing", () => {
  test("kit-ui-check-ignore on the same line suppresses", () => {
    const src = svelte(`.x { color: #ff0000; } /* kit-ui-check-ignore */`);
    expect(checkSource(src, "A.svelte", ["raw-color"])).toHaveLength(0);
  });

  test("kit-ui-check-ignore on the previous line suppresses", () => {
    const src = svelte(`/* kit-ui-check-ignore: brand color */\n.x { color: #ff0000; }`);
    expect(checkSource(src, "A.svelte", ["raw-color"])).toHaveLength(0);
  });

  test("findings carry 1-based line numbers", () => {
    const src = svelte(`.x { color: var(--text-primary); }\n.y { color: #ff0000; }`);
    const findings = checkSource(src, "A.svelte", ["raw-color"]);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.line).toBe(5); // script, empty markup, <style>, .x, then .y
  });

  test("unknown rule throws", () => {
    expect(() => checkSource("", "A.svelte", ["nope"])).toThrow("unknown rule");
  });
});
