# StatusBar

Fixed-height bottom app bar: `var(--status-bar-height)` (24px) tall, surface
background, top border, muted `--font-size-2xs` text. Consolidates the
`.status-bar` footer both middleman and agentsview hand-roll. Content is
entirely snippet-driven — counts, sync state, separators (`·`), and accent
colors stay in the app.

```svelte
<script lang="ts">
  import { StatusBar } from "@kenn-io/kit-ui";
</script>

<StatusBar>
  {#snippet left()}
    <span>{prCount} PRs</span>
    <span class="sep">&middot;</span>
    <span>{issueCount} issues</span>
  {/snippet}
  {#snippet right()}
    <span class="synced">synced 2m ago</span>
    <span class="sep">&middot;</span>
    <span>{version}</span>
  {/snippet}
</StatusBar>
```

Place it as the last child of a full-height flex column; it does not
self-position (`flex-shrink: 0`, no `position: fixed`). The left and right
regions flex equally around the optional center region, so `center` content
stays visually centered. Each region is a flex row with a 4px gap and hides
overflow.

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `left` | `Snippet` | — | Left-aligned content |
| `center` | `Snippet` | — | Centered content |
| `right` | `Snippet` | — | Right-aligned content |
