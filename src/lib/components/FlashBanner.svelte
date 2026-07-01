<script lang="ts">
  import XIcon from "@lucide/svelte/icons/x";
  import { dismissFlash, getFlashes } from "../stores/flash.svelte.js";

  interface Props {
    /** Distance from the top of the viewport, e.g. below an app header. */
    top?: string;
  }

  let { top = "44px" }: Props = $props();

  const flashes = $derived(getFlashes());
</script>

{#if flashes.length > 0}
  <!-- width: max-content on the stack + width: 100% on each banner makes
       the widest message set the width for all of them. -->
  <div class="kit-flash-stack" style:top>
    {#each flashes as flash (flash.id)}
      <div class="kit-flash-banner" role="status">
        <span class="kit-flash-banner__text">{flash.message}</span>
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
  /* The stack reads as one card: the container owns border/radius/shadow
   * and each banner's countdown bar doubles as the row divider. */
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
    background: var(--bg-surface);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-md);
    overflow: hidden;
  }

  .kit-flash-banner {
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 16px;
    font-size: var(--font-size-md);
    color: var(--text-primary);
  }

  .kit-flash-banner__text {
    flex: 1;
  }

  .kit-flash-banner__dismiss {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: none;
    border: none;
    padding: 0 2px;
    color: var(--text-muted);
    cursor: pointer;
    line-height: 1;
  }

  .kit-flash-banner__dismiss:hover {
    color: var(--text-primary);
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
    background: var(--accent-blue);
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
</style>
