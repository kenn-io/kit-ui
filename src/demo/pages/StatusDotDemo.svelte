<script lang="ts">
  import { StatusDot, type StatusDotStatus } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  const statuses: { status: StatusDotStatus; label: string }[] = [
    { status: "working", label: "Working — actively writing" },
    { status: "waiting", label: "Waiting for your input" },
    { status: "idle", label: "Recently active" },
    { status: "stale", label: "Stale" },
    { status: "unclean", label: "Unclean shutdown" },
    { status: "quiet", label: "" },
  ];
</script>

<DemoSection
  title="Session states"
  description="Tiny presence indicator: pulsing green while working, a breathing speech bubble when the agent is waiting on the user, amber for stale, red for unclean."
  code={`<StatusDot status="working" label="Working" />
<StatusDot status="waiting" label="Your turn" />
<StatusDot status="stale" />`}
>
  {#each statuses as { status, label } (status)}
    <span class="row">
      <StatusDot {status} {label} />
      <span>{status}</span>
    </span>
  {/each}
</DemoSection>

<DemoSection title="Sizes" code={`<StatusDot status="working" size={10} />`}>
  <StatusDot status="working" size={6} />
  <StatusDot status="working" size={10} />
  <StatusDot status="working" size={14} />
</DemoSection>

<style>
  .row {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-right: 12px;
    color: var(--text-secondary);
  }
</style>
