<script lang="ts">
  import { setContext, type Snippet } from "svelte";
  import {
    menuContextKey,
    type MenuAlign,
    type MenuAnchorPoint,
    type MenuContext,
    type MenuInitialFocus,
    type MenuItemRegistration,
  } from "./menu.js";

  interface Props {
    open?: boolean;
    align?: MenuAlign;
    /** Opens the content at a viewport point instead of below a trigger (context menus). */
    anchor?: MenuAnchorPoint;
    /** Receives focus when a trigger-less menu closes, such as the right-clicked row. */
    returnFocus?: HTMLElement;
    onopenchange?: (open: boolean) => void;
    class?: string;
    children: Snippet;
  }

  let {
    open = $bindable(false),
    align = "start",
    anchor,
    returnFocus,
    onopenchange,
    class: className = "",
    children,
  }: Props = $props();

  const id = $props.id();
  let triggerElement = $state<HTMLButtonElement>();
  let contentElement = $state<HTMLElement>();
  let initialFocus = $state<MenuInitialFocus>("first");
  const items = new Set<MenuItemRegistration>();

  function setOpen(next: boolean): void {
    if (open === next) return;
    open = next;
    onopenchange?.(next);
  }

  function orderedItems(): MenuItemRegistration[] {
    return [...items]
      .filter((item) => item.element()?.isConnected)
      .sort((left, right) => {
        const leftElement = left.element();
        const rightElement = right.element();
        if (!leftElement || !rightElement) return 0;
        return leftElement.compareDocumentPosition(rightElement) & Node.DOCUMENT_POSITION_FOLLOWING
          ? -1
          : 1;
      });
  }

  function focusItem(item: MenuItemRegistration | undefined): void {
    item?.element()?.focus();
  }

  const context: MenuContext = {
    id,
    get open() {
      return open;
    },
    get align() {
      return align;
    },
    get anchor() {
      return anchor;
    },
    triggerElement: () => triggerElement,
    contentElement: () => contentElement,
    focusReturnElement: () => triggerElement ?? returnFocus,
    setTriggerElement: (element) => (triggerElement = element),
    setContentElement: (element) => (contentElement = element),
    openMenu(focus) {
      initialFocus = focus;
      setOpen(true);
    },
    closeMenu(restoreFocus) {
      // Synchronous, so an item whose onselect moves focus elsewhere (a
      // dialog, a field) keeps it.
      if (restoreFocus) context.focusReturnElement()?.focus();
      setOpen(false);
    },
    registerItem(item) {
      items.add(item);
      return () => items.delete(item);
    },
    focusInitialItem() {
      const ordered = orderedItems();
      focusItem(initialFocus === "last" ? ordered.at(-1) : ordered[0]);
    },
    focusRelativeItem(direction) {
      const ordered = orderedItems();
      if (ordered.length === 0) return;
      const current = ordered.findIndex((item) => item.element() === document.activeElement);
      const next = current < 0 ? (direction === 1 ? 0 : ordered.length - 1) : current + direction;
      focusItem(ordered[(next + ordered.length) % ordered.length]);
    },
    focusEdgeItem(edge) {
      const ordered = orderedItems();
      focusItem(edge === "last" ? ordered.at(-1) : ordered[0]);
    },
    focusItemByPrefix(prefix) {
      const ordered = orderedItems();
      if (ordered.length === 0) return;
      const current = ordered.findIndex((item) => item.element() === document.activeElement);
      for (let offset = 1; offset <= ordered.length; offset += 1) {
        const item = ordered[(Math.max(current, -1) + offset) % ordered.length];
        if (item?.textValue().trim().toLocaleLowerCase().startsWith(prefix.toLocaleLowerCase())) {
          focusItem(item);
          return;
        }
      }
    },
  };

  setContext(menuContextKey, context);
</script>

<div class={["kit-menu", className]}>
  {@render children()}
</div>

<style>
  .kit-menu {
    display: inline-block;
  }
</style>
