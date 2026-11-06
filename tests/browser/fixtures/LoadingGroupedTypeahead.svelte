<script lang="ts">
  import Typeahead from "../../../src/lib/components/Typeahead.svelte";
  import type { TypeaheadOption } from "../../../src/lib/components/typeahead.js";

  interface Props {
    remote: boolean;
  }

  let { remote }: Props = $props();
  let options = $state<TypeaheadOption[]>([]);
  let loading = $state(true);
  let value = $state("");

  export function supplyOptions(): void {
    options = [
      {
        name: "group",
        label: "Group",
        expanded: true,
        children: [{ name: "alpha", label: "Alpha" }],
      },
    ];
    loading = false;
  }
</script>

<Typeahead
  {options}
  {loading}
  {remote}
  {value}
  highlightFirstOption
  placeholder="Grouped choices"
  onselect={(name) => (value = name)}
/>
<code data-fixture="selected-value">{value}</code>
