# Orientation-Aware Split Handle and Bottom Dock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bidirectional split resizing and a controlled inline bottom dock to kit-ui.

**Architecture:** Keep `SplitResizeHandle` layout-free and axis-neutral, then compose it inside a new `BottomDock` that owns inline surface layout, CSS-length height limits, scrolling regions, and a shared close control. The dock does not adopt dialog, overlay, focus-trap, or Escape behavior.

**Tech Stack:** Svelte 5 runes and attachments, TypeScript, scoped token-based CSS, Bun tests, Playwright, kit-ui checker rules.

## Global Constraints

- Implement only shared kit-ui components and in-repository demos, docs, checker rules, and tests.
- Use Svelte 5 runes, explicit `Props` interfaces, snippets, and `{@attach}` for `ResizeObserver` integration.
- Use only design tokens from `src/lib/theme.css`; use the `--space-1` through `--space-8` ladder for gaps and padding.
- Do not add compatibility aliases for `deltaX`, `startX`, or `currentX`.
- Do not add Escape handling, overlay behavior, fixed positioning, focus trapping, body scroll locking, or a generic split-pane container.
- Test owned behavior only: active-axis resizing, dock state transitions, layout semantics, height constraints, scrolling, and checker guidance.

---

### Task 1: Support horizontal and vertical split resizing

**Files:**

- Modify: `checks/rules.test.ts:153`
- Modify: `checks/rules.mjs:287`
- Create: `tests/browser/split-resize-handle.spec.ts`
- Modify: `src/lib/components/split-resize.ts:1`
- Modify: `src/lib/components/SplitResizeHandle.svelte:1`
- Modify: `src/lib/components/CollapsibleSidebar.svelte:55`
- Modify: `src/demo/pages/SplitResizeHandleDemo.svelte:1`
- Modify: `src/lib/index.ts:84`
- Modify: `docs/components/split-resize-handle.md:1`
- Modify: `docs/checking.md:35`

**Interfaces:**

- Produces: `SplitResizeOrientation = "horizontal" | "vertical"`.
- Produces: `SplitResizeEvent { orientation, delta, start, current, event }`.
- Produces: `SplitResizeHandle` props `orientation`, `disabled`, `ariaValueMin`, `ariaValueMax`, and `ariaValueNow`.
- Consumes: existing callback lifecycle `onResizeStart`, `onResize`, and `onResizeEnd`.

- [ ] **Step 1: Write the failing checker test**

Replace the splitter test with:

```ts
test("splitter: pane-resize cursors", () => {
  const src = svelte(
    `.columns { width: 4px; cursor: col-resize; }\n.rows { height: 4px; cursor: row-resize; }`,
  );
  const findings = checkSource(src, "A.svelte", ["hand-rolled-splitter"]);
  expect(findings).toHaveLength(2);
  expect(findings[0]!.message).toContain("SplitResizeHandle");
  expect(findings[1]!.message).toContain("SplitResizeHandle");
});
```

- [ ] **Step 2: Run the checker test and verify RED**

Run: `bun test checks/rules.test.ts --test-name-pattern "splitter: pane-resize cursors"`

Expected: FAIL because only `col-resize` is detected.

- [ ] **Step 3: Extend the splitter checker**

Change the rule to use `/cursor:\s*(?:col|row)-resize/g`, rename its comment to "pane-resize cursor", and use this message:

```js
"pane-resize divider — use SplitResizeHandle (or CollapsibleSidebar) from @kenn-io/kit-ui";
```

- [ ] **Step 4: Run the checker test and verify GREEN**

Run: `bun test checks/rules.test.ts --test-name-pattern "splitter: pane-resize cursors"`

Expected: PASS.

- [ ] **Step 5: Write the failing browser test**

Create `tests/browser/split-resize-handle.spec.ts` with one test that:

