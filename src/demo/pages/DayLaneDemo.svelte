<script lang="ts">
  import FileTextIcon from "@lucide/svelte/icons/file-text";
  import MailIcon from "@lucide/svelte/icons/mail";
  import MessageSquareIcon from "@lucide/svelte/icons/message-square";
  import PhoneIcon from "@lucide/svelte/icons/phone";
  import VideoIcon from "@lucide/svelte/icons/video";
  import {
    Checkbox,
    DayLane,
    SegmentedControl,
    type ChipTone,
    type DayLaneItem,
    type DayLaneTick,
  } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  type Kind = "email" | "chat" | "meeting" | "call" | "document";
  interface Entry {
    id: string;
    kind: Kind;
    title: string;
    start?: number;
    end?: number;
    dateOnly?: boolean;
    count?: number;
    people: string[];
  }

  const KIND_TONE: Record<Kind, ChipTone> = {
    email: "info",
    chat: "workspace",
    meeting: "merged",
    call: "warning",
    document: "danger",
  };
  const KIND_ICON = {
    email: MailIcon,
    chat: MessageSquareIcon,
    meeting: VideoIcon,
    call: PhoneIcon,
    document: FileTextIcon,
  };
  const t = (h: number, m = 0) => h * 60 + m;

  // An invented warehouse day: a burst of overlapping work around 9 AM,
  // a quiet midday that folds, an afternoon thread and a late chat.
  const busyDay: Entry[] = [
    {
      id: "receipt",
      kind: "document",
      title: "Signed delivery receipt.pdf",
      dateOnly: true,
      people: ["MO", "DR"],
    },
    {
      id: "night",
      kind: "chat",
      title: "Night shift handover",
      start: t(-1, 10),
      end: t(0, 25),
      count: 5,
      people: ["SK"],
    },
    {
      id: "floor-1",
      kind: "chat",
      title: "#warehouse-floor",
      start: t(7, 40),
      end: t(8, 5),
      count: 6,
      people: ["DR", "MO", "CF"],
    },
    {
      id: "container",
      kind: "email",
      title: "Container BRKU 448120: customs hold",
      start: t(8, 30),
      end: t(8, 52),
      count: 3,
      people: ["IA", "MO", "TV"],
    },
    {
      id: "dock",
      kind: "document",
      title: "Dock schedule week 11.xlsx",
      start: t(8, 47),
      people: ["DR"],
    },
    {
      id: "standup",
      kind: "meeting",
      title: "Shipment status standup",
      start: t(9, 0),
      end: t(9, 45),
      people: ["MO", "DR", "CF", "JP"],
    },
    {
      id: "call",
      kind: "call",
      title: "Call: Jory and Dev",
      start: t(9, 20),
      end: t(9, 26),
      people: ["JP", "DR"],
    },
    {
      id: "pallets",
      kind: "email",
      title: "Re: pallet count",
      start: t(9, 30),
      count: 2,
      people: ["IA", "CF"],
    },
    { id: "dock4", kind: "chat", title: "Dock 4", start: t(9, 31), count: 3, people: ["TV", "SK"] },
    {
      id: "forklift",
      kind: "document",
      title: "Forklift log.csv",
      start: t(9, 40),
      people: ["SK"],
    },
    {
      id: "mara-teodor",
      kind: "chat",
      title: "Mara and Teodor",
      start: t(10, 15),
      end: t(10, 40),
      count: 4,
      people: ["TV", "MO"],
    },
    {
      id: "pallet-v3",
      kind: "document",
      title: "Pallet count v3.xlsx",
      start: t(10, 31),
      people: ["CF"],
    },
    {
      id: "damage",
      kind: "email",
      title: "Damage report: 38 pallets",
      start: t(14, 5),
      end: t(14, 50),
      count: 4,
      people: ["DR", "MO", "IA", "LB"],
    },
    {
      id: "inspection",
      kind: "document",
      title: "Damage inspection notes.md",
      start: t(14, 20),
      people: ["IA"],
    },
    {
      id: "carrier",
      kind: "meeting",
      title: "Carrier review",
      start: t(16, 0),
      end: t(17, 10),
      people: ["MO", "JP", "LB"],
    },
    {
      id: "floor-2",
      kind: "chat",
      title: "#warehouse-floor",
      start: t(21, 30),
      count: 2,
      people: ["DR"],
    },
  ];

  const byId = new Map(busyDay.map((e) => [e.id, e]));

  let selected = $state<string | null>("standup");
  let fold = $state(true);
  let showNow = $state(true);
  let columns = $state("3");
  let dimChats = $state(false);
  let dst = $state("24");
  let opened = $state<string[] | null>(null);
  let lastEvent = $state("none yet");

  const dayMinutes = $derived(dst === "23" ? 1380 : dst === "25" ? 1500 : 1440);
  const hourLabel = (h: number) =>
    (h % 12 === 0 ? 12 : h % 12) + (h < 12 || h === 24 ? " AM" : " PM");
  // On a DST day the app labels each elapsed hour with its wall-clock time.
  const ticks = $derived.by<DayLaneTick[]>(() => {
    const wall =
      dst === "23"
        ? [0, 1, ...Array.from({ length: 21 }, (_, i) => i + 3)]
        : dst === "25"
          ? [0, 1, 1, ...Array.from({ length: 22 }, (_, i) => i + 2)]
          : Array.from({ length: 24 }, (_, i) => i);
    return wall.map((h, i) => ({ minute: i * 60, label: hourLabel(h) }));
  });

  const items = $derived<DayLaneItem[]>(
    busyDay.map((e) => ({
      id: e.id,
      dateOnly: e.dateOnly,
      startMinute: e.start,
      endMinute: e.end,
      tone: KIND_TONE[e.kind],
      selected: e.id === selected,
      dimmed: dimChats && e.kind === "chat",
    })),
  );

  function wallClock(minute: number): string {
    const m = ((minute % 1440) + 1440) % 1440;
    const h = Math.floor(m / 60);
    return `${h % 12 === 0 ? 12 : h % 12}:${String(m % 60).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  }
  // The app's own wall-clock text, shifted after 2 AM on a DST day.
  const shift = $derived(dst === "23" ? 60 : dst === "25" ? -60 : 0);
  const clock = (minute: number) => wallClock(minute >= 120 ? minute + shift : minute);

  function timeOf(e: Entry): string {
    if (e.dateOnly || e.start === undefined) return "Date only";
    return e.end === undefined ? clock(e.start) : `${clock(e.start)} – ${clock(e.end)}`;
  }

  // A stress day: 400 generated items, to show the layout keeps up.
  let seed = 11;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const stressItems: DayLaneItem[] = Array.from({ length: 400 }, (_, i) => {
    const startMinute = Math.round(t(6) + rand() * 15 * 60);
    const ranged = rand() < 0.4;
    return {
      id: `s${i}`,
      startMinute,
      endMinute: ranged ? startMinute + Math.round(10 + rand() * 80) : undefined,
      tone: (["info", "workspace", "merged", "warning", "danger"] as const)[i % 5],
    };
  });
  let stressSelected = $state<string | null>(null);

  // By person: one lane per person, busiest first; an item sits in the lane
  // of everyone in it.
  const PEOPLE: Record<string, string> = {
    MO: "Mara Okafor",
    DR: "Dev Rao",
    IA: "Ines Alba",
    CF: "Callum Fenn",
    TV: "Teodor Vask",
    JP: "Jory Pell",
    SK: "Sunniva Kraal",
    LB: "Lotte Beer",
  };
  const personLanes = Object.keys(PEOPLE)
    .map((key) => ({
      key,
      label: PEOPLE[key]!,
      count: busyDay.filter((e) => !e.dateOnly && e.people.includes(key)).length,
    }))
    .sort((a, b) => b.count - a.count)
    .map(({ key, label }) => ({ key, label }));
  let laneSelected = $state<string | null>("standup");
  let laneEvent = $state("none yet");
  const laneItems = $derived<DayLaneItem[]>(
    busyDay.map((e) => ({
      id: e.id,
      dateOnly: e.dateOnly,
      startMinute: e.start,
      endMinute: e.end,
      lane: e.people,
      tone: KIND_TONE[e.kind],
      selected: e.id === laneSelected,
    })),
  );
</script>

<DemoSection
  title="Busy day"
  description="Items are placed in minutes from the start of the day; the app supplies the day's length and hour labels, so DST days need no zone math here. Overlaps sit side by side up to maxColumns, then a '+N more' item. Two empty hours or more fold into a band. Arrow keys move between cards in time order; Enter selects."
  code={`<DayLane
  {items}
  dayMinutes={1440}
  nowMinute={14 * 60 + 35}
  onselect={(id) => (selected = id)}
  onoverflow={({ ids }) => openList(ids)}
>
  {#snippet item({ item, compact })}
    <span class="title">{titles[item.id]}</span>
    {#if !compact}<span class="time">{times[item.id]}</span>{/if}
  {/snippet}
</DayLane>`}
>
  <div class="controls">
    <SegmentedControl
      ariaLabel="Day length"
      options={[
        { value: "24", label: "24 h" },
        { value: "23", label: "23 h (spring)" },
        { value: "25", label: "25 h (fall)" },
      ]}
      value={dst}
      onchange={(v) => (dst = v)}
    />
    <SegmentedControl
      ariaLabel="Columns"
      options={[
        { value: "2", label: "2 columns" },
        { value: "3", label: "3 columns" },
        { value: "4", label: "4 columns" },
      ]}
      value={columns}
      onchange={(v) => (columns = v)}
    />
    <Checkbox bind:checked={fold} label="Fold quiet hours" />
    <Checkbox bind:checked={showNow} label="Now line" />
    <Checkbox bind:checked={dimChats} label="Dim chats" />
  </div>
  <div class="layout">
    <div class="frame" data-testid="day-lane-busy">
      <DayLane
        {items}
        {dayMinutes}
        {ticks}
        formatMinute={clock}
        maxColumns={Number(columns)}
        foldQuietMinutes={fold ? 120 : 0}
        nowMinute={showNow ? t(14, 35) : undefined}
        dayKey={`busy-${dst}`}
        ariaLabel="Tuesday, March 10"
        onselect={(id) => {
          selected = id;
          opened = null;
          lastEvent = `select ${id}`;
        }}
        onoverflow={({ ids, startMinute }) => {
          opened = ids;
          lastEvent = `overflow ${ids.length} from ${clock(startMinute)}`;
        }}
        onfoldchange={({ startMinute, endMinute, expanded }) =>
          (lastEvent = `${expanded ? "open" : "fold"} ${clock(startMinute)} – ${clock(endMinute)}`)}
      >
        {#snippet item({ item, compact, columns: cols })}
          {@const e = byId.get(item.id)!}
          {@const Icon = KIND_ICON[e.kind]}
          <span class="card-line">
            <Icon size={14} aria-hidden="true" />
            <span class="card-title">{e.title}</span>
            {#if e.count && cols < 3}<span class="card-count">{e.count}</span>{/if}
          </span>
          {#if !compact}
            <span class="card-line card-meta">
              <!-- DayLane already gives screen readers the time. -->
              <span aria-hidden="true">{timeOf(e)}</span>
              {#if cols < 3}
                <span class="card-people">{e.people.join(" · ")}</span>
              {/if}
            </span>
          {/if}
        {/snippet}
      </DayLane>
    </div>
    <aside class="panel" aria-label="Demo readout">
      <p class="readout">last event: <code data-testid="day-lane-event">{lastEvent}</code></p>
      {#if opened}
        <p class="panel-head">{opened.length} more</p>
        <ul>
          {#each opened as id (id)}
            {@const e = byId.get(id)!}
            <li>
              <button type="button" class="panel-row" onclick={() => (selected = id)}>
                {e.title} <span>{timeOf(e)}</span>
              </button>
            </li>
          {/each}
        </ul>
      {:else if selected && byId.get(selected)}
        {@const e = byId.get(selected)!}
        <p class="panel-head">{e.title}</p>
        <p class="readout">{timeOf(e)} · {e.people.join(", ")}</p>
      {:else}
        <p class="readout">Nothing selected</p>
      {/if}
    </aside>
  </div>
</DemoSection>

<DemoSection
  title="By person"
  description="Pass lanes and give each item the lane keys it belongs to. Rows are shared, so hours line up; each lane applies its own column limit, and lanes keep a minimum width and scroll sideways when they do not fit."
  code={`<DayLane
  {items}
  lanes={people.map((p) => ({ key: p.id, label: p.name }))}
  maxColumns={2}
  onselect={(id) => (selected = id)}
>
  {#snippet laneHeader(lane, count)}<Avatar … /> {lane.label} {count}{/snippet}
  {#snippet item({ item })}…{/snippet}
</DayLane>`}
>
  <p class="readout lane-readout">
    last event: <code data-testid="day-lane-lanes-event">{laneEvent}</code>
  </p>
  <div class="frame" data-testid="day-lane-lanes">
    <DayLane
      items={laneItems}
      lanes={personLanes}
      maxColumns={2}
      formatMinute={wallClock}
      dayKey="lanes"
      ariaLabel="Tuesday, March 10, by person"
      onselect={(id) => {
        laneSelected = id;
        laneEvent = `select ${id}`;
      }}
      onoverflow={({ ids }) => (laneEvent = `overflow ${ids.join(", ")}`)}
    >
      {#snippet laneHeader(lane, count)}
        <span class="initials" aria-hidden="true">{lane.key}</span>
        <span class="card-title">{lane.label}</span>
        <span class="card-count">{count}</span>
      {/snippet}
      {#snippet item({ item, compact })}
        {@const e = byId.get(item.id)!}
        {@const Icon = KIND_ICON[e.kind]}
        <span class="card-line">
          <Icon size={14} aria-hidden="true" />
          <span class="card-title">{e.title}</span>
        </span>
        {#if !compact}
          <span class="card-line card-meta"><span aria-hidden="true">{timeOf(e)}</span></span>
        {/if}
      {/snippet}
    </DayLane>
  </div>
</DemoSection>

<DemoSection
  title="400 items"
  description="A stress day of generated items. Layout runs once per change and is linear apart from the column search inside a cluster."
  code={`<DayLane items={fourHundred} maxColumns={3} onselect={...}>…</DayLane>`}
>
  <div class="frame" data-testid="day-lane-stress">
    <DayLane
      items={stressItems.map((i) => ({ ...i, selected: i.id === stressSelected }))}
      formatMinute={wallClock}
      dayKey="stress"
      ariaLabel="Generated day"
      onselect={(id) => (stressSelected = id)}
    >
      {#snippet item({ item, compact })}
        <span class="card-line"><span class="card-title">Item {item.id.slice(1)}</span></span>
        {#if !compact}<span class="card-meta" aria-hidden="true"
            >{wallClock(item.startMinute ?? 0)}</span
          >{/if}
      {/snippet}
    </DayLane>
  </div>
</DemoSection>

<style>
  .controls,
  .layout,
  .frame,
  .lane-readout {
    flex: 1 1 100%;
    min-width: 0;
    margin: 0;
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-5);
  }

  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 15rem;
    gap: var(--space-5);
  }

  @media (max-width: 760px) {
    .layout {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  .frame {
    height: 640px;
    border: 1px solid var(--border-muted);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .panel {
    font-size: var(--font-size-sm);
  }

  .panel ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .panel-head {
    margin: 0 0 var(--space-3);
    font-weight: var(--font-weight-semibold);
  }

  .panel-row {
    display: flex;
    justify-content: space-between;
    gap: var(--space-4);
    width: 100%;
    padding: var(--space-3) 0;
    border: 0;
    border-bottom: 1px solid var(--border-muted);
    background: none;
    color: var(--text-primary);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .panel-row span,
  .readout {
    color: var(--text-secondary);
  }

  .card-line {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
  }

  .card-title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: var(--font-weight-medium);
  }

  .card-count {
    color: var(--text-secondary);
    font-size: var(--font-size-xs);
    font-variant-numeric: tabular-nums;
  }

  .card-meta {
    justify-content: space-between;
    color: var(--text-secondary);
    font-size: var(--font-size-xs);
    white-space: nowrap;
  }

  .initials {
    display: inline-grid;
    flex: none;
    place-items: center;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    background: var(--bg-inset);
    color: var(--text-secondary);
    font-size: var(--font-size-2xs);
    font-weight: var(--font-weight-semibold);
  }

  .card-people {
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
