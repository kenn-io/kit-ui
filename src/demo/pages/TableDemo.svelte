<script lang="ts">
  import { Chip, Table, TableHeaderCell, type SortDirection } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  interface Job {
    id: number;
    repo: string;
    status: "done" | "running" | "failed";
    elapsed: number;
    cost: number;
  }

  const jobs: Job[] = [
    { id: 412, repo: "kenn-io/middleman", status: "done", elapsed: 312, cost: 1.42 },
    { id: 413, repo: "kenn-io/agentsview", status: "running", elapsed: 128, cost: 0.61 },
    { id: 414, repo: "kenn-io/kit-ui", status: "done", elapsed: 87, cost: 0.22 },
    { id: 415, repo: "kenn-io/middleman", status: "failed", elapsed: 45, cost: 0.19 },
    { id: 416, repo: "kenn-io/infra", status: "done", elapsed: 561, cost: 2.08 },
  ];

  let sortKey = $state<keyof Job>("id");
  let sortDirection = $state<SortDirection>("asc");

  function sortBy(key: keyof Job) {
    if (sortKey === key) {
      sortDirection = sortDirection === "asc" ? "desc" : "asc";
    } else {
      sortKey = key;
      sortDirection = "asc";
    }
  }

  const sorted = $derived(
    [...jobs].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDirection === "asc" ? cmp : -cmp;
    }),
  );

  function direction(key: keyof Job): SortDirection | null {
    return sortKey === key ? sortDirection : null;
  }

  const statusTone = { done: "success", running: "info", failed: "danger" } as const;
</script>

<DemoSection
  title="Sortable table"
  description="Table provides the shell (sticky header, zebra striping, hover); TableHeaderCell provides sortable header cells with aria-sort. Sorting itself stays in your code — the header only reports clicks."
  code={`<Table ariaLabel="Review jobs">
  {#snippet header()}
    <TableHeaderCell label="ID" sortable sortDirection={direction("id")} onsort={() => sortBy("id")} />
    <TableHeaderCell label="Repo" sortable sortDirection={direction("repo")} onsort={() => sortBy("repo")} />
    <TableHeaderCell label="Status" />
    <TableHeaderCell label="Cost" numeric sortable sortDirection={direction("cost")} onsort={() => sortBy("cost")} />
  {/snippet}
  {#each sorted as job (job.id)}
    <tr>…</tr>
  {/each}
</Table>`}
>
  <div class="table-host">
    <Table ariaLabel="Review jobs">
      {#snippet header()}
        <TableHeaderCell
          label="ID"
          sortable
          sortDirection={direction("id")}
          onsort={() => sortBy("id")}
        />
        <TableHeaderCell
          label="Repo"
          sortable
          sortDirection={direction("repo")}
          onsort={() => sortBy("repo")}
        />
        <TableHeaderCell label="Status" />
        <TableHeaderCell
          label="Elapsed"
          numeric
          sortable
          sortDirection={direction("elapsed")}
          onsort={() => sortBy("elapsed")}
        />
        <TableHeaderCell
          label="Cost"
          numeric
          sortable
          sortDirection={direction("cost")}
          onsort={() => sortBy("cost")}
        />
      {/snippet}
      {#each sorted as job (job.id)}
        <tr>
          <td>#{job.id}</td>
          <td>{job.repo}</td>
          <td><Chip tone={statusTone[job.status]} size="sm">{job.status}</Chip></td>
          <td class="num">{job.elapsed}s</td>
          <td class="num">${job.cost.toFixed(2)}</td>
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
    border: 1px solid var(--border-muted);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
</style>
