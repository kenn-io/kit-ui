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

  let format = $state<string | undefined>();
  let lineEnding = $state<string | undefined>("lf");

  let submitted = $state("");
  function submitForm(event: SubmitEvent) {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    submitted = `submitted: ${[...data.entries()].map(([k, v]) => `${k}=${v}`).join("&")}`;
  }
</script>

<DemoSection
  title="Basic"
  description="Short exclusive choices, one per line. Click a label or use the arrow keys to change the choice."
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
  description="Next to a Checkbox in a form. The inputs are real radios sharing a name, so the choice submits natively and required blocks submission until an option is chosen. Reset returns each group to the choice it started with and updates the bound value."
  code={`<form onsubmit={submitForm}>
  <RadioGroup
    legend="Export format"
    name="format"
    required
    options={[
      { value: "csv", label: "CSV" },
      { value: "json", label: "JSON" },
    ]}
    bind:value={format}
  />
  <RadioGroup
    legend="Line endings"
    name="eol"
    options={[
      { value: "lf", label: "LF" },
      { value: "crlf", label: "CRLF" },
    ]}
    bind:value={lineEnding}
  />
  <Checkbox name="headers" value="yes" label="Include headers" />
  <Button type="submit" size="sm" label="Export" />
  <Button type="reset" size="sm" label="Reset" />
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
      bind:value={format}
    />
    <RadioGroup
      legend="Line endings"
      name="eol"
      options={[
        { value: "lf", label: "LF" },
        { value: "crlf", label: "CRLF" },
      ]}
      bind:value={lineEnding}
    />
    <Checkbox name="headers" value="yes" label="Include headers" />
    <div class="actions">
      <Button type="submit" size="sm" label="Export" />
      <Button type="reset" size="sm" label="Reset" />
    </div>
    <span class="readout" data-testid="radio-group-form-value">
      format: {format ?? "none"}, line endings: {lineEnding ?? "none"}
    </span>
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

  .actions {
    display: flex;
    gap: var(--space-4);
  }

  .readout {
    font-size: var(--font-size-xs);
    font-family: var(--font-mono);
    color: var(--text-muted);
    min-height: 1em;
  }
</style>
