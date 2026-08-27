<script lang="ts">
  import { getContext, type Snippet } from "svelte";
  import type { Attachment } from "svelte/attachments";
  import type { ClassValue } from "svelte/elements";
  import { menuContextKey, type MenuContext } from "./menu.js";

  interface ChildProps {
    attachment: Attachment<HTMLButtonElement>;
  }

  interface Props {
    ariaLabel?: string;
    title?: string;
    disabled?: boolean;
    class?: ClassValue;
    children?: Snippet;
    child?: Snippet<[ChildProps]>;
  }

  let {
    ariaLabel,
    title,
    disabled = false,
    class: className = "",
    children,
    child,
  }: Props = $props();

  const menu = getContext<MenuContext>(menuContextKey);
  let element = $state<HTMLButtonElement>();

  $effect(() => {
    if (child) return;
    menu.setTriggerElement(element);
    return () => menu.setTriggerElement(undefined);
  });

  function toggle(): void {
    if (disabled) return;
    if (menu.open) menu.closeMenu(false);
    else menu.openMenu("first");
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (disabled) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      menu.openMenu("first");
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      menu.openMenu("last");
    }
  }

  const attachment: Attachment<HTMLButtonElement> = (node) => {
    const attributes = [
      "type",
      "aria-label",
      "aria-haspopup",
      "aria-expanded",
      "aria-controls",
      "title",
    ];
    const previousAttributes = new Map(
      attributes.map((name) => [name, node.getAttribute(name)] as const),
    );
    const wasDisabled = node.disabled;
    const hadControlStates = node.classList.contains("kit-control-states");

    node.classList.add("kit-control-states");
    menu.setTriggerElement(node);
    node.addEventListener("click", toggle);
    node.addEventListener("keydown", handleKeydown);

    $effect(() => {
      node.type = "button";
      node.setAttribute("aria-haspopup", "menu");
      node.setAttribute("aria-expanded", String(menu.open));
      node.setAttribute("aria-controls", `${menu.id}-content`);
      node.disabled = disabled;

      if (ariaLabel) node.setAttribute("aria-label", ariaLabel);
      else if (previousAttributes.get("aria-label") === null) node.removeAttribute("aria-label");

      if (title) node.title = title;
      else if (previousAttributes.get("title") === null) node.removeAttribute("title");
    });

    return () => {
      node.removeEventListener("click", toggle);
      node.removeEventListener("keydown", handleKeydown);
      menu.setTriggerElement(undefined);
      node.disabled = wasDisabled;
      if (!hadControlStates) node.classList.remove("kit-control-states");
      for (const [name, value] of previousAttributes) {
        if (value === null) node.removeAttribute(name);
        else node.setAttribute(name, value);
      }
    };
  };
</script>

{#if child}
  {@render child({ attachment })}
{:else}
  <button
    bind:this={element}
    class={["kit-menu__trigger", "kit-control-states", className]}
    type="button"
    aria-label={ariaLabel}
    aria-haspopup="menu"
    aria-expanded={menu.open}
    aria-controls={`${menu.id}-content`}
    {title}
    {disabled}
    onclick={toggle}
    onkeydown={handleKeydown}
  >
    {@render children?.()}
  </button>
{/if}

<style>
  .kit-menu__trigger {
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    min-height: var(--kit-control-height, 28px);
    padding: 5px 8px;
    border: var(--border-width) solid var(--border-default);
    border-radius: var(--kit-control-radius, var(--radius-sm));
    background: var(--bg-inset);
    color: var(--text-secondary);
    font: inherit;
    font-size: var(--kit-control-font-size, var(--font-size-sm));
    cursor: pointer;
    transition:
      background var(--transition-fast) var(--transition-ease, ease),
      border-color var(--transition-fast) var(--transition-ease, ease),
      color var(--transition-fast) var(--transition-ease, ease),
      transform var(--transition-fast) var(--transition-ease, ease),
      opacity var(--transition-fast) var(--transition-ease, ease);
  }

  .kit-menu__trigger:hover:not(:disabled),
  .kit-menu__trigger[aria-expanded="true"] {
    border-color: var(--accent-blue);
    color: var(--text-primary);
  }
</style>
