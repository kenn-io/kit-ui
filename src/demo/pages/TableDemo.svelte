<script lang="ts">
  import { Chip, Table, TableHeaderCell, TableSort } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  interface Job {
    id: number;
    repo: string;
    status: "done" | "running" | "failed";
    elapsed: number;
    cost: number | null;
  }

  const jobs: Job[] = [
    { id: 412, repo: "kenn-io/forge", status: "done", elapsed: 312, cost: 1.42 },
    { id: 413, repo: "kenn-io/agentsview", status: "running", elapsed: 128, cost: null },
    { id: 414, repo: "kenn-io/kit-ui", status: "done", elapsed: 87, cost: 0.22 },
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

  const statusTone = { done: "success", running: "info", failed: "danger" } as const;
  const totals = [
    { status: "done", count: 3 },
    { status: "running", count: 1 },
    { status: "failed", count: 1 },
  ] as const;
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
  title="Fixed rows"
  description="Every table sorts, except one with a fixed set of fewer than five rows known when the code is written. fixedRows (1–4) declares that, and kit-ui-check's unsorted-table-header rule accepts unsorted headers only there."
  code={`<Table ariaLabel="Jobs by status" fixedRows={3}>
  {#snippet header()}
    <TableHeaderCell label="Status" />
    <TableHeaderCell label="Jobs" numeric />
  {/snippet}
  …
</Table>`}
>
  <div class="table-host">
    <Table ariaLabel="Jobs by status" fixedRows={3}>
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
</style>
