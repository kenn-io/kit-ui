<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ClassValue, HTMLAttributes } from "svelte/elements";

  interface Props extends Omit<HTMLAttributes<HTMLDivElement>, "class" | "onscroll"> {
    class?: ClassValue;
    dataTest?: string | undefined;
    label: string;
    onscroll?: ((event: Event) => void) | undefined;
    viewport?: HTMLDivElement | undefined;
    children: Snippet;
  }

  let {
    class: className = "",
    dataTest,
    label,
    onscroll,
    viewport = $bindable(),
    children,
    ...rest
  }: Props = $props();
</script>

<div class={["kit-scrollbox", className]} data-test={dataTest}>
  <!-- Scrollable regions need keyboard access. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    tabindex="0"
    {...rest}
    class="kit-scrollbox__viewport"
    aria-label={label}
    bind:this={viewport}
    {onscroll}
    role="region"
  >
    <div class="kit-scrollbox__content">
      {@render children()}
    </div>
  </div>
</div>

<style>
  .kit-scrollbox {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .kit-scrollbox__viewport {
    height: 100%;
    overflow-y: auto;
  }

  .kit-scrollbox__content {
    min-height: 100%;
  }
</style>
