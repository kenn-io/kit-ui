<script lang="ts">
  import type { Component } from "svelte";
  import { FlashBanner } from "../lib/index.js";
  import ButtonDemo from "./pages/ButtonDemo.svelte";
  import ChipDemo from "./pages/ChipDemo.svelte";
  import ChipStackDemo from "./pages/ChipStackDemo.svelte";
  import CopyButtonDemo from "./pages/CopyButtonDemo.svelte";
  import FilterDropdownDemo from "./pages/FilterDropdownDemo.svelte";
  import FlashBannerDemo from "./pages/FlashBannerDemo.svelte";
  import KbdBadgeDemo from "./pages/KbdBadgeDemo.svelte";
  import MobileDemo from "./pages/MobileDemo.svelte";
  import MobileFrame from "./MobileFrame.svelte";
  import ModalDemo from "./pages/ModalDemo.svelte";
  import RefreshControlDemo from "./pages/RefreshControlDemo.svelte";
  import SegmentedControlDemo from "./pages/SegmentedControlDemo.svelte";
  import SelectDropdownDemo from "./pages/SelectDropdownDemo.svelte";
  import SidebarDemo from "./pages/SidebarDemo.svelte";
  import SpinnerDemo from "./pages/SpinnerDemo.svelte";
  import SplitResizeHandleDemo from "./pages/SplitResizeHandleDemo.svelte";
  import StatusDotDemo from "./pages/StatusDotDemo.svelte";
  import TableDemo from "./pages/TableDemo.svelte";
  import ThemeDemo from "./pages/ThemeDemo.svelte";
  import TooltipDemo from "./pages/TooltipDemo.svelte";
  import TypeaheadDemo from "./pages/TypeaheadDemo.svelte";

  interface Page {
    id: string;
    label: string;
    component: Component;
  }

  // ?mobile-frame renders the sample screen for the Mobile-preview iframes
  // instead of the gallery shell.
  const isMobileFrame = new URLSearchParams(location.search).has("mobile-frame");

  const pages: Page[] = [
    { id: "theme", label: "Theme tokens", component: ThemeDemo },
    { id: "mobile", label: "Mobile preview", component: MobileDemo },
    { id: "button", label: "Button", component: ButtonDemo },
    { id: "chip", label: "Chip", component: ChipDemo },
    { id: "chip-stack", label: "ChipStack", component: ChipStackDemo },
    { id: "copy-button", label: "CopyButton", component: CopyButtonDemo },
    { id: "filter-dropdown", label: "FilterDropdown", component: FilterDropdownDemo },
    { id: "flash-banner", label: "FlashBanner", component: FlashBannerDemo },
    { id: "kbd-badge", label: "KbdBadge", component: KbdBadgeDemo },
    { id: "modal", label: "Modal", component: ModalDemo },
    { id: "refresh-control", label: "RefreshControl", component: RefreshControlDemo },
    { id: "segmented-control", label: "SegmentedControl", component: SegmentedControlDemo },
    { id: "select-dropdown", label: "SelectDropdown", component: SelectDropdownDemo },
    { id: "sidebar", label: "CollapsibleSidebar", component: SidebarDemo },
    { id: "spinner", label: "Spinner", component: SpinnerDemo },
    { id: "split-resize", label: "SplitResizeHandle", component: SplitResizeHandleDemo },
    { id: "status-dot", label: "StatusDot", component: StatusDotDemo },
    { id: "table", label: "Table", component: TableDemo },
    { id: "tooltip", label: "Tooltip", component: TooltipDemo },
    { id: "typeahead", label: "Typeahead", component: TypeaheadDemo },
  ];

  let activeId = $state(
    (typeof location !== "undefined" && location.hash.slice(1)) || "theme",
  );
  let dark = $state(false);

  const activePage = $derived(
    pages.find((p) => p.id === activeId) ?? pages[0]!,
  );
  const ActiveComponent = $derived(activePage.component);

  function navigate(id: string) {
    activeId = id;
    location.hash = id;
  }

  function toggleTheme() {
    dark = !dark;
    document.documentElement.classList.toggle("dark", dark);
  }
</script>

<svelte:window onhashchange={() => (activeId = location.hash.slice(1) || "theme")} />

{#if isMobileFrame}
  <MobileFrame />
{:else}
  {@render gallery()}
{/if}

{#snippet gallery()}
<FlashBanner top="16px" />

<div class="shell">
  <aside class="sidebar">
    <div class="sidebar__brand">
      <span class="sidebar__title">kit-ui</span>
      <span class="sidebar__subtitle">component gallery</span>
    </div>
    <nav class="sidebar__nav">
      {#each pages as page (page.id)}
        <button
          class="sidebar__link"
          class:active={page.id === activeId}
          type="button"
          onclick={() => navigate(page.id)}
        >
          {page.label}
        </button>
      {/each}
    </nav>
    <button class="sidebar__theme-toggle" type="button" onclick={toggleTheme}>
      {dark ? "☀ Light mode" : "☾ Dark mode"}
    </button>
  </aside>

  <main class="content">
    <h2 class="content__heading">{activePage.label}</h2>
    <ActiveComponent />
  </main>
</div>
{/snippet}

<style>
  .shell {
    display: flex;
    height: 100%;
  }

  .sidebar {
    display: flex;
    flex-direction: column;
    width: 200px;
    flex-shrink: 0;
    border-right: 1px solid var(--border-default);
    background: var(--bg-surface);
    padding: 16px 10px;
    overflow-y: auto;
  }

  .sidebar__brand {
    display: flex;
    flex-direction: column;
    padding: 0 8px 14px;
  }

  .sidebar__title {
    font-size: var(--font-size-lg);
    font-weight: 700;
  }

  .sidebar__subtitle {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
  }

  .sidebar__nav {
    display: flex;
    flex-direction: column;
    gap: 1px;
    flex: 1;
  }

  .sidebar__link {
    display: block;
    width: 100%;
    padding: 5px 8px;
    border: 0;
    background: transparent;
    color: var(--text-secondary);
    font-family: inherit;
    font-size: var(--font-size-md);
    text-align: left;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .sidebar__link:hover {
    background: var(--bg-surface-hover);
    color: var(--text-primary);
  }

  .sidebar__link.active {
    background: color-mix(in srgb, var(--accent-blue) 12%, transparent);
    color: var(--accent-blue);
    font-weight: 600;
  }

  .sidebar__theme-toggle {
    margin-top: 12px;
    padding: 6px 8px;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    background: var(--bg-inset);
    color: var(--text-secondary);
    font-family: inherit;
    font-size: var(--font-size-sm);
    cursor: pointer;
  }

  .sidebar__theme-toggle:hover {
    color: var(--text-primary);
    background: var(--bg-surface-hover);
  }

  .content {
    flex: 1;
    overflow-y: auto;
    padding: 24px 32px 64px;
  }

  .content__heading {
    font-size: var(--font-size-xl);
    font-weight: 700;
    margin-bottom: 20px;
  }
</style>
