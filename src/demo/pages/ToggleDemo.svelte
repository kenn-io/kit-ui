<script lang="ts">
  import { Toggle } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  let notifications = $state(true);
  let autoSync = $state(false);
</script>

<DemoSection
  title="Basic"
  description="middleman's diff-toolbar switch, consolidated: 36×20 track, 16px knob, accent on-state, role=switch semantics on a real input."
  code={`<Toggle bind:checked={notifications} label="Desktop notifications" />`}
>
  <div class="col">
    <Toggle bind:checked={notifications} label="Desktop notifications" />
    <Toggle bind:checked={autoSync} label="Auto-sync" />
    <Toggle checked disabled label="Locked on (disabled)" />
    <Toggle disabled label="Locked off (disabled)" />
  </div>
</DemoSection>

<DemoSection
  title="Settings row"
  description="Label-left settings rows keep their own layout and pass ariaLabel to a bare Toggle — the pattern SettingsLayout uses."
  code={`<div class="row">
  <span>
    <span class="row__label">Auto-sync</span>
    <span class="row__hint">Poll providers every few minutes.</span>
  </span>
  <Toggle bind:checked={autoSync} ariaLabel="Auto-sync" />
</div>`}
>
  <div class="rows">
    <div class="row">
      <span class="row__text">
        <span class="row__label">Auto-sync</span>
        <span class="row__hint">Poll providers every few minutes.</span>
      </span>
      <Toggle bind:checked={autoSync} ariaLabel="Auto-sync" />
    </div>
    <div class="row">
      <span class="row__text">
        <span class="row__label">Desktop notifications</span>
        <span class="row__hint">Alert when a session needs you.</span>
      </span>
      <Toggle bind:checked={notifications} ariaLabel="Desktop notifications" />
    </div>
  </div>
</DemoSection>

<style>
  .col {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    width: min(420px, 100%);
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-6);
  }

  .row__text {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .row__label {
    font-size: var(--font-size-md);
    color: var(--text-primary);
  }

  .row__hint {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
  }
</style>
