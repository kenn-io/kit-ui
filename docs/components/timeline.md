# Timeline, TimelineItem, CommentCard

The presentational compound behind PR/issue conversation views
(middleman's `EventTimeline` anatomy, extracted): `Timeline` is the list,
`TimelineItem` draws the rail — a 10px toned dot punched out of a 2px
connector by a halo of the canvas color — and `CommentCard` carries the
comment-card anatomy on top of `Card`.

```svelte
<script lang="ts">
  import { CommentCard, Timeline, TimelineItem } from "@kenn-io/kit-ui";
</script>

<Timeline ariaLabel="Pull request activity">
  <TimelineItem tone="info">
    <CommentCard typeLabel="comment" tone="info" author="marius" time="3h ago">
      {#snippet actions()}<IconButton ariaLabel="Edit" size="sm">…</IconButton>{/snippet}
      <Markdown source={body} />
    </CommentCard>
  </TimelineItem>
  <TimelineItem tone="merged">
    <!-- no children → header-only system-event row -->
    <CommentCard typeLabel="merged" tone="merged" author="ada" time="1h ago" />
  </TimelineItem>
</Timeline>
```

## TimelineItem

- `tone` colors the dot using the Chip tone vocabulary (`info`, `success`,
  `warning`, `danger`, `merged`, `workspace`, `neutral`, `muted`,
  `canceled`); untinted dots read as system plumbing.
- The connector hides itself on the last item.
- The dot's halo assumes the timeline sits on `--bg-primary`; on another
  surface override `--kit-timeline-halo` (and `--kit-timeline-dot` for a
  custom dot color).
- Content is free-form: a `CommentCard`, a `Card`, or plain markup.

## CommentCard

A preset over `Card level="default" padding="sm"`: `typeLabel` (uppercase
toned eyebrow), `author`, `time` (a **pre-formatted string** — the app owns
formatting and i18n, e.g. via `formatRelativeTime`), an `actions` snippet
(edit / copy-link icon buttons, always visible — hover-only actions are a
touch-accessibility trap), and a body at `--font-size-sm` / 1.6
line-height. Omit children for a one-line system-event row. Render
markdown by passing the `Markdown` component as children — CommentCard
deliberately doesn't render markdown itself.

## Scope

App concerns stay in the app: reply threading, comment editing, diff
snippets, and event ordering are middleman's, not the library's.
