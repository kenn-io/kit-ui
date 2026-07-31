<script lang="ts">
  import CheckIcon from "@lucide/svelte/icons/check";
  import GitMergeIcon from "@lucide/svelte/icons/git-merge";
  import XIcon from "@lucide/svelte/icons/x";
  import { Button, showFlash, type ButtonSurface, type ButtonTone } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  const tones: ButtonTone[] = ["neutral", "info", "success", "danger", "workflow"];
  const surfaces: ButtonSurface[] = ["outline", "soft", "solid"];
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
