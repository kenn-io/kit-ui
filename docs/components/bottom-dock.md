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
pixel height.

`open` is controlled. The built-in close `IconButton` calls `onclose`; the
parent changes `open`. Closing and reopening the same component instance keeps
its most recently requested height.

## Props

| Prop             | Type         | Default         | Notes                                                   |
| ---------------- | ------------ | --------------- | ------------------------------------------------------- |
| `open`           | `boolean`    | required        | Controls whether the inline panel renders               |
| `onclose`        | `() => void` | required        | Called by the built-in close control                    |
| `ariaLabel`      | `string`     | required        | Names both the dock region and its resize separator     |
| `initialHeight`  | `string`     | `"50vh"`        | Initial CSS height; prop changes replace local override |
| `minHeight`      | `string`     | `"200px"`       | CSS minimum height                                      |
| `maxHeight`      | `string`     | `"80vh"`        | CSS maximum height                                      |
| `keyboardStep`   | `number`     | `24`            | Pixels per Up/Down key press                            |
| `closable`       | `boolean`    | `true`          | Renders the shared close `IconButton`                   |
| `closeTitle`     | `string`     | `"Close panel"` | Close-button tooltip                                    |
| `closeAriaLabel` | `string`     | `"Close panel"` | Close-button accessible name                            |
| `class`          | `string`     | `""`            | Additional class on the dock region                     |
| `header`         | `Snippet`    | —               | Header content before the close button                  |
| `children`       | `Snippet`    | —               | Flexible, vertically scrollable body                    |
| `footer`         | `Snippet`    | —               | Pinned footer content                                   |

## Escape ownership

`BottomDock` deliberately does not close on Escape. Inline panels commonly sit
inside application shortcut scopes or modal workflows, so the parent owns
keyboard dismissal priority. If Escape should close the dock, handle it at the
application layer after checking for higher-priority modal state.
