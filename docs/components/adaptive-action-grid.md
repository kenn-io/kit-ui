# AdaptiveActionGrid

Responsive container for mixed actions and controls. It keeps a natural-width
row while every item fits, changes to equal grid tracks when that row
overflows, and uses an inline disclosure when the overflowing container is
narrower than `collapseBelow`.

Each item snippet renders once. Stateful children such as
`SegmentedControl`, `FilterDropdown`, and inputs keep their DOM, value, and
focus behavior while the layout changes.

```svelte
<script lang="ts">
  import { AdaptiveActionGrid, Button, SegmentedControl } from "@kenn-io/kit-ui";

  let state = $state("all");
</script>

{#snippet stateSelector()}
  <SegmentedControl
    options={[
      { value: "all", label: "All" },
      { value: "open", label: "Open" },
      { value: "closed", label: "Closed" },
    ]}
    value={state}
    onchange={(next) => (state = next)}
    ariaLabel="Result state"
  />
{/snippet}

{#snippet refreshAction()}
  <Button label="Refresh" onclick={refresh} />
{/snippet}

<AdaptiveActionGrid
  items={[
    { id: "state", content: stateSelector },
    { id: "refresh", content: refreshAction },
  ]}
  ariaLabel="Result controls"
  compactLabel="Filters and actions"
/>
```

## Props

| Prop            | Type                                        | Default      | Notes                                                                               |
| --------------- | ------------------------------------------- | ------------ | ----------------------------------------------------------------------------------- |
| `items`         | `AdaptiveActionGridItem[]`                  | required     | Atomic controls with stable unique IDs, in visual and keyboard order                |
| `ariaLabel`     | `string`                                    | required     | Names the outer `role="group"`                                                      |
| `compactLabel`  | `string`                                    | `ariaLabel`  | Visible disclosure label                                                            |
| `summary`       | `Snippet`                                   | none         | Optional text, icon, or count in the disclosure trigger; must not be interactive    |
| `open`          | `boolean` (bindable)                        | `false`      | Compact disclosure state                                                            |
| `onopenchange`  | `(open: boolean) => void`                   | none         | Fires for component-owned disclosure changes                                        |
| `onmodechange`  | `(mode) => void`                            | none         | Observes measured mode changes; callers cannot set the mode or resize items from it |
| `layout`        | `"adaptive" \| "fill"`                      | `"adaptive"` | `fill` packs rows by natural width and stretches each row to span the container     |
| `collapseBelow` | `number`                                    | `640`        | Component width in CSS pixels; compact mode still requires row overflow             |
| `minTrackWidth` | `number`                                    | `200`        | Minimum equal grid-track width in CSS pixels                                        |
| `frame`         | `"none" \| "outline"`                       | `"outline"`  | Removes or draws the outer background and border                                    |
| `radius`        | `"none" \| "sm" \| "md" \| "lg" \| "pill"`  | `"md"`       | Outer frame radius; named values follow theme radius tokens                         |
| `itemRadius`    | same radius type                            | `"sm"`       | Corner radius inherited by kit control items                                        |
| `rowGap`        | `0 \| 1 \| 2 \| 3 \| 4 \| 5 \| 6 \| 7 \| 8` | `3`          | Spacing-ladder step between rows                                                    |
| `columnGap`     | `0 \| 1 \| 2 \| 3 \| 4 \| 5 \| 6 \| 7 \| 8` | `3`          | Spacing-ladder step between columns                                                 |
| `padding`       | `0 \| 1 \| 2 \| 3 \| 4 \| 5 \| 6 \| 7 \| 8` | `2`          | Spacing-ladder step inside the frame                                                |
| `class`         | `string`                                    | `""`         | Additional class on the outer group                                                 |

Each item has an `id` and a `content` snippet. IDs must be unique and stable
while the item remains the same logical control. This lets the grid preserve
the correct DOM node when callers insert, remove, or reorder items, even when
two entries intentionally render the same snippet.

`onmodechange` is an observational callback for status or analytics. Do not use
it to change item labels, padding, or other intrinsic dimensions according to
the reported mode: that creates a measurement feedback loop. The grid stretches
supported kit controls, including `SegmentedControl`, without caller-managed
presentation changes. Content changes that are independent of the measured mode
still trigger normal remeasurement.

## Geometry

The frame, radius, and spacing props are the public shape controls. Use
`frame="none"` with `padding={0}` when the items should sit directly on their
parent surface without an extra container edge. Steps `1` through `8` map to
`--space-1` through `--space-8`; `0` is a supported value rather than a
special-case workaround.

