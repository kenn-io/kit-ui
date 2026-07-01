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

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `title` | `string` | — | Header text; header renders if `title` or `closable` |
| `onclose` | `() => void` | — | Dismiss callback |
| `closable` | `boolean` | `true` | Show the X button |
| `closeOnOverlayClick` | `boolean` | `true` | |
| `width` | `string` | `"auto"` | |
| `maxWidth` | `string` | `"min(480px, calc(100vw - 32px))"` | |
| `ariaLabel` | `string` | `title` | For dialogs without a title |
| `children` | `Snippet` | — | Body content |
| `footer` | `Snippet` | — | Right-aligned action row |
