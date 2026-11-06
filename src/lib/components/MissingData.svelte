<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    /** What is missing, as a short phrase ("No pinned messages"). */
    title: string;
    /** Why it is missing or how to fill it, in one or two sentences. */
    description?: string;
    /** A neutral glyph for the page or feature, typically a lucide icon.
     * It renders at 24px whatever size the icon was given. */
    icon?: Snippet;
    /** Controls that fill the gap, such as Retry or Build now. */
    action?: Snippet;
    /** `status` when the state replaces content that was loading, so screen
     * readers announce it; `note` for a fixed explanation. */
    role?: "status" | "note";
    class?: string;
  }

  let {
    title,
    description = undefined,
    icon = undefined,
    action = undefined,
    role = undefined,
    class: className = "",
  }: Props = $props();
</script>

<!-- The empty or unavailable state for a whole page or panel: nothing saved
     yet, no rows for these filters, or a feature this server does not
     offer. No frame or fill, so it never reads as an alert, and it sits a
     fixed step below the top of its container, so every page shows it in
     the same place. -->
<div class={["kit-missing-data", className]} {role}>
  {#if icon}
    <span class="kit-missing-data__icon" aria-hidden="true">{@render icon()}</span>
  {/if}
  <p class="kit-missing-data__title">{title}</p>
  {#if description}
    <p class="kit-missing-data__description">{description}</p>
  {/if}
  {#if action}
    <div class="kit-missing-data__action">{@render action()}</div>
  {/if}
</div>

<style>
  .kit-missing-data {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    align-self: stretch;
    width: 100%;
    padding: calc(var(--space-8) + var(--space-6)) var(--space-6);
    text-align: center;
  }

  .kit-missing-data__icon {
    display: inline-flex;
    margin-bottom: var(--space-3);
    color: var(--text-muted);
  }

  .kit-missing-data__icon :global(svg) {
    width: 24px;
    height: 24px;
  }

  /* Centered text keeps balanced lines so a lone word does not dangle. */
  .kit-missing-data__title,
  .kit-missing-data__description {
    margin: 0;
    max-width: 52ch;
    font-size: var(--font-size-md);
    line-height: 1.45;
    text-wrap: balance;
  }

  .kit-missing-data__title {
    color: var(--text-primary);
    font-weight: var(--font-weight-semibold, 600);
  }

  .kit-missing-data__description {
    margin-top: var(--space-1);
    color: var(--text-muted);
  }

  .kit-missing-data__action {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--space-4);
    margin-top: var(--space-5);
  }
</style>
