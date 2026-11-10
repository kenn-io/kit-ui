<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    /** A neutral glyph for the page or feature, typically a lucide icon.
     * It renders in muted ink at the size the caller gives it; 24px is the
     * size for empty states. */
    icon?: Snippet;
    /** What is missing, as a short phrase ("No pinned messages"). */
    title: string;
    /** Why it is missing or how to fill it, in one or two sentences. */
    description?: string;
    /** Where it sits in its container. `center` centers it in a pane.
     * `top` puts it a fixed step (48px) below the container's top, so every
     * page shows it in the same place under its header. */
    align?: "top" | "center";
    /** `status` when the state replaces content that was loading, so screen
     * readers announce it; `note` for a fixed explanation. */
    role?: "status" | "note";
    class?: string;
    /** Rendered under the text: controls that fill the gap, such as Retry
     * or Add repository. */
    children?: Snippet;
  }

  let {
    icon = undefined,
    title,
    description = undefined,
    align = "center",
    role = undefined,
    class: className = "",
    children = undefined,
  }: Props = $props();
</script>

<!-- The empty or unavailable state for a pane, panel or whole page: nothing
     saved yet, no rows for these filters, or a feature this server does not
     offer. No frame or fill, so it never reads as an alert. -->
<div class={["kit-empty-state", `kit-empty-state--${align}`, className]} {role}>
  {#if icon}
    <div class="kit-empty-state__icon" aria-hidden="true">
      {@render icon()}
    </div>
  {/if}
  <p class="kit-empty-state__title">{title}</p>
  {#if description}
    <p class="kit-empty-state__description">{description}</p>
  {/if}
  {#if children}
    <div class="kit-empty-state__actions">
      {@render children()}
    </div>
  {/if}
</div>

<style>
  .kit-empty-state {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    text-align: center;
  }

  /* Centers itself in a flex parent, and its own content. */
  .kit-empty-state--center {
    justify-content: center;
    margin: auto;
    padding: var(--space-8) var(--space-6);
  }

  /* A fixed 48px step below the container's top, whatever its height. */
  .kit-empty-state--top {
    align-self: stretch;
    padding: calc(var(--space-8) + var(--space-6)) var(--space-6);
  }

  .kit-empty-state__icon {
    display: flex;
    margin-bottom: var(--space-2);
    color: var(--text-muted);
  }

  /* Centered text keeps balanced lines so a lone word does not dangle. */
  .kit-empty-state__title,
  .kit-empty-state__description {
    margin: 0;
    max-width: 380px;
    line-height: 1.45;
    text-wrap: balance;
  }

  .kit-empty-state__title {
    color: var(--text-primary);
    font-size: var(--font-size-md);
    font-weight: var(--font-weight-semibold, 600);
  }

  .kit-empty-state__description {
    color: var(--text-muted);
    font-size: var(--font-size-sm);
  }

  .kit-empty-state__actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--space-4);
    margin-top: var(--space-4);
  }
</style>
