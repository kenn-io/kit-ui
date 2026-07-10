<script lang="ts">
  import { Button, Checkbox } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  let subscribed = $state(true);
  let terms = $state(false);

  let submitted = $state("");
  function submitForm(event: SubmitEvent) {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    submitted = `submitted: ${[...data.entries()].map(([k, v]) => `${k}=${v}`).join("&")}`;
  }

  let files = $state([
    { name: "Button.svelte", included: true },
    { name: "Card.svelte", included: true },
    { name: "Toggle.svelte", included: false },
  ]);
  const includedCount = $derived(files.filter((f) => f.included).length);
  const allIncluded = $derived(includedCount === files.length);
  const someIncluded = $derived(includedCount > 0 && !allIncluded);

  function setAll(checked: boolean) {
    files = files.map((f) => ({ ...f, included: checked }));
  }
</script>

<DemoSection
  title="Basic"
  description="middleman's TreeCheckbox recipe, consolidated: 16px drawn box over a real focusable input, accent fill, surface-colored SVG check."
  code={`<Checkbox bind:checked={subscribed} label="Subscribe to run alerts" />`}
>
  <div class="col">
    <Checkbox bind:checked={subscribed} label="Subscribe to run alerts" />
    <Checkbox bind:checked={terms}>
      Rich label via children: delete branches <strong>permanently</strong>
    </Checkbox>
    <Checkbox checked disabled label="Locked on (disabled)" />
    <Checkbox disabled label="Locked off (disabled)" />
  </div>
</DemoSection>

<DemoSection
  title="Indeterminate"
  description="The tri-state dash for parent rows whose children are partially selected — the consumer owns the state; toggling the parent resolves it."
  code={`<Checkbox
  checked={allIncluded}
  indeterminate={someIncluded}
  onchange={(v) => setAll(v)}
  label="All files"
/>`}
>
  <div class="col">
    <Checkbox
      checked={allIncluded}
      indeterminate={someIncluded}
      onchange={(v) => setAll(v)}
      label={`All files (${includedCount}/${files.length})`}
    />
    <div class="col col--nested">
      {#each files as file (file.name)}
        <Checkbox bind:checked={file.included} label={file.name} />
      {/each}
    </div>
  </div>
</DemoSection>

<DemoSection
  title="Form contract"
  description="The underlying element is a real input, so name/value submit natively and required blocks submission through the browser's constraint validation."
  code={`<form onsubmit={submitForm}>
  <Checkbox name="terms" value="accepted" required label="Accept the terms (required)" />
  <Button type="submit" size="sm" label="Submit" />
</form>`}
>
  <form class="col" onsubmit={submitForm}>
    <Checkbox name="terms" value="accepted" required label="Accept the terms (required)" />
    <div>
      <Button type="submit" size="sm" label="Submit" />
    </div>
    <span class="form-result" data-testid="checkbox-form-result">{submitted}</span>
  </form>
</DemoSection>

<style>
  .col {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .form-result {
    font-size: var(--font-size-xs);
    font-family: var(--font-mono);
    color: var(--text-muted);
    min-height: 1em;
  }

  .col--nested {
    padding-left: var(--space-7);
  }
</style>
