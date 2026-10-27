<script lang="ts">
  import { Button, Checkbox, RadioGroup } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  const channels = [
    { value: "stable", label: "Stable" },
    { value: "beta", label: "Beta" },
    { value: "nightly", label: "Nightly" },
  ];
  let channel = $state("stable");
  let changes = $state(0);

  const sizes = [
    { value: "small", label: "Small" },
    { value: "medium", label: "Medium" },
    { value: "large", label: "Large (unavailable)", disabled: true },
  ];

  let submitted = $state("");
  function submitForm(event: SubmitEvent) {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    submitted = `submitted: ${[...data.entries()].map(([k, v]) => `${k}=${v}`).join("&")}`;
  }
</script>

<DemoSection
  title="Basic"
  description="A fieldset whose legend names the group, one real radio per line under a drawn 16px round mark. Arrow keys move the choice, as with native radios."
  code={`<RadioGroup
  legend="Update channel"
  options={[
    { value: "stable", label: "Stable" },
    { value: "beta", label: "Beta" },
    { value: "nightly", label: "Nightly" },
  ]}
  bind:value={channel}
/>`}
>
  <div class="col">
    <RadioGroup
      legend="Update channel"
      options={channels}
      bind:value={channel}
      onchange={() => (changes += 1)}
    />
    <span class="readout" data-testid="radio-group-value">
      channel: {channel}, changes: {changes}
    </span>
  </div>
</DemoSection>

<DemoSection
  title="Disabled"
  description="One option can be disabled on its own; arrow keys skip it. A disabled group dims the legend with it."
  code={`<RadioGroup legend="Size" options={sizes} value="small" />
<RadioGroup legend="Region (locked)" options={channels} value="beta" disabled />`}
>
  <div class="row">
    <RadioGroup legend="Size" options={sizes} value="small" />
    <RadioGroup legend="Region (locked)" options={channels} value="beta" disabled />
  </div>
</DemoSection>

<DemoSection
  title="Form contract"
  description="Next to a Checkbox in a form. The inputs are real radios sharing a name, so the choice submits natively and required blocks submission until an option is chosen."
  code={`<form onsubmit={submitForm}>
  <RadioGroup
    legend="Export format"
    name="format"
    required
    options={[
      { value: "csv", label: "CSV" },
      { value: "json", label: "JSON" },
    ]}
  />
  <Checkbox name="headers" value="yes" label="Include headers" />
  <Button type="submit" size="sm" label="Export" />
</form>`}
>
  <form class="col" onsubmit={submitForm}>
    <RadioGroup
      legend="Export format"
      name="format"
      required
      options={[
        { value: "csv", label: "CSV" },
        { value: "json", label: "JSON" },
      ]}
    />
    <Checkbox name="headers" value="yes" label="Include headers" />
    <div>
      <Button type="submit" size="sm" label="Export" />
    </div>
    <span class="readout" data-testid="radio-group-form-result">{submitted}</span>
  </form>
</DemoSection>

<style>
  .col {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-8);
  }

  .readout {
    font-size: var(--font-size-xs);
    font-family: var(--font-mono);
    color: var(--text-muted);
    min-height: 1em;
  }
</style>
