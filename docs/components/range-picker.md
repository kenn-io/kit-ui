# RangePicker

Date-range trigger + popover with three tabs: **Relative** (rolling "last N
days" pills), **Calendar** (a day/week/month period picked on an embedded
[Calendar](calendar.md) month grid — clicking a day selects the day/ISO
week/month containing it), and **Custom** (explicit from/to date inputs).
Ported from agentsview's shared `RangePicker`, decoupled from its stores and
i18n.

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
  import { RangePicker, resolveRange, type RangeSelection } from "@kenn-io/kit-ui";

  let selection = $state.raw<RangeSelection>({ mode: "relative", days: 30 });
  const range = $derived(resolveRange(selection, earliestDate));
</script>

<RangePicker
  {selection}
  onSelect={(sel) => (selection = sel)}
  earliestDate={earliestDate}
/>
```

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `selection` | `RangeSelection` | required | Current selection (controlled) |
| `onSelect` | `(sel: RangeSelection) => void` | required | Fires on every edit |
| `busy` | `boolean` | `false` | Dims the trigger while data reloads |
| `earliestDate` | `string \| null` | `null` | Earliest data date; anchors the "All" preset |
| `align` | `"left" \| "right"` | `"left"` | Popover edge alignment |
| `maxDate` | `string \| null` | `null` | Later dates disabled in the calendar grid; month paging into fully-later months blocked. Note: a week/month period *containing* `maxDate` still resolves to its full bounds, so `to` can exceed `maxDate` — clamp on the consumer side if your backend rejects future bounds |
| `block` | `boolean` | `false` | Trigger/panel stretch to the container width |
| `presets` | `RangePreset[]` | `DEFAULT_RANGE_PRESETS` | Relative pills (`{ label, longLabel, days }`; `days <= 0` = all-time) |
| `relativeTabLabel` / `calendarTabLabel` / `customTabLabel` | `string` | `"Relative"` / `"Calendar"` / `"Custom"` | Tab labels |
| `dayLabel` / `weekLabel` / `monthLabel` | `string` | `"Day"` / `"Week"` / `"Month"` | Calendar unit pills |
| `weekOfLabel` | `string` | `"Week of"` | Prefix for the week step label |
| `lastDaysLabel` | `string` | `"Last {days} days"` | Trigger label for non-preset relative windows |
| `customRangeLabel` | `string` | `"Custom range"` | Trigger label for an incomplete custom range |
| `fromLabel` / `toLabel` | `string` | `"From"` / `"To"` | Custom tab field labels |
| `dialogLabel` | `string` | `"Select date range"` | Popover `aria-label` |
| `relativeGroupLabel` / `calendarGroupLabel` | `string` | `"Relative window"` / `"Calendar period"` | Pill group `aria-label`s |
| `previousMonthLabel` / `nextMonthLabel` | `string` | `"Previous month"` / `"Next month"` | Calendar month-arrow `aria-label`s. The pre-Calendar names `previousPeriodLabel` / `nextPeriodLabel` still work as deprecated aliases |

Date labels on the trigger/stepper format with the browser locale via
`toLocaleDateString`.

## Types and helpers (`range-picker.ts`)

```ts
type RangeSelection =
  | { mode: "relative"; days: number }              // rolling window; 0 = all
  | { mode: "calendar"; unit: "day" | "week" | "month"; anchor: string }
  | { mode: "custom"; from: string; to: string };

interface DateRange { from: string; to: string }    // inclusive bounds
interface RangePreset { label: string; longLabel: string; days: number }
```

| Helper | Purpose |
| --- | --- |
| `resolveRange(sel, earliestDate?)` | Any selection → concrete `DateRange` |
| `presetRange(days, earliestDate?)` | Bounds of a relative preset |
| `periodBounds(unit, anchor)` | Bounds of the day/ISO-week/month containing `anchor` |
| `stepAnchor(unit, anchor, dir)` | Move an anchor one period (month days clamp) |
| `todayStr()` / `daysAgo(n)` / `localDateStr(d)` | Local `YYYY-MM-DD` helpers |
| `allFromDate(earliestDate?)` | "All" lower bound (falls back to one year) |
| `DEFAULT_RANGE_PRESETS` | 7d / 30d / 90d / 1y / All |
