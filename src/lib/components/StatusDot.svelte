<script module lang="ts">
  export type StatusDotStatus = "working" | "waiting" | "idle" | "stale" | "unclean" | "quiet";
</script>

<script lang="ts">
  interface Props {
    status: StatusDotStatus;
    /** Accessible label / tooltip; defaults to the status name. */
    label?: string;
    size?: number;
    /** Opt into compositor-friendly motion for working and waiting states. */
    animated?: boolean;
  }

  let { status, label = undefined, size = 6, animated = false }: Props = $props();

  const effectiveLabel = $derived(label ?? (status === "quiet" ? "" : status));
</script>

{#if status === "waiting"}
  <!-- FontAwesome free comment-solid (CC BY 4.0). The path defines
       a speech bubble whose body (the ellipse) is centered at SVG
       y=240 with a tail dropping to y=480. Two viewBox/path tricks
       to align the bubble body's optical center with the dots in
       neighboring rows:

       1. Cropping the viewBox to "0 -224 512 448" so the ellipse
          center (y=240) sits at the viewBox vertical center
          (-224 + 224 = 0, with height 448 → centered at y=0).
       2. Translating the path up by 240 so what's drawn at SVG
          y=240 lives at viewBox y=0.

       Result: the SVG element's geometric center IS the ellipse
       center, regardless of the tail. Sized to match the dots
       (no overflow, no flex centering complications). -->
  <svg
    class={["kit-status-bubble", animated && "kit-status-bubble--animated"]}
    viewBox="-256 -224 512 448"
    width="10"
    height="10"
    fill="currentColor"
    aria-label={effectiveLabel}
    role="img"
  >
    <title>{effectiveLabel}</title>
    <path
      transform="translate(-256 -240)"
      d="M512 240c0 114.9-114.6 208-256 208c-37.1 0-72.3-6.4-104.1-17.9c-11.9 8.7-31.3 20.6-54.3 30.6C73.6 471.1 44.7 480 16 480c-6.5 0-12.3-3.9-14.8-9.9c-2.5-6-1.1-12.8 3.4-17.4c.4-.4 .8-.8 1.3-1.4c1.1-1.2 2.8-3.1 4.9-5.7c4.1-5 9.6-12.4 15.2-21.6c10-16.6 19.5-38.4 21.4-62.9C17.7 326.8 0 285.1 0 240C0 125.1 114.6 32 256 32s256 93.1 256 208z"
    />
  </svg>
{:else}
  <span
    class={["kit-status-dot", `kit-status-dot--${status}`, animated && "kit-status-dot--animated"]}
    style:width="{size}px"
    style:height="{size}px"
    title={effectiveLabel}
    aria-label={effectiveLabel}
  ></span>
{/if}

<style>
  .kit-status-dot {
    display: inline-block;
    border-radius: var(--radius-dot, 50%);
    flex-shrink: 0;
    vertical-align: middle;
    box-sizing: border-box;
  }

  /* Working — something is happening right now. The solid green dot
     communicates the state without keeping the page in a paint loop. */
  .kit-status-dot--working {
    background: var(--accent-green, #22c55e);
    position: relative;
  }

  /* Paint the glow once, then fade the cached layer. Animating the
     box-shadow itself would repaint the row on every display frame. */
  .kit-status-dot--working.kit-status-dot--animated::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    box-shadow: 0 0 6px 3px color-mix(in srgb, var(--accent-green, #22c55e) 50%, transparent);
    opacity: 0;
    pointer-events: none;
    animation: kit-status-glow 2.4s ease-in-out infinite;
    will-change: opacity;
  }

  /* Recently active but no positive "waiting" signal. Smaller
     filled dot using a muted green so it sits below working in
     visual weight but stays readable. */
  .kit-status-dot--idle {
    background: color-mix(in srgb, var(--accent-green, #22c55e) 55%, transparent);
    transform: scale(0.7);
  }

  .kit-status-dot--stale {
    background: var(--accent-amber, #f59e0b);
  }

  .kit-status-dot--unclean {
    background: var(--accent-red, #ef4444);
  }

  .kit-status-dot--quiet {
    background: transparent;
  }

  /* Waiting on user input — a small speech bubble whose shape and
     Waiting Gold color distinguish it from the working dot. */
  .kit-status-bubble {
    display: inline-block;
    flex-shrink: 0;
    vertical-align: middle;
    overflow: visible;
    color: var(--status-waiting, #a48a55);
  }

  .kit-status-bubble--animated {
    animation: kit-icon-breathe 2.6s ease-in-out infinite;
    will-change: opacity;
  }

  @keyframes kit-icon-breathe {
    0%,
    100% {
      opacity: 0.45;
    }
    50% {
      opacity: 0.9;
    }
  }

  @keyframes kit-status-glow {
    0%,
    100% {
      opacity: 0;
    }
    50% {
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .kit-status-dot--working.kit-status-dot--animated::after,
    .kit-status-bubble--animated {
      animation: none;
    }
  }
</style>
