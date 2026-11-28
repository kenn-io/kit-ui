<script lang="ts">
  import { Chip, Table, TableHeaderCell, TableSort } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  interface Job {
    id: number;
    repo: string;
    status: "done" | "running" | "queued" | "failed";
    elapsed: number;
    cost: number | null;
  }

  const jobs: Job[] = [
    { id: 412, repo: "kenn-io/forge", status: "done", elapsed: 312, cost: 1.42 },
    { id: 413, repo: "kenn-io/agentsview", status: "queued", elapsed: 0, cost: null },
    { id: 414, repo: "kenn-io/kit-ui", status: "running", elapsed: 87, cost: 0.22 },
    { id: 415, repo: "kenn-io/forge", status: "failed", elapsed: 45, cost: 0.19 },
    { id: 416, repo: "kenn-io/infra", status: "done", elapsed: 561, cost: 2.08 },
  ];

  const sorter = new TableSort<Job>(
    {
      id: (job) => job.id,
      repo: (job) => job.repo,
      status: (job) => job.status,
      elapsed: { value: (job) => job.elapsed, firstDirection: "desc" },
      cost: { value: (job) => job.cost, firstDirection: "desc" },
    },
    { key: "id" },
  );

  const statusTone = {
    done: "success",
    running: "info",
    queued: "neutral",
    failed: "danger",
  } as const;
  const totals = [
    { status: "done", count: 3 },
    { status: "running", count: 1 },
    { status: "failed", count: 1 },
  ] as const;
  const regions = [
    {
      name: "Europe",
      hosts: [
        { name: "Frankfurt", load: 42 },
        { name: "Dublin", load: 17 },
      ],
    },
    { name: "Americas", hosts: [{ name: "Ohio", load: 63 }] },
  ];

  const longJobs: Job[] = Array.from({ length: 30 }, (_, i) => {
    const base = jobs[i % jobs.length]!;
    return {
      ...base,
      id: 500 + i,
      repo: `${base.repo}/branch-feature-overlay-scrollbars-${i + 1}`,
    };
  });
</script>

