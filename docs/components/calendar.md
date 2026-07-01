# Calendar

A single-month date grid: Monday-first weeks, month paging, an optional
highlighted range, and a `maxDate` guard. This is the calendar surface
`RangePicker` embeds in its Calendar tab; use it standalone for any
pick-a-date UI.

```svelte
<script lang="ts">
  import { Calendar, periodBounds, todayStr } from "@kenn-io/kit-ui";

  let picked = $state(todayStr());
  let month = $state(todayStr());
</script>

<Calendar
  bind:month
  selected={{ from: picked, to: picked }}
  onpick={(date) => (picked = date)}
  maxDate={todayStr()}
/>
```

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `month` | `string` (bindable) | today | Any `YYYY-MM-DD` inside the visible month |
| `selected` | `DateRange \| null` | `null` | Inclusive range to highlight; a single day is `{ from: d, to: d }` |
| `onpick` | `(date: string) => void` | — | Clicked date (`YYYY-MM-DD`); leading/trailing days of adjacent months are pickable |
| `maxDate` | `string \| null` | `null` | Later dates disabled; paging into fully-later months blocked |
| `previousMonthLabel` / `nextMonthLabel` | `string` | `"Previous month"` / `"Next month"` | Month-arrow `aria-label`s |
| `class` | `string` | `""` | |

## Behavior

- The grid always renders six Monday-first weeks (fixed height across
  months); adjacent-month days are muted but clickable.
- Today is marked with a subtle inset ring; the `selected` range is tinted
  with the range ends squared off, and a one-day range renders as a solid
  accent pill.
- Weekday/month labels use the browser locale (`toLocaleDateString`); the
  grid itself is Monday-first regardless of locale, matching
  `periodBounds("week", …)`'s ISO weeks.
- Day cells are plain focusable buttons with full-date `aria-label`s (no
  roving-tabindex grid navigation yet).
