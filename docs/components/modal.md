# Modal

Dialog primitive: overlay + panel + header + scrollable body + optional footer.
Consolidates the `.modal-overlay`/`.modal-panel` pattern shared by both apps.

Render it conditionally — the parent owns the open state:

```svelte
<script lang="ts">
  import { Button, Modal } from "@kenn-io/kit-ui";

  let open = $state(false);
</script>

{#if open}
  <Modal title="Delete session" onclose={() => (open = false)}>
    <p>This cannot be undone.</p>
    {#snippet footer()}
      <Button label="Cancel" onclick={() => (open = false)} />
      <Button label="Delete" tone="danger" surface="solid" onclick={confirm} />
    {/snippet}
  </Modal>
{/if}
```

`onclose` fires on Escape, overlay click (unless disabled), and the X button.

## Accessibility

The panel is `role="dialog"` + `aria-modal="true"`, named by `ariaLabel`
(falling back to `title`). While open, the shared `trapFocus` behavior
(exported from the package root for custom overlays) provides:

- **Initial focus**: the first `[autofocus]` descendant, else the panel
  itself — add `autofocus` to the primary control when it helps.
- **Focus trap**: Tab / Shift+Tab cycle inside the panel.
- **Focus restoration**: the previously focused element regains focus on
  close.
- **Scroll lock**: body scrolling is locked while any modal surface is open
  (re-entrant across stacked surfaces).

The overlay does not use `inert` on the rest of the page; screen-reader
virtual cursors rely on `aria-modal` support (all evergreen browsers).

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `title` | `string` | — | Header text; header renders if `title` or `closable` |
| `tone` | `"neutral" \| "info" \| "success" \| "warning" \| "danger"` | `"neutral"` | Header accent: neutral is a plain inset band; the others tint the band, the title, and the band's entire border area — top, side edges, and the divider below — with the semantic accent, so the band never sits against a grey line (pick the tone matching the primary action — e.g. `danger` for destructive confirms) |
| `onclose` | `() => void` | — | Dismiss callback |
| `closable` | `boolean` | `true` | Show the X button |
| `closeOnOverlayClick` | `boolean` | `true` | |
| `width` | `string` | `"auto"` | |
| `maxWidth` | `string` | `"min(480px, calc(100vw - 32px))"` | |
| `ariaLabel` | `string` | `title` | For dialogs without a title |
| `children` | `Snippet` | — | Body content |
| `footer` | `Snippet` | — | Right-aligned action row |
