# MissingData

The empty or unavailable state for a whole page or panel: nothing saved
yet, no rows for these filters, or a feature this server does not offer.
It has an icon, a title, an optional description, and an optional action.
It has no frame or fill, so it never reads as an alert, and it sits a fixed
step (48px) below the top of its container, so every page shows it in the
same place under its header.

```svelte
<script lang="ts">
  import PinIcon from "@lucide/svelte/icons/pin";
  import { MissingData, PageHeader } from "@kenn-io/kit-ui";
</script>

<PageHeader title="Pinned" />
<MissingData title="No pinned messages" description="Pin a message in any session to keep it here.">
  {#snippet icon()}<PinIcon size="24" aria-hidden="true" />{/snippet}
</MissingData>
```

Pass translated strings; the component has no built-in copy.

## When to use which

- **MissingData**: a page or panel has nothing to show. It takes the place
  of the content.
- **[EmptyState](empty-state.md)**: a placeholder that centers itself in a
  smaller pane, such as a list or VirtualList's `empty` snippet.
- **[Notice](auth-surfaces.md)** or a framed note: an explanation
  above content that still renders, such as read-only mode or a date
  filter's scope.
- An alert: a load that failed.

## Props

| Prop          | Type                 | Default | Notes                                                                                                               |
| ------------- | -------------------- | ------- | ------------------------------------------------------------------------------------------------------------------- |
| `title`       | `string`             | —       | What is missing, as a short phrase ("No pinned messages"). Primary ink, semibold                                    |
| `description` | `string`             | —       | Why it is missing or how to fill it, in one or two sentences. Muted ink, max 52ch                                   |
| `icon`        | `Snippet`            | —       | A neutral glyph for the page or feature. Rendered at 24px in muted ink; pass `size="24"` so the line weight matches |
| `action`      | `Snippet`            | —       | Controls that fill the gap, such as Retry or Build now                                                              |
| `role`        | `"status" \| "note"` | —       | `status` when the state replaces content that was loading, so screen readers announce it                            |
| `class`       | `string`             | `""`    |                                                                                                                     |
