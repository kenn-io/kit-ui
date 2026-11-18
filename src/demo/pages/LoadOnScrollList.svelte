<script lang="ts">
  import { tick, untrack } from "svelte";
  import {
    ListEnd,
    MoreRows,
    TableHeaderCell,
    VirtualTable,
    isEndRow,
    keepListPosition,
    placeList,
    savedListPosition,
    withEndRow,
    type EndRow,
  } from "../../lib/index.js";

  type Row = { id: number; status: string };
  interface Props {
    kind: "list" | "table";
    filter: string;
    fail: boolean;
  }
  let { kind, filter, fail = $bindable() }: Props = $props();
  const source: Row[] = Array.from({ length: 1000 }, (_, i) => ({
    id: i + 1,
    status: i % 2 ? "Closed" : "Open",
  }));
  const matches = () =>
    source.filter((row) => filter === "all" || row.status.toLowerCase() === filter);
  const saved = untrack(() => savedListPosition(`demo-${kind}`));
  let rows = $state<Row[]>(matches().slice(0, saved?.rows ?? 100));
  let idle = $state(!saved);
  const loader = new MoreRows();
  let table = $state<{ scrollToIndex: (index: number, offset?: number) => void }>();
  const items = $derived(withEndRow(rows, rows.length < matches().length, loader));

  function read(start: number, count: number, signal: AbortSignal): Promise<Row[]> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (fail) {
          fail = false;
          reject(new Error("Try again."));
        } else resolve(matches().slice(start, start + count));
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

  function more() {
    void loader.load(
      (signal) => read(rows.length, 100, signal),
      (batch) => {
        rows = [...rows, ...batch];
      },
    );
  }

  function restore(container: HTMLElement) {
    let detach: (() => void) | void;
    const controller = new AbortController();
    void tick().then(async () => {
      if (controller.signal.aborted) return;
      const node = kind === "table" ? container.querySelector("table")! : container;
      const position = savedListPosition(`demo-${kind}`);
      detach = keepListPosition(`demo-${kind}`, () => rows.length)(node);
      try {
        if (position) {
          await placeList(node, position, (key, offset) => {
            const index = rows.findIndex((row) => String(row.id) === key);
            if (index < 0) return false;
            if (kind === "table") table?.scrollToIndex(index, offset);
            return true;
          });
        }
      } finally {
        if (!controller.signal.aborted) idle = true;
      }
    });
    return () => {
      controller.abort();
      loader.reset();
      detach?.();
    };
  }
</script>

<span class="count" data-testid="{kind}-count">{rows.length} rows loaded</span>
{#if kind === "list"}
  <div class="list-box" data-testid="list-box">
    <ul {@attach restore}>
      {#each rows as row (row.id)}
        <li data-list-row={row.id}>
          <a href="#load-on-scroll-row-{row.id}">Row {row.id}</a>
          {row.status}
        </li>
      {/each}
      <ListEnd
        rows={loader}
        more={rows.length < matches().length}
        {idle}
        label="rows"
        onmore={more}
      />
    </ul>
  </div>
{:else}
  <div class="table-box" data-testid="table-box" {@attach restore}>
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
          resizable={false}
        />{/snippet}
      {#snippet row(item: Row | EndRow)}
        {#if isEndRow(item)}
          <ListEnd rows={loader} {idle} columns={2} label="rows" onmore={more} />
        {:else}
          <tr data-list-row={item.id}
            ><td><a href="#load-on-scroll-row-{item.id}">Row {item.id}</a></td><td>{item.status}</td
            ></tr
          >
        {/if}
      {/snippet}
    </VirtualTable>
  </div>
{/if}

<style>
  .count {
    padding-left: 10px;
  }
  .list-box {
    container-type: inline-size;
    height: 360px;
    overflow: auto;
    width: 100%;
  }
  .list-box ul {
    margin: 0;
    padding: 0;
  }
  .list-box li:not(:global(.kit-list-end)) {
    border-bottom: var(--border-width) solid var(--border-muted);
    color: var(--text-secondary);
    list-style: none;
    padding: var(--space-3);
    padding-inline: 10px;
  }
  .list-box a,
  .table-box a {
    color: var(--accent-blue);
  }
  .table-box {
    width: 100%;
  }
  .table-box :global(.kit-table-wrapper) {
    height: 360px;
  }
</style>
