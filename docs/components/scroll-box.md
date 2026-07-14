# ScrollBox

Vertical scroller with the native scrollbar hidden and a thin overlay
indicator instead: a thumb appears while scrolling and fades out 700ms after
the last scroll event (no fade under `prefers-reduced-motion`; `CanvasText`
thumb under forced colors). The viewport is a labelled focusable
`role="region"`, so keyboard users can tab to it and scroll with arrow keys.

The thumb is deliberately an indicator, not a control: it has
`pointer-events: none` and cannot be dragged. Pointer users scroll with the
wheel, trackpad, or keyboard like any scroller — dragging is an explicit
non-goal. For a surface whose users rely on grabbing the scrollbar (or that
scrolls both axes), keep a native scroller instead of ScrollBox.

The thumb geometry is exported as a pure function
(`getScrollIndicatorGeometry`) — unit-tested in
`checks/scroll-indicator.test.ts` and reusable for custom overlay scrollers.

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
| `onscroll` | `(event: Event) => void`    | —        | Fires on every viewport scroll (after the indicator state updates)                                      |
| `viewport` | `HTMLDivElement` (bindable) | —        | The scrolling element — bind it to read/set `scrollTop` or observe scroll position                      |
| `children` | `Snippet`                   | required |                                                                                                         |

Remaining props (`tabindex`, `style`, …) are spread onto the viewport
element, so e.g. `tabindex={-1}` removes it from the tab order when a
focusable ancestor already owns keyboard scrolling.

## Layout

The wrapper is `flex: 1; min-height: 0`, sized by its flex parent — give the
parent a bounded height or the viewport never overflows and the indicator
stays hidden. Content shorter than the viewport never shows a thumb.

ScrollBox is vertical-only. Horizontal strips (tab bars) should stay native
scrollers with their own affordances.

## Selectors

Stable class names for tests and `closest()` lookups: `kit-scrollbox`
(wrapper), `kit-scrollbox__viewport` (scrolling element, carries the
`aria-label`), `kit-scrollbox__indicator` / `--visible`, `kit-scrollbox__thumb`.

## `getScrollIndicatorGeometry(viewportHeight, contentHeight, scrollTop)`

Returns `{ scrollable, height, top }`: `scrollable` is false when content
fits (or the viewport is unmeasured), thumb `height` is proportional to the
visible fraction with a 24px minimum, and `top` maps the (overscroll-clamped)
scroll position onto the thumb's travel range.
