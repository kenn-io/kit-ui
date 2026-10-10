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
    const src = svelte(
      `.x { background: color-mix(in srgb, var(--accent-green, #22c55e) 50%, #000); }`,
    );
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

describe("shared control states", () => {
  test("flags literal opacity on a disabled control", () => {
    const src = svelte(`.menu-item:disabled { opacity: 0.62; }`);
    const findings = checkSource(src, "Menu.svelte", ["hand-rolled-disabled-state"]);

    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain("kit-control-states");
  });

  test("flags literal opacity on an aria-disabled control", () => {
    const src = svelte(`.menu-item[aria-disabled="true"] { opacity: 60%; }`);
    expect(checkSource(src, "Menu.svelte", ["hand-rolled-disabled-state"])).toHaveLength(1);
  });

  test("allows the disabled token and descendant dimming", () => {
    const src = svelte(`
      .menu-item:disabled { opacity: var(--opacity-disabled); }
      .menu-item:disabled .shortcut { opacity: 0.7; }
    `);
    expect(checkSource(src, "Menu.svelte", ["hand-rolled-disabled-state"])).toHaveLength(0);
  });

  test("allows rules that exclude the control state", () => {
    const src = svelte(`
      .menu-item:hover:not(:disabled) { opacity: 0.9; }
      .menu-item:not([aria-disabled="true"]) { opacity: 0.9; }
      .menu-item:not(:active) { transform: scale(0.95); }
    `);
    expect(
      checkSource(src, "Menu.svelte", ["hand-rolled-disabled-state", "hand-rolled-press-state"]),
    ).toHaveLength(0);
  });

  test("flags a custom active transform and allows the shared transform", () => {
    const src = svelte(`
      .menu-item:active { transform: scale(0.95); }
      .toolbar-button:active:not(:disabled) { transform: var(--press-transform); }
    `);
    const findings = checkSource(src, "Menu.svelte", ["hand-rolled-press-state"]);

    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain("scale(0.95)");
  });

  test("scans nested rules without treating quoted or commented braces as structure", () => {
    const src = svelte(`
      .label::before { content: "{"; }
      /* } */
      @media (min-width: 640px) {
        .menu-item:disabled { opacity: 0.62; }
      }
    `);

    expect(checkSource(src, "Menu.svelte", ["hand-rolled-disabled-state"])).toHaveLength(1);
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
    const src = svelte(
      ``,
      ``,
      `async function copy() { await navigator.clipboard.writeText("x"); }`,
    );
    expect(checkSource(src, "A.svelte", ["hand-rolled-clipboard"])).toHaveLength(1);
  });

  test("clipboard: legacy execCommand", () => {
    const src = svelte(``, ``, `document.execCommand("copy");`);
    expect(checkSource(src, "A.svelte", ["hand-rolled-clipboard"])).toHaveLength(1);
  });

  test("dropdown: combobox role", () => {
    const src = svelte(``, `<button role="combobox" aria-expanded="false">x</button>`);
    const findings = checkSource(src, "A.svelte", ["hand-rolled-dropdown"]);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).not.toContain("MentionTextarea");
  });

  test("dropdown: listbox next to a textarea steers to MentionTextarea", () => {
    const src = svelte(``, `<textarea></textarea>\n<div role="listbox">x</div>`);
    const findings = checkSource(src, "A.svelte", ["hand-rolled-dropdown"]);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain("MentionTextarea");
  });

  test("kbd element", () => {
    const src = svelte(``, `<kbd>⌘K</kbd>`);
    expect(checkSource(src, "A.svelte", ["hand-rolled-kbd"])).toHaveLength(1);
  });

  test("splitter: pane-resize cursors", () => {
    const src = svelte(
      `.columns { width: 4px; cursor: col-resize; }\n.rows { height: 4px; cursor: row-resize; }`,
    );
    const findings = checkSource(src, "A.svelte", ["hand-rolled-splitter"]);
    expect(findings).toHaveLength(2);
    expect(findings[0]!.message).toContain("SplitResizeHandle");
    expect(findings[1]!.message).toContain("SplitResizeHandle");
  });

  test("segmented: seg-btn / segmented-control classes", () => {
    const src = svelte(
      ``,
      `<div class="segmented-control"><button class="seg-btn active">All</button></div>`,
    );
    expect(checkSource(src, "A.svelte", ["hand-rolled-segmented"])).toHaveLength(2);
  });

  test("segmented: does not match kit-segmented classes", () => {
    const src = svelte(
      ``,
      `<div class="kit-segmented"><button class="kit-segmented__btn">All</button></div>`,
    );
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

  describe("unsorted table header", () => {
    const check = (markup: string) =>
      checkSource(svelte(``, markup), "A.svelte", ["unsorted-table-header"]);

    test("flags a labeled header that does not sort", () => {
      const findings = check(`<Table>
  {#snippet header()}
    <TableHeaderCell label="Repo" sort={sorter} column="repo" />
    <TableHeaderCell label="Status" />
  {/snippet}
</Table>`);
      // Line 1 is the helper's <script> block.
      expect(findings.map((f) => f.line)).toEqual([5]);
      expect(findings[0]!.message).toContain("TableSort");
    });

    test("accepts TableSort, sortable, and headers with no visible text", () => {
      expect(
        check(`<Table>
  {#snippet header()}
    <TableHeaderCell class="col-pick"><span class="kit-sr-only">Select</span></TableHeaderCell>
    <TableHeaderCell label="Repo" sort={sorter} column="repo" />
    <TableHeaderCell
      label="Cost"
      numeric
      sortable
      sortDirection={dir("cost")}
      onsort={() => by("cost")}
    />
    <TableHeaderCell />
  {/snippet}
</Table>`),
      ).toEqual([]);
    });

    test("sortable={false} and custom header text still need sorting", () => {
      expect(
        check(`<Table>
  {#snippet header()}
    <TableHeaderCell label="Repo" sortable={false} />
    <TableHeaderCell>{columnName}</TableHeaderCell>
  {/snippet}
</Table>`),
      ).toHaveLength(2);
    });

    test("only a Table that opts out with unsorted may skip sorting", () => {
      expect(
        check(`<Table ariaLabel="Totals" unsorted>
  {#snippet header()}<TableHeaderCell label="Kind" />{/snippet}
</Table>
<Table ariaLabel="Jobs">
  {#snippet header()}<TableHeaderCell label="Job" />{/snippet}
</Table>
<Table ariaLabel="Runs" unsorted={false}>
  {#snippet header()}<TableHeaderCell label="Run" />{/snippet}
</Table>`).map((f) => f.line),
      ).toEqual([6, 9]);
    });

    test("flags a raw th with text, but not an empty one or a commented-out one", () => {
      expect(
        check(`<table>
  <thead><tr><th></th><th scope="col">Name</th></tr></thead>
</table>
<!-- <TableHeaderCell label="Old" /> -->`).map((f) => f.message),
      ).toEqual([expect.stringContaining("cannot sort")]);
    });

    test("an ignore marker cannot suppress it; unsorted is the only exception", () => {
      expect(
        check(`<Table>
  {#snippet header()}
    <!-- kit-ui-check-ignore -->
    <TableHeaderCell label="Repo" />
  {/snippet}
</Table>`),
      ).toHaveLength(1);
    });

    test("a header holding only a control or screen-reader text needs no sort", () => {
      expect(
        check(`<Table>
  {#snippet header()}
    <TableHeaderCell>
      <Checkbox
        checked={all}
        indeterminate={chosen.length > 0 && chosen.length < rows.length}
        onchange={(on) => (chosen = on ? rows : [])}
      />
    </TableHeaderCell>
    <TableHeaderCell>{#if editing}<span class="kit-sr-only">Actions</span>{/if}</TableHeaderCell>
    <TableHeaderCell>
      {#if selectable}
        {@const all = chosen.length === rows.length}
        <Checkbox checked={all} />
      {/if}
    </TableHeaderCell>
  {/snippet}
</Table>`),
      ).toEqual([]);
    });

    // sortable comes after the >, so a tag cut short there loses it and
    // the header is reported.
    test("a > inside an attribute expression does not end the tag", () => {
      expect(
        check(`<Table>
  {#snippet header()}
    <TableHeaderCell class={rows.length > 1 ? "many" : "few"} sortable>Cost</TableHeaderCell>
  {/snippet}
</Table>`),
      ).toEqual([]);
    });

    test("reads shorthand and spaced attributes", () => {
      expect(
        check(`<Table>
  {#snippet header()}
    <TableHeaderCell {sort} column="repo" label="Repo" />
    <TableHeaderCell {sortable} label="Cost" />
    <TableHeaderCell sort = {sorter} column="age" label="Age" />
    <TableHeaderCell sortable = {false} label="Owner" />
  {/snippet}
</Table>
<Table unsorted = {true}>
  {#snippet header()}<TableHeaderCell label="Kind" />{/snippet}
</Table>`).map((f) => f.line),
      ).toEqual([7]);
    });

    test("row headers and an empty label need no sort", () => {
      expect(
        check(`<Table>
  {#snippet header()}<TableHeaderCell label="" />{/snippet}
  <tr><th scope="row">Alice</th><td>1</td></tr>
  <tr><th scope='rowgroup'>Team</th></tr>
</Table>`),
      ).toEqual([]);
    });

    test("only the exact kit-sr-only class hides header text", () => {
      expect(
        check(`<Table>
  {#snippet header()}
    <TableHeaderCell><span class='kit-sr-only'>Actions</span></TableHeaderCell>
    <TableHeaderCell><span class="kit-sr-only-label">Owner</span></TableHeaderCell>
  {/snippet}
</Table>`).map((f) => f.line),
      ).toEqual([5]);
    });
  });

  test("tooltip: role=tooltip markup", () => {
    const src = svelte(``, `<div class="hint" role="tooltip">Adds 3, removes 1</div>`);
    const findings = checkSource(src, "A.svelte", ["hand-rolled-tooltip"]);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain("Tooltip");
  });

  test("popover card: all three chrome declarations in one rule", () => {
    const src = svelte(
      `.menu {
        position: fixed;
        background: var(--bg-surface);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-lg);
      }`,
      `<div class="menu"></div>`,
    );
    const findings = checkSource(src, "A.svelte", ["hand-rolled-popover-card"]);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain("kit-popover-card");
  });

  test("popover card: partial chrome (no shadow) does not match", () => {
    const src = svelte(
      `.card {
        border: 1px solid var(--border-default);
        border-radius: var(--radius-md);
      }
      .drawer {
        box-shadow: var(--shadow-lg);
      }`,
      `<div class="card"></div>`,
    );
    expect(checkSource(src, "A.svelte", ["hand-rolled-popover-card"])).toHaveLength(0);
  });

  test("card: default-level recipe (surface + muted border + radius-md)", () => {
    const src = svelte(
      `.event-card {
        flex: 1;
        background: var(--bg-surface);
        border: 1px solid var(--border-muted);
        border-radius: var(--radius-md);
      }`,
      `<div class="event-card"></div>`,
    );
    const findings = checkSource(src, "A.svelte", ["hand-rolled-card"]);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain('level="default"');
  });

  test("card: inset-level recipe (inset + muted border + radius-sm)", () => {
    const src = svelte(
      `.inset-box {
        background: var(--bg-inset);
        border: 1px solid var(--border-muted);
        border-radius: var(--radius-sm);
        padding: 10px 12px;
      }`,
      `<div class="inset-box"></div>`,
    );
    const findings = checkSource(src, "A.svelte", ["hand-rolled-card"]);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain('level="inset"');
  });

  test("card: raised-level recipe requires shadow-sm", () => {
    const raised = svelte(
      `.panel {
        background: var(--bg-surface);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-sm);
      }`,
      `<div class="panel"></div>`,
    );
    const findings = checkSource(raised, "A.svelte", ["hand-rolled-card"]);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain('level="raised"');

    // Without the shadow it's any bordered container, not the raised card.
    const flat = svelte(
      `.panel {
        background: var(--bg-surface);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
      }`,
      `<div class="panel"></div>`,
    );
    expect(checkSource(flat, "A.svelte", ["hand-rolled-card"])).toHaveLength(0);
  });

  test("card: input-wrapper chrome (border-default + radius-md) does not match", () => {
    const src = svelte(
      `.input {
        background: var(--bg-surface);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-md);
      }`,
      `<div class="input"><input /></div>`,
    );
    expect(checkSource(src, "A.svelte", ["hand-rolled-card"])).toHaveLength(0);
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

  test("image preview: class and CSS selector, prefixed names included", () => {
    const src = svelte(
      `.diff-image-preview { background-size: 20px 20px; }`,
      `<div class="diff-image-preview"><img src={url} alt="" /></div>`,
    );
    expect(checkSource(src, "A.svelte", ["hand-rolled-image-preview"])).toHaveLength(2);
  });

  test("image preview: does not match kit-image-preview", () => {
    const src = `<div class="kit-image-preview"></div>\n<style>.kit-image-preview { padding: 0; }</style>`;
    expect(checkSource(src, "A.svelte", ["hand-rolled-image-preview"])).toHaveLength(0);
  });

  test("lightbox: class attribute, className assignment, and CSS selector", () => {
    const src = svelte(
      `.markdown-image-lightbox { position: fixed; }`,
      `<div class="image-lightbox"></div>`,
      `overlay.className = "markdown-image-lightbox";`,
    );
    const findings = checkSource(src, "A.svelte", ["hand-rolled-lightbox"]);
    expect(findings).toHaveLength(3);
    expect(findings[0]!.message).toContain("MediaViewer");
  });

  test("lightbox: quoted selector strings and BEM elements", () => {
    const src = `overlay.closest(".markdown-image-lightbox");\nconst panel = ".lightbox__panel";`;
    expect(checkSource(src, "a.ts", ["hand-rolled-lightbox"])).toHaveLength(2);
    expect(
      checkSource(`.lightbox__panel { inset: 0; }`, "a.css", ["hand-rolled-lightbox"]),
    ).toHaveLength(1);
  });

  test("lightbox: does not match kit-ui's viewer, property access, or other words", () => {
    const src = [
      `<div class="kit-media-viewer highlightbox"></div>`,
      `const lightboxOpen = settings.lightbox;`,
      `if (settings.lightbox) {`,
      `settings.lightbox = { enabled: true };`,
      `settings.lightbox = (value) => {`,
      `const options = settings.lightbox ?? {};`,
      `const label = "a" + settings.lightbox + "b";`,
      `.highlightbox { color: red; }`,
    ].join("\n");
    expect(checkSource(src, "A.svelte", ["hand-rolled-lightbox"])).toHaveLength(0);
  });

  test("lightbox: compound selectors in CSS rules and quoted strings", () => {
    const css = [
      `div.lightbox { position: fixed; }`,
      `.overlay.lightbox, #preview.lightbox__panel { inset: 0; }`,
    ].join("\n");
    const findings = checkSource(css, "a.css", ["hand-rolled-lightbox"]);
    expect(findings.map((finding) => finding.line)).toEqual([1, 2, 2]);
    const script = `document.querySelector("dialog.image-lightbox");`;
    expect(checkSource(script, "a.ts", ["hand-rolled-lightbox"])).toHaveLength(1);
  });

  test("lightbox: multiline template literals; not CSS comments or quoted values", () => {
    const script = "const overlay = document.querySelector(`\n  .lightbox\n`);";
    expect(checkSource(script, "a.ts", ["hand-rolled-lightbox"]).map((f) => f.line)).toEqual([2]);
    const css = [
      `/* replaces the old .lightbox overlay */`,
      `.badge::after { content: ".lightbox"; }`,
      `.image-lightbox { inset: 0; }`,
    ].join("\n");
    expect(checkSource(css, "a.css", ["hand-rolled-lightbox"]).map((f) => f.line)).toEqual([3]);
    const style = svelte(`/* .lightbox */ .x::after { content: ".lightbox"; }`);
    expect(checkSource(style, "A.svelte", ["hand-rolled-lightbox"])).toHaveLength(0);
  });

  test("lightbox: reports an unindented selector on its own line", () => {
    const src = `a { color: red; }\n.lightbox { inset: 0; }`;
    expect(checkSource(src, "a.css", ["hand-rolled-lightbox"]).map((f) => f.line)).toEqual([2]);
    const ignored = `a { color: red; }\n.lightbox { inset: 0; } /* kit-ui-check-ignore */`;
    expect(checkSource(ignored, "a.css", ["hand-rolled-lightbox"])).toHaveLength(0);
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

  test("search input: type=search and class names", () => {
    const src = svelte(
      `.search-input { flex: 1; }`,
      `<input type="search" class="search-input" placeholder="Filter" />`,
    );
    const findings = checkSource(src, "A.svelte", ["hand-rolled-search-input"]);
    expect(findings).toHaveLength(3);
    expect(findings[0]!.message).toContain("SearchInput");
  });

  test("search input: does not match kit-search-input", () => {
    const src = svelte(
      `:global(.kit-search-input) { max-width: 320px; }`,
      `<div class="kit-search-input"></div>`,
    );
    expect(checkSource(src, "A.svelte", ["hand-rolled-search-input"])).toHaveLength(0);
  });

  test("date input: native type=date and datetime-local", () => {
    const src = svelte(``, `<input type="date" /><input type="datetime-local" />`);
    const findings = checkSource(src, "A.svelte", ["hand-rolled-date-input"]);
    expect(findings).toHaveLength(2);
    expect(findings[0]!.message).toContain("DatePicker (one date)");
  });

  test("toast: classes including compounds like undo-toast", () => {
    const src = svelte(
      `.undo-toast { position: fixed; }`,
      `<div class="undo-toast">Deleted</div><div class="snackbar"></div>`,
    );
    const findings = checkSource(src, "A.svelte", ["hand-rolled-toast"]);
    expect(findings).toHaveLength(3);
    expect(findings[0]!.message).toContain("FlashBanner");
  });

  test("toast: does not match prose or toaster", () => {
    const src = `<p>a toast to snackbars</p>\n<div class="toaster"></div>`;
    expect(checkSource(src, "A.svelte", ["hand-rolled-toast"])).toHaveLength(0);
  });

  test("drawer: bare class and compounds", () => {
    const src = svelte(
      `.drawer-panel { width: 320px; }`,
      `<div class="drawer"><div class="drawer-panel"></div></div>`,
    );
    const findings = checkSource(src, "A.svelte", ["hand-rolled-drawer"]);
    expect(findings).toHaveLength(3);
    expect(findings[0]!.message).toContain("DetailDrawer");
    expect(findings[0]!.message).toContain("BottomDock");
  });

  test("drawer: does not match kit-detail-drawer", () => {
    const src = svelte(
      `:global(.kit-detail-drawer) { width: 400px; }`,
      `<div class="kit-detail-drawer"></div>`,
    );
    expect(checkSource(src, "A.svelte", ["hand-rolled-drawer"])).toHaveLength(0);
  });

  test("drawer: leaves other drawer-* compounds alone", () => {
    const src = svelte(
      `.drawer-demo-body { padding: 8px; }`,
      `<div class="drawer-demo-body"></div><ul class="drawer-list"></ul>`,
    );
    expect(checkSource(src, "A.svelte", ["hand-rolled-drawer"])).toHaveLength(0);
  });

  test("drawer: explicit inline bottom-panel classes", () => {
    const src = svelte(
      `.bottom-panel { height: 240px; } .bottom-tray { overflow: auto; } :is(.bottom-panel) :not(.bottom-tray) { display: block; }`,
      `<div class="bottom-dock"></div><div class="kit-bottom-dock"></div>`,
    );
    const findings = checkSource(src, "A.svelte", ["hand-rolled-drawer"]);
    expect(findings).toHaveLength(5);
    expect(findings[0]!.message).toContain("BottomDock");
  });

  test("drawer: generic dock names remain exempt", () => {
    const src = svelte(
      `.dock { display: flex; } .editor-bottom-panel { height: 10rem; } .bottom-tray-content { overflow: auto; }`,
      `<nav class="dock-item"></nav><div class="editor-bottom-dock"></div><div class="bottom-panel-content"></div><div class="sm:bottom-panel bottom-panel/item"></div>`,
    );
    expect(checkSource(src, "A.svelte", ["hand-rolled-drawer"])).toHaveLength(0);
  });

  test("find bar: class match, kit-find-bar exempt", () => {
    const bad = svelte(`.find-bar { display: flex; }`, `<div class="find-bar"></div>`);
    expect(checkSource(bad, "A.svelte", ["hand-rolled-find-bar"])).toHaveLength(2);
    const ok = svelte(``, `<div class="kit-find-bar"></div>`);
    expect(checkSource(ok, "A.svelte", ["hand-rolled-find-bar"])).toHaveLength(0);
  });

  test("status dot: class match, kit-status-dot exempt", () => {
    const bad = svelte(`.status-dot { width: 8px; }`, `<span class="status-dot"></span>`);
    expect(checkSource(bad, "A.svelte", ["hand-rolled-status-dot"])).toHaveLength(2);
    const ok = svelte(``, `<span class="kit-status-dot kit-status-dot--idle"></span>`);
    expect(checkSource(ok, "A.svelte", ["hand-rolled-status-dot"])).toHaveLength(0);
  });

  test("sidebar toggle: class match, kit-sidebar-toggle exempt", () => {
    const bad = svelte(``, `<button class="sidebar-toggle"></button>`);
    expect(checkSource(bad, "A.svelte", ["hand-rolled-sidebar-toggle"])).toHaveLength(1);
    const ok = svelte(``, `<div class="kit-sidebar-toggle--push"></div>`);
    expect(checkSource(ok, "A.svelte", ["hand-rolled-sidebar-toggle"])).toHaveLength(0);
  });

  test("sr-only: clip recipes in styles", () => {
    const src = svelte(
      `.visually-hidden { position: absolute; width: 1px; height: 1px; clip: rect(0 0 0 0); }
      .sr { clip-path: inset(50%); }`,
    );
    const findings = checkSource(src, "A.svelte", ["hand-rolled-sr-only"]);
    expect(findings).toHaveLength(2);
    expect(findings[0]!.message).toContain("kit-sr-only");
  });

  test("virtualization: library imports", () => {
    const src = svelte(``, ``, `import { createVirtualizer } from "@tanstack/virtual-core";`);
    const findings = checkSource(src, "A.svelte", ["hand-rolled-virtualization"]);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain("VirtualList");
  });

  test("virtualization: scans .ts sources too", () => {
    const src = `import VirtualList from "svelte-tiny-virtual-list";`;
    expect(checkSource(src, "list.ts", ["hand-rolled-virtualization"])).toHaveLength(1);
  });

  test("scroll-box: vertical scroller with hidden scrollbar", () => {
    const src = svelte(`.feed { overflow-y: auto; scrollbar-width: none; }`);
    const findings = checkSource(src, "A.svelte", ["hand-rolled-scroll-box"]);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain("ScrollBox");
    expect(findings[0]!.message).toContain("native scrollbar");
  });

  test("scroll-box: shorthand overflow counts, horizontal strips are exempt", () => {
    const both = svelte(`.pane { overflow: auto; scrollbar-width: none; }`);
    expect(checkSource(both, "A.svelte", ["hand-rolled-scroll-box"])).toHaveLength(1);
    const tabs = svelte(`.tabs { overflow-x: auto; scrollbar-width: none; }`);
    expect(checkSource(tabs, "A.svelte", ["hand-rolled-scroll-box"])).toHaveLength(0);
    const separate = svelte(`.a { overflow-y: auto; }\n.b { scrollbar-width: none; }`);
    expect(checkSource(separate, "A.svelte", ["hand-rolled-scroll-box"])).toHaveLength(0);
  });

  test("markdown: direct marked/dompurify imports", () => {
    const src = `import { marked } from "marked";\nimport DOMPurify from "dompurify";`;
    const findings = checkSource(src, "markdown.ts", ["hand-rolled-markdown"]);
    expect(findings).toHaveLength(2);
    expect(findings[0]!.message).toContain("renderMarkdown");
  });

  test("markdown: does not match kit-ui's own exports", () => {
    const src = `import { renderMarkdown } from "@kenn-io/kit-ui";`;
    expect(checkSource(src, "a.ts", ["hand-rolled-markdown"])).toHaveLength(0);
  });

  test("mermaid: static and dynamic mermaid imports", () => {
    const src = `import mermaid from "mermaid";\nconst lazy = () => import("mermaid");`;
    const findings = checkSource(src, "diagrams.ts", ["hand-rolled-mermaid"]);
    expect(findings).toHaveLength(2);
    expect(findings[0]!.message).toContain("markdown-mermaid");
  });

  test("mermaid: does not match kit-ui's own subpath", () => {
    const src = `import { mermaidCodeFence } from "@kenn-io/kit-ui/utils/markdown-mermaid";`;
    expect(checkSource(src, "a.ts", ["hand-rolled-mermaid"])).toHaveLength(0);
  });

  test("focus trap: tabbable-selector string", () => {
    const src = svelte(
      ``,
      ``,
      `const TABBABLE = 'button, [href], [tabindex]:not([tabindex="-1"])';`,
    );
    const findings = checkSource(src, "A.svelte", ["hand-rolled-focus-trap"]);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain("trapFocus");
  });

  test("debounce: relative import and inline function", () => {
    const src = `import { debounce } from "../utils/debounce.js";\nfunction debounce(fn, ms) {}`;
    const findings = checkSource(src, "a.ts", ["local-debounce"]);
    expect(findings).toHaveLength(2);
    expect(findings[0]!.message).toContain("@kenn-io/kit-ui");
  });

  test("debounce: does not match the kit-ui import", () => {
    const src = `import { debounce } from "@kenn-io/kit-ui";\nconst run = debounce(load, 150);`;
    expect(checkSource(src, "a.ts", ["local-debounce"])).toHaveLength(0);
  });
});

describe("typography rules", () => {
  test("pinned root: px font-size on html", () => {
    const findings = checkSource(`html, body { height: 100%; font-size: 13px; }`, "app.css", [
      "pinned-root-font-size",
    ]);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain("rem scale");
  });

  test("pinned root: px font-size on :root", () => {
    const findings = checkSource(`:root { font-size: 14px; }`, "app.css", [
      "pinned-root-font-size",
    ]);
    expect(findings).toHaveLength(1);
  });

  test("pinned root: allows token/percentage roots and non-root px", () => {
    const ok = `html { font-size: 100%; }\nbody { font-size: var(--font-size-root); }\n.chip { font-size: 10px; }`;
    expect(checkSource(ok, "app.css", ["pinned-root-font-size"])).toHaveLength(0);
  });

  test("pinned root: flags rem/var roots that compound the scale", () => {
    const findings = checkSource(`html, body { font-size: var(--font-size-root); }`, "app.css", [
      "pinned-root-font-size",
    ]);
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

describe("theme wiring", () => {
  test("manual color scheme: prefers-color-scheme media query", () => {
    const findings = checkSource(
      `@media (prefers-color-scheme: dark) { :root { --bg: #000; } }`,
      "app.css",
      ["manual-color-scheme"],
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain("initTheme");
  });

  test("manual color scheme: matchMedia and classList toggling", () => {
    const src = svelte(
      ``,
      ``,
      `const dark = matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle("dark", dark);`,
    );
    expect(checkSource(src, "A.svelte", ["manual-color-scheme"])).toHaveLength(2);
  });

  test("manual color scheme: unrelated classList calls pass", () => {
    const src = svelte(``, ``, `document.body.classList.add("kit-type-touch");`);
    expect(checkSource(src, "A.svelte", ["manual-color-scheme"])).toHaveLength(0);
  });
});

describe("raw-z-index", () => {
  test("flags overlay-scale literals", () => {
    const src = svelte(`.overlay { z-index: 1000; }\n.toast-layer { z-index: 9999; }`);
    const findings = checkSource(src, "A.svelte", ["raw-z-index"]);
    expect(findings).toHaveLength(2);
    expect(findings[0]!.message).toContain("--z-popover");
  });

  test("allows small local stacking and z tokens", () => {
    const src = svelte(
      `.a { z-index: 2; }\n.b { z-index: 99; }\n.c { z-index: var(--z-popover); }`,
    );
    expect(checkSource(src, "A.svelte", ["raw-z-index"])).toHaveLength(0);
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

describe("chip-label-override", () => {
  test("flags the alignment override in a plain CSS file", () => {
    const src = `.kit-chip__label svg {\n  vertical-align: middle;\n  margin-block: -0.2em;\n}\n`;
    const findings = checkSource(src, "app.css", ["chip-label-override"]);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain("trailing snippet");
  });

  test("flags the selector in a component style block", () => {
    const src = svelte(`:global(.kit-chip__label) { font-style: italic; }`);
    expect(checkSource(src, "A.svelte", ["chip-label-override"])).toHaveLength(1);
  });

  test("ignores the class in markup and other kit-chip selectors", () => {
    const src = svelte(
      `.kit-chip--tone-info { opacity: 0.9; }`,
      `<span class="kit-chip__label">x</span>`,
    );
    expect(checkSource(src, "A.svelte", ["chip-label-override"])).toHaveLength(0);
  });

  test("ignores suffixed local classes like .kit-chip__label-wrapper", () => {
    const src = `.kit-chip__label-wrapper { display: flex; }\n`;
    expect(checkSource(src, "app.css", ["chip-label-override"])).toHaveLength(0);
  });
});

describe("hand-rolled-checkbox / hand-rolled-toggle", () => {
  test("checkbox: flags bare native checkbox markup", () => {
    const src = svelte(``, `<label><input type="checkbox" checked /> Auto-sync</label>`);
    const findings = checkSource(src, "A.svelte", ["hand-rolled-checkbox"]);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain("Checkbox");
  });

  test("checkbox: flags input[type=checkbox] selectors and checkbox-scoped accent-color", () => {
    const src = svelte(
      `input[type="checkbox"] { width: 14px; }
      .checkbox-row input { accent-color: var(--accent-blue); }`,
    );
    expect(checkSource(src, "A.svelte", ["hand-rolled-checkbox"])).toHaveLength(2);
  });

  test("checkbox: rules nested inside @media are still detected", () => {
    const src = svelte(
      `@media (hover: hover) {
        input[type="checkbox"] { width: 14px; }
      }
      @media (max-width: 640px) {
        .checkbox-row input { accent-color: var(--accent-blue); }
      }`,
    );
    expect(checkSource(src, "A.svelte", ["hand-rolled-checkbox"])).toHaveLength(2);
  });

  test("checkbox: accent-color on non-checkbox controls is clean", () => {
    const src = svelte(
      `input[type="range"] { accent-color: var(--accent-blue); }
      .control input { accent-color: var(--accent-blue); }`,
    );
    expect(checkSource(src, "A.svelte", ["hand-rolled-checkbox"])).toHaveLength(0);
  });

  test("checkbox: non-checkbox declarations nested under a checkbox-named ancestor are clean", () => {
    // The accent-color belongs to the nested range rule, not the ancestor —
    // an earlier scanner blamed descendant declarations on ancestor selectors.
    const src = svelte(
      `.checkbox-zone {
        input[type="range"] { accent-color: var(--accent-blue); }
      }`,
    );
    expect(checkSource(src, "A.svelte", ["hand-rolled-checkbox"])).toHaveLength(0);
  });

  test("checkbox: nested at-rule preludes don't leak into the parent's declarations", () => {
    // The @supports prelude names accent-color but is the CHILD's prelude,
    // not a parent declaration — an earlier scanner appended the selector
    // tail to the parent frame and false-flagged .checkbox-zone.
    const src = svelte(
      `.checkbox-zone {
        @supports (accent-color: auto) {
          input[type="range"] { width: 14px; }
        }
      }`,
    );
    expect(checkSource(src, "A.svelte", ["hand-rolled-checkbox"])).toHaveLength(0);
  });

  test("checkbox: semicolons inside quoted attribute values don't split the selector", () => {
    // lastIndexOf(";") over the raw text would cut the selector at the
    // quoted ";" and lose the checkbox half — a false negative.
    const src = svelte(`input[type="checkbox"][data-token=";"] { width: 14px; }`);
    expect(checkSource(src, "A.svelte", ["hand-rolled-checkbox"])).toHaveLength(1);
  });

  test("checkbox: escaped semicolons in selectors are not declaration boundaries", () => {
    // `\;` is part of the class name — splitting there would drop the
    // checkbox half of the selector and miss the rule.
    const src = svelte(`input[type="checkbox"].foo\\;bar { width: 14px; }`);
    expect(checkSource(src, "A.svelte", ["hand-rolled-checkbox"])).toHaveLength(1);
  });

  test("checkbox: declarations before a nested checkbox rule stay with the parent", () => {
    // The parent's accent-color must not vanish into the child selector
    // split; the checkbox-named parent still flags.
    const src = svelte(
      `.checkbox-row {
        accent-color: var(--accent-blue);
        span { color: var(--text-primary); }
      }`,
    );
    expect(checkSource(src, "A.svelte", ["hand-rolled-checkbox"])).toHaveLength(1);
  });

  test("checkbox: braces inside content strings are not structural", () => {
    const src = svelte(
      `input[type="checkbox"] { width: 14px; }
      .badge::before { content: "{"; }
      .checkbox-row input { accent-color: var(--accent-blue); }`,
    );
    // The stray "{" must not desync the scanner: both real findings survive.
    expect(checkSource(src, "A.svelte", ["hand-rolled-checkbox"])).toHaveLength(2);
  });

  test("checkbox: commented-out checkbox rules are clean", () => {
    const src = svelte(
      `/* input[type="checkbox"] { accent-color: red; } */
      .row { color: var(--text-primary); }`,
    );
    expect(checkSource(src, "A.svelte", ["hand-rolled-checkbox"])).toHaveLength(0);
  });

  test("checkbox: deep nesting stays linear", () => {
    // An earlier scanner re-sliced each frame's full body on every close
    // brace — quadratic on adversarial nesting depth. Depth is sized so
    // the quadratic version copies ~1.4GB (multiple seconds) while the
    // linear pass stays in the low milliseconds; the generous wall-clock
    // budget then only separates complexity classes, not hardware.
    const depth = 20000;
    const src = svelte(
      `${".x{".repeat(depth)}input[type="range"]{accent-color:red;}${"}".repeat(depth)}`,
    );
    const start = performance.now();
    expect(checkSource(src, "A.svelte", ["hand-rolled-checkbox"])).toHaveLength(0);
    expect(performance.now() - start).toBeLessThan(1000);
  });

  test("checkbox: <Checkbox> component usage is clean", () => {
    const src = svelte(``, `<Checkbox bind:checked={autoSync} label="Auto-sync" />`);
    expect(checkSource(src, "A.svelte", ["hand-rolled-checkbox"])).toHaveLength(0);
  });

  test("toggle: flags role=switch markup", () => {
    const src = svelte(
      `.toggle-switch { width: 36px; }`,
      `<button role="switch" aria-checked="true"><span class="toggle-switch"></span></button>`,
    );
    const findings = checkSource(src, "A.svelte", ["hand-rolled-toggle"]);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain("Toggle");
  });

  test("toggle: <Toggle> component usage is clean", () => {
    const src = svelte(``, `<Toggle bind:checked={on} label="Notifications" />`);
    expect(checkSource(src, "A.svelte", ["hand-rolled-toggle"])).toHaveLength(0);
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

describe("split-handle-override", () => {
  const rule = ["split-handle-override"];

  test("flags resizing a handle through a wrapper selector", () => {
    const src = svelte(
      `.chat-resizer :global(.kit-split-resize-handle) {
        display: block;
        height: 100%;
        width: var(--chat-divider-width);
      }`,
    );
    const findings = checkSource(src, "A.svelte", rule);
    expect(findings.map((f) => f.message.split(" ")[0])).toEqual(["`height`", "`width`"]);
  });

  test("flags restyling the handle's colour, including hover states", () => {
    const src = `.hub .kit-split-resize-handle { background: transparent; }
.hub .kit-split-resize-handle:hover { background: var(--accent-blue); }
`;
    expect(checkSource(src, "app.css", rule)).toHaveLength(2);
  });

  test("flags pseudo-elements on the handle and its orientation modifiers", () => {
    const src = `:where(.kit-split-resize-handle)::after { content: ""; inset: 0 -2px; }
:where(.kit-split-resize-handle--vertical)::after { top: -2px; }
`;
    const findings = checkSource(src, "app.css", rule);
    expect(findings).toHaveLength(2);
    expect(findings[0]!.message).toContain("pseudo-element");
  });

  test("allows placing and hiding a handle", () => {
    const src = svelte(
      `.chat-resizer :global(.kit-split-resize-handle) {
        position: absolute;
        inset: 0 auto 0 0;
        z-index: 12;
        -webkit-app-region: no-drag;
      }
      @media (max-width: 760px) {
        .layout :global(.kit-split-resize-handle) { display: none; }
      }`,
    );
    expect(checkSource(src, "A.svelte", rule)).toHaveLength(0);
  });

  test("allows styling neighbours and unrelated kit-split classes", () => {
    const src = `.layout:has(.kit-split-resize-handle) .pane { border: 0; }
.kit-split-resize-handle + .pane { padding-left: 4px; }
.pane:not(.kit-split-resize-handle) { width: 10px; }
.kit-split-resize-handle-wrapper { width: 10px; }
`;
    expect(checkSource(src, "app.css", rule)).toHaveLength(0);
  });

  test("flags app-level assignments of the size token", () => {
    const src = svelte(
      `:root { --split-handle-size: 8px; }`,
      `<div style="--split-handle-size: 2px" style:--split-handle-size="3px"></div>`,
      `el.style.setProperty("--split-handle-size", "6px");`,
    );
    expect(checkSource(src, "A.svelte", rule)).toHaveLength(4);
  });

  test("flags class attribute selectors aimed at the handle", () => {
    const src = `button[class~="kit-split-resize-handle"] { background: red !important; }
.layout [class*=split-resize] { width: 8px; }
`;
    expect(checkSource(src, "app.css", rule)).toHaveLength(2);
  });

  test("allows class attribute selectors that cannot match the handle", () => {
    const src = `[class="kit-split-resize-handle-wrapper"] { width: 8px; }
[class*="split-resizer-shell"] { width: 8px; }
[class~="kit-control-states"] { width: 8px; }
`;
    expect(checkSource(src, "app.css", rule)).toHaveLength(0);
  });

  test("follows attribute operator semantics and case sensitivity", () => {
    const flagged = `[class$="--horizontal svelte-abc123"] { width: 8px; }
[class~="KIT-SPLIT-RESIZE-HANDLE" i] { width: 8px; }
[class="kit-split-resize-handle kit-control-states kit-split-resize-handle--vertical svelte-x1"] { width: 8px; }
`;
    expect(checkSource(flagged, "app.css", rule)).toHaveLength(3);
    const ignored = `[class="kit-split-resize-handle"] { width: 8px; }
[class$="--horizontal"] { width: 8px; }
[class~="KIT-SPLIT-RESIZE-HANDLE"] { width: 8px; }
`;
    expect(checkSource(ignored, "app.css", rule)).toHaveLength(0);
  });

  test("keeps comment markers inside quoted strings literal", () => {
    const src = `.a { content: "/*"; }
.kit-split-resize-handle { width: 8px; }
.b { content: "*/"; }
`;
    expect(checkSource(src, "app.css", rule)).toHaveLength(1);
    const markup = svelte(``, `<p>don't</p>\n<!-- style="--split-handle-size: 1px" -->`);
    expect(checkSource(markup, "A.svelte", rule)).toHaveLength(0);
  });

  test("flags custom properties set on the handle", () => {
    const src = `.kit-split-resize-handle { --border-muted: red; --press-transform: none; }\n`;
    expect(checkSource(src, "app.css", rule)).toHaveLength(2);
  });

  test("flags declarations in nested rules and in their parents", () => {
    const src = `.layout {
  .kit-split-resize-handle {
    width: 8px;
    &:hover { background: red !important; }
    @media (max-width: 640px) { height: 2px; }
  }
}
`;
    const findings = checkSource(src, "app.css", rule);
    expect(findings.map((f) => f.line)).toEqual([3, 4, 5]);
  });

  test("allows nested rules that only place the handle or style its neighbours", () => {
    const src = `.layout {
  .kit-split-resize-handle { z-index: 12; & + .pane { border-left: 0; } }
}
`;
    expect(checkSource(src, "app.css", rule)).toHaveLength(0);
  });

  test("flags setProperty calls with a space before the parenthesis", () => {
    const src = svelte(
      ``,
      ``,
      `document.documentElement.style.setProperty ("--split-handle-size", "8px");`,
    );
    expect(checkSource(src, "A.svelte", rule)).toHaveLength(1);
  });

  test("scans unterminated and repeated comment openers in linear time", () => {
    const started = performance.now();
    checkSource("/*" + "a/*".repeat(50_000), "app.css", rule);
    checkSource("<!--".repeat(50_000), "A.svelte", rule);
    checkSource(`"${"'".repeat(100_000)}`, "A.svelte", rule);
    expect(performance.now() - started).toBeLessThan(500);
  });

  test("allows styling elements beside a handle named inside :is()", () => {
    const src = `:is(.kit-split-resize-handle, .pane) > .title { color: var(--text-primary); }
:global(.kit-split-resize-handle + .pane) { border-left: 0; }
`;
    expect(checkSource(src, "app.css", rule)).toHaveLength(0);
  });

  test("ignores the token name in comments", () => {
    const src = svelte(
      `/* --split-handle-size: 4px is reserved */ .x { color: var(--text-primary); }`,
      `<!-- style="--split-handle-size: 2px" -->`,
      `// el.style.setProperty("--split-handle-size", "6px");\nconst docs = "https://example.com/--split-handle-size";`,
    );
    expect(checkSource(src, "A.svelte", rule)).toHaveLength(0);
  });

  test("allows reading the size token", () => {
    const src = `.chat-slot { padding-inline-start: var(--split-handle-size); }\n`;
    expect(checkSource(src, "app.css", rule)).toHaveLength(0);
  });

  test("ignores the kit-ui-check-ignore marker", () => {
    const src = `/* kit-ui-check-ignore: our splitters are special */
.layout .kit-split-resize-handle { width: 8px; }
`;
    expect(checkSource(src, "app.css", rule)).toHaveLength(1);
  });
});
