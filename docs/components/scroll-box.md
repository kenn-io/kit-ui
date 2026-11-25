# ScrollBox

Zero-gutter scroll container that hides the native scrollbar and renders
floating overlay thumbs on top of the viewport edge while preserving native
wheel, trackpad, touch, keyboard, scroll-anchoring, and programmatic scrolling.
The viewport is a labelled focusable `role="region"`, so keyboard users can tab
to it and scroll with arrow keys.

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

For two-axis scrolling (diff views, logs, wide panels) or sticky headers inside
the scroll area, pass `axis` and `insetTop`:

```svelte
<ScrollBox label="Diff preview" axis="both" insetTop={headerEl}>
  <div class="sticky-head" bind:this={headerEl}>…</div>
  <pre>{diff}</pre>
</ScrollBox>
```

For existing containers that already own their own semantics or layout (page
scrollers, sidebars, panels), use the [`overlayScrollbars`](../utilities.md#overlay-scrollbars)
attachment directly.

## Props

| Prop           | Type                                                                     | Default  | Notes                                                                                                   |
| -------------- | ------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------- |
| `label`        | `string`                                                                 | required | `aria-label` for the scroll region — it's a focusable keyboard target and must be announced with a name |
| `axis`         | `"x" \| "y" \| "both"`                                                   | `"y"`    | Which axes scroll and render overlay thumbs                                                             |
| `visibility`   | `"auto" \| "always" \| "never"`                                          | `"auto"` | `"auto"` shows thumbs on hover, scroll, or drag; `"always"` keeps them visible while overflowing        |
| `insetTop`     | `number \| HTMLElement \| null \| (() => number \| HTMLElement \| null)` | `0`      | Extra top clearance for the vertical thumb (for example, a sticky header element or fixed pixel height) |
| `insetBottom`  | `number \| HTMLElement \| null \| (() => number \| HTMLElement \| null)` | `0`      | Extra bottom clearance for the vertical thumb                                                           |
| `insetLeft`    | `number \| HTMLElement \| null \| (() => number \| HTMLElement \| null)` | `0`      | Extra left clearance for the horizontal thumb                                                           |
| `insetRight`   | `number \| HTMLElement \| null \| (() => number \| HTMLElement \| null)` | `0`      | Extra right clearance for the horizontal thumb                                                          |
| `cornerRadius` | `number \| "auto"`                                                       | `"auto"` | Corner clearance in px, or `"auto"` to follow computed border radii so thumbs clear rounded corners     |
| `class`        | `ClassValue`                                                             | `""`     | Applied to the outer non-scrolling frame                                                                |
| `dataTest`     | `string`                                                                 | —        | `data-test` attribute on the outer frame                                                                |
| `onscroll`     | `(event: Event) => void`                                                 | —        | Fires on every viewport scroll                                                                          |
| `viewport`     | `HTMLDivElement` (bindable)                                              | —        | The scrolling element — bind it to read/set `scrollTop`/`scrollLeft` or observe scroll position         |
| `children`     | `Snippet`                                                                | required |                                                                                                         |

Remaining props (`tabindex`, `style`, …) are spread onto the viewport element,
so e.g. `tabindex={-1}` removes it from the tab order when a focusable ancestor
already owns keyboard scrolling.

## Layout and interactions

The outer frame is `position: relative; flex: 1; min-width: 0; min-height: 0;
overflow: hidden`, sized by its flex parent — give the parent a bounded height
or the viewport never overflows. The inner viewport hides its native scrollbar
so scrolling takes 0px of layout width. Floating thumbs appear on hover or
scroll, support pointer dragging and track clicks (jumping and dragging from
the clicked spot), stay clear of rounded corners, and disable fade transitions
under `prefers-reduced-motion: reduce`.

Thumb appearance is controlled by the `--scrollbar-*` tokens in `theme.css`
(see [Theming](../theming.md#overlay-scrollbars)).

## Selectors

Stable class names for tests and `closest()` lookups: `kit-scrollbox` (outer
non-scrolling frame), `kit-scrollbox__viewport` (scrolling element, carries the
`aria-label`), `kit-scrollbar` / `kit-scrollbar--y` / `kit-scrollbar--x`
(overlay tracks), and `kit-scrollbar__thumb` (draggable thumb).
