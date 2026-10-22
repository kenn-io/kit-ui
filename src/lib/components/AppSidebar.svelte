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
  import { tick } from "svelte";
  import { innerHeight } from "svelte/reactivity/window";
  import { BREAKPOINTS, MEDIA } from "../breakpoints.js";
  import { trapFocus } from "../utils/focus-trap.js";
  import { backdropCloses } from "../utils/overlay.js";
  import {
    formatShortcutKeys,
    isMacPlatform,
    parseShortcut,
    shortcutMatches,
  } from "../utils/shortcuts.js";
  import IconButton from "./IconButton.svelte";
  import SplitResizeHandle from "./SplitResizeHandle.svelte";
  import type { SplitResizeEvent } from "./split-resize.js";

  interface Props {
    groups: SidebarGroup[];
    location: SidebarLocation;
    /** The page address without its fragment. A change closes any open flyout. */
    page: string;
    /**
     * localStorage key that remembers whether someone collapsed the sidebar to
     * the rail or expanded it. The choice applies at every width above the
     * narrow drawer. Until someone chooses, the sidebar's width decides: the rail
     * below 1440px, except on touch screens, where views must stay reachable
     * without hover, and the full sidebar from 1440px.
     */
    storageKey: string;
    /**
     * A saved collapse choice from the host, for a host whose localStorage
     * does not last, such as a throwaway browser session. It wins over
     * `storageKey`. `null` or absent means the host has none.
     */
    collapsed?: boolean | null;
    /** Called with the new state when someone collapses or expands the sidebar. */
    oncollapsedchange?: (collapsed: boolean) => void;
    /**
     * A saved width in pixels from the host, for a host whose localStorage
     * does not last. It wins over the width stored under `storageKey`.
     * `null` or absent means the host has none.
     */
    width?: number | null;
    /** Called with the new width in pixels when someone finishes resizing the sidebar. */
    onwidthchange?: (width: number) => void;
    /**
     * Brand area at the top of the panel. `rail` is true in the icon-only
     * rail; `drawer` is true inside the narrow drawer.
     */
    brand: Snippet<[{ rail: boolean; drawer: boolean }]>;
    /** Everything after the menu button in the narrow top bar. */
    narrowBar: Snippet;
    /**
     * Footer content. `rail` is true in the rail; `drawer` is true inside the
     * narrow drawer. The component adds its own collapse button outside the
     * drawer. Optional: without it, the footer region holds only that button.
     */
    footer?: Snippet<[{ rail: boolean; drawer: boolean }]>;
    /** Accessible name of the navigation landmark. Default "Main navigation". */
    label?: string;
    /** Accessible name of the narrow bar's menu button. Default "Open navigation". */
    menuLabel?: string;
    /** Accessible name of the narrow drawer dialog. Default "Navigation". */
    drawerLabel?: string;
    /** Accessible name of the collapse button while collapsed. Default "Expand sidebar". */
    expandLabel?: string;
    /** Accessible name of the collapse button while expanded. Default "Collapse sidebar". */
    collapseLabel?: string;
    /** Accessible name of the sidebar's resizable edge. Default "Resize sidebar". */
    resizeLabel?: string;
    /** What the resizable edge reads as its value in the rail. Default "Collapsed". */
    collapsedValueText?: string;
  }

  let {
    groups,
    location,
    page,
    storageKey,
    collapsed: hostChoice = null,
    oncollapsedchange,
    width: hostWidth = null,
    onwidthchange,
    brand,
    narrowBar,
    footer,
    label = "Main navigation",
    menuLabel = "Open navigation",
    drawerLabel = "Navigation",
    expandLabel = "Expand sidebar",
    collapseLabel = "Collapse sidebar",
    resizeLabel = "Resize sidebar",
    collapsedValueText = "Collapsed",
  }: Props = $props();

  type SizedIcon = Component<{ size?: number; "aria-hidden"?: "true" }>;

  // The public type is a plain Component; lucide icons take a size.
  function iconOf(section: SidebarSection): SizedIcon {
    return section.icon;
  }

  // kit-ui's CSS breakpoints stop at 900px, so the 1440px edge lives only
  // here, in script. Range syntax starts the rail exactly where MEDIA.wide
  // ends, so no fractional width (at some zoom levels) falls between them.
  const RAIL_BELOW = 1440;
  const RAIL_WIDTHS = `(${BREAKPOINTS.wide}px < width < ${RAIL_BELOW}px)`;
  const FLYOUT_MARGIN = 8;
  const TOGGLE_SHORTCUT = parseShortcut("mod+b");
  const isMac = isMacPlatform();
  const toggleKeys = formatShortcutKeys("mod+b", isMac).join(isMac ? "" : "+");
  const toggleAriaKeys = isMac ? "Meta+B" : "Control+B";
  // Widths in rem, so they grow with the browser's font size as the text
  // does. The rail and the default width match the CSS.
  const RAIL_REM = 3.5;
  const DEFAULT_REM = 15;
  const MAX_REM = 24;

  const uid = $props.id();
  const narrowWindow = new MediaQuery(MEDIA.wide);
  const railWindow = new MediaQuery(RAIL_WIDTHS);
  const touch = new MediaQuery(MEDIA.touch);

  function readChoice(key: string): boolean | null {
    try {
      const stored = localStorage.getItem(key);
      return stored === null ? null : stored !== "expanded";
    } catch {
      // Storage blocked or absent: the width decides.
      return null;
    }
  }

  function rootFontSize(): number {
    if (typeof document === "undefined") return 16;
    return Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  }

  // The root font size in pixels, read again when the root's classes,
  // style, or theme change.
  let rem = $state(rootFontSize());
  const collapsedWidth = $derived(Math.round(RAIL_REM * rem));
  const defaultWidth = $derived(Math.round(DEFAULT_REM * rem));
  const maxWidth = $derived(Math.round(MAX_REM * rem));

  function fit(width: number): number {
    return Math.min(maxWidth, Math.max(collapsedWidth, Math.round(width)));
  }

  function readWidth(key: string): number | null {
    try {
      const stored = Number(localStorage.getItem(`${key}-width`) ?? Number.NaN);
      return Number.isFinite(stored) ? stored : null;
    } catch {
      // Storage blocked or absent: the default width stands.
      return null;
    }
  }

  // The width of the element that holds the sidebar picks its layout, so a
  // host that shares the window, such as a page beside a chat panel, gets the
  // layout its own width calls for. The window width stands in until the
  // first measurement, which arrives before the first paint.
  let holderWidth = $state<number | null>(null);
  let inline = $state<HTMLElement | null>(null);
  const narrow = $derived(
    holderWidth === null ? narrowWindow.current : holderWidth <= BREAKPOINTS.wide,
  );
  const railWidth = $derived(
    holderWidth === null
      ? railWindow.current
      : holderWidth > BREAKPOINTS.wide && holderWidth < RAIL_BELOW,
  );

  // Someone's choice to collapse (true) or expand (false); null until they
  // make one, so the width decides.
  let collapsedChoice = $derived(hostChoice ?? readChoice(storageKey));
  const collapsed = $derived(collapsedChoice ?? (railWidth && !touch.current));
  // The edge's position while someone drags it; null between drags. The
  // narrow layout removes the edge mid-drag without ending the drag, so it
  // drops the position too.
  let dragWidth = $derived.by((): number | null => {
    void narrow;
    return null;
  });
  const rail = $derived(!narrow && collapsed);

  // The narrowest full sidebar in which its longest word fits; null until
  // the full sidebar has been laid out.
  let fitWidth = $state<number | null>(null);
  // Someone's chosen width; null until they resize. It stays as chosen and
  // is fitted to the limits on use, since the limits move with the font size.
  let widthChoice = $derived(hostWidth ?? readWidth(storageKey));
  // The full sidebar's width, never narrower than its longest word; null
  // while CSS's 15rem is enough.
  const fullWidth = $derived.by(() => {
    const width = Math.max(widthChoice === null ? defaultWidth : fit(widthChoice), fitWidth ?? 0);
    return widthChoice === null && width === defaultWidth ? null : width;
  });

  async function chooseCollapsed(choice: boolean): Promise<void> {
    // A current view's link leaves the panel when it collapses, so focus on
    // it would fall to the page; send it to the section link instead. The
    // edge is disabled in the rail, so focus on it goes to the expand button.
    const active = document.activeElement;
    const next = active?.closest(".kit-app-sidebar__views")
      ? active
          .closest("li:has(> .kit-app-sidebar__section)")
          ?.querySelector<HTMLElement>(".kit-app-sidebar__section")
      : choice && active?.matches(".kit-app-sidebar > .kit-split-resize-handle")
        ? active.parentElement?.querySelector<HTMLElement>(".kit-app-sidebar__pin")
        : null;
    collapsedChoice = choice;
    try {
      localStorage.setItem(storageKey, choice ? "collapsed" : "expanded");
    } catch {
      // Storage blocked: the choice lasts until the page reloads.
    }
    oncollapsedchange?.(choice);
    if (next) {
      await tick();
      if (!active?.isConnected || active.matches(":disabled")) next.focus();
    }
  }

  function toggleCollapsed(): Promise<void> {
    return chooseCollapsed(!collapsed);
  }

  function chooseWidth(width: number): void {
    widthChoice = width;
    try {
      localStorage.setItem(`${storageKey}-width`, String(width));
    } catch {
      // Storage blocked: the width lasts until the page reloads.
    }
    onwidthchange?.(width);
  }

  // Labels wrap between words, so the panel's min-content width is the
  // width its longest word needs; the sidebar adds the edge and a scrollbar
  // around the panel. A classic scrollbar can appear at any time, when the
  // sidebar narrows and its labels wrap or when the window gets shorter, so
  // the measurement leaves room for one whether or not it shows now.
  function measureFit(): number | null {
    const scroller = panel?.parentElement;
    if (!panel || !scroller || !inline) return null;
    const { overflowY } = scroller.style;
    const { width } = panel.style;
    scroller.style.overflowY = "scroll";
    const around = inline.getBoundingClientRect().width - panel.getBoundingClientRect().width;
    panel.style.width = "min-content";
    const content = panel.getBoundingClientRect().width;
    panel.style.width = width;
    scroller.style.overflowY = overflowY;
    return Math.min(maxWidth, Math.ceil(content + around));
  }

  // Bumped whenever the root's typography may have changed: a theme, class,
  // or style change on <html>, or a web font that finished loading.
  let typeset = $state(0);
  $effect(() => {
    const changed = () => {
      rem = rootFontSize();
      typeset += 1;
    };
    const observer = new MutationObserver(changed);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style", "data-kit-theme"],
    });
    document.fonts?.addEventListener("loadingdone", changed);
    return () => {
      observer.disconnect();
      document.fonts?.removeEventListener("loadingdone", changed);
    };
  });

  // Measure again whenever the panel's text or the root's typography
  // changes, such as a name that arrives after sign-in or a theme with a
  // wider font, or once the web fonts have loaded.
  $effect(() => {
    void typeset;
    if (rail || !panel) return;
    fitWidth = measureFit();
    const remeasure = () => (fitWidth = measureFit());
    const observer = new MutationObserver(remeasure);
    observer.observe(panel, { childList: true, subtree: true, characterData: true });
    let live = true;
    void document.fonts?.ready.then(() => {
      if (live) remeasure();
    });
    return () => {
      live = false;
      observer.disconnect();
    };
  });

  // The width the sidebar had when a resize started, and the narrowest width
  // in which every word still fits. The edge is disabled in the rail, so a
  // resize always starts from the full sidebar.
  let startWidth = 0;
  let minWidth = 0;

  function resizeStarted(): void {
    startWidth = Math.round(inline?.getBoundingClientRect().width ?? defaultWidth);
    fitWidth = measureFit();
    minWidth = fitWidth ?? defaultWidth;
  }

  // The edge follows the pointer, and stops at the narrowest width that
  // shows all the text and at maxWidth.
  function resizedTo(event: SplitResizeEvent): number {
    return Math.max(minWidth, fit(startWidth + event.delta));
  }

  function resized(event: SplitResizeEvent): void {
    dragWidth = resizedTo(event);
  }

  function resizeEnded(event: SplitResizeEvent): void {
    const width = resizedTo(event);
    dragWidth = null;
    if (width !== startWidth) chooseWidth(width);
  }

  function isEditable(target: EventTarget | null): boolean {
    return (
      target instanceof HTMLElement &&
      (target.isContentEditable || target.matches("input, textarea, select"))
    );
  }

  function keyPressed(event: KeyboardEvent): void {
    if (narrow || event.defaultPrevented || event.repeat) return;
    if (!shortcutMatches(TOGGLE_SHORTCUT, event, isMac) || isEditable(event.target)) return;
    event.preventDefault();
    void toggleCollapsed();
  }

  let drawer = $state<HTMLDialogElement | null>(null);
  let bar = $state<HTMLElement | null>(null);
  $effect(() => {
    const holder = (bar ?? inline)?.parentElement;
    if (!holder) return;
    const observer = new ResizeObserver(([entry]) => {
      holderWidth = entry?.borderBoxSize[0]?.inlineSize ?? null;
    });
    observer.observe(holder);
    return () => observer.disconnect();
  });
  let drawerOpen = $derived.by(() => {
    void narrow; // a width change unmounts or remounts the dialog
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
    void rail; // expanding or leaving the rail closes it
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
    <div class="kit-app-sidebar__brand">{@render brand({ rail, drawer: inDrawer })}</div>
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
    {#if footer || !inDrawer}
      <div class="kit-app-sidebar__footer">
        {@render footer?.({ rail, drawer: inDrawer })}
        {#if !inDrawer}
          {@const toggleLabel = rail ? expandLabel : collapseLabel}
          <IconButton
            class="kit-app-sidebar__pin"
            ariaLabel={toggleLabel}
            title="{toggleLabel} ({toggleKeys})"
            ariaKeyshortcuts={toggleAriaKeys}
            onclick={() => void toggleCollapsed()}
          >
            {#if rail}
              <PanelLeftOpen size={16} aria-hidden="true" />
            {:else}
              <PanelLeftClose size={16} aria-hidden="true" />
            {/if}
          </IconButton>
        {/if}
      </div>
    {/if}
  </nav>
{/snippet}

<svelte:window onkeydown={keyPressed} />

{#if narrow}
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
  <div
    class={["kit-app-sidebar", rail && "kit-app-sidebar--rail"]}
    style:width={dragWidth !== null
      ? `${dragWidth}px`
      : rail || fullWidth === null
        ? undefined
        : `${fullWidth}px`}
    bind:this={inline}
  >
    <div class="kit-app-sidebar__scroll">{@render panelContent(false)}</div>
    <SplitResizeHandle
      ariaLabel={resizeLabel}
      ariaValueMin={rail ? collapsedWidth : (fitWidth ?? collapsedWidth)}
      ariaValueMax={maxWidth}
      ariaValueNow={rail ? collapsedWidth : (dragWidth ?? fullWidth ?? defaultWidth)}
      ariaValueText={rail ? collapsedValueText : undefined}
      disabled={rail}
      onActivate={() => void toggleCollapsed()}
      onResizeStart={resizeStarted}
      onResize={resized}
      onResizeEnd={resizeEnded}
    />
  </div>
{/if}

<style>
  /* One below --z-overlay: in-place overlays such as Modal cover the sidebar
   * wherever they sit in the document, and flyouts still cover the page. */
  /* The resize handle is the sidebar's right edge, so the sidebar draws no
   * border there. No transition: the width follows the pointer. */
  .kit-app-sidebar {
    position: sticky;
    top: 0;
    z-index: calc(var(--z-overlay) - 1);
    box-sizing: border-box;
    display: flex;
    flex: none;
    width: 15rem;
    height: var(--kit-app-sidebar-height, 100dvh);
    background: var(--bg-surface);
    box-shadow: var(--shadow-raised, none);
  }

  .kit-app-sidebar__scroll {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    overflow-y: auto;
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

  /* The first end group takes the free height above it, including when it
   * is the only group. */
  .kit-app-sidebar__group--end:first-child,
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

  /* Indent the views to the section icon's edge, so the current view's
   * indicator sits inside the section row above it. */
  .kit-app-sidebar__views {
    margin: var(--space-1) 0 var(--space-2) var(--space-5);
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

  /* Views and run headings line up with the section label, past the icon.
   * The views list's indent supplies the views' first --space-5. */
  .kit-app-sidebar__run-heading {
    padding-left: calc(var(--space-5) + 16px + var(--space-4));
  }

  .kit-app-sidebar__view {
    min-height: 2rem;
    padding-left: calc(16px + var(--space-4));
  }

  /* Square the leading corners so the indicator draws as a straight bar
   * rather than following the row's rounding. */
  .kit-app-sidebar__view[aria-current="page"] {
    border-start-start-radius: 0;
    border-end-start-radius: 0;
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
