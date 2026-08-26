<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ClassValue, HTMLButtonAttributes } from "svelte/elements";

  interface Props extends Omit<
    HTMLButtonAttributes,
    "children" | "class" | "onpointermove" | "type"
  > {
    /** Consumer-owned structural styling. ButtonBase supplies no action chrome. */
    class?: ClassValue;
    /** The underlying native button, bindable for focus and popover positioning. */
    element?: HTMLButtonElement;
    type?: "button" | "submit" | "reset";
    onpointermove?: HTMLButtonAttributes["onpointermove"];
    children: Snippet;
  }

  let {
    class: className = "",
    element = $bindable(),
    type = "button",
    onpointermove,
    children,
    ...rest
  }: Props = $props();

  function handlePointerMove(event: PointerEvent & { currentTarget: HTMLButtonElement }) {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--kit-pointer-x", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--kit-pointer-y", `${event.clientY - rect.top}px`);
    onpointermove?.(event);
  }
</script>

<button
  {...rest}
  {type}
  class={["kit-button-base", className]}
  bind:this={element}
  onpointermove={handlePointerMove}
>
  {@render children()}
</button>

<style>
  :where(.kit-button-base) {
    box-sizing: border-box;
    appearance: none;
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: inherit;
    cursor: pointer;
    transition:
      transform var(--transition-fast) var(--transition-ease, ease),
      opacity var(--transition-fast) var(--transition-ease, ease);
  }

  :where(.kit-button-base:active:not(:disabled)) {
    transform: var(--press-transform);
  }

  :where(.kit-button-base:disabled) {
    opacity: var(--opacity-disabled);
    cursor: not-allowed;
  }
</style>
