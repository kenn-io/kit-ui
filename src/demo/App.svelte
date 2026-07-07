<script lang="ts">
  import type { Component } from "svelte";
  import { FlashBanner, initTheme, SearchInput, ThemeToggle } from "../lib/index.js";
  import ButtonDemo from "./pages/ButtonDemo.svelte";
  import CalendarDemo from "./pages/CalendarDemo.svelte";
  import ChipDemo from "./pages/ChipDemo.svelte";
  import ChipStackDemo from "./pages/ChipStackDemo.svelte";
  import CodeBlockDemo from "./pages/CodeBlockDemo.svelte";
  import ColorLabelDemo from "./pages/ColorLabelDemo.svelte";
  import CommandPaletteDemo from "./pages/CommandPaletteDemo.svelte";
  import CopyButtonDemo from "./pages/CopyButtonDemo.svelte";
  import DetailDrawerDemo from "./pages/DetailDrawerDemo.svelte";
  import EmptyStateDemo from "./pages/EmptyStateDemo.svelte";
  import FilterDropdownDemo from "./pages/FilterDropdownDemo.svelte";
  import FindBarDemo from "./pages/FindBarDemo.svelte";
  import FitStagesDemo from "./pages/FitStagesDemo.svelte";
  import FlashBannerDemo from "./pages/FlashBannerDemo.svelte";
  import IconButtonDemo from "./pages/IconButtonDemo.svelte";
  import ImagePreviewDemo from "./pages/ImagePreviewDemo.svelte";
  import KbdBadgeDemo from "./pages/KbdBadgeDemo.svelte";
  import MarkdownDemo from "./pages/MarkdownDemo.svelte";
  import MentionTextareaDemo from "./pages/MentionTextareaDemo.svelte";
  import MobileDemo from "./pages/MobileDemo.svelte";
  import MobileFrame from "./MobileFrame.svelte";
  import ModalDemo from "./pages/ModalDemo.svelte";
  import DateRangePickerDemo from "./pages/DateRangePickerDemo.svelte";
  import RefreshControlDemo from "./pages/RefreshControlDemo.svelte";
  import SegmentedControlDemo from "./pages/SegmentedControlDemo.svelte";
  import SelectDropdownDemo from "./pages/SelectDropdownDemo.svelte";
  import SettingsLayoutDemo from "./pages/SettingsLayoutDemo.svelte";
  import SidebarDemo from "./pages/SidebarDemo.svelte";
  import SpinnerDemo from "./pages/SpinnerDemo.svelte";
  import SplitResizeHandleDemo from "./pages/SplitResizeHandleDemo.svelte";
  import StatusBarDemo from "./pages/StatusBarDemo.svelte";
  import StatusDotDemo from "./pages/StatusDotDemo.svelte";
  import TableDemo from "./pages/TableDemo.svelte";
  import TextInputDemo from "./pages/TextInputDemo.svelte";
  import ThemeDemo from "./pages/ThemeDemo.svelte";
  import ThemeModeDemo from "./pages/ThemeModeDemo.svelte";
  import ThemeToggleDemo from "./pages/ThemeToggleDemo.svelte";
  import TooltipDemo from "./pages/TooltipDemo.svelte";
  import TopBarDemo from "./pages/TopBarDemo.svelte";
  import TypeaheadDemo from "./pages/TypeaheadDemo.svelte";
  import VirtualListDemo from "./pages/VirtualListDemo.svelte";

  interface Page {
    id: string;
    label: string;
    component: Component;
  }

  // ?mobile-frame renders the sample screen for the Mobile-preview iframes
  // instead of the gallery shell.
  const isMobileFrame = new URLSearchParams(location.search).has("mobile-frame");

  // Gallery meta-pages stay pinned at the top; component pages below are
  // sorted alphabetically by label regardless of declaration order.
  const metaPages: Page[] = [
    { id: "theme", label: "Theme tokens", component: ThemeDemo },
    { id: "mobile", label: "Mobile preview", component: MobileDemo },
  ];

  const componentPages: Page[] = [
    { id: "button", label: "Button", component: ButtonDemo },
    { id: "calendar", label: "Calendar", component: CalendarDemo },
    { id: "chip", label: "Chip", component: ChipDemo },
    { id: "chip-stack", label: "ChipStack", component: ChipStackDemo },
    { id: "code-block", label: "CodeBlock", component: CodeBlockDemo },
    { id: "color-label", label: "ColorLabel", component: ColorLabelDemo },
    { id: "command-palette", label: "CommandPalette", component: CommandPaletteDemo },
    { id: "copy-button", label: "CopyButton", component: CopyButtonDemo },
    { id: "detail-drawer", label: "DetailDrawer", component: DetailDrawerDemo },
    { id: "empty-state", label: "EmptyState", component: EmptyStateDemo },
    { id: "filter-dropdown", label: "FilterDropdown", component: FilterDropdownDemo },
    { id: "find-bar", label: "FindBar", component: FindBarDemo },
    { id: "fit-stages", label: "FitStages", component: FitStagesDemo },
    { id: "flash-banner", label: "FlashBanner", component: FlashBannerDemo },
    { id: "icon-button", label: "IconButton", component: IconButtonDemo },
    { id: "image-preview", label: "ImagePreview", component: ImagePreviewDemo },
    { id: "kbd-badge", label: "KbdBadge", component: KbdBadgeDemo },
    { id: "markdown", label: "Markdown", component: MarkdownDemo },
    { id: "mention-textarea", label: "MentionTextarea", component: MentionTextareaDemo },
    { id: "modal", label: "Modal", component: ModalDemo },
    { id: "date-range-picker", label: "DateRangePicker", component: DateRangePickerDemo },
    { id: "refresh-control", label: "RefreshControl", component: RefreshControlDemo },
    { id: "segmented-control", label: "SegmentedControl", component: SegmentedControlDemo },
    { id: "select-dropdown", label: "SelectDropdown", component: SelectDropdownDemo },
    { id: "settings-layout", label: "SettingsLayout", component: SettingsLayoutDemo },
    { id: "sidebar", label: "CollapsibleSidebar", component: SidebarDemo },
    { id: "spinner", label: "Spinner", component: SpinnerDemo },
    { id: "split-resize", label: "SplitResizeHandle", component: SplitResizeHandleDemo },
    { id: "status-bar", label: "StatusBar", component: StatusBarDemo },
    { id: "status-dot", label: "StatusDot", component: StatusDotDemo },
    { id: "table", label: "Table", component: TableDemo },
    { id: "text-input", label: "TextInput", component: TextInputDemo },
    { id: "theme-mode", label: "Theme mode", component: ThemeModeDemo },
    { id: "theme-toggle", label: "ThemeToggle", component: ThemeToggleDemo },
    { id: "tooltip", label: "Tooltip", component: TooltipDemo },
    { id: "top-bar", label: "TopBar", component: TopBarDemo },
    { id: "typeahead", label: "Typeahead", component: TypeaheadDemo },
    { id: "virtual-list", label: "VirtualList", component: VirtualListDemo },
  ].sort((a, b) => a.label.localeCompare(b.label));

  const pages: Page[] = [...metaPages, ...componentPages];

  let activeId = $state((typeof location !== "undefined" && location.hash.slice(1)) || "theme");
  let filter = $state("");

  initTheme();

  function matches(page: Page): boolean {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return page.label.toLowerCase().includes(q) || page.id.includes(q);
  }

  const visibleMeta = $derived(metaPages.filter(matches));
  const visibleComponents = $derived(componentPages.filter(matches));

  const activePage = $derived(pages.find((p) => p.id === activeId) ?? pages[0]!);
  const ActiveComponent = $derived(activePage.component);

  function navigate(id: string) {
    activeId = id;
    location.hash = id;
  }
