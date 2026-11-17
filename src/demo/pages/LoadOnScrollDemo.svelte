<script lang="ts">
  import { SegmentedControl, Toggle, writeListPosition } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";
  import LoadOnScrollList from "./LoadOnScrollList.svelte";

  const queryFilter = new URLSearchParams(location.search).get("filter")?.toLowerCase();
  let filter = $state(queryFilter === "open" || queryFilter === "closed" ? queryFilter : "all");
  let fail = $state(false);
  let hash = $state(location.hash);
  const options = [
    { value: "all", label: "All" },
    { value: "open", label: "Open" },
    { value: "closed", label: "Closed" },
  ];
  const detail = $derived(/^#load-on-scroll-row-(\d+)$/.exec(hash)?.[1]);

  function changeFilter(value: string) {
    const url = new URL(location.href);
    if (value === "all") url.searchParams.delete("filter");
    else url.searchParams.set("filter", value);
    writeListPosition("demo-list", null, url.href);
    writeListPosition("demo-table", null, url.href);
    filter = value;
  }
</script>

<svelte:window onhashchange={() => (hash = location.hash)} />
{#if detail}
  <h3>Row {detail}</h3>
  <a
    href="#load-on-scroll"
    onclick={(event) => {
      event.preventDefault();
      history.back();
    }}>Back</a
  >
{:else}
  <div class="controls">
    <SegmentedControl {options} value={filter} onchange={changeFilter} ariaLabel="Filter" />
    <Toggle bind:checked={fail} label="Fail next batch" />
  </div>
  {#key filter}
    <DemoSection title="List"><LoadOnScrollList kind="list" {filter} bind:fail /></DemoSection>
    <DemoSection title="Virtual table"
      ><LoadOnScrollList kind="table" {filter} bind:fail /></DemoSection
    >
  {/key}
{/if}

<style>
  .controls {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }
</style>
