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
overflow (see [Popovers](#popovers) for the escape hatch).

## Props

| Prop       | Type                    | Default    | Notes                                                     |
| ---------- | ----------------------- | ---------- | --------------------------------------------------------- |
| `left`     | `Snippet`               | —          | Left-aligned content                                      |
| `center`   | `Snippet`               | —          | Centered content                                          |
| `right`    | `Snippet`               | —          | Right-aligned content                                     |
| `overflow` | `"hidden" \| "visible"` | `"hidden"` | `"visible"` lets popovers escape the 24px bar (see below) |

## Popovers

Sections clip their content by default so long text truncates inside the bar —
which also clips any popover anchored inside a snippet. The sanctioned story
for a popover opening out of the status bar (e.g. a rate-limit budget panel):

1. Pass `overflow="visible"`. Overflow management becomes the app's
   responsibility: keep snippet text short enough not to spill, and make sure
   no ancestor between the bar and the viewport clips either.
2. Anchor the popover in a `position: relative` wrapper inside the snippet and
   grow it upward: `position: absolute; bottom: calc(100% + 4px); right: 0;
z-index: var(--z-popover)`. This works best when the bar has room to the right
   of the trigger; if the panel needs viewport-aware clamping, switch to
   `floatingPopoverStyle` instead.
3. Dress it with the shared `kit-popover-card` class and wire dismissal with
   the `dismissable` util (outside press + Escape).

```svelte
<StatusBar overflow="visible">
  {#snippet left()}
    <span>main</span>
  {/snippet}
  {#snippet right()}
    <span class="anchor" bind:this={anchorEl}>
      <button onclick={() => (open = !open)} aria-haspopup="dialog" aria-expanded={open}>
        api budget
      </button>
      {#if open}
        <div class="popover kit-popover-card" role="dialog" aria-label="API budget">…</div>
      {/if}
    </span>
  {/snippet}
</StatusBar>

<style>
  .anchor {
    position: relative;
    display: flex;
    align-items: center;
  }
  .popover {
    position: absolute;
    bottom: calc(100% + 4px);
    right: 0;
    z-index: var(--z-popover);
    white-space: normal;
  }
</style>
```

```ts
$effect(() => {
  if (!open) return;
  return dismissable({
    owners: () => [anchorEl],
    dismiss: () => (open = false),
    escapeFocus: () => triggerEl,
  });
});
```

An absolutely positioned panel keeps the popover glued to its trigger with no
measurement code; reach for `floatingPopoverStyle` + `position: fixed` only
when a clipping ancestor outside the bar can't be relaxed.
