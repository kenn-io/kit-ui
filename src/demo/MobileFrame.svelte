<script lang="ts">
  // Sample screen rendered inside the Mobile-preview iframes. The type scale
  // keys on the device's pointer, which an iframe inherits from the host, so
  // the phone frame passes ?touch to force the scale via the kit-type-touch
  // root class — exactly how a test or device emulator would.
  import { Button, Chip, SegmentedControl, StatusDot } from "../lib/index.js";

  if (new URLSearchParams(location.search).has("touch")) {
    document.documentElement.classList.add("kit-type-touch");
  }

  let view = $state("active");

  const sessions = [
    { name: "middleman #1204", status: "working", detail: "Refactoring diff view" },
    { name: "agentsview #88", status: "waiting", detail: "Your turn — review plan" },
    { name: "kit-ui #3", status: "idle", detail: "Idle for 12 minutes" },
    { name: "infra #41", status: "stale", detail: "No activity since Friday" },
  ] as const;
</script>

<div class="screen">
  <header class="screen__header">
    <span class="screen__title">Sessions</span>
    <Chip tone="success" size="sm" dot>3 live</Chip>
  </header>

  <SegmentedControl
    block
    options={[
      { value: "active", label: "Active" },
      { value: "all", label: "All" },
      { value: "archived", label: "Archived" },
    ]}
    value={view}
    onchange={(v) => (view = v)}
    ariaLabel="Session filter"
  />

  <input class="screen__search" type="search" placeholder="Search sessions…" />

  <ul class="screen__list">
    {#each sessions as s (s.name)}
      <li class="screen__item">
        <StatusDot status={s.status} />
        <span class="screen__item-body">
          <span class="screen__item-name">{s.name}</span>
          <span class="screen__item-detail">{s.detail}</span>
        </span>
      </li>
    {/each}
  </ul>

  <div class="screen__metric">
    <span class="screen__metric-value">$4.83</span>
    <span class="screen__metric-label">spend today</span>
  </div>

  <div class="screen__actions">
    <Button label="New session" tone="info" surface="solid" />
    <Button label="Refresh" />
  </div>
</div>

<style>
  .screen {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    height: 100%;
    padding: 12px;
    background: var(--bg-primary);
  }

  .screen__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .screen__title {
    font-size: var(--font-size-xl);
    font-weight: 700;
  }

  .screen__search {
    padding: 6px 10px;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    background: var(--bg-surface);
    color: var(--text-primary);
    font-family: inherit;
    font-size: var(--font-size-md);
  }

  .screen__search::placeholder {
    color: var(--text-muted);
  }

  .screen__list {
    list-style: none;
    margin: 0;
    padding: 4px;
    display: flex;
    flex-direction: column;
    background: var(--bg-surface);
    border: 1px solid var(--border-muted);
    border-radius: var(--radius-md);
  }

  .screen__item {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: 8px;
    border-radius: var(--radius-sm);
  }

  .screen__item:hover {
    background: var(--bg-surface-hover);
  }

  .screen__item-body {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .screen__item-name {
    font-size: var(--font-size-md);
    font-weight: 500;
  }

  .screen__item-detail {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .screen__metric {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 10px 12px;
    background: var(--bg-surface);
    border: 1px solid var(--border-muted);
    border-radius: var(--radius-md);
  }

  .screen__metric-value {
    font-size: var(--font-size-2xl);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .screen__metric-label {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
  }

  .screen__actions {
    display: flex;
    gap: 8px;
    margin-top: auto;
  }
</style>
