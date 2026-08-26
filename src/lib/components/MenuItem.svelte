<script lang="ts">
  import { getContext, type Snippet } from "svelte";
  import type { ClassValue } from "svelte/elements";
  import { menuContextKey, type MenuContext, type MenuItemRegistration } from "./menu.js";

  interface Props {
    onselect: () => void;
    disabled?: boolean;
    closeOnSelect?: boolean;
    tone?: "neutral" | "danger";
    textValue?: string;
    class?: ClassValue;
    children: Snippet;
  }

  let {
    onselect,
    disabled = false,
    closeOnSelect = true,
    tone = "neutral",
    textValue,
    class: className = "",
    children,
  }: Props = $props();

  const menu = getContext<MenuContext>(menuContextKey);
  let element = $state<HTMLButtonElement>();

  function select(): void {
    if (disabled) return;
    if (closeOnSelect) menu.closeMenu(true);
    onselect();
  }

  const registration: MenuItemRegistration = {
    element: () => element,
    textValue: () => textValue ?? element?.textContent?.trim() ?? "",
  };

  $effect(() => menu.registerItem(registration));
</script>

<button
  bind:this={element}
  class={["kit-menu__item", "kit-control-states", `kit-menu__item--${tone}`, className]}
  type="button"
  role="menuitem"
  tabindex="-1"
  aria-disabled={disabled || undefined}
  onclick={(event) => {
    if (disabled) {
      event.preventDefault();
      return;
    }
    select();
  }}
  onpointermove={() => element?.focus({ preventScroll: true })}
>
  {@render children()}
</button>

<style>
  .kit-menu__item {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    min-height: 28px;
    padding: var(--space-3) var(--space-4);
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-secondary);
    font: inherit;
    font-size: var(--font-size-sm);
    text-align: left;
    white-space: nowrap;
    cursor: pointer;
  }

  .kit-menu__item:hover:not([aria-disabled="true"]),
  .kit-menu__item:focus-visible {
    background: var(--bg-surface-hover);
    color: var(--text-primary);
  }

  .kit-menu__item--danger {
    color: color-mix(in srgb, var(--accent-red) 72%, var(--text-primary));
  }
</style>
