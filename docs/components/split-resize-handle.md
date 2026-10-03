---
title: SplitResizeHandle
description: Keyboard-accessible pane divider reporting horizontal or vertical resize deltas.
last_edited: 2026-10-02
---

# SplitResizeHandle

Keyboard-accessible pane divider from Forge. It owns no layout; it reports
deltas along the active axis and the panes apply and clamp them. The default
`horizontal` orientation is for side-by-side panes; use `vertical` for stacked
panes.

## One thickness everywhere

Every handle in every app is `--split-handle-size` thick (4px), in both
orientations. The value lives in `src/lib/brand.json` (`layout.splitHandleSize`)
and nowhere else. Apps cannot change it:

- The component has no `class` prop, and its thickness is `!important`.
- `kit-ui-check` reports any app CSS that sizes, colors, borders, pads, or adds
  pseudo-elements to `.kit-split-resize-handle`, and any app assignment to
  `--split-handle-size` (`split-handle-override`). The rule ignores
  `kit-ui-check-ignore` and cannot be passed to `--disable`.
- Panes next to a handle must not draw a border on that edge; the handle is
  the divider.

Apps may still place a handle: `display`, `visibility`, `position`, `inset`
and its longhands, `z-index`, `order`, grid placement, self-alignment, and
`-webkit-app-region` are allowed. Hide a handle responsively from a wrapper
selector such as `.layout :global(.kit-split-resize-handle) { display: none; }`.
Read the token, for example to reserve room for an absolutely positioned
handle, with `var(--split-handle-size)`.

The handle's pointer target extends 2px past each edge of the visible line, so
it is easy to grab without looking thicker.

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
| `ariaValueMin`  | `number`                            | required       | Separator minimum value                      |
| `ariaValueMax`  | `number`                            | required       | Separator maximum value                      |
| `ariaValueNow`  | `number`                            | required       | Current separator value                      |
| `onResizeStart` | `(event) => void`                   | —              | Snapshot the starting dimension here         |
| `onResize`      | `(event: SplitResizeEvent) => void` | —              | Fires on every pointer move or keyboard step |
| `onResizeEnd`   | `(event: SplitResizeEvent) => void` | —              | Commit and persist the final dimension       |

`SplitResizeEvent` carries `orientation`, `delta`, `start`, `current`, and the
raw pointer or keyboard `event`. Horizontal handles use Left/Right; vertical
handles use Up/Down. The handle accepts one active pointer at a time. Pointer
cancellation or unexpected capture loss commits the most recent resize sample,
so consumers do not jump to an interruption coordinate. If interruption occurs
before the first move, `onResizeEnd` receives the zero-delta sample derived from
the original `pointerdown`; after a move it receives the same sample and raw
`pointermove` event last sent to `onResize`. Axis-specific `touch-action`
preserves perpendicular page scrolling while keeping the resize axis under
pointer control. Keyboard presses fire start/resize/end as one atomic step.
