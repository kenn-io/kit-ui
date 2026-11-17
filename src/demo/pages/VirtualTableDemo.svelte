<script lang="ts">
  import {
    Button,
    Checkbox,
    Chip,
    Disclosure,
    SearchInput,
    TableHeaderCell,
    TableSort,
    VirtualTable,
    type ColumnResize,
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

  // A short list for the localized resize handles.
  const localizedReviews = reviews.slice(0, 40);

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
  // Swapping in longer names replaces the items, so the columns pin again.
  let longNames = $state(false);
  const shown = $derived(
    longNames
      ? reviews.map((r) => ({ ...r, project: `${r.project}-with-a-longer-name` }))
      : reviews,
  );
  // Live filtering: every keystroke hands the table a new, shorter array.
  let query = $state("");
  const filtered = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q) return shown;
    return shown.filter(
      (r) =>
        `#${r.id}`.includes(q) ||
        r.project.includes(q) ||
        r.branch.includes(q) ||
        r.verdict.includes(q),
    );
  });
  const sorted = $derived(sorter.sort(filtered));

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
    {
      id: (n) => n.id,
      project: (n) => n.project,
      lines: { value: (n) => n.lines.length },
      count: { value: (n) => n.lines.length },
    },
    { key: "id" },
  );
  const sortedNotes = $derived(noteSorter.sort(notes));
  const expanded = new SvelteSet<number>();
  const toggle = (id: number) => (expanded.has(id) ? expanded.delete(id) : expanded.add(id));
  let noteResize = $state<ColumnResize>();
  let favorite = $state(0);
  let showLines = $state(false);
  let wideId = $state(false);
  // The app knows its IDs: at most "#1999", about 40px of digits.
  const fitNoteColumn = (column: number) => (column === 0 ? 40 : undefined);
  let showBranch = $state(true);
  let pageTable = $state<ReturnType<typeof VirtualTable<Review>>>();
  let boxed = $state(false);
  const pageSorter = new TableSort<Review>(
    { id: (r) => r.id, project: (r) => r.project, branch: (r) => r.branch },
    { key: "id" },
  );
  const pageRows = $derived(pageSorter.sort(reviews.slice(0, 2000)));

  interface EditedFile {
    id: number;
    project: string;
    path: string;
    edits: { tool: string; ago: string }[];
  }

  const tools = ["Edit", "Write", "MultiEdit", "NotebookEdit"];
  const editFolders = ["src/lib/components", "frontend/src/routes", "internal/server", "docs"];
  function editedFile(id: number): EditedFile {
    return {
      id,
      project: projects[id % projects.length]!,
      // Every ninth path is long enough to wrap in a narrow File column.
      path:
        id % 9 === 0
          ? `${editFolders[id % 4]}/a/deeply/nested/folder/that/keeps/going/for/a/while/file-${id}.ts`
          : `${editFolders[id % 4]}/file-${id}.ts`,
      // One to eight edits, so open files differ in height.
      edits: Array.from({ length: ((id * 5) % 8) + 1 }, (_, j) => ({
        tool: tools[(id + j) % tools.length]!,
        ago: `${(id % 50) + j + 1}m ago`,
      })),
    };
  }

  let editedFiles = $state(Array.from({ length: 200 }, (_, i) => editedFile(i)));
  let nextFile = 200;
  const openFiles = new SvelteSet<number>();
  const toggleFile = (id: number) => (openFiles.has(id) ? openFiles.delete(id) : openFiles.add(id));
  // An open file's edits are a full-width row of their own right below it.
  type FileRow = { kind: "file" | "edits"; file: EditedFile };
  const fileRows = $derived(
    editedFiles.flatMap((file): FileRow[] =>
      openFiles.has(file.id)
        ? [
            { kind: "file", file },
            { kind: "edits", file },
          ]
        : [{ kind: "file", file }],
    ),
  );
  let lastResize = $state<ColumnResize>();
  // How many times the table reported a resize, for the browser tests.
  let resizeReports = $state(0);
  interface File {
    id: number;
    name: string;
    kind: string;
    size: string;
    modified: string;
  }

  const folders = ["src/components", "src/routes/settings", "docs/guides", "tests/browser"];
  const kinds = ["Svelte", "TypeScript", "Markdown"];
  // Every size and date has the same number of digits, so each of those
  // columns is as wide as any one of its values.
  const files: File[] = Array.from({ length: 3000 }, (_, i) => ({
    id: i,
    name: `${folders[i % folders.length]}/${i % 5 === 0 ? "a-file-with-a-much-longer-name-" : "file-"}${i}`,
    kind: kinds[i % kinds.length]!,
    size: `${(100 + ((i * 37) % 900)).toString()}.${i % 10} KB`,
    modified: `2026-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`,
  }));
  const fileSorter = new TableSort<File>(
    {
      name: (f) => f.name,
      kind: (f) => f.kind,
      size: (f) => f.size,
      modified: (f) => f.modified,
    },
    { key: "name" },
  );
  const sortedFiles = $derived(fileSorter.sort(files));
  let kindFills = $state(false);