</script>

<svelte:window onhashchange={() => (activeId = location.hash.slice(1) || "theme")} />

{#if isMobileFrame}
  <MobileFrame />
{:else}
  {@render gallery()}
{/if}

{#snippet navLink(page: Page)}
  <button
    class="sidebar__link"
    class:active={page.id === activeId}
    type="button"
    onclick={() => navigate(page.id)}
  >
    {page.label}
  </button>
{/snippet}

{#snippet gallery()}
  <FlashBanner top="16px" />

  <div class="shell">
    <aside class="sidebar">
      <div class="sidebar__brand">
        <span class="sidebar__title">kit-ui</span>
        <span class="sidebar__subtitle">component gallery</span>
      </div>
      <div class="sidebar__filter">
        <SearchInput
          bind:value={filter}
          placeholder="Filter components…"
          ariaLabel="Filter components"
          size="sm"
          block
        />
      </div>
      <nav class="sidebar__nav">
        {#each visibleMeta as page (page.id)}
          {@render navLink(page)}
        {/each}
        {#if visibleMeta.length > 0 && visibleComponents.length > 0}
          <div class="sidebar__divider" aria-hidden="true"></div>
        {/if}
        {#each visibleComponents as page (page.id)}
          {@render navLink(page)}
        {/each}
        {#if visibleMeta.length === 0 && visibleComponents.length === 0}
          <span class="sidebar__empty">No matches</span>
        {/if}
      </nav>
      <div class="sidebar__theme">
        <ThemeToggle variant="segmented" block />
      </div>
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

  .sidebar__filter {
    padding: 0 0 10px;
  }

  .sidebar__nav {
    display: flex;
    flex-direction: column;
    gap: 1px;
    flex: 1;
  }

  .sidebar__divider {
    height: 1px;
    margin: 6px 8px;
    background: var(--border-muted);
    flex-shrink: 0;
  }

  .sidebar__empty {
    padding: 5px 8px;
    font-size: var(--font-size-sm);
    color: var(--text-muted);
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

  .sidebar__theme {
    margin-top: 12px;
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