```svelte
<AdaptiveActionGrid {items} ariaLabel="Actions" frame="none" padding={0} />
```

Use this preset for a joined mobile grid:

```svelte
<AdaptiveActionGrid
  {items}
  ariaLabel="Date range"
  radius="md"
  itemRadius="none"
  rowGap={0}
  columnGap={0}
  padding={0}
/>
```

With no gaps or padding, the outer frame clips square item corners into one
rounded control slab. This avoids the repeated-card look while keeping every
button a separate native control. Focus rings move inside the joined slab so
the clip does not hide them.

`itemRadius` sets the inherited `--kit-control-radius` property. `Button`,
`IconButton`, `SegmentedControl`, `FilterDropdown`, and `SelectDropdown`
honor it. A custom item may read the same property:

```css
.my-control {
  border-radius: var(--kit-control-radius, var(--radius-sm));
}
```

Mixed kit controls inherit a shared 28px desktop height and 32px touch-type
height, plus the `--font-size-md` text scale. In grid and compact modes, their
resting borders, fills, and alignment also match so equal tracks read as one
control group. Explicit variants such as `Button size="sm"` keep their own size.
These inherited control-context properties are documented in the
[theming guide](../theming.md#control-context).

`minTrackWidth` is the preferred lower bound for equal tracks. The grid reduces
to fewer columns as its container narrows, and the `min(100%, ...)` bound keeps
one track inside the container when even that preferred width does not fit.
Tracks do not expand for a wider child. Kit controls keep their single-line
labels inside the assigned track and truncate where needed. Custom controls
must define their own wrapping or truncation and must not rely on intrinsic
width to widen a track.

## Filled layout

`layout="fill"` is for a persistent full-width control such as a phone
action bar. Items pack into rows by their natural width, in order, and each
row's items then grow to span the container. Every row is laid out on its
own: the first row may hold three buttons and the second one, and nothing
lines up in columns. An item's minimum is its content width, so labels never
truncate, and leftover width in a row is shared equally between its items.
`minTrackWidth` does not apply.

The compact disclosure still applies when the items overflow a single row
below `collapseBelow`; pass `collapseBelow={0}` to disable it. The reported
mode is `grid` while filled.

```svelte
<AdaptiveActionGrid
  {items}
  ariaLabel="Pull request actions"
  layout="fill"
  collapseBelow={0}
  frame="none"
  padding={0}
  rowGap={2}
  columnGap={2}
/>
```

## Responsive behavior

The component measures its own box, not the viewport. This matters inside
resizable sidebars, drawers, cards, and split panes.

1. It briefly measures the mounted items as one no-wrap row.
2. If the row fits, `mode` is `row` at any width.
3. If it overflows at or above `collapseBelow`, `mode` is `grid`.
4. If it overflows below `collapseBelow`, `mode` is `compact`.

The grid repeats that intrinsic measurement when item text, markup, identity,
geometry, inherited ancestor styles, or loaded fonts change. Content can
therefore move an existing grid or compact layout back to a row without a
container resize. Measurement changes CSS on the mounted subtree only; it never
clones or remounts a control.

The compact panel is an inline disclosure, not a menu or popover. Its native
button exposes `aria-expanded` and `aria-controls`; opening reveals the
original item region directly below it.

When resize enters compact mode while an item owns focus, the disclosure opens
instead of hiding that item. If externally bound state closes the panel while
focus is inside, focus returns to the trigger first.

If native form validation fails for a control inside a closed compact panel,
the disclosure opens before the browser focuses the invalid control. Required
inputs therefore remain visible and reachable when submission is blocked.

## Accessibility

The outer container uses `role="group"` and normal Tab order. It deliberately
does not use `role="toolbar"`: a horizontal ARIA toolbar owns Left and Right
Arrow, while the existing horizontal radio group in `SegmentedControl` uses
the same keys. Each nested control therefore retains its normal keyboard
contract.

The compact disclosure trigger grows to a 48px minimum target on coarse
pointers. Nested kit controls use the library's 32px touch control height.
Custom item controls remain responsible for meeting the 24 by 24 CSS pixel
WCAG minimum.

## Choosing between layout components

- Use `AdaptiveActionGrid` for one persistent set of stateful controls that
  changes layout.
- Use `FitStages` for separate, stateless renderings of the same action set,
  such as text buttons, short labels, and icons.
- Use `ChipStack` when the data model is a repeated list and a `+N` item count
  is the right compact affordance.
