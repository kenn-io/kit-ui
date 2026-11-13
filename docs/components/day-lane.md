# DayLane

One day on a vertical hour axis: items placed and sized by time, overlaps
side by side, empty stretches folded, and a strip above the hours for
date-only items. The component is presentational. The app passes plain
items and renders each card's inside with a snippet; DayLane knows nothing
about documents, messages or people.

Not to be confused with `Timeline`, the vertical comment rail.

```svelte
<script lang="ts">
  import { DayLane, type DayLaneItem } from "@kenn-io/kit-ui";

  let selected = $state<string | null>(null);
  const items: DayLaneItem[] = $derived(
    entries.map((e) => ({
      id: e.id,
      startMinute: e.axisMinute, // minutes from the day's start
      endMinute: e.endMinute, // omit for a point item
      dateOnly: e.dateOnly,
      tone: "info",
      selected: e.id === selected,
    })),
  );
</script>

<DayLane
  {items}
  dayMinutes={1440}
  onselect={(id) => (selected = id)}
  onoverflow={({ ids }) => showList(ids)}
>
  {#snippet item({ item, compact, columns })}
    <span class="title">{titles.get(item.id)}</span>
    {#if !compact && columns < 3}<span class="meta">…</span>{/if}
  {/snippet}
</DayLane>
```

## Time without time zones

DayLane never sees instants or zones. Each item is placed in **minutes from
the start of the day** on an elapsed-time axis, and the app says how long
the day is with `dayMinutes`: 1440 on most days, 1380 on a spring-forward
day, 1500 on a fall-back day. Every hour row is sixty elapsed minutes.

On a day without a DST change the defaults label the hours and times
correctly. On a DST day, pass `ticks` (one `{ minute, label }` per row, such
as `1 AM`, `3 AM` after a skipped hour) and `formatMinute` so fold bands,
"+N more" and screen-reader times use wall-clock text.

`startMinute` may be negative (an item that began the day before) and
`endMinute` may pass `dayMinutes`; the card is clipped at the edge and drawn
with a dashed edge there. Timed items entirely outside the day, or without
a `startMinute`, are not drawn.

## Props

| Prop               | Type                                                                      | Default      | Notes                                                                              |
| ------------------ | ------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------- |
| `items`            | `DayLaneItem[]`                                                           | —            | `{ id, dateOnly?, startMinute?, endMinute?, selected?, dimmed?, tone? }`           |
| `item`             | `Snippet<[DayLaneItemContext]>`                                           | —            | Card content; gets `item`, `height`, `compact`, `point`, `dateOnly`, `columns`     |
| `dayMinutes`       | `number`                                                                  | `1440`       | Length of the day                                                                  |
| `ticks`            | `DayLaneTick[]`                                                           | one per hour | Hour labels at their minutes                                                       |
| `formatMinute`     | `(minute) => string`                                                      | clock time   | Wall-clock text for folds, "+N more" and screen readers                            |
| `locale`           | `string`                                                                  | browser      | For the default ticks and `formatMinute`                                           |
| `hourHeight`       | `number`                                                                  | `96`         | Pixels per hour                                                                    |
| `minItemHeight`    | `number`                                                                  | `44`         | Smallest card; point items get exactly this                                        |
| `maxColumns`       | `number`                                                                  | `3`          | Side-by-side cards before a "+N more" item                                         |
| `foldQuietMinutes` | `number`                                                                  | `120`        | Empty runs of whole hours at least this long fold to a band; `0` turns folding off |
| `nowMinute`        | `number`                                                                  | —            | Draws a "now" line; pass it only on the current day                                |
| `scrollToFirst`    | `boolean`                                                                 | `true`       | Scrolls the first timed item into view when `dayKey` changes                       |
| `dayKey`           | `string \| number`                                                        | `""`         | Identifies the day shown; a new key scrolls again and closes opened folds          |
| `onselect`         | `(id) => void`                                                            | —            | Click, Enter or Space on a card                                                    |
| `onoverflow`       | `({ ids, startMinute }) => void`                                          | —            | A "+N more" item was chosen; the app shows the list                                |
| `onfoldchange`     | `({ startMinute, endMinute, expanded })`                                  | —            | A fold was opened or closed                                                        |
| labels             | `ariaLabel`, `dateOnlyLabel`, `overflowLabel`, `foldLabel`, `refoldLabel` | English      | Strings and small functions for translation                                        |

`tone` takes the Chip tone vocabulary and colors the card's accent bar and
the tick of a point item.

## By person: several lanes

Pass `lanes` (`{ key, label }[]`) and give each item `lane`: one key, or
several when the item belongs to several people. The lanes share one axis,
so 9 AM lines up across them, and a quiet stretch folds only when every
lane is quiet. Each lane applies `maxColumns` on its own (the Docbank
design uses 2). Lanes keep `laneMinWidth` (190px) and the view scrolls
sideways when they do not fit; the lane headers stay pinned while the
hours scroll. `laneHeader` renders a header from the lane and its timed
item count, for an avatar or a link; without it the header shows the label
and count. Timed items whose lanes are all missing are not drawn. A card
that sits in several lanes keeps one id, so `onselect` and `selected` work
the same as in a single lane.

```svelte
<DayLane {items} lanes={people} maxColumns={2} onselect={select}>
  {#snippet laneHeader(lane, count)}<PersonChip id={lane.key} /> {count}{/snippet}
  {#snippet item({ item })}…{/snippet}
</DayLane>
```

`layoutDayLanes(items, laneKeys, options)` is the pure layout behind it.

## Layout rules

- An item's top is its start; its height is its length, never less than
  `minItemHeight`. A point item (no `endMinute`) is a compact card with a
  tick on the hour gutter at its exact minute.
- Overlap uses the rendered span, so two point items ten minutes apart sit
  side by side instead of covering each other.
- Overlapping items share a cluster and take the first free column. Past
  `maxColumns`, the first `maxColumns - 1` columns stay and the rest become
  "+N more" items in the last column, one per group that would overlap.
  Nothing is trimmed or dropped.
- An hour is busy when any rendered span touches it. A run of empty hours at
  least `foldQuietMinutes` long folds to a 32px band; activating it opens the
  hours, and a "Fold" button on the first opened hour closes them again.
- Date-only items sit in a strip above the hours, in input order.
- Selected and dimmed come from the items; DayLane never hides an item.

## Keyboard and screen readers

The lane is a `group` with one tab stop: the selected card, else the first.
Arrow keys move through cards in time order (the date-only strip first, then
the axis by top and column), Home and End jump to the ends, Enter and Space
select. Escape is left to the app, which owns the selection. Each card is a
`button` with `aria-pressed`, and its accessible name ends with the time or
time range, so the snippet can mark its own visible time `aria-hidden`.
Hover transitions stop under `prefers-reduced-motion`.

## Layout functions

The layout is pure TypeScript, exported for apps that draw their own:
`layoutDayLane(items, options)` returns the axis rows, placed items and
overflows in reading order, the date-only list, and the ids outside the day.
`buildDayLaneSegments`, `placeDayLaneItems`, `placeColumns`, `minuteToY`,
`placeTicks` and `hourTicks` are the pieces it is built from. Layout is
linear in items apart from the column search inside a cluster; 600 items
lay out in about a millisecond.

## Scope

Fetching, chunking items into threads, time zones, a month strip, a detail
panel and a plain list layout stay in the app.
