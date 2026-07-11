<script lang="ts">
  import {
    Button,
    Card,
    Checkbox,
    Chip,
    KbdBadge,
    KIT_THEMES,
    SearchInput,
    SegmentedControl,
    SelectDropdown,
    Spinner,
    StatusDot,
    TextInput,
    Toggle,
    getThemeName,
    setThemeName,
  } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  let sampleText = $state("");
  let sampleQuery = $state("");
  let sampleView = $state("list");
  let sampleRange = $state("7d");
  let sampleSync = $state(true);
  let sampleBots = $state(false);

  const active = $derived(getThemeName() ?? "");

  const pickerCards = [
    {
      name: "",
      label: "Default",
      description: "The Workbench: the untouched base light/dark pair",
    },
    ...KIT_THEMES,
  ];
</script>

<DemoSection
  title="Pluggable themes"
  description="Each theme is a full identity — shape, elevation, border presence, hover feel, motion speed, focus treatment, and type, with light and dark variants. Pick one; the whole gallery (and every component in it) follows. The dark-mode toggle in the sidebar composes with any theme."
  code={`import "@kenn-io/kit-ui/theme.css";
import "@kenn-io/kit-ui/themes.css"; // opt-in theme pack

import { KIT_THEMES, setThemeName } from "@kenn-io/kit-ui";

setThemeName("gallery"); // data-kit-theme="gallery" on <html>
setThemeName(null); // back to the default pair`}
>
  <div class="theme-grid" role="group" aria-label="Theme">
    {#each pickerCards as theme (theme.name)}
      <Card
        level="default"
        padding="sm"
        selected={active === theme.name}
        onclick={() => setThemeName(theme.name || null)}
      >
        <span class="theme-card__name">{theme.label}</span>
        <span class="theme-card__tagline">{theme.description}</span>
      </Card>
    {/each}
  </div>
</DemoSection>

<DemoSection
  title="Actions"
  description="Buttons across tones and surfaces. Watch the radius, border weight, press speed, and focus ring change with the theme (Tab through them)."
>
  <div class="cluster">
    <Button tone="info" surface="solid" label="Save changes" />
    <Button tone="success" surface="solid" label="Merge" />
    <Button tone="danger" surface="solid" label="Delete" />
    <Button tone="neutral" surface="solid" label="Neutral" />
    <Button tone="info" surface="soft" label="Review" />
    <Button tone="success" surface="soft" label="Approve" />
    <Button tone="workflow" surface="soft" label="Workflow" />
    <Button tone="neutral" surface="outline" label="Cancel" />
    <Button tone="danger" surface="outline" label="Discard" />
    <Button tone="neutral" surface="outline" label="Disabled" disabled />
  </div>
</DemoSection>

<DemoSection
  title="Fields and selection"
  description="Wrapper-focus inputs, dropdown chrome, and segmented radio groups."
>
  <div class="cluster cluster--fields">
    <TextInput bind:value={sampleText} placeholder="Session title…" ariaLabel="Sample text" />
    <SearchInput bind:value={sampleQuery} placeholder="Filter…" ariaLabel="Sample search" />
    <SelectDropdown
      value={sampleRange}
      options={[
        { value: "24h", label: "Last 24 hours" },
        { value: "7d", label: "Last 7 days" },
        { value: "30d", label: "Last 30 days" },
      ]}
      onchange={(v) => (sampleRange = v)}
      title="Range"
    />
    <SegmentedControl
      options={[
        { value: "list", label: "List" },
        { value: "board", label: "Board" },
        { value: "table", label: "Table" },
      ]}
      value={sampleView}
      onchange={(v) => (sampleView = v)}
      ariaLabel="View"
    />
    <Toggle bind:checked={sampleSync} label="Auto-sync" />
    <Checkbox bind:checked={sampleBots} label="Hide bots" />
  </div>
</DemoSection>

<DemoSection
  title="Signals"
  description="Chips, status dots, toned bands, and keyboard hints — the semantic accents stay meaningful inside every identity."
>
  <div class="col">
    <div class="cluster">
      <Chip tone="success" dot>running</Chip>
      <Chip tone="info">ready</Chip>
      <Chip tone="warning">draft</Chip>
      <Chip tone="danger">failed</Chip>
      <Chip tone="merged">merged</Chip>
      <Chip tone="workspace">workspace</Chip>
      <StatusDot status="working" label="Working" />
      <StatusDot status="waiting" label="Your turn" />
      <Spinner size={14} />
      <KbdBadge keys={["⌘", "K"]} />
    </div>
    <div class="tone-bands">
      {#each ["info", "success", "warning", "danger"] as tone (tone)}
        <div class="tone-band" data-kit-tone={tone}>
          <strong>{tone}</strong> band from the shared 9 / 30 / 72 recipe
        </div>
      {/each}
    </div>
  </div>
</DemoSection>

<DemoSection
  title="Floating surfaces"
  description="The popover card is one shared chrome; its shadow is where each theme's elevation philosophy shows — diffuse lift, hard riso offset, CRT glow, or flat borders."
>
  <div class="cluster cluster--top">
    <div class="kit-popover-card sample-menu" role="presentation">
      <div class="sample-menu__item sample-menu__item--active">Open session</div>
      <div class="sample-menu__item">Copy id</div>
      <div class="sample-menu__item">Move to workspace</div>
      <div class="sample-menu__item sample-menu__item--danger">Archive</div>
    </div>
    <Card level="raised" padding="none" class="sample-rows">
      {#each [{ name: "fix: retry websocket backoff", meta: "middleman · 2m ago", status: "working" }, { name: "Pluggable theme support", meta: "kit-ui · waiting on you", status: "waiting" }, { name: "Bump playwright to 1.61", meta: "agentsview · 3h ago", status: "idle" }] as row (row.name)}
        <div class="sample-row">
          <StatusDot status={row.status as "working" | "waiting" | "idle"} />
          <div class="sample-row__text">
            <span class="sample-row__name">{row.name}</span>
            <span class="sample-row__meta">{row.meta}</span>
          </div>
        </div>
      {/each}
    </Card>
  </div>
</DemoSection>

<style>
  .theme-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
    gap: var(--space-4);
    width: 100%;
  }

  /* The tiles are clickable Cards; only their body layout is ours. */
  .theme-grid :global(.kit-card__body) {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .theme-card__name {
    font-size: var(--font-size-md);
    font-weight: 600;
    color: var(--text-primary);
  }

  .theme-card__tagline {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
  }

  .cluster {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-5);
  }

  .cluster--top {
    align-items: flex-start;
  }

  .cluster--fields {
    max-width: 720px;
  }

  .col {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    width: 100%;
  }

  .tone-bands {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    max-width: 460px;
  }

  .tone-band {
    padding: var(--space-4) var(--space-5);
    font-size: var(--font-size-sm);
    color: var(--kit-tone-ink);
    background: var(--kit-tone-band-bg);
    border: var(--border-width) solid var(--kit-tone-border);
    border-radius: var(--radius-md);
  }

  .sample-menu {
    padding: var(--space-2);
    width: 200px;
    font-size: var(--font-size-md);
  }

  .sample-menu__item {
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    cursor: default;
  }

  .sample-menu__item:hover {
    background: var(--bg-surface-hover);
    color: var(--text-primary);
  }

  .sample-menu__item--active {
    background: color-mix(in srgb, var(--accent-blue) 12%, transparent);
    color: color-mix(in srgb, var(--accent-blue) 72%, var(--text-primary));
    font-weight: 600;
  }

  .sample-menu__item--danger {
    color: color-mix(in srgb, var(--accent-red) 72%, var(--text-primary));
  }

  /* A raised Card hosts the list; overflow clips row hover fills to the
   * card's themed radius. */
  .cluster :global(.sample-rows) {
    min-width: 300px;
    overflow: hidden;
  }

  .sample-row {
    display: flex;
    align-items: center;
    gap: var(--space-5);
    padding: var(--space-4) var(--space-5);
  }

  .sample-row:hover {
    background: var(--bg-surface-hover);
  }

  .sample-row + .sample-row {
    border-top: 1px solid var(--border-muted);
  }

  .sample-row__text {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .sample-row__name {
    font-size: var(--font-size-md);
    color: var(--text-primary);
  }

  .sample-row__meta {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
  }
</style>
