<script lang="ts">
  import { Button, NumberInput, TextInput } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  let timeout = $state<number | null>(30);
  let port = $state<number | null>(8080);
  let ratio = $state<number | null>(0.5);
  let percent = $state<number | null>(40);
  let share = $state<number | null>(0.5);
  let offset = $state<number | null>(-2);
  let oversized = $state<number | null>(1e20);
  let changes = $state(0);

  const timeoutInvalid = $derived(timeout === null || timeout < 1 || timeout > 3600);

  function describe(value: number | null): string {
    return value === null ? "null" : `${value} (${typeof value})`;
  }
</script>

<DemoSection
  title="NumberInput"
  description="A numeric field built on TextInput, so it shares its sizes, border, focus ring and states. Arrow Up and Arrow Down step the value, typing accepts only digits (plus a minus sign or decimal separator when the range and step allow them), and the bound value is a number or null. The decimal separator follows the locale prop, which defaults to the browser's locale."
  code={`<NumberInput bind:value={timeout} min={1} max={3600} invalid={timeoutInvalid} ariaLabel="Timeout">
  {#snippet suffix()}sec{/snippet}
</NumberInput>
<NumberInput bind:value={ratio} min={0} max={1} step={0.1} ariaLabel="Ratio" />
<NumberInput bind:value={share} min={0} max={1} step={0.1} locale="de-DE" ariaLabel="Share" />`}
>
  <div class="col">
    <div class="field">
      <label class="field__label" for="number-demo-timeout"
        >Timeout in seconds (1 to 3600, required)</label
      >
      <span class="row">
        <NumberInput
          bind:value={timeout}
          min={1}
          max={3600}
          invalid={timeoutInvalid}
          required
          onchange={() => changes++}
          id="number-demo-timeout"
        >
          {#snippet suffix()}<span class="unit">sec</span>{/snippet}
        </NumberInput>
        <span class="readout" data-testid="timeout-value"
          >value: <code>{describe(timeout)}</code></span
        >
      </span>
    </div>
    <div class="field">
      <label class="field__label" for="number-demo-port">Port (1 to 65535)</label>
      <span class="row">
        <NumberInput
          bind:value={port}
          min={1}
          max={65535}
          placeholder="8080"
          id="number-demo-port"
        />
        <span class="readout">value: <code>{describe(port)}</code></span>
      </span>
    </div>
    <div class="field">
      <label class="field__label" for="number-demo-percent"
        >Percent (the app caps it at 100 as you type)</label
      >
      <span class="row">
        <NumberInput
          bind:value={percent}
          min={0}
          oninput={(next) => {
            if (next !== null && next > 100) percent = 100;
          }}
          id="number-demo-percent"
        />
        <span class="readout" data-testid="percent-value"
          >value: <code>{describe(percent)}</code></span
        >
      </span>
    </div>
    <div class="field">
      <label class="field__label" for="number-demo-ratio">Ratio (0 to 1, step 0.1)</label>
      <span class="row">
        <NumberInput bind:value={ratio} min={0} max={1} step={0.1} id="number-demo-ratio" />
        <span class="readout" data-testid="ratio-value">value: <code>{describe(ratio)}</code></span>
      </span>
    </div>
    <div class="field">
      <label class="field__label" for="number-demo-share"
        >Share in a comma locale (de-DE, 0 to 1, step 0.1)</label
      >
      <span class="row">
        <NumberInput
          bind:value={share}
          min={0}
          max={1}
          step={0.1}
          locale="de-DE"
          id="number-demo-share"
        />
        <span class="readout" data-testid="share-value">value: <code>{describe(share)}</code></span>
      </span>
    </div>
    <div class="field">
      <label class="field__label" for="number-demo-offset">Offset (any integer, required)</label>
      <span class="row">
        <NumberInput bind:value={offset} required id="number-demo-offset" />
        <span class="readout" data-testid="offset-value"
          >value: <code>{describe(offset)}</code></span
        >
        <!-- Sets the value the way an app would, without taking focus from
             the field, so its in-progress text can be checked. The
             mousedown handler only keeps focus where it is; the buttons
             inside stay the interactive elements. -->
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <span
          class="row"
          role="group"
          aria-label="Set the offset from outside"
          onmousedown={(event) => event.preventDefault()}
        >
          <Button size="sm" label="Set to 10" onclick={() => (offset = 10)} />
          <Button size="sm" label="Clear" onclick={() => (offset = null)} />
        </span>
      </span>
    </div>
    <div class="field">
      <label class="field__label" for="number-demo-oversized"
        >Oversized (set to 1e20 from outside; Backspace shortens it)</label
      >
      <span class="row">
        <NumberInput bind:value={oversized} id="number-demo-oversized" />
        <span class="readout" data-testid="oversized-value"
          >value: <code>{describe(oversized)}</code></span
        >
      </span>
    </div>
    <span class="readout" data-testid="change-count">timeout changes committed: {changes}</span>
  </div>
</DemoSection>

<DemoSection
  title="Beside TextInput"
  description="Each size next to a TextInput of the same size: the heights, padding and chrome match."
  code={`<TextInput size="sm" ariaLabel="Name" />
<NumberInput size="sm" ariaLabel="Count" />`}
>
  <div class="col">
    {#each ["sm", "md", "lg"] as const as size (size)}
      <div class="row" data-testid={`pair-${size}`}>
        <TextInput {size} placeholder={`TextInput ${size}`} ariaLabel={`Text ${size}`} />
        <NumberInput {size} placeholder={`NumberInput ${size}`} ariaLabel={`Number ${size}`} />
      </div>
    {/each}
    <div class="row" data-testid="pair-disabled">
      <TextInput placeholder="disabled" disabled ariaLabel="Disabled text" />
      <NumberInput value={12} disabled ariaLabel="Disabled number" />
    </div>
    <div class="row">
      <TextInput value="read-only" readonly ariaLabel="Read-only text" />
      <!-- Out of range on purpose: a read-only field shows the value as given. -->
      <NumberInput value={5000} max={3600} readonly ariaLabel="Read-only number" />
    </div>
  </div>
</DemoSection>

<style>
  .col {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    width: 100%;
    max-width: 480px;
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    flex-wrap: wrap;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .field__label {
    font-size: var(--font-size-xs);
    font-weight: 600;
    color: var(--text-secondary);
  }

  .unit {
    font-size: var(--font-size-xs);
  }

  .readout {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
  }
</style>
