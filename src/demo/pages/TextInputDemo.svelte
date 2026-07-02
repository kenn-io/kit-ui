<script lang="ts">
  import AtSignIcon from "@lucide/svelte/icons/at-sign";
  import { SearchInput, TextInput } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  let name = $state("");
  let email = $state("not-an-email");
  let query = $state("");
  let filtered = $state("");

  const emailInvalid = $derived(email.length > 0 && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email));
</script>

<DemoSection
  title="TextInput"
  description="The bordered field primitive: 24px (sm) or 28px (md) tall to match the shared toolbar control heights, focus and invalid states on the wrapper, prefix/suffix snippets inside the border."
  code={`<TextInput bind:value placeholder="Display name" />
<TextInput bind:value={email} type="email" invalid={emailInvalid} ariaLabel="Email">
  {#snippet prefix()}<AtSignIcon size="13" />{/snippet}
</TextInput>`}
>
  <div class="col">
    <label class="field">
      <span class="field__label">Display name</span>
      <TextInput bind:value={name} placeholder="Ada Lovelace" />
    </label>
    <label class="field">
      <span class="field__label">Email (validates)</span>
      <TextInput
        bind:value={email}
        type="email"
        invalid={emailInvalid}
        placeholder="you@example.com"
      >
        {#snippet prefix()}
          <AtSignIcon size="13" strokeWidth="2" aria-hidden="true" />
        {/snippet}
      </TextInput>
    </label>
    <div class="row">
      <TextInput size="sm" placeholder="sm (24px)" ariaLabel="Small example" />
      <TextInput size="md" placeholder="md (28px)" ariaLabel="Medium example" />
      <TextInput placeholder="disabled" disabled ariaLabel="Disabled example" />
    </div>
  </div>
</DemoSection>

<DemoSection
  title="SearchInput"
  description="TextInput preconfigured for filtering: search icon, a clear button that appears with content (Escape also clears), and an optional shortcut hint while empty."
  code={`<SearchInput bind:value={query} keys={["⌘", "K"]} block />
<SearchInput bind:value={filtered} size="sm" placeholder="Filter rows…" />`}
>
  <div class="col">
    <SearchInput bind:value={query} keys={["⌘", "K"]} block />
    <div class="row">
      <SearchInput
        bind:value={filtered}
        size="sm"
        placeholder="Filter rows…"
        ariaLabel="Filter rows"
      />
      <span class="readout">query: <code>{filtered || "—"}</code></span>
    </div>
  </div>
</DemoSection>

<style>
  .col {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    width: 100%;
    max-width: 420px;
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

  .readout {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
  }
</style>
