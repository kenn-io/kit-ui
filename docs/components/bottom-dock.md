# BottomDock

Controlled inline bottom panel for detail, log, terminal, and review surfaces.
Unlike `DetailDrawer`, it occupies layout space and does not render an overlay,
trap focus, lock body scrolling, or listen for Escape.

```svelte
<script lang="ts">
  import { BottomDock, Button, SegmentedControl } from "@kenn-io/kit-ui";

  let open = $state(true);
  let tab = $state("review");
  const tabs = [
    { value: "review", label: "Review" },
    { value: "log", label: "Log" },
    { value: "prompt", label: "Prompt" },
  ];
</script>

<div class="workspace">
  <main>…</main>
  <BottomDock
    {open}
    ariaLabel="Review details"
    initialHeight="50vh"
    minHeight="200px"
    maxHeight="80vh"
    onclose={() => (open = false)}
  >
    {#snippet header()}
      <SegmentedControl
        options={tabs}
        value={tab}
        onchange={(value) => (tab = value)}
        ariaLabel="Review detail view"
      />
    {/snippet}

    <section>Scrollable detail content</section>

    {#snippet footer()}
      <Button size="sm" label="Rerun" />
    {/snippet}
  </BottomDock>
</div>
```

The resize handle sits on the panel's top edge. Dragging upward or pressing
ArrowUp increases the dock height; dragging downward or pressing ArrowDown
decreases it. The component accepts CSS lengths for its initial, minimum, and
maximum heights, so full-page and container-sized hosts can use the same
contract. CSS enforces the limits, while `aria-valuenow` reports the rendered
pixel height. `BottomDock` resolves valid CSS length-percentage expressions,
including `%`, viewport units, CSS variables, and `calc()`, through its live
layout box. The resulting minimum and maximum are exposed through
`aria-valuemin` and `aria-valuemax`, keeping all separator range values in the
same pixel unit. Bounds refresh when the props, containing block, viewport, or
ancestor class/style/theme context changes without requiring the dock itself to
resize. Percentage-based limits require a definite block-axis size in the CSS
containing block; use absolute or viewport units when the host height is
content-sized.

`open` is controlled. The built-in close `IconButton` calls `onclose`; the
parent changes `open`. Closing and reopening the same component instance keeps
its most recently requested height.

## Uncontrolled vs. controlled height

By default the dock owns its own height: `initialHeight` seeds it, and
pointer or keyboard resizes update it internally. A prop change to
`initialHeight` replaces any local resize override.

Pass `height` to make the parent own the value instead — the dock always
renders exactly what `height` says, regardless of prior resizes, and updates
whenever the parent updates the prop. In that mode, user resizes no longer
apply themselves: every pointer or keyboard resize instead calls
`onHeightChange` with the requested CSS height string, and the dock's
rendered height stays at `height` until the parent passes the new value back
(after persisting it, clamping it, or otherwise deciding to accept it).
`onHeightChange` fires in both modes; only the self-apply behavior differs.
It fires once per height change — consecutive duplicate values (for example
the repeated report a pointer-up delivers immediately after the last
pointer-move at the same position) are not re-reported.

```svelte
<script lang="ts">
  let height = $state("320px");
</script>

<BottomDock
  {open}
  ariaLabel="Review details"
  {height}
  onHeightChange={(next) => (height = next)}
  onclose={() => (open = false)}
>
  ...
</BottomDock>
```

## Props

| Prop             | Type                       | Default         | Notes                                                         |
| ---------------- | -------------------------- | --------------- | ------------------------------------------------------------- |
| `open`           | `boolean`                  | required        | Controls whether the inline panel renders                     |
| `onclose`        | `() => void`               | required        | Called by the built-in close control                          |
| `ariaLabel`      | `string`                   | required        | Names both the dock region and its resize separator           |
| `initialHeight`  | `string`                   | `"50vh"`        | Uncontrolled seed height; prop changes replace local override |
| `height`         | `string`                   | —               | Controlled height; wins over internal state when provided     |
| `onHeightChange` | `(height: string) => void` | —               | Called with the requested CSS height after every user resize  |
| `minHeight`      | `string`                   | `"200px"`       | Valid CSS length-percentage minimum                           |
| `maxHeight`      | `string`                   | `"80vh"`        | Valid CSS length-percentage maximum                           |
| `keyboardStep`   | `number`                   | `24`            | Pixels per Up/Down key press                                  |
| `closable`       | `boolean`                  | `true`          | Renders the shared close `IconButton`                         |
| `closeTitle`     | `string`                   | `"Close panel"` | Close-button tooltip                                          |
| `closeAriaLabel` | `string`                   | `"Close panel"` | Close-button accessible name                                  |
| `class`          | `string`                   | `""`            | Additional class on the dock region                           |
| `header`         | `Snippet`                  | —               | Header content before the close button                        |
| `children`       | `Snippet`                  | —               | Flexible, vertically scrollable body                          |
| `footer`         | `Snippet`                  | —               | Pinned footer content                                         |

## Escape ownership

`BottomDock` deliberately does not close on Escape. Inline panels commonly sit
inside application shortcut scopes or modal workflows, so the parent owns
keyboard dismissal priority. If Escape should close the dock, handle it at the
application layer after checking for higher-priority modal state.
