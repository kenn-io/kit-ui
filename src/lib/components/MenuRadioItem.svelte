<script lang="ts">
  import CheckIcon from "@lucide/svelte/icons/check";
  import { getContext, type Snippet } from "svelte";
  import type { ClassValue } from "svelte/elements";
  import {
    menuContextKey,
    menuRadioGroupContextKey,
    type MenuContext,
    type MenuItemRegistration,
    type MenuRadioGroupContext,
  } from "./menu.js";

  interface Props {
    value: string;
    disabled?: boolean;
    closeOnSelect?: boolean;
    textValue?: string;
    class?: ClassValue;
    children: Snippet;
  }

  let {
    value,
    disabled = false,
    closeOnSelect = false,
    textValue,
    class: className = "",
    children,
  }: Props = $props();

  const menu = getContext<MenuContext>(menuContextKey);
  const group = getContext<MenuRadioGroupContext>(menuRadioGroupContextKey);
  let element = $state<HTMLButtonElement>();
  const checked = $derived(group.value === value);

  function select(): void {
    if (disabled) return;
    group.select(value);
    if (closeOnSelect) menu.closeMenu(true);
  }

  const registration: MenuItemRegistration = {
    element: () => element,
    textValue: () => textValue ?? element?.textContent?.trim() ?? "",
  };

  $effect(() => menu.registerItem(registration));
</script>

<button
  bind:this={element}
  class={["kit-menu__item", "kit-menu__radio-item", "kit-control-states", className]}
  type="button"
  role="menuitemradio"
  tabindex="-1"
  aria-checked={checked}
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
  <span class="kit-menu__indicator" aria-hidden="true">
    {#if checked}<CheckIcon size="12" strokeWidth="2.2" />{/if}
  </span>
  <span class="kit-menu__radio-content">{@render children()}</span>
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

  .kit-menu__indicator {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 12px;
    color: var(--accent-blue);
    flex-shrink: 0;
  }

  .kit-menu__radio-content {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
  }
</style>
