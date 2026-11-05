<script lang="ts">
  import { FilterDropdown } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  let states = $state(new Set(["open"]));
  const stateOptions = [
    { id: "open", label: "Open", color: "var(--accent-green)" },
    { id: "draft", label: "Draft", color: "var(--accent-amber)" },
    { id: "merged", label: "Merged", color: "var(--accent-purple)" },
    { id: "closed", label: "Closed", color: "var(--accent-red)" },
  ];

  function toggleState(id: string) {
    const next = new Set(states);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    states = next;
  }

  let models = $state(new Set(["fable-5", "opus-4-8", "haiku-4-5"]));
  const modelOptions = [
    { id: "fable-5", count: 812 },
    { id: "opus-4-8", count: 421 },
    { id: "haiku-4-5", count: 1287 },
    { id: "sonnet-5", count: 96 },
  ];

  let pickedLabels = $state(new Set<string>());
  const labelOptions = ["bug", "docs", "enhancement"];

  function toggleLabel(name: string) {
    const next = new Set(pickedLabels);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    pickedLabels = next;
  }

  function toggleModel(id: string) {
    const next = new Set(models);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    models = next;
  }
</script>

<DemoSection
  title="Multi-select filter"
  description="Sectioned filter menu with a badge showing the active count and an optional reset row. Items expose active + onSelect, so any selection model works."
  code={`<FilterDropdown
  label="State"
  badgeCount={states.size}
  sections={[{
    title: "PR state",
    items: stateOptions.map((o) => ({
      ...o,
      active: states.has(o.id),
      onSelect: () => toggle(o.id),
    })),
  }]}
  resetLabel="Clear filters"
  onReset={() => (states = new Set())}
/>`}
>
  <FilterDropdown
    label="State"
    badgeCount={states.size}
    sections={[
      {
        title: "PR state",
        items: stateOptions.map((o) => ({
          ...o,
          active: states.has(o.id),
          onSelect: () => toggleState(o.id),
        })),
      },
    ]}
    resetLabel="Clear filters"
    onReset={() => (states = new Set())}
  />
  <span>active: <code>{[...states].join(", ") || "none"}</code></span>
</DemoSection>

<DemoSection
  title="Searchable with counts and bulk actions"
  description="searchable adds a filter input; onSelectAll/onDeselectAll add bulk rows; count renders per item."
  code={`<FilterDropdown
  label="Models"
  icon="more"
  searchable
  sections={[{ items: modelItems }]}
  onSelectAll={() => (models = new Set(modelOptions.map((o) => o.id)))}
  onDeselectAll={() => (models = new Set())}
/>`}
>
  <FilterDropdown
    label="Models"
    icon="more"
    searchable
    badgeCount={models.size}
    sections={[
      {
        items: modelOptions.map((o) => ({
          id: o.id,
          label: o.id,
          count: o.count,
          active: models.has(o.id),
          onSelect: () => toggleModel(o.id),
        })),
      },
    ]}
    onSelectAll={() => (models = new Set(modelOptions.map((o) => o.id)))}
    onDeselectAll={() => (models = new Set())}
  />
</DemoSection>

<DemoSection
  title="Sort variant"
  description={'icon="sort" with closeOnSelect items makes a sort menu.'}
  code={`<FilterDropdown label="Sort" icon="sort" sections={[{ items: sortItems }]} />`}
>
  <FilterDropdown
    label="Sort"
    icon="sort"
    sections={[
      {
        items: [
          {
            id: "updated",
            label: "Recently updated",
            active: true,
            closeOnSelect: true,
            onSelect: () => {},
          },
          {
            id: "created",
            label: "Newest",
            active: false,
            closeOnSelect: true,
            onSelect: () => {},
          },
        ],
      },
    ]}
  />
</DemoSection>

{#snippet labelPicker()}
  <div class="demo-label-picker">
    {#each labelOptions as name (name)}
      <button type="button" aria-pressed={pickedLabels.has(name)} onclick={() => toggleLabel(name)}>
        {name}
      </button>
    {/each}
  </div>
{/snippet}

<DemoSection
  title="Submenu row"
  description="An item with a submenu snippet opens a flyout beside the panel instead of toggling. detail summarizes its value on the row. Escape or ArrowLeft closes the flyout and returns focus to the row."
  code={`<FilterDropdown
  label="Filters"
  sections={[{
    items: [{
      id: "labels",
      label: "Labels",
      detail: picked.size ? \`\${picked.size} selected\` : "Any",
      active: picked.size > 0,
      submenu: labelPicker,
      onSelect: () => {},
    }],
  }]}
/>`}
>
  <FilterDropdown
    label="Filters"
    badgeCount={pickedLabels.size}
    sections={[
      {
        items: [
          {
            id: "labels",
            label: "Labels",
            detail: pickedLabels.size > 0 ? `${pickedLabels.size} selected` : "Any",
            active: pickedLabels.size > 0,
            submenu: labelPicker,
            onSelect: () => {},
          },
        ],
      },
    ]}
  />
  <span data-testid="filter-submenu-picked">picked: {[...pickedLabels].join(", ") || "none"}</span>
</DemoSection>

<style>
  .demo-label-picker {
    display: flex;
    flex-direction: column;
    padding: 0 var(--space-2);
  }

  .demo-label-picker button {
    padding: var(--space-1) var(--space-2);
    border: 0;
    background: transparent;
    color: var(--text-secondary);
    font: inherit;
    font-size: var(--font-size-xs);
    text-align: left;
    cursor: pointer;
  }

  .demo-label-picker button[aria-pressed="true"] {
    color: var(--accent-blue);
  }
</style>
