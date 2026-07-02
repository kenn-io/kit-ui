<script lang="ts">
  import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
  import { onMount, untrack } from "svelte";
  import IconButton from "./IconButton.svelte";
  import {
    createRefreshScheduler,
    DEFAULT_REFRESH_INTERVAL_MS,
    formatRefreshAge,
  } from "../utils/refresh.js";

  // Re-evaluate the relative age label this often so it advances without a
  // data fetch.
  const REFRESH_LABEL_INTERVAL_MS = 60 * 1000;

  interface Props {
    /** Epoch ms of the last successful fetch, or null before the first load. */
    lastUpdatedAt: number | null;
    /** Spins the icon and disables the button while a refresh is in flight. */
    busy?: boolean;
    /** Refetches the data; invoked on the interval and on click. */
    onRefresh: () => void;
    /** Accessible name for the button (aria-label). */
    label?: string;
    /** Tooltip text; defaults to `label` when omitted. */
    title?: string;
    /** Auto-refresh cadence in ms; defaults to 5 minutes. */
    intervalMs?: number;
    /** Renders the age label; override to localize the default English
     * `formatRefreshAge` strings ("Updated 3m ago", …). `now` is the
     * component's minute clock tick, clamped so it is never earlier than
     * `lastUpdatedAt` — formatters can assume a non-negative age.
     * (`| undefined` keeps forwarding consumers with
     * exactOptionalPropertyTypes happy.) */
    formatAge?: ((lastUpdatedAt: number | null, now: number) => string) | undefined;
    /** BCP 47 tag for the timestamp tooltip on the age label, for apps whose
     * language setting can diverge from the browser locale. Omitted =
     * browser locale. Must be a valid tag — `toLocaleString` throws on
     * malformed input. */
    locale?: string | undefined;
  }

  let {
    lastUpdatedAt,
    busy = false,
    onRefresh,
    label = "Refresh",
    title,
    intervalMs = DEFAULT_REFRESH_INTERVAL_MS,
    formatAge = formatRefreshAge,
    locale = undefined,
  }: Props = $props();

  // The page owns the initial load — it alone knows when its URL/filter state
  // is hydrated — so this control only keeps the data fresh afterward. Arm the
  // interval without an immediate fetch (scheduleNext, not refreshNow) so the
  // first auto-refresh lands one interval out instead of racing the page's
  // mount; a manual click refreshes now and resets that timer. intervalMs is
  // read once at setup (untrack); a live cadence change would need a fresh
  // scheduler.
  const scheduler = createRefreshScheduler(
    () => onRefresh(),
    untrack(() => intervalMs),
  );

  // Local clock that ticks once a minute so the age label re-derives without
  // a data fetch. Seeded once at mount. A fresh lastUpdatedAt can outrun the
  // clock by up to a tick, so clamp `now` to it — otherwise formatAge would
  // see a negative age right after a refresh.
  let tick = $state(Date.now());
  const ageLabel = $derived(
    formatAge(lastUpdatedAt, lastUpdatedAt === null ? tick : Math.max(tick, lastUpdatedAt)),
  );

  onMount(() => {
    scheduler.scheduleNext();
    let labelTimer: ReturnType<typeof setTimeout> | undefined;
    function scheduleLabelTick() {
      labelTimer = setTimeout(() => {
        tick = Date.now();
        scheduleLabelTick();
      }, REFRESH_LABEL_INTERVAL_MS);
    }
    scheduleLabelTick();
    return () => {
      scheduler.stop();
      if (labelTimer !== undefined) clearTimeout(labelTimer);
    };
  });
</script>

<div class="kit-refresh-control">
  <IconButton
    class={busy ? "kit-refresh-control__btn querying" : "kit-refresh-control__btn"}
    onclick={() => scheduler.refreshNow()}
    disabled={busy}
    title={title ?? label}
    ariaLabel={label}
  >
    <RefreshCwIcon size="14" strokeWidth="2" aria-hidden="true" />
  </IconButton>
  <div class="kit-refresh-control__status">
    <span
      title={lastUpdatedAt === null ? undefined : new Date(lastUpdatedAt).toLocaleString(locale)}
    >
      {ageLabel}
    </span>
  </div>
</div>

<style>
  .kit-refresh-control {
    min-height: 28px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  /* The button chrome is a stock IconButton (md = 28px); only the busy
   * spin lives here (kit-spin comes from theme.css). Busy keeps a lighter
   * dim than the standard disabled opacity so the spinner stays visible
   * (documented exception in docs/theming.md). */
  .kit-refresh-control :global(.kit-refresh-control__btn:disabled) {
    opacity: 0.75;
  }

  .kit-refresh-control :global(.kit-refresh-control__btn.querying svg) {
    animation: kit-spin 0.8s linear infinite;
  }

  .kit-refresh-control__status {
    min-height: 24px;
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text-muted);
    font-size: var(--font-size-xs);
    white-space: nowrap;
  }
</style>
