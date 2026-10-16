<script module lang="ts">
  import type { Component, Snippet } from "svelte";

  export interface SidebarView {
    id: string;
    label: string;
    href: string;
  }

  /** A run of views under an optional heading. `heading: null` renders no heading. */
  export interface SidebarViewRun {
    heading: string | null;
    views: SidebarView[];
  }

  export interface SidebarSection {
    id: string;
    label: string;
    href: string;
    /** An icon component, such as one from @lucide/svelte. Rendered at size 16. */
    icon: Component;
    /** Empty when the section has no views. */
    viewRuns: SidebarViewRun[];
  }

  export interface SidebarGroup {
    label: string | null;
    sections: SidebarSection[];
    /**
     * Places the group at the bottom of the panel, above the footer, apart
     * from the groups before it. List end groups last.
     */
    end?: boolean;
  }

  export interface SidebarLocation {
    section: string | null;
    view: string | null;
  }
</script>

<script lang="ts">
  import Menu from "@lucide/svelte/icons/menu";
  import PanelLeftClose from "@lucide/svelte/icons/panel-left-close";
  import PanelLeftOpen from "@lucide/svelte/icons/panel-left-open";
  import { MediaQuery } from "svelte/reactivity";
  import { innerHeight } from "svelte/reactivity/window";
  import { BREAKPOINTS, MEDIA } from "../breakpoints.js";
  import { trapFocus } from "../utils/focus-trap.js";
  import { backdropCloses } from "../utils/overlay.js";
  import IconButton from "./IconButton.svelte";

  interface Props {
    groups: SidebarGroup[];
    location: SidebarLocation;
    /** The page address without its fragment. A change closes any open flyout. */
    page: string;
    /**
     * localStorage key that remembers whether the sidebar is pinned open at
     * rail widths. Until someone chooses, touch screens start pinned open, so
     * views stay reachable without hover, and other devices start as the rail.
     */
    storageKey: string;
    /** Brand area at the top of the panel. `rail` is true in the icon-only rail. */
    brand: Snippet<[{ rail: boolean }]>;
    /** Everything after the menu button in the narrow top bar. */
    narrowBar: Snippet;
    /**
     * Footer content. `rail` is true in the rail; `drawer` is true inside the
     * narrow drawer. The component adds its own pin button at rail widths.
     * Optional: without it, the footer region renders only at rail widths, to
     * hold the pin button.
     */
    footer?: Snippet<[{ rail: boolean; drawer: boolean }]>;
    /** Accessible name of the navigation landmark. Default "Main navigation". */
    label?: string;
    /** Accessible name of the narrow bar's menu button. Default "Open navigation". */
    menuLabel?: string;
    /** Accessible name of the narrow drawer dialog. Default "Navigation". */
    drawerLabel?: string;
    /** Accessible name of the rail's pin button while collapsed. Default "Expand sidebar". */
    expandLabel?: string;
    /** Accessible name of the rail's pin button while pinned open. Default "Collapse sidebar". */
    collapseLabel?: string;
  }

  let {
    groups,
    location,
    page,
    storageKey,
    brand,
    narrowBar,
    footer,
    label = "Main navigation",
    menuLabel = "Open navigation",
    drawerLabel = "Navigation",
    expandLabel = "Expand sidebar",
    collapseLabel = "Collapse sidebar",
  }: Props = $props();

  type SizedIcon = Component<{ size?: number; "aria-hidden"?: "true" }>;

  // The public type is a plain Component; lucide icons take a size.
  function iconOf(section: SidebarSection): SizedIcon {
    return section.icon;
  }

  // kit-ui's CSS breakpoints stop at 900px, so the 1440px edge lives only
  // here, in script. Range syntax starts the rail exactly where MEDIA.wide
  // ends, so no fractional width (at some zoom levels) falls between them.
  const RAIL_WIDTHS = `(${BREAKPOINTS.wide}px < width < 1440px)`;
  const FLYOUT_MARGIN = 8;

  const uid = $props.id();
  const narrow = new MediaQuery(MEDIA.wide);
  const railWidths = new MediaQuery(RAIL_WIDTHS);
  const touch = new MediaQuery(MEDIA.touch);

  function readPinned(key: string, fallback: boolean): boolean {
    try {
      const stored = localStorage.getItem(key);
      return stored === null ? fallback : stored === "expanded";
    } catch {
      // Storage blocked or absent: use the device's default.
      return fallback;
    }
  }

  let pinned = $derived(readPinned(storageKey, touch.current));
  const rail = $derived(railWidths.current && !pinned);

  function togglePinned(): void {
    pinned = !pinned;
    try {
      localStorage.setItem(storageKey, pinned ? "expanded" : "collapsed");
    } catch {
      // Storage blocked: the choice lasts until the page reloads.
    }
  }

  let drawer = $state<HTMLDialogElement | null>(null);
  let bar = $state<HTMLElement | null>(null);
  let drawerOpen = $derived.by(() => {
    void narrow.current; // a width change unmounts or remounts the dialog
    return false;
  });

  function openDrawer(): void {
    drawerOpen = true;
    drawer?.showModal();
  }

  function drawerClosed(): void {
    drawerOpen = false;
    // A browser that never focused the menu button on click hands focus to
    // the body when the dialog closes; send it back to the button.
    const active = document.activeElement;
    if (active === null || active === document.body || drawer?.contains(active)) {
      bar?.querySelector<HTMLButtonElement>(".kit-app-sidebar__menu")?.focus();
    }
  }

  // Only a link closes the drawer here. A click on the dialog can end a drag
  // between the panel and the backdrop, so backdropCloses handles the backdrop.
  function drawerClicked(event: MouseEvent): void {
    const target = event.target;
    // A modified click opens a link elsewhere, such as in a new tab, so it
    // leaves the drawer open.
    const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
    const onLink = !modified && target instanceof Element && target.closest("a") !== null;
    if (onLink) drawer?.close();
  }

  let openSection = $derived.by((): string | null => {
    void page; // navigation closes the flyout
    void rail; // pinning or leaving the rail closes it
    return null;
  });
  let openItem: HTMLElement | null = null;
  let flyoutTop = $state(0);
  let flyoutLeft = $state(0);
  let flyoutHeight = $state(0);
  let panel = $state<HTMLElement | null>(null);

  const flyoutY = $derived(
    Math.max(
      FLYOUT_MARGIN,
      Math.min(
        flyoutTop,
        (innerHeight.current ?? Number.POSITIVE_INFINITY) - flyoutHeight - FLYOUT_MARGIN,
      ),
    ),
  );

  function sectionCurrent(section: SidebarSection): "page" | "true" | undefined {
    if (location.section !== section.id) return undefined;
    const viewCurrent = section.viewRuns.some((run) =>
      run.views.some((view) => view.id === location.view),
    );
    return viewCurrent ? "true" : "page";
  }

  function hasKeyboardFocus(item: HTMLElement): boolean {
    return item.querySelector(":focus-visible") !== null;
  }

  function place(item: HTMLElement): void {
    const box = item.getBoundingClientRect();
    flyoutTop = box.top;
    flyoutLeft = box.right;
  }

  function openFlyout(section: SidebarSection, item: HTMLElement): void {
    if (!rail || openSection === section.id) return;
    openItem = item;
    place(item);
    openSection = section.id;
  }

  // A pointer on its way to a flyout's lower views can leave its row, or
  // cross the next one, before it reaches the flyout. So leaving the open
  // section starts a grace period instead of closing it: coming back to the
  // section's row or flyout keeps it open, and a row the pointer still rests
  // on when the period ends opens instead.
  const HOVER_GRACE_MS = 250;
  let graceTimer: ReturnType<typeof setTimeout> | undefined;
  let nextRow: { section: SidebarSection; item: HTMLElement } | null = null;

  function endGrace(): void {
    clearTimeout(graceTimer);
    graceTimer = undefined;
    nextRow = null;
  }

  function graceEnded(): void {
    const next = nextRow;
    endGrace();
    if (openItem && hasKeyboardFocus(openItem)) return;
    closeFlyout();
    if (next) openFlyout(next.section, next.item);
  }

  function pointerEntered(section: SidebarSection, item: HTMLElement): void {
    if (graceTimer !== undefined) {
      if (openSection === section.id) endGrace();
      else nextRow = { section, item };
      return;
    }
    const held =
      openSection !== null &&
      openSection !== section.id &&
      openItem !== null &&
      hasKeyboardFocus(openItem);
    if (!held) openFlyout(section, item);
  }

  function closeFlyout(): void {
    openSection = null;
    openItem = null;
  }

  function pointerLeft(section: SidebarSection, item: HTMLElement): void {
    if (nextRow?.item === item) nextRow = null;
    if (openSection !== section.id || hasKeyboardFocus(item)) return;
    clearTimeout(graceTimer);
    graceTimer = setTimeout(graceEnded, HOVER_GRACE_MS);
  }

  function focusLeft(section: SidebarSection, item: HTMLElement, next: EventTarget | null): void {
    if (openSection !== section.id) return;
    if (next instanceof Node && item.contains(next)) return;
    closeFlyout();
  }

  $effect(() => {
    if (openSection === null) return;
    function scrolled(event: Event): void {
      const target = event.target;
      if (target === document) {
        // A page scroll moves the rail unless it is already stuck at the top.
        if (openItem) place(openItem);
      } else if (target instanceof Element && panel && target.contains(panel)) {
        if (openItem && hasKeyboardFocus(openItem)) place(openItem);
        else closeFlyout();
      }
    }
    function resized(): void {
      if (openItem) place(openItem);
    }
    // Escape closes the flyout wherever focus is, even one opened by hover.
    // With focus on the section or in its flyout, it claims the key as
    // dismissable() does, so enclosing layers stay open, and returns focus to
    // the section icon before the close, so its focusin finds the flyout still
    // open. A hover-only flyout leaves the key unclaimed, as Tooltip does, so
    // other layers close on the same press.
    function keyPressed(event: KeyboardEvent): void {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const item = openItem;
      if (item?.contains(document.activeElement)) {
        event.preventDefault();
        item.querySelector<HTMLElement>(".kit-app-sidebar__section")?.focus();
      }
      closeFlyout();
    }
    window.addEventListener("scroll", scrolled, { capture: true, passive: true });
    window.addEventListener("resize", resized);
    document.addEventListener("keydown", keyPressed);
    // Runs when the flyout closes or switches for any reason, and on unmount.
    return () => {
      endGrace();
      window.removeEventListener("scroll", scrolled, { capture: true });
      window.removeEventListener("resize", resized);
      document.removeEventListener("keydown", keyPressed);
    };
  });
