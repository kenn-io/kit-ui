<script lang="ts">
  import { flushSync, getContext, tick, type Snippet } from "svelte";
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
  let maxHeight = $state<string>();
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
          escapeFocus: menu.focusReturnElement,
        }),
        autoReposition(() => [menu.triggerElement(), element], positionContent),
      ];
      // A point-anchored menu belongs to what was under the pointer; once the
      // page scrolls that target moves away, so close as native menus do.
      if (menu.anchor) cleanups.push(dismissOnOutsideScroll());
    });
    return () => {
      active = false;
      cleanups.forEach((cleanup) => cleanup());
    };
  });

  function dismissOnOutsideScroll(): () => void {
    function handleScroll(event: Event): void {
      if (event.target instanceof Node && element?.contains(event.target)) return;
      menu.closeMenu(false);
    }
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }

  function positionContent(): void {
    if (!element) return;
    // Fixed offsets and offsetWidth/Height use the menu's unzoomed CSS units.
    // Engines without currentCSSZoom (WebKit's Linux ports) get the
    // pre-zoom-aware maths; dividing by undefined would NaN the whole style.
    const zoom = element.currentCSSZoom ?? 1;
    // CSS zoom scales vh too, so 80vh can overflow a zoomed-in window. Cap
    // in unzoomed units and apply it before measuring the menu's height.
    const limit = `${Math.floor((window.innerHeight / zoom) * 0.8)}px`;
    if (maxHeight !== limit) {
      maxHeight = limit;
      flushSync();
    }
    const anchor = menu.anchor;
    if (anchor) {
      const point = {
        left: anchor.x / zoom,
        right: anchor.x / zoom,
        top: anchor.y / zoom,
        bottom: anchor.y / zoom,
      };
      position = floatingPopoverStyle({
        trigger: point,
        viewportWidth: window.innerWidth / zoom,
        viewportHeight: window.innerHeight / zoom,
        popoverWidth: element.offsetWidth,
        popoverHeight: element.offsetHeight,
        triggerGap: 0,
      });
      return;
    }
    const trigger = menu.triggerElement();
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const triggerRect = new DOMRect(
      rect.x / zoom,
      rect.y / zoom,
      rect.width / zoom,
      rect.height / zoom,
    );
    const width = Math.max(element.offsetWidth, triggerRect.width);
    position = `${floatingPopoverStyle({
      trigger: triggerRect,
      viewportWidth: window.innerWidth / zoom,
      viewportHeight: window.innerHeight / zoom,
      popoverWidth: width,
      popoverHeight: element.offsetHeight,
      align: menu.align,
      triggerGap: 2,
    })}; min-width: ${Math.round(triggerRect.width)}px`;
  }

  function leaveMenu(event: KeyboardEvent): void {
    const trigger =
      menu.focusReturnElement() ??
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
    style:--kit-menu-max-height={maxHeight}
    role="menu"
    tabindex="-1"
    aria-label={ariaLabel}
    onkeydown={handleKeydown}
    oncontextmenu={menu.anchor ? (event) => event.preventDefault() : undefined}
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
    /* A variable, not an inline max-height, so an app's class rule still wins. */
    max-height: var(--kit-menu-max-height, 80vh);
    overflow-y: auto;
    padding: var(--space-2);
  }
</style>
