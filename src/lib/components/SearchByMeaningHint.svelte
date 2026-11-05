<script lang="ts">
  import {
    DEFAULT_SEARCH_BY_MEANING_LABELS,
    type SearchByMeaningLabels,
  } from "./search-by-meaning.js";

  interface Props {
    onturnon: () => void;
    labels?: Partial<SearchByMeaningLabels>;
  }
  let { onturnon, labels = {} }: Props = $props();
  const words = $derived({ ...DEFAULT_SEARCH_BY_MEANING_LABELS, ...labels });
</script>

<p class="kit-search-by-meaning-hint">
  {words.hint} · <button type="button" onclick={onturnon}>{words.turnOn}</button>
</p>

<style>
  .kit-search-by-meaning-hint {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--text-muted);
  }
  button {
    padding: 0;
    border: 0;
    background: none;
    color: var(--accent-blue);
    font: inherit;
    cursor: pointer;
  }
  button:hover {
    text-decoration: underline;
  }
  button:focus-visible {
    outline: var(--focus-ring);
    outline-offset: 2px;
    border-radius: var(--radius-sm);
  }
</style>
