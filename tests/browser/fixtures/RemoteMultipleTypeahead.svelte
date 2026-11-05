<script lang="ts">
  import Typeahead from "../../../src/lib/components/Typeahead.svelte";
  import type { TypeaheadOption } from "../../../src/lib/components/typeahead.js";

  // A remote source like a server search: it clears its rows whenever the
  // query resets, then loads suggestions only while the search is open.
  const all: TypeaheadOption[] = [
    { name: "alpha", label: "Alpha" },
    { name: "beta", label: "Beta" },
  ];
  let options = $state<TypeaheadOption[]>([]);
  let values = $state<string[]>(["alpha", "beta"]);
  let latest = "";

  function search(query: string): void {
    latest = query;
    options = [];
    setTimeout(() => {
      if (latest !== query || !document.querySelector('[role="combobox"]')) return;
      options = all.filter((option) => option.label.toLowerCase().includes(query.toLowerCase()));
    }, 50);
  }
</script>

<Typeahead
  {options}
  multiple
  {values}
  remote
  fallbackLabel="None"
  placeholder="Remote labels"
  onquery={search}
  onselect={(name) => {
    values = values.includes(name) ? values.filter((v) => v !== name) : [...values, name];
  }}
/>
<code data-fixture="remote-values">{values.join(", ")}</code>
