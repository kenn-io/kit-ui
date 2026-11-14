<script lang="ts">
  import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import FileIcon from "@lucide/svelte/icons/file";
  import MessageSquareIcon from "@lucide/svelte/icons/message-square";
  import { IconButton, Tabs, type TabAttributes, type TabItem } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  const detailTabs: TabItem[] = [
    { id: "conversation", label: "Conversation", count: 4 },
    { id: "commits", label: "Commits", count: 12 },
    { id: "files", label: "Files changed", count: 38 },
    { id: "checks", label: "Checks", disabled: true },
  ];
  let detail = $state("conversation");
  let changes = $state(0);

  const viewTabs: TabItem[] = [
    { id: "chat", label: "Chat" },
    { id: "files", label: "Files" },
  ];
  let view = $state("chat");

  let manual = $state("conversation");

  let pages = $state<TabItem[]>(
    [
      "Inbox",
      "Calendar",
      "Release notes",
      "Design review",
      "Billing",
      "Team settings",
      "Status page",
      "Changelog",
    ].map((label) => ({ id: label.toLowerCase().replaceAll(" ", "-"), label })),
  );
  let page = $state("inbox");
  let pageClicks = $state(0);
  let dragged = $state<string | undefined>(undefined);
  let strip = $state<HTMLDivElement | undefined>(undefined);
  let canScrollBack = $state(false);
  let canScrollForward = $state(false);

  function measureStrip(): void {
    if (!strip) return;
    canScrollBack = strip.scrollLeft > 0;
    canScrollForward = strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 1;
  }

  // The strip's overflow depends on layout, which only the DOM knows.
  $effect(() => {
    void pages.length;
    measureStrip();
  });

  function scrollStrip(direction: 1 | -1): void {
    strip?.scrollBy({ left: direction * strip.clientWidth * 0.6, behavior: "smooth" });
  }

  function movePage(id: string, before: string): void {
    const from = pages.findIndex((p) => p.id === id);
    const to = pages.findIndex((p) => p.id === before);
    if (from === -1 || to === -1 || from === to) return;
    const next = [...pages];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    pages = next;
  }

  const pageTabAttributes = (item: TabItem, selected: boolean): TabAttributes => ({
    class: ["strip-tab", dragged === item.id && "strip-tab--dragged"],
    title: item.label,
    "data-page": item.id,
    "data-selected": selected || undefined,
    draggable: true,
    ondragstart: (event) => {
      dragged = item.id;
      event.dataTransfer?.setData("text/plain", item.id);
    },
    ondragover: (event) => event.preventDefault(),
    ondrop: (event) => {
      event.preventDefault();
      if (dragged) movePage(dragged, item.id);
      dragged = undefined;
    },
    ondragend: () => (dragged = undefined),
    onclick: () => (pageClicks += 1),
  });

  const panels: Record<string, string> = {
    conversation: "Ana: The retry loop now backs off after the third failure.",
    commits: "Back off after repeated failures",
    files: "src/sync/retry.ts  +42 −7",
  };
</script>

