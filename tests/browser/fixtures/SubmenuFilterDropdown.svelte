<script lang="ts">
  import FilterDropdown from "../../../src/lib/components/FilterDropdown.svelte";
  import SelectDropdown from "../../../src/lib/components/SelectDropdown.svelte";

  // A searchable filter menu whose Labels row opens a flyout holding a
  // SelectDropdown, for the nested-Escape and search-reposition specs.
  interface Props {
    /** Extra rows in the flyout, to make it taller than a small viewport. */
    flyoutRows?: number;
  }

  let { flyoutRows = 0 }: Props = $props();
  let match = $state("all");
  const noop = () => {};
  // Bumping this rebuilds every item object, the way an app's derived
  // sections do after any filter change. Specs call it through window.
  let version = $state(0);
  (window as unknown as { rebuildFixtureSections: () => void }).rebuildFixtureSections = () =>
    (version += 1);
  const sections = $derived.by(() => {
    void version;
    return [
      {
        items: [
          { id: "alpha", label: "Alpha", active: false, onSelect: noop },
          { id: "beta", label: "Beta", active: false, onSelect: noop },
          { id: "labels", label: "Labels", active: false, submenu: labelsMenu, onSelect: noop },
          ...Array.from({ length: 20 }, (_, i) => ({
            id: `labeled-${i + 1}`,
            label: `Labeled item ${i + 1}`,
            active: false,
            onSelect: noop,
          })),
        ],
      },
    ];
  });
</script>

{#snippet labelsMenu()}
  <div style="padding: 4px 8px">
    <SelectDropdown
      title="Match"
      value={match}
      options={[
        { value: "all", label: "All labels" },
        { value: "any", label: "Any label" },
      ]}
      onchange={(next) => (match = next)}
    />
    {#each Array.from({ length: flyoutRows }, (_, i) => i + 1) as row (row)}
      <button type="button" style="display: block">Flyout row {row}</button>
    {/each}
  </div>
{/snippet}

<FilterDropdown
  label="Fixture filters"
  searchable
  {sections}
  onOpenChange={(open) => (document.body.dataset.fixtureOpen = String(open))}
/>
