# Calendar

A single-month date grid: Monday-first weeks (or Sunday-first), month
paging, keyboard grid navigation, an optional highlighted range, and a
`maxDate` guard. `layout="strip"` shows the month as one horizontal row.
This is the calendar surface
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

| Prop                                    | Type                             | Default                             | Notes                                                                                                                                                                                     |
| --------------------------------------- | -------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `month`                                 | `string` (bindable)              | today                               | Any `YYYY-MM-DD` inside the visible month                                                                                                                                                 |
| `selected`                              | `DateRange \| null`              | `null`                              | Inclusive range to highlight; a single day is `{ from: d, to: d }`                                                                                                                        |
| `onpick`                                | `(date: string) => void`         | —                                   | Clicked date (`YYYY-MM-DD`), or the focused one on Enter/Space; leading/trailing days of adjacent months are pickable                                                                     |
| `maxDate`                               | `string \| null`                 | `null`                              | Later dates cannot be picked. In the grid they remain focusable; in the strip they are disabled. Paging into fully-later months is blocked.                                               |
| `weekStart`                             | `"monday" \| "sunday"`           | `"monday"`                          | First column of the grid, and the week Home/End move within                                                                                                                               |
| `previousMonthLabel` / `nextMonthLabel` | `string`                         | `"Previous month"` / `"Next month"` | Arrow `aria-label`s in the day view                                                                                                                                                       |
| `previousYearLabel` / `nextYearLabel`   | `string`                         | `"Previous year"` / `"Next year"`   | Arrow `aria-label`s in the month grid                                                                                                                                                     |
| `previousYearsLabel` / `nextYearsLabel` | `string`                         | `"Previous years"` / `"Next years"` | Arrow `aria-label`s in the year grid                                                                                                                                                      |
| `chooseMonthLabel` / `chooseYearLabel`  | `string`                         | `"Choose month"` / `"Choose year"`  | Appended to the header button's accessible name to hint at the drill-down                                                                                                                 |
| `locale`                                | `string`                         | browser locale                      | BCP 47 tag for month/weekday/day names, for apps whose language setting can diverge from the browser locale. Trusted input: `Intl` throws on malformed tags, so validate persisted values |
| `activity`                              | `Record<string, number> \| null` | `null`                              | Count per `YYYY-MM-DD` day; shaded days and their labels follow it. See Activity                                                                                                          |
| `activityScale`                         | `(count, date) => number`        | quarters of the busiest day         | Shade step 0–4 for a count, for an app's own thresholds                                                                                                                                   |
| `activityLabel`                         | `(count) => string`              | `"1 item"` / `"N items"`            | Wording of the count appended to a day's `aria-label`                                                                                                                                     |
| `layout`                                | `"grid" \| "strip"`              | `"grid"`                            | `"strip"` shows the visible month as one horizontal row. See Month strip                                                                                                                  |
| `matches`                               | `(date) => boolean`              | —                                   | Marks days with a dot, independent of activity and selection. See Matches                                                                                                                 |
| `matchLabel`                            | `string`                         | `"matches filters"`                 | Appended to a marked day's `aria-label`                                                                                                                                                   |
| `class`                                 | `string`                         | `""`                                |                                                                                                                                                                                           |

## Behavior