</script>

<DemoSection
  title="10,000 rows in a table"
  description="VirtualTable renders only the rows on screen plus overscan, inside a real table: sortable headers, zebra stripes, and links in cells all behave as in Table. With the default scroll='self' it scrolls inside its own bounded wrapper. Columns start at widths measured from rows sampled across the whole list and keep them while scrolling. Drag a header's right edge to resize a column, or double-click it to fit the column to its content."
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
  <div class="filter">
    <SearchInput
      bind:value={query}
      size="sm"
      placeholder="Filter by ID, project, branch, or verdict…"
      ariaLabel="Filter reviews"
    />
    <span class="filter-count" aria-live="polite">
      {sorted.length.toLocaleString()} of {shown.length.toLocaleString()} rows
    </span>
  </div>
  <Checkbox bind:checked={showBranch} label="Show the Branch column" />
  <Checkbox bind:checked={longNames} label="Use longer project names" />
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
  description="Each note runs from one to five lines, and Details opens a row in place. Every rendered row is measured when it renders and again whenever it changes height, so the rows below it move down and the scrollbar stays accurate. The ID column starts at the header's width (90px) and follows it when the app changes it, until someone resizes the column; it fits to a width the app supplies. The column a person resizes is reported back to the app."
  code={`<VirtualTable items={notes} rowKey={(n) => n.id} estimateRowHeight={60} ariaLabel="Review notes">
  {#snippet row(note)}
    <tr>
      <td>{#each note.lines as line}<div>{line}</div>{/each}</td>
      <td><Button label="Details" onclick={() => toggle(note.id)} /></td>
    </tr>
  {/snippet}
</VirtualTable>`}
>
  <Checkbox bind:checked={showLines} label="Show the Lines column" />
  <Checkbox bind:checked={wideId} label="Start the ID column at 120px" />
  <div class="host">
    <VirtualTable
      items={sortedNotes}
      rowKey={(n) => n.id}
      estimateRowHeight={60}
      ariaLabel="Review notes"
      fitColumn={fitNoteColumn}
      oncolumnresize={(change) => (noteResize = change)}
    >
      {#snippet header()}
        <TableHeaderCell
          label="ID"
          numeric
          sort={noteSorter}
          column="id"
          width={wideId ? 120 : 90}
        />
        <TableHeaderCell label="Project" sort={noteSorter} column="project" minWidth={80} />
        <TableHeaderCell label="Note" sort={noteSorter} column="lines" />
        {#if showLines}
          <TableHeaderCell label="Lines" numeric sort={noteSorter} column="count" />
        {/if}
        <TableHeaderCell><span class="kit-sr-only">Favorite</span></TableHeaderCell>
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
          {#if showLines}
            <td class="num">{note.lines.length}</td>
          {/if}
          <td>
            <!-- kit-ui-check-ignore -- one native radio per row; the spec checks that column measurement keeps its checked state -->
            <input
              type="radio"
              name="favorite-note"
              aria-label="Favorite review #{note.id}"
              checked={favorite === note.id}
              onchange={() => (favorite = note.id)}
            />
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
  {@render resizeReadout(noteResize, "note-resize")}
</DemoSection>

<DemoSection
  title="A column that takes the spare width"
  description="Set fill on Name's TableHeaderCell. The other columns start at their content's width. Narrowing another column widens Name; in a narrow box, Name stops at minWidth and the table scrolls sideways. Without fill, the last column takes the spare width. Moving fill to another column moves the spare width with it, and Name's maxWidth of 240 applies once Kind fills. A table of one filling column keeps its minWidth too."
  code={`<VirtualTable items={sorter.sort(files)} rowKey={(f) => f.id} ariaLabel="Files">
  {#snippet header()}
    <TableHeaderCell label="Name" sort={sorter} column="name" fill minWidth={160} />
    <TableHeaderCell label="Size" numeric sort={sorter} column="size" />
    <TableHeaderCell label="Modified" sort={sorter} column="modified" />
  {/snippet}
  {#snippet row(file)}
    <tr><td>{file.name}</td><td>{file.size}</td><td>{file.modified}</td></tr>
  {/snippet}
</VirtualTable>`}
>
  <Checkbox bind:checked={kindFills} label="Let Kind take the spare width" />
  <div class="host">
    <VirtualTable items={sortedFiles} rowKey={(f) => f.id} ariaLabel="Files">
      {#snippet header()}
        <TableHeaderCell
          label="Name"
          sort={fileSorter}
          column="name"
          fill={!kindFills}
          minWidth={160}
          maxWidth={240}
        />
        <TableHeaderCell label="Kind" sort={fileSorter} column="kind" fill={kindFills} />
        <TableHeaderCell label="Size" numeric sort={fileSorter} column="size" />
        <TableHeaderCell label="Modified" sort={fileSorter} column="modified" />
      {/snippet}
      {#snippet row(file)}
        <tr>
          <td>{file.name}</td>
          <td>{file.kind}</td>
          <td class="num">{file.size}</td>
          <td class="date">{file.modified}</td>
        </tr>
      {/snippet}
    </VirtualTable>
  </div>
  <div class="host paths">
    <VirtualTable items={sortedFiles} rowKey={(f) => f.id} ariaLabel="Paths" unsorted>
      {#snippet header()}
        <TableHeaderCell label="Path" fill minWidth={320} />
      {/snippet}
      {#snippet row(file)}
        <tr><td>{file.name}</td></tr>
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
  <Checkbox bind:checked={boxed} label="Scroll inside a box instead" />
  <div class={boxed ? "host" : "flow"}>
    <VirtualTable
      bind:this={pageTable}
      scroll={boxed ? "self" : "page"}
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
  description="A table inside a closed Disclosure has no layout. Its columns are laid out when it opens."
  code={`<Disclosure title="Show reviews"><VirtualTable …/></Disclosure>`}
>
  <div class="flow">
    <Disclosure title="Show 2,000 reviews">
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
    </Disclosure>
  </div>
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

<DemoSection
  title="Expandable rows"
  description="Open a file to see its edits below it. With rowKey, measured heights survive opening, closing, adding, and loading files, so the rows on screen stay put. Resize the window: unresized columns refit; dragged or fitted columns keep their widths. oncolumnresize reports the column a person changed."
  code={`<VirtualTable
  items={rows}
  rowKey={(row) => \`\${row.kind}:\${row.file.id}\`}
  scroll="page"
  estimateRowHeight={33}
  oncolumnresize={({ column, width }) => keep(column, width)}
  …
>`}
>
  <div class="file-actions">
    <Button
      label="Add a file at the top"
      size="sm"
      onclick={() => (editedFiles = [editedFile(nextFile++), ...editedFiles])}
    />
    <Button
      label="Load 100 more"
      size="sm"
      onclick={() => {
        editedFiles = [
          ...editedFiles,
          ...Array.from({ length: 100 }, () => editedFile(nextFile++)),
        ];
      }}
    />
    <span class="filter-count">{editedFiles.length.toLocaleString()} files</span>
  </div>
  <div class="flow">
    <VirtualTable
      items={fileRows}
      rowKey={(row) => `${row.kind}:${row.file.id}`}
      scroll="page"
      estimateRowHeight={33}
      zebra={false}
      unsorted
      ariaLabel="Recently edited files"
      oncolumnresize={(change) => {
        lastResize = change;
        resizeReports += 1;
      }}
    >
      {#snippet header()}
        <TableHeaderCell label="Project" minWidth={80} />
        <TableHeaderCell label="File" minWidth={120} />
        <TableHeaderCell label="Edits" numeric minWidth={48} />
        <TableHeaderCell label="Last edit" numeric minWidth={64} maxWidth={120} />
      {/snippet}
      {#snippet row(item)}
        {@const file = item.file}
        {#if item.kind === "file"}
          {@const open = openFiles.has(file.id)}
          <tr class="file-row" class:file-row--open={open} onclick={() => toggleFile(file.id)}>
            <td>{file.project}</td>
            <td>
              <!-- The row toggles on click; the button gives keyboard and
                   screen reader users the same toggle. -->
              <button
                type="button"
                class="file-path"
                aria-expanded={open}
                onclick={(event) => {
                  event.stopPropagation();
                  toggleFile(file.id);
                }}>{file.path}</button
              >
            </td>
            <td class="num">{file.edits.length}</td>
            <td class="num">{file.edits[0]!.ago}</td>
          </tr>
        {:else}
          <tr class="edits-row">
            <td colspan="4">
              <ul class="edits">
                {#each file.edits as edit, j (j)}
                  <li>
                    <span class="edit-tool">{edit.tool}</span>
                    <span class="edit-ago">{edit.ago}</span>
                  </li>
                {/each}
              </ul>
            </td>
          </tr>
        {/if}
      {/snippet}
    </VirtualTable>
  </div>
  {@render resizeReadout(lastResize, "file-resize", resizeReports)}
</DemoSection>

{#snippet resizeReadout(change: ColumnResize | undefined, id: string, reports = 0)}
  <p class="resize-readout" data-testid={id} data-reports={reports} aria-live="polite">
    {#if change}
      Last resized: {change.column} column, {Math.round(change.width)}px
    {/if}
  </p>
{/snippet}

<DemoSection
  title="Localized resize handles"
  description="Each resize handle's accessible name defaults to the English &quot;Resize the &lbrace;label&rbrace; column&quot;. Pass a translated resizeLabel on the header cell so screen readers announce it in the app's language. Focus a header's right edge to hear it."
  code={`<VirtualTable {items} unsorted ariaLabel="Prüfungen">
  {#snippet header()}
    <TableHeaderCell label="Projekt" resizeLabel="Breite der Spalte Projekt ändern" />
  {/snippet}
  …
</VirtualTable>`}
>
  <div class="host host--short" data-testid="virtual-table-localized">
    <VirtualTable items={localizedReviews} rowKey={(r) => r.id} unsorted ariaLabel="Prüfungen">
      {#snippet header()}
        <TableHeaderCell label="ID" numeric resizeLabel="Breite der Spalte ID ändern" />
        <TableHeaderCell label="Projekt" resizeLabel="Breite der Spalte Projekt ändern" />
        <TableHeaderCell label="Branch" resizeLabel="Breite der Spalte Branch ändern" />
      {/snippet}
      {#snippet row(review)}
        <tr>
          <td class="num">#{review.id}</td>
          <td>{review.project}</td>
          <td class="branch">{review.branch}</td>
        </tr>
      {/snippet}
    </VirtualTable>
  </div>
</DemoSection>

<style>
  .host--short {
    height: 220px;
  }

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

  /* One column whose minWidth is wider than its box. */
  .host.paths {
    width: 240px;
    height: 200px;
  }

  .filter {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    width: 100%;
    max-width: 560px;
  }

  .filter-count {
    flex: none;
    color: var(--text-muted);
    font-size: var(--font-size-xs);
  }

  .resize-readout {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--font-size-xs);
  }

  .file-actions {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  .file-row {
    cursor: pointer;
  }

  .file-row--open > td {
    background: var(--bg-surface-hover);
  }

  .file-path {
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    color: var(--text-primary);
    text-align: left;
    overflow-wrap: anywhere;
    cursor: pointer;
  }

  .edits-row > td {
    background: var(--bg-inset);
  }

  .edits {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin: 0;
    padding: var(--space-2) 0 var(--space-2) var(--space-6);
    list-style: none;
  }

  .edits li {
    display: flex;
    gap: var(--space-5);
    font-size: var(--font-size-xs);
  }

  .edit-tool {
    min-width: 88px;
    font-weight: var(--font-weight-semibold, 600);
    color: var(--text-primary);
  }

  .edit-ago {
    margin-left: auto;
    color: var(--text-muted);
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

  .date {
    font-variant-numeric: tabular-nums;
  }
</style>
