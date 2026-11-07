<script lang="ts">
  import { Accordion, Button, Chip, Disclosure } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  let toolOpen = $state(false);
  let toggles = $state(0);
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
</style>
