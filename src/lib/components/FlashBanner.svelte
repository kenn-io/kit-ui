<script lang="ts">
  import XIcon from "@lucide/svelte/icons/x";
  import {
    dismissFlash,
    getFlashes,
    type FlashTone,
  } from "../stores/flash.svelte.js";

  interface Props {
    /** Distance from the top of the viewport, e.g. below an app header. */
    top?: string;
    /** Screen-reader severity prefixes per tone — tone must not be
     * color-only, so for semantic tones an empty override falls back to
     * the English default rather than suppressing the prefix. Only
     * `neutral` (no tone signal to convey) stays prefix-less. */
    toneLabels?: Partial<Record<FlashTone, string>>;
  }

  const DEFAULT_TONE_LABELS: Record<FlashTone, string> = {
    neutral: "",
    info: "Info",
    success: "Success",
    warning: "Warning",
    danger: "Error",
  };

  let { top = "44px", toneLabels = {} }: Props = $props();

  function toneLabel(tone: FlashTone): string {
    if (tone === "neutral") return "";
    // Guard the a11y contract: a semantic tone with an empty label would
    // be color-only, so blank overrides fall back to the default.
    return toneLabels[tone]?.trim() || DEFAULT_TONE_LABELS[tone];
  }

  const flashes = $derived(getFlashes());
</script>

{#if flashes.length > 0}
  <!-- width: max-content on the stack + width: 100% on each banner makes
       the widest message set the width for all of them. -->
  <div class="kit-flash-stack" style:top style:--kit-flash-top={top}>
    {#each flashes as flash (flash.id)}
      {@const tone = flash.tone ?? "neutral"}
      <div class="kit-flash-banner kit-flash-banner--{tone}" role="status">
        <span class="kit-flash-banner__text">
          {#if toneLabel(tone)}<span class="kit-flash-banner__sr-tone"
              >{toneLabel(tone)}:
            </span>{/if}{flash.message}</span
        >
        <button
          class="kit-flash-banner__dismiss"
          type="button"
          onclick={() => dismissFlash(flash.id)}
          title="Dismiss"
          aria-label="Dismiss"
        >
          <XIcon size="14" strokeWidth="2" aria-hidden="true" />
        </button>
        <div
          class="kit-flash-banner__progress"
          style:animation-duration="{flash.durationMs}ms"
          aria-hidden="true"
        ></div>
      </div>
    {/each}
  </div>
{/if}

<style>
  /* The stack reads as one card: the container owns radius/shadow, but
   * each banner draws its OWN border (Modal band principle: a toned
   * region's border area takes its tone; a single grey stack border
   * would leave toned banners with grey edges). */
  .kit-flash-stack {
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    width: max-content;
    max-width: min(480px, calc(100vw - 32px));
    /* Long wrapped messages can outgrow the count cap — scroll inside the
     * card rather than pushing dismiss buttons off-screen. Sized from the
     * actual `top` offset (mirrored into the custom property) plus a
     * matching bottom margin. */
    max-height: calc(100vh - var(--kit-flash-top, 44px) - 52px);
    overflow-y: auto;
    background: var(--bg-surface);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    overflow-x: hidden;
  }

  .kit-flash-banner {
    box-sizing: border-box;
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 16px;
    font-size: var(--font-size-md);
    color: var(--text-primary);
    border: 1px solid var(--border-default);
  }

  .kit-flash-banner:first-child {
    border-top-left-radius: var(--radius-md);
    border-top-right-radius: var(--radius-md);
  }

  .kit-flash-banner:last-child {
    border-bottom-left-radius: var(--radius-md);
    border-bottom-right-radius: var(--radius-md);
  }

  /* Stacked banners share one edge: the upper banner's bottom border
   * wins it (its tone bleeds down), so the lower banner drops its top
   * border instead of doubling up. */
  .kit-flash-banner + .kit-flash-banner {
    border-top: 0;
  }

  /* Semantic tones follow the Modal header-band recipe: one accent
   * variable per tone; band, ink, and countdown bar derive from it. Ink
   * mixes toward --text-primary to keep 13px text at AA on the tint. */
  .kit-flash-banner--info {
    --kit-flash-tone: var(--accent-blue);
  }
  .kit-flash-banner--success {
    --kit-flash-tone: var(--accent-green);
  }
  .kit-flash-banner--warning {
    --kit-flash-tone: var(--accent-amber);
  }
  .kit-flash-banner--danger {
    --kit-flash-tone: var(--accent-red);
  }

  .kit-flash-banner:not(.kit-flash-banner--neutral) {
    background: color-mix(in srgb, var(--kit-flash-tone) 9%, var(--bg-surface));
    color: color-mix(in srgb, var(--kit-flash-tone) 72%, var(--text-primary));
    /* Same 30% mix as the Modal band border. */
    border-color: color-mix(in srgb, var(--kit-flash-tone) 30%, var(--border-default));
  }

  /* Non-color tone signal for assistive tech (tone must never be
   * color-only); visually hidden, announced as a severity prefix. */
  .kit-flash-banner__sr-tone {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
  }

  .kit-flash-banner__text {
    flex: 1;
    min-width: 0;
    /* Long messages wrap at the stack's max-width; unbroken tokens
     * (URLs, ids) break rather than overflowing the card. */
    overflow-wrap: anywhere;
  }

  .kit-flash-banner__dismiss {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    background: none;
    border: none;
    padding: 0;
    /* Pull the button's box back out of the 16px text padding so its edge
     * gap matches the 8px vertical padding (same trick as Modal's close). */
    margin-right: calc(var(--space-4) - var(--space-6));
    color: var(--text-muted);
    cursor: pointer;
    line-height: 1;
    border-radius: var(--radius-sm);
  }

  .kit-flash-banner__dismiss:hover {
    color: var(--text-primary);
    background: var(--bg-surface-hover);
  }

  .kit-flash-banner:not(.kit-flash-banner--neutral) .kit-flash-banner__dismiss {
    color: color-mix(in srgb, var(--kit-flash-tone) 72%, var(--text-primary));
  }

  .kit-flash-banner:not(.kit-flash-banner--neutral) .kit-flash-banner__dismiss:hover {
    background: color-mix(in srgb, var(--kit-flash-tone) 16%, var(--bg-surface));
  }

  /* Countdown to auto-dismiss: full width at show time, empty when the
   * timer fires. Each banner is keyed by flash id, so the animation runs
   * once per flash. */
  .kit-flash-banner__progress {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 2px;
    background: var(--kit-flash-tone, var(--accent-blue));
    transform-origin: left;
    animation-name: kit-flash-countdown;
    animation-timing-function: linear;
    animation-fill-mode: forwards;
  }

  @keyframes kit-flash-countdown {
    from {
      transform: scaleX(1);
    }
    to {
      transform: scaleX(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .kit-flash-banner__progress {
      animation: none;
      transform: scaleX(1);
    }
  }
  /* Normalized keyboard focus (gyp8): one ring token, :focus-visible only. */
  .kit-flash-banner__dismiss:focus-visible {
    outline: var(--focus-ring);
    outline-offset: 1px;
  }
</style>
