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
    /** Strings the age box must be able to show without changing width.
     * The box reserves the width of the widest sample and clips anything
     * longer with an ellipsis, so swapping label variants ("Updated just
     * now" -> "Updated 3m ago") never moves whatever is laid out after the
     * control. Omitted = the box hugs its content. */
    ageWidthSamples?: readonly string[] | undefined;
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
    ageWidthSamples = undefined,
  }: Props = $props();

  const ageReserved = $derived(ageWidthSamples !== undefined && ageWidthSamples.length > 0);

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
      class={ageReserved
        ? "kit-refresh-control__age kit-refresh-control__box kit-refresh-control__box--reserved"
        : "kit-refresh-control__age kit-refresh-control__box"}
      title={lastUpdatedAt === null ? undefined : new Date(lastUpdatedAt).toLocaleString(locale)}
    >
      <span class="kit-refresh-control__text">{ageLabel}</span>
      {#if ageReserved}
        {#each ageWidthSamples ?? [] as sample}
          <span class="kit-refresh-control__sample" aria-hidden="true">{sample}</span>
        {/each}
      {/if}
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
    font-variant-numeric: tabular-nums;
  }

  /* The age box is a one-cell grid: the visible text and the hidden width
   * samples all occupy cell 1/1, so the box is as wide as the widest of
   * them and never changes when the text does. */
  .kit-refresh-control__box {
    display: inline-grid;
    min-width: 0;
  }

  .kit-refresh-control__box > * {
    grid-area: 1 / 1;
  }

  .kit-refresh-control__sample {
    visibility: hidden;
    pointer-events: none;
  }

  /* With samples present the text contributes nothing to the box's
   * intrinsic width (width: 0) and then stretches to the sample-set width
   * (min-width: 100%), so even a string longer than every sample cannot
   * grow the box; it clips with an ellipsis instead. */
  .kit-refresh-control__box--reserved > .kit-refresh-control__text {
    width: 0;
    min-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
