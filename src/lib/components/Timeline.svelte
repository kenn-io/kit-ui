<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    ariaLabel?: string | undefined;
    class?: string;
    children?: Snippet;
  }

  let { ariaLabel = undefined, class: className = "", children }: Props = $props();
</script>

<ol class={["kit-timeline", className]} aria-label={ariaLabel}>
  {#if children}
    {@render children()}
  {/if}
</ol>

<style>
  .kit-timeline {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    list-style: none;
    min-width: 0;
  }
</style>
