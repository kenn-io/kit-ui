<script lang="ts">
  import {
    Button,
    Checkbox,
    Chip,
    TableHeaderCell,
    TableSort,
    VirtualTable,
  } from "../../lib/index.js";
  import { SvelteSet } from "svelte/reactivity";
  import DemoSection from "../DemoSection.svelte";

  interface Review {
    id: number;
    verdict: "pass" | "fail";
    project: string;
    branch: string;
    tokens: number;
  }

  const projects = ["forge", "agentsview", "kit-ui", "docs-site", "billing-api"];
  const reviews: Review[] = Array.from({ length: 10000 }, (_, i) => ({
    id: i,
    verdict: i % 3 === 0 ? "fail" : "pass",
    project: projects[i % projects.length]!,
    // Every seventh branch is long enough to wrap, so rows vary in height;
    // row 6000's has no break opportunity at all.
    branch:
      i === 6000
        ? `fix/${"an-unbroken-name".replaceAll("-", "").repeat(12)}`
        : i % 7 === 0
          ? `feature/a-much-longer-branch-name-that-wraps-onto-a-second-line-${i}`
          : `fix/issue-${i % 400}`,
    tokens: (i * 7919) % 50000,
  }));

  const sorter = new TableSort<Review>(
    {
      id: (r) => r.id,
      verdict: (r) => r.verdict,
      project: (r) => r.project,
      branch: (r) => r.branch,
      tokens: { value: (r) => r.tokens, firstDirection: "desc" },
    },
    { key: "id" },
  );
  const sorted = $derived(sorter.sort(reviews));

  interface Note {
    id: number;
    project: string;
    lines: string[];
    details: string;
  }

  const sentences = [
    "Checked the retry path.",
    "The flaky test passed twice in a row after the fix.",
    "Waiting on the schema change before merging.",
    "Rebased onto main and ran the browser suite again.",
    "Logs show the cache miss only on a cold start.",
  ];
  // One to five lines per note, so rows differ in height at any width.
  const notes: Note[] = Array.from({ length: 2000 }, (_, i) => ({
    id: i,
    project: projects[i % projects.length]!,
    lines: Array.from({ length: ((i * 7) % 5) + 1 }, (_, j) => sentences[(i + j) % 5]!),
    details: `Review #${i} ran ${(i % 6) + 2} agents over ${((i * 13) % 40) + 5} files.`,
  }));
  const noteSorter = new TableSort<Note>(
    { id: (n) => n.id, project: (n) => n.project, lines: { value: (n) => n.lines.length } },
    { key: "id" },
  );
  const sortedNotes = $derived(noteSorter.sort(notes));
  const expanded = new SvelteSet<number>();
  const toggle = (id: number) => (expanded.has(id) ? expanded.delete(id) : expanded.add(id));
  let showBranch = $state(true);
  let pageTable = $state<ReturnType<typeof VirtualTable<Review>>>();
  const pageSorter = new TableSort<Review>(
    { id: (r) => r.id, project: (r) => r.project, branch: (r) => r.branch },
    { key: "id" },
  );
  const pageRows = $derived(pageSorter.sort(reviews.slice(0, 2000)));
</script>

