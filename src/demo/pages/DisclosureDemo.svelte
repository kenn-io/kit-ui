<script lang="ts">
  import { Accordion, Button, Chip, Disclosure } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  let toolOpen = $state(false);
  let toggles = $state(0);

  const series = [
    { id: "requests", label: "Requests", value: "48.2k", share: 0.82 },
    { id: "errors", label: "Errors", value: "312", share: 0.12 },
    { id: "latency", label: "p95 latency", value: "184 ms", share: 0.46 },
    { id: "storage", label: "Storage", value: "Loading", share: 0, loading: true },
  ];
  let rowClicks = $state(0);

  // Up and Down move between row summaries; the native toggle keeps Enter
  // and Space.
  function moveBetweenRows(event: KeyboardEvent & { currentTarget: HTMLElement }): void {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const rows = [
      ...(event.currentTarget
        .closest(".chart-rows")
        ?.querySelectorAll<HTMLElement>("details:not([inert]) > summary") ?? []),
    ];
    const next = rows[rows.indexOf(event.currentTarget) + (event.key === "ArrowDown" ? 1 : -1)];
    if (!next) return;
    event.preventDefault();
    next.focus();
  }
</script>

<DemoSection
  title="Card"
  description="A collapsible section on the native details element: keyboard support, and find-in-page that searches collapsed content and expands the match. Bind open to control it. An id makes it a deep-link target that opens when the URL hash matches."
  code={`<Disclosure title="How are seats counted?" id="seats">
  Each person with access to the workspace uses one seat.
</Disclosure>`}
>
  <div class="disclosure-demo" data-testid="disclosure-card">
    <Disclosure title="How are seats counted?" id="disclosure-seats">
      Each person with access to the workspace uses one seat. Guests with read-only access are free.
    </Disclosure>
    <Disclosure title="Can I change plans later?" open>
      Yes. Changes apply at the start of the next billing period.
    </Disclosure>
  </div>
</DemoSection>

<DemoSection
  title="Plain"
  description="variant=&quot;plain&quot; is a bare toggle row for inline use, such as a tool call in a transcript. The meta snippet holds trailing, non-interactive header content."
  code={`<Disclosure variant="plain" bind:open>
  {#snippet summary()}<code>bun run check</code>{/snippet}
  {#snippet meta()}<Chip size="sm" tone="success">passed</Chip>{/snippet}
  ...
</Disclosure>`}
>
  <div class="disclosure-demo" data-testid="disclosure-plain">
    <Disclosure variant="plain" bind:open={toolOpen} ontoggle={() => (toggles += 1)}>
      {#snippet summary()}<code>bun run check</code>{/snippet}
      {#snippet meta()}<Chip size="sm" tone="success">passed</Chip>{/snippet}
      <pre class="disclosure-demo__output">0 errors, 0 warnings</pre>
    </Disclosure>
    <p class="disclosure-demo__readout">
      Toggles: <span data-testid="disclosure-toggles">{toggles}</span>
    </p>
    <span class="disclosure-demo__hidden" data-testid="disclosure-open">{toolOpen}</span>
    <div><Button size="sm" onclick={() => (toolOpen = !toolOpen)}>Toggle from outside</Button></div>
  </div>
</DemoSection>

<DemoSection
  title="Accordion"
  description="Groups sections in one frame. With exclusive, opening one closes the others. A Disclosure inside an item is not part of the group."
  code={`<Accordion exclusive>
  <Disclosure title="Billing">...</Disclosure>
  <Disclosure title="Security">...</Disclosure>
</Accordion>`}
>
  <div class="disclosure-demo" data-testid="accordion-exclusive">
    <Accordion exclusive>
      <Disclosure title="Billing">Invoices go to the workspace owner each month.</Disclosure>
      <Disclosure title="Security">
        Sessions expire after 30 days without use.
        {#snippet meta()}2 settings{/snippet}
        <Disclosure variant="plain" title="Advanced">
          Admins can shorten the expiry for every member.
        </Disclosure>
      </Disclosure>
      <Disclosure title="Data export">Exports include every project and its history.</Disclosure>
    </Accordion>
  </div>
</DemoSection>

<DemoSection
  title="Bare"
  description="variant=&quot;bare&quot; drops the chevron, padding, and type styles and renders the header and body without wrappers, so the summary can be a data row. Other attributes, such as inert or data-*, go on the details element; summaryAttributes adds attributes and handlers to the summary, here an aria-label, arrow-key movement between rows, and a click counter alongside the native toggle."
  code={`<Disclosure
  variant="bare"
  class="chart-row"
  data-series={row.id}
  inert={row.loading}
  summaryAttributes={{
    class: "chart-row__summary",
    "aria-label": \`\${row.label}: \${row.value}\`,
    onkeydown: moveBetweenRows,
    onclick: () => clicks++,
  }}
>
  {#snippet summary()}<span>{row.label}</span><Bar share={row.share} />{/snippet}
  <Chart series={row.id} />
</Disclosure>`}
>
  <div class="disclosure-demo chart-rows" data-testid="disclosure-bare">
    {#each series as row (row.id)}
      <Disclosure
        variant="bare"
        class="chart-row"
        data-series={row.id}
        inert={row.loading}
        summaryAttributes={{
          class: "chart-row__summary",
          "aria-label": `${row.label}: ${row.value}`,
          onkeydown: moveBetweenRows,
          onclick: () => (rowClicks += 1),
        }}
      >
        {#snippet summary()}
          <span>{row.label}</span>
          <span class="chart-row__bar"><span style:width="{row.share * 100}%"></span></span>
          <span class="chart-row__value">{row.value}</span>
        {/snippet}
        <p class="chart-row__detail">Daily {row.label.toLowerCase()} for the last 30 days.</p>
      </Disclosure>
    {/each}
    <p class="disclosure-demo__readout">
      Row clicks: <span data-testid="disclosure-row-clicks">{rowClicks}</span>
    </p>
  </div>
</DemoSection>

<style>
  .disclosure-demo {
    display: grid;
    gap: var(--space-4);
    width: min(100%, 560px);
  }

  .disclosure-demo__output {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
  }

  .disclosure-demo__hidden {
    display: none;
  }

  .disclosure-demo__readout {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--font-size-xs);
  }

  .chart-rows {
    gap: 0;
  }

  .chart-rows :global(.chart-row + .chart-row) {
    border-top: var(--border-width) solid var(--border-muted);
  }

  .chart-rows :global(.chart-row[inert]) {
    opacity: var(--opacity-disabled, 0.5);
  }

  .chart-rows :global(.chart-row__summary) {
    display: grid;
    grid-template-columns: 8rem 1fr 5rem;
    gap: var(--space-4);
    align-items: center;
    padding: var(--space-2) var(--space-3);
    font-size: var(--font-size-sm);
  }

  .chart-rows :global(.chart-row__summary:hover) {
    background: var(--bg-surface-hover);
  }

  .chart-row__bar {
    height: 6px;
    overflow: hidden;
    border-radius: 3px;
    background: var(--bg-inset);
  }

  .chart-row__bar > span {
    display: block;
    height: 100%;
    background: var(--accent-blue);
  }

  .chart-row__value {
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  .chart-row__detail {
    margin: 0;
    padding: 0 var(--space-3) var(--space-3);
    color: var(--text-secondary);
    font-size: var(--font-size-xs);
  }
</style>
