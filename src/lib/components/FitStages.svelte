<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    /** Renderings of the same control at decreasing widths, ordered richest
     * first, most compact last. The last stage is the unconditional
     * fallback when nothing fits. */
    stages: Snippet[];
    /** Index of the currently rendered stage (bindable, read-only in
     * spirit) — lets the surrounding code react to a downgrade. */
    stage?: number;
    /** Fires whenever measurement switches the rendered stage. */
    onstagechange?: (stage: number) => void;
    class?: string;
  }

  let {
    stages,
    stage = $bindable(0),
    onstagechange = undefined,
    class: className = "",
  }: Props = $props();

  let hostEl = $state<HTMLElement>();
  let probeEls = $state<HTMLElement[]>([]);

  const active = $derived(Math.min(Math.max(stage, 0), Math.max(stages.length - 1, 0)));

  // Every stage renders as a hidden shrink-wrapped probe, so each stage's
  // natural width is always known regardless of which one is visible. The
  // rendered stage is the first whose probe fits the host — and because
  // probe widths never depend on the active stage, the choice is a pure
  // function of host width and cannot oscillate. (Corollary: the host must
  // be sized by its container — `flex: 1 1 0; min-width: 0` or an explicit
  // width — never by its own content, or the measurement feeds back.)
  function measure(): void {
    if (!hostEl || stages.length === 0) return;
    const width = hostEl.getBoundingClientRect().width;
    let next = stages.length - 1;
    for (let i = 0; i < stages.length; i += 1) {
      const probe = probeEls[i];
      if (probe && probe.getBoundingClientRect().width <= width) {
        next = i;
        break;
      }
    }
    if (next !== stage) {
      stage = next;
      onstagechange?.(next);
    }
  }

  $effect(() => {
    if (!hostEl) return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(hostEl);
    for (const el of probeEls) {
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  });
</script>

<div class={["kit-fit-stages", className]} bind:this={hostEl}>
  {#if stages[active]}
    {@render stages[active]!()}
  {/if}
  <!-- Zero-size clipped layer: probes lay out at natural width inside it
       but never contribute to any ancestor's scrollable overflow. -->
  <div class="kit-fit-stages__probes" aria-hidden="true" inert>
    {#each stages as probeStage, i (i)}
      <div class="kit-fit-stages__probe" bind:this={probeEls[i]}>
        {@render probeStage()}
      </div>
    {/each}
  </div>
</div>

<style>
  .kit-fit-stages {
    position: relative;
    min-width: 0;
  }

  .kit-fit-stages__probes {
    position: absolute;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    overflow: hidden;
    visibility: hidden;
    pointer-events: none;
  }

  /* Probes shrink-wrap so they report each stage's natural width; stage
   * content that flexes should declare its floor via min-width, which is
   * what the probe ends up measuring. */
  .kit-fit-stages__probe {
    width: max-content;
  }
</style>
