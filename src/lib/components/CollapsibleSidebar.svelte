<script lang="ts">
  import type { Snippet } from "svelte";
  import SidebarToggle from "./SidebarToggle.svelte";
  import SplitResizeHandle from "./SplitResizeHandle.svelte";
  import type { SplitResizeEvent } from "./split-resize.js";

  interface Props {
    /** Main-area content. */
    children?: Snippet | undefined;
    sidebar: Snippet;
    /** Rendered after the main area (e.g. a right-hand rail). */
    trailing?: Snippet | undefined;
    isCollapsed?: boolean;
    hideSidebar?: boolean;
    sidebarWidth?: number;
    /** Sidebar fills the layout; no main area or resize handle. */
    sidebarOnly?: boolean;
    hasMain?: boolean;
    /** When collapsed, keep a thin strip with an expand toggle. */
    showCollapsedStrip?: boolean;
    mainEmpty?: boolean;
    mainOverflow?: "auto" | "hidden";
    minSidebarWidth?: number;
    maxSidebarWidth?: number;
    /** Below the `wide` breakpoint (900px), float the expanded sidebar over
     * the main area instead of squeezing it. */
    overlayOnNarrow?: boolean;
    /** Host-driven overlay: when set, floats (or doesn't float) the expanded
     * sidebar regardless of viewport width — for hosts whose narrow signal is
     * a measured container width rather than the viewport (embedded panes,
     * split-pane layouts). Leave unset to let `overlayOnNarrow`'s media query
     * drive. */
    overlay?: boolean | undefined;
    onSidebarResize?: ((width: number) => void) | undefined;
    onExpand?: (() => void) | undefined;
  }

  let {
    children = undefined,
    sidebar,
    trailing = undefined,
    isCollapsed = false,
    hideSidebar = false,
    sidebarWidth = 340,
    sidebarOnly = false,
    hasMain = true,
    showCollapsedStrip = false,
    mainEmpty = false,
    mainOverflow = "auto",
    minSidebarWidth = 200,
    maxSidebarWidth = 600,
    overlayOnNarrow = false,
    overlay = undefined,
    onSidebarResize = undefined,
    onExpand = undefined,
  }: Props = $props();

  // Overlaying only means something when a main area exists to float over;
  // with sidebarOnly / hasMain={false} the sidebar already fills the layout.
  const canOverlay = $derived(hasMain && !sidebarOnly);
  // Host-driven overlay (kit-sidebar-layout--overlay, any viewport width).
  const overlayForced = $derived(overlay === true && canOverlay);
  // Viewport-driven overlay stays pure CSS (kit-sidebar-layout--overlay-narrow
  // under a 900px media query) so it applies before hydration / without JS;
  // a defined `overlay` takes the driver's seat and suppresses it.
  const overlayNarrow = $derived(overlayOnNarrow && overlay === undefined && canOverlay);

  // Writable derived: tracks the prop until a drag commits a new width.
  let committedWidth = $derived(sidebarWidth);
  let dragWidth: number | null = $state(null);
  let currentWidth = $derived(dragWidth ?? committedWidth);
  let resizeStartWidth = 0;

  function handleResizeStart(): void {
    resizeStartWidth = currentWidth;
  }

  function widthFromResize(event: SplitResizeEvent): number {
    return Math.max(minSidebarWidth, Math.min(maxSidebarWidth, resizeStartWidth + event.delta));
  }

  function handleResize(event: SplitResizeEvent): void {
    dragWidth = widthFromResize(event);
  }

  function handleResizeEnd(event: SplitResizeEvent): void {
    const finalWidth = widthFromResize(event);
    onSidebarResize?.(finalWidth);
    committedWidth = finalWidth;
    dragWidth = null;
  }
</script>

<div
  class="kit-sidebar-layout"
  class:kit-sidebar-layout--overlay={overlayForced}
  class:kit-sidebar-layout--overlay-narrow={overlayNarrow}
