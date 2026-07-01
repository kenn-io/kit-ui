# FitStages

Generic multi-breakpoint wrapper: give it renderings of the same control at
decreasing widths (**richest first, most compact last**) and it shows the
first one that fits — by measurement, not media queries. Every stage renders
as a hidden shrink-wrapped probe, so each stage's natural width is always
known; because the probes never depend on which stage is visible, the choice
is a pure function of the host width and **cannot oscillate**.

Extracted from the TopBar tab-collapse pattern so any squeezed toolbar can
use it: PR-detail action panes, search fields that degrade to an icon,
button rows next to a resizable sidebar.

```svelte
<script lang="ts">
  import { FitStages } from "@kenn-io/kit-ui";

  let stage = $state(0);
</script>

{#snippet fullActions()}
  <Button tone="success" label="Approve" … />
  <Button label="Request changes" … />
{/snippet}
{#snippet iconActions()}
  <Button tone="success" ariaLabel="Approve" title="Approve"><CheckIcon /></Button>
  …
{/snippet}

<FitStages bind:stage stages={[fullActions, iconActions]} />
```

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `stages` | `Snippet[]` | required | Ordered richest → most compact; the last stage is the unconditional fallback |
| `stage` | `number` (bindable) | `0` | Rendered stage index (read-only in spirit) — react to downgrades, e.g. move actions into a menu |
| `onstagechange` | `(stage: number) => void` | — | Fires when measurement switches stages |
| `class` | `string` | `""` | |

## Sizing contract (the one rule)

**The host must get its width from its container, never from its content** —
otherwise the active stage's width feeds back into the measurement (e.g. the
compact stage renders, the host shrink-wraps to it, and the rich stage never
fits again). Concretely:

- In a flex row: `flex: 1 1 0; min-width: 0` (basis `0`, **not** `auto`).
- As a block child or grid item: fine as-is (they fill their container).
- Inside a shrink-to-fit parent (`width: max-content`, a centered flex item,
  a float): give the host an explicit or percentage width first.

```css
.toolbar :global(.kit-fit-stages) {
  flex: 1 1 0;
  min-width: 0;
}
```

Stage content that flexes (a full-width search field) should declare its
floor with `min-width` — the shrink-wrapped probe resolves `width: 100%` to
the content's natural size, so `min-width` is what gets measured.

## Behavior notes

- Probes live in a zero-size clipped measurement layer (`aria-hidden` +
  `inert`, `visibility: hidden`): never focusable or hit-testable, and they
  don't contribute to any ancestor's scrollable overflow, however wide the
  richest stage is. The active stage renders normally.
- Selection re-runs on any resize of the host or a probe (content changes
  included) via a single `ResizeObserver`.
- Empty `stages` renders nothing; an out-of-range bound `stage` is clamped.

## Every stage mounts

Hidden or not, each probe mounts a full component subtree — a stage's code
runs once per stage plus once for the visible copy. Keep stages **stateless
renderings of the same actions**, not stateful widgets:

- No mount effects with side effects (subscriptions, fetches, autofocus) —
  they run N times.
- No named form controls inside a `<form>` — `inert` blocks interaction but
  probe copies still exist in the DOM and would submit duplicate entries.
- Don't hand-write element `id`s in a stage (duplicated per probe); Svelte's
  `$props.id()` is per-instance and safe.
- Interactive state does not transfer between stages: a half-typed input
  resets on a stage switch. If a stage needs live state (e.g. a search
  input), hoist the state above FitStages and pass it into every stage.

## Composition with TopBar

TopBar keeps its own tab-collapse machinery (it must tolerate snippets that
*change* when collapse flips, which needs a latch FitStages deliberately
doesn't have). The two compose for multi-breakpoint headers: TopBar's
`searchMinWidth` prop makes the search region the flexible middle, and a
FitStages inside it owns the search field → icon downgrade. See
[TopBar](top-bar.md#flexible-search-searchminwidth) and the agentsview
example on the TopBar demo page.
