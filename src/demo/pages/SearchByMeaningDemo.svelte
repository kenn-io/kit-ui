<script lang="ts">
  import {
    Checkbox,
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
      state: { kind: "indexing", done: 12_000, total: 48_000, etaMs: 7_200_000 },
    },
    { id: "scanning", title: "Counting work", state: { kind: "indexing", done: 0, total: 0 } },
  ];
  let turnOnClicks = $state<Record<string, number>>({});
  let builtInClicks = $state<Record<string, number>>({});
  let readonly = $state(false);
  let french = $state(false);
  const locale = $derived(french ? "fr" : "en");
  const labels = $derived(
    french
      ? {
          name: "Recherche par sens",
          off: "Désactivée",
          on: "Activée",
          ollama: "Activée · Ollama",
          turningOn: "Activation",
          useBuiltIn: "Utiliser le serveur intégré",
          downloaded: "Déjà sur cet ordinateur",
          keepsIndex: "Le changement conserve votre index",
          underMinute: "moins d’une minute",
          progress: "Configuration de la recherche par sens",
          indexing: "Indexation de {done} sur {total} {items}",
          aboutTime: "environ {time}",
          timeLeft: "{time} restantes",
          download: "Télécharge {size} une fois pour toutes les applications Kenn",
          downloadToHost: "Télécharge {size} une fois sur {host}",
          downloading: "Téléchargement de {done} sur {total}",
          meanwhile: "La recherche par mots-clés reste disponible",
          rebuild: "Reconstruit l’index, {time} pour {count} {items}",
          hint: "La recherche par sens est désactivée",
          turnOn: "Activer",
        }
      : {},
  );
</script>

<div class="meaning-demo">
  <div data-testid="meaning-readonly">
    <Checkbox bind:checked={readonly} label="Status only" />
  </div>
  <Checkbox bind:checked={french} label="French" />
  {#each examples as example (example.id)}
    <DemoSection title={example.title}>
      <div class="example" data-testid={`meaning-${example.id}`}>
        <SearchByMeaningRow
          state={example.state}
          {locale}
          {labels}
          {readonly}
          itemNoun="messages"
          onturnon={() => (turnOnClicks[example.id] = (turnOnClicks[example.id] ?? 0) + 1)}
          onusebuiltin={() => (builtInClicks[example.id] = (builtInClicks[example.id] ?? 0) + 1)}
        />
        {#if !readonly && (example.state.kind === "off" || example.state.kind === "downloaded" || example.state.kind.startsWith("ollama"))}
          <p
            class="readout"
            data-testid="clicks"
            data-turn-on={turnOnClicks[example.id] ?? 0}
            data-use-built-in={builtInClicks[example.id] ?? 0}
          >
            Clicks: {(turnOnClicks[example.id] ?? 0) + (builtInClicks[example.id] ?? 0)}
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
      <SearchByMeaningHint
        {labels}
        onturnon={() => (turnOnClicks["hint"] = (turnOnClicks["hint"] ?? 0) + 1)}
      />
      <p
        class="readout"
        data-testid="clicks"
        data-turn-on={turnOnClicks["hint"] ?? 0}
        data-use-built-in="0"
      >
        Clicks: {turnOnClicks["hint"] ?? 0}
      </p>
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
    padding: 0;
    list-style: none;
  }
</style>
