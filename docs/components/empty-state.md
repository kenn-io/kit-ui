# EmptyState

The empty or unavailable state for a pane, a panel, or a whole page: nothing
saved yet, no rows for these filters, nothing selected, or a feature this
server does not offer. It has an icon, a title, an optional description, and
optional actions. It has no frame or fill, so it never reads as an alert.

```svelte
<script lang="ts">
  import InboxIcon from "@lucide/svelte/icons/inbox";
  import { Button, EmptyState } from "@kenn-io/kit-ui";
</script>

<EmptyState
  title="No sessions yet"
  description="Connect a repository to start tracking agent sessions."
>
  {#snippet icon()}
    <InboxIcon size="24" aria-hidden="true" />
  {/snippet}
  <Button label="Add repository" surface="solid" tone="info" onclick={add} />
</EmptyState>
```

Pass translated strings; the component has no built-in copy.

## Placement

- **`align="center"`** (the default): for a pane, such as a list or
  VirtualList's `empty` snippet. It centers itself inside a flex parent
  (`margin: auto`) and centers its own content, so it needs no wrapper
  styles.
- **`align="top"`**: for a whole page or panel under its header. It sits a
  fixed step (48px) below the top of its container, so every empty page
  shows it in the same place, whatever the page's height.

```svelte
<PageHeader title="Pinned" />
<EmptyState
  align="top"
  title="No pinned messages"
  description="Pin a message in any session to keep it here."
>
  {#snippet icon()}<PinIcon size="24" aria-hidden="true" />{/snippet}
</EmptyState>
```

## Icon

The icon renders in muted ink at the size the caller passes. The component
does not resize it. Use 24px, the icon size for empty states; the default
theme draws the same line at every size, so a larger icon is bigger, not
heavier.

## Actions

Actions are the component's children: put buttons between the tags. There is
no `action` snippet.

## When to use something else

- **[Notice](auth-surfaces.md)** or a framed note: an explanation above
  content that still renders, such as read-only mode or a date filter's
  scope.
- An alert: a load that failed.

## Props

| Prop          | Type                 | Default    | Notes                                                                                    |
| ------------- | -------------------- | ---------- | ---------------------------------------------------------------------------------------- |
| `title`       | `string`             | —          | What is missing, as a short phrase ("No pinned messages"). Primary ink, semibold, 13px   |
| `description` | `string`             | —          | Why it is missing or how to fill it, in one or two sentences. Muted ink, 12px, max 380px |
| `icon`        | `Snippet`            | —          | A neutral glyph, typically a lucide icon at 24px. Muted ink; not resized                 |
| `align`       | `"top" \| "center"`  | `"center"` | `center` centers in a pane; `top` sits 48px below the container's top                    |
| `role`        | `"status" \| "note"` | —          | `status` when the state replaces content that was loading, so screen readers announce it |
| `class`       | `string`             | `""`       |                                                                                          |
| `children`    | `Snippet`            | —          | Action row under the text                                                                |

## Migrating from MissingData

`MissingData` is removed. Replace it with `<EmptyState align="top">`. Move
the contents of its `action` snippet to the component's children. Its icon
was forced to 24px; pass `size="24"` to keep that. Its description was 13px
and is now 12px.