</script>

{#snippet viewList(section: SidebarSection, current: boolean)}
  {#each section.viewRuns as run, index (index)}
    {@const headingId = `${uid}-${section.id}-${index}`}
    {#if run.heading !== null}
      <p class="kit-app-sidebar__run-heading" id={headingId}>{run.heading}</p>
    {/if}
    <ul
      class="kit-app-sidebar__views"
      aria-labelledby={run.heading !== null ? headingId : undefined}
    >
      {#each run.views as view (view.id)}
        <li>
          <a
            class="kit-app-sidebar__view"
            href={view.href}
            aria-current={current && location.view === view.id ? "page" : undefined}
          >
            {view.label}
          </a>
        </li>
      {/each}
    </ul>
  {/each}
{/snippet}

{#snippet panelContent(inDrawer: boolean)}
  <!-- One landmark holds the brand, the sections and the footer, so no content sits outside a landmark. -->
  <nav
    class={["kit-app-sidebar__panel", rail && "kit-app-sidebar__panel--rail"]}
    aria-label={label}
    bind:this={panel}
  >
    <div class="kit-app-sidebar__brand">{@render brand({ rail })}</div>
    <div class="kit-app-sidebar__nav">
      {#each groups as group, index (index)}
        <div class={["kit-app-sidebar__group", group.end && "kit-app-sidebar__group--end"]}>
          {#if group.label !== null && !rail}
            <span class="kit-app-sidebar__group-label" aria-hidden="true">{group.label}</span>
          {/if}
          <ul class="kit-app-sidebar__sections" aria-label={group.label ?? undefined}>
            {#each group.sections as section (section.id)}
              {@const current = location.section === section.id}
              {@const Icon = iconOf(section)}
              <li
                onpointerenter={(event) => pointerEntered(section, event.currentTarget)}
                onpointerleave={(event) => pointerLeft(section, event.currentTarget)}
                onfocusin={(event) => openFlyout(section, event.currentTarget)}
                onfocusout={(event) => focusLeft(section, event.currentTarget, event.relatedTarget)}
              >
                <a
                  class="kit-app-sidebar__section"
                  href={section.href}
                  aria-current={sectionCurrent(section)}
                >
                  <Icon size={16} aria-hidden="true" />
                  <span class={[rail && "kit-sr-only"]}>{section.label}</span>
                </a>
                {#if !rail && current}
                  {@render viewList(section, current)}
                {/if}
                {#if rail && openSection === section.id}
                  <!-- A flyout without views only repeats the link's name, so
                       assistive tech skips it. -->
                  {@const titleOnly = section.viewRuns.length === 0}
                  <div
                    class="kit-app-sidebar__flyout kit-popover-card"
                    role={titleOnly ? undefined : "group"}
                    aria-label={titleOnly ? undefined : section.label}
                    aria-hidden={titleOnly ? "true" : undefined}
                    style:top="{flyoutY}px"
                    style:left="{flyoutLeft}px"
                    bind:offsetHeight={flyoutHeight}
                  >
                    <span class="kit-app-sidebar__flyout-title" aria-hidden="true"
                      >{section.label}</span
                    >
                    {@render viewList(section, current)}
                  </div>
                {/if}
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    </div>
    {#if footer || (railWidths.current && !inDrawer)}
      <div class="kit-app-sidebar__footer">
        {@render footer?.({ rail, drawer: inDrawer })}
        {#if railWidths.current && !inDrawer}
          <IconButton
            class="kit-app-sidebar__pin"
            ariaLabel={pinned ? collapseLabel : expandLabel}
            onclick={togglePinned}
          >
            {#if pinned}
              <PanelLeftClose size={16} aria-hidden="true" />
            {:else}
              <PanelLeftOpen size={16} aria-hidden="true" />
            {/if}
          </IconButton>
        {/if}
      </div>
    {/if}
  </nav>
{/snippet}

{#if narrow.current}
  <header class="kit-app-sidebar__bar" bind:this={bar}>
    <IconButton
      class="kit-app-sidebar__menu"
      ariaLabel={menuLabel}
      ariaExpanded={drawerOpen}
      ariaHaspopup="dialog"
      onclick={openDrawer}
    >
      <Menu size={20} aria-hidden="true" />
    </IconButton>
    {@render narrowBar()}
  </header>
  <dialog
    bind:this={drawer}
    class="kit-app-sidebar__drawer"
    aria-label={drawerLabel}
    onclose={drawerClosed}
    onclick={drawerClicked}
    {@attach backdropCloses(() => drawer?.close())}
  >
    {#if drawerOpen}
      <div class="kit-app-sidebar__drawer-surface" tabindex="-1" {@attach trapFocus}>
        {@render panelContent(true)}
      </div>
    {/if}
  </dialog>
{:else}
  <div class={["kit-app-sidebar", rail && "kit-app-sidebar--rail"]}>
    {@render panelContent(false)}
  </div>
{/if}

<style>
  /* One below --z-overlay: in-place overlays such as Modal cover the sidebar
   * wherever they sit in the document, and flyouts still cover the page. */
  .kit-app-sidebar {
    position: sticky;
    top: 0;
    z-index: calc(var(--z-overlay) - 1);
    box-sizing: border-box;
    flex: none;
    width: 15rem;
    height: 100dvh;
    overflow-y: auto;
    border-right: 1px solid var(--border-default);
    background: var(--bg-surface);
    box-shadow: var(--shadow-raised, none);
  }

  .kit-app-sidebar--rail {
    width: 3.5rem;
  }

  .kit-app-sidebar__bar {
    position: sticky;
    top: 0;
    z-index: calc(var(--z-overlay) - 1);
    display: flex;
    align-items: center;
    gap: var(--space-4);
    min-height: var(--header-height);
    padding-inline: var(--space-5);
    border-bottom: 1px solid var(--border-default);
    background: var(--bg-surface);
  }

  .kit-app-sidebar__drawer {
    box-sizing: border-box;
    width: min(18rem, 85vw);
    max-width: none;
    height: 100dvh;
    max-height: none;
    margin: 0;
    padding: 0;
    border: 0;
    border-right: 1px solid var(--border-default);
    background: var(--bg-surface);
    color: var(--text-primary);
  }

  .kit-app-sidebar__drawer::backdrop {
    background: var(--overlay-bg);
  }

  .kit-app-sidebar__drawer-surface {
    display: flex;
    flex-direction: column;
    min-height: 100%;
  }

  .kit-app-sidebar__panel {
    box-sizing: border-box;
    display: flex;
    flex: 1 0 auto;
    flex-direction: column;
    gap: var(--space-5);
    min-height: 100%;
    padding: 0 var(--space-4) var(--space-5);
  }

  /* As tall as a TopBar and flush with the top, so a brand lines up with a
   * TopBar beside the sidebar. A taller brand grows the row. */
  .kit-app-sidebar__brand {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
    min-height: var(--header-height);
    padding-inline: var(--space-2);
  }

  /* The nav takes the panel's free height, so an end group can sit at its
   * bottom, just above the footer. */
  .kit-app-sidebar__nav {
    display: flex;
    flex: 1 0 auto;
    flex-direction: column;
    gap: var(--space-5);
  }

  .kit-app-sidebar__group:not(.kit-app-sidebar__group--end) + .kit-app-sidebar__group--end {
    margin-top: auto;
  }

  .kit-app-sidebar__group {
    display: grid;
  }

  .kit-app-sidebar__group-label,
  .kit-app-sidebar__run-heading {
    color: var(--text-muted);
    font-size: var(--font-size-2xs);
    font-weight: var(--font-weight-semibold, 600);
    letter-spacing: var(--letter-spacing-label, 0.04em);
    text-transform: var(--label-transform, uppercase);
  }

  .kit-app-sidebar__group-label {
    padding: 0 var(--space-3) var(--space-2);
  }

  .kit-app-sidebar__sections,
  .kit-app-sidebar__views {
    display: grid;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .kit-app-sidebar__views {
    margin: var(--space-1) 0 var(--space-2);
  }

  .kit-app-sidebar__section,
  .kit-app-sidebar__view {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: var(--space-4);
    min-height: 2.25rem;
    padding: var(--space-3) var(--space-5);
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    font-size: var(--font-size-md);
    font-weight: var(--font-weight-medium, 500);
    text-decoration: none;
  }

  .kit-app-sidebar__section:hover,
  .kit-app-sidebar__view:hover,
  .kit-app-sidebar__section[aria-current],
  .kit-app-sidebar__view[aria-current] {
    background: var(--bg-surface-hover);
    color: var(--text-primary);
  }

  .kit-app-sidebar__section[aria-current] :global(svg) {
    color: var(--kit-sidebar-current-icon, var(--kit-sidebar-accent, var(--accent-blue)));
  }

  /* Views and run headings line up with the section label, past the icon. */
  .kit-app-sidebar__view,
  .kit-app-sidebar__run-heading {
    padding-left: calc(var(--space-5) + 16px + var(--space-4));
  }

  .kit-app-sidebar__view {
    min-height: 2rem;
  }

  .kit-app-sidebar__view[aria-current="page"] {
    box-shadow: inset 2px 0 0 var(--kit-sidebar-accent, var(--accent-blue));
  }

  .kit-app-sidebar__run-heading {
    margin: var(--space-3) 0 var(--space-1);
  }

  .kit-app-sidebar__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    margin-top: auto;
    padding: var(--space-4) var(--space-2) 0;
    border-top: 1px solid var(--border-muted);
  }

  .kit-app-sidebar__panel--rail {
    padding-inline: 0;
  }

  .kit-app-sidebar__panel--rail .kit-app-sidebar__brand {
    justify-content: center;
    padding-inline: 0;
  }

  .kit-app-sidebar__panel--rail .kit-app-sidebar__section {
    justify-content: center;
    width: 2.25rem;
    margin-inline: auto;
    padding: 0;
  }

  .kit-app-sidebar__panel--rail .kit-app-sidebar__footer {
    flex-direction: column;
    padding-inline: 0;
  }

  /* The height leaves FLYOUT_MARGIN (8px) above and below. */
  .kit-app-sidebar__flyout {
    position: fixed;
    z-index: var(--z-popover);
    box-sizing: border-box;
    min-width: 12rem;
    max-height: calc(100dvh - 16px);
    overflow-y: auto;
    padding: var(--space-3);
  }

  .kit-app-sidebar__flyout-title {
    display: block;
    padding: var(--space-2) var(--space-3);
    color: var(--text-primary);
    font-size: var(--font-size-md);
    font-weight: var(--font-weight-semibold, 600);
  }

  .kit-app-sidebar__flyout .kit-app-sidebar__views {
    margin: var(--space-1) 0 0;
  }

  .kit-app-sidebar__flyout .kit-app-sidebar__view,
  .kit-app-sidebar__flyout .kit-app-sidebar__run-heading {
    padding-left: var(--space-3);
  }

  @media (hover: none), (pointer: coarse) {
    .kit-app-sidebar__section,
    .kit-app-sidebar__view {
      min-height: 44px;
    }

    .kit-app-sidebar__bar :global(.kit-app-sidebar__menu),
    .kit-app-sidebar__footer :global(.kit-app-sidebar__pin) {
      width: 44px;
      height: 44px;
    }
  }

  /* Forced colors drop the wash and the indicator, so the current rows take
   * the system's selection colors, and the current view redraws its
   * indicator in them. */
  @media (forced-colors: active) {
    .kit-app-sidebar__section[aria-current],
    .kit-app-sidebar__view[aria-current] {
      forced-color-adjust: none;
      background: SelectedItem;
      color: SelectedItemText;
    }

    .kit-app-sidebar__section[aria-current] :global(svg) {
      color: SelectedItemText;
    }

    .kit-app-sidebar__view[aria-current="page"] {
      box-shadow: inset 2px 0 0 SelectedItemText;
    }
  }
</style>
