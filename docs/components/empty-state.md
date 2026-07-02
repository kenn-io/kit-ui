# EmptyState

Centered muted placeholder for panes with nothing to show — empty inboxes,
filter misses, nothing-selected states. Replaces the hand-rolled
"centered column + muted text" blocks in both apps.

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
    <InboxIcon size="28" strokeWidth="1.5" aria-hidden="true" />
  {/snippet}
  <Button label="Add repository" surface="solid" tone="info" onclick={add} />
</EmptyState>
```

It centers itself inside a flex parent (`margin: auto`) and centers its own
content, so dropping it into any empty pane works without wrapper styles.

## Props

| Prop          | Type      | Default | Notes                                  |
| ------------- | --------- | ------- | -------------------------------------- |
| `icon`        | `Snippet` | —       | Leading glyph, typically a lucide icon |
| `title`       | `string`  | —       | Primary line                           |
| `description` | `string`  | —       | Muted secondary line (max-width 380px) |
| `children`    | `Snippet` | —       | Action row under the text              |