```ts
import { expect, test } from "@playwright/test";
import { gotoPage } from "./helpers.js";

test("resizes horizontal and vertical panes on their active axes", async ({ page }) => {
  await gotoPage(page, "split-resize");

  const horizontal = page.getByRole("separator", { name: "Resize left pane" });
  await expect(horizontal).toHaveAttribute("aria-orientation", "vertical");
  await expect(horizontal).toHaveCSS("cursor", "col-resize");
  await horizontal.focus();
  await page.keyboard.press("ArrowRight");
  await expect(horizontal).toHaveAttribute("aria-valuenow", "224");
  await page.keyboard.press("ArrowDown");
  await expect(horizontal).toHaveAttribute("aria-valuenow", "224");

  const vertical = page.getByRole("separator", { name: "Resize top pane" });
  await expect(vertical).toHaveAttribute("aria-orientation", "horizontal");
  await expect(vertical).toHaveCSS("cursor", "row-resize");
  await vertical.focus();
  await page.keyboard.press("ArrowDown");
  await expect(vertical).toHaveAttribute("aria-valuenow", "112");
  await page.keyboard.press("ArrowRight");
  await expect(vertical).toHaveAttribute("aria-valuenow", "112");

  const box = await vertical.boundingBox();
  if (!box) throw new Error("Vertical split handle is not visible");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 24);
  await page.mouse.up();
  await expect(vertical).toHaveAttribute("aria-valuenow", "136");
});
```

- [ ] **Step 6: Run the browser test and verify RED**

Run: `bun run test:browser tests/browser/split-resize-handle.spec.ts`

Expected: FAIL because the current handle has no separator role, orientation contract, or vertical demo.

- [ ] **Step 7: Replace the resize event contract**

Set `src/lib/components/split-resize.ts` to:

```ts
export type SplitResizeOrientation = "horizontal" | "vertical";

export interface SplitResizeEvent {
  /** Pane layout direction. Horizontal panes resize on the x axis. */
  orientation: SplitResizeOrientation;
  /** Pixels moved from the start position on the active axis. */
  delta: number;
  /** Pointer position at resize start on the active axis. */
  start: number;
  /** Current pointer position on the active axis. */
  current: number;
  event: KeyboardEvent | PointerEvent;
}
```

- [ ] **Step 8: Implement the orientation-aware handle**

Update `SplitResizeHandle.svelte` so it:

- imports `SplitResizeOrientation`;
- defaults `orientation` to `"horizontal"`;
- reads `clientX` for horizontal and `clientY` for vertical;
- uses pointer events and pointer capture;
- emits axis-neutral resize events;
- accepts only Left/Right for horizontal and Up/Down for vertical;
- renders `role="separator"` with the physical separator ARIA orientation;
- binds optional separator values and native `disabled`;
- uses `kit-split-resize-handle--horizontal` and `--vertical` modifiers for 4px col-resize and row-resize handles.

Use the exact callback behavior in the approved design: pointer end and pointer cancel both call `onResizeEnd`, keyboard presses call start/resize/end atomically, and teardown removes every installed listener.

- [ ] **Step 9: Update consumers and the demo**

Change `CollapsibleSidebar` calculations from `event.deltaX` to `event.delta` and pass `orientation="horizontal"` explicitly.

Expand `SplitResizeHandleDemo.svelte` to render:

- a side-by-side sample starting at 200px, clamped to 120 through 400px;
- a stacked sample starting at 88px, clamped to 56 through 160px;
- matching `ariaValueMin`, `ariaValueMax`, and `ariaValueNow` values;
- `data-testid="horizontal-split"` and `data-testid="vertical-split"` hosts.

Export both `SplitResizeEvent` and `SplitResizeOrientation` from `src/lib/index.ts`.

- [ ] **Step 10: Update split-handle documentation**

Document both orientations, the axis-neutral event fields, pointer and keyboard behavior, disabled state, separator values, and the lack of compatibility aliases. Update checker docs from `col-resize` to `col-resize` or `row-resize`.

- [ ] **Step 11: Autofix and verify Task 1**

Run:

```bash
bun run svelte-mcp svelte-autofixer src/lib/components/SplitResizeHandle.svelte
bun run svelte-mcp svelte-autofixer src/demo/pages/SplitResizeHandleDemo.svelte
bun run check
bun test checks/rules.test.ts
bun run test:browser tests/browser/split-resize-handle.spec.ts
```

Expected: autofixer reports no remaining issues, Svelte check reports 0 errors and 0 warnings, unit tests pass, and the focused Playwright test passes.

- [ ] **Step 12: Commit Task 1**

Stage only Task 1 files and commit with subject `feat: support resizable stacked panes`. The body must explain why recursive layouts need one axis-neutral shared handle and include the required Codex attribution. Never use `--no-verify`.

---

