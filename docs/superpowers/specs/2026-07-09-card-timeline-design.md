# Card + Timeline compounds — design

Approved 2026-07-09. Consolidates middleman's hand-rolled card recipes and
the presentational layer of its PR/issue `EventTimeline` into kit-ui.

## Card

Three hierarchy levels (`level` prop), matching the recipes middleman
already converged on:

| Level     | Recipe                                              | Replaces                 |
| --------- | --------------------------------------------------- | ------------------------ |
| `inset`   | bg-inset + border-muted + radius-sm, no shadow      | `.inset-box` wells       |
| `default` | bg-surface + border-muted + radius-md, no shadow    | timeline `.event-card`   |
| `raised`  | bg-surface + border-default + radius-lg + shadow-sm | `RepoSummaryCard` panels |

API: `level`, `padding ("none"|"sm"|"md")`, structured header —
`eyebrow` + `eyebrowTone` (ChipTone vocabulary, chip ink recipe),
`title`, `meta` (right-aligned muted), `actions` snippet — plus
`children` and a divided `footer` snippet. `href` renders `<a>`,
`onclick` renders `<button>`; either gets middleman's launch-card hover
(accent border + 6% tint). Class namespace `kit-card`.

## Timeline / TimelineItem

Presentational only; middleman's EventTimeline migrates onto these and
keeps its app coupling (stores, diff threads, suggestions, editing).

- `Timeline`: the `<ol class="kit-timeline">` wrapper.
- `TimelineItem`: `<li>` with a 24px rail — 10px toned dot with a
  `0 0 0 3px var(--bg-primary)` halo over a 2px `--border-default`
  connector (hidden on the last item) — and a content region.
  `tone` reuses the ChipTone accent map (info/success/warning/danger/
  merged/workspace/neutral/muted/canceled).

## CommentCard

Compound preset over Card `default`: `typeLabel` (uppercase toned
eyebrow), `author`, `time` (pre-formatted string), `actions` snippet in
the header, body snippet at `--font-size-sm` / 1.6 line-height. With no
children it renders as a header-only system-event row.

## Supporting work

- Barrel exports; `CardDemo` + `TimelineDemo` pages (mini PR
  conversation); `docs/components/card.md` + `timeline.md`.
- `hand-rolled-card` checker rule (+ tests) matching exactly the three
  level signatures above, so precision stays high (TextInput's
  bg-surface + border-default + radius-md wrapper does NOT match).

## Out of scope

Full EventTimeline port, reply threading rails, comment editing,
markdown rendering inside CommentCard (consumers pass the Markdown
component as children).
