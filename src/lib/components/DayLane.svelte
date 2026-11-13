<script lang="ts">
  import ChevronsDownUpIcon from "@lucide/svelte/icons/chevrons-down-up";
  import ChevronsUpDownIcon from "@lucide/svelte/icons/chevrons-up-down";
  import { tick, type Snippet } from "svelte";
  import {
    DAY_LANE_DEFAULTS,
    hourTicks,
    layoutDayLane,
    layoutDayLanes,
    minuteToY,
    placeTicks,
    type DayLaneEntry,
    type DayLaneItem,
    type DayLaneItemContext,
    type DayLaneLane,
    type DayLaneOverflow,
    type DayLaneSegment,
    type DayLaneTick,
  } from "./day-lane.js";

  interface Props {
    /** The day's items, placed in minutes from the start of the day. */
    items: DayLaneItem[];
    /** Length of the day in minutes: 1440, or 1380 and 1500 on DST days. */
    dayMinutes?: number;
    /** Hour labels. Defaults to one per hour from `formatMinute`; DST days pass their own. */
    ticks?: DayLaneTick[] | undefined;
    /** Renders the inside of one card: title, icons, avatars, badges. */
    item: Snippet<[DayLaneItemContext]>;
    /** Lanes side by side on one axis ("By person"); items pick theirs with `lane`. */
    lanes?: DayLaneLane[] | undefined;
    /** Lane header content; gets the lane and its timed item count. Defaults to the label. */
    laneHeader?: Snippet<[DayLaneLane, number]> | undefined;
    /** Narrowest a lane gets before the view scrolls sideways, in pixels. */
    laneMinWidth?: number;
    /** Pixels per hour. */
    hourHeight?: number;
    /** Smallest card height in pixels; point items get exactly this. */
    minItemHeight?: number;
    /** Side-by-side columns before the rest go into a "+N more" item. */
    maxColumns?: number;
    /** Empty stretches of at least this many minutes fold into a band. 0 turns folding off. */
    foldQuietMinutes?: number;
    /** The current minute of the day. Draws a "now" line; omit on other days. */
    nowMinute?: number | undefined;
    /** Scroll the first timed item into view when `dayKey` changes. */
    scrollToFirst?: boolean;
    /** Identifies the day shown, so a new day scrolls and resets folds. */
    dayKey?: string | number;
    /** Wall-clock text for a minute (folds, "+N more", screen readers).
     * Defaults to the minute as a clock time, right for any day without a DST change. */
    formatMinute?: ((minute: number) => string) | undefined;
    /** BCP 47 tag for the default `formatMinute` and ticks. */
    locale?: string | undefined;
    ariaLabel?: string;
    dateOnlyLabel?: string;
    overflowLabel?: (count: number, from: string) => string;
    foldLabel?: (from: string, to: string, hours: number) => string;
    refoldLabel?: (hours: number) => string;
    /** A card was clicked or chosen with Enter or Space. */
    onselect?: ((id: string) => void) | undefined;
    /** A "+N more" item was chosen; the app shows the list. */
    onoverflow?: ((overflow: { ids: string[]; startMinute: number }) => void) | undefined;
    /** A fold was opened or closed. */
    onfoldchange?:
      | ((fold: { startMinute: number; endMinute: number; expanded: boolean }) => void)
      | undefined;
    class?: string;
  }

  let {
    items,
    dayMinutes = 1440,
    ticks = undefined,
    item,
    lanes = undefined,
    laneHeader = undefined,
    laneMinWidth = 190,
    hourHeight = DAY_LANE_DEFAULTS.hourHeight,
    minItemHeight = DAY_LANE_DEFAULTS.minItemHeight,
    maxColumns = DAY_LANE_DEFAULTS.maxColumns,
    foldQuietMinutes = DAY_LANE_DEFAULTS.foldQuietMinutes,
    nowMinute = undefined,
    scrollToFirst = true,
    dayKey = "",
    formatMinute = undefined,
    locale = undefined,
    ariaLabel = "Day",
    dateOnlyLabel = "Date only",
    overflowLabel = (count, from) => `+${count} more from ${from}`,
    foldLabel = (from, to, hours) => `${from} – ${to} · ${hours} quiet hours`,
    refoldLabel = (hours) => `Fold ${hours} quiet hours`,
    onselect = undefined,
    onoverflow = undefined,
    onfoldchange = undefined,
    class: className = "",
  }: Props = $props();

  let expanded = $state<{ day: string | number; keys: string[] }>({ day: "", keys: [] });
  let activeKey = $state<string | null>(null);
  let scroller = $state<HTMLDivElement>();
  let scrolledFor: string | number | null = null;
  /** Height of the pinned lane headers, so scrolling never hides a card under them. */
  let headsHeight = $state(0);

  // A fixed UTC date turns a minute into a clock time without reading any zone.
  const clock = (minute: number) => new Date(Date.UTC(2000, 0, 1, 0, minute));
  const timeFormat = $derived(
    new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone: "UTC" }),
  );
  const hourFormat = $derived(
    new Intl.DateTimeFormat(locale, { hour: "numeric", timeZone: "UTC" }),
  );
  const timeText = $derived(formatMinute ?? ((m: number) => timeFormat.format(clock(m))));
  const tickList = $derived(
    ticks ?? hourTicks(dayMinutes, (h) => hourFormat.format(clock(h * 60))),
  );

  const expandedFolds = $derived(expanded.day === dayKey ? expanded.keys : []);
  const layout = $derived.by(() => {
    const options = {
      dayMinutes,
      hourHeight,
      minItemHeight,
      maxColumns,
      foldQuietMinutes,
      expandedFolds,
    };
    if (lanes) {
      return layoutDayLanes(
        items,
        lanes.map((l) => l.key),
        options,
      );
    }
    const single = layoutDayLane(items, options);
    return { ...single, lanes: [{ key: "", entries: single.entries }], unassigned: [] };
  });
  const placedTicks = $derived(placeTicks(tickList, layout.segments, hourHeight));

  // Keys carry the lane, since one item can sit in several lanes.
  const keyOf = (entry: DayLaneEntry, lane: string) =>
    entry.kind === "item" ? `${lane}|item:${entry.item.id}` : `${lane}|more:${entry.key}`;
  const dateOnlyKey = (i: DayLaneItem) => `|date:${i.id}`;

  /** Every card on the axis, in reading order: top, then lane, then column. */
  const axisCards = $derived(
    layout.lanes
      .flatMap((lane, laneIndex) =>
        lane.entries.map((entry) => ({ entry, laneIndex, key: keyOf(entry, lane.key) })),
      )
      .sort(
        (a, b) =>
          a.entry.top - b.entry.top || a.laneIndex - b.laneIndex || a.entry.column - b.entry.column,
      ),
  );

  /** Focus order: the date-only strip, then the axis in time order. */
  const order = $derived([...layout.dateOnly.map(dateOnlyKey), ...axisCards.map((c) => c.key)]);
  const tabKey = $derived.by(() => {
    if (activeKey && order.includes(activeKey)) return activeKey;
    const selectedDateOnly = layout.dateOnly.find((i) => i.selected);
    if (selectedDateOnly) return dateOnlyKey(selectedDateOnly);
    const selected = axisCards.find(({ entry }) =>
      entry.kind === "item" ? entry.item.selected : entry.items.some((i) => i.selected),
    );
    return selected?.key ?? order[0] ?? null;
  });

  const nowY = $derived(
    nowMinute !== undefined && nowMinute >= 0 && nowMinute < dayMinutes
      ? minuteToY(layout.segments, nowMinute, hourHeight)
      : null,
  );

  function timeLabel(i: DayLaneItem): string {
    if (i.dateOnly || i.startMinute === undefined) return dateOnlyLabel;
    if (i.endMinute === undefined || i.endMinute <= i.startMinute) return timeText(i.startMinute);
    return `${timeText(i.startMinute)} – ${timeText(i.endMinute)}`;
  }

  function context(
    i: DayLaneItem,
    height: number,
    columns: number,
    point: boolean,
  ): DayLaneItemContext {
    return {
      item: i,
      height,
      columns,
      point,
      dateOnly: !!i.dateOnly,
      compact: height < 40,
    };
  }

  function toggleFold(segment: DayLaneSegment, open: boolean) {
    const key = segment.key;
    if (!key) return;
    const keys = open ? [...expandedFolds, key] : expandedFolds.filter((k) => k !== key);
    expanded = { day: dayKey, keys };
    const [startMinute, endMinute] = key.split("-").map(Number) as [number, number];
    onfoldchange?.({ startMinute, endMinute, expanded: open });
    // The band and its "Fold" button swap places; keep focus on the one that replaced it.
    void tick().then(() =>
      scroller?.querySelector<HTMLElement>(`[data-fold-key="${CSS.escape(key)}"]`)?.focus(),
    );
  }

  function chooseOverflow(entry: DayLaneOverflow) {
    onoverflow?.({ ids: entry.items.map((i) => i.id), startMinute: entry.startMinute });
  }

  function focusKey(key: string) {
    activeKey = key;
    scroller?.querySelector<HTMLElement>(`[data-day-lane-key="${CSS.escape(key)}"]`)?.focus();
  }

  function onkeydown(event: KeyboardEvent) {
    const el = (event.target as HTMLElement).closest<HTMLElement>("[data-day-lane-key]");
    const key = el?.dataset["dayLaneKey"];
    if (!key) return;
    const index = order.indexOf(key);
    let next: number;
    switch (event.key) {
      case "ArrowDown":
      case "ArrowRight":
        next = index + 1;
        break;
      case "ArrowUp":
      case "ArrowLeft":
        next = index - 1;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = order.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const target = order[Math.max(0, Math.min(order.length - 1, next))];
    if (target) focusKey(target);
  }

  // Bring the first timed item into view once per day, as soon as there is one.
  $effect(() => {
    const first = axisCards[0];
    const day = dayKey;
    if (!scrollToFirst || !scroller || !first || scrolledFor === day) return;
    scrolledFor = day;
    const el = scroller.querySelector<HTMLElement>(
      `[data-day-lane-key="${CSS.escape(first.key)}"]`,
    );
    if (!el) return;
    const top = scroller.getBoundingClientRect().top - scroller.scrollTop;
    const offset = el.getBoundingClientRect().top - top - headsHeight - hourHeight / 4;
    // Near the top already: keep the date-only strip whole rather than half scrolled away.
    const axis = scroller.querySelector<HTMLElement>(".kit-day-lane__axis");
    const axisTop = axis ? axis.getBoundingClientRect().top - top : 0;
    scroller.scrollTop = offset <= axisTop - headsHeight ? 0 : offset;
  });
</script>

{#snippet card(entry: DayLaneEntry, key: string)}
  {#if entry.kind === "item"}
    <button
      type="button"
      class={[
        "kit-day-lane__item",
        entry.item.tone && `kit-day-lane__item--tone-${entry.item.tone}`,
        entry.item.dimmed && "kit-day-lane__item--dimmed",
        entry.height < 40 && "kit-day-lane__item--compact",
        entry.clippedStart && "kit-day-lane__item--clipped-start",
        entry.clippedEnd && "kit-day-lane__item--clipped-end",
      ]}
      style:top="{entry.top + 1}px"
      style:height="{entry.height - 2}px"
      style:left="calc({entry.column} * 100% / {entry.columns})"
      style:width="calc(100% / {entry.columns} - 4px)"
      aria-pressed={!!entry.item.selected}
      tabindex={tabKey === key ? 0 : -1}
      data-day-lane-key={key}
      onfocus={() => (activeKey = key)}
      onclick={() => onselect?.(entry.item.id)}
    >
      {@render item(context(entry.item, entry.height - 2, entry.columns, entry.point))}
      <span class="kit-sr-only">, {timeLabel(entry.item)}</span>
    </button>
  {:else}
    <button
      type="button"
      class={[
        "kit-day-lane__item",
        "kit-day-lane__more",
        entry.items.every((i) => i.dimmed) && "kit-day-lane__item--dimmed",
      ]}
      style:top="{entry.top + 1}px"
      style:height="{entry.height - 2}px"
      style:left="calc({entry.column} * 100% / {entry.columns})"
      style:width="calc(100% / {entry.columns} - 4px)"
      aria-pressed={entry.items.some((i) => i.selected)}
      tabindex={tabKey === key ? 0 : -1}
      data-day-lane-key={key}
      onfocus={() => (activeKey = key)}
      onclick={() => chooseOverflow(entry)}
    >
      {overflowLabel(entry.items.length, timeText(entry.startMinute))}
    </button>
  {/if}
{/snippet}

<!-- The group only routes arrow keys between its card buttons (roving focus). -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  bind:this={scroller}
  class={["kit-day-lane", lanes && "kit-day-lane--lanes", className]}
  style:--kit-day-lane-count={layout.lanes.length}
  style:--kit-day-lane-min="{laneMinWidth}px"
  style:--kit-day-lane-heads="{headsHeight}px"
  role="group"
  aria-label={ariaLabel}
  {onkeydown}
>
  {#if layout.dateOnly.length}
    <div class="kit-day-lane__date-only">
      <span class="kit-day-lane__gutter-label">{dateOnlyLabel}</span>
      <div class="kit-day-lane__strip">
        {#each layout.dateOnly as i (i.id)}
          {@const key = dateOnlyKey(i)}
          <button
            type="button"
            class={[
              "kit-day-lane__item",
              "kit-day-lane__item--date-only",
              i.tone && `kit-day-lane__item--tone-${i.tone}`,
              i.dimmed && "kit-day-lane__item--dimmed",
            ]}
            style:min-height="{minItemHeight}px"
            aria-pressed={!!i.selected}
            tabindex={tabKey === key ? 0 : -1}
            data-day-lane-key={key}
            onfocus={() => (activeKey = key)}
            onclick={() => onselect?.(i.id)}
          >
            {@render item(context(i, minItemHeight, 1, true))}
            <span class="kit-sr-only">, {dateOnlyLabel}</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}

  {#if lanes}
    <div class="kit-day-lane__lane-heads" bind:clientHeight={headsHeight}>
      {#each lanes as lane, index (lane.key)}
        {@const count =
          layout.lanes[index]?.entries.reduce(
            (n, e) => n + (e.kind === "item" ? 1 : e.items.length),
            0,
          ) ?? 0}
        <div class="kit-day-lane__lane-head">
          {#if laneHeader}
            {@render laneHeader(lane, count)}
          {:else}
            <span class="kit-day-lane__lane-label">{lane.label}</span>
            <span class="kit-day-lane__lane-count">{count}</span>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  <div class="kit-day-lane__axis" style:height="{layout.height}px">
    <!-- A folded band already names its first hour, so its tick stays unlabelled. -->
    {#each placedTicks as tick, index (index)}
      {#if !tick.atFold}
        <span class="kit-day-lane__hour-label" style:top="{tick.top}px">{tick.label}</span>
        <i class="kit-day-lane__hour-line" style:top="{tick.top}px" aria-hidden="true"></i>
      {/if}
    {/each}

    {#each layout.segments as segment (segment.startMinute)}
      {#if segment.kind === "fold"}
        <button
          type="button"
          class="kit-day-lane__fold"
          style:top="{segment.top + 3}px"
          style:height="{segment.height - 6}px"
          aria-expanded="false"
          data-fold-key={segment.key}
          onclick={() => toggleFold(segment, true)}
        >
          <ChevronsUpDownIcon size={13} aria-hidden="true" />
          {foldLabel(
            timeText(segment.startMinute),
            timeText(segment.endMinute),
            segment.foldHours ?? 0,
          )}
        </button>
      {:else if segment.key}
        <button
          type="button"
          class="kit-day-lane__refold"
          style:top="{segment.top + 4}px"
          aria-expanded="true"
          data-fold-key={segment.key}
          onclick={() => toggleFold(segment, false)}
        >
          <ChevronsDownUpIcon size={12} aria-hidden="true" />
          {refoldLabel(segment.foldHours ?? 0)}
        </button>
      {/if}
    {/each}

    {#if !lanes}
      {#each layout.lanes[0]?.entries ?? [] as entry, index (index)}
        {#if entry.kind === "item" && entry.point}
          <i
            class={[
              "kit-day-lane__tick",
              entry.item.tone && `kit-day-lane__item--tone-${entry.item.tone}`,
            ]}
            style:top="{entry.top}px"
            aria-hidden="true"
          ></i>
        {/if}
      {/each}
    {/if}

    <div class="kit-day-lane__lanes">
      {#each layout.lanes as lane, index (lane.key)}
        <!-- Each lane is a named group, so a screen reader says whose lane a card is in. -->
        <div
          class="kit-day-lane__lane"
          role={lanes ? "group" : undefined}
          aria-label={lanes?.[index]?.label}
        >
          {#each lane.entries as entry (keyOf(entry, lane.key))}
            {@render card(entry, keyOf(entry, lane.key))}
          {/each}
        </div>
      {/each}
    </div>

    {#if nowY !== null}
      <div class="kit-day-lane__now" style:top="{nowY}px" aria-hidden="true"></div>
    {/if}
  </div>
</div>

<style>
  .kit-day-lane {
    --kit-day-lane-gutter: 56px;
    --kit-day-lane-accent: var(--border-default);
    position: relative;
    height: 100%;
    overflow: auto;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-family: var(--font-sans);
  }

  .kit-day-lane__date-only {
    display: flex;
    align-items: flex-start;
    gap: var(--space-4);
    padding: var(--space-4) var(--space-4) var(--space-4) 0;
    border-bottom: 1px solid var(--border-muted);
  }

  .kit-day-lane__gutter-label {
    flex: none;
    width: calc(var(--kit-day-lane-gutter) - var(--space-4));
    padding-top: var(--space-3);
    text-align: right;
    font-size: var(--font-size-xs);
    color: var(--text-muted);
  }

  .kit-day-lane__strip {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    min-width: 0;
  }

  .kit-day-lane__axis {
    position: relative;
    margin-block: var(--space-4);
  }

  .kit-day-lane__hour-label {
    position: absolute;
    left: 0;
    width: calc(var(--kit-day-lane-gutter) - var(--space-4));
    transform: translateY(-50%);
    text-align: right;
    font-size: var(--font-size-xs);
    font-variant-numeric: tabular-nums;
    color: var(--text-muted);
    white-space: nowrap;
    pointer-events: none;
  }

  .kit-day-lane__hour-line {
    position: absolute;
    left: var(--kit-day-lane-gutter);
    right: 0;
    border-top: 1px dashed color-mix(in srgb, var(--text-primary) 12%, transparent);
    pointer-events: none;
  }

  .kit-day-lane__fold {
    position: absolute;
    left: var(--kit-day-lane-gutter);
    right: var(--space-4);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    border: 1px dashed var(--border-default);
    border-radius: var(--radius-sm);
    background: var(--bg-inset);
    color: var(--text-secondary);
    font: inherit;
    font-size: var(--font-size-xs);
    cursor: pointer;
  }

  .kit-day-lane__fold:hover {
    background: var(--bg-surface-hover);
    color: var(--text-primary);
  }

  .kit-day-lane__refold {
    position: absolute;
    right: var(--space-4);
    z-index: 2;
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--border-muted);
    border-radius: var(--radius-sm);
    background: var(--bg-surface);
    color: var(--text-secondary);
    font: inherit;
    font-size: var(--font-size-xs);
    cursor: pointer;
  }

  .kit-day-lane__refold:hover {
    color: var(--text-primary);
  }

  .kit-day-lane__tick {
    position: absolute;
    left: calc(var(--kit-day-lane-gutter) - var(--space-3));
    width: var(--space-3);
    height: 2px;
    margin-top: -1px;
    border-radius: 1px;
    background: var(--kit-day-lane-accent);
    pointer-events: none;
  }

  .kit-day-lane__lanes {
    position: absolute;
    inset: 0 var(--space-4) 0 var(--kit-day-lane-gutter);
    display: grid;
    grid-template-columns: repeat(var(--kit-day-lane-count), minmax(0, 1fr));
    /* Empty lane space lets clicks through to the fold bands underneath. */
    pointer-events: none;
  }

  .kit-day-lane__lane {
    position: relative;
    min-width: 0;
  }

  /* Several lanes: each keeps a minimum width and the view scrolls sideways. */
  .kit-day-lane--lanes .kit-day-lane__axis,
  .kit-day-lane--lanes .kit-day-lane__lane-heads {
    min-width: calc(
      var(--kit-day-lane-gutter) + var(--kit-day-lane-count) * var(--kit-day-lane-min) +
        var(--space-4)
    );
  }

  /* The band can be wider than the view; keep its text where it can be read. */
  .kit-day-lane--lanes .kit-day-lane__fold {
    justify-content: flex-start;
    padding-inline: var(--space-5);
  }

  /* Keyboard focus scrolls a card clear of the pinned headers. */
  .kit-day-lane--lanes .kit-day-lane__item {
    scroll-margin-top: calc(var(--kit-day-lane-heads) + var(--space-4));
  }

  .kit-day-lane--lanes .kit-day-lane__lane + .kit-day-lane__lane {
    border-left: 1px solid var(--border-muted);
  }

  .kit-day-lane__lane-heads {
    /* Its padding is part of the min-width it shares with the axis. */
    box-sizing: border-box;
    position: sticky;
    top: 0;
    z-index: 4;
    display: grid;
    grid-template-columns: repeat(var(--kit-day-lane-count), minmax(0, 1fr));
    padding: 0 var(--space-4) 0 var(--kit-day-lane-gutter);
    border-bottom: 1px solid var(--border-muted);
    background: var(--bg-primary);
  }

  .kit-day-lane__lane-head {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
    padding: var(--space-4) var(--space-4);
    font-size: var(--font-size-sm);
  }

  .kit-day-lane__lane-head + .kit-day-lane__lane-head {
    border-left: 1px solid var(--border-muted);
  }

  .kit-day-lane__lane-label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: var(--font-weight-medium);
  }

  .kit-day-lane__lane-count {
    color: var(--text-muted);
    font-size: var(--font-size-xs);
    font-variant-numeric: tabular-nums;
  }

  .kit-day-lane__lane > .kit-day-lane__item {
    pointer-events: auto;
  }

  .kit-day-lane__item {
    position: absolute;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    gap: var(--space-1);
    min-width: 0;
    margin: 0;
    padding: var(--space-3) var(--space-4) var(--space-3) calc(var(--space-4) + 3px);
    overflow: hidden;
    border: 1px solid var(--card-border);
    border-radius: var(--radius-sm);
    /* The accent bar is a straight stripe: square the edge it runs along. */
    border-start-start-radius: 0;
    border-end-start-radius: 0;
    background: color-mix(in srgb, var(--kit-day-lane-accent) 6%, var(--bg-surface));
    box-shadow: inset 3px 0 0 var(--kit-day-lane-accent);
    color: var(--text-primary);
    font: inherit;
    font-size: var(--font-size-sm);
    text-align: left;
    cursor: pointer;
    box-sizing: border-box;
    outline-offset: 1px;
    transition:
      opacity 150ms ease-out,
      box-shadow 150ms ease-out;
  }

  .kit-day-lane__lane .kit-day-lane__item {
    /* Two pixels of air on each side of every column. */
    margin-inline: 2px;
  }

  .kit-day-lane__item--date-only {
    position: relative;
    width: 16rem;
    max-width: 100%;
  }

  .kit-day-lane__item:hover {
    background: color-mix(in srgb, var(--kit-day-lane-accent) 10%, var(--bg-surface-hover));
  }

  .kit-day-lane__item[aria-pressed="true"] {
    border-start-start-radius: 0;
    border-end-start-radius: 0;
    box-shadow:
      inset 3px 0 0 var(--kit-day-lane-accent),
      0 0 0 2px var(--accent-blue);
    z-index: 1;
  }

  .kit-day-lane__item--compact {
    justify-content: center;
    padding-block: 0;
  }

  .kit-day-lane__item--dimmed {
    opacity: 0.35;
  }

  .kit-day-lane__item--clipped-start {
    border-top-style: dashed;
    border-top-left-radius: 0;
    border-top-right-radius: 0;
  }

  .kit-day-lane__item--clipped-end {
    border-bottom-style: dashed;
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }

  .kit-day-lane__more {
    justify-content: center;
    border-style: dashed;
    border-color: var(--border-default);
    background: var(--bg-inset);
    box-shadow: none;
    color: var(--text-secondary);
    font-size: var(--font-size-xs);
    line-height: 1.25;
  }

  .kit-day-lane__more[aria-pressed="true"] {
    box-shadow: 0 0 0 2px var(--accent-blue);
  }

  .kit-day-lane__now {
    position: absolute;
    left: calc(var(--kit-day-lane-gutter) - var(--space-2));
    right: 0;
    z-index: 3;
    border-top: 2px solid var(--accent-red);
    pointer-events: none;
  }

  .kit-day-lane__now::before {
    content: "";
    position: absolute;
    left: 0;
    top: -5px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent-red);
  }

  .kit-day-lane__item--tone-info {
    --kit-day-lane-accent: var(--accent-blue);
  }
  .kit-day-lane__item--tone-success {
    --kit-day-lane-accent: var(--accent-green);
  }
  .kit-day-lane__item--tone-warning {
    --kit-day-lane-accent: var(--accent-amber);
  }
  .kit-day-lane__item--tone-danger {
    --kit-day-lane-accent: var(--accent-red);
  }
  .kit-day-lane__item--tone-merged {
    --kit-day-lane-accent: var(--accent-purple);
  }
  .kit-day-lane__item--tone-workspace {
    --kit-day-lane-accent: var(--accent-teal, var(--accent-green));
  }
  .kit-day-lane__item--tone-neutral,
  .kit-day-lane__item--tone-muted,
  .kit-day-lane__item--tone-canceled {
    --kit-day-lane-accent: var(--text-muted);
  }

  @media (prefers-reduced-motion: reduce) {
    .kit-day-lane__item {
      transition: none;
    }
  }
</style>
