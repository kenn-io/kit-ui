# DateRangePicker

Date-range trigger + popover with three tabs: **Relative** (rolling "last N
days" pills), **Calendar** (a day/week/month period picked on an embedded
[Calendar](calendar.md) month grid — clicking a day selects the day/ISO
week/month containing it), and **Custom** (an explicit from/to span picked
with two clicks on the same embedded calendar: the first click starts the
range, the second completes it — an earlier second click swaps the ends — and
a From/To readout shows which endpoint the next click sets; only a complete
range commits). Ported from agentsview's shared `DateRangePicker`, decoupled
from its stores and i18n.

The component is controlled: you hold a `RangeSelection` and it calls
`onSelect` with a new one on every edit. `resolveRange()` turns any selection
into concrete inclusive `{from, to}` bounds (local-timezone `YYYY-MM-DD`
strings). Escape and outside clicks dismiss the popover.

**Semantics**: bounds are inclusive on both ends, and "Last N days" means N
calendar days including today (so `from` is N−1 days back). All date math is
local-timezone, day-granular — the consumer decides how a `YYYY-MM-DD` bound
maps to instants (e.g. `to` + one day, exclusive, in its own timezone
handling). Date strings are trusted input: feed the helpers valid
`YYYY-MM-DD` only.

```svelte
<script lang="ts">
  import { DateRangePicker, resolveRange, type RangeSelection } from "@kenn-io/kit-ui";

  let selection = $state.raw<RangeSelection>({ mode: "relative", days: 30 });
  const range = $derived(resolveRange(selection, earliestDate));
</script>

<DateRangePicker {selection} onSelect={(sel) => (selection = sel)} {earliestDate} />
```

## Props

| Prop                                                                                                                     | Type                            | Default                                   | Notes                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `selection`                                                                                                              | `RangeSelection`                | required                                  | Current selection (controlled)                                                                                                                                                                                                                                               |
| `onSelect`                                                                                                               | `(sel: RangeSelection) => void` | required                                  | Fires on every edit                                                                                                                                                                                                                                                          |
| `busy`                                                                                                                   | `boolean`                       | `false`                                   | Dims the trigger while data reloads                                                                                                                                                                                                                                          |
| `earliestDate`                                                                                                           | `string \| null`                | `null`                                    | Earliest data date; anchors the "All" preset                                                                                                                                                                                                                                 |
| `align`                                                                                                                  | `"left" \| "right"`             | `"left"`                                  | Popover edge alignment                                                                                                                                                                                                                                                       |
| `maxDate`                                                                                                                | `string \| null`                | `null`                                    | Later dates disabled in the calendar grid; month paging into fully-later months blocked. Note: a week/month period _containing_ `maxDate` still resolves to its full bounds, so `to` can exceed `maxDate` — clamp on the consumer side if your backend rejects future bounds |
| `block`                                                                                                                  | `boolean`                       | `false`                                   | Trigger/panel stretch to the container width                                                                                                                                                                                                                                 |
| `presets`                                                                                                                | `RangePreset[]`                 | `DEFAULT_RANGE_PRESETS`                   | Relative pills (`{ label, longLabel, days }`; `days <= 0` = all-time)                                                                                                                                                                                                        |
| `relativeTabLabel` / `calendarTabLabel` / `customTabLabel`                                                               | `string`                        | `"Relative"` / `"Calendar"` / `"Custom"`  | Mode-switch labels (rendered as a block [SegmentedControl](segmented-control.md), so the switch is a radiogroup with arrow-key movement)                                                                                                                                     |
| `dayLabel` / `weekLabel` / `monthLabel`                                                                                  | `string`                        | `"Day"` / `"Week"` / `"Month"`            | Calendar unit pills                                                                                                                                                                                                                                                          |
| `weekOfLabel`                                                                                                            | `string`                        | `"Week of"`                               | Week trigger label. A `"{date}"` placeholder is substituted with the week-start date (`"{date}所在周"`); without one the label is a prefix (`"Week of"` → "Week of Jun 29")                                                                                                  |
| `lastDaysLabel`                                                                                                          | `string`                        | `"Last {days} days"`                      | Trigger label for non-preset relative windows                                                                                                                                                                                                                                |
| `customRangeLabel`                                                                                                       | `string`                        | `"Custom range"`                          | Trigger label for an incomplete custom range                                                                                                                                                                                                                                 |
| `fromLabel` / `toLabel`                                                                                                  | `string`                        | `"From"` / `"To"`                         | Custom tab endpoint-readout labels                                                                                                                                                                                                                                           |
| `dialogLabel`                                                                                                            | `string`                        | `"Select date range"`                     | Popover `aria-label`                                                                                                                                                                                                                                                         |
| `relativeGroupLabel` / `calendarGroupLabel`                                                                              | `string`                        | `"Relative window"` / `"Calendar period"` | Pill group `aria-label`s                                                                                                                                                                                                                                                     |
| `previousMonthLabel` / `nextMonthLabel`                                                                                  | `string`                        | `"Previous month"` / `"Next month"`       | Calendar month-arrow `aria-label`s.                                                                                                                                                                                                                                          |
| `previousYearLabel` / `nextYearLabel` / `previousYearsLabel` / `nextYearsLabel` / `chooseMonthLabel` / `chooseYearLabel` | `string`                        | Calendar defaults                         | With the month arrows above, the shared `CalendarNavLabels` set — forwarded verbatim to the embedded [Calendar](calendar.md), whose own defaults apply                                                                                                                       |
| `locale`                                                                                                                 | `string`                        | browser locale                            | BCP 47 tag for the date labels on the trigger and calendar, for apps whose language setting can diverge from the browser locale. Trusted input: `Intl` throws on malformed tags, so validate persisted values                                                                |

Date labels on the trigger and embedded Calendar format with the browser
locale (memoized `Intl.DateTimeFormat` instances), or the `locale` prop when
set.

## Types and helpers (`date-range.ts`)

```ts
type RangeSelection =
  | { mode: "relative"; days: number } // rolling window; 0 = all
  | { mode: "calendar"; unit: "day" | "week" | "month"; anchor: string }
  | { mode: "custom"; from: string; to: string };

interface DateRange {
  from: string;
  to: string;
} // inclusive bounds
interface RangePreset {
  label: string;
  longLabel: string;
  days: number;
}
```

| Helper                                          | Purpose                                              |
| ----------------------------------------------- | ---------------------------------------------------- |
| `resolveRange(sel, earliestDate?)`              | Any selection → concrete `DateRange`                 |
| `presetRange(days, earliestDate?)`              | Bounds of a relative preset                          |
| `periodBounds(unit, anchor)`                    | Bounds of the day/ISO-week/month containing `anchor` |
| `stepAnchor(unit, anchor, dir)`                 | Move an anchor one period (month days clamp)         |
| `todayStr()` / `daysAgo(n)` / `localDateStr(d)` | Local `YYYY-MM-DD` helpers                           |
| `allFromDate(earliestDate?)`                    | "All" lower bound (falls back to one year)           |
| `DEFAULT_RANGE_PRESETS`                         | 7d / 30d / 90d / 1y / All                            |
