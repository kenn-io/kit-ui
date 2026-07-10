# Card

Bordered surface container with three hierarchy levels. Consolidates the
recipes middleman's hand-rolled cards converged on (`.inset-box`, the
timeline `.event-card`, `RepoSummaryCard`); the `hand-rolled-card` checker
rule steers external projects to it.

```svelte
<script lang="ts">
  import { Card } from "@kenn-io/kit-ui";
</script>

<Card level="raised" title="Run summary" meta="3m 42s">Checks passed on the third attempt.</Card>
```

## Hierarchy levels

| `level`   | Recipe                                              | Use for                                  |
| --------- | --------------------------------------------------- | ---------------------------------------- |
| `inset`   | bg-inset + border-muted + radius-sm                 | wells inside another surface             |
| `default` | bg-surface + border-muted + radius-md               | list tiles, timeline cards (the default) |
| `raised`  | bg-surface + border-default + radius-lg + shadow-sm | page-level panels                        |

Levels compose — an `inset` well inside a `raised` panel reads as
hierarchy. Don't nest same-level cards.

## Header, footer, padding

The header renders when any of `eyebrow` (uppercase mini-label, tinted via
`eyebrowTone` — the Chip tone vocabulary), `title`, `meta` (right-aligned
muted text), or the `actions` snippet (trailing icon buttons) is present.
The `footer` snippet is divided from the body by a muted rule.
`padding` is `"none" | "sm" | "md"` (default `md`).

```svelte
<Card level="raised" eyebrow="review" eyebrowTone="merged" title="ada" meta="2h ago">
  {#snippet actions()}<IconButton ariaLabel="Edit" size="sm">…</IconButton>{/snippet}
  Approved with suggestions.
  {#snippet footer()}<Button size="sm" label="Reply" />{/snippet}
</Card>
```

## Clickable cards

`href` renders the card as an `<a>`, `onclick` as a `<button>`; both get
the accent hover (border + 6% tint) and the shared focus ring. Don't put
other interactive elements (including header `actions`) inside a clickable
card — nested interactive elements are invalid HTML.

`href` and `onclick` are mutually exclusive; if both are passed, `href`
wins — the card renders as a link and the `onclick` handler is ignored
(it is not attached to the anchor).

For choice-card sets (theme pickers, plan selectors), `selected` marks the
active card: the button variant renders `aria-pressed`, the anchor variant
renders `aria-current="true"`, and the card holds the accent border + 8%
tint. On a static (non-clickable) card `selected` is visual-only — prefer
a clickable variant so the state is exposed to assistive tech. Wrap the
set in a `role="group"` container with an `aria-label`.

## Theming

All three levels are pure token consumers (`--kit-card-bg/border/radius/
shadow` internally), so every pluggable theme restyles them wholesale —
zine's raised card gets ink borders and a hard offset shadow, pebble's
gets 14px corners and diffuse lift.

## Related

`CommentCard` (comment anatomy preset, see `timeline.md`) builds on Card;
the popover chrome is separate (`.kit-popover-card` in theme.css).
