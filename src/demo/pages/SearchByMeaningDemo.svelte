<script lang="ts">
  import {
    SearchByMeaningRow,
    SearchByMeaningHint,
    type SearchByMeaningState,
  } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  const examples: { id: string; title: string; state: SearchByMeaningState }[] = [
    { id: "off", title: "Nothing set up", state: { kind: "off", downloadBytes: 290_000_000 } },
    {
      id: "remote",
      title: "Remote host",
      state: { kind: "off", downloadBytes: 290_000_000, host: "host.example" },
    },
    { id: "downloaded", title: "Downloaded by another app", state: { kind: "downloaded" } },
    { id: "ollama", title: "Ollama · nomic-embed-text", state: { kind: "ollama" } },
    {
      id: "ollama-other",
      title: "Ollama · another model",
      state: { kind: "ollama-other", itemCount: 48_000, rebuildMs: 1_200_000 },
    },
    { id: "on", title: "Built-in", state: { kind: "on" } },
    {
      id: "downloading",
      title: "Downloading",
      state: { kind: "downloading", doneBytes: 120_000_000, totalBytes: 290_000_000 },
    },
    {
      id: "indexing",
      title: "Indexing",
      state: { kind: "indexing", done: 12_000, total: 48_000, etaMs: 900_000 },
    },
  ];
  let clicks = $state<Record<string, number>>({});
</script>

<div class="meaning-demo">
  {#each examples as example (example.id)}
    <DemoSection title={example.title}>
      <div class="example" data-testid={`meaning-${example.id}`}>
        <SearchByMeaningRow
          state={example.state}
          itemNoun="messages"
          onturnon={() => (clicks[example.id] = (clicks[example.id] ?? 0) + 1)}
          onusebuiltin={() =>
            (clicks[`${example.id}-builtin`] = (clicks[`${example.id}-builtin`] ?? 0) + 1)}
        />
        {#if example.state.kind === "off" || example.state.kind === "downloaded" || example.state.kind.startsWith("ollama")}
          <p class="readout" data-testid="clicks">
            Clicks: {clicks[
              example.state.kind.startsWith("ollama") ? `${example.id}-builtin` : example.id
            ] ?? 0}
          </p>
        {/if}
      </div>
    </DemoSection>
  {/each}
  <DemoSection title="Keyword-only results">
    <div class="example" data-testid="meaning-hint">
      <ul>
        <li>Meeting notes</li>
        <li>Project update</li>
      </ul>
      <SearchByMeaningHint onturnon={() => (clicks["hint"] = (clicks["hint"] ?? 0) + 1)} />
      <p class="readout" data-testid="clicks">Clicks: {clicks["hint"] ?? 0}</p>
    </div>
  </DemoSection>
</div>

<style>
  .example {
    width: 100%;
    min-width: 0;
  }
  .readout {
    margin: var(--space-3) 0 0;
    font-size: var(--font-size-xs);
    color: var(--text-muted);
  }
  ul {
    margin: 0 0 var(--space-4);
    padding-left: var(--space-5);
  }
</style>
