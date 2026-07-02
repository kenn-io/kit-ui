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

| Prop            | Type                                                     | Default            | Notes                                                 |
| --------------- | -------------------------------------------------------- | ------------------ | ----------------------------------------------------- |
| `lastUpdatedAt` | `number \| null`                                         | required           | Epoch ms of last successful fetch                     |
| `onRefresh`     | `() => void`                                             | required           | Called on click and on the interval                   |
| `busy`          | `boolean`                                                | `false`            | Spins the icon, disables the button                   |
| `label`         | `string`                                                 | `"Refresh"`        | aria-label                                            |
| `title`         | `string`                                                 | `label`            | Tooltip                                               |
| `intervalMs`    | `number`                                                 | `300000` (5 min)   | Read once at mount                                    |
| `formatAge`     | `(lastUpdatedAt: number \| null, now: number) => string` | `formatRefreshAge` | Renders the age label; see below                      |
| `locale`        | `string`                                                 | browser locale     | BCP 47 tag for the timestamp tooltip on the age label |

## Localization

The age label defaults to `formatRefreshAge`'s English strings (`"—"`,
`"Updated just now"`, `"Updated 3m ago"` / `"3h ago"` / `"3d ago"`). Pass
`formatAge` to render localized strings instead; the component calls it with
`lastUpdatedAt` and its once-a-minute clock tick, so the label advances
without a refetch:

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
