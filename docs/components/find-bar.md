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
| `variant` | `"pinned" \| "floating"` | `"pinned"` | pinned = full-width strip flush with the container's top edge (square corners, bottom border only, no shadow). floating = IDE-style shadowed card inset at the container's top-right |
| `placeholder` | `string` | `"Find…"` | |
| `matchCountLabel` | `string` | `"{current} of {total}"` | Counter template |
| `noMatchesLabel` | `string` | `"No matches"` | |
| `ariaLabel` | `string` | `"Find"` | `role="search"` label |
| `inputAriaLabel` | `string` | `"Search query"` | |
| `previousLabel` / `nextLabel` | `string` | `"Previous match"` / `"Next match"` | Arrow tooltips + `aria-label`s |
| `closeLabel` | `string` | `"Close"` | |

The prev/next buttons disable while there are no matches. The bar's border
carries focus (blue) and no-match (red) states — the bottom border on the
pinned strip, the full card border on the floating variant; the slide-down
animation is disabled under `prefers-reduced-motion`.

## Placement contract

Two presentations, chosen by `variant`:

- **`pinned` (default)** — a browser-find-style strip that spans the full
  width of the find-target container, flush with its top edge: square
  corners, a bottom border only, no shadow. Render it as the first child
  of the container (above the searched content); it participates in
  normal flow, so content below shifts down while the bar is open.

  ```svelte
  <div class="pane">
    {#if findOpen}<FindBar … />{/if}
    …searched content…
  </div>
  ```

- **`floating`** — an IDE-find-style shadowed card the component insets
  at the container's top-right (`position: absolute; top/right:
  --space-4; z-index: 10`). The container must be `position: relative`.
  Content does not shift; the card overlays it (reserve top padding in
  the container only if covering the first lines is unacceptable — see
  the demo). Placement is themeable via custom properties on the
  container — the component's scoped rules out-specify a plain class
  selector, so overrides go through these instead:

  | Custom property | Default | Controls |
  | --- | --- | --- |
  | `--kit-find-bar-inset-top` | `var(--space-4)` | Top inset |
  | `--kit-find-bar-inset-right` | `var(--space-4)` | Right inset; also mirrored into the narrow-container width guard |
  | `--kit-find-bar-z` | `10` | Stacking (keep below app overlays like modals/drawers) |

  ```svelte
  <div class="pane" style="position: relative">
    {#if findOpen}<FindBar variant="floating" … />{/if}
    …searched content…
  </div>
  ```

The floating card is `min-width: min(300px, 100% - insets)` — in
containers narrower than 300px it shrinks to fit instead of overflowing.
The shadow treatment lives on the floating variant only; the pinned strip
is part of the container chrome, matching the popover conventions in
[theming](../theming.md).

## Migrating from the pre-variant FindBar

The bar was previously a floating shadowed card that the **app**
positioned (agentsview wrapped it in its own absolute container). The
default is now the pinned strip, which is a breaking presentation change
for consumers that omit `variant`:

- To keep the old look, pass `variant="floating"` and drop the app-side
  absolute wrapper — the component now positions itself; the container
  just needs `position: relative`.
- To adopt the new default, render the bar as the container's first
  child and remove any positioning wrapper; content below shifts down
  while the bar is open.
