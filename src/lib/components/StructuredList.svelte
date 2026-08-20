<script module lang="ts">
  export type StructuredListLevel = "inset" | "default" | "raised";
</script>

<script lang="ts">
  import { setContext } from "svelte";
  import type { Snippet } from "svelte";
  import Card from "./Card.svelte";
  import {
    structuredListLabelsContext,
    type StructuredListLabels,
  } from "./structured-list-context.js";

  interface Props {
    ariaLabel: string;
    primaryLabel: string;
    secondaryLabel?: string;
    descriptionLabel?: string;
    statusLabel?: string;
    level?: StructuredListLevel;
    children?: Snippet;
  }

  let {
    ariaLabel,
    primaryLabel,
    secondaryLabel = "",
    descriptionLabel = "",
    statusLabel = "",
    level = "default",
    children,
  }: Props = $props();

  setContext<StructuredListLabels>(structuredListLabelsContext, {
    get primary() {
      return primaryLabel;
    },
    get secondary() {
      return secondaryLabel;
    },
    get description() {
      return descriptionLabel;
    },
    get status() {
      return statusLabel;
    },
  });
</script>

<Card {level} padding="none" class="kit-structured-list">
  <div class="kit-structured-list__header" aria-hidden="true">
    <span></span>
    <span>{primaryLabel}</span>
    <span>{secondaryLabel}</span>
    <span>{descriptionLabel}</span>
    <span class="kit-structured-list__header-status">{statusLabel}</span>
  </div>
  <div class="kit-structured-list__items" role="list" aria-label={ariaLabel}>
    {#if children}{@render children()}{/if}
  </div>
</Card>

<style>
  :global(.kit-structured-list) {
    --kit-structured-list-columns: 15px minmax(0, 0.9fr) minmax(0, 1.1fr) minmax(0, 2fr)
      minmax(6rem, 0.6fr);

    container-name: kit-structured-list;
    container-type: inline-size;
    overflow: clip;
  }

  .kit-structured-list__header {
    display: grid;
    grid-template-columns: var(--kit-structured-list-columns);
    gap: var(--space-5);
    align-items: center;
    min-height: 32px;
    padding: 0 var(--space-5);
    border-bottom: var(--border-width) solid var(--border-muted);
    color: var(--text-muted);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold, 600);
    letter-spacing: var(--letter-spacing-label, 0.04em);
    text-transform: uppercase;
  }

  .kit-structured-list__header-status {
    text-align: right;
  }

  .kit-structured-list__items {
    min-width: 0;
  }

  @container kit-structured-list (max-width: 640px) {
    .kit-structured-list__header {
      display: none;
    }
  }
</style>
