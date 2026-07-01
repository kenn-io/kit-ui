<script lang="ts">
  import XIcon from "@lucide/svelte/icons/x";
  import { dismissFlash, getFlash } from "../stores/flash.svelte.js";

  interface Props {
    /** Distance from the top of the viewport, e.g. below an app header. */
    top?: string;
  }

  let { top = "44px" }: Props = $props();

  const flash = $derived(getFlash());
</script>

{#if flash}
  <div class="kit-flash-banner" style:top role="status">
    <span class="kit-flash-banner__text">{flash.message}</span>
    <button
      class="kit-flash-banner__dismiss"
      type="button"
      onclick={dismissFlash}
      title="Dismiss"
      aria-label="Dismiss"
    >
      <XIcon size="14" strokeWidth="2" aria-hidden="true" />
    </button>
    {#key flash.id}
      <div
        class="kit-flash-banner__progress"
        style:animation-duration="{flash.durationMs}ms"
        aria-hidden="true"
      ></div>
    {/key}
  </div>
{/if}

<style>
  .kit-flash-banner {
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 16px;
    background: var(--bg-surface);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-md);
    font-size: var(--font-size-md);
    color: var(--text-primary);
    max-width: 480px;
    overflow: hidden;
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
   * timer fires. Keyed by message id so replacing a message restarts it. */
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
