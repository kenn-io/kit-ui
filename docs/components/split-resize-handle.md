# SplitResizeHandle

Keyboard-accessible pane divider from middleman. It owns no layout — it
reports horizontal deltas (mouse drag, or arrow keys in `keyboardStep`
increments) and the panes apply/clamp them. `CollapsibleSidebar` uses it
internally; reach for it directly when building custom split layouts.

```svelte
<script lang="ts">
  import { SplitResizeHandle, type SplitResizeEvent } from "@kenn-io/kit-ui";

  let committed = $state(280);
  let drag = $state<number | null>(null);
  let startWidth = 0;
  const width = $derived(drag ?? committed);

  const clamp = (e: SplitResizeEvent) =>
    Math.max(200, Math.min(600, startWidth + e.deltaX));
</script>

<div class="split">
  <div class="pane" style:width="{width}px">…</div>
  <SplitResizeHandle
    ariaLabel="Resize left pane"
    onResizeStart={() => (startWidth = width)}
    onResize={(e) => (drag = clamp(e))}
    onResizeEnd={(e) => { committed = clamp(e); drag = null; }}
  />
  <div class="pane pane--rest">…</div>
</div>
```

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `ariaLabel` | `string` | required | e.g. "Resize sidebar" |
| `keyboardStep` | `number` | `24` | Pixels per arrow-key press |
| `onResizeStart` | `(event) => void` | — | Snapshot the starting width here |
| `onResize` | `(event: SplitResizeEvent) => void` | — | Fires on every mousemove; apply as transient width |
| `onResizeEnd` | `(event: SplitResizeEvent) => void` | — | Commit/persist the final width |
| `class` | `string` | `""` | |

`SplitResizeEvent` carries `deltaX`, `startX`, `currentX`, and the raw `event`.
Keyboard presses fire start/resize/end as one atomic step.