### Task 2: Add the controlled inline BottomDock

**Files:**

- Create: `tests/browser/bottom-dock.spec.ts`
- Create: `src/lib/components/BottomDock.svelte`
- Create: `src/demo/pages/BottomDockDemo.svelte`
- Modify: `src/demo/App.svelte:16,83`
- Modify: `src/lib/index.ts:2`
- Modify: `checks/rules.test.ts:424`
- Modify: `checks/rules.mjs:507`
- Create: `docs/components/bottom-dock.md`
- Modify: `docs/checking.md:49,101,154`

**Interfaces:**

- Consumes: `SplitResizeHandle orientation="vertical"` and `SplitResizeEvent.delta`.
- Produces: `BottomDock` with controlled `open`, required `onclose`, required `ariaLabel`, CSS-length height props, header/body/footer snippets, and built-in `IconButton` close control.

- [ ] **Step 1: Write the failing BottomDock browser test**

Create a focused Playwright test that opens `#bottom-dock` and verifies:

```ts
const dock = page.getByRole("region", { name: "Review details" });
const separator = page.getByRole("separator", { name: "Review details" });
await expect(dock).toBeVisible();
await expect(dock).toHaveCSS("position", "static");
await expect(separator).toHaveAttribute("aria-orientation", "horizontal");
await expect(page.getByText("Review body item 20")).toBeAttached();
await expect(page.getByText("Ready to merge")).toBeVisible();
```

Then measure the dock, press ArrowUp and assert a 24px increase, press ArrowDown and assert the original height, press Escape and assert the dock remains visible, drag upward and assert growth, drag beyond both limits and assert 360px maximum and 180px minimum, verify the body has `scrollHeight > clientHeight`, click `Close panel`, assert the dock disappears, click `Open dock`, and assert the dock returns at its retained height.

- [ ] **Step 2: Run the browser test and verify RED**

Run: `bun run test:browser tests/browser/bottom-dock.spec.ts`

Expected: FAIL because the gallery page and component do not exist.

- [ ] **Step 3: Implement `BottomDock.svelte`**

Use this state and behavior:

```ts
let requestedHeight = $derived(initialHeight);
let measuredHeight = $state<number | undefined>();
let startHeight = 0;

const observeHeight: Attachment<HTMLElement> = (element) => {
  const update = () => {
    measuredHeight = Math.round(element.getBoundingClientRect().height);
  };
  update();
  const observer = new ResizeObserver(update);
  observer.observe(element);
  return () => observer.disconnect();
};

function handleResizeStart(): void {
  startHeight = measuredHeight ?? 0;
}

function handleResize(event: SplitResizeEvent): void {
  requestedHeight = `${Math.max(0, startHeight - event.delta)}px`;
}
```

The prop defaults must match the approved spec. When `open` is true, render a named `<section>` with:

- `style:height={requestedHeight}`;
- `style:min-height={minHeight}`;
- `style:max-height={maxHeight}`;
- the `ResizeObserver` attachment;
- a top vertical `SplitResizeHandle` using `ariaLabel`, `keyboardStep`, and `ariaValueNow={measuredHeight}`;
- an optional header wrapper with caller content and the built-in `IconButton` containing the Lucide X icon;
- a flexible scrollable body;
- an optional footer wrapper.

Use scoped `kit-bottom-dock` BEM classes. The surface uses `--bg-surface`, `--border-default`, `--border-muted`, the spacing ladder, and no shadow. Do not style private classes of `IconButton`, `SegmentedControl`, or `Button`.

- [ ] **Step 4: Add the gallery page and public export**

Create a 520px-tall inline host with surrounding workspace content and:

```svelte
<BottomDock
  {open}
  ariaLabel="Review details"
  initialHeight="260px"
  minHeight="180px"
  maxHeight="360px"
  onclose={() => (open = false)}
>
```

The header snippet uses shared `SegmentedControl` for Review, Log, and Prompt. The body renders 20 numbered rows so scrolling is observable. The footer uses shared `Button` controls and contains the text `Ready to merge`. An `Open dock` shared Button remains outside the dock. Register the page as `bottom-dock` in `App.svelte` and export `BottomDock` from `src/lib/index.ts`.

- [ ] **Step 5: Run the BottomDock browser test and verify GREEN**

Run: `bun run test:browser tests/browser/bottom-dock.spec.ts`

