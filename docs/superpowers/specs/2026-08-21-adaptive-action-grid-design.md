# Adaptive action grid design

## Goal

Add a mobile-friendly container for a dense set of controls. It presents the
controls as one toolbar-like row when they fit, changes to an equal-track grid
at intermediate widths, and folds into an inline disclosure when the container
gets narrow.

The component must accept real controls, not only command records. A
three-state `SegmentedControl`, a filter dropdown, and a plain `Button` can sit
next to each other without the action grid taking ownership of their values,
keyboard behavior, or open state.

The accompanying [research note](2026-08-21-responsive-action-grid-research.md)
compares WAI-ARIA guidance with React Spectrum, Material, Fluent, Carbon, and
Radix.

## Product scene

An operator moves between a wide desktop report and the same report in a
resizable side panel or on a phone. They need the filters and actions close to
the data, but a four-row wall of controls should not push the report off the
screen.

This is a product control in kit-ui's Workbench register. It uses the existing
surface, border, type, focus, spacing, and motion tokens. It adds no palette
colors and no decorative elevation.

## Decision

Call the component `AdaptiveActionGrid`.

It has three presentation modes:

| Mode      | Entry condition                                             | Presentation                                                     |
| --------- | ----------------------------------------------------------- | ---------------------------------------------------------------- |
| `row`     | Every item fits on one line                                 | One horizontal strip at each item's natural width                |
| `grid`    | The row wraps and the host is at least `collapseBelow` wide | Equal responsive tracks inside the same frame                    |
| `compact` | The row wraps and the host is narrower than `collapseBelow` | One disclosure trigger; the same grid appears below it when open |

The compact check applies only after the natural row stops fitting. A short
three-button group can therefore remain a row in a narrow container, while a
dense filter bar collapses. The default `collapseBelow` is 640 CSS pixels, the
shared compact breakpoint, but it measures the component rather than the
viewport.

The component renders each item snippet once. It changes layout around that
subtree and never mounts hidden copies. This is the main reason not to build it
from `FitStages`: `FitStages` intentionally mounts probe copies and documents
that stateful widgets, effects, named form controls, and hand-written IDs do
not belong in its stages.

## Public contract

```ts
export type AdaptiveActionGridMode = "row" | "grid" | "compact";
export type AdaptiveActionGridFrame = "none" | "outline";
export type AdaptiveActionGridRadius = "none" | "sm" | "md" | "lg" | "pill";
export type AdaptiveActionGridSpace = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

interface Props {
  /** Atomic top-level controls, in visual and keyboard order. */
  items: Snippet[];
  /** Accessible name for the complete control group. */
  ariaLabel: string;
  /** Visible compact trigger label. Defaults to ariaLabel. */
  compactLabel?: string;
  /** Optional non-interactive state summary inside the compact trigger. */
  summary?: Snippet;
  /** Compact disclosure state. Bindable; defaults to false. */
  open?: boolean;
  onopenchange?: (open: boolean) => void;
  /** Current measured presentation. Bindable, read-only in spirit. */
  mode?: AdaptiveActionGridMode;
  onmodechange?: (mode: AdaptiveActionGridMode) => void;
  /** Host width below which a wrapping row becomes compact. */
  collapseBelow?: number;
  /** Minimum grid track width in CSS pixels. */
  minTrackWidth?: number;
  /** Outer background and border treatment. */
  frame?: AdaptiveActionGridFrame;
  /** Outer frame radius. */
  radius?: AdaptiveActionGridRadius;
  /** Radius inherited by kit controls rendered as items. */
  itemRadius?: AdaptiveActionGridRadius;
  /** Spacing-ladder step between grid rows. */
  rowGap?: AdaptiveActionGridSpace;
  /** Spacing-ladder step between columns. */
  columnGap?: AdaptiveActionGridSpace;
  /** Spacing-ladder step between the frame and its items. */
  padding?: AdaptiveActionGridSpace;
  class?: string;
}
```

