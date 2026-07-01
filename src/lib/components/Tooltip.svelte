<script module lang="ts">
  let nextTooltipID = 0;

  function allocateTooltipID(): string {
    nextTooltipID += 1;
    return `kit-tooltip-${nextTooltipID}`;
  }
</script>

<script lang="ts">
  import type { Snippet } from "svelte";
  import { tick } from "svelte";
  import { floatingPopoverStyle } from "./floatingPosition.js";

  interface Props {
    /** Simple text tooltip; for rich content use the `content` snippet. */
    text?: string;
    content?: Snippet;
    /** The trigger the tooltip describes. */
    children: Snippet;
    /** Add tabindex so a non-interactive trigger (plain text/icon) is
     * keyboard-reachable. Leave false when the child is already focusable
     * (button, link, input). */
    focusable?: boolean;
    align?: "start" | "end";
    openDelayMs?: number;
    closeDelayMs?: number;
    /** Extra classes on the popover panel. */
    class?: string;
  }

  let {
    text = undefined,
    content = undefined,
    children,
    focusable = false,
    align = "start",
    openDelayMs = 250,
    closeDelayMs = 100,
    class: className = "",
  }: Props = $props();

  const tooltipID = allocateTooltipID();

  let open = $state(false);
  let side = $state<"top" | "bottom">("bottom");
  let popoverStyle = $state("");
  let triggerEl = $state<HTMLSpanElement>();
  let popoverEl = $state<HTMLDivElement>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  function clearTimer(): void {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  }

  async function position(): Promise<void> {
    await tick();
    if (!triggerEl || !popoverEl) return;
    const trigger = triggerEl.getBoundingClientRect();
    popoverStyle = floatingPopoverStyle({
      trigger,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      popoverWidth: popoverEl.offsetWidth,
      popoverHeight: popoverEl.offsetHeight,
      align,
      triggerGap: 8,
    });
    const top = Number.parseFloat(/top: (-?[0-9.]+)px/.exec(popoverStyle)?.[1] ?? "0");
    side = top < trigger.top ? "top" : "bottom";
  }

  function show(immediate = false): void {
    clearTimer();
    if (open) return;
    if (immediate || openDelayMs <= 0) {
      open = true;
      void position();
      return;
    }
    timer = setTimeout(() => {
      open = true;
      void position();
    }, openDelayMs);
  }

  function hide(immediate = false): void {
    clearTimer();
    if (!open) return;
    if (immediate || closeDelayMs <= 0) {
      open = false;
      return;
    }
    timer = setTimeout(() => {
      open = false;
    }, closeDelayMs);
  }

  $effect(() => {
    if (!open) return;

    function handleKeydown(event: KeyboardEvent): void {
      if (event.key === "Escape") hide(true);
    }

    function reposition(): void {
      void position();
    }

    // Dynamic tooltip content resizes the bubble — reposition.
    const observer = new ResizeObserver(() => reposition());
    if (popoverEl) observer.observe(popoverEl);

    document.addEventListener("keydown", handleKeydown);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      observer.disconnect();
      document.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
      clearTimer();
    };
  });
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_static_element_interactions -->
<!-- WAI-ARIA tooltip pattern: the wrapper is not itself interactive — it only
     mirrors hover/focus of the described content, and `focusable` adds
     tabindex precisely when the wrapped child has no focusable element. -->
<span
  class="kit-tooltip-trigger"
  bind:this={triggerEl}
  tabindex={focusable ? 0 : undefined}
  aria-describedby={open ? tooltipID : undefined}
  onmouseenter={() => show()}
  onmouseleave={() => hide()}
  onfocusin={() => show(true)}
  onfocusout={() => hide(true)}
>
  {@render children()}
</span>

{#if open}
  <div
    id={tooltipID}
    class={["kit-tooltip", className]}
    role="tooltip"
    data-side={side}
    data-align={align}
    style={popoverStyle}
    bind:this={popoverEl}
    onmouseenter={() => show(true)}
    onmouseleave={() => hide()}
  >
    {#if content}
      {@render content()}
    {:else if text}
      {text}
    {/if}
  </div>
{/if}

<style>
  .kit-tooltip-trigger {
    display: inline-flex;
    min-width: 0;
    vertical-align: middle;
  }

  .kit-tooltip-trigger:focus-visible {
    outline: var(--focus-ring);
    outline-offset: 2px;
    border-radius: var(--radius-sm);
  }

  .kit-tooltip {
    position: fixed;
    z-index: 1100;
    width: max-content;
    max-width: min(280px, calc(100vw - 32px));
    padding: var(--space-4) var(--space-5);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    background: var(--bg-surface);
    color: var(--text-primary);
    font-size: var(--font-size-sm);
    line-height: 1.45;
    box-shadow: var(--shadow-lg);
  }

  /* Arrow — mirrors the DiffSummaryChip precedent; flips with data-side. */
  .kit-tooltip::before {
    content: "";
    position: absolute;
    width: 8px;
    height: 8px;
    transform: rotate(45deg);
    background: var(--bg-surface);
  }

  .kit-tooltip[data-align="start"]::before {
    left: 18px;
  }

  .kit-tooltip[data-align="end"]::before {
    right: 18px;
  }

  .kit-tooltip[data-side="bottom"]::before {
    top: -5px;
    border-left: 1px solid var(--border-default);
    border-top: 1px solid var(--border-default);
  }

  .kit-tooltip[data-side="top"]::before {
    bottom: -5px;
    border-right: 1px solid var(--border-default);
    border-bottom: 1px solid var(--border-default);
  }

  /* Touch devices have no hover; tooltips still appear on focus. */
</style>
