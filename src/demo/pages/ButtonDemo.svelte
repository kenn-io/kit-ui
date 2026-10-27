<script lang="ts">
  import CheckIcon from "@lucide/svelte/icons/check";
  import GitMergeIcon from "@lucide/svelte/icons/git-merge";
  import XIcon from "@lucide/svelte/icons/x";
  import {
    Button,
    showFlash,
    Toggle,
    type ButtonSize,
    type ButtonSurface,
    type ButtonTone,
  } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  const tones: ButtonTone[] = ["neutral", "info", "success", "danger", "workflow"];
  const surfaces: ButtonSurface[] = ["outline", "soft", "solid"];
  const busyRows: { tone: ButtonTone; label: string; busyLabel?: string }[] = [
    { tone: "neutral", label: "Refresh", busyLabel: "Refreshing" },
    { tone: "info", label: "Save changes" },
    { tone: "success", label: "Approve" },
    { tone: "danger", label: "Delete" },
    { tone: "workflow", label: "Run workflow" },
  ];
  const busySizes: ButtonSize[] = ["sm", "md", "lg"];
  let allBusy = $state(false);
  let runningKeys = $state<string[]>([]);
  let busyRuns = $state(0);

  function runTask(key: string) {
    busyRuns += 1;
    runningKeys = [...runningKeys, key];
    setTimeout(() => {
      runningKeys = runningKeys.filter((running) => running !== key);
    }, 2000);
  }

  let structuralSelected = $state(false);
  let structuralElement = $state<HTMLButtonElement>();
  const centeringCode = '<Button label="info soft" size="sm" />';
  const centeringApproaches = [
    { id: "line-1", name: "Legacy line-height: 1", offset: "1.14px", gap: "2 / 3px", loss: "5.0%" },
    { id: "normal", name: "Normal line box", offset: "1.64px", gap: "4 / 3px", loss: "0%" },
    {
      id: "shadcn",
      name: "Shadcn-style 16px line box",
      offset: "1.14px",
      gap: "2 / 3px",
      loss: "0%",
    },
    { id: "button-grid", name: "Grid on button", offset: "1.64px", gap: "4 / 3px", loss: "0%" },
    {
      id: "align-content",
      name: "Flex align-content: center",
      offset: "1.64px",
      gap: "4 / 3px",
      loss: "0%",
    },
    { id: "label-flex", name: "Flex label wrapper", offset: "1.64px", gap: "4 / 3px", loss: "0%" },
    { id: "label-grid", name: "Grid label wrapper", offset: "1.64px", gap: "4 / 3px", loss: "0%" },
    { id: "text-edge", name: "Trim text edge", offset: "1.64px", gap: "4 / 3px", loss: "0%" },
    { id: "cap-edge", name: "Trim cap / alphabetic", offset: "1.14px", gap: "2 / 3px", loss: "0%" },
    { id: "cap-text", name: "Trim cap / text", offset: "0.75px", gap: "0 / -1px", loss: "0%" },
    { id: "ex-text", name: "Trim ex / text", offset: "1.83px", gap: "-2 / -3px", loss: "0%" },
    { id: "ex-edge", name: "Trim ex / alphabetic", offset: "0.33px", gap: "0 / 1px", loss: "0%" },
  ] as const;
</script>

<DemoSection
  title="Surfaces and tones"
  description="Button pairs a tone (semantic color) with a surface (visual weight). Solid info is the primary action; outline neutral is the default secondary."
  code={`<Button label="Save" tone="info" surface="solid" onclick={save} />
<Button label="Cancel" />
<Button label="Approve" tone="success" surface="soft" />
<Button label="Merge" tone="success" surface="solid" />
<Button label="Close" tone="danger" surface="outline" />
<Button label="Delete" tone="danger" surface="solid" />
<Button label="Run workflow" tone="workflow" surface="soft" />`}
>
  <Button label="Save" tone="info" surface="solid" onclick={() => showFlash("Saved!")} />
  <Button label="Cancel" onclick={() => showFlash("Canceled")} />
  <Button label="Approve" tone="success" surface="soft" />
  <Button label="Merge" tone="success" surface="solid" />
  <Button label="Close" tone="danger" surface="outline" />
  <Button label="Delete" tone="danger" surface="solid" />
  <Button label="Run workflow" tone="workflow" surface="soft" />
</DemoSection>

