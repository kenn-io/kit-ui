<script lang="ts">
  import { getThemeMode, ThemeToggle } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  const mode = $derived(getThemeMode());
</script>

<DemoSection
  title="Cycle variant (header chrome)"
  description="One icon button cycling light → dark → system; the icon shows the current mode (sun / moon / monitor) and the aria-label announces it. Backed by the theme store, so every instance stays in sync — including the gallery's own sidebar toggle."
  code={`<ThemeToggle />  <!-- variant="cycle" is the default -->`}
>
  <div class="row">
    <ThemeToggle />
    <span class="readout">mode: <code>{mode}</code></span>
  </div>
</DemoSection>

<DemoSection
  title="Segmented variant (settings pages)"
  description="Three-way selector for places with room for labels. Labels are props with English defaults."
  code={`<ThemeToggle variant="segmented" />
<ThemeToggle variant="segmented" block lightLabel="Hell" darkLabel="Dunkel" systemLabel="System" />`}
>
  <div class="col">
    <ThemeToggle variant="segmented" />
    <div class="narrow">
      <ThemeToggle
        variant="segmented"
        block
        lightLabel="Hell"
        darkLabel="Dunkel"
        systemLabel="System"
      />
    </div>
  </div>
</DemoSection>

<style>
  .row {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  .col {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    align-items: flex-start;
  }

  .narrow {
    width: 260px;
  }

  .readout {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
  }
</style>