<DemoSection
  title="Sortable table"
  description="Table provides the shell (sticky header, zebra striping, hover); TableHeaderCell provides header cells with aria-sort. TableSort holds the sort state: declare each column's value once, pass it to every header, and render sorter.sort(rows). Rows without a value sort last."
  code={`const sorter = new TableSort<Job>(
  {
    id: (job) => job.id,
    repo: (job) => job.repo,
    cost: { value: (job) => job.cost, firstDirection: "desc" },
  },
  { key: "id" },
);

<Table ariaLabel="Review jobs">
  {#snippet header()}
    <TableHeaderCell label="ID" sort={sorter} column="id" />
    <TableHeaderCell label="Repo" sort={sorter} column="repo" />
    <TableHeaderCell label="Cost" numeric sort={sorter} column="cost" />
  {/snippet}
  {#each sorter.sort(jobs) as job (job.id)}
    <tr>…</tr>
  {/each}
</Table>`}
>
  <div class="table-host">
    <Table ariaLabel="Review jobs">
      {#snippet header()}
        <TableHeaderCell label="ID" sort={sorter} column="id" />
        <TableHeaderCell label="Repo" sort={sorter} column="repo" />
        <TableHeaderCell label="Status" sort={sorter} column="status" />
        <TableHeaderCell label="Elapsed" numeric sort={sorter} column="elapsed" />
        <TableHeaderCell label="Cost" numeric sort={sorter} column="cost" />
      {/snippet}
      {#each sorter.sort(jobs) as job (job.id)}
        <tr>
          <td>#{job.id}</td>
          <td>{job.repo}</td>
          <td><Chip tone={statusTone[job.status]} size="sm">{job.status}</Chip></td>
          <td class="num">{job.elapsed}s</td>
          <td class="num">{job.cost === null ? "—" : `$${job.cost.toFixed(2)}`}</td>
        </tr>
      {/each}
    </Table>
  </div>
</DemoSection>

<DemoSection
  title="Opting out of sorting"
  description="Every table sorts unless it opts out with unsorted, such as a short fixed list with one row per status. kit-ui-check's unsorted-table-header rule accepts unsorted headers only there."
  code={`<Table ariaLabel="Jobs by status" unsorted>
  {#snippet header()}
    <TableHeaderCell label="Status" />
    <TableHeaderCell label="Jobs" numeric />
  {/snippet}
  …
</Table>`}
>
  <div class="table-host">
    <Table ariaLabel="Jobs by status" unsorted>
      {#snippet header()}
        <TableHeaderCell label="Status" />
        <TableHeaderCell label="Jobs" numeric />
      {/snippet}
      {#each totals as total (total.status)}
        <tr>
          <td>{total.status}</td>
          <td class="num">{total.count}</td>
        </tr>
      {/each}
    </Table>
  </div>
</DemoSection>

<DemoSection
  title="Scrollable table with overlay scrollbars"
  description="Table keeps border-radius and box-shadow on the outer non-scrolling frame and puts the scrollable viewport inside with zero scrollbar gutter. Headers and row dividers run edge to edge, and the vertical overlay thumb starts below the sticky header."
  code={`<Table ariaLabel="Long jobs" class="bounded-table" unsorted>
  {#snippet header()}…{/snippet}
  {#each rows as row}<tr>…</tr>{/each}
</Table>`}
>
  <Table ariaLabel="Scrollable jobs" class="table-card" unsorted>
    {#snippet header()}
      <TableHeaderCell label="ID" />
      <TableHeaderCell label="Repo" />
      <TableHeaderCell label="Status" />
      <TableHeaderCell label="Elapsed" numeric />
      <TableHeaderCell label="Cost" numeric />
    {/snippet}
    {#each longJobs as job (job.id)}
      <tr>
        <td>#{job.id}</td>
        <td class="nowrap">{job.repo}</td>
        <td><Chip tone={statusTone[job.status]} size="sm">{job.status}</Chip></td>
        <td class="num">{job.elapsed}s</td>
        <td class="num">{job.cost === null ? "—" : `$${job.cost.toFixed(2)}`}</td>
      </tr>
    {/each}
  </Table>
</DemoSection>

<DemoSection
  title="Bare table"
  description="With bare, Table renders only the table element, carrying class and ariaLabel, so its content can hold row groups, a colgroup or spanning header rows. kit-ui's table styles do not apply: style the table from an element the page owns. unsorted works as on any Table."
  code={`<Table unsorted bare ariaLabel="Hosts by region">
  <thead>
    <tr>
      <th scope="col">Host</th>
      <th scope="col" class="num">Load</th>
    </tr>
  </thead>
  {#each regions as region (region.name)}
    <tbody>
      <tr><th scope="rowgroup" colspan="2">{region.name}</th></tr>
      {#each region.hosts as host (host.name)}
        <tr>
          <th scope="row">{host.name}</th>
          <td class="num">{host.load}%</td>
        </tr>
      {/each}
    </tbody>
  {/each}
</Table>`}
>
  <div class="bare-host">
    <Table unsorted bare ariaLabel="Hosts by region" class="regions">
      <thead>
        <tr>
          <th scope="col">Host</th>
          <th scope="col" class="num">Load</th>
        </tr>
      </thead>
      {#each regions as region (region.name)}
        <tbody>
          <tr><th scope="rowgroup" colspan="2">{region.name}</th></tr>
          {#each region.hosts as host (host.name)}
            <tr>
              <th scope="row">{host.name}</th>
              <td class="num">{host.load}%</td>
            </tr>
          {/each}
        </tbody>
      {/each}
    </Table>
  </div>
</DemoSection>

<style>
  .table-host {
    width: 100%;
    max-height: 260px;
    display: flex;
    border: var(--border-width) solid var(--border-muted);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .nowrap {
    white-space: nowrap;
  }

  :global(.table-card) {
    width: 100%;
    max-width: 520px;
    max-height: 220px;
    border: var(--border-width) solid var(--border-default);
    border-radius: var(--radius-lg);
    background: var(--bg-surface);
  }

  .bare-host {
    width: 100%;
    overflow: auto;
    border: var(--border-width) solid var(--border-muted);
    border-radius: var(--radius-md);
  }

  .bare-host :global(table) {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--font-size-sm);
  }

  .bare-host th,
  .bare-host td {
    padding: var(--space-3) var(--space-4);
    border-bottom: var(--border-width) solid var(--border-muted);
  }

  .bare-host th:not(.num) {
    text-align: left;
  }

  .bare-host th[scope="rowgroup"] {
    background: var(--bg-inset);
    color: var(--text-secondary);
  }
</style>
