<script lang="ts">
  import { SelectDropdown } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  let sort = $state("updated");
  let strategy = $state("squash");
</script>

<DemoSection
  title="Single select"
  description="Accessible combobox with keyboard navigation (arrows, Enter, Escape). The trigger falls back to the first option when value doesn't match."
  code={`<SelectDropdown
  value={sort}
  title="Sort"
  options={[
    { value: "updated", label: "Recently updated" },
    { value: "created", label: "Newest" },
    { value: "title", label: "Title" },
  ]}
  onchange={(v) => (sort = v)}
/>`}
>
  <SelectDropdown
    value={sort}
    title="Sort"
    options={[
      { value: "updated", label: "Recently updated" },
      { value: "created", label: "Newest" },
      { value: "title", label: "Title" },
    ]}
    onchange={(v) => (sort = v)}
  />
  <span>value: <code>{sort}</code></span>
</DemoSection>

<DemoSection
  title="Trigger labels and disabled options"
  description="triggerLabel shows a shorter label on the closed trigger; options can be individually disabled."
  code={`<SelectDropdown
  value={strategy}
  options={[
    { value: "squash", label: "Squash and merge", triggerLabel: "Squash" },
    { value: "merge", label: "Create a merge commit", triggerLabel: "Merge" },
    { value: "rebase", label: "Rebase and merge", triggerLabel: "Rebase", disabled: true },
  ]}
  onchange={(v) => (strategy = v)}
/>`}
>
  <SelectDropdown
    value={strategy}
    options={[
      { value: "squash", label: "Squash and merge", triggerLabel: "Squash" },
      { value: "merge", label: "Create a merge commit", triggerLabel: "Merge" },
      { value: "rebase", label: "Rebase and merge", triggerLabel: "Rebase", disabled: true },
    ]}
    onchange={(v) => (strategy = v)}
  />
</DemoSection>
