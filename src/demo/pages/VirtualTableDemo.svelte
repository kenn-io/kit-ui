<script lang="ts">
  import { Chip, TableHeaderCell, TableSort, VirtualTable } from "../../lib/index.js";
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
    // Every seventh branch is long enough to wrap, so rows vary in height.
    branch:
      i % 7 === 0
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
  const pageSorter = new TableSort<Review>(
    { id: (r) => r.id, project: (r) => r.project, branch: (r) => r.branch },
    { key: "id" },
  );
  const pageRows = $derived(pageSorter.sort(reviews.slice(0, 2000)));
</script>

<DemoSection
  title="10,000 rows in a table"
  description="VirtualTable renders only the rows on screen plus overscan, inside a real table: sortable headers, zebra stripes, and links in cells all behave as in Table. It follows whichever container scrolls it — here its own bounded wrapper. Rows may vary in height; column widths are pinned after the first layout so they do not shift while scrolling."
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
  <div class="host">
    <VirtualTable items={sorted} rowKey={(r) => r.id} ariaLabel="Reviews">
      {#snippet header()}
        <TableHeaderCell label="ID" numeric sort={sorter} column="id" />
        <TableHeaderCell label="Verdict" sort={sorter} column="verdict" />
        <TableHeaderCell label="Project" sort={sorter} column="project" />
        <TableHeaderCell label="Branch" sort={sorter} column="branch" />
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
          <td class="branch">{review.branch}</td>
          <td class="num">{review.tokens.toLocaleString()}</td>
        </tr>
      {/snippet}
    </VirtualTable>
  </div>
</DemoSection>

<DemoSection
  title="Scrolling with the page"
  description="Without a bounded height the table grows to its full length, and the page's scroll container decides which rows are on screen."
  code={`<VirtualTable items={reviews} rowKey={(r) => r.id} ariaLabel="Reviews on the page">…</VirtualTable>`}
>
  <div class="flow">
    <VirtualTable items={pageRows} rowKey={(r) => r.id} ariaLabel="Reviews on the page">
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
    <VirtualTable items={pageRows} rowKey={(r) => r.id} ariaLabel="Hidden reviews">
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

  .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .branch {
    overflow-wrap: anywhere;
  }
</style>
