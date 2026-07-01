# RangePicker

Date-range trigger + popover with three tabs: **Relative** (rolling "last N
days" pills), **Calendar** (a day/week/month period you can step through), and
**Custom** (explicit from/to date inputs). Ported from agentsview's shared
`RangePicker`, decoupled from its stores and i18n.

The component is controlled: you hold a `RangeSelection` and it calls
`onSelect` with a new one on every edit. `resolveRange()` turns any selection
into concrete inclusive `{from, to}` bounds (local-timezone `YYYY-MM-DD`
strings). Escape and outside clicks dismiss the popover.

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
| `maxDate` | `string \| null` | `null` | Disables stepping the calendar past this date |
| `block` | `boolean` | `false` | Trigger/panel stretch to the container width |
| `presets` | `RangePreset[]` | `DEFAULT_RANGE_PRESETS` | Relative pills (`{ label, longLabel, days }`; `days: 0` = all-time) |
| `relativeTabLabel` / `calendarTabLabel` / `customTabLabel` | `string` | `"Relative"` / `"Calendar"` / `"Custom"` | Tab labels |
| `dayLabel` / `weekLabel` / `monthLabel` | `string` | `"Day"` / `"Week"` / `"Month"` | Calendar unit pills |
| `weekOfLabel` | `string` | `"Week of"` | Prefix for the week step label |
| `lastDaysLabel` | `string` | `"Last {days} days"` | Trigger label for non-preset relative windows |
| `customRangeLabel` | `string` | `"Custom range"` | Trigger label for an incomplete custom range |
| `fromLabel` / `toLabel` | `string` | `"From"` / `"To"` | Custom tab field labels |
| `dialogLabel` | `string` | `"Select date range"` | Popover `aria-label` |
| `relativeGroupLabel` / `calendarGroupLabel` | `string` | `"Relative window"` / `"Calendar period"` | Pill group `aria-label`s |
| `previousPeriodLabel` / `nextPeriodLabel` | `string` | `"Previous period"` / `"Next period"` | Stepper arrow `aria-label`s |

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
