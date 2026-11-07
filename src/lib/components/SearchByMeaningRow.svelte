<script lang="ts">
  import Button from "./Button.svelte";
  import Chip from "./Chip.svelte";
  import Spinner from "./Spinner.svelte";
  import {
    DEFAULT_SEARCH_BY_MEANING_LABELS,
    describeSearchByMeaning,
    type SearchByMeaningLabels,
    type SearchByMeaningState,
  } from "./search-by-meaning.js";

  interface Props {
    state: SearchByMeaningState;
    /** Noun selected by the caller for itemCount or total, including plural rules. */
    itemNoun: string;
    labels?: Partial<SearchByMeaningLabels>;
    /** BCP 47 locale for numbers, download sizes, and durations; defaults to the runtime locale. */
    locale?: string | undefined;
    /** Show status only, with no button, for viewers who can't change it. */
    readonly?: boolean;
    onturnon: () => void;
    onusebuiltin: () => void;
  }

  let {
    state,
    itemNoun,
    labels = {},
    locale,
    readonly = false,
    onturnon,
    onusebuiltin,
  }: Props = $props();
  const words = $derived({ ...DEFAULT_SEARCH_BY_MEANING_LABELS, ...labels });
  const description = $derived(describeSearchByMeaning(state, itemNoun, words, locale));
  const action = $derived(readonly ? undefined : description.action);
  // A total of 0 is unknown: the line shows a spinner, not an empty bar.
  const bar = $derived(
    description.progress && description.progress.max > 0 ? description.progress : undefined,
  );
  const percent = $derived(bar ? Math.min(100, (bar.value / bar.max) * 100) : 0);
</script>

<div class="kit-search-by-meaning" class:kit-search-by-meaning--no-action={!action}>
  <span class="kit-search-by-meaning__name">{words.name}</span>
  <Chip size="xs" uppercase={false} tone={description.tone}>{description.chip}</Chip>
  {#if description.warning}
    <p class="kit-search-by-meaning__warning">{description.warning}</p>
  {/if}
  {#if bar}
    <div
      class="kit-search-by-meaning__progress"
      role="progressbar"
      aria-label={words.progress}
      aria-valuemin="0"
      aria-valuenow={bar.value}
      aria-valuemax={bar.max}
      aria-valuetext={description.line}
    >
      <div class="kit-search-by-meaning__fill" style:width={`${percent}%`}></div>
    </div>
  {/if}
  {#if description.line}
    <p class="kit-search-by-meaning__line">
      {#if description.progress && !bar}<span class="kit-search-by-meaning__spinner"
          ><Spinner size={10} label={words.progress} /></span
        >{/if}{description.line}
    </p>
  {/if}
  {#if action}
    <div class="kit-search-by-meaning__action">
      <Button
        size="sm"
        tone={action === "turn-on" ? "info" : "neutral"}
        surface={action === "turn-on" ? "soft" : "outline"}
        onclick={action === "turn-on" ? onturnon : onusebuiltin}
      >
        {action === "turn-on" ? words.turnOn : words.useBuiltIn}
      </Button>
    </div>
  {/if}
</div>

<style>
  .kit-search-by-meaning {
    display: grid;
    grid-template-columns: minmax(0, 1fr) max-content max-content;
    gap: var(--space-3) var(--space-5);
    min-height: 32px;
    align-items: center;
  }
  .kit-search-by-meaning--no-action {
    grid-template-columns: minmax(0, 1fr) max-content;
  }
  .kit-search-by-meaning__name {
    font-size: var(--font-size-md);
    font-weight: 500;
    color: var(--text-primary);
  }
  .kit-search-by-meaning__action {
    grid-column: 3;
    grid-row: 1;
    justify-self: end;
  }
  .kit-search-by-meaning__line,
  .kit-search-by-meaning__warning {
    grid-column: 1 / -1;
    margin: 0;
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    line-height: 1.45;
    text-wrap: pretty;
  }
  .kit-search-by-meaning__warning {
    color: color-mix(in srgb, var(--accent-amber) 65%, var(--text-primary));
  }
  .kit-search-by-meaning__spinner {
    display: inline-flex;
    margin-inline-end: var(--space-2);
    vertical-align: -1px;
  }
  .kit-search-by-meaning__progress {
    grid-column: 1 / -1;
    height: 6px;
    overflow: hidden;
    background: var(--bg-inset);
    border: 1px solid var(--border-muted);
    border-radius: var(--radius-sm);
  }
  .kit-search-by-meaning__fill {
    height: 100%;
    background: var(--accent-blue);
    transition: width 0.2s;
  }
  @media (prefers-reduced-motion: reduce) {
    .kit-search-by-meaning__fill {
      transition: none;
    }
  }
  @media (max-width: 640px) {
    .kit-search-by-meaning {
      grid-template-columns: minmax(0, 1fr) max-content;
    }
    .kit-search-by-meaning__action {
      grid-column: 1 / -1;
      grid-row: auto;
      justify-self: start;
    }
  }
</style>
