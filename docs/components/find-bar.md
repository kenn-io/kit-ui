# FindBar

In-content find bar (the Cmd-F strip): search input, "N of M" counter,
previous/next arrows, and a close button. Ported from agentsview's
`SessionFindBar`, decoupled from its search store — the bar owns only the
input and navigation chrome; you compute the matches and move the highlight.

Keyboard: **Enter** → `onnext`, **Shift+Enter** → `onprev`, **Escape** →
`onclose`. When the query has no matches the counter shows the
"No matches" state and the focused card border turns red. Mount it
conditionally; it autofocuses on mount by default.

```svelte
<script lang="ts">
  import { FindBar } from "@kenn-io/kit-ui";

  let query = $state("");
  let currentIndex = $state(0);
  const matches = $derived(computeMatches(query));
</script>

{#if findOpen}
  <FindBar
    bind:query
    matchCount={matches.length}
    currentIndex={currentIndex}
    onnext={() => (currentIndex = (currentIndex + 1) % matches.length)}
    onprev={() => (currentIndex = (currentIndex - 1 + matches.length) % matches.length)}
    onclose={() => (findOpen = false)}
    oninput={() => (currentIndex = 0)}
  />
{/if}
```

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `query` | `string` (bindable) | `""` | Current search text |
| `matchCount` | `number` | required | Total matches for `query` |
| `currentIndex` | `number` | required | 0-based current match; displayed 1-based |
| `onnext` | `() => void` | — | Enter / down arrow button |
| `onprev` | `() => void` | — | Shift+Enter / up arrow button |
| `onclose` | `() => void` | — | Escape / close button |
| `oninput` | `(query: string) => void` | — | Every keystroke (e.g. reset `currentIndex`) |
| `autofocus` | `boolean` | `true` | Focus the input when the bar mounts |
| `placeholder` | `string` | `"Find…"` | |
| `matchCountLabel` | `string` | `"{current} of {total}"` | Counter template |
| `noMatchesLabel` | `string` | `"No matches"` | |
| `ariaLabel` | `string` | `"Find"` | `role="search"` label |
| `inputAriaLabel` | `string` | `"Search query"` | |
| `previousLabel` / `nextLabel` | `string` | `"Previous match"` / `"Next match"` | Arrow tooltips + `aria-label`s |
| `closeLabel` | `string` | `"Close"` | |

The prev/next buttons disable while there are no matches. The card border
carries focus (blue) and no-match (red) states; the slide-down animation is
disabled under `prefers-reduced-motion`.

## Placement contract

The bar renders as a floating card (border + radius + shadow, browser cmd-F
style) but does **not** position itself — the app owns placement and
stacking:

```svelte
<div class="pane">          <!-- position: relative -->
  {#if findOpen}
    <div class="pane__find"> <!-- position: absolute; top: 8px; right: 8px; z-index: … -->
      <FindBar … />
    </div>
  {/if}
  …searched content…
</div>
```

Pick a `z-index` above the searched content but below app overlays
(modals/drawers). The card is `min-width: min(300px, 100%)` — in containers
narrower than 300px it shrinks to fit instead of overflowing.
