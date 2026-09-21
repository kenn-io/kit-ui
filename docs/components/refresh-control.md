# RefreshControl

Refresh button plus an "Updated Xm ago" label with built-in auto-refresh.
Extracted from agentsview.

The page owns the initial load; this control keeps data fresh afterwards. The
interval is armed at mount without an immediate fetch, a manual click refreshes
now and resets the timer, and the age label ticks forward once a minute without
refetching.

```svelte
<script lang="ts">
  import { RefreshControl } from "@kenn-io/kit-ui";

  let lastUpdatedAt = $state<number | null>(null);
  let busy = $state(false);

  async function refresh() {
    busy = true;
    await refetch();
    lastUpdatedAt = Date.now();
    busy = false;
  }
</script>

<RefreshControl {lastUpdatedAt} {busy} onRefresh={refresh} label="Refresh usage" />
```

## Props

| Prop              | Type                                                     | Default            | Notes                                                 |
| ----------------- | -------------------------------------------------------- | ------------------ | ----------------------------------------------------- |
| `lastUpdatedAt`   | `number \| null`                                         | required           | Epoch ms of last successful fetch                     |
| `onRefresh`       | `() => void`                                             | required           | Called on click and on the interval                   |
| `busy`            | `boolean`                                                | `false`            | Spins the icon, disables the button                   |
| `label`           | `string`                                                 | `"Refresh"`        | aria-label                                            |
| `title`           | `string`                                                 | `label`            | Tooltip                                               |
| `intervalMs`      | `number`                                                 | `300000` (5 min)   | Read once at mount                                    |
| `formatAge`       | `(lastUpdatedAt: number \| null, now: number) => string` | `formatRefreshAge` | Renders the age label; see below                      |
| `locale`          | `string`                                                 | browser locale     | BCP 47 tag for the timestamp tooltip on the age label |
| `ageWidthSamples` | `readonly string[]`                                      | content width      | Reserves the age box width; see below                 |

## Localization

The age label defaults to `formatRefreshAge`'s English strings (`"—"`,
`"Updated just now"`, `"Updated 3m ago"` / `"3h ago"` / `"3d ago"`). Pass
`formatAge` to render localized strings instead; the component calls it with
`lastUpdatedAt` and its once-a-minute clock tick, so the label advances
without a refetch. The tick is clamped to `lastUpdatedAt` (a fresh update can
outrun the minute clock), so formatters can assume a non-negative age:

```svelte
<RefreshControl
  {lastUpdatedAt}
  onRefresh={refresh}
  formatAge={(at, now) =>
    at === null ? m.not_updated() : m.minutes_ago({ count: minutesBetween(at, now) })}
/>
```

The age label's hover tooltip (the full timestamp) formats with the browser
locale, or `locale` when set — pass both `formatAge` and `locale` for a fully
localized control.

The underlying `createRefreshScheduler` / `formatRefreshAge` utilities are also
exported — see [utilities](../utilities.md).

## Fixed-width age label

By default the label hugs its content, so "Updated just now" and "Updated 3m
ago" take different widths and shift whatever follows the control. Pass
`ageWidthSamples` to stop that: the label box reserves the width of its widest
sample (rendered invisibly in the same grid cell, in the consumer's real font
and locale), and any text longer than every sample clips with an ellipsis
instead of growing the box. Include the widest string each variant can
produce, and remember that a localized formatter needs localized samples:

```svelte
<RefreshControl
  {lastUpdatedAt}
  onRefresh={refresh}
  formatAge={formatAgeWithDuration}
  ageWidthSamples={["Not updated", "Updated just now", "Updated 999d ago (99m 59s)"]}
/>
```

The label uses tabular figures, so digits of different values line up.

## Age label tooltip

The age label carries the full timestamp as a native `title`. Pass an
`ageTooltip` snippet to show rich content instead, rendered through
[Tooltip](tooltip.md) on hover and keyboard focus. The snippet replaces the
timestamp, so include it yourself if it still matters:

```svelte
<RefreshControl {lastUpdatedAt} onRefresh={refresh}>
  {#snippet ageTooltip()}
    <dl>
      {#each steps as step}
        <dt>{step.name}</dt>
        <dd>{step.duration}</dd>
      {/each}
    </dl>
  {/snippet}
</RefreshControl>
```