Defaults are `compactLabel={ariaLabel}`, `open={false}`, `mode="row"`,
`collapseBelow={640}`, `minTrackWidth={200}`, `frame="outline"`,
`radius="md"`, `itemRadius="sm"`, `rowGap={3}`, `columnGap={3}`, and `padding={2}`.
Invalid numeric measurement values fall back to their defaults.

`summary` may render text, an icon, or a count such as "3 filters active". It
must not contain a button, link, input, or other interactive descendant because
the component renders it inside the disclosure button.

## Composition

Each snippet is one packing unit. The grid may move that unit to another track,
but never splits its internal controls. Related buttons that must remain
together should be wrapped in a named `role="group"`; an existing compound
control such as `SegmentedControl` already supplies its own wrapper and
semantics.

```svelte
<script lang="ts">
  import {
    AdaptiveActionGrid,
    Button,
    FilterDropdown,
    SegmentedControl,
    type AdaptiveActionGridMode,
  } from "@kenn-io/kit-ui";

  let view = $state("all");
  let open = $state(false);
  let layout = $state<AdaptiveActionGridMode>("row");
</script>

{#snippet viewSelector()}
  <SegmentedControl
    options={[
      { value: "all", label: "All" },
      { value: "open", label: "Open" },
      { value: "closed", label: "Closed" },
    ]}
    value={view}
    onchange={(next) => (view = next)}
    ariaLabel="Result state"
    block={layout !== "row"}
  />
{/snippet}

{#snippet projectFilter()}
  <FilterDropdown label="Project" items={projects} />
{/snippet}

{#snippet refreshAction()}
  <Button label="Refresh" onclick={refresh} />
{/snippet}

{#snippet activeSummary()}
  <span>{activeFilterCount} active</span>
{/snippet}

<AdaptiveActionGrid
  items={[viewSelector, projectFilter, refreshAction]}
  ariaLabel="Result controls"
  compactLabel="Filters and actions"
  summary={activeSummary}
  bind:open
  bind:mode={layout}
/>
```

State stays above the layout container. Switching modes changes
`SegmentedControl`'s `block` presentation, but it does not replace the selector
or reset `view`.

## Layout and measurement

The host uses `ResizeObserver` on itself and its item wrappers. Measurement
uses the real item subtree:

1. Apply a temporary internal no-wrap row layout.
2. Compare the item region's `scrollWidth` with its `clientWidth`.
3. If the row fits, choose `row`.
4. If the row overflows and the host is narrower than `collapseBelow`, choose
   `compact`.
5. Otherwise choose `grid`.

The measuring layout changes CSS only. It does not clone, detach, or remount
the items. A mode callback fires only when the selected mode changes, which
prevents a ResizeObserver feedback loop from producing duplicate events.

`grid` and the open compact panel use:

```css
grid-template-columns: repeat(auto-fit, minmax(min(100%, var(--kit-action-grid-track)), 1fr));
```

Items remain in DOM order. The component must not use CSS `order`, dense grid
packing, or column-first flow because visual order and Tab order would then
diverge.

In closed compact mode, the item region stays mounted and measurable but is
clipped to zero block size, invisible, and `inert`. Opening removes those
restrictions and places the grid directly below the trigger in document flow.

## Focus and disclosure behavior

- The outer container is `role="group"` with `aria-label={ariaLabel}`. Native
  Tab order and each nested control's keyboard behavior remain unchanged.
- The first version does not offer `role="toolbar"`. A horizontal toolbar
  owns Left and Right Arrow navigation, which conflicts with the existing
  horizontal radio-group behavior in `SegmentedControl`.
- The compact trigger is a native button with visible text,
  `aria-expanded={open}`, and `aria-controls` pointing to the persistent item
  region.
- Enter and Space use native button behavior. Escape does nothing because an
  inline disclosure is not a modal or popover.
- If resize enters compact mode while focus is inside an item, the component
  opens the disclosure before making the region inert. It never hides the
  focused element.
