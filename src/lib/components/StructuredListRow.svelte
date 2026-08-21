<script lang="ts">
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import { getContext } from "svelte";
  import type { Snippet } from "svelte";
  import {
    structuredListLabelsContext,
    type StructuredListLabels,
  } from "./structured-list-context.js";

  interface Props {
    primary: Snippet;
    secondary?: Snippet;
    description?: Snippet;
    status?: Snippet;
    detail?: Snippet;
    ariaLabel?: string;
  }

  let { primary, secondary, description, status, detail, ariaLabel = undefined }: Props = $props();
  const labels = getContext<StructuredListLabels | undefined>(structuredListLabelsContext);
</script>

<div class="kit-structured-list-row" role="listitem">
  {#if detail}
    <details class="kit-structured-list-row__disclosure">
      <summary class="kit-structured-list-row__summary">
        <span class="kit-structured-list-row__chevron">
          {#if ariaLabel}<span class="kit-structured-list-row__hint">{ariaLabel}. </span>{/if}
          <ChevronRightIcon size="15" strokeWidth="2" aria-hidden="true" />
        </span>
        <span class="kit-structured-list-row__primary">
          {#if labels?.primary}<span class="kit-structured-list-row__label"
              >{labels.primary}:
            </span>{/if}
          {@render primary()}
        </span>
        {#if secondary}
          <span class="kit-structured-list-row__secondary">
            {#if labels?.secondary}<span class="kit-structured-list-row__label"
                >{labels.secondary}:
              </span>{/if}
            {@render secondary()}
          </span>
        {/if}
        {#if description}
          <span class="kit-structured-list-row__description">
            {#if labels?.description}<span class="kit-structured-list-row__label"
                >{labels.description}:
              </span>{/if}
            {@render description()}
          </span>
        {/if}
        {#if status}
          <span class="kit-structured-list-row__status">
            {#if labels?.status}<span class="kit-structured-list-row__label"
                >{labels.status}:
              </span>{/if}
            {@render status()}
          </span>
        {/if}
      </summary>
      <div class="kit-structured-list-row__detail">{@render detail()}</div>
    </details>
  {:else}
    <div class="kit-structured-list-row__summary kit-structured-list-row__summary--static">
      <span class="kit-structured-list-row__chevron" aria-hidden="true"></span>
      <span class="kit-structured-list-row__primary">
        {#if labels?.primary}<span class="kit-structured-list-row__label"
            >{labels.primary}:
          </span>{/if}
        {@render primary()}
      </span>
      {#if secondary}
        <span class="kit-structured-list-row__secondary">
          {#if labels?.secondary}<span class="kit-structured-list-row__label"
              >{labels.secondary}:
            </span>{/if}
          {@render secondary()}
        </span>
      {/if}
      {#if description}
        <span class="kit-structured-list-row__description">
          {#if labels?.description}<span class="kit-structured-list-row__label"
              >{labels.description}:
            </span>{/if}
          {@render description()}
        </span>
      {/if}
      {#if status}
        <span class="kit-structured-list-row__status">
          {#if labels?.status}<span class="kit-structured-list-row__label"
              >{labels.status}:
            </span>{/if}
          {@render status()}
        </span>
      {/if}
    </div>
  {/if}
</div>

<style>
  .kit-structured-list-row {
    min-width: 0;
    border-bottom: var(--border-width) solid var(--border-muted);
  }

  .kit-structured-list-row:last-child {
    border-bottom: 0;
  }

  .kit-structured-list-row__disclosure {
    min-width: 0;
  }

  .kit-structured-list-row__summary {
    box-sizing: border-box;
    display: grid;
    grid-template-columns: var(--kit-structured-list-columns);
    gap: var(--space-5);
    align-items: center;
    min-height: 40px;
    padding: var(--space-2) var(--space-5);
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    line-height: 1.25;
    list-style: none;
    transition: background-color var(--transition-fast) var(--transition-ease, ease);
  }

  summary.kit-structured-list-row__summary {
    cursor: pointer;
  }

  .kit-structured-list-row__summary::-webkit-details-marker {
    display: none;
  }

  summary.kit-structured-list-row__summary:hover,
  summary.kit-structured-list-row__summary:focus-visible {
    background: color-mix(in srgb, var(--text-primary) 4%, transparent);
  }

  summary.kit-structured-list-row__summary:focus-visible {
    outline: var(--focus-ring);
    outline-offset: -2px;
  }

  .kit-structured-list-row__chevron {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
  }

  .kit-structured-list-row__chevron :global(svg) {
    transition: transform var(--transition-fast) var(--transition-ease, ease);
  }

  .kit-structured-list-row__hint,
  .kit-structured-list-row__label {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
  }

  .kit-structured-list-row__disclosure[open] .kit-structured-list-row__chevron :global(svg) {
    transform: rotate(90deg);
  }

  .kit-structured-list-row__primary {
    grid-column: 2;
    min-width: 0;
    overflow: hidden;
    color: var(--text-primary);
    font-weight: var(--font-weight-semibold, 600);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .kit-structured-list-row__secondary,
  .kit-structured-list-row__description {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .kit-structured-list-row__secondary {
    grid-column: 3;
  }

  .kit-structured-list-row__description {
    grid-column: 4;
  }

  .kit-structured-list-row__status {
    grid-column: 5;
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    min-width: 0;
    white-space: nowrap;
  }

  .kit-structured-list-row__detail {
    padding: var(--space-4) var(--space-5) var(--space-5) calc(var(--space-5) * 2 + 15px);
    border-top: var(--border-width) solid var(--border-muted);
    background: var(--bg-inset);
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
  }

  @container kit-structured-list (max-width: 640px) {
    .kit-structured-list-row__summary {
      grid-template-columns: 15px minmax(0, 1fr) auto;
      gap: var(--space-2) var(--space-3);
      padding: var(--space-4);
    }

    .kit-structured-list-row__primary {
      grid-column: 2;
    }

    .kit-structured-list-row__status {
      grid-column: 3;
      grid-row: 1;
    }

    .kit-structured-list-row__secondary,
    .kit-structured-list-row__description {
      grid-column: 2 / 4;
      white-space: normal;
    }

    .kit-structured-list-row__detail {
      padding: var(--space-4);
    }
  }
</style>
