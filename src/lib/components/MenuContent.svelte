<script lang="ts">
  import { getContext, tick, type Snippet } from "svelte";
  import { autoReposition, dismissable } from "../utils/popover.js";
  import { floatingPopoverStyle } from "./floatingPosition.js";
  import { menuContextKey, type MenuContext } from "./menu.js";

  interface Props {
    ariaLabel: string;
    class?: string;
    children: Snippet;
  }

  let { ariaLabel, class: className = "", children }: Props = $props();

  const menu = getContext<MenuContext>(menuContextKey);
  let element = $state<HTMLDivElement>();
  let position = $state("");
  let typeahead = "";
  let typeaheadTimer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    menu.setContentElement(element);
    return () => menu.setContentElement(undefined);
  });

  $effect(() => {
    if (!menu.open) {
      typeahead = "";
      if (typeaheadTimer !== undefined) clearTimeout(typeaheadTimer);
      return;
    }
    let active = true;
    let cleanups: (() => void)[] = [];
    void tick().then(() => {
      if (!active) return;
      positionContent();
      menu.focusInitialItem();
      cleanups = [
        dismissable({
          owners: () => [menu.triggerElement(), element],
          dismiss: () => menu.closeMenu(false),
          escapeFocus: menu.triggerElement,
        }),
        autoReposition(() => [menu.triggerElement(), element], positionContent),
      ];
    });
    return () => {
      active = false;
      cleanups.forEach((cleanup) => cleanup());
    };
  });

  function positionContent(): void {
    const trigger = menu.triggerElement();
    if (!trigger || !element) return;
    const triggerRect = trigger.getBoundingClientRect();
    const width = Math.max(element.offsetWidth, triggerRect.width);
    position = `${floatingPopoverStyle({
      trigger: triggerRect,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      popoverWidth: width,
      popoverHeight: element.offsetHeight,
      align: menu.align,
      triggerGap: 2,
    })}; min-width: ${Math.round(triggerRect.width)}px`;
  }

  function leaveMenu(event: KeyboardEvent): void {
    const trigger =
      menu.triggerElement() ??
      document.querySelector<HTMLElement>(`[aria-controls="${menu.id}-content"]`);
    const focusable = Array.from(
      document.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter(
      (candidate) =>
        candidate.tabIndex >= 0 &&
        candidate.getClientRects().length > 0 &&
        getComputedStyle(candidate).visibility !== "hidden",
    );
    const triggerIndex = trigger ? focusable.indexOf(trigger) : -1;
    const target = focusable[triggerIndex + (event.shiftKey ? -1 : 1)];
    menu.closeMenu(false);
    if (target) {
      event.preventDefault();
      void tick().then(() => target.focus());
    }
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      menu.focusRelativeItem(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      menu.focusEdgeItem(event.key === "Home" ? "first" : "last");
    } else if (event.key === "Tab") {
      leaveMenu(event);
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      if (event.key === " " && typeahead === "") return;
      event.preventDefault();
      const key = event.key.toLocaleLowerCase();
      const repeatedKey =
        typeahead.length > 0 && [...typeahead].every((character) => character === key);
      typeahead = repeatedKey ? key : typeahead + key;
      menu.focusItemByPrefix(typeahead);
      if (typeaheadTimer !== undefined) clearTimeout(typeaheadTimer);
      typeaheadTimer = setTimeout(() => (typeahead = ""), 500);
    }
  }
</script>

{#if menu.open}
  <div
    bind:this={element}
    id={`${menu.id}-content`}
    class={["kit-menu__content", "kit-popover-card", className]}
    style={position}
    role="menu"
    tabindex="-1"
    aria-label={ariaLabel}
    onkeydown={handleKeydown}
  >
    {@render children()}
  </div>
{/if}

<style>
  .kit-menu__content {
    position: fixed;
    z-index: var(--z-popover);
    width: max-content;
    max-width: min(320px, calc(100vw - 16px));
    max-height: min(360px, calc(100vh - 16px));
    overflow-y: auto;
    padding: var(--space-2);
  }
</style>