<DemoSection
  title="With a panel"
  description="Arrow keys select enabled tabs; Home and End jump to the first and last. The children snippet supplies the panel, labelled by the selected tab."
  code={`<Tabs tabs={tabs} bind:value ariaLabel="Pull request detail">
  {#snippet children(id)}
    {#if id === "files"}<FileList />{:else}<Conversation />{/if}
  {/snippet}
</Tabs>`}
>
  <div class="tabs-demo" data-testid="tabs-detail">
    <Tabs
      tabs={detailTabs}
      bind:value={detail}
      onchange={() => (changes += 1)}
      ariaLabel="Pull request detail"
    >
      {#snippet children(id)}
        <p class="tabs-demo__panel">{panels[id]}</p>
      {/snippet}
    </Tabs>
    <p class="tabs-demo__readout">
      Selection changes: <span data-testid="tabs-changes">{changes}</span>
    </p>
    <span class="tabs-demo__hidden" data-testid="tabs-value">{detail}</span>
  </div>
</DemoSection>

<DemoSection
  title="Icon-only tabs"
  description="The tab snippet renders custom content, such as an icon, in place of the label. The label stays the accessible name."
  code={`<Tabs {tabs} bind:value ariaLabel="Workspace view">
  {#snippet tab(item)}<Icon id={item.id} />{/snippet}
</Tabs>`}
>
  <div class="tabs-demo" data-testid="tabs-icons">
    <Tabs tabs={viewTabs} bind:value={view} ariaLabel="Workspace view">
      {#snippet tab(item)}
        {#if item.id === "chat"}<MessageSquareIcon size={16} />{:else}<FileIcon size={16} />{/if}
      {/snippet}
    </Tabs>
  </div>
</DemoSection>

<DemoSection
  title="Manual activation"
  description="With activation=&quot;manual&quot;, arrow keys only move focus; Enter or Space selects. Use it when showing a panel is slow. Without a children snippet, Tabs renders the tab list alone."
  code={`<Tabs {tabs} bind:value activation="manual" ariaLabel="Detail" />`}
>
  <div class="tabs-demo" data-testid="tabs-manual">
    <Tabs tabs={detailTabs} bind:value={manual} activation="manual" ariaLabel="Detail (manual)" />
    <span class="tabs-demo__hidden" data-testid="tabs-manual-value">{manual}</span>
  </div>
</DemoSection>

<DemoSection
  title="Browser-style strip"
  description="variant=&quot;bare&quot; drops the tab look so the consumer can style a compact strip. tabAttributes adds per-tab attributes and handlers, here drag and drop to reorder and a click counter that runs after selection. listAttributes and listElement reach the scrolling list, and afterList renders scroll buttons outside role=&quot;tablist&quot;."
  code={`<Tabs
  {tabs}
  bind:value
  variant="bare"
  ariaLabel="Open pages"
  bind:listElement
  listAttributes={{ class: "strip-list", onscroll: measure }}
  tabAttributes={(item, selected) => ({
    class: "strip-tab",
    title: item.label,
    draggable: true,
    ondragstart: () => (dragged = item.id),
    ondragover: (event) => event.preventDefault(),
    ondrop: () => move(dragged, item.id),
    onclick: () => clicks++,
  })}
>
  {#snippet afterList()}
    <IconButton ariaLabel="Scroll back" onclick={() => scroll(-1)}>...</IconButton>
  {/snippet}
</Tabs>`}
>
  <div class="tabs-demo" data-testid="tabs-strip">
    <div class="strip">
      <Tabs
        tabs={pages}
        bind:value={page}
        variant="bare"
        ariaLabel="Open pages"
        bind:listElement={strip}
        listAttributes={{ class: "strip-list", onscroll: measureStrip }}
        tabAttributes={pageTabAttributes}
      >
        {#snippet afterList()}
          {#if canScrollBack}
            <span class="strip-scroll strip-scroll--back">
              <IconButton size="sm" ariaLabel="Scroll tabs back" onclick={() => scrollStrip(-1)}>
                <ChevronLeftIcon size={14} />
              </IconButton>
            </span>
          {/if}
          {#if canScrollForward}
            <span class="strip-scroll strip-scroll--forward">
              <IconButton size="sm" ariaLabel="Scroll tabs forward" onclick={() => scrollStrip(1)}>
                <ChevronRightIcon size={14} />
              </IconButton>
            </span>
          {/if}
        {/snippet}
      </Tabs>
    </div>
    <p class="tabs-demo__readout">
      Tab clicks: <span data-testid="tabs-strip-clicks">{pageClicks}</span> · Order:
      <span data-testid="tabs-strip-order">{pages.map((p) => p.id).join(", ")}</span>
    </p>
    <span class="tabs-demo__hidden" data-testid="tabs-strip-value">{page}</span>
  </div>
</DemoSection>

<style>
  .tabs-demo {
    display: grid;
    gap: var(--space-3);
    width: min(100%, 640px);
  }

  .tabs-demo p {
    margin: 0;
  }

  .tabs-demo__panel {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
  }

  .tabs-demo__hidden {
    display: none;
  }

  .tabs-demo__readout {
    color: var(--text-muted);
    font-size: var(--font-size-xs);
  }

  .strip {
    position: relative;
    max-width: 420px;
    border-radius: var(--radius-md);
    background: var(--bg-inset);
  }

  .strip :global(.strip-list) {
    gap: var(--space-1);
    padding: var(--space-1);
  }

  .strip :global(.strip-tab) {
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    font-size: var(--font-size-xs);
  }

  .strip :global(.strip-tab:hover) {
    color: var(--text-primary);
  }

  .strip :global(.strip-tab[data-selected]) {
    background: var(--bg-surface);
    color: var(--text-primary);
  }

  .strip :global(.strip-tab--dragged) {
    opacity: 0.5;
  }

  .strip-scroll {
    position: absolute;
    top: 50%;
    display: flex;
    background: var(--bg-inset);
    transform: translateY(-50%);
  }

  .strip-scroll--back {
    left: 0;
  }

  .strip-scroll--forward {
    right: 0;
  }
</style>