<DemoSection
  title="Busy state"
  description="Set busy while a button's action runs. The spinner sits over the faded label at the button's center, so the button keeps its size and its neighbors stay put. A busy button keeps focus and full color but ignores clicks; busyLabel names it for assistive technology. Click a button to run a two-second task."
  code={`<Button label="Refresh" busy={refreshing} busyLabel="Refreshing" onclick={refresh} />
<Button label="Save changes" tone="info" surface="solid" busy={saving} onclick={save} />`}
>
  <div class="busy-demo" data-demo="button-busy">
    <Toggle label="All busy" bind:checked={allBusy} />
    {#each busyRows as row (row.tone)}
      <div class="busy-demo__row" data-busy-tone={row.tone}>
        {#each surfaces as surface (surface)}
          {@const key = `${row.tone}-${surface}`}
          <Button
            label={row.label}
            busyLabel={row.busyLabel}
            tone={row.tone}
            {surface}
            busy={allBusy || runningKeys.includes(key)}
            onclick={() => runTask(key)}
          />
        {/each}
        <Button label="Cancel" class="busy-demo__neighbor" />
      </div>
    {/each}
    <div class="busy-demo__row" data-busy-sizes>
      {#each busySizes as size (size)}
        {@const key = `size-${size}`}
        <Button
          label={`Sync ${size}`}
          tone="info"
          surface="soft"
          {size}
          busy={allBusy || runningKeys.includes(key)}
          onclick={() => runTask(key)}
        />
      {/each}
      <Button label="Cancel" class="busy-demo__neighbor" />
    </div>
    <p class="busy-demo__runs" data-testid="busy-runs">Tasks started: {busyRuns}</p>
  </div>
</DemoSection>

<DemoSection
  title="Structural controls"
  description="Keep consumer-owned structural controls as native buttons and add kit-control-states for Kit's pressed, disabled, and focus behavior. Native bindings, actions, class directives, and scoped styles keep working."
  code={`<button
  bind:this={trigger}
  class="project-row kit-control-states"
  type="button"
  role="menuitemcheckbox"
  aria-checked={selected}
  data-project={project.uid}
>
  {project.name}
</button>`}
>
  <div role="menu" aria-label="Project actions">
    <button
      bind:this={structuralElement}
      class="structural-control kit-control-states"
      type="button"
      role="menuitemcheckbox"
      aria-label="Move to project"
      aria-checked={structuralSelected}
      aria-busy="false"
      data-structural-control="move-project"
      onclick={() => (structuralSelected = !structuralSelected)}
    >
      <span>Move to project</span>
      <span aria-hidden="true">→</span>
    </button>
  </div>
  <span class="kit-sr-only" data-testid="control-states-element-status">
    {structuralElement ? "bound" : "unbound"}
  </span>
</DemoSection>

<DemoSection
  title="Glyph safety"
  description="Button labels keep ascenders and descenders intact when a responsive consumer uses overflow clipping for ellipsis. The compact size has a measured 24px desktop floor; medium remains 28px."
  code={`<Button label="Merge" tone="success" surface="solid" size="sm">
  <GitMergeIcon size="14" />
</Button>`}
>
  <div class="glyph-safety" data-demo="button-glyph-safety">
    <div class="glyph-safety__row">
      <Button label="Approve" tone="success" surface="soft" size="sm">
        <CheckIcon size="14" strokeWidth="2.2" aria-hidden="true" />
      </Button>
      <Button label="Merge" tone="success" surface="solid" size="sm">
        <GitMergeIcon size="14" strokeWidth="2.2" aria-hidden="true" />
      </Button>
      <Button label="Close" tone="danger" surface="outline" size="sm">
        <XIcon size="14" strokeWidth="2.2" aria-hidden="true" />
      </Button>
      <Button
        label="Merge workflow request"
        tone="success"
        surface="solid"
        size="sm"
        class="glyph-safety__constrained"
      >
        <GitMergeIcon size="14" strokeWidth="2.2" aria-hidden="true" />
      </Button>
    </div>
    <div class="glyph-safety__row">
      <Button label="Approve" tone="success" surface="soft" />
      <Button label="Merge" tone="success" surface="solid" />
      <Button label="Close" tone="danger" surface="outline" />
    </div>
  </div>
</DemoSection>

<DemoSection
  title="Text centering lab"
  description="Every probe is exactly 24px high. Measurements come from browser-rasterized pixels at whole- and half-pixel positions; offset is the worst absolute optical-center error, gap lists the two top-minus-bottom pixel differences, and g loss compares clipped with unclipped paint."
  code={centeringCode}
>
  <div class="centering-lab" data-demo="button-centering-lab">
    <div class="centering-lab__header" aria-hidden="true">
      <span>Approach</span>
      <span>24px probes</span>
      <span>Offset</span>
      <span>Gap Δ</span>
      <span>g loss</span>
    </div>
    {#each centeringApproaches as approach (approach.id)}
      <div class="centering-lab__row" data-centering-approach={approach.id}>
        <code>{approach.name}</code>
        <div class="centering-lab__probes">
          <Button
            label="info soft"
            tone="info"
            surface="soft"
            size="sm"
            class={`centering-probe centering-probe--${approach.id}`}
          />
          <Button
            label="Merge"
            tone="success"
            surface="solid"
            size="sm"
            class={`centering-probe centering-probe--${approach.id}`}
          />
        </div>
        <span>{approach.offset}</span>
        <span>{approach.gap}</span>
        <span>{approach.loss}</span>
      </div>
    {/each}
  </div>
</DemoSection>

<DemoSection
  title="Full matrix"
  description="Every tone × surface combination is styled; see the variant guide in the docs for intended pairings."
  code={`<Button label="…" tone={tone} surface={surface} />`}
>
  <div class="button-matrix">
    {#each surfaces as surface (surface)}
      {#each tones as tone (tone)}
        <Button label={`${tone} ${surface}`} {tone} {surface} size="sm" />
      {/each}
    {/each}
  </div>
</DemoSection>

<DemoSection
  title="Sizes and states"
  code={`<Button label="Small" size="sm" />
<Button label="Medium" size="md" />
<Button label="Large" size="lg" />
<Button label="Disabled" disabled />`}
>
  <Button label="Small" size="sm" />
  <Button label="Medium" size="md" />
  <Button label="Large" size="lg" />
  <Button label="Disabled" disabled />
</DemoSection>

<DemoSection
  title="Icon and trailing content"
  description="Use the children snippet for leading content (icons) and the trailing snippet after the label."
  code={`<Button label="Next" tone="info" surface="solid">
  {#snippet trailing()}→{/snippet}
</Button>`}
>
  <Button label="Next" tone="info" surface="solid">
    {#snippet trailing()}→{/snippet}
  </Button>
</DemoSection>

<style>
  .busy-demo {
    display: grid;
    gap: var(--space-4);
  }

  .busy-demo__row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
  }

  .busy-demo__runs {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--font-size-sm);
  }

  .structural-control {
    box-sizing: border-box;
    appearance: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 280px;
    max-width: 100%;
    padding: var(--space-3) var(--space-4);
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-secondary);
    font: inherit;
    text-align: inherit;
    cursor: pointer;
  }

  .structural-control:hover {
    background: var(--bg-surface-hover);
    color: var(--text-primary);
  }

  .button-matrix {
    display: grid;
    grid-template-columns: repeat(5, max-content);
    gap: var(--space-4);
    align-items: center;
  }

  .glyph-safety {
    display: grid;
    gap: var(--space-4);
  }

  .glyph-safety__row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
  }

  .glyph-safety :global(.kit-button__label) {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .glyph-safety :global(.glyph-safety__constrained .kit-button__label) {
    max-width: 52px;
  }

  .centering-lab {
    display: grid;
    min-width: min(100%, 680px);
    overflow-x: auto;
    font-size: var(--font-size-sm);
  }

  .centering-lab__header,
  .centering-lab__row {
    display: grid;
    grid-template-columns: minmax(190px, 1fr) 210px 58px 58px 48px;
    gap: var(--space-4);
    align-items: center;
    min-width: 590px;
    padding: var(--space-3) 0;
    border-bottom: var(--border-width) solid var(--border-muted);
  }

  .centering-lab__header {
    color: var(--text-muted);
    font-weight: var(--font-weight-medium, 500);
  }

  .centering-lab__row code {
    color: var(--text-secondary);
  }

  .centering-lab__probes {
    display: flex;
    gap: var(--space-3);
    align-items: center;
  }

  :global(.centering-probe.kit-button) {
    block-size: 24px;
    min-block-size: 24px;
    line-height: normal;
  }

  :global(.centering-probe .kit-button__label) {
    display: block;
    align-items: normal;
    block-size: auto;
    min-width: 0;
    overflow: hidden;
  }

  :global(.centering-probe .kit-button__label-text) {
    display: inline;
    text-box-trim: none;
    text-box-edge: auto;
  }

  :global(.centering-probe--line-1.kit-button) {
    line-height: 1;
  }

  :global(.centering-probe--shadcn.kit-button) {
    padding-block: 0;
    line-height: 16px;
  }

  :global(.centering-probe--button-grid.kit-button) {
    display: inline-grid;
    place-items: center;
  }

  :global(.centering-probe--align-content.kit-button) {
    align-content: center;
  }

  :global(.centering-probe--label-flex .kit-button__label),
  :global(.centering-probe--text-edge .kit-button__label),
  :global(.centering-probe--cap-edge .kit-button__label),
  :global(.centering-probe--cap-text .kit-button__label),
  :global(.centering-probe--ex-text .kit-button__label),
  :global(.centering-probe--ex-edge .kit-button__label) {
    display: inline-flex;
    align-items: center;
    block-size: 1lh;
  }

  :global(.centering-probe--label-grid .kit-button__label) {
    display: inline-grid;
    place-items: center;
    block-size: 1lh;
  }

  :global(.centering-probe--text-edge .kit-button__label-text) {
    text-box-trim: trim-both;
    text-box-edge: text;
  }

  :global(.centering-probe--cap-edge .kit-button__label-text) {
    text-box-trim: trim-both;
    text-box-edge: cap alphabetic;
  }

  :global(.centering-probe--cap-text .kit-button__label-text) {
    text-box-trim: trim-both;
    text-box-edge: cap text;
  }

  :global(.centering-probe--ex-text .kit-button__label-text) {
    text-box-trim: trim-both;
    text-box-edge: ex text;
  }

  :global(.centering-probe--ex-edge .kit-button__label-text) {
    text-box-trim: trim-both;
    text-box-edge: ex alphabetic;
  }

  @media (max-width: 640px) {
    .button-matrix {
      grid-template-columns: repeat(2, max-content);
    }
  }
</style>
