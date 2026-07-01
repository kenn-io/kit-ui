<script lang="ts">
  import { Typeahead } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  let repo = $state("");
  const repos = [
    { name: "kenn-io/middleman", label: "kenn-io/middleman", displayLabel: "middleman" },
    { name: "kenn-io/agentsview", label: "kenn-io/agentsview", displayLabel: "agentsview" },
    { name: "kenn-io/kit-ui", label: "kenn-io/kit-ui", displayLabel: "kit-ui" },
    { name: "kenn-io/infra", label: "kenn-io/infra", displayLabel: "infra" },
  ];
</script>

<DemoSection
  title="Filterable select"
  description="Click the trigger to get a search input; matches are highlighted, arrow keys navigate, Enter selects."
  code={`<Typeahead
  options={repos}
  value={repo}
  fallbackLabel="All repositories"
  placeholder="Filter repositories…"
  onselect={(v) => (repo = v)}
/>`}
>
  <Typeahead
    options={repos}
    value={repo}
    fallbackLabel="All repositories"
    placeholder="Filter repositories…"
    onselect={(v) => (repo = v)}
  />
  <span>value: <code>{repo || "(none)"}</code></span>
</DemoSection>
