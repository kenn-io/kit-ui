<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    left: Snippet;
    center?: Snippet;
    right?: Snippet;
    /** Sections clip their content by default so long text truncates inside
     * the 24px bar. Pass "visible" when a snippet anchors a popover (see the
     * Popovers section in the docs) — overflow management is then the app's
     * responsibility. */
    overflow?: "hidden" | "visible";
  }

  let { left, center = undefined, right = undefined, overflow = "hidden" }: Props = $props();
</script>

<footer class="kit-status-bar" class:kit-status-bar--overflow-visible={overflow === "visible"}>
  <div class="kit-status-bar__section kit-status-bar__section--left">
    {@render left()}
  </div>
  <div class="kit-status-bar__section kit-status-bar__section--center">
    {#if center}
      {@render center()}
    {/if}
  </div>
  <div class="kit-status-bar__section kit-status-bar__section--right">
    {#if right}
      {@render right()}
    {/if}
  </div>
</footer>

<style>
  .kit-status-bar {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    height: var(--status-bar-height, 24px);
    flex-shrink: 0;
    padding: 0 var(--space-5);
    background: var(--bg-surface);
    border-top: 1px solid var(--border-default);
    color: var(--text-muted);
    font-size: var(--font-size-2xs);
    letter-spacing: var(--letter-spacing-label, 0.01em);
  }

  .kit-status-bar__section {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
  }

  .kit-status-bar__section--left,
  .kit-status-bar__section--right {
    flex: 1 1 0;
  }

  .kit-status-bar__section--center {
    flex: 0 0 auto;
  }

  .kit-status-bar__section--right {
    justify-content: flex-end;
  }

  .kit-status-bar--overflow-visible .kit-status-bar__section {
    overflow: visible;
  }
</style>
