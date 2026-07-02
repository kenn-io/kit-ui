<script lang="ts">
  import BellIcon from "@lucide/svelte/icons/bell";
  import CheckIcon from "@lucide/svelte/icons/check";
  import MoonIcon from "@lucide/svelte/icons/moon";
  import PinIcon from "@lucide/svelte/icons/pin";
  import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
  import SettingsIcon from "@lucide/svelte/icons/settings";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import XIcon from "@lucide/svelte/icons/x";
  import { IconButton, showFlash } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  let pinned = $state(false);
</script>

<DemoSection
  title="Sizes"
  description="Square ghost buttons for toolbars and headers: md (28px) for app chrome, sm (24px) for dense rows. ariaLabel is required — it doubles as the tooltip unless title overrides it."
  code={`<IconButton ariaLabel="Sync" onclick={sync}>
  <RefreshCwIcon size="14" />
</IconButton>
<IconButton size="sm" ariaLabel="Dismiss">
  <XIcon size="13" />
</IconButton>`}
>
  <div class="row">
    <IconButton ariaLabel="Sync" onclick={() => showFlash("Syncing…", 1500)}>
      <RefreshCwIcon size="14" strokeWidth="2" aria-hidden="true" />
    </IconButton>
    <IconButton ariaLabel="Toggle theme">
      <MoonIcon size="14" strokeWidth="2" aria-hidden="true" />
    </IconButton>
    <IconButton ariaLabel="Settings">
      <SettingsIcon size="14" strokeWidth="2" aria-hidden="true" />
    </IconButton>
    <span class="sep"></span>
    <IconButton size="sm" ariaLabel="Notifications">
      <BellIcon size="13" strokeWidth="2" aria-hidden="true" />
    </IconButton>
    <IconButton size="sm" ariaLabel="Dismiss">
      <XIcon size="13" strokeWidth="2" aria-hidden="true" />
    </IconButton>
  </div>
</DemoSection>

<DemoSection
  title="Tones"
  description="Tones color the hover state (and a pressed toggle) toward the accent — the rest state stays muted so toolbars don't turn into rainbows."
  code={`<IconButton tone="danger" ariaLabel="Delete"><Trash2Icon size="14" /></IconButton>
<IconButton tone="success" ariaLabel="Approve"><CheckIcon size="14" /></IconButton>`}
>
  <div class="row">
    <IconButton tone="success" ariaLabel="Approve" onclick={() => showFlash("Approved")}>
      <CheckIcon size="14" strokeWidth="2" aria-hidden="true" />
    </IconButton>
    <IconButton tone="danger" ariaLabel="Delete" onclick={() => showFlash("Deleted")}>
      <Trash2Icon size="14" strokeWidth="2" aria-hidden="true" />
    </IconButton>
    <IconButton tone="info" ariaLabel="Refresh">
      <RefreshCwIcon size="14" strokeWidth="2" aria-hidden="true" />
    </IconButton>
    <IconButton tone="workflow" ariaLabel="Automate">
      <SettingsIcon size="14" strokeWidth="2" aria-hidden="true" />
    </IconButton>
    <span class="sep"></span>
    <IconButton ariaLabel="Disabled example" disabled>
      <Trash2Icon size="14" strokeWidth="2" aria-hidden="true" />
    </IconButton>
  </div>
</DemoSection>

<DemoSection
  title="Toggle (aria-pressed)"
  description="Pass ariaPressed for on/off buttons — true renders the inset pressed look and screen readers announce the state."
  code={`<IconButton ariaLabel="Pin" ariaPressed={pinned} onclick={() => (pinned = !pinned)}>
  <PinIcon size="14" />
</IconButton>`}
>
  <div class="row">
    <IconButton ariaLabel="Pin" ariaPressed={pinned} onclick={() => (pinned = !pinned)}>
      <PinIcon size="14" strokeWidth="2" aria-hidden="true" />
    </IconButton>
    <span class="readout">pinned: <code>{pinned}</code></span>
  </div>
</DemoSection>

<style>
  .row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .sep {
    width: 1px;
    height: 16px;
    background: var(--border-muted);
    margin: 0 var(--space-3);
  }

  .readout {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
    margin-left: var(--space-4);
  }
</style>