- The grid always renders six Monday-first weeks (fixed height across
  months); adjacent-month days are muted but clickable. The strip layout
  differs; see Month strip.
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
- The day grid is a `role="grid"` named by the month ("January 2026"),
  with one `role="row"` per week. Each day is a button with
  `role="gridcell"`, a weekday-and-date name ("Thursday, January 15,
  2026"), `aria-selected` for days in `selected`, and
  `aria-current="date"` on today. Days after `maxDate` carry
  `aria-disabled="true"` instead of `disabled`.

## Keyboard

The day grid follows the
[WAI-ARIA date picker grid](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/)
pattern. It is one tab stop: the selected day if the shown month has one,
else today, else the month's first enabled day. The other days have
`tabindex="-1"`.

| Key                           | Moves focus to                                 |
| ----------------------------- | ---------------------------------------------- |
| Left / Right                  | The previous / next day                        |
| Up / Down                     | The same weekday a week earlier / later        |
| Home / End                    | The first / last day of the week (`weekStart`) |
| PageUp / PageDown             | The same day a month earlier / later           |
| Shift+PageUp / Shift+PageDown | The same day a year earlier / later            |
| Enter / Space                 | Picks the focused day, as a click does         |

When the target day is in another month, the calendar shows that month
and keeps focus on the day. Month and year moves clamp the day to the
target month's length, so Jan 31 + one month is Feb 28 (or 29). Keys never
move into a month that lies wholly after `maxDate`. Days after `maxDate` in
the shown month take focus so you can move past them, but Enter and Space
do nothing there.

`focus(options?)`, called through `bind:this`, moves focus to the tab stop.
`DatePicker` and `DateRangePicker` call it when they open.

## Activity

Pass `activity`, a count per day, to shade days by how much happened on them,
such as messages, documents, or events. The calendar draws four tints of one
accent; days without a count stay plain. A count that is not
a finite number (`NaN`, `Infinity`) is treated as no count.

```svelte
<Calendar
  bind:month
  activity={{ "2026-11-03": 4, "2026-11-04": 12, "2026-11-10": 1 }}
  activityLabel={(count) => (count === 1 ? "1 message" : `${count} messages`)}
  onpick={openDay}
/>
```

- By default the steps are quarters of the busiest day shown (the whole
  grid, or the month's own days in the strip). An outlier can leave most days
  in the same shade. `activityStep(count, max)` is that rule, exported for a
  legend. Pass `activityScale` to use thresholds suited to your distribution;
  it returns a step from 0 to 4 for a count and its date.
- A day with a count gets it in its accessible label: "Wednesday, November 4, 2026, 12
  messages". `activityLabel` words the count; the default is "N items".
- The accent is `--accent-green`. Set `--kit-calendar-activity-color` on the
  calendar or an ancestor for another one.
- The four tints are part of the API: steps 1 to 4 are the accent mixed
  12%, 22%, 33% and 44% toward transparent, over whatever surface the
  calendar sits on. A legend beside the calendar matches the cells by using
  the same accent and the same mixes on the same surface:

  ```css
  .legend-step-2 {
    background: color-mix(
      in srgb,
      var(--kit-calendar-activity-color, var(--accent-green)) 22%,
      transparent
    );
  }
  ```

  The bins themselves stay the app's: pass them as `activityScale`.

- The selected range, the hover fill, and the outside-month dimming draw over
  the shade, and today's ring and `maxDate` work as before. Without
  `activity` the calendar renders exactly as it did.
- The data is the app's to load. Pass counts for the visible month and its
  leading and trailing days; when `month` changes, fetch the next month.

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

## Month strip

`layout="strip"` shows the visible month as one row: each day is a cell
with its weekday letter over its number, for a timeline or activity bar
above a list.

```svelte
<Calendar
  layout="strip"
  bind:month
  {activity}
  activityScale={(count) => (count <= 0 ? 0 : count <= 2 ? 1 : count <= 5 ? 2 : count <= 9 ? 3 : 4)}
  matches={(date) => matchingDays.has(date)}
  selected={day ? { from: day, to: day } : null}
  onpick={(date) => (day = date)}
/>
```

- Only the month's own days render, in order, starting on whatever weekday
  the 1st falls on. `weekStart` determines the weekday labels.
- Weekday letters are the locale's narrow names
  (`weekdayLabels(locale, weekStart, "narrow")`) in the day's ink.
- The header is the arrows and a static month label: the strip pages by
  month, with `maxDate` blocking later months, and has no month/year
  drill-down.
- The calendar fills its container's width. The header sits beside the
  days and wraps above them when narrow; the days then scroll sideways
  inside the strip, never the page, with a thin scrollbar. When the month,
  the selection or the layout changes, the strip scrolls itself to show the
  first selected day, or to day 1 when none is selected.
- Selected days keep their activity shade under a 2px accent outline;
  hover and today are 1px rings. Ranges are outlined day by day, without
  the grid's joined band.
- Each day's accessible label starts with its short weekday name: "Tue,
  Mar 10, 2026, 8 messages".

## Matches

`matches(date)` marks days with a small dot, such as the days that match
the app's current filters. It works in both layouts and is independent of
everything else: a marked day keeps its count, shade, selection and
`maxDate` state, and a day can be marked without any activity. Change or
clear the marks by passing a new function or `undefined`.

A marked day's accessible label ends with `matchLabel`: "Tuesday, March 10, 2026, 8
messages, matches filters". The dot itself is hidden from assistive
technology. On the grid's solid range ends the dot takes the surface color
so it stays visible.