- If resize leaves compact mode while the trigger has focus, focus moves to
  the first enabled focusable item. If no item is focusable, it moves to the
  named group container.
- If external state closes the disclosure while focus is inside it, focus
  returns to the trigger before the region becomes inert.

## Visual treatment

The action grid is one low-profile frame, not a card inside a card.

- The row and grid share `--bg-surface` and a one-pixel `--border-default`
  edge by default. `frame="none"` removes both for controls that should sit
  directly on their parent. The geometry defaults use `--radius-md`,
  `--space-3` gaps, and `--space-2` padding.
- `radius`, `itemRadius`, `rowGap`, `columnGap`, and `padding` expose the
  component's geometry. Spacing values use steps 0 through 8, where 1 through
  8 map to the matching `--space-*` token.
- Setting both gaps and padding to 0, with `itemRadius="none"`, makes one
  joined grid. The outer frame clips the square child controls to its own
  radius, so a compact mobile group reads as one control instead of a block of
  separate cards.
- The compact trigger spans the frame width. Its label uses the normal control
  weight, its optional summary uses `--text-muted`, and a trailing Lucide
  chevron rotates with `transform` over `--transition-fast`.
- The panel reveal has no height animation. It appears on the next frame, so
  the control stays quick and avoids animating layout properties.
- The trigger has a 48px minimum target on coarse pointers. Mixed kit controls
  inherit one 28px desktop height or 32px touch-type height, plus the
  `--font-size-md` text scale. Equal grid tracks also normalize their resting
  border, fill, and alignment. Explicit size variants keep their own metrics.
  Custom items must meet WCAG's 24 by 24 CSS pixel minimum. Grid gaps preserve
  separation between adjacent targets.
- Focus uses the shared real outline. Disabled appearance remains the child
  control's responsibility.

The component reads only existing theme tokens. Alternate kit-ui identities
change its surface, border, radius, focus, and motion through those tokens.

## Existing consumer fit

The design covers the current app patterns without adding app knowledge:

- Agentsview Activity and Usage currently hand-roll wrapping flex toolbars.
  Their filters become atomic items and gain the compact disclosure stage.
- Agentsview Recall currently changes a five-column grid to two columns and
  then one column at viewport media queries. The action grid makes that
  decision from the panel's own width.
- Agentsview Analytics currently keeps a non-wrapping strip. Its range picker,
  refresh control, model filter, and export action can use row, grid, and
  compact modes without changing their data APIs.

Migration of those consumers is not part of the first kit-ui implementation.
They are validation cases for the component contract.

## Scope

The first implementation includes the component, exported mode type, demo,
component reference, browser coverage, and a checker rule for repeated
row-to-grid-to-disclosure toolbar markup if a reliable low-noise signature can
be found.

It does not include:

- an overflow menu that converts commands to `menuitem` records;
- a popover presentation;
- item priority or partial overflow where some actions remain outside;
- reordering, drag and drop, or masonry packing;
- a true ARIA toolbar with roving tabindex;
- application migrations.

## Verification plan

Browser coverage should verify:

- a natural one-line set remains in `row` mode;
- reducing width or adding longer localized labels moves `row` to `grid` by
  content fit;
- a wrapping host below 640px enters `compact`, while a short row that still
  fits does not collapse;
- opening compact mode reveals the same item elements, not replacements;
- a three-state `SegmentedControl` keeps its value and Left or Right Arrow
  behavior in every mode;
- focus stays visible when resize enters or leaves compact mode;
- externally closing an open disclosure returns focus to its trigger;
- item DOM order matches visual and Tab order;
- the compact trigger has the expected coarse-pointer target size;
- zero-gap geometry produces touching tracks with square item corners inside
  one clipped outer frame;
- light, dark, high-contrast, touch type, and reduced-motion settings retain
  usable geometry.

The non-trivial Svelte component should pass the Svelte autofixer, format,
lint, `svelte-check`, usage checking, the demo build, unit tests, and focused
browser tests before the implementation is called complete.
