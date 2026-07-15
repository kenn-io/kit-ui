# SplitResizeHandle

Keyboard-accessible pane divider from middleman. It owns no layout; it reports
deltas along the active axis and the panes apply and clamp them. The default
`horizontal` orientation is for side-by-side panes; use `vertical` for stacked
panes.

```svelte
<script lang="ts">
  import { SplitResizeHandle, type SplitResizeEvent } from "@kenn-io/kit-ui";

  let committed = $state(280);
  let drag = $state<number | null>(null);
  let startWidth = 0;
  const width = $derived(drag ?? committed);

  const clamp = (event: SplitResizeEvent) => Math.max(200, Math.min(600, startWidth + event.delta));
</script>

<div class="split">
  <div class="pane" style:width="{width}px">…</div>
  <SplitResizeHandle
    ariaLabel="Resize left pane"
    orientation="horizontal"
    ariaValueMin={200}
    ariaValueMax={600}
    ariaValueNow={width}
    onResizeStart={() => (startWidth = width)}
    onResize={(event) => (drag = clamp(event))}
    onResizeEnd={(event) => {
      committed = clamp(event);
      drag = null;
    }}
  />
  <div class="pane pane--rest">…</div>
</div>
```

## Props

| Prop            | Type                                | Default        | Notes                                        |
| --------------- | ----------------------------------- | -------------- | -------------------------------------------- |
| `ariaLabel`     | `string`                            | required       | e.g. "Resize sidebar"                        |
| `orientation`   | `"horizontal" \| "vertical"`        | `"horizontal"` | Pane layout direction and active resize axis |
| `keyboardStep`  | `number`                            | `24`           | Pixels per matching arrow-key press          |
| `disabled`      | `boolean`                           | `false`        | Disables pointer and keyboard resizing       |
| `ariaValueMin`  | `number`                            | —              | Optional separator minimum value             |
| `ariaValueMax`  | `number`                            | —              | Optional separator maximum value             |
| `ariaValueNow`  | `number`                            | —              | Optional current separator value             |
| `onResizeStart` | `(event) => void`                   | —              | Snapshot the starting dimension here         |
| `onResize`      | `(event: SplitResizeEvent) => void` | —              | Fires on every pointer move or keyboard step |
| `onResizeEnd`   | `(event: SplitResizeEvent) => void` | —              | Commit and persist the final dimension       |
| `class`         | `string`                            | `""`           |                                              |

`SplitResizeEvent` carries `orientation`, `delta`, `start`, `current`, and the
raw pointer or keyboard `event`. Horizontal handles use Left/Right; vertical
handles use Up/Down. Keyboard presses fire start/resize/end as one atomic step.