>
  {#if !isCollapsed && !hideSidebar}
    <aside
      class="kit-sidebar-layout__sidebar"
      data-collapsed="false"
      style={`width: ${sidebarOnly || !hasMain ? "100%" : `${currentWidth}px`}`}
    >
      {@render sidebar()}
    </aside>
    {#if !sidebarOnly && hasMain}
      <SplitResizeHandle
        ariaLabel="Resize sidebar"
        orientation="horizontal"
        onResizeStart={handleResizeStart}
        onResize={handleResize}
        onResizeEnd={handleResizeEnd}
      />
    {/if}
  {:else if !hideSidebar && showCollapsedStrip}
    <aside
      class="kit-sidebar-layout__sidebar kit-sidebar-layout__sidebar--collapsed"
      data-collapsed="true"
    >
      <SidebarToggle
        state="collapsed"
        label="sidebar"
        onclick={onExpand}
        class="kit-sidebar-toggle--compact"
      />
    </aside>
  {/if}

  {#if hasMain}
    <section
      class="kit-sidebar-layout__main"
      class:kit-sidebar-layout__main--empty={mainEmpty}
      class:kit-sidebar-layout__main--hidden={mainOverflow === "hidden"}
    >
      {#if children}
        {@render children()}
      {/if}
    </section>
  {/if}

  {#if trailing}
    {@render trailing()}
  {/if}
</div>

<style>
  .kit-sidebar-layout {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .kit-sidebar-layout__sidebar {
    width: 340px;
    flex-shrink: 0;
    background: var(--bg-surface);
    border-right: 1px solid var(--border-default);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .kit-sidebar-layout__sidebar--collapsed {
    width: 28px;
    align-items: center;
    padding-top: 6px;
  }

  .kit-sidebar-layout__main {
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow-y: auto;
    background: var(--bg-primary);
    display: flex;
    flex-direction: column;
  }

  .kit-sidebar-layout__main--empty {
    align-items: center;
    justify-content: center;
    padding: 16px;
  }

  .kit-sidebar-layout__main--hidden {
    overflow: hidden;
  }

  /* The expanded sidebar floats over the main area rather than squeezing it.
   * Two drivers share this presentation — keep the two blocks below in sync:
   * `overlay` (host signal, kit-sidebar-layout--overlay, any width) and
   * `overlayOnNarrow` (kit-sidebar-layout--overlay-narrow under the shared
   * `wide` breakpoint from src/lib/breakpoints.ts, kept as a pure media
   * query so it applies before hydration / without JS). Dragging can't
   * change the forced overlay width, so the resize handle hides. */
  .kit-sidebar-layout--overlay {
    position: relative;
  }

  .kit-sidebar-layout--overlay
    > .kit-sidebar-layout__sidebar:not(.kit-sidebar-layout__sidebar--collapsed) {
    position: absolute;
    inset: 0 auto 0 0;
    z-index: 20;
    width: min(100%, 390px) !important;
    max-width: 100%;
    box-shadow: var(--shadow-lg);
  }

  .kit-sidebar-layout--overlay > .kit-sidebar-layout__sidebar--collapsed {
    width: 36px;
    padding-top: 8px;
  }

  .kit-sidebar-layout--overlay > :global(.kit-split-resize-handle) {
    display: none;
  }

  @media (max-width: 900px) {
    .kit-sidebar-layout--overlay-narrow {
      position: relative;
    }

    .kit-sidebar-layout--overlay-narrow
      > .kit-sidebar-layout__sidebar:not(.kit-sidebar-layout__sidebar--collapsed) {
      position: absolute;
      inset: 0 auto 0 0;
      z-index: 20;
      width: min(100%, 390px) !important;
      max-width: 100%;
      box-shadow: var(--shadow-lg);
    }

    .kit-sidebar-layout--overlay-narrow > .kit-sidebar-layout__sidebar--collapsed {
      width: 36px;
      padding-top: 8px;
    }

    .kit-sidebar-layout--overlay-narrow > :global(.kit-split-resize-handle) {
      display: none;
    }
  }
</style>
