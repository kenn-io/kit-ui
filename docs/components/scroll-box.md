# ScrollBox

Vertical scroller that preserves the browser and operating system's native
scrollbar rendering and interactions. The viewport is a labelled focusable
`role="region"`, so keyboard users can tab to it and scroll with arrow keys.

```svelte
<script lang="ts">
  import { ScrollBox } from "@kenn-io/kit-ui";

  let viewport = $state<HTMLDivElement>();
</script>

<ScrollBox label="Activity feed" bind:viewport onscroll={handleScroll}>
  {#each items as item (item.id)}
    <FeedRow {item} />
  {/each}
</ScrollBox>
```

## Props

| Prop       | Type                        | Default  | Notes                                                                                                   |
| ---------- | --------------------------- | -------- | ------------------------------------------------------------------------------------------------------- |
| `label`    | `string`                    | required | `aria-label` for the scroll region — it's a focusable keyboard target and must be announced with a name |
| `class`    | `ClassValue`                | `""`     | Applied to the outer wrapper                                                                            |
| `dataTest` | `string`                    | —        | `data-test` attribute on the outer wrapper                                                              |
| `onscroll` | `(event: Event) => void`    | —        | Fires on every viewport scroll                                                                          |
| `viewport` | `HTMLDivElement` (bindable) | —        | The scrolling element — bind it to read/set `scrollTop` or observe scroll position                      |
| `children` | `Snippet`                   | required |                                                                                                         |

Remaining props (`tabindex`, `style`, …) are spread onto the viewport
element, so e.g. `tabindex={-1}` removes it from the tab order when a
focusable ancestor already owns keyboard scrolling.

## Layout

The wrapper is `flex: 1; min-height: 0`, sized by its flex parent — give the
parent a bounded height or the viewport never overflows. The browser decides
whether and how to present its native scrollbar based on overflow and the
user's platform settings.

ScrollBox is vertical-only. Horizontal strips (tab bars) should stay native
scrollers with their own affordances.

## Selectors

Stable class names for tests and `closest()` lookups: `kit-scrollbox`
(wrapper), `kit-scrollbox__viewport` (scrolling element, carries the
`aria-label`).