<DemoSection
  title="10,000 rows in a table"
  description="VirtualTable renders only the rows on screen plus overscan, inside a real table: sortable headers, zebra stripes, and links in cells all behave as in Table. With the default scroll='self' it scrolls inside its own bounded wrapper. Column widths are pinned from rows sampled across the whole list, so they fit values far down the list and do not shift while scrolling."
  code={`<VirtualTable items={sorter.sort(reviews)} rowKey={(r) => r.id} ariaLabel="Reviews">
  {#snippet header()}
    <TableHeaderCell label="ID" sort={sorter} column="id" />
    <TableHeaderCell label="Project" sort={sorter} column="project" />
  {/snippet}
  {#snippet row(review)}
    <tr>
      <td>#{review.id}</td>
      <td><a href="#/reviews/{review.id}">{review.project}</a></td>
    </tr>
  {/snippet}
</VirtualTable>`}
>
  <Checkbox bind:checked={showBranch} label="Show the Branch column" />
  <div class="host">
    <VirtualTable items={sorted} rowKey={(r) => r.id} ariaLabel="Reviews">
      {#snippet header()}
        <TableHeaderCell label="ID" numeric sort={sorter} column="id" />
        <TableHeaderCell label="Verdict" sort={sorter} column="verdict" />
        <TableHeaderCell label="Project" sort={sorter} column="project" />
        {#if showBranch}
          <TableHeaderCell label="Branch" sort={sorter} column="branch" />
        {/if}
        <TableHeaderCell label="Tokens" numeric sort={sorter} column="tokens" />
      {/snippet}
      {#snippet row(review)}
        <tr>
          <td class="num">#{review.id}</td>
          <td>
            <Chip size="xs" tone={review.verdict === "pass" ? "success" : "danger"}>
              {review.verdict}
            </Chip>
          </td>
          <td><a href="#virtual-table">{review.project}</a></td>
          {#if showBranch}
            <td class="branch">{review.branch}</td>
          {/if}
          <td class="num">{review.tokens.toLocaleString()}</td>
        </tr>
      {/snippet}
    </VirtualTable>
  </div>
</DemoSection>

<DemoSection
  title="Rows of different heights"
  description="Each note runs from one to five lines, and Details opens a row in place. Every rendered row is measured when it renders and again whenever it changes height, so the rows below it move down and the scrollbar stays accurate."
  code={`<VirtualTable items={notes} rowKey={(n) => n.id} estimateRowHeight={60} ariaLabel="Review notes">
  {#snippet row(note)}
    <tr>
      <td>{#each note.lines as line}<div>{line}</div>{/each}</td>
      <td><Button label="Details" onclick={() => toggle(note.id)} /></td>
    </tr>
  {/snippet}
</VirtualTable>`}
>
  <div class="host">
    <VirtualTable
      items={sortedNotes}
      rowKey={(n) => n.id}
      estimateRowHeight={60}
      ariaLabel="Review notes"
    >
      {#snippet header()}
        <TableHeaderCell label="ID" numeric sort={noteSorter} column="id" />
        <TableHeaderCell label="Project" sort={noteSorter} column="project" />
        <TableHeaderCell label="Note" sort={noteSorter} column="lines" />
        <TableHeaderCell><span class="kit-sr-only">Details</span></TableHeaderCell>
      {/snippet}
      {#snippet row(note)}
        <tr>
          <td class="num">#{note.id}</td>
          <td>{note.project}</td>
          <td>
            {#each note.lines as line, j (j)}
              <div>{line}</div>
            {/each}
            {#if expanded.has(note.id)}
              <div class="details">{note.details}</div>
            {/if}
          </td>
          <td>
            <Button
              size="sm"
              label={expanded.has(note.id) ? "Hide" : "Details"}
              onclick={() => toggle(note.id)}
            />
          </td>
        </tr>
      {/snippet}
    </VirtualTable>
  </div>
</DemoSection>

<DemoSection
  title="Scrolling with the page"
  description={`With scroll="page" the table grows to its full length, the page's scroll container decides which rows are on screen, and the header sticks to the page. The table follows scrolling and resizing; after a layout change with neither, such as content above it collapsing, call refresh().`}
  code={`<VirtualTable bind:this={table} scroll="page" items={reviews} ariaLabel="Reviews on the page">…</VirtualTable>

<!-- after content above the table changes size without a scroll -->
table.refresh();`}
>
  <Button label="Refresh the table" size="sm" onclick={() => pageTable?.refresh()} />
  <div class="flow">
    <VirtualTable
      bind:this={pageTable}
      scroll="page"
      items={pageRows}
      rowKey={(r) => r.id}
      ariaLabel="Reviews on the page"
    >
      {#snippet header()}
        <TableHeaderCell label="ID" numeric sort={pageSorter} column="id" />
        <TableHeaderCell label="Project" sort={pageSorter} column="project" />
        <TableHeaderCell label="Branch" sort={pageSorter} column="branch" />
      {/snippet}
      {#snippet row(review)}
        <tr>
          <td class="num">#{review.id}</td>
          <td><a href="#virtual-table">{review.project}</a></td>
          <td class="branch">{review.branch}</td>
        </tr>
      {/snippet}
    </VirtualTable>
  </div>
</DemoSection>

<DemoSection
  title="Hidden until opened"
  description="A table inside a closed details element has no layout. Its columns are laid out when it opens."
  code={`<details><summary>Show reviews</summary><VirtualTable …/></details>`}
>
  <details class="flow">
    <summary>Show 2,000 reviews</summary>
    <VirtualTable scroll="page" items={pageRows} rowKey={(r) => r.id} ariaLabel="Hidden reviews">
      {#snippet header()}
        <TableHeaderCell label="ID" numeric sort={pageSorter} column="id" />
        <TableHeaderCell label="Project" sort={pageSorter} column="project" />
        <TableHeaderCell label="Branch" sort={pageSorter} column="branch" />
      {/snippet}
      {#snippet row(review)}
        <tr>
          <td class="num">#{review.id}</td>
          <td><a href="#virtual-table">{review.project}</a></td>
          <td class="branch">{review.branch}</td>
        </tr>
      {/snippet}
    </VirtualTable>
  </details>
</DemoSection>

<DemoSection
  title="Below the fold with no overscan"
  description="With overscan={0}, a table below the visible area renders no rows until it scrolls in. It never shows its empty row while it has items."
  code={`<VirtualTable scroll="page" {items} overscan={0} …>{#snippet empty()}…{/snippet}</VirtualTable>`}
>
  <div class="flow">
    <VirtualTable
      scroll="page"
      items={reviews.slice(0, 300)}
      rowKey={(r) => r.id}
      overscan={0}
      ariaLabel="Reviews without overscan"
      unsorted
    >
      {#snippet header()}
        <!-- A fixed order keeps this example about rendering, not sorting. -->
        <TableHeaderCell label="ID" numeric />
        <TableHeaderCell label="Branch" />
      {/snippet}
      {#snippet row(review)}
        <tr>
          <td class="num">#{review.id}</td>
          <td>{review.branch}</td>
        </tr>
      {/snippet}
      {#snippet empty()}
        <tr><td colspan="2">No reviews</td></tr>
      {/snippet}
    </VirtualTable>
  </div>
</DemoSection>

<style>
  .flow {
    width: 100%;
  }

  .host {
    display: flex;
    flex-direction: column;
    height: 420px;
    width: 100%;
    border: var(--border-width) solid var(--border-muted);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .details {
    margin-top: var(--space-2);
    color: var(--text-muted);
    font-size: var(--font-size-xs);
  }

  .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
</style>
