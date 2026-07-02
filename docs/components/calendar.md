# Calendar

A single-month date grid: Monday-first weeks, month paging, an optional
highlighted range, and a `maxDate` guard. This is the calendar surface
`DateRangePicker` embeds in its Calendar tab; use it standalone for any
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

| Prop                                    | Type                     | Default                             | Notes                                                                                                                                                                                     |
| --------------------------------------- | ------------------------ | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `month`                                 | `string` (bindable)      | today                               | Any `YYYY-MM-DD` inside the visible month                                                                                                                                                 |
| `selected`                              | `DateRange \| null`      | `null`                              | Inclusive range to highlight; a single day is `{ from: d, to: d }`                                                                                                                        |
| `onpick`                                | `(date: string) => void` | —                                   | Clicked date (`YYYY-MM-DD`); leading/trailing days of adjacent months are pickable                                                                                                        |
| `maxDate`                               | `string \| null`         | `null`                              | Later dates disabled; paging into fully-later months blocked                                                                                                                              |
| `previousMonthLabel` / `nextMonthLabel` | `string`                 | `"Previous month"` / `"Next month"` | Arrow `aria-label`s in the day view                                                                                                                                                       |
| `previousYearLabel` / `nextYearLabel`   | `string`                 | `"Previous year"` / `"Next year"`   | Arrow `aria-label`s in the month grid                                                                                                                                                     |
| `previousYearsLabel` / `nextYearsLabel` | `string`                 | `"Previous years"` / `"Next years"` | Arrow `aria-label`s in the year grid                                                                                                                                                      |
| `chooseMonthLabel` / `chooseYearLabel`  | `string`                 | `"Choose month"` / `"Choose year"`  | Appended to the header button's accessible name to hint at the drill-down                                                                                                                 |
| `locale`                                | `string`                 | browser locale                      | BCP 47 tag for month/weekday/day names, for apps whose language setting can diverge from the browser locale. Trusted input: `Intl` throws on malformed tags, so validate persisted values |
| `class`                                 | `string`                 | `""`                                |                                                                                                                                                                                           |

## Behavior

- The grid always renders six Monday-first weeks (fixed height across
  months); adjacent-month days are muted but clickable.
- Today is marked with a subtle inset ring; the `selected` range renders
  as one contiguous tinted region (both the column and row grid seams
  between selected cells are filled), with the range start and end as
  solid accent pills rounded outward so the endpoints read at a glance —
  a one-day range is a single solid pill.
- Weekday/month labels use the browser locale (via memoized
  `Intl.DateTimeFormat` instances — `weekdayLabels()` / `monthLabels()` are
  exported), or the `locale` prop when the app's language setting can
  diverge from it; the grid itself is Monday-first regardless of locale,
  matching `periodBounds("week", …)`'s ISO weeks.
- The eight nav/drill-down label props are the shared `CalendarNavLabels`
  interface (exported); `DateRangePicker` accepts the same keys and
  forwards them verbatim.
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
- The independence cuts both ways: an external `bind:month` update while
  the calendar is zoomed does not reset the view or move the zoom anchor
  (the user keeps their browsing position); it takes effect in the day
  grid, and a subsequent month pick overrides it.
- The arrows page by month, year, or 12 years to match the view; the year
  grid uses fixed 12-slot blocks (e.g. 2016–2027) so paging is stable.
- `maxDate` applies in the zoomed grids too: months/years entirely after
  it are disabled, as is paging past it.
- The currently-anchored month/year carries the same inset ring as
  "today" in the day grid — a position marker, not a selection.
- In the year grid there is nothing further to zoom out to, so the header
  reverts to a static label showing the visible block.
