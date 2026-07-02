<script lang="ts">
  import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
  import { onMount, untrack } from "svelte";
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
  }

  let {
    lastUpdatedAt,
    busy = false,
    onRefresh,
    label = "Refresh",
    title,
    intervalMs = DEFAULT_REFRESH_INTERVAL_MS,
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
  // a data fetch. Seeded once at mount.
  let tick = $state(Date.now());
  const ageLabel = $derived(formatRefreshAge(lastUpdatedAt, tick));

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
  <button
    class="kit-refresh-control__btn"
    class:querying={busy}
    type="button"
    onclick={() => scheduler.refreshNow()}
    disabled={busy}
    title={title ?? label}
    aria-label={label}
  >
    <RefreshCwIcon size="14" strokeWidth="2" aria-hidden="true" />
  </button>
  <div class="kit-refresh-control__status">
    <span
      title={lastUpdatedAt === null
        ? undefined
        : new Date(lastUpdatedAt).toLocaleString()}
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

  .kit-refresh-control__btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: none;
    background: transparent;
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    cursor: pointer;
    transition: background var(--transition-fast), color var(--transition-fast), opacity var(--transition-fast);
  }

  .kit-refresh-control__btn:hover:not(:disabled) {
    background: var(--bg-surface-hover);
    color: var(--text-primary);
  }

  .kit-refresh-control__btn:disabled {
    cursor: default;
    opacity: 0.75;
  }

  .kit-refresh-control__btn.querying :global(svg) {
    animation: kit-refresh-spin 0.8s linear infinite;
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

  @keyframes kit-refresh-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
  /* Normalized keyboard focus (gyp8): one ring token, :focus-visible only. */
  .kit-refresh-control__btn:focus-visible {
    outline: var(--focus-ring);
    outline-offset: 1px;
  }
</style>
