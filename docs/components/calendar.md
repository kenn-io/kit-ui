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
| `previousMonthLabel` / `nextMonthLabel` | `string` | `"Previous month"` / `"Next month"` | Arrow `aria-label`s in the day view |
| `previousYearLabel` / `nextYearLabel` | `string` | `"Previous year"` / `"Next year"` | Arrow `aria-label`s in the month grid |
| `previousYearsLabel` / `nextYearsLabel` | `string` | `"Previous years"` / `"Next years"` | Arrow `aria-label`s in the year grid |
| `chooseMonthLabel` / `chooseYearLabel` | `string` | `"Choose month"` / `"Choose year"` | Appended to the header button's accessible name to hint at the drill-down |
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

## Month / year drill-down

The header label is a button (standard date-component pattern): clicking
it zooms out from days to a 12-month grid, and clicking again to a 12-year
grid; picking an entry drills back down (year → months → days). Notes:

- Browsing the zoomed grids is view-only: the arrows and year picks move
  an internal zoom anchor, and the bound `month` (and any `selected`
  range) changes **only when a month is picked**. A consumer with
  `bind:month` never observes churn from paging around, and backing out
  (picking the currently-anchored month) returns to the same day view
  with the highlight intact.
- The arrows page by month, year, or 12 years to match the view; the year
  grid uses fixed 12-slot blocks (e.g. 2016–2027) so paging is stable.
- `maxDate` applies in the zoomed grids too: months/years entirely after
  it are disabled, as is paging past it.
- The currently-anchored month/year carries the same inset ring as
  "today" in the day grid — a position marker, not a selection.
- In the year grid there is nothing further to zoom out to, so the header
  reverts to a static label showing the visible block.
