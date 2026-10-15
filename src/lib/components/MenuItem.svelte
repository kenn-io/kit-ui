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
    /** Decorative leading icon. The icon column shows when any item in the menu passes one. */
    icon?: Snippet | undefined;
    /** Right-aligned secondary text, such as a count or a shortcut hint. */
    trailing?: Snippet | undefined;
    /**
     * The shortcut the trailing hint shows, in `aria-keyshortcuts` form such as `F2` or
     * `Meta+1`. Assistive technology reads the shortcut from this attribute, so the
     * visual hint is left out of the item's name.
     */
    keyshortcuts?: string | undefined;
    children: Snippet;
  }

  let {
    onselect,
    disabled = false,
    closeOnSelect = true,
    tone = "neutral",
    textValue,
    class: className = "",
    icon,
    trailing,
    keyshortcuts,
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
  aria-keyshortcuts={keyshortcuts}
  onclick={(event) => {
    if (disabled) {
      event.preventDefault();
      return;
    }
    select();
  }}
  onpointermove={() => element?.focus({ preventScroll: true })}
>
  <span class="kit-menu__icon" data-filled={icon ? "" : undefined} aria-hidden="true">
    {@render icon?.()}
  </span>
  {@render children()}
  {#if trailing}
    <span class="kit-menu__trailing" aria-hidden={keyshortcuts ? "true" : undefined}>
      {@render trailing()}
    </span>
  {/if}
</button>

<style>
  .kit-menu__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--menu-icon-width, 16px);
    height: var(--menu-icon-width, 16px);
    flex: 0 0 var(--menu-icon-width, 16px);
  }

  :global(.kit-menu__content:not(:has(.kit-menu__icon[data-filled]))) .kit-menu__icon {
    display: none;
  }

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

  /* Moving the pointer over an item focuses it, so focus alone drives the
     fill. Filling on :hover too would leave two items lit when the pointer
     rests on one and the arrow keys move to another. */
  .kit-menu__item:focus:not([aria-disabled="true"]),
  .kit-menu__item:focus-visible {
    background: var(--bg-surface-hover);
    color: var(--text-primary);
  }

  /* The hover fill is too faint to mark keyboard focus alone, so keep the
     ring, inset, so the active item reads as one block between separators. */
  .kit-menu__item:focus-visible {
    outline-offset: -2px;
  }

  .kit-menu__trailing {
    margin-left: auto;
    padding-left: var(--space-7);
    color: var(--text-muted);
    font-size: var(--font-size-xs);
    font-variant-numeric: tabular-nums;
  }

  .kit-menu__item--danger {
    color: color-mix(in srgb, var(--accent-red) 72%, var(--text-primary));
  }
</style>