Expected: PASS.

- [ ] **Step 6: Write the failing drawer-guidance assertion**

Extend the existing drawer checker test with:

```ts
expect(findings[0]!.message).toContain("BottomDock");
```

- [ ] **Step 7: Run the drawer checker test and verify RED**

Run: `bun test checks/rules.test.ts --test-name-pattern "drawer: bare class and compounds"`

Expected: FAIL because the message only recommends `DetailDrawer`.

- [ ] **Step 8: Update checker guidance and docs**

Change the drawer message to:

```js
"drawer markup — use DetailDrawer for overlay side sheets or BottomDock for inline bottom panels from @kenn-io/kit-ui";
```

Document `BottomDock` as a `hand-rolled-drawer` replacement for inline panels, add it to the component enforcement matrix and migration ordering, and create `docs/components/bottom-dock.md` with the full prop table, snippets, resizing direction, CSS-length constraints, controlled-open example, and explicit statement that Escape belongs to the parent application.

- [ ] **Step 9: Autofix and verify Task 2**

Run:

```bash
bun run svelte-mcp svelte-autofixer src/lib/components/BottomDock.svelte
bun run svelte-mcp svelte-autofixer src/demo/pages/BottomDockDemo.svelte
bun run check
bun test checks/rules.test.ts
bun run check:usage
bun run build
bun run test:browser tests/browser/bottom-dock.spec.ts tests/browser/split-resize-handle.spec.ts
```

Expected: autofixer reports no remaining issues, Svelte check reports 0 errors and 0 warnings, checker tests pass, usage checker is clean, demo build succeeds, and both focused browser specs pass.

- [ ] **Step 10: Commit Task 2**

Stage only Task 2 files plus the implementation plan and commit with subject `feat: add a resizable inline bottom dock`. The body must explain why inline panels cannot reuse modal drawer behavior and include the required Codex attribution. Never use `--no-verify`.

---

### Task 3: Full verification, kata evidence, and pull request

**Files:**

- Verify all changed files.
- Update kata tasks `jvxt` and `ba3w` only after implementation evidence exists.

- [ ] **Step 1: Run formatting and lint checks**

Run:

```bash
bun run fmt
bun run fmt:check
bun run lint
```

Expected: formatter makes only mechanical changes in scoped files, format check is clean, and lint exits 0.

- [ ] **Step 2: Run the complete verification suite**

Run:

```bash
bun run check
bun test
bun run check:usage
bun run build
bun run test:browser
```

Expected: 0 Svelte errors and warnings, all unit tests pass, usage checker reports no findings, build exits 0, and all Playwright tests pass.

- [ ] **Step 3: Commit formatter-only changes if needed**

If formatting changed tracked files after Task 2, inspect the diff, stage only relevant files, and commit `style: format bottom dock components` with the required Codex attribution. If no files changed, do not create an empty commit.

- [ ] **Step 4: Close kata tasks with typed evidence**

Close `jvxt` with the commit that implements orientation support and a substantive message summarizing active-axis pointer and keyboard verification. Close `ba3w` with the commit that adds `BottomDock` and a substantive message summarizing inline layout, controlled close, bounds, scrolling, and Escape verification. Use `--commit <sha>` and do not batch them into one generic close.

- [ ] **Step 5: Push and create the PR**

Push the current feature branch to origin. Create a PR whose body leads with why Middleman needs a shared inline dock distinct from `DetailDrawer`, summarizes both public contracts, lists complete validation, and notes that downstream Middleman migration is intentionally out of scope. Every GitHub comment or PR body written by the agent must end with:

```html
<sup>generated by a clanker</sup>
```

- [ ] **Step 6: Refine the PR using available GitHub feedback**

The literal `$refine-pr` skill is unavailable and does not authorize local roborev. Monitor GitHub checks and existing review comments. Use the GitHub CI and review-comment workflows if failures or actionable comments appear. Do not delete, resolve, hide, or minimize any comments or threads. Implement fixes, verify, commit, and push until checks pass and no actionable unresolved feedback remains.

- [ ] **Step 7: Report merge safety with fresh evidence**

Re-read the PR checks and review state after the final push. Report the PR as safe to merge only if required checks pass, the local full verification remains current for the final commit, and no actionable requested changes remain. Otherwise report the exact blockers.
