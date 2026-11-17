<script lang="ts">
  import { tick, untrack } from "svelte";
  import {
    ListEnd,
    MoreRows,
    SegmentedControl,
    TableHeaderCell,
    Toggle,
    VirtualTable,
    isEndRow,
    keepListPosition,
    placeList,
    savedListPosition,
    showListTop,
    withEndRow,
    writeListPosition,
    type EndRow,
  } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  type Row = { id: number; status: string };
  type Kind = "list" | "table";
  const source: Row[] = Array.from({ length: 1000 }, (_, i) => ({
    id: i + 1,
    status: i % 2 ? "Closed" : "Open",
  }));
  const loaders = { list: new MoreRows(), table: new MoreRows() };
  let filter = $state(new URLSearchParams(location.search).get("filter") ?? "all");
  let lists = $state<Record<Kind, Row[]>>({
    list: source
      .filter((row) => filter === "all" || row.status.toLowerCase() === filter)
      .slice(0, 100),
    table: source
      .filter((row) => filter === "all" || row.status.toLowerCase() === filter)
      .slice(0, 100),
  });
  let fail = $state(false);
  let hash = $state(location.hash);
  let listBox = $state<HTMLElement>();
  let tableBox = $state<HTMLElement>();
  let table = $state<{ scrollToIndex: (index: number, offset?: number) => void }>();
  const restorations: Partial<Record<Kind, AbortController>> = {};
  let placing = $state<Record<Kind, boolean>>({ list: false, table: false });
  const options = [
    { value: "all", label: "All" },
    { value: "open", label: "Open" },
    { value: "closed", label: "Closed" },
  ];
  const matches = (value: string) =>
    source.filter((row) => value === "all" || row.status.toLowerCase() === value);
  const detail = $derived(/^#load-on-scroll-row-(\d+)$/.exec(hash)?.[1]);
  const items = $derived(
    withEndRow(lists.table, lists.table.length < matches(filter).length, loaders.table),
  );

  function read(
    start: number,
    count: number,
    value: string,
    signal: AbortSignal,
    mayFail = false,
  ): Promise<Row[]> {
    const current = matches(value);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (mayFail && fail) {
          fail = false;
          reject(new Error("Try again."));
        } else resolve(current.slice(start, start + count));
      }, 300);
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(new DOMException("Aborted", "AbortError"));
        },
        { once: true },
      );
    });
  }

  function more(kind: Kind) {
    if (placing[kind]) return;
    const start = lists[kind].length;
    void loaders[kind].load(
      (signal) => read(start, 100, filter, signal, true),
      (batch) => {
        lists[kind] = [...lists[kind], ...batch];
      },
    );
  }

  async function changeFilter(value: string) {
    filter = value;
    const url = new URL(location.href);
    if (value === "all") url.searchParams.delete("filter");
    else url.searchParams.set("filter", value);
    for (const kind of ["list", "table"] as const) {
      loaders[kind].reset();
      restorations[kind]?.abort();
      placing[kind] = false;
      writeListPosition(`demo-${kind}`, null, url.href);
      lists[kind] = matches(value).slice(0, 100);
    }
    await tick();
    if (listBox) showListTop(listBox.querySelector("ul")!);
    if (tableBox) showListTop(tableBox.querySelector("table")!);
  }

  function restore(kind: Kind) {
    return (container: HTMLElement) => {
      let detach: (() => void) | void;
      const controller = new AbortController();
      restorations[kind] = controller;
      void tick().then(async () => {
        if (controller.signal.aborted) return;
        const node = kind === "table" ? container.querySelector("table")! : container;
        const position = savedListPosition(`demo-${kind}`);
        detach = keepListPosition(`demo-${kind}`, () => lists[kind].length)(node);
        if (position && !untrack(() => detail)) {
          placing[kind] = true;
          try {
            lists[kind] = await read(0, Math.min(position.rows, 1000), filter, controller.signal);
            await placeList(node, position, {
              indexOf: (key) => lists[kind].findIndex((row) => String(row.id) === key),
              scrollToIndex: (index, offset) => {
                if (kind === "table") table?.scrollToIndex(index, offset);
              },
            });
          } catch (error) {
            if (!controller.signal.aborted) throw error;
          } finally {
            if (restorations[kind] === controller) placing[kind] = false;
          }
        }
      });
      return () => {
        controller.abort();
        if (restorations[kind] === controller) delete restorations[kind];
        detach?.();
      };
    };
  }
</script>

<svelte:window onhashchange={() => (hash = location.hash)} />
{#if detail}
  <h3>Row {detail}</h3>
  <a
    href="#load-on-scroll"
    onclick={(event) => {
      event.preventDefault();
      history.back();
    }}>Back</a
  >
{:else}
  <div class="controls">
    <SegmentedControl {options} value={filter} onchange={changeFilter} ariaLabel="Filter" />
    <Toggle bind:checked={fail} label="Fail next batch" />
  </div>
  <DemoSection title="List">
    <span data-testid="list-count">{lists.list.length} rows loaded</span>
    <div class="list-box" data-testid="list-box" bind:this={listBox}>
      <ul {@attach restore("list")}>
        {#each lists.list as row (row.id)}
          <li data-list-row={row.id}>
            <a href="#load-on-scroll-row-{row.id}">Row {row.id}</a>
            {row.status}
          </li>
        {/each}
        <ListEnd
          rows={loaders.list}
          more={lists.list.length < matches(filter).length}
          idle={!placing.list}
          label="rows"
          onmore={() => more("list")}
        />
      </ul>
    </div>
  </DemoSection>
  <DemoSection title="Virtual table">
    <span data-testid="table-count">{lists.table.length} rows loaded</span>
    <div class="table-box" data-testid="table-box" bind:this={tableBox} {@attach restore("table")}>
      <VirtualTable
        bind:this={table}
        {items}
        scroll="self"
        unsorted
        rowKey={(item: Row | EndRow) => (isEndRow(item) ? "end" : item.id)}
        ariaLabel="Rows"
      >
        {#snippet header()}<TableHeaderCell label="Row" fill /><TableHeaderCell
            label="Status"
          />{/snippet}
        {#snippet row(item: Row | EndRow)}
          {#if isEndRow(item)}
            <ListEnd
              rows={loaders.table}
              idle={!placing.table}
              columns={2}
              label="rows"
              onmore={() => more("table")}
            />
          {:else}
            <tr data-list-row={item.id}
              ><td><a href="#load-on-scroll-row-{item.id}">Row {item.id}</a></td><td
                >{item.status}</td
              ></tr
            >
          {/if}
        {/snippet}
      </VirtualTable>
    </div>
  </DemoSection>
{/if}

<style>
  .controls {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }
  .list-box {
    height: 360px;
    overflow: auto;
    width: 100%;
  }
  .list-box ul {
    margin: 0;
    padding: 0;
  }
  .list-box li:not(:global(.kit-list-end)) {
    list-style: none;
    padding: var(--space-3);
  }
  .table-box {
    width: 100%;
  }
  .table-box :global(.kit-table-wrapper) {
    height: 360px;
  }
</style>
